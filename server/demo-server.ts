import express from 'express';
import { createServer } from 'http';
import { Server, Namespace, Socket } from 'socket.io';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.resolve(__dirname, '../uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ────────────────────────────────────────────────
// In-memory session store
// ────────────────────────────────────────────────
interface Participant {
    userId: string;
    nickname: string;
    role: 'host' | 'guest';
    joinedAt: number;
}

interface SessionData {
    sessionId: string;
    code: string;        // 6-digit join code
    hostId: string;
    participants: Map<string, Participant>;
    backgroundUrl: string | null;
    // strokes keyed by userId: raw binary chunks list
    strokes: Map<string, Buffer[]>;
    // annotations: { guestId → pageId → Buffer[] }
    annotations: Map<string, Map<string, Buffer[]>>;
}

const sessions = new Map<string, SessionData>();
const codeToSession = new Map<string, string>(); // code → sessionId
const socketToSession = new Map<string, { sessionId: string; userId: string }>();

function makeSessionId(): string {
    return Math.random().toString(36).slice(2, 10);
}

function makeCode(): string {
    let code: string;
    do {
        code = String(Math.floor(100000 + Math.random() * 900000));
    } while (codeToSession.has(code) || roomCodeToId.has(code));
    return code;
}

function getSessionRoom(sessionId: string) { return `session:${sessionId}`; }
function getUserRoom(userId: string) { return `user:${userId}`; }

// ────────────────────────────────────────────────
// In-memory Room store (고정 세션)
// ────────────────────────────────────────────────
interface RoomData {
    roomId: string;
    hostId: string;
    hostNickname: string;
    name: string;
    schedule: string;
    maxGuests: number;
    code: string;
    isOpen: boolean;
    activeSessionId: string | null;
    createdAt: number;
}

const rooms = new Map<string, RoomData>();
const roomCodeToId = new Map<string, string>();

function makeRoomId(): string {
    return `room_${Math.random().toString(36).slice(2, 10)}`;
}

function makeRoomCode(): string {
    let code: string;
    do {
        code = String(Math.floor(100000 + Math.random() * 900000));
    } while (codeToSession.has(code) || roomCodeToId.has(code));
    return code;
}

// ────────────────────────────────────────────────
// Express + HTTP server
// ────────────────────────────────────────────────
const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use('/uploads', express.static(UPLOAD_DIR));

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage });

// Health check
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', sessions: sessions.size, rooms: rooms.size });
});

// ── Room API ──────────────────────────────────────

// 내 Room 목록 조회
app.get('/api/rooms', (req, res) => {
    const { hostId } = req.query as { hostId: string };
    if (!hostId) return res.status(400).json({ error: 'hostId required' });

    const myRooms = Array.from(rooms.values())
        .filter(r => r.hostId === hostId)
        .sort((a, b) => b.createdAt - a.createdAt)
        .map(r => ({
            roomId: r.roomId, name: r.name, schedule: r.schedule,
            maxGuests: r.maxGuests, code: r.code, isOpen: r.isOpen,
            activeSessionId: r.activeSessionId, createdAt: r.createdAt,
        }));

    return res.json({ rooms: myRooms });
});

// Room 생성
app.post('/api/rooms', (req, res) => {
    const { hostId, hostNickname, name, schedule, maxGuests } = req.body as {
        hostId: string; hostNickname: string; name: string; schedule: string; maxGuests?: number;
    };
    if (!hostId || !name) return res.status(400).json({ error: 'hostId and name required' });

    const roomId = makeRoomId();
    const code = makeRoomCode();

    const room: RoomData = {
        roomId, hostId, hostNickname: hostNickname || '선생님',
        name, schedule: schedule || '',
        maxGuests: maxGuests ?? 20,
        code, isOpen: false, activeSessionId: null,
        createdAt: Date.now(),
    };
    rooms.set(roomId, room);
    roomCodeToId.set(code, roomId);

    console.log(`[ROOM] Created "${name}" (code: ${code}) by ${hostNickname}`);
    return res.status(201).json({ room });
});

// Room 삭제
app.delete('/api/rooms/:roomId', (req, res) => {
    const room = rooms.get(req.params.roomId);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (room.isOpen) {
        if (room.activeSessionId) { sessions.delete(room.activeSessionId); codeToSession.delete(room.code); }
    }
    rooms.delete(room.roomId);
    roomCodeToId.delete(room.code);
    return res.json({ success: true });
});

