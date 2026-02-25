import { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/auth-store';
import { sessionService, type HostSessionItem } from '../../services/session-service';

// ─────────────────────────────────────────
// 타입
// ─────────────────────────────────────────

interface StudentResult {
  userId: string;
  name: string;
  strokeCount: number;  // 필기 획수
  participationRate: number; // 0-100
  attended: boolean;
}

interface SessionResult extends HostSessionItem {
  durationMin: number;
  students: StudentResult[];
  aiReport: string;
}

// ─────────────────────────────────────────
// 유틸
// ─────────────────────────────────────────

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ─────────────────────────────────────────
// DEV 목 데이터
// ─────────────────────────────────────────

const MOCK_STUDENTS_1: StudentResult[] = [
  { userId: 'u1', name: '김민준', strokeCount: 58, participationRate: 95, attended: true },
  { userId: 'u2', name: '이서연', strokeCount: 35, participationRate: 80, attended: true },
  { userId: 'u3', name: '박지호', strokeCount: 12, participationRate: 40, attended: true },
  { userId: 'u4', name: '최유진', strokeCount: 47, participationRate: 88, attended: true },
  { userId: 'u5', name: '정도현', strokeCount: 0, participationRate: 0, attended: false },
  { userId: 'u6', name: '강소희', strokeCount: 63, participationRate: 92, attended: true },
  { userId: 'u7', name: '임태양', strokeCount: 29, participationRate: 65, attended: true },
  { userId: 'u8', name: '윤지아', strokeCount: 0, participationRate: 0, attended: false },
];

const MOCK_STUDENTS_2: StudentResult[] = [
  { userId: 'v1', name: '김민준', strokeCount: 42, participationRate: 85, attended: true },
  { userId: 'v2', name: '이서연', strokeCount: 38, participationRate: 78, attended: true },
  { userId: 'v3', name: '박지호', strokeCount: 55, participationRate: 90, attended: true },
  { userId: 'v4', name: '최유진', strokeCount: 21, participationRate: 60, attended: true },
  { userId: 'v5', name: '정도현', strokeCount: 33, participationRate: 72, attended: true },
  { userId: 'v6', name: '강소희', strokeCount: 0, participationRate: 0, attended: false },
];

const DEV_MOCK_RESULTS: SessionResult[] = [
  {
    id: 'mock-1',
    code: 'ABC123',
    title: '수학 기초 1강',
    status: 'CLOSED',
    scheduledAt: new Date(Date.now() - 86400000).toISOString(),
    expectedParticipants: 8,
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    closedAt: new Date(Date.now() - 80000000).toISOString(),
    hasPassword: true,
    allowGuestMode: true,
    participantCount: 6,
    durationMin: 52,
    students: MOCK_STUDENTS_1,
    aiReport:
      '수학 기초 1강에서 전체 8명 중 6명(75%)이 참여하였습니다. 참여 학생 중 평균 참여도는 76.7%로 양호한 편이며, 특히 강소희(92%), 김민준(95%) 학생의 참여도가 높았습니다. 반면 박지호 학생의 참여도(40%)와 필기량(12획)이 상대적으로 낮아 추가 지도가 필요해 보입니다. 전반적으로 기초 개념 학습에는 충분한 참여가 이루어졌으나, 수업 후반부에 집중도가 다소 저하되는 패턴이 관찰됩니다. 다음 수업에서는 중간 체크포인트를 추가하는 것을 권장합니다.',
  },
  {
    id: 'mock-2',
    code: 'XYZ789',
    title: '영어 회화 중급',
    status: 'CLOSED',
    scheduledAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    expectedParticipants: 6,
    createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    closedAt: new Date(Date.now() - 1.9 * 86400000).toISOString(),
    hasPassword: false,
    allowGuestMode: true,
    participantCount: 5,
    durationMin: 48,
    students: MOCK_STUDENTS_2,
    aiReport:
      '영어 회화 중급 수업에서 전체 6명 중 5명(83%)이 참여하였습니다. 전반적인 참여도 평균은 77%로 양호합니다. 박지호 학생이 이번 수업에서 가장 높은 참여도(90%)를 기록하며 성장을 보여줬습니다. 회화 특성상 필기 기반 참여 측정에 한계가 있으므로, 발화 빈도와 통합하여 평가하는 것을 권장합니다. 다음 수업에서는 실전 회화 연습 시간을 늘리는 방향으로 구성해 보세요.',
  },
];

// ─────────────────────────────────────────
// 서브 컴포넌트: 참여도 바
// ─────────────────────────────────────────

function ParticipationBar({ rate }: { rate: number }) {
  const color =
    rate >= 80 ? 'bg-green-500' : rate >= 50 ? 'bg-yellow-400' : rate > 0 ? 'bg-red-400' : 'bg-gray-200';

  return (
    <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${rate}%` }} />
    </div>
  );
}

// ─────────────────────────────────────────
// 서브 컴포넌트: 학생 결과 카드
// ─────────────────────────────────────────

function StudentResultCard({ student }: { student: StudentResult }) {
  const rateColor =
    student.participationRate >= 80
      ? 'text-green-600'
      : student.participationRate >= 50
      ? 'text-yellow-600'
      : student.participationRate > 0
      ? 'text-red-500'
      : 'text-gray-400';

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors ${
        student.attended ? 'bg-white border-gray-100' : 'bg-gray-50 border-gray-100 opacity-60'
      }`}
    >
      {/* 아바타 */}
      <div
        className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
          student.attended
            ? 'bg-gradient-to-br from-blue-400 to-purple-500 text-white'
            : 'bg-gray-200 text-gray-400'
        }`}
      >
        {student.name.charAt(0)}
      </div>

      {/* 이름 + 바 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-gray-800">{student.name}</span>
          {!student.attended && (
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">미참여</span>
          )}
        </div>
        <ParticipationBar rate={student.participationRate} />
      </div>

      {/* 수치 */}
      <div className="text-right flex-shrink-0">
        <p className={`text-sm font-bold ${rateColor}`}>
          {student.attended ? `${student.participationRate}%` : '-'}
        </p>
        <p className="text-xs text-gray-400">{student.attended ? `${student.strokeCount}획` : ''}</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// 서브 컴포넌트: 요약 스탯 카드
// ─────────────────────────────────────────

function StatCard({
  label,
  value,
  unit,
  color,
}: {
  label: string;
  value: number | string;
  unit?: string;
  color: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col gap-1">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`text-3xl font-bold ${color}`}>
        {value}
        {unit && <span className="text-base font-normal text-gray-500 ml-1">{unit}</span>}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────
// 메인 페이지
// ─────────────────────────────────────────

export function LessonResultPage() {
  const { tokens } = useAuthStore();
  const [sessions, setSessions] = useState<SessionResult[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 세션 목록 로드 (CLOSED만)
  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const res = await sessionService.getHostSessions(tokens?.accessToken ?? '');
        // 실제 서비스에서는 result 포함 데이터를 별도 API로 가져와야 하지만,
        // 현재는 세션 목록에 mock result를 합쳐서 표시
        const closed = res.sessions
          .filter((s) => s.status === 'CLOSED')
          .map((s) => ({
            ...s,
            durationMin: 0,
            students: [],
            aiReport: '',
          }));
        setSessions(closed);
        if (closed.length > 0) setSelectedId(closed[0].id);
      } catch {
        if (import.meta.env.DEV) {
          setSessions(DEV_MOCK_RESULTS);
          setSelectedId(DEV_MOCK_RESULTS[0].id);
        }
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [tokens]);

  const selected = sessions.find((s) => s.id === selectedId) ?? null;

  // 선택된 세션 통계 계산
  const attendedStudents = selected?.students.filter((s) => s.attended) ?? [];
  const avgParticipation =
    attendedStudents.length > 0
      ? Math.round(attendedStudents.reduce((sum, s) => sum + s.participationRate, 0) / attendedStudents.length)
      : 0;
  const avgStrokes =
    attendedStudents.length > 0
      ? Math.round(attendedStudents.reduce((sum, s) => sum + s.strokeCount, 0) / attendedStudents.length)
      : 0;
  const attendRate = selected
    ? Math.round((attendedStudents.length / (selected.expectedParticipants || 1)) * 100)
    : 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">수업 결과</h1>
          <p className="text-gray-500 text-sm mt-1">종료된 세션의 학습 결과를 확인하세요</p>
        </div>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
          </div>
          <p className="text-gray-600 font-medium">아직 종료된 세션이 없습니다</p>
          <p className="text-sm text-gray-400 mt-1">세션을 진행하고 종료하면 결과가 여기에 표시됩니다</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">

      {/* ─── 헤더 ─── */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">수업 결과</h1>
        <p className="text-gray-500 text-sm mt-1">종료된 세션의 학습 결과를 확인하세요</p>
      </div>

      {/* ─── 세션 선택 탭 ─── */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {sessions.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSelectedId(s.id)}
            className={`flex-shrink-0 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all ${
              selectedId === s.id
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600'
            }`}
          >
            <span className="block font-semibold">{s.title || `세션 ${s.code}`}</span>
            <span className={`block text-xs mt-0.5 ${selectedId === s.id ? 'text-blue-100' : 'text-gray-400'}`}>
              {formatDateTime(s.scheduledAt ?? s.createdAt)}
            </span>
          </button>
        ))}
      </div>

      {selected && (
        <>
          {/* ─── 요약 스탯 4개 ─── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="출석률" value={attendRate} unit="%" color="text-blue-600" />
            <StatCard label="평균 참여도" value={avgParticipation} unit="%" color="text-green-600" />
            <StatCard label="평균 필기량" value={avgStrokes} unit="획" color="text-purple-600" />
            <StatCard label="수업 시간" value={selected.durationMin || '-'} unit={selected.durationMin ? '분' : ''} color="text-orange-500" />
          </div>

          {/* ─── 학생별 결과 + 세션 정보 ─── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* 좌: 세션 정보 */}
            <div className="lg:col-span-1 space-y-4">

              {/* 세션 메타 */}
              <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
                <h3 className="text-sm font-semibold text-gray-700">세션 정보</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">날짜</span>
                    <span className="font-medium text-gray-800">{formatDate(selected.scheduledAt ?? selected.createdAt)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">세션 코드</span>
                    <span className="font-mono font-medium text-gray-800">{selected.code}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">예정 인원</span>
                    <span className="font-medium text-gray-800">{selected.expectedParticipants}명</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">참여 인원</span>
                    <span className="font-medium text-gray-800">{attendedStudents.length}명</span>
                  </div>
                </div>
              </div>

              {/* PDF 다운로드 (추후 구현) */}
              <button
                type="button"
                disabled
                className="w-full flex items-center justify-center gap-2 py-3 px-4 border border-gray-200 rounded-xl text-sm font-medium text-gray-400 bg-gray-50 cursor-not-allowed"
                title="추후 지원 예정"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                PDF 리포트 다운로드
                <span className="text-xs text-gray-400">(준비중)</span>
              </button>
            </div>

            {/* 우: 학생 결과 목록 */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
                <h3 className="text-sm font-semibold text-gray-700">
                  학생별 결과
                </h3>
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                    80% 이상
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" />
                    50-79%
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
                    50% 미만
                  </span>
                </div>
              </div>

              {selected.students.length === 0 ? (
                <div className="py-12 text-center text-sm text-gray-400">
                  학생 데이터가 없습니다
                </div>
              ) : (
                <div className="p-4 space-y-2">
                  {selected.students
                    .slice()
                    .sort((a, b) => b.participationRate - a.participationRate)
                    .map((student) => (
                      <StudentResultCard key={student.userId} student={student} />
                    ))}
                </div>
              )}
            </div>
          </div>

          {/* ─── AI 리포트 ─── */}
          {selected.aiReport && (
            <div className="bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-100 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-800">AI 학습 분석 리포트</h3>
                  <p className="text-xs text-gray-500">수업 패턴과 참여도를 분석한 결과입니다</p>
                </div>
                <span className="ml-auto text-xs text-blue-500 bg-blue-100 px-2 py-1 rounded-full font-medium">Beta</span>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{selected.aiReport}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
