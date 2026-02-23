import { useNavigate, useParams } from 'react-router-dom';
import watercolorBg from '../assets/watercolor-bg.png';

interface RadarData { label: string; value: number; }

interface StudentData {
    name: string;
    totalRounds: number;
    totalMinutes: number;
    radar: { participation: number; focus: number; responsiveness: number; strokeVolume: number };
    focusPeriod: '초반' | '중반' | '후반';
    strokeSpeed: '빠름' | '보통' | '느림';
    annotationReflected: boolean;
    aiComment: string;
    roundTrend: number[];
}

const MOCK_STUDENTS: Record<string, StudentData> = {
    s1: {
        name: '홍길동', totalRounds: 3, totalMinutes: 135,
        radar: { participation: 92, focus: 78, responsiveness: 85, strokeVolume: 70 },
        focusPeriod: '초반', strokeSpeed: '보통', annotationReflected: true,
        aiComment: '홍길동 학생은 수업 초반에 집중해서 필기했으며, 선생님의 첨삭 이후 내용을 보완하는 모습이 보입니다. 다음 수업에서는 후반부 집중력 유지를 권장합니다.',
        roundTrend: [65, 78, 92],
    },
    s2: {
        name: '김철수', totalRounds: 3, totalMinutes: 90,
        radar: { participation: 65, focus: 55, responsiveness: 72, strokeVolume: 50 },
        focusPeriod: '중반', strokeSpeed: '느림', annotationReflected: true,
        aiComment: '김철수 학생은 수업 중반에 가장 적극적으로 참여하는 경향이 있습니다. 전반적인 참여율을 높이면 더 좋은 성과를 기대할 수 있습니다.',
        roundTrend: [58, 62, 65],
    },
    s3: {
        name: '이영희', totalRounds: 3, totalMinutes: 144,
        radar: { participation: 98, focus: 92, responsiveness: 95, strokeVolume: 90 },
        focusPeriod: '초반', strokeSpeed: '빠름', annotationReflected: true,
        aiComment: '이영희 학생은 수업 전반에 걸쳐 매우 높은 참여도를 보입니다. 필기 속도도 빠르고 선생님의 첨삭에도 즉각 반응하는 우수한 학습 태도를 보여주고 있습니다.',
        roundTrend: [85, 91, 98],
    },
    s4: {
        name: '박민준', totalRounds: 3, totalMinutes: 45,
        radar: { participation: 32, focus: 40, responsiveness: 28, strokeVolume: 25 },
        focusPeriod: '후반', strokeSpeed: '느림', annotationReflected: false,
        aiComment: '박민준 학생은 수업 후반부에만 잠깐 참여하는 패턴이 보입니다. 첨삭에 대한 반응도 낮아 수업 초반부터 적극적인 참여를 독려할 필요가 있습니다.',
        roundTrend: [40, 35, 32],
    },
    s5: {
        name: '최수진', totalRounds: 3, totalMinutes: 126,
        radar: { participation: 85, focus: 80, responsiveness: 78, strokeVolume: 75 },
        focusPeriod: '중반', strokeSpeed: '보통', annotationReflected: true,
        aiComment: '최수진 학생은 수업 중반에 가장 활발히 참여하며 꾸준한 학습 태도를 보입니다. 선생님의 첨삭을 성실히 반영하는 점이 돋보입니다.',
        roundTrend: [72, 79, 85],
    },
};

const FALLBACK: StudentData = {
    name: '학생', totalRounds: 1, totalMinutes: 30,
    radar: { participation: 60, focus: 60, responsiveness: 60, strokeVolume: 60 },
    focusPeriod: '중반', strokeSpeed: '보통', annotationReflected: false,
    aiComment: '분석 데이터가 준비 중입니다.',
    roundTrend: [60],
};