// Room 열기
app.post('/api/rooms/:roomId/open', (req, res) => {
    const room = rooms.get(req.params.roomId);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (room.isOpen) return res.json({ room, sessionId: room.activeSessionId, userId: null, code: room.code });

    const sessionId = makeSessionId();
    const userId = `host_${Date.now()}`;
    const session: SessionData = {
        sessionId, code: room.code, hostId: userId,
        participants: new Map(), backgroundUrl: null,
        strokes: new Map(), annotations: new Map(),
    };
    const { nickname } = req.body as { nickname?: string };
    session.participants.set(userId, { userId, nickname: nickname || room.hostNickname, role: 'host', joinedAt: Date.now() });
    sessions.set(sessionId, session);
    codeToSession.set(room.code, sessionId);

    room.isOpen = true;
    room.activeSessionId = sessionId;

    console.log(`[ROOM] Opened "${room.name}" → session ${sessionId}`);
    return res.json({ room, sessionId, userId, code: room.code });
});

// Room 닫기
app.post('/api/rooms/:roomId/close', (req, res) => {
    const room = rooms.get(req.params.roomId);
    if (!room) return res.status(404).json({ error: 'Room not found' });

    if (room.activeSessionId) {
        sessions.delete(room.activeSessionId);
        codeToSession.delete(room.code);
    }
    room.isOpen = false;
    room.activeSessionId = null;

    console.log(`[ROOM] Closed "${room.name}"`);
    return res.json({ success: true, room });
});

// Room 코드로 상태 확인 (게스트 대기용 폴링)
app.get('/api/rooms/by-code/:code', (req, res) => {
    const roomId = roomCodeToId.get(req.params.code);
    if (!roomId) return res.status(404).json({ error: 'Room not found' });
    const room = rooms.get(roomId)!;
    return res.json({
        roomId: room.roomId, name: room.name, hostNickname: room.hostNickname,
        isOpen: room.isOpen, activeSessionId: room.activeSessionId, code: room.code,
    });
});

// REST: Create session (하위호환)
app.post('/api/sessions', (req, res) => {
    const { nickname } = req.body as { nickname: string };
    if (!nickname) return res.status(400).json({ error: 'nickname required' });

    const sessionId = makeSessionId();
    const code = makeCode();
    const userId = `host_${Date.now()}`;

    const session: SessionData = {
        sessionId, code, hostId: userId,
        participants: new Map(), backgroundUrl: null,
        strokes: new Map(), annotations: new Map(),
    };
    session.participants.set(userId, { userId, nickname, role: 'host', joinedAt: Date.now() });
    sessions.set(sessionId, session);
    codeToSession.set(code, sessionId);

    console.log(`[SESSION] Created ${sessionId} (code: ${code}) by ${nickname}`);
    return res.json({ sessionId, code, userId, role: 'host' });
});

// REST: Join session by code
app.post('/api/sessions/join', (req, res) => {
    const { code, nickname } = req.body as { code: string; nickname: string };
    if (!code || !nickname) return res.status(400).json({ error: 'code and nickname required' });

    const sessionId = codeToSession.get(code);
    if (!sessionId) return res.status(404).json({ error: 'Session not found' });

    const session = sessions.get(sessionId)!;
    const userId = `guest_${Date.now()}`;
    session.participants.set(userId, { userId, nickname, role: 'guest', joinedAt: Date.now() });

    console.log(`[SESSION] ${nickname} joined ${sessionId} (code: ${code})`);
    return res.json({ sessionId, code, userId, role: 'guest' });
});

// REST: Get session info
app.get('/api/sessions/:sessionId', (req, res) => {
    const session = sessions.get(req.params.sessionId);
    if (!session) return res.status(404).json({ error: 'Not found' });

    return res.json({
        sessionId: session.sessionId, code: session.code, hostId: session.hostId,
        participants: Array.from(session.participants.values()),
        backgroundUrl: session.backgroundUrl,
    });
});

// REST: Upload background PDF/image
app.post('/api/sessions/:sessionId/background', upload.single('file'), (req, res) => {
    const session = sessions.get(req.params.sessionId);
    if (!session) return res.status(404).json({ error: 'Not found' });
    if (!req.file) return res.status(400).json({ error: 'No file' });

    const url = `/uploads/${req.file.filename}`;
    session.backgroundUrl = url;
    console.log(`[SESSION] Background uploaded: ${url}`);
    return res.json({ url });
});

