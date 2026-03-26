import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useSessionStore } from '../../stores/session-store';
import { useStrokeStore } from '../../stores/stroke-store';
import { useAnnotationStore } from '../../stores/annotation-store';
import { useConnectionStore } from '../../stores/connection-store';
import { StrokeCanvas } from '../canvas/StrokeCanvas';
import { AnnotationCanvas } from '../canvas/AnnotationCanvas';
import { useParticipantActivity } from '../../hooks/useParticipantActivity';
import { devBridge } from '../../services/dev-bridge';
import { useAnnotationStatusStore } from '../../stores/annotation-status-store';
import { getPaperSizeInPoints, pointToScreenPx, formatPageAddress } from '../../types';
import { mockPenConnected } from '../../utils/dev-mock';
import type { Participant, ParticipantActivityStatus } from '../../types';

// A4 세로 비율 (210:297 ≈ 0.707)
const A4_RATIO = 210 / 297;

// 미니 프리뷰 크기 (A4 세로 비율)
const MINI_W = 120;
const MINI_H = Math.round(MINI_W / A4_RATIO); // ~170

/** 상태 아이콘 */
function StatusIcon({ status }: { status: ParticipantActivityStatus }) {
  switch (status) {
    case 'writing':
      return (
        <span className="relative flex items-center gap-1 text-[10px] font-bold text-success-text bg-success-bg px-1.5 py-0.5 rounded-full">
          <span className="relative flex w-1.5 h-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
          </span>
          필기중
        </span>
      );
    case 'idle':
      return (
        <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">
          대기
        </span>
      );
    case 'inactive':
      return (
        <span className="text-[10px] font-medium text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded-full">
          비활성
        </span>
      );
  }
}

