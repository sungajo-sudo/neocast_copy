import { create } from 'zustand';
import { SessionStatus, ParticipantRole } from '../types';
import type { Session, Participant } from '../types';

// 사용자 색상 팔레트
const COLOR_PALETTE = [
  '#3B82F6', // blue
  '#22C55E', // green
  '#F97316', // orange
  '#A855F7', // purple
  '#EF4444', // red
  '#14B8A6', // teal
  '#78716C', // brown
  '#EC4899', // pink
];

// 그리드 레이아웃 설정
export interface GridLayout {
  rows: number;
  cols: number;
}

interface SessionStore {
  // 상태
  session: Session | null;
  sessionPassword: string | null; // 세션 비밀번호 (초대 링크 생성용) - deprecated, use session.inviteToken
  currentUserId: string | null;
  isHost: boolean;
  userColors: Map<string, string>;

  // 필기 보기 선택 (빈 배열 = 전체 보기, [userId] = 단일 사용자, [userId, ...] = 복수 사용자)
  selectedViewUserIds: string[];
  // 호환성을 위한 단일 선택 getter (첫 번째 선택된 사용자 또는 null)
  selectedViewUserId: string | null;

  // 그리드 레이아웃 (복수 보기용)
  gridLayout: GridLayout;
  isGridLayoutAuto: boolean; // 자동 그리드 레이아웃 모드
  minGridCells: number; // 최소 그리드 셀 수 (자동 축소 방지용)

  // 뷰 모드 (spotlight 또는 grid)
  viewMode: 'spotlight' | 'grid';
  spotlightUserId: string | null; // 스포트라이트 대상 사용자 ID (null = 자동 선택)

  // Active Canvas (멀티 캔버스 뷰에서 입력 대상)
  activeCanvasUserId: string | null; // 현재 활성화된 캔버스의 사용자 ID

  // Smartpen Input Target (스마트펜 입력 대상 - 호스트만 변경 가능)
  smartpenTargetUserId: string | null; // 스마트펜 입력을 받을 사용자 ID (null = 자신)

  // 주목 공유 (Spotlight Share)
  spotlightShareUserId: string | null; // 호스트가 공유 중인 주목 대상 사용자 ID (null = 비활성)
  preSpotlightShareState: { viewMode: 'spotlight' | 'grid'; spotlightUserId: string | null } | null; // 주목공유 이전 상태

  // 히스토리 동기화
  isSyncing: boolean;
  syncProgress: number;
  totalStrokes: number;

  // 액션
  setSession: (session: Session, password?: string) => void;
  setCurrentUserId: (userId: string) => void;
  clearSession: () => void;

  // 참가자 관리
  addParticipant: (participant: Participant) => void;
  removeParticipant: (userId: string) => void;
  updateParticipant: (userId: string, updates: Partial<Participant>) => void;
  setParticipantOnline: (userId: string, isOnline: boolean) => void;
  changeHost: (newHostId: string) => void;
  setInviteToken: (inviteToken: string | null) => void;

  // 필기 보기 선택
  setSelectedViewUser: (userId: string | null) => void;
  setSelectedViewUsers: (userIds: string[]) => void;
  toggleSelectedViewUser: (userId: string) => void;
  canViewUser: (userId: string) => boolean;
  getViewableUserIds: () => string[];
  isUserSelected: (userId: string) => boolean;

  // 그리드 레이아웃
  setGridLayout: (layout: GridLayout) => void;
  setGridLayoutAuto: (auto: boolean) => void;
  updateMinGridCells: (cells: number) => void;
  resetGridLayout: () => void; // 다시 정렬

  // 뷰 모드
  setViewMode: (mode: 'spotlight' | 'grid') => void;
  setSpotlightUserId: (userId: string | null) => void;

  // Active Canvas
  setActiveCanvasUserId: (userId: string | null) => void;
  getActiveCanvasUserId: () => string | null; // 단일 뷰면 selectedViewUserId, 멀티 뷰면 activeCanvasUserId

  // Smartpen Target
  setSmartpenTargetUserId: (userId: string | null) => void;
  getSmartpenTargetUserId: () => string; // 스마트펜 입력 대상 userId 반환 (null이면 currentUserId)
  resetSmartpenTarget: () => void; // 스마트펜 입력을 자신에게로 되돌리기