// ────────────────────────────────────────────────
// Socket.IO
// ────────────────────────────────────────────────
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000,
});

// ── /stroke namespace ──────────────────────────
const strokeNs = io.of('/stroke');
strokeNs.on('connection', (socket: Socket) => {
    const { sessionId, userId } = socket.handshake.query as Record<string, string>;

    const session = sessions.get(sessionId);
    if (!session || !session.participants.has(userId)) {
        socket.emit('error', { code: 'PERMISSION_DENIED' });
        socket.disconnect();
        return;
    }

    socket.join(getSessionRoom(sessionId));
    socket.join(getUserRoom(userId));
    socketToSession.set(socket.id, { sessionId, userId });

    const participant = session.participants.get(userId)!;
    console.log(`[STROKE] ${participant.nickname} connected to session ${sessionId}`);

    // Send stroke history to joiner (host receives all, guest receives host's)
    const isHost = session.hostId === userId;
    if (isHost) {
        // Send all stored strokes to host
        session.strokes.forEach((chunks, senderId) => {
            chunks.forEach(chunk => {
                // Wrap: 4-byte sender prefix + chunk
                const senderIdBytes = Buffer.from(senderId.padEnd(32, '\0'));
                const wrapped = Buffer.concat([senderIdBytes.slice(0, 32), chunk]);
                socket.emit('stroke', wrapped);
            });
        });
    } else {
        // Send host's strokes to guest
        const hostChunks = session.strokes.get(session.hostId) ?? [];
        hostChunks.forEach(chunk => {
            const senderIdBytes = Buffer.from(session.hostId.padEnd(32, '\0'));
            const wrapped = Buffer.concat([senderIdBytes.slice(0, 32), chunk]);
            socket.emit('stroke', wrapped);
        });
    }

    // Handle incoming stroke (binary)
    socket.on('stroke', (data: Buffer) => {
        if (!sessions.get(sessionId)?.participants.has(userId)) return;

        if (isHost) {
            // Host stroke: store + broadcast to all guests
            const chunks = session.strokes.get(userId) ?? [];
            chunks.push(data);
            session.strokes.set(userId, chunks);

            const senderIdBuf = Buffer.alloc(32);
            Buffer.from(userId).copy(senderIdBuf, 0, 0, Math.min(userId.length, 32));
            const wrapped = Buffer.concat([senderIdBuf, data]);
            socket.to(getSessionRoom(sessionId)).emit('stroke', wrapped);
        } else {
            // Guest stroke: only forward stroke_complete to host (avoids active/completed duplicate rendering)
            try {
                const json = JSON.parse(data.toString());
                if (json.type !== 'stroke_complete') return;
            } catch { /* non-JSON binary, forward as-is */ }

            const chunks = session.strokes.get(userId) ?? [];
            chunks.push(data);
            session.strokes.set(userId, chunks);

            const senderIdBuf = Buffer.alloc(32);
            Buffer.from(userId).copy(senderIdBuf, 0, 0, Math.min(userId.length, 32));
            const wrapped = Buffer.concat([senderIdBuf, data]);
            strokeNs.to(getUserRoom(session.hostId)).emit('stroke', wrapped);
        }
    });

    socket.on('disconnect', () => {
        socketToSession.delete(socket.id);
        console.log(`[STROKE] ${participant.nickname} disconnected`);
    });
});

