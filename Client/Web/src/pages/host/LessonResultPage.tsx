import { useState, useEffect, useRef } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { useAuthStore } from '../../stores/auth-store';
import { sessionService, type HostSessionItem } from '../../services/session-service';

// ─────────────────────────────────────────
// 타입
// ─────────────────────────────────────────

type StrokeVolume = '많음' | '보통' | '적음';
type FocusPeriod = '초반' | '중반' | '후반';
type StrokeSpeed = '빠름' | '보통' | '느림';

interface StudentResult {
  id: string;
  name: string;
  durationMin: number;
  strokeVolume: StrokeVolume;
  annotationCount: number;
  participationScore: number; // 1–5
  // 상세 데이터
  radar: { participation: number; focus: number; responsiveness: number; strokeVolume: number };
  focusPeriod: FocusPeriod;
  strokeSpeed: StrokeSpeed;
  annotationReflected: boolean;
  aiComment: string;
  roundTrend: number[];
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
  return new Date(iso).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ─────────────────────────────────────────
// DEV 목 데이터
// ─────────────────────────────────────────

const MOCK_RESULTS: SessionResult[] = [
  {
    id: 'mock-1', code: 'ABC123', title: '수학 기초 1강', status: 'CLOSED',
    scheduledAt: new Date(Date.now() - 86400000).toISOString(),
    expectedParticipants: 8,
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    closedAt: new Date(Date.now() - 80000000).toISOString(),
    hasPassword: true, allowGuestMode: true, participantCount: 6,
    durationMin: 48,
    aiReport: '수학 기초 1강에서 전체 8명 중 6명(75%)이 참여하였습니다. 평균 참여도는 76.7%로 양호하며, 특히 이영희(참여도 5/5), 홍길동(4/5) 학생의 참여도가 높았습니다. 반면 박민준 학생의 참여도와 필기량이 상대적으로 낮아 개별 지도가 필요해 보입니다. 수업 후반부에 전반적인 집중도가 저하되는 경향이 있으니 다음 수업에서는 중간 체크포인트 추가를 권장합니다.',
    students: [
      {
        id: 's1', name: '홍길동', durationMin: 45, strokeVolume: '많음', annotationCount: 2, participationScore: 4,
        radar: { participation: 92, focus: 78, responsiveness: 85, strokeVolume: 70 },
        focusPeriod: '초반', strokeSpeed: '보통', annotationReflected: true,
        aiComment: '홍길동 학생은 수업 초반에 집중해서 필기했으며, 선생님의 첨삭 이후 내용을 보완하는 모습이 보입니다. 다음 수업에서는 후반부 집중력 유지를 권장합니다.',
        roundTrend: [65, 78, 92],
      },
      {
        id: 's2', name: '김철수', durationMin: 30, strokeVolume: '보통', annotationCount: 1, participationScore: 3,
        radar: { participation: 65, focus: 55, responsiveness: 72, strokeVolume: 50 },
        focusPeriod: '중반', strokeSpeed: '느림', annotationReflected: true,
        aiComment: '김철수 학생은 수업 중반에 가장 적극적으로 참여하는 경향이 있습니다. 전반적인 참여율을 높이면 더 좋은 성과를 기대할 수 있습니다.',
        roundTrend: [58, 62, 65],
      },
      {
        id: 's3', name: '이영희', durationMin: 48, strokeVolume: '많음', annotationCount: 3, participationScore: 5,
        radar: { participation: 98, focus: 92, responsiveness: 95, strokeVolume: 90 },
        focusPeriod: '초반', strokeSpeed: '빠름', annotationReflected: true,
        aiComment: '이영희 학생은 수업 전반에 걸쳐 매우 높은 참여도를 보입니다. 필기 속도도 빠르고 선생님의 첨삭에도 즉각 반응하는 우수한 학습 태도를 보여주고 있습니다.',
        roundTrend: [85, 91, 98],
      },
      {
        id: 's4', name: '박민준', durationMin: 15, strokeVolume: '적음', annotationCount: 0, participationScore: 2,
        radar: { participation: 32, focus: 40, responsiveness: 28, strokeVolume: 25 },
        focusPeriod: '후반', strokeSpeed: '느림', annotationReflected: false,
        aiComment: '박민준 학생은 수업 후반부에만 잠깐 참여하는 패턴이 보입니다. 첨삭에 대한 반응도 낮아 수업 초반부터 적극적인 참여를 독려할 필요가 있습니다.',
        roundTrend: [40, 35, 32],
      },
      {
        id: 's5', name: '최수진', durationMin: 42, strokeVolume: '보통', annotationCount: 1, participationScore: 4,
        radar: { participation: 85, focus: 80, responsiveness: 78, strokeVolume: 75 },
        focusPeriod: '중반', strokeSpeed: '보통', annotationReflected: true,
        aiComment: '최수진 학생은 수업 중반에 가장 활발히 참여하며 꾸준한 학습 태도를 보입니다. 선생님의 첨삭을 성실히 반영하는 점이 돋보입니다.',
        roundTrend: [72, 79, 85],
      },
      {
        id: 's6', name: '강다은', durationMin: 38, strokeVolume: '보통', annotationCount: 2, participationScore: 3,
        radar: { participation: 72, focus: 68, responsiveness: 75, strokeVolume: 60 },
        focusPeriod: '중반', strokeSpeed: '보통', annotationReflected: true,
        aiComment: '강다은 학생은 전반적으로 안정적인 참여도를 보입니다. 꾸준히 성장하고 있으며, 집중력을 더 키우면 좋은 성과를 기대할 수 있습니다.',
        roundTrend: [60, 68, 72],
      },
    ],
  },
  {
    id: 'mock-2', code: 'XYZ789', title: '영어 회화 중급', status: 'CLOSED',
    scheduledAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    expectedParticipants: 6,
    createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    closedAt: new Date(Date.now() - 1.9 * 86400000).toISOString(),
    hasPassword: false, allowGuestMode: true, participantCount: 5,
    durationMin: 52,
    aiReport: '영어 회화 중급 수업에서 전체 6명 중 5명(83%)이 참여하였습니다. 평균 참여도는 77%로 양호합니다. 회화 특성상 필기 기반 참여 측정에 한계가 있으나, 다음 수업에서는 실전 회화 연습 시간을 늘리는 방향을 권장합니다.',
    students: [
      {
        id: 'v1', name: '홍길동', durationMin: 42, strokeVolume: '보통', annotationCount: 1, participationScore: 4,
        radar: { participation: 85, focus: 75, responsiveness: 80, strokeVolume: 65 },
        focusPeriod: '중반', strokeSpeed: '보통', annotationReflected: true,
        aiComment: '꾸준한 참여도를 보이고 있습니다. 다음 수업에서도 현재 수준을 유지하면 좋겠습니다.',
        roundTrend: [78, 85],
      },
      {
        id: 'v2', name: '이영희', durationMin: 50, strokeVolume: '많음', annotationCount: 2, participationScore: 5,
        radar: { participation: 95, focus: 88, responsiveness: 90, strokeVolume: 85 },
        focusPeriod: '초반', strokeSpeed: '빠름', annotationReflected: true,
        aiComment: '이번 수업에서도 최상위 참여도를 기록했습니다. 지속적인 성취를 응원합니다.',
        roundTrend: [88, 95],
      },
      {
        id: 'v3', name: '박민준', durationMin: 35, strokeVolume: '보통', annotationCount: 0, participationScore: 3,
        radar: { participation: 68, focus: 60, responsiveness: 55, strokeVolume: 62 },
        focusPeriod: '후반', strokeSpeed: '보통', annotationReflected: false,
        aiComment: '참여도가 이전 수업 대비 개선되었습니다. 첨삭 반영을 늘리면 더 좋은 결과를 기대할 수 있습니다.',
        roundTrend: [55, 68],
      },
      {
        id: 'v4', name: '최수진', durationMin: 48, strokeVolume: '많음', annotationCount: 2, participationScore: 4,
        radar: { participation: 88, focus: 82, responsiveness: 85, strokeVolume: 80 },
        focusPeriod: '초반', strokeSpeed: '빠름', annotationReflected: true,
        aiComment: '수업 초반부터 적극적으로 참여하며 우수한 학습 태도를 보이고 있습니다.',
        roundTrend: [80, 88],
      },
      {
        id: 'v5', name: '강다은', durationMin: 40, strokeVolume: '보통', annotationCount: 1, participationScore: 3,
        radar: { participation: 75, focus: 70, responsiveness: 72, strokeVolume: 65 },
        focusPeriod: '중반', strokeSpeed: '보통', annotationReflected: true,
        aiComment: '안정적인 참여도를 보이고 있습니다. 조금 더 적극적인 참여를 권장합니다.',
        roundTrend: [68, 75],
      },
    ],
  },
];

// ─────────────────────────────────────────
// 서브 컴포넌트: 필기량 태그
// ─────────────────────────────────────────

function VolumeTag({ volume }: { volume: StrokeVolume }) {
  const cls: Record<StrokeVolume, string> = {
    '많음': 'bg-blue-100 text-blue-700',
    '보통': 'bg-gray-100 text-gray-600',
    '적음': 'bg-orange-100 text-orange-600',
  };
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cls[volume]}`}>{volume}</span>;
}

// ─────────────────────────────────────────
// 서브 컴포넌트: 참여도 바 차트
// ─────────────────────────────────────────

function ParticipationBars({ students }: { students: StudentResult[] }) {
  const maxMin = Math.max(...students.map((s) => s.durationMin), 1);
  const sorted = [...students].sort((a, b) => b.durationMin - a.durationMin);
  return (
    <div className="space-y-3">
      {sorted.map((s) => (
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

// ─────────────────────────────────────────
// 서브 컴포넌트: 레이더 차트 (SVG)
// ─────────────────────────────────────────

interface RadarData { label: string; value: number }

function RadarChart({ data }: { data: RadarData[] }) {
  const cx = 110, cy = 110, r = 78;
  const n = data.length;
  const angles = data.map((_, i) => -Math.PI / 2 + ((2 * Math.PI) / n) * i);
  const levels = [0.25, 0.5, 0.75, 1.0];

  const getX = (angle: number, norm: number) => cx + r * norm * Math.cos(angle);
  const getY = (angle: number, norm: number) => cy + r * norm * Math.sin(angle);
  const gridPoints = (level: number) =>
    angles.map((a) => `${getX(a, level)},${getY(a, level)}`).join(' ');
  const dataPoints = data
    .map((d, i) => `${getX(angles[i], d.value / 100)},${getY(angles[i], d.value / 100)}`)
    .join(' ');

  return (
    <svg width={220} height={220} viewBox="0 0 220 220" className="mx-auto">
      {levels.map((lv) => (
        <polygon
          key={lv}
          points={gridPoints(lv)}
          fill="none"
          stroke={lv === 1.0 ? '#d1d5db' : '#e5e7eb'}
          strokeWidth={lv === 1.0 ? 1.5 : 1}
        />
      ))}
      {angles.map((a, i) => (
        <line key={i} x1={cx} y1={cy} x2={getX(a, 1)} y2={getY(a, 1)} stroke="#e5e7eb" strokeWidth={1} />
      ))}
      <polygon points={dataPoints} fill="rgba(59,130,246,0.15)" stroke="#3b82f6" strokeWidth={2} />
      {data.map((d, i) => (
        <circle
          key={i}
          cx={getX(angles[i], d.value / 100)}
          cy={getY(angles[i], d.value / 100)}
          r={4}
          fill="#3b82f6"
        />
      ))}
      {data.map((d, i) => (
        <text
          key={i}
          x={getX(angles[i], 1.3)}
          y={getY(angles[i], 1.3)}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={11}
          fill="#4b5563"
          fontWeight={600}
        >
          {d.label}
        </text>
      ))}
      {data.map((d, i) => (
        <text
          key={i}
          x={getX(angles[i], d.value / 100)}
          y={getY(angles[i], d.value / 100) - 10}
          textAnchor="middle"
          fontSize={10}
          fill="#2563eb"
          fontWeight={700}
        >
          {d.value}
        </text>
      ))}
    </svg>
  );
}

// ─────────────────────────────────────────
// 서브 컴포넌트: 추이 차트 (SVG 라인)
// ─────────────────────────────────────────

function TrendChart({ data }: { data: number[] }) {
  const w = 300, h = 110, padX = 28, padY = 16;
  const chartW = w - padX * 2;
  const chartH = h - padY * 2;
  const n = data.length;

  if (n < 2) {
    return <div className="text-center text-sm text-gray-400 py-6">데이터 부족 (2회차 이상 필요)</div>;
  }

  const pts = data.map((v, i) => ({
    x: padX + (i / (n - 1)) * chartW,
    y: padY + (1 - v / 100) * chartH,
  }));
  const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const areaD = `${pathD} L${pts[n - 1].x},${padY + chartH} L${pts[0].x},${padY + chartH}Z`;

  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      {[0, 50, 100].map((v) => {
        const y = padY + (1 - v / 100) * chartH;
        return (
          <g key={v}>
            <line x1={padX} y1={y} x2={w - padX} y2={y} stroke="#f3f4f6" strokeWidth={1} />
            <text x={padX - 4} y={y} textAnchor="end" dominantBaseline="middle" fontSize={9} fill="#9ca3af">{v}</text>
          </g>
        );
      })}
      <path d={areaD} fill="rgba(59,130,246,0.08)" />
      <path d={pathD} fill="none" stroke="#3b82f6" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={5} fill="white" stroke="#3b82f6" strokeWidth={2.5} />
          <text x={p.x} y={p.y - 10} textAnchor="middle" fontSize={11} fontWeight={700} fill="#2563eb">{data[i]}</text>
          <text x={p.x} y={h - 2} textAnchor="middle" fontSize={10} fill="#9ca3af">{i + 1}회</text>
        </g>
      ))}
    </svg>
  );
}

// ─────────────────────────────────────────
// 서브 컴포넌트: 학생 상세 모달
// ─────────────────────────────────────────

function StudentDetailModal({
  student,
  session,
  onClose,
  onDownloadPdf,
  isGeneratingPdf,
}: {
  student: StudentResult;
  session: SessionResult;
  onClose: () => void;
  onDownloadPdf: (student: StudentResult) => void;
  isGeneratingPdf: boolean;
}) {
  const radarData: RadarData[] = [
    { label: '참여도', value: student.radar.participation },
    { label: '반응성', value: student.radar.responsiveness },
    { label: '집중력', value: student.radar.focus },
    { label: '필기량', value: student.radar.strokeVolume },
  ];
  const avgRadar = Math.round(Object.values(student.radar).reduce((a, b) => a + b, 0) / 4);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">

        {/* 헤더 */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold shrink-0">
            {student.name.charAt(0)}
          </div>
          <div className="flex-1">
            <h2 className="text-base font-bold text-gray-900">{student.name}</h2>
            <p className="text-xs text-gray-500">{session.title || `세션 ${session.code}`} · 개인 AI 리포트</p>
          </div>
          <span className="text-xs bg-blue-50 text-blue-600 px-2.5 py-1 rounded-full font-medium">
            종합 {avgRadar}점
          </span>
          <button
            type="button"
            onClick={onClose}
            className="ml-2 w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-5">

          {/* 기본 통계 3개 */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: '⏱️', label: '참여 시간', value: `${student.durationMin}분` },
              { icon: '📝', label: '필기량', value: student.strokeVolume },
              { icon: '📈', label: '종합 성취도', value: `${avgRadar}점` },
            ].map((card) => (
              <div key={card.label} className="bg-gray-50 rounded-xl p-4 text-center border border-gray-100">
                <div className="text-xl mb-1">{card.icon}</div>
                <div className="text-lg font-bold text-gray-800">{card.value}</div>
                <div className="text-xs text-gray-500 mt-0.5">{card.label}</div>
              </div>
            ))}
          </div>

          {/* 레이더 차트 + 분석 항목 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-xl border border-gray-100 p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">성취도 레이더</h3>
              <RadarChart data={radarData} />
            </div>
            <div className="bg-gray-50 rounded-xl border border-gray-100 p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">이번 수업 분석</h3>
              <div className="space-y-2.5 text-sm">
                {[
                  { label: '필기 패턴', value: student.strokeSpeed,
                    badge: student.strokeSpeed === '빠름' ? '활발' : student.strokeSpeed === '느림' ? '주의' : undefined },
                  { label: '집중 시간대', value: student.focusPeriod,
                    badge: student.focusPeriod === '초반' ? '좋음' : student.focusPeriod === '후반' ? '개선 필요' : undefined },
                  { label: '첨삭 반영', value: student.annotationReflected ? '반영함' : '미반영',
                    badge: student.annotationReflected ? '✓' : undefined },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <span className="text-gray-500">{row.label}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-gray-800">{row.value}</span>
                      {row.badge && (
                        <span className="text-xs bg-blue-50 text-blue-600 rounded-full px-1.5 py-0.5">{row.badge}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {/* 4개 지표 바 */}
              <div className="mt-4 space-y-2">
                {radarData.map((d) => (
                  <div key={d.label} className="flex items-center gap-2">
                    <div className="w-12 text-xs text-gray-500 shrink-0">{d.label}</div>
                    <div className="flex-1 bg-gray-200 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-400 to-indigo-500 rounded-full"
                        style={{ width: `${d.value}%` }}
                      />
                    </div>
                    <div className="w-7 text-xs font-bold text-blue-600 text-right shrink-0">{d.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* AI 코멘트 */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100 p-5">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs">🤖</div>
              <h3 className="text-sm font-bold text-gray-700">AI 종합 코멘트</h3>
              <span className="ml-auto text-xs bg-blue-100 text-blue-500 rounded-full px-2 py-0.5">GPT-4o 생성</span>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed">"{student.aiComment}"</p>
          </div>

          {/* 회차별 추이 */}
          <div className="bg-gray-50 rounded-xl border border-gray-100 p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">📈 회차별 참여도 추이</h3>
            <TrendChart data={student.roundTrend} />
          </div>

          {/* PDF 다운로드 버튼 */}
          <button
            type="button"
            onClick={() => onDownloadPdf(student)}
            disabled={isGeneratingPdf}
            className="w-full flex items-center justify-center gap-2 py-3 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-wait"
          >
            {isGeneratingPdf ? (
              <>
                <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                PDF 생성 중...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                개인 리포트 PDF 다운로드
              </>
            )}
          </button>
        </div>
      </div>
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

  // 학생 상세 모달
  const [detailStudent, setDetailStudent] = useState<StudentResult | null>(null);

  // PDF 생성 상태
  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null);
  const [pdfStudent, setPdfStudent] = useState<StudentResult | null>(null);
  const pdfRef = useRef<HTMLDivElement>(null);

  // 세션 목록 로드
  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const res = await sessionService.getHostSessions(tokens?.accessToken ?? '');
        const closed = res.sessions
          .filter((s) => s.status === 'CLOSED')
          .map((s): SessionResult => ({
            ...s,
            durationMin: 0,
            students: [],
            aiReport: '',
          }));
        setSessions(closed);
        if (closed.length > 0) setSelectedId(closed[0].id);
      } catch {
        if (import.meta.env.DEV) {
          setSessions(MOCK_RESULTS);
          setSelectedId(MOCK_RESULTS[0].id);
        }
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [tokens]);

  const selected = sessions.find((s) => s.id === selectedId) ?? null;

  // 참석한 학생 필터
  const students = selected?.students ?? [];
  const avgParticipation =
    students.length > 0
      ? Math.round(students.reduce((sum, s) => sum + (s.durationMin / (selected!.durationMin || 1)) * 100, 0) / students.length)
      : 0;

  // PDF 다운로드
  const downloadPdf = async (student: StudentResult) => {
    if (!selected) return;
    setGeneratingPdf(student.id);
    setPdfStudent(student);
    setDetailStudent(null); // 모달 닫기

    await new Promise((resolve) => setTimeout(resolve, 200));

    if (!pdfRef.current) {
      setGeneratingPdf(null);
      setPdfStudent(null);
      return;
    }

    try {
      const canvas = await html2canvas(pdfRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = (canvas.height * pdfW) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfW, pdfH);
      pdf.save(`${student.name}_${selected.title || selected.code}_리포트.pdf`);
    } finally {
      setGeneratingPdf(null);
      setPdfStudent(null);
    }
  };

  // ─── 로딩 ───
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  // ─── 빈 상태 ───
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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
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
            className={`flex-shrink-0 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all text-left ${
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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { icon: '⏱️', label: '진행 시간', value: selected.durationMin ? `${selected.durationMin}분` : '-' },
              { icon: '👥', label: '참여 학생', value: `${students.length}명` },
              { icon: '📝', label: '평균 참여율', value: `${avgParticipation}%` },
              { icon: '⭐', label: '평균 참여도', value: `${(students.reduce((s, st) => s + st.participationScore, 0) / (students.length || 1)).toFixed(1)}/5` },
            ].map((card) => (
              <div key={card.label} className="bg-white rounded-2xl border border-gray-100 p-5 text-center">
                <div className="text-2xl mb-1">{card.icon}</div>
                <div className="text-xl font-bold text-gray-800">{card.value}</div>
                <div className="text-xs text-gray-500 mt-0.5">{card.label}</div>
              </div>
            ))}
          </div>

          {/* ─── 참여도 차트 ─── */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <h3 className="text-sm font-bold text-gray-700 mb-5 flex items-center gap-2">
              <span>📊</span> 학생 참여도
            </h3>
            <ParticipationBars students={students} />
          </div>

          {/* ─── 학생 목록 테이블 ─── */}
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                <span>🎓</span> 학생별 상세
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
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
                  {students.map((s, i) => (
                    <tr
                      key={s.id}
                      className={`border-b border-gray-50 hover:bg-blue-50/30 transition-colors ${i % 2 === 0 ? '' : 'bg-gray-50/30'}`}
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
                            <span key={j} className={`text-sm ${j < s.participationScore ? 'text-yellow-400' : 'text-gray-200'}`}>
                              ★
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="text-center px-4 py-3.5">
                        <button
                          type="button"
                          onClick={() => setDetailStudent(s)}
                          className="px-3 py-1.5 text-xs font-semibold bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors border border-blue-100"
                        >
                          보기
                        </button>
                      </td>
                      <td className="text-center px-4 py-3.5">
                        <button
                          type="button"
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
                  <h3 className="text-sm font-bold text-gray-800">AI 수업 분석 리포트</h3>
                  <p className="text-xs text-gray-500">수업 패턴과 참여도를 분석한 결과입니다</p>
                </div>
                <span className="ml-auto text-xs text-blue-500 bg-blue-100 px-2 py-1 rounded-full font-medium">Beta</span>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">{selected.aiReport}</p>
            </div>
          )}
        </>
      )}

      {/* ─── 학생 상세 모달 ─── */}
      {detailStudent && selected && (
        <StudentDetailModal
          student={detailStudent}
          session={selected}
          onClose={() => setDetailStudent(null)}
          onDownloadPdf={downloadPdf}
          isGeneratingPdf={generatingPdf === detailStudent.id}
        />
      )}

      {/* ─── 숨겨진 PDF 렌더링 영역 ─── */}
      {pdfStudent && selected && (
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
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#374151' }}>{selected.title || `세션 ${selected.code}`}</div>
              <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>{formatDate(selected.scheduledAt ?? selected.createdAt)}</div>
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
            ].map((card) => (
              <div key={card.label} style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#1d4ed8' }}>{card.value}</div>
                <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>{card.label}</div>
              </div>
            ))}
          </div>

          {/* 참여도 상세 바 */}
          <div style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '20px', marginBottom: '28px' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#374151', marginBottom: '14px' }}>참여도 상세</div>
            {[
              { label: '참여도', pct: (pdfStudent.durationMin / (selected.durationMin || 48)) * 100 },
              { label: '참여 점수', pct: (pdfStudent.participationScore / 5) * 100 },
              { label: '필기 활동', pct: pdfStudent.strokeVolume === '많음' ? 90 : pdfStudent.strokeVolume === '보통' ? 60 : 30 },
            ].map((row) => (
              <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                <div style={{ width: '80px', fontSize: '12px', color: '#6b7280', flexShrink: 0 }}>{row.label}</div>
                <div style={{ flex: 1, height: '8px', background: '#e5e7eb', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(row.pct, 100)}%`, height: '100%', background: 'linear-gradient(90deg, #3b82f6, #6366f1)', borderRadius: '4px' }} />
                </div>
                <div style={{ width: '36px', fontSize: '12px', fontWeight: 700, color: '#2563eb', textAlign: 'right' }}>{Math.round(Math.min(row.pct, 100))}%</div>
              </div>
            ))}
          </div>

          {/* AI 코멘트 */}
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '12px', padding: '20px', marginBottom: '28px' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#1e40af', marginBottom: '8px' }}>🤖 AI 종합 코멘트</div>
            <div style={{ fontSize: '13px', color: '#374151', lineHeight: 1.7 }}>"{pdfStudent.aiComment}"</div>
          </div>

          {/* 푸터 */}
          <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#9ca3af' }}>
            <span>NeoCAST — 실시간 필기 협업 플랫폼</span>
            <span>생성일: {new Date().toLocaleDateString('ko-KR')}</span>
          </div>
        </div>
      )}
    </div>
  );
}