  // 주목 공유
  setSpotlightShare: (userId: string | null) => void;

  // 퇴출 상태
  kicked: boolean;
  setKicked: (kicked: boolean) => void;

  // 동기화
  startSync: (totalStrokes: number) => void;
  updateSyncProgress: (synced: number) => void;
  endSync: () => void;

  // 유틸리티
  getUserColor: (userId: string) => string;
  getParticipant: (userId: string) => Participant | undefined;
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  // 초기 상태
  session: null,
  sessionPassword: null,
  currentUserId: null,
  isHost: false,
  userColors: new Map(),
  selectedViewUserIds: [],
  // 호환성을 위한 단일 선택 (첫 번째 선택된 사용자)
  selectedViewUserId: null,
  gridLayout: { rows: 1, cols: 1 },
  isGridLayoutAuto: true,
  minGridCells: 1,
  viewMode: 'spotlight',
  spotlightUserId: null,
  activeCanvasUserId: null,
  smartpenTargetUserId: null,
  spotlightShareUserId: null,
  preSpotlightShareState: null,
  kicked: false,
  isSyncing: false,
  syncProgress: 0,
  totalStrokes: 0,

  setSession: (session, password) => {
    // DEBUG: setSession 호출 시 inviteToken 확인
    console.log('[session-store] setSession called:', {
      inviteToken: session.inviteToken,
      hasPassword: session.hasPassword,
    });

    const { currentUserId } = get();
    // 호스트 여부 확인: hostId이거나 role이 HOST인 경우
    const currentParticipant = session.participants.find(p => p.userId === currentUserId);
    const isHost = session.hostId === currentUserId ||
      currentParticipant?.role === ParticipantRole.Host;

    // 참가자에 isOnline 기본값 설정 (undefined인 경우 true로 설정)
    const participantsWithOnline = session.participants.map(p => ({
      ...p,
      isOnline: p.isOnline ?? true,
    }));

    // 참가자별 색상 할당
    const userColors = new Map<string, string>();
    participantsWithOnline.forEach((p, index) => {
      userColors.set(p.userId, COLOR_PALETTE[index % COLOR_PALETTE.length]);
    });

    // 호스트는 전체 보기(빈 배열), 게스트는 자신의 필기만 보기로 초기화
    const selectedViewUserIds = isHost ? [] : (currentUserId ? [currentUserId] : []);
    const selectedViewUserId = selectedViewUserIds.length === 1 ? selectedViewUserIds[0] : null;

    const sessionToStore = { ...session, participants: participantsWithOnline };
    // DEBUG: 저장되는 세션 확인
    console.log('[session-store] storing session:', {
      inviteToken: sessionToStore.inviteToken,
      hasPassword: sessionToStore.hasPassword,
    });

    set({
      session: sessionToStore,
      sessionPassword: password ?? null,
      isHost,
      userColors,
      selectedViewUserIds,
      selectedViewUserId,
      // 게스트는 자신의 캔버스를 기본 스포트라이트로 설정
      ...(!isHost && currentUserId ? { spotlightUserId: currentUserId } : {}),
    });
  },

  setCurrentUserId: (userId) => {
    const { session } = get();
    // 호스트 여부 확인: hostId이거나 role이 HOST인 경우
    const currentParticipant = session?.participants.find(p => p.userId === userId);
    const isHost = session?.hostId === userId ||
      currentParticipant?.role === ParticipantRole.Host;
    set({ currentUserId: userId, isHost });
  },

  clearSession: () => {
    set({
      session: null,
      sessionPassword: null,
      isHost: false,
      userColors: new Map(),
      selectedViewUserIds: [],
      selectedViewUserId: null,
      gridLayout: { rows: 1, cols: 1 },
      isGridLayoutAuto: true,
      minGridCells: 1,
      viewMode: 'spotlight',
      spotlightUserId: null,
      activeCanvasUserId: null,
      smartpenTargetUserId: null,
      spotlightShareUserId: null,
      preSpotlightShareState: null,
      kicked: false,
      isSyncing: false,
      syncProgress: 0,
      totalStrokes: 0,
    });
  },