// ─── 레이더 차트 (SVG) ────────────────────────────────────────────────────────
function RadarChart({ data }: { data: RadarData[] }) {
    const cx = 120, cy = 120, r = 85;
    const n = data.length;
    const angles = data.map((_, i) => -Math.PI / 2 + (2 * Math.PI / n) * i);
    const levels = [0.25, 0.5, 0.75, 1.0];

    const getX = (angle: number, norm: number) => cx + r * norm * Math.cos(angle);
    const getY = (angle: number, norm: number) => cy + r * norm * Math.sin(angle);
    const gridPoints = (level: number) =>
        angles.map(a => `${getX(a, level)},${getY(a, level)}`).join(' ');
    const dataPoints = data.map((d, i) => `${getX(angles[i], d.value / 100)},${getY(angles[i], d.value / 100)}`).join(' ');

    return (
        <svg width={240} height={240} viewBox="0 0 240 240" className="mx-auto">
            {/* Grid levels */}
            {levels.map(lv => (
                <polygon key={lv} points={gridPoints(lv)} fill="none"
                    stroke={lv === 1.0 ? '#d1d5db' : '#e5e7eb'} strokeWidth={lv === 1.0 ? 1.5 : 1} />
            ))}
            {/* Axes */}
            {angles.map((a, i) => (
                <line key={i} x1={cx} y1={cy}
                    x2={getX(a, 1)} y2={getY(a, 1)}
                    stroke="#e5e7eb" strokeWidth={1} />
            ))}
            {/* Data fill */}
            <polygon points={dataPoints} fill="rgba(59,130,246,0.15)" stroke="#3b82f6" strokeWidth={2} />
            {/* Data dots */}
            {data.map((d, i) => (
                <circle key={i}
                    cx={getX(angles[i], d.value / 100)}
                    cy={getY(angles[i], d.value / 100)}
                    r={4} fill="#3b82f6" />
            ))}
            {/* Labels */}
            {data.map((d, i) => {
                const lx = getX(angles[i], 1.28);
                const ly = getY(angles[i], 1.28);
                return (
                    <text key={i} x={lx} y={ly} textAnchor="middle" dominantBaseline="middle"
                        fontSize={11} fill="#4b5563" fontWeight={600}>{d.label}</text>
                );
            })}
            {/* Value labels */}
            {data.map((d, i) => {
                const vx = getX(angles[i], d.value / 100);
                const vy = getY(angles[i], d.value / 100) - 10;
                return (
                    <text key={i} x={vx} y={vy} textAnchor="middle"
                        fontSize={10} fill="#2563eb" fontWeight={700}>{d.value}</text>
                );
            })}
        </svg>
    );
}

// ─── 라인 차트 (회차별 추이) ──────────────────────────────────────────────────
function TrendChart({ data }: { data: number[] }) {
    const w = 320, h = 110, padX = 30, padY = 18;
    const chartW = w - padX * 2;
    const chartH = h - padY * 2;
    const n = data.length;
    if (n < 2) return (
        <div className="text-center text-sm text-gray-400 py-6">데이터 부족 (2회차 이상 필요)</div>
    );

    const pts = data.map((v, i) => ({
        x: padX + (i / (n - 1)) * chartW,
        y: padY + (1 - v / 100) * chartH,
    }));
    const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
    const areaD = `${pathD} L${pts[n - 1].x},${padY + chartH} L${pts[0].x},${padY + chartH}Z`;

    return (
        <svg width="100%" viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
            {/* Grid */}
            {[0, 50, 100].map(v => {
                const y = padY + (1 - v / 100) * chartH;
                return (
                    <g key={v}>
                        <line x1={padX} y1={y} x2={w - padX} y2={y} stroke="#f3f4f6" strokeWidth={1} />
                        <text x={padX - 6} y={y} textAnchor="end" dominantBaseline="middle" fontSize={9} fill="#9ca3af">{v}</text>
                    </g>
                );
            })}
            {/* Area */}
            <path d={areaD} fill="rgba(59,130,246,0.08)" />
            {/* Line */}
            <path d={pathD} fill="none" stroke="#3b82f6" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
            {/* Points */}
            {pts.map((p, i) => (
                <g key={i}>
                    <circle cx={p.x} cy={p.y} r={5} fill="white" stroke="#3b82f6" strokeWidth={2.5} />
                    <text x={p.x} y={p.y - 10} textAnchor="middle" fontSize={11} fontWeight={700} fill="#2563eb">{data[i]}</text>
                    <text x={p.x} y={h - 3} textAnchor="middle" fontSize={10} fill="#9ca3af">{i + 1}회</text>
                </g>
            ))}
        </svg>
    );
}

// ─── 분석 항목 행 ─────────────────────────────────────────────────────────────
function AnalysisRow({ label, value, badge }: { label: string; value: string; badge?: string }) {
    return (
        <div className="flex items-center justify-between py-2.5 border-b border-gray-100/80 last:border-0">
            <span className="text-sm text-gray-500">{label}</span>
            <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-800">{value}</span>
                {badge && <span className="text-xs bg-blue-50 text-blue-600 rounded-full px-2 py-0.5 font-medium">{badge}</span>}
            </div>
        </div>
    );
}