// ── /control namespace ─────────────────────────
const controlNs = io.of('/control');
controlNs.on('connection', (socket: Socket) => {
    const { sessionId, userId } = socket.handshake.query as Record<string, string>;

    const session = sessions.get(sessionId);
    if (!session || !session.participants.has(userId)) {
        socket.emit('error', { code: 'PERMISSION_DENIED' });
        socket.disconnect();
        return;
    }

    socket.join(getSessionRoom(sessionId));
    socket.join(getUserRoom(userId));
    socketToSession.set(socket.id, { sessionId, userId });

    const participant = session.participants.get(userId)!;
    console.log(`[CONTROL] ${participant.nickname} connected to session ${sessionId}`);

    // Send existing participant list to newcomer
    session.participants.forEach((p, pid) => {
        if (pid !== userId) {
            socket.emit('control', {
                type: 'PARTICIPANT_JOIN',
                userId: pid,
                userName: p.nickname,
                role: p.role,
                timestamp: p.joinedAt,
            });
        }
    });

    // Announce join to others
    socket.to(getSessionRoom(sessionId)).emit('control', {
        type: 'PARTICIPANT_JOIN',
        userId,
        userName: participant.nickname,
        role: participant.role,
        timestamp: Date.now(),
    });

    // Handle control messages from client
    socket.on('control', (msg: { type: string;[key: string]: unknown }) => {
        const isHost = session.hostId === userId;

        switch (msg.type) {
            case 'SPOTLIGHT_SHARE':
                if (!isHost) return;
                controlNs.to(getSessionRoom(sessionId)).emit('control', { ...msg, timestamp: Date.now() });
                break;
            case 'SESSION_STATUS':
                if (!isHost) return;
                controlNs.to(getSessionRoom(sessionId)).emit('control', { ...msg, timestamp: Date.now() });
                break;
            case 'ANNOTATION_MODE':
                // host broadcasts annotation mode to specific guest
                if (!isHost) return;
                controlNs.to(getUserRoom(msg.guestId as string)).emit('control', { ...msg, timestamp: Date.now() });
                break;
            default:
                break;
        }
    });

    // Handle annotation:stroke
    socket.on('annotation:stroke', (data: { guestId: string; pageId: string; points: number[][] }) => {
        const isHost = session.hostId === userId;
        if (!isHost) return;

        console.log(`[ANNOTATION] host → guest ${data.guestId}`);

        // Store annotation in memory
        if (!session.annotations.has(data.guestId)) {
            session.annotations.set(data.guestId, new Map());
        }
        const guestAnnotations = session.annotations.get(data.guestId)!;
        const pageAnnotations = guestAnnotations.get(data.pageId) ?? [];
        pageAnnotations.push(Buffer.from(JSON.stringify(data.points)));
        guestAnnotations.set(data.pageId, pageAnnotations);

        // Forward only to the specific guest
        controlNs.to(getUserRoom(data.guestId)).emit('annotation:stroke', {
            hostId: userId,
            pageId: data.pageId,
            points: data.points,
            timestamp: Date.now(),
        });
    });

    socket.on('disconnect', () => {
        socketToSession.delete(socket.id);

        const leaveIsHost = session.hostId === userId;
        if (!leaveIsHost) {
            socket.to(getSessionRoom(sessionId)).emit('control', {
                type: 'PARTICIPANT_LEAVE',
                userId,
                reason: 'disconnect',
                timestamp: Date.now(),
            });
        } else {
            // Host disconnect → notify guests
            socket.to(getSessionRoom(sessionId)).emit('control', {
                type: 'HOST_DISCONNECTED',
                hostId: userId,
                timestamp: Date.now(),
            });
        }

        session.participants.delete(userId);
        console.log(`[CONTROL] ${participant.nickname} left session ${sessionId}`);

        // Cleanup empty sessions
        if (session.participants.size === 0) {
            sessions.delete(sessionId);
            codeToSession.delete(session.code);
            console.log(`[SESSION] Cleaned up empty session ${sessionId}`);
        }
    });
});

// ── /voice namespace (passthrough, no TURN) ────
const voiceNs = io.of('/voice');
voiceNs.on('connection', (socket: Socket) => {
    const { sessionId, userId } = socket.handshake.query as Record<string, string>;

    const session = sessions.get(sessionId);
    if (!session || !session.participants.has(userId)) {
        socket.disconnect();
        return;
    }

    socket.join(getSessionRoom(sessionId));
    socket.join(getUserRoom(userId));

    socket.emit('voice:ready', { sampleRate: 48000, channels: 1, frameSize: 20, canTransmit: true });

    socket.on('voice:data', (data: Buffer) => {
        socket.to(getSessionRoom(sessionId)).volatile.emit('voice:data', { senderId: userId, data, timestamp: Date.now() });
    });

    ['voice:start', 'voice:end', 'voice:mute', 'voice:unmute'].forEach(event => {
        socket.on(event, () => socket.to(getSessionRoom(sessionId)).emit(event, { userId }));
    });

    socket.on('disconnect', () => { });
});

// ────────────────────────────────────────────────
// Start server
// ────────────────────────────────────────────────
const PORT = 7191;
httpServer.listen(PORT, () => {
    console.log(`\n✅ NeoCast Demo Server running on http://localhost:${PORT}`);
    console.log(`   Health: http://localhost:${PORT}/health`);
    console.log(`   Socket.IO namespaces: /stroke, /control, /voice\n`);
});