  addParticipant: (participant) => {
    const { session, userColors, selectedViewUserIds, isHost } = get();
    if (!session) return;

    // 이미 있는지 확인 - 있으면 isOnline만 업데이트
    const existingParticipant = session.participants.find((p) => p.userId === participant.userId);
    if (existingParticipant) {
      // 재연결인 경우 isOnline을 true로 업데이트
      get().setParticipantOnline(participant.userId, true);
      return;
    }

    // 새 참가자는 isOnline: true로 설정
    const participantWithOnline = { ...participant, isOnline: true };

    // 색상 할당
    const colorIndex = session.participants.length % COLOR_PALETTE.length;
    const newUserColors = new Map(userColors);
    newUserColors.set(participant.userId, COLOR_PALETTE[colorIndex]);

    // 새 참가자를 선택 목록에 추가할지 결정 (호스트만)
    let newSelectedViewUserIds = selectedViewUserIds;
    if (isHost) {
      if (selectedViewUserIds.length === 0) {
        // 전체 보기 모드면 그대로 유지 (새 참가자도 자동으로 보임)
        newSelectedViewUserIds = [];
      } else {
        // 모든 기존 참가자가 선택된 상태인지 확인
        const allExistingSelected = session.participants.every(
          (p) => selectedViewUserIds.includes(p.userId)
        );
        if (allExistingSelected) {
          // 모두 선택 상태면 새 참가자도 선택에 추가
          newSelectedViewUserIds = [...selectedViewUserIds, participant.userId];
        }
      }
    }

    set({
      session: {
        ...session,
        participants: [...session.participants, participantWithOnline],
      },
      userColors: newUserColors,
      selectedViewUserIds: newSelectedViewUserIds,
      selectedViewUserId: newSelectedViewUserIds.length === 1 ? newSelectedViewUserIds[0] : null,
      // 그리드 자동 레이아웃으로 리셋 (참가자 변동 시 최적 레이아웃 재계산)
      minGridCells: 1,
      isGridLayoutAuto: true,
    });
  },

  removeParticipant: (userId) => {
    const { session, selectedViewUserIds, activeCanvasUserId, smartpenTargetUserId, spotlightShareUserId, preSpotlightShareState } = get();
    if (!session) return;

    // 선택 목록에서도 제거
    const newSelectedViewUserIds = selectedViewUserIds.filter((id) => id !== userId);

    // 활성 캔버스가 나간 사용자였으면 초기화
    const newActiveCanvasUserId = activeCanvasUserId === userId ? null : activeCanvasUserId;

    // 스마트펜 타겟이 나간 사용자였으면 초기화
    const newSmartpenTargetUserId = smartpenTargetUserId === userId ? null : smartpenTargetUserId;

    // 주목공유 대상이 나간 사용자였으면 자동 해제 + 이전 상태 복원
    const spotlightShareLeft = spotlightShareUserId === userId;
    const newSpotlightShareUserId = spotlightShareLeft ? null : spotlightShareUserId;

    set({
      session: {
        ...session,
        participants: session.participants.filter((p) => p.userId !== userId),
      },
      selectedViewUserIds: newSelectedViewUserIds,
      selectedViewUserId: newSelectedViewUserIds.length === 1 ? newSelectedViewUserIds[0] : null,
      activeCanvasUserId: newActiveCanvasUserId,
      smartpenTargetUserId: newSmartpenTargetUserId,
      spotlightShareUserId: newSpotlightShareUserId,
      // 주목공유 대상이 퇴장 시 이전 상태 복원
      ...(spotlightShareLeft && preSpotlightShareState ? {
        viewMode: preSpotlightShareState.viewMode,
        spotlightUserId: preSpotlightShareState.spotlightUserId,
        preSpotlightShareState: null,
      } : spotlightShareLeft ? {
        preSpotlightShareState: null,
      } : {}),
      // 그리드 축소를 위해 minGridCells 리셋
      minGridCells: 1,
    });
  },

