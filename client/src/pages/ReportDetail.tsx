import { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import watercolorBg from '../assets/watercolor-bg.png';

interface Student {
    id: string;
    name: string;
    durationMin: number;
    strokeVolume: '많음' | '보통' | '적음';
    annotationCount: number;
    participationScore: number; // 1-5
}

const MOCK_REPORT = {
    sessionName: '수학 월요일 오전반',
    round: 3,
    date: '2026.02.17',
    duration: '48분',
    avgParticipation: 83,
    hostStrokePages: 5,
    students: [
        { id: 's1', name: '홍길동', durationMin: 45, strokeVolume: '많음' as const, annotationCount: 2, participationScore: 4 },
        { id: 's2', name: '김철수', durationMin: 30, strokeVolume: '보통' as const, annotationCount: 1, participationScore: 3 },
        { id: 's3', name: '이영희', durationMin: 48, strokeVolume: '많음' as const, annotationCount: 3, participationScore: 5 },
        { id: 's4', name: '박민준', durationMin: 15, strokeVolume: '적음' as const, annotationCount: 0, participationScore: 2 },
        { id: 's5', name: '최수진', durationMin: 42, strokeVolume: '보통' as const, annotationCount: 1, participationScore: 4 },
    ] satisfies Student[],
};

// ─── 참여도 바 차트 ────────────────────────────────────────────────────────────
function ParticipationBars({ students }: { students: Student[] }) {
    const maxMin = Math.max(...students.map(s => s.durationMin));
    const sorted = [...students].sort((a, b) => b.durationMin - a.durationMin);
    return (
        <div className="space-y-3">
            {sorted.map(s => (
                <div key={s.id} className="flex items-center gap-3">
                    <div className="w-14 text-sm font-semibold text-gray-700 shrink-0 text-right">{s.name}</div>
                    <div className="flex-1 bg-gray-100/80 rounded-full h-3 overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-700"
                            style={{ width: `${(s.durationMin / maxMin) * 100}%` }}
                        />
                    </div>
                    <div className="w-10 text-xs text-gray-500 shrink-0">{s.durationMin}분</div>
                    <div className="flex gap-0.5 shrink-0">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <span key={i} className={`text-sm ${i < s.participationScore ? 'text-yellow-400' : 'text-gray-200'}`}>★</span>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}

// ─── 요약 스탯 카드 ────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, sub }: { icon: string; label: string; value: string; sub?: string }) {
    return (
        <div className="bg-white/70 backdrop-blur-md rounded-2xl border border-white/60 shadow-sm p-4 text-center">
            <div className="text-2xl mb-1">{icon}</div>
            <div className="text-xl font-bold text-gray-800">{value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{label}</div>
            {sub && <div className="text-xs text-blue-500 font-medium mt-0.5">{sub}</div>}
        </div>
    );
}

// ─── strokeVolume 색상 ─────────────────────────────────────────────────────────
function VolumeTag({ volume }: { volume: Student['strokeVolume'] }) {
    const cls = {
        '많음': 'bg-blue-100 text-blue-700',
        '보통': 'bg-gray-100 text-gray-600',
        '적음': 'bg-orange-100 text-orange-600',
    }[volume];
    return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cls}`}>{volume}</span>;
}

export default function ReportDetail() {
    const navigate = useNavigate();
    const { archiveId } = useParams<{ archiveId: string }>();
    const r = MOCK_REPORT;

    const [generatingPdf, setGeneratingPdf] = useState<string | null>(null);
    const [pdfStudent, setPdfStudent] = useState<Student | null>(null);
    const pdfRef = useRef<HTMLDivElement>(null);

    async function downloadPdf(student: Student) {
        setGeneratingPdf(student.id);
        setPdfStudent(student);
        await new Promise(resolve => setTimeout(resolve, 150));
        if (!pdfRef.current) { setGeneratingPdf(null); setPdfStudent(null); return; }
        try {
            const canvas = await html2canvas(pdfRef.current, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            const pdfW = pdf.internal.pageSize.getWidth();
            const pdfH = (canvas.height * pdfW) / canvas.width;
            pdf.addImage(imgData, 'PNG', 0, 0, pdfW, pdfH);
            pdf.save(`${student.name}_${r.sessionName}_${r.round}회차.pdf`);
        } finally {
            setGeneratingPdf(null);
            setPdfStudent(null);
        }
    }

    return (
        <div className="h-screen flex flex-col overflow-hidden font-sans relative">
            {/* Watercolor BG */}
            <div className="absolute inset-0 z-0 bg-cover bg-center opacity-60" style={{ backgroundImage: `url(${watercolorBg})` }} />
            <div className="absolute inset-0 z-0 bg-white/40 pointer-events-none" />

            {/* Header */}
            <header className="relative z-20 bg-white/70 backdrop-blur-md border-b border-white/50 px-6 h-14 flex items-center gap-4 flex-shrink-0">
                <button
                    onClick={() => navigate(-1)}
                    className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
                <div className="flex items-center gap-2 min-w-0">
                    <div className="flex items-center text-base font-bold">
                        <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Neo</span>
                        <span className="text-gray-800">CAST</span>
                    </div>
                    <span className="text-gray-300">›</span>
                    <span className="text-sm font-semibold text-gray-700 truncate">{r.sessionName}</span>
                    <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5 shrink-0">{r.round}회차</span>
                    <span className="text-xs text-gray-400 shrink-0 hidden sm:block">{r.date}</span>
                </div>
                <div className="ml-auto flex items-center gap-1.5 text-xs text-gray-400 bg-white/60 border border-white/50 rounded-full px-2.5 py-1 shrink-0">
                    🤖 AI 분석 완료
                </div>
            </header>

            {/* Main */}
            <main className="flex-1 overflow-y-auto relative z-10 p-6 sm:p-8">
                <div className="max-w-4xl mx-auto space-y-6">

                    {/* ── 수업 요약 카드 ── */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <StatCard icon="⏱️" label="진행 시간" value={r.duration} />
                        <StatCard icon="👥" label="참여 학생" value={`${r.students.length}명`} />
                        <StatCard icon="📝" label="평균 참여율" value={`${r.avgParticipation}%`} sub="전체 평균" />
                        <StatCard icon="📄" label="호스트 판서" value={`${r.hostStrokePages}페이지`} />
                    </div>

                    {/* ── 참여도 차트 ── */}
                    <div className="bg-white/70 backdrop-blur-md rounded-3xl border border-white/60 shadow-sm p-6">
                        <h3 className="text-sm font-bold text-gray-700 mb-5 flex items-center gap-2">
                            <span>📊</span> 학생 참여도
                        </h3>
                        <ParticipationBars students={r.students} />
                    </div>

                    {/* ── 학생 목록 테이블 ── */}
                    <div className="bg-white/70 backdrop-blur-md rounded-3xl border border-white/60 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100/80">
                            <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                                <span>🎓</span> 학생별 상세
                            </h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-gray-100/80 bg-gray-50/50">
                                        <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500">학생명</th>
                                        <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500">참여시간</th>
                                        <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500">필기량</th>
                                        <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500">첨삭수</th>
                                        <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500">참여도</th>
                                        <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500">상세</th>
                                        <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500">PDF</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {r.students.map((s, i) => (
                                        <tr
                                            key={s.id}
                                            className={`border-b border-gray-100/60 hover:bg-blue-50/30 transition-colors ${i % 2 === 0 ? '' : 'bg-gray-50/30'}`}
                                        >
                                            <td className="px-6 py-3.5">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                                                        {s.name.charAt(0)}
                                                    </div>
                                                    <span className="font-semibold text-gray-800">{s.name}</span>
                                                </div>
                                            </td>
                                            <td className="text-center px-4 py-3.5 text-gray-600">{s.durationMin}분</td>
                                            <td className="text-center px-4 py-3.5">
                                                <VolumeTag volume={s.strokeVolume} />
                                            </td>
                                            <td className="text-center px-4 py-3.5">
                                                <span className={`font-semibold ${s.annotationCount > 0 ? 'text-red-500' : 'text-gray-400'}`}>
                                                    {s.annotationCount}회
                                                </span>
                                            </td>
                                            <td className="text-center px-4 py-3.5">
                                                <div className="flex justify-center gap-0.5">
                                                    {Array.from({ length: 5 }).map((_, j) => (
                                                        <span key={j} className={`text-sm ${j < s.participationScore ? 'text-yellow-400' : 'text-gray-200'}`}>★</span>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="text-center px-4 py-3.5">
                                                <button
                                                    onClick={() => navigate(`/report/${archiveId}/student/${s.id}`)}
                                                    className="px-3 py-1.5 text-xs font-semibold bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors border border-blue-100"
                                                >
                                                    보기
                                                </button>
                                            </td>
                                            <td className="text-center px-4 py-3.5">
                                                <button
                                                    onClick={() => downloadPdf(s)}
                                                    disabled={generatingPdf === s.id}
                                                    className="px-3 py-1.5 text-xs font-semibold bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors border border-red-100 disabled:opacity-50 disabled:cursor-wait"
                                                >
                                                    {generatingPdf === s.id ? '생성 중...' : '⬇ PDF'}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                </div>
            </main>

            {/* ─── 숨겨진 PDF 렌더링 영역 ─── */}
            {pdfStudent && (
                <div
                    ref={pdfRef}
                    style={{
                        position: 'fixed',
                        top: '-9999px',
                        left: '-9999px',
                        width: '794px',
                        backgroundColor: '#ffffff',
                        fontFamily: 'system-ui, -apple-system, sans-serif',
                        padding: '48px',
                        boxSizing: 'border-box',
                    }}
                >
                    {/* 헤더 */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px', borderBottom: '2px solid #e5e7eb', paddingBottom: '20px' }}>
                        <div>
                            <div style={{ fontSize: '22px', fontWeight: 800, color: '#1e40af' }}>NeoCAST</div>
                            <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>수업 결과 리포트</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '14px', fontWeight: 700, color: '#374151' }}>{r.sessionName}</div>
                            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>{r.round}회차 · {r.date}</div>
                        </div>
                    </div>

                    {/* 학생 이름 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '28px' }}>
                        <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'linear-gradient(135deg, #60a5fa, #a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '22px', fontWeight: 800 }}>
                            {pdfStudent.name.charAt(0)}
                        </div>
                        <div>
                            <div style={{ fontSize: '20px', fontWeight: 800, color: '#111827' }}>{pdfStudent.name}</div>
                            <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '2px' }}>개인 수업 리포트</div>
                        </div>
                    </div>

                    {/* 통계 카드 4개 */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '28px' }}>
                        {[
                            { label: '참여 시간', value: `${pdfStudent.durationMin}분` },
                            { label: '필기량', value: pdfStudent.strokeVolume },
                            { label: '첨삭 횟수', value: `${pdfStudent.annotationCount}회` },
                            { label: '참여도', value: `${pdfStudent.participationScore}/5` },
                        ].map(card => (
                            <div key={card.label} style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                                <div style={{ fontSize: '20px', fontWeight: 800, color: '#1d4ed8' }}>{card.value}</div>
                                <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>{card.label}</div>
                            </div>
                        ))}
                    </div>

                    {/* 참여도 바 */}
                    <div style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '20px', marginBottom: '28px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#374151', marginBottom: '14px' }}>참여도 상세</div>
                        {[
                            { label: '수업 참여', pct: (pdfStudent.durationMin / 48) * 100 },
                            { label: '참여도 점수', pct: (pdfStudent.participationScore / 5) * 100 },
                            { label: '필기 활동', pct: pdfStudent.strokeVolume === '많음' ? 90 : pdfStudent.strokeVolume === '보통' ? 60 : 30 },
                        ].map(row => (
                            <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                                <div style={{ width: '80px', fontSize: '12px', color: '#6b7280', flexShrink: 0 }}>{row.label}</div>
                                <div style={{ flex: 1, height: '8px', background: '#e5e7eb', borderRadius: '4px', overflow: 'hidden' }}>
                                    <div style={{ width: `${Math.min(row.pct, 100)}%`, height: '100%', background: 'linear-gradient(90deg, #3b82f6, #6366f1)', borderRadius: '4px' }} />
                                </div>
                                <div style={{ width: '36px', fontSize: '12px', fontWeight: 700, color: '#2563eb', textAlign: 'right' }}>{Math.round(Math.min(row.pct, 100))}%</div>
                            </div>
                        ))}
                    </div>

                    {/* 푸터 */}
                    <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#9ca3af' }}>
                        <span>NeoCAST — 실시간 필기 협업 플랫폼</span>
                        <span>생성일: {r.date}</span>
                    </div>
                </div>
            )}
        </div>
    );
}