export default function StudentReport() {
    const navigate = useNavigate();
    const { archiveId, studentId } = useParams<{ archiveId: string; studentId: string }>();
    const s = (studentId && MOCK_STUDENTS[studentId]) || FALLBACK;

    const radarData: RadarData[] = [
        { label: '참여도', value: s.radar.participation },
        { label: '반응성', value: s.radar.responsiveness },
        { label: '집중력', value: s.radar.focus },
        { label: '필기량', value: s.radar.strokeVolume },
    ];

    const avgRadar = Math.round(Object.values(s.radar).reduce((a, b) => a + b, 0) / 4);

    return (
        <div className="h-screen flex flex-col overflow-hidden font-sans relative">
            <div className="absolute inset-0 z-0 bg-cover bg-center opacity-60" style={{ backgroundImage: `url(${watercolorBg})` }} />
            <div className="absolute inset-0 z-0 bg-white/40 pointer-events-none" />

            {/* Header */}
            <header className="relative z-20 bg-white/70 backdrop-blur-md border-b border-white/50 px-6 h-14 flex items-center gap-4 flex-shrink-0">
                <button
                    onClick={() => navigate(`/report/${archiveId}`)}
                    className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold shrink-0">
                        {s.name.charAt(0)}
                    </div>
                    <span className="font-bold text-gray-800">{s.name}</span>
                    <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">개인 AI 리포트</span>
                </div>
                <div className="ml-auto text-xs text-gray-400 bg-white/60 border border-white/50 rounded-full px-2.5 py-1">
                    종합 {avgRadar}점
                </div>
            </header>

            {/* Main */}
            <main className="flex-1 overflow-y-auto relative z-10 p-6 sm:p-8">
                <div className="max-w-3xl mx-auto space-y-5">

                    {/* ── 기본 정보 카드 ── */}
                    <div className="grid grid-cols-3 gap-4">
                        {[
                            { icon: '📅', label: '참여 회차', value: `${s.totalRounds}회` },
                            { icon: '⏱️', label: '누적 수업', value: `${s.totalMinutes}분` },
                            { icon: '📈', label: '종합 성취도', value: `${avgRadar}점` },
                        ].map(card => (
                            <div key={card.label} className="bg-white/70 backdrop-blur-md rounded-2xl border border-white/60 shadow-sm p-4 text-center">
                                <div className="text-xl mb-1">{card.icon}</div>
                                <div className="text-lg font-bold text-gray-800">{card.value}</div>
                                <div className="text-xs text-gray-500 mt-0.5">{card.label}</div>
                            </div>
                        ))}
                    </div>

                    {/* ── 레이더 차트 + 분석 항목 ── */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        {/* 레이더 차트 */}
                        <div className="bg-white/70 backdrop-blur-md rounded-3xl border border-white/60 shadow-sm p-5">
                            <h3 className="text-sm font-bold text-gray-700 mb-4">성취도 레이더</h3>
                            <RadarChart data={radarData} />
                        </div>

                        {/* 이번 수업 분석 */}
                        <div className="bg-white/70 backdrop-blur-md rounded-3xl border border-white/60 shadow-sm p-5">
                            <h3 className="text-sm font-bold text-gray-700 mb-2">이번 수업 분석</h3>
                            <AnalysisRow label="필기 패턴" value={s.strokeSpeed}
                                badge={s.strokeSpeed === '빠름' ? '활발' : s.strokeSpeed === '느림' ? '주의' : undefined} />
                            <AnalysisRow label="집중 시간대" value={s.focusPeriod}
                                badge={s.focusPeriod === '초반' ? '좋음' : s.focusPeriod === '후반' ? '개선 필요' : undefined} />
                            <AnalysisRow
                                label="첨삭 반영"
                                value={s.annotationReflected ? '반영함' : '미반영'}
                                badge={s.annotationReflected ? '✓' : undefined}
                            />

                            {/* 4개 지표 */}
                            <div className="mt-4 space-y-2.5">
                                {radarData.map(d => (
                                    <div key={d.label} className="flex items-center gap-2">
                                        <div className="w-14 text-xs text-gray-500 shrink-0">{d.label}</div>
                                        <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                                            <div
                                                className="h-full bg-gradient-to-r from-blue-400 to-indigo-500 rounded-full transition-all duration-700"
                                                style={{ width: `${d.value}%` }}
                                            />
                                        </div>
                                        <div className="w-8 text-xs font-bold text-blue-600 text-right shrink-0">{d.value}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* ── AI 종합 코멘트 ── */}
                    <div className="bg-gradient-to-br from-blue-50/80 to-indigo-50/80 backdrop-blur-md rounded-3xl border border-blue-100/60 shadow-sm p-6">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white text-sm">
                                🤖
                            </div>
                            <h3 className="text-sm font-bold text-gray-700">AI 종합 코멘트</h3>
                            <span className="text-xs text-blue-400 bg-blue-100 rounded-full px-2 py-0.5 ml-auto">GPT-4o 생성</span>
                        </div>
                        <p className="text-sm text-gray-700 leading-relaxed">"{s.aiComment}"</p>
                    </div>

                    {/* ── 회차별 참여도 추이 ── */}
                    <div className="bg-white/70 backdrop-blur-md rounded-3xl border border-white/60 shadow-sm p-6">
                        <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                            <span>📈</span> 회차별 참여도 추이
                        </h3>
                        <TrendChart data={s.roundTrend} />
                    </div>

                    {/* 전체 비교 버튼 */}
                    <button
                        onClick={() => navigate(`/report/${archiveId}`)}
                        className="w-full py-3 bg-white/70 backdrop-blur-md border border-white/60 rounded-2xl text-sm font-semibold text-gray-600 hover:bg-white hover:text-gray-800 transition-all shadow-sm"
                    >
                        ← 전체 학생 비교 보기
                    </button>
                </div>
            </main>
        </div>
    );
}