/** 좌측 참가자 리스트 아이템 */
function ParticipantItem({
  participant,
  isSelected,
  isAnnotating,
  status,
  onClick,
}: {
  participant: Participant;
  isSelected: boolean;
  isAnnotating: boolean;
  status: ParticipantActivityStatus;
  onClick: () => void;
}) {
  const pageAddress = useStrokeStore((state) => state.currentPageAddress);
  const paperSize = useStrokeStore((state) => state.paperSize);
  const { widthPt, heightPt } = useMemo(() => getPaperSizeInPoints(paperSize), [paperSize]);

  // 미니 프리뷰: 용지 비율에 맞춘 크기
  const miniW = MINI_W;
  const miniH = Math.round(miniW * (heightPt / widthPt));
  const initial = participant.userName.charAt(0).toUpperCase();

  // DEV mock: 펜 연결 여부
  const isPenConnected = useMemo(() => mockPenConnected(participant.userId), [participant.userId]);

  // 참가자의 현재 페이지
  const participantPage = useStrokeStore((state) => state.participantCurrentPages.get(participant.userId));

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-[20px] overflow-hidden border-2 transition-all duration-200 ${
        isSelected
          ? 'border-brand-primary/40 bg-brand-tint shadow-brand scale-[1.02]'
          : isAnnotating
            ? 'border-red-400 bg-red-50/30 shadow-sm'
            : 'border-app-border bg-white shadow-card hover:shadow-brand/50 hover:scale-[1.01]'
      }`}
    >
      {/* 미니 캔버스 프리뷰 (A4 세로 비율) */}
      <div className="relative bg-white mx-auto rounded-t-[18px] overflow-hidden" style={{ width: miniW, height: miniH }}>
        <StrokeCanvas
          pageAddress={pageAddress}
          width={miniW}
          height={miniH}
          userId={participant.userId}
        />
        {isAnnotating && (
          <div className="absolute top-1.5 right-1.5 flex items-center gap-1 px-1.5 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full shadow">
            <span className="relative flex w-1.5 h-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" />
            </span>
            첨삭중
          </div>
        )}
      </div>

      {/* 학생 정보 + 상태 */}
      <div className="flex items-center gap-2 px-3 py-2">
        <div className="w-6 h-6 rounded-full bg-brand-tint flex items-center justify-center flex-shrink-0">
          <span className="text-xs font-bold text-brand-tint-text">{initial}</span>
        </div>
        <span className="text-xs font-semibold text-slate-700 truncate flex-1">
          {participant.userName}
        </span>
        {/* 현재 페이지 */}
        {participantPage && (
          <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full flex-shrink-0">
            {formatPageAddress(participantPage)}
          </span>
        )}
        {/* 펜 연결 상태 */}
        {isPenConnected && (
          <span className="flex-shrink-0" title="스마트펜 연결됨">
            <svg className="w-3.5 h-3.5 text-brand-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </span>
        )}
        <StatusIcon status={status} />
      </div>
    </button>
  );
}

/**
 * 참가자 모니터링 뷰 — 좌측 리스트 + 우측 확대 캔버스 (A4 세로)
 */
export function ParticipantMonitorView() {
  const session = useSessionStore((state) => state.session);
  const controlSocket = useConnectionStore((state) => state.controlSocket);
  const { getStatus } = useParticipantActivity();

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [annotationMode, setAnnotationMode] = useState(false);
  const activeAnnotationTargets = useAnnotationStatusStore((state) => state.activeAnnotationTargets);
  const setAnnotating = useAnnotationStatusStore((state) => state.setAnnotating);

  const pageAddress = useStrokeStore((state) => state.currentPageAddress);
  const paperSize = useStrokeStore((state) => state.paperSize);
  const annotationsMap = useAnnotationStore((state) => state.annotations);
  const addAnnotation = useAnnotationStore((state) => state.addAnnotation);
  const clearAnnotations = useAnnotationStore((state) => state.clearAnnotations);

  // A4 용지 크기 (72 DPI points → 96 DPI 화면 픽셀)
  const { widthPt, heightPt } = useMemo(() => getPaperSizeInPoints(paperSize), [paperSize]);
  const baseCanvasW = Math.round(pointToScreenPx(widthPt));  // ~793
  const baseCanvasH = Math.round(pointToScreenPx(heightPt)); // ~1122

  // 우측 캔버스 영역의 실제 크기를 컨테이너에 맞춤
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ w: baseCanvasW, h: baseCanvasH });

  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container) return;

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      const padding = 32; // p-4 양쪽
      const availW = rect.width - padding;
      const availH = rect.height - padding;

      // A4 비율을 유지하면서 컨테이너에 맞춤 (fit contain)
      const ratio = widthPt / heightPt;
      let w = availW;
      let h = w / ratio;
      if (h > availH) {
        h = availH;
        w = h * ratio;
      }

      setCanvasSize({ w: Math.round(w), h: Math.round(h) });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(container);
    return () => observer.disconnect();
  }, [widthPt, heightPt]);

  // 게스트만 필터
  const students = useMemo(
    () => (session?.participants ?? []).filter((p) => p.role !== 'host'),
    [session?.participants]
  );

  const effectiveSelectedId = students.find((s) => s.userId === selectedUserId)
    ? selectedUserId
    : students[0]?.userId ?? null;

  const selectedStudent = students.find((s) => s.userId === effectiveSelectedId) ?? null;

  const selectedAnnotations = useMemo(
    () => (effectiveSelectedId ? annotationsMap.get(effectiveSelectedId) ?? [] : []),
    [annotationsMap, effectiveSelectedId]
  );

  // 첨삭 모드 활성 중 상태 유지 (3초 자동 해제 방지)
  useEffect(() => {
    if (!annotationMode || !effectiveSelectedId) return;
    // 즉시 + 2초마다 갱신하여 3초 타이머 리셋
    setAnnotating(effectiveSelectedId);
    const interval = setInterval(() => {
      setAnnotating(effectiveSelectedId);
      if (import.meta.env.DEV) {
        devBridge.send({
          type: 'ANNOTATION_ADDED',
          targetUserId: effectiveSelectedId,
          annotation: { points: [], color: '#FF3B30', lineWidth: 3 },
          code: session?.code ?? '',
        });
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [annotationMode, effectiveSelectedId, setAnnotating, session?.code]);

  /** 첨삭 그리기 시작 — 즉시 상태 전파 */
  const handleAnnotationDrawStart = () => {
    if (!effectiveSelectedId) return;
    // 호스트 측 store 갱신 (참가자 리스트 배지)
    setAnnotating(effectiveSelectedId);
    // DEV 모드: 게스트에게 첨삭 시작 알림 (빈 annotation으로 상태만 전달)
    if (import.meta.env.DEV) {
      devBridge.send({
        type: 'ANNOTATION_ADDED',
        targetUserId: effectiveSelectedId,
        annotation: { points: [], color: '#FF3B30', lineWidth: 3 },
        code: session?.code ?? '',
      });
    }
  };

  const handleAnnotationStroke = (points: { x: number; y: number }[]) => {
    if (!effectiveSelectedId) return;

    const stroke = { points, color: '#FF3B30', lineWidth: 3 };
    addAnnotation(effectiveSelectedId, stroke);

    // 첨삭 상태 store에 기록 (호스트 리스트 + 게스트 측 모두 감지)
    setAnnotating(effectiveSelectedId);

    if (controlSocket) {
      controlSocket.emit('annotation:stroke', { targetUserId: effectiveSelectedId, points });
    } else if (import.meta.env.DEV) {
      devBridge.send({
        type: 'ANNOTATION_ADDED',
        targetUserId: effectiveSelectedId,
        annotation: stroke,
        code: session?.code ?? '',
      });
    }
  };

  const handleClearAnnotations = () => {
    if (effectiveSelectedId) clearAnnotations(effectiveSelectedId);
  };

  if (students.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center bg-app-bg">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
          <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <div>
          <p className="text-slate-500 font-medium">아직 참가자가 없습니다</p>
          <p className="text-sm text-slate-400 mt-1">초대 링크를 공유하여 학생을 초대하세요</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex overflow-hidden bg-app-bg">
      {/* ── 좌측: 참가자 리스트 ── */}
      <div className="w-[180px] flex-shrink-0 border-r border-app-border bg-white flex flex-col">
        <div className="px-3 py-2.5 border-b border-app-border">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-600">참가자</h3>
            <span className="px-1.5 py-0.5 rounded-full bg-brand-tint text-brand-tint-text text-[10px] font-bold">
              {students.length}명
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
          {students.map((student) => (
            <ParticipantItem
              key={student.userId}
              participant={student}
              isSelected={effectiveSelectedId === student.userId}
              isAnnotating={activeAnnotationTargets.has(student.userId)}
              status={getStatus(student.userId)}
              onClick={() => {
                // 학생 전환 시 이전 첨삭 클리어
                if (effectiveSelectedId && effectiveSelectedId !== student.userId) {
                  clearAnnotations(effectiveSelectedId);
                }
                setSelectedUserId(student.userId);
                setAnnotationMode(false);
              }}
            />
          ))}
        </div>
      </div>

      {/* ── 우측: 선택된 학생 캔버스 확대 (A4 세로) ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedStudent ? (
          <>
            {/* 상단 바 */}
            <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-app-border flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-brand-tint flex items-center justify-center">
                  <span className="text-sm font-bold text-brand-tint-text">
                    {selectedStudent.userName.charAt(0).toUpperCase()}
                  </span>
                </div>
                <span className="font-semibold text-slate-800 text-sm">{selectedStudent.userName}</span>
                <StatusIcon status={getStatus(selectedStudent.userId)} />
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const nextMode = !annotationMode;
                    setAnnotationMode(nextMode);
                    if (nextMode && effectiveSelectedId) {
                      // 첨삭 모드 ON 시 즉시 게스트에게 상태 전파
                      setAnnotating(effectiveSelectedId);
                      if (import.meta.env.DEV) {
                        devBridge.send({
                          type: 'ANNOTATION_ADDED',
                          targetUserId: effectiveSelectedId,
                          annotation: { points: [], color: '#FF3B30', lineWidth: 3 },
                          code: session?.code ?? '',
                        });
                      }
                    } else if (!nextMode && effectiveSelectedId) {
                      // 첨삭 모드 OFF 시 자동 클리어
                      clearAnnotations(effectiveSelectedId);
                    }
                  }}
                  className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold transition-all duration-200 ${
                    annotationMode
                      ? 'bg-gradient-to-r from-red-500 to-rose-500 text-white shadow-lg shadow-red-200/50 scale-[1.03]'
                      : 'border-2 border-app-border text-brand-primary hover:bg-brand-tint hover:border-brand-primary/30'
                  }`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  {annotationMode ? '첨삭 중' : '첨삭 모드'}
                </button>

                <button
                  type="button"
                  onClick={handleClearAnnotations}
                  className="flex items-center gap-1 px-3.5 py-1.5 rounded-full text-xs font-bold border-2 border-app-border text-slate-500 hover:bg-brand-tint hover:border-brand-primary/30 hover:text-brand-primary transition-all duration-200"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  지우기
                </button>
              </div>
            </div>

            {/* 캔버스 영역 (A4 세로 비율, 컨테이너에 fit) */}
            <div ref={canvasContainerRef} className="flex-1 relative p-4 flex items-center justify-center overflow-hidden">
              <div
                className={`relative rounded-[30px] overflow-hidden shadow-modern bg-white border-2 border-app-border ${
                  annotationMode ? 'ring-2 ring-red-400 ring-offset-2' : ''
                }`}
                style={{ width: canvasSize.w, height: canvasSize.h }}
              >
                <StrokeCanvas
                  pageAddress={pageAddress}
                  width={canvasSize.w}
                  height={canvasSize.h}
                  userId={selectedStudent.userId}
                />
                <AnnotationCanvas
                  width={canvasSize.w}
                  height={canvasSize.h}
                  strokes={selectedAnnotations}
                  drawingMode={annotationMode}
                  onStroke={handleAnnotationStroke}
                  onDrawStart={handleAnnotationDrawStart}
                  className="absolute inset-0 z-10"
                />
              </div>

            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
            좌측에서 학생을 선택하세요
          </div>
        )}
      </div>
    </div>
  );
}
