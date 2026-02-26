import { useState, useEffect } from 'react';

interface CreateSessionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (code: string) => void;
}

interface Room {
    roomId: string;
    name: string;
    schedule: string;
    maxGuests: number;
    code: string;
    isOpen: boolean;
    activeSessionId: string | null;
    createdAt: number;
    expectedStudents?: number;
    worksheet?: string;
    allowGuest?: boolean;
}

export default function CreateSessionModal({ isOpen, onClose, onSuccess }: CreateSessionModalProps) {
    const [title, setTitle] = useState('');
    const [date, setDate] = useState('');
    const [time, setTime] = useState('');
    const [expectedStudents, setExpectedStudents] = useState('');
    const [worksheet, setWorksheet] = useState<File | null>(null);
    const [allowGuest, setAllowGuest] = useState(true);
    const [code, setCode] = useState('');
    const [copied, setCopied] = useState(false);
    const [creating, setCreating] = useState(false);
    const [created, setCreated] = useState(false);

    // 모달 열릴 때 6자리 코드 생성
    useEffect(() => {
        if (isOpen) {
            const newCode = String(Math.floor(100000 + Math.random() * 900000));
            setCode(newCode);
            setCreated(false);
        }
    }, [isOpen]);

    const handleCopyCode = async () => {
        try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('복사 실패:', err);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && file.type === 'application/pdf') {
            setWorksheet(file);
        } else {
            alert('PDF 파일만 업로드 가능합니다.');
        }
    };

    const handleCreate = async () => {
        // 필수 필드 검증
        if (!title.trim()) {
            alert('수업 제목을 입력해주세요.');
            return;
        }
        if (!expectedStudents || parseInt(expectedStudents) <= 0) {
            alert('참가 예정 인원 수를 입력해주세요.');
            return;
        }

        setCreating(true);
        try {
            // 날짜/시간 처리 (미입력 시 현재 시간)
            let schedule = '';
            if (date && time) {
                schedule = `${date} ${time}`;
            } else {
                const now = new Date();
                schedule = now.toLocaleString('ko-KR');
            }

            // Room 객체 생성
            const roomId = `room-${Date.now()}`;
            const newRoom: Room = {
                roomId,
                name: title.trim(),
                schedule,
                maxGuests: parseInt(expectedStudents),
                code,
                isOpen: false,
                activeSessionId: null,
                createdAt: Date.now(),
                expectedStudents: parseInt(expectedStudents),
                worksheet: worksheet?.name || undefined,
                allowGuest,
            };

            // localStorage에 저장
            const savedRooms = JSON.parse(localStorage.getItem('nc_rooms') || '[]') as Room[];
            savedRooms.push(newRoom);
            localStorage.setItem('nc_rooms', JSON.stringify(savedRooms));

            // 워크시트가 있으면 "내 워크시트"에도 저장
            if (worksheet) {
                const worksheets = JSON.parse(localStorage.getItem('nc_worksheets') || '[]');
                worksheets.push({
                    id: `ws-${Date.now()}`,
                    name: worksheet.name,
                    uploadedAt: Date.now(),
                });
                localStorage.setItem('nc_worksheets', JSON.stringify(worksheets));
            }

            setCreated(true);
            onSuccess(code);
        } finally {
            setCreating(false);
        }
    };

    const handleClose = () => {
        setTitle('');
        setDate('');
        setTime('');
        setExpectedStudents('');
        setWorksheet(null);
        setAllowGuest(true);
        setCopied(false);
        setCreating(false);
        setCreated(false);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* 배경 오버레이 */}
            <div className="absolute inset-0 bg-black/50" onClick={handleClose} />

            {/* 모달 */}
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 mx-4 max-h-[90vh] overflow-y-auto">
                {!created ? (
                    <>
                        {/* 헤더 */}
                        <div className="mb-6">
                            <h2 className="text-2xl font-bold text-gray-800 mb-2">세션 만들기</h2>
                            <p className="text-sm text-gray-600">새로운 수업 세션을 생성합니다</p>
                        </div>

                        {/* 필드들 */}
                        <div className="space-y-4">
                            {/* 수업 제목 (필수) */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    수업 제목 <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="예: 수학 중간고사 대비반"
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            {/* 날짜/시간 (선택) */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">날짜</label>
                                    <input
                                        type="date"
                                        value={date}
                                        onChange={(e) => setDate(e.target.value)}
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">시간</label>
                                    <input
                                        type="time"
                                        value={time}
                                        onChange={(e) => setTime(e.target.value)}
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>

                            {/* 참가 예정 인원 수 (필수) */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    참가 예정 인원 수 <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    value={expectedStudents}
                                    onChange={(e) => setExpectedStudents(e.target.value)}
                                    placeholder="예: 20"
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <p className="mt-1 text-xs text-gray-500">참여율(%) 산출 기준이 됩니다</p>
                            </div>

                            {/* 워크시트 업로드 (선택) */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    워크시트 업로드 (PDF)
                                </label>
                                <input
                                    type="file"
                                    accept=".pdf"
                                    onChange={handleFileChange}
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                {worksheet && (
                                    <p className="mt-1 text-xs text-blue-600">✓ {worksheet.name}</p>
                                )}
                                <p className="mt-1 text-xs text-gray-500">업로드 시 "내 워크시트"에 자동 저장됩니다</p>
                            </div>

                            {/* 세션 비밀번호 (자동생성) */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    세션 비밀번호 (6자리 코드)
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={code}
                                        readOnly
                                        className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-lg font-mono text-lg font-bold text-center"
                                    />
                                    <button
                                        onClick={handleCopyCode}
                                        className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                                        title="복사"
                                    >
                                        {copied ? '✓' : '📋'}
                                    </button>
                                </div>
                                {copied && <p className="mt-1 text-xs text-blue-600">✓ 복사되었습니다!</p>}
                            </div>

                            {/* 게스트 모드 허용 (체크박스) */}
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="allowGuest"
                                    checked={allowGuest}
                                    onChange={(e) => setAllowGuest(e.target.checked)}
                                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                                />
                                <label htmlFor="allowGuest" className="text-sm text-gray-700">
                                    게스트 모드 허용 (비회원 참가 가능)
                                </label>
                            </div>
                        </div>

                        {/* 버튼 */}
                        <div className="flex gap-3 mt-8">
                            <button
                                onClick={handleClose}
                                className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleCreate}
                                disabled={creating}
                                className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium rounded-lg transition-colors"
                            >
                                {creating ? '생성중...' : '세션 생성하기'}
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        {/* 생성 완료 화면 */}
                        <div className="text-center">
                            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <span className="text-3xl">✓</span>
                            </div>
                            <h2 className="text-2xl font-bold text-gray-800 mb-2">세션이 생성되었습니다!</h2>
                            <p className="text-sm text-gray-600 mb-6">학생들에게 아래 코드를 공유하세요</p>

                            {/* 코드 표시 */}
                            <div className="bg-blue-50 rounded-xl p-6 mb-6">
                                <p className="text-sm text-gray-600 mb-2">세션 코드</p>
                                <div className="flex items-center justify-center gap-3">
                                    <span className="text-4xl font-bold font-mono text-blue-600">{code}</span>
                                    <button
                                        onClick={handleCopyCode}
                                        className="w-10 h-10 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                                        title="복사"
                                    >
                                        {copied ? '✓' : '📋'}
                                    </button>
                                </div>
                                {copied && <p className="mt-2 text-xs text-blue-600">✓ 복사되었습니다!</p>}
                            </div>

                            <button
                                onClick={handleClose}
                                className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                            >
                                확인
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