  updateParticipant: (userId, updates) => {
    const { session, currentUserId } = get();
    if (!session) return;

    const updatedSession = {
      ...session,
      participants: session.participants.map((p) =>
        p.userId === userId ? { ...p, ...updates } : p
      ),
    };

    // 현재 사용자의 역할이 변경되었다면 isHost 상태도 업데이트
    let newIsHost = get().isHost;
    if (userId === currentUserId && updates.role !== undefined) {
      newIsHost = updates.role === ParticipantRole.Host ||
        session.hostId === currentUserId;
    }

    set({
      session: updatedSession,
      isHost: newIsHost,
    });
  },

  setParticipantOnline: (userId, isOnline) => {
    const { session } = get();
    if (!session) return;

    set({
      session: {
        ...session,
        participants: session.participants.map((p) =>
          p.userId === userId ? { ...p, isOnline } : p
        ),
      },
    });
  },

  changeHost: (newHostId) => {
    const { session, currentUserId } = get();
    if (!session) return;

    // 호스트 여부 재평가
    const currentParticipant = session.participants.find(p => p.userId === currentUserId);
    const isHost = newHostId === currentUserId ||
      currentParticipant?.role === ParticipantRole.Host;

    set({
      session: {
        ...session,
        hostId: newHostId,
      },
      isHost,
    });
  },

  setInviteToken: (inviteToken) => {
    const { session } = get();
    if (!session) return;

    set({
      session: {
        ...session,
        inviteToken,
      },
    });
  },

  // 필기 보기 선택 (단일 사용자 - 호환성 유지)
  setSelectedViewUser: (userId) => {
    const selectedViewUserIds = userId ? [userId] : [];
    set({ selectedViewUserIds, selectedViewUserId: userId });
  },

  // 복수 사용자 선택
  setSelectedViewUsers: (userIds) => {
    const selectedViewUserId = userIds.length === 1 ? userIds[0] : null;
    set({ selectedViewUserIds: userIds, selectedViewUserId });
  },

  // 사용자 선택 토글 (체크박스용)
  toggleSelectedViewUser: (userId) => {
    const { selectedViewUserIds } = get();
    let newIds: string[];
    if (selectedViewUserIds.includes(userId)) {
      newIds = selectedViewUserIds.filter((id) => id !== userId);
    } else {
      newIds = [...selectedViewUserIds, userId];
    }
    const selectedViewUserId = newIds.length === 1 ? newIds[0] : null;
    set({ selectedViewUserIds: newIds, selectedViewUserId });
  },

  // 특정 사용자의 필기를 볼 수 있는지 확인
  canViewUser: (userId) => {
    const { session, currentUserId, isHost } = get();
    if (!session || !currentUserId) return false;

    // 호스트는 모든 참가자의 필기를 볼 수 있음
    if (isHost) return true;

    // 게스트는 모든 호스트와 자신의 필기를 볼 수 있음
    const targetParticipant = session.participants.find(p => p.userId === userId);
    const isTargetHost = userId === session.hostId || targetParticipant?.role === ParticipantRole.Host;
    return isTargetHost || userId === currentUserId;
  },

  // 볼 수 있는 사용자 ID 목록 반환
  getViewableUserIds: () => {
    const { session, currentUserId, isHost } = get();
    if (!session || !currentUserId) return [];

    // 호스트는 모든 참가자 볼 수 있음
    if (isHost) {
      return session.participants.map(p => p.userId);
    }

    // 게스트는 모든 호스트와 자신만 볼 수 있음
    const hostIds = session.participants
      .filter(p => p.userId === session.hostId || p.role === ParticipantRole.Host)
      .map(p => p.userId);
    return [...new Set([...hostIds, currentUserId])];
  },

  // 특정 사용자가 현재 선택되어 있는지 확인
  isUserSelected: (userId) => {
    const { selectedViewUserIds } = get();
    // 빈 배열 = 전체 보기 (모두 선택된 것처럼)
    if (selectedViewUserIds.length === 0) return true;
    return selectedViewUserIds.includes(userId);
  },

  // 그리드 레이아웃 설정 (수동 선택 시 auto 모드 해제)
  setGridLayout: (layout) => {
    set({ gridLayout: layout, isGridLayoutAuto: false });
  },

  // 자동 그리드 레이아웃 모드 설정
  setGridLayoutAuto: (auto) => {
    set({ isGridLayoutAuto: auto });
  },

  // 최소 그리드 셀 수 업데이트 (더 큰 값만 적용)
  updateMinGridCells: (cells) => {
    const { minGridCells } = get();
    if (cells > minGridCells) {
      set({ minGridCells: cells });
    }
  },

  // 그리드 다시 정렬 (최소 그리드 셀 수 초기화 및 자동 모드로 전환)
  resetGridLayout: () => {
    set({ minGridCells: 1, isGridLayoutAuto: true });
  },

  // 뷰 모드 설정
  setViewMode: (mode) => {
    set({ viewMode: mode });
  },

  setSpotlightUserId: (userId) => {
    set({ spotlightUserId: userId });
  },

  // Active Canvas 설정
  setActiveCanvasUserId: (userId) => {
    set({ activeCanvasUserId: userId });
  },

  // Active Canvas 사용자 ID 반환 (단일 뷰면 selectedViewUserId, 멀티 뷰면 activeCanvasUserId)
  getActiveCanvasUserId: () => {
    const { selectedViewUserIds, selectedViewUserId, activeCanvasUserId, currentUserId } = get();

    // 단일 선택 (1명)이면 그 사용자가 active
    if (selectedViewUserIds.length === 1) {
      return selectedViewUserIds[0];
    }

    // 멀티 뷰 (0명=전체 또는 2명 이상)면 activeCanvasUserId 사용
    if (selectedViewUserIds.length === 0 || selectedViewUserIds.length > 1) {
      return activeCanvasUserId;
    }

    // 호환성: selectedViewUserId가 있으면 사용
    return selectedViewUserId ?? currentUserId;
  },

  // Smartpen Target 설정
  setSmartpenTargetUserId: (userId) => {
    set({ smartpenTargetUserId: userId });
  },

  // Smartpen Target 사용자 ID 반환 (null이면 currentUserId)
  getSmartpenTargetUserId: () => {
    const { smartpenTargetUserId, currentUserId } = get();
    return smartpenTargetUserId ?? currentUserId ?? '';
  },

  // Smartpen Target을 자신에게로 되돌리기
  resetSmartpenTarget: () => {
    set({ smartpenTargetUserId: null });
  },

  // 주목 공유 설정/해제
  setSpotlightShare: (userId) => {
    if (userId !== null) {
      const { viewMode, spotlightUserId, preSpotlightShareState } = get();
      // 최초 진입 시에만 현재 상태 저장 (호스트가 대상 변경 시 기존 저장 유지)
      const savedState = preSpotlightShareState ?? { viewMode, spotlightUserId };
      set({
        spotlightShareUserId: userId,
        viewMode: 'spotlight',
        spotlightUserId: userId,
        preSpotlightShareState: savedState,
      });
    } else {
      const { preSpotlightShareState } = get();
      // 이전 상태 복원
      set({
        spotlightShareUserId: null,
        preSpotlightShareState: null,
        ...(preSpotlightShareState ? {
          viewMode: preSpotlightShareState.viewMode,
          spotlightUserId: preSpotlightShareState.spotlightUserId,
        } : {}),
      });
    }
  },

  startSync: (totalStrokes) => {
    set({ isSyncing: true, syncProgress: 0, totalStrokes });
  },

  updateSyncProgress: (synced) => {
    set({ syncProgress: synced });
  },

  endSync: () => {
    set({ isSyncing: false });
  },

  setKicked: (kicked) => {
    set({ kicked });
  },

  getUserColor: (userId) => {
    const { userColors } = get();
    return userColors.get(userId) || COLOR_PALETTE[0];
  },

  getParticipant: (userId) => {
    const { session } = get();
    return session?.participants.find((p) => p.userId === userId);
  },
}));

// 임시 세션 생성 (테스트용)
export function createMockSession(hostId: string): Session {
  return {
    id: crypto.randomUUID(),
    code: generateSessionCode(),
    status: SessionStatus.Active,
    hostId,
    participants: [
      {
        userId: hostId,
        userName: 'Host',
        role: ParticipantRole.Host,
        joinedAt: Date.now(),
        isMuted: false,
        isSpeaking: false,
      },
    ],
    createdAt: Date.now(),
  };
}

// 세션 코드 생성
function generateSessionCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
