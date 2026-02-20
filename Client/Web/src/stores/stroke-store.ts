import { create } from 'zustand';
import { PenType, PaperSize, StrokeFlags, createMousePageAddress, isSamePageAddress, MM_TO_PT } from '../types';
import type { Stroke, StrokePoint, NcodePageAddress } from '../types';

// 페이지 주소를 문자열 키로 변환 (Map 키 용도)
function pageAddressKey(address: NcodePageAddress): string {
  return `${address.section}.${address.owner}.${address.book}.${address.page}`;
}

// 페이지 주소 + 소유자 ID를 키로 변환 (undo/redo 스택용)
function pageOwnerKey(address: NcodePageAddress, ownerUserId: string): string {
  return `${pageAddressKey(address)}:${ownerUserId}`;
}

interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

function getBounds(points: StrokePoint[]): Bounds | null {
  if (points.length === 0) return null;
  let minX = points[0].x;
  let maxX = points[0].x;
  let minY = points[0].y;
  let maxY = points[0].y;

  for (let i = 1; i < points.length; i++) {
    const { x, y } = points[i];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  return { minX, maxX, minY, maxY };
}

function expandBounds(bounds: Bounds, padding: number): Bounds {
  return {
    minX: bounds.minX - padding,
    maxX: bounds.maxX + padding,
    minY: bounds.minY - padding,
    maxY: bounds.maxY + padding,
  };
}

function boundsOverlap(a: Bounds, b: Bounds): boolean {
  return !(a.maxX < b.minX || a.minX > b.maxX || a.maxY < b.minY || a.minY > b.maxY);
}

/**
 * 두 선분 (p1-p2) 와 (p3-p4) 사이의 최소 거리 계산
 * 선분이 교차하면 0을 반환
 */
function segmentToSegmentDistanceSq(
  p1x: number, p1y: number, p2x: number, p2y: number,
  p3x: number, p3y: number, p4x: number, p4y: number
): number {
  // 선분 교차 검사 (CCW 알고리즘)
  const ccw = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number): number => {
    return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  };

  const d1 = ccw(p1x, p1y, p2x, p2y, p3x, p3y);
  const d2 = ccw(p1x, p1y, p2x, p2y, p4x, p4y);
  const d3 = ccw(p3x, p3y, p4x, p4y, p1x, p1y);
  const d4 = ccw(p3x, p3y, p4x, p4y, p2x, p2y);

  // 두 선분이 교차하면 거리 0
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
      ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return 0;
  }

  // 점이 선분 위에 있는 경우 (collinear)
  const onSegment = (px: number, py: number, qx: number, qy: number, rx: number, ry: number): boolean => {
    return Math.min(px, rx) <= qx && qx <= Math.max(px, rx) &&
           Math.min(py, ry) <= qy && qy <= Math.max(py, ry);
  };

  if (d1 === 0 && onSegment(p1x, p1y, p3x, p3y, p2x, p2y)) return 0;
  if (d2 === 0 && onSegment(p1x, p1y, p4x, p4y, p2x, p2y)) return 0;
  if (d3 === 0 && onSegment(p3x, p3y, p1x, p1y, p4x, p4y)) return 0;
  if (d4 === 0 && onSegment(p3x, p3y, p2x, p2y, p4x, p4y)) return 0;

  // 교차하지 않으면 점-선분 최소 거리 계산
  const pointToSegmentDistanceSq = (
    px: number, py: number,
    ax: number, ay: number, bx: number, by: number
  ): number => {
    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;

    if (lenSq === 0) {
      // 선분이 점인 경우
      const dpx = px - ax;
      const dpy = py - ay;
      return dpx * dpx + dpy * dpy;
    }

    // 투영 계수 t (0~1 범위로 클램프)
    let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));

    // 가장 가까운 점
    const nearX = ax + t * dx;
    const nearY = ay + t * dy;
    const distX = px - nearX;
    const distY = py - nearY;

    return distX * distX + distY * distY;
  };

  // 4개 점-선분 거리 중 최소값
  return Math.min(
    pointToSegmentDistanceSq(p1x, p1y, p3x, p3y, p4x, p4y),
    pointToSegmentDistanceSq(p2x, p2y, p3x, p3y, p4x, p4y),
    pointToSegmentDistanceSq(p3x, p3y, p1x, p1y, p2x, p2y),
    pointToSegmentDistanceSq(p4x, p4y, p1x, p1y, p2x, p2y)
  );
}

function getThicknessMultiplier(penType: PenType): number {
  return penType === PenType.Highlighter ? 10 : 1;
}

function getStrokeRadiusPt(stroke: Stroke): number {
  return (stroke.thickness * getThicknessMultiplier(stroke.penType) * MM_TO_PT) / 2;
}

/**
 * 지우개의 마지막 선분이 대상 스트로크와 겹치는지 검사 (실시간 지우기용)
 */
function shouldEraseByLastSegment(
  eraserStroke: Stroke,
  targetStroke: Stroke
): boolean {
  if (targetStroke.penType === PenType.Eraser) {
    return false;
  }

  const eraserPoints = eraserStroke.points;
  if (eraserPoints.length < 2 || targetStroke.points.length === 0) {
    return false;
  }

  const eraserRadius = getStrokeRadiusPt(eraserStroke);
  const targetRadius = getStrokeRadiusPt(targetStroke);
  const threshold = eraserRadius + targetRadius;
  const thresholdSq = threshold * threshold;

  // 마지막 선분만 검사
  const e1 = eraserPoints[eraserPoints.length - 2];
  const e2 = eraserPoints[eraserPoints.length - 1];
  const targetPoints = targetStroke.points;

  for (let j = 0; j < targetPoints.length - 1; j++) {
    const t1 = targetPoints[j];
    const t2 = targetPoints[j + 1];

    const distSq = segmentToSegmentDistanceSq(
      e1.x, e1.y, e2.x, e2.y,
      t1.x, t1.y, t2.x, t2.y
    );

    if (distSq <= thresholdSq) {
      return true;
    }
  }

  // 단일 점 대상 스트로크 검사
  if (targetPoints.length === 1) {
    const p = targetPoints[0];
    const distSq = segmentToSegmentDistanceSq(
      e1.x, e1.y, e2.x, e2.y,
      p.x, p.y, p.x, p.y
    );
    if (distSq <= thresholdSq) {
      return true;
    }
  }

  return false;
}

function shouldEraseStroke(eraserStroke: Stroke, targetStroke: Stroke): boolean {
  if (targetStroke.penType === PenType.Eraser) {
    return false;
  }

  if (eraserStroke.points.length === 0 || targetStroke.points.length === 0) {
    return false;
  }

  const eraserRadius = getStrokeRadiusPt(eraserStroke);
  const targetRadius = getStrokeRadiusPt(targetStroke);
  const threshold = eraserRadius + targetRadius;
  const thresholdSq = threshold * threshold;

  const eraserBounds = getBounds(eraserStroke.points);
  const targetBounds = getBounds(targetStroke.points);

  if (!eraserBounds || !targetBounds) {
    return false;
  }

  if (!boundsOverlap(expandBounds(eraserBounds, threshold), targetBounds)) {
    return false;
  }

  const eraserPoints = eraserStroke.points;
  const targetPoints = targetStroke.points;

  // 선분-선분 거리 검사 (모든 지우개 선분과 대상 스트로크 선분 간)
  for (let i = 0; i < eraserPoints.length - 1; i++) {
    const e1 = eraserPoints[i];
    const e2 = eraserPoints[i + 1];

    for (let j = 0; j < targetPoints.length - 1; j++) {
      const t1 = targetPoints[j];
      const t2 = targetPoints[j + 1];

      const distSq = segmentToSegmentDistanceSq(
        e1.x, e1.y, e2.x, e2.y,
        t1.x, t1.y, t2.x, t2.y
      );

      if (distSq <= thresholdSq) {
        return true;
      }
    }
  }

  // 단일 점으로만 이루어진 스트로크도 검사 (점-점 거리)
  if (eraserPoints.length === 1 || targetPoints.length === 1) {
    for (const e of eraserPoints) {
      for (const p of targetPoints) {
        const dx = e.x - p.x;
        const dy = e.y - p.y;
        if (dx * dx + dy * dy <= thresholdSq) {
          return true;
        }
      }
    }
  }

  return false;
}

// 펜 설정 타입
export interface PenSettings {
  penColor: number; // ARGB
  penThickness: number; // mm
  penType: PenType;
}

interface StrokeStore {
  // 상태
  strokes: Map<string, Stroke>; // strokeId -> Stroke
  activeStrokes: Map<string, Stroke>; // 진행 중인 스트로크
  currentPageAddress: NcodePageAddress; // 현재 페이지 주소
  strokesByPage: Map<string, Set<string>>; // pageAddressKey -> strokeIds
  pageNavigationLocked: boolean; // 페이지 네비게이션 잠금 상태

  // 펜 설정 (입력 소스별)
  smartpenSettings: PenSettings; // 스마트펜 입력용
  stylusSettings: PenSettings; // 스타일러스/터치 입력용
  guestInputSettings: PenSettings; // 호스트가 게스트 캔버스에 입력할 때 사용

  // 용지 설정
  paperSize: PaperSize;

  // 히스토리
  undoStack: Map<string, string[]>; // pageAddressKey -> strokeIds
  redoStack: Map<string, string[]>; // pageAddressKey -> strokeIds

  // 액션
  startStroke: (
    strokeId: string,
    userId: string,
    ownerUserId: string,
    pageAddress: NcodePageAddress,
    color: number,
    thickness: number,
    penType: PenType,
    flags: StrokeFlags,
    timestamp: number
  ) => void;
  addPoint: (strokeId: string, point: StrokePoint) => void;
  addPoints: (strokeId: string, points: StrokePoint[]) => void;
  endStroke: (strokeId: string) => void;
  cancelStroke: (strokeId: string) => void;

  // 페이지 관리
  setCurrentPage: (pageAddress: NcodePageAddress) => void;
  clearPage: (pageAddress: NcodePageAddress) => void;
  clearPageByOwner: (pageAddress: NcodePageAddress, ownerUserId: string) => void; // 특정 소유자의 스트로크만 삭제
  getPageStrokes: (pageAddress: NcodePageAddress) => Stroke[];
  setPageNavigationLocked: (locked: boolean) => void;
  togglePageNavigationLock: () => void;

  // Undo/Redo (ownerUserId 기반)
  undo: (pageAddress: NcodePageAddress, ownerUserId: string) => string | null;
  redo: (pageAddress: NcodePageAddress, ownerUserId: string) => string | null;

  // 히스토리 동기화
  addHistoryStroke: (stroke: Stroke) => void;
  clearAllStrokes: () => void;
  applyEraserStroke: (eraserStroke: Stroke) => string[];

  // 펜 설정 (스마트펜용)
  setSmartpenColor: (color: number) => void;
  setSmartpenThickness: (thickness: number) => void;
  setSmartpenType: (type: PenType) => void;

  // 펜 설정 (스타일러스/터치용)
  setStylusColor: (color: number) => void;
  setStylusThickness: (thickness: number) => void;
  setStylusType: (type: PenType) => void;

  // 펜 설정 (게스트 캔버스 입력용)
  setGuestInputColor: (color: number) => void;
  setGuestInputThickness: (thickness: number) => void;
  setGuestInputType: (type: PenType) => void;

  // 용지 설정
  setPaperSize: (size: PaperSize) => void;

  // 유틸리티
  getStroke: (strokeId: string) => Stroke | undefined;
  getActiveStroke: (strokeId: string) => Stroke | undefined;
  getSmartpenSettings: () => PenSettings;
  getStylusSettings: () => PenSettings;
  getGuestInputSettings: () => PenSettings;
}

// 초기 마우스 페이지 주소
const initialMousePageAddress = createMousePageAddress(1);

export const useStrokeStore = create<StrokeStore>((set, get) => ({
  // 초기 상태
  strokes: new Map(),
  activeStrokes: new Map(),
  currentPageAddress: initialMousePageAddress,
  strokesByPage: new Map(),
  pageNavigationLocked: false, // 기본값: 해제 (자동 페이지 이동)

  // 스마트펜 기본 설정
  smartpenSettings: {
    penColor: 0xff000000, // 검정
    penThickness: 0.5, // 0.5mm
    penType: PenType.Pen,
  },

  // 스타일러스/터치 기본 설정
  stylusSettings: {
    penColor: 0xff000000, // 검정
    penThickness: 0.5, // 0.5mm
    penType: PenType.Pen,
  },

  // 게스트 캔버스 입력 기본 설정 (호스트가 게스트에게 스마트펜으로 피드백할 때)
  guestInputSettings: {
    penColor: 0xffff0000, // 빨간색
    penThickness: 0.5, // 0.5mm
    penType: PenType.Pen,
  },

  // 기본 용지 설정
  paperSize: PaperSize.A4,

  // 히스토리
  undoStack: new Map(),
  redoStack: new Map(),

  startStroke: (strokeId, userId, ownerUserId, pageAddress, color, thickness, penType, flags, timestamp) => {
    const stroke: Stroke = {
      id: strokeId,
      userId,
      ownerUserId,
      pageAddress,
      color,
      thickness,
      penType,
      flags,
      startTimestamp: timestamp,
      points: [],
    };

    set((state) => {
      const newActiveStrokes = new Map(state.activeStrokes);
      newActiveStrokes.set(strokeId, stroke);
      return { activeStrokes: newActiveStrokes };
    });
  },

  addPoint: (strokeId, point) => {
    set((state) => {
      const stroke = state.activeStrokes.get(strokeId);
      if (!stroke) return state;

      const updatedStroke = {
        ...stroke,
        points: [...stroke.points, point],
      };

      const newActiveStrokes = new Map(state.activeStrokes);
      newActiveStrokes.set(strokeId, updatedStroke);

      // 지우개 스트로크인 경우 실시간 지우기 검사
      // ownerUserId가 같은 스트로크만 지움 (같은 캔버스 내에서만 지우개 적용)
      if (updatedStroke.penType === PenType.Eraser && updatedStroke.points.length >= 2) {
        const pageKey = pageAddressKey(updatedStroke.pageAddress);
        const ownerKey = pageOwnerKey(updatedStroke.pageAddress, updatedStroke.ownerUserId);
        const pageStrokeIds = state.strokesByPage.get(pageKey);

        if (pageStrokeIds && pageStrokeIds.size > 0) {
          const removedIds: string[] = [];

          pageStrokeIds.forEach((id) => {
            const target = state.strokes.get(id);
            if (target && target.ownerUserId === updatedStroke.ownerUserId && shouldEraseByLastSegment(updatedStroke, target)) {
              removedIds.push(id);
            }
          });

          if (removedIds.length > 0) {
            const removedSet = new Set(removedIds);
            const newStrokes = new Map(state.strokes);
            const newStrokesByPage = new Map(state.strokesByPage);
            const newUndoStack = new Map(state.undoStack);
            const newRedoStack = new Map(state.redoStack);

            const updatedPageStrokes = new Set(newStrokesByPage.get(pageKey));
            removedSet.forEach((id) => {
              newStrokes.delete(id);
              updatedPageStrokes.delete(id);
            });

            if (updatedPageStrokes.size === 0) {
              newStrokesByPage.delete(pageKey);
            } else {
              newStrokesByPage.set(pageKey, updatedPageStrokes);
            }
            // undo/redo 스택에서 삭제된 스트로크 제거 (ownerKey 기준)
            if (newUndoStack.has(ownerKey)) {
              newUndoStack.set(
                ownerKey,
                (newUndoStack.get(ownerKey) || []).filter((id) => !removedSet.has(id))
              );
            }
            if (newRedoStack.has(ownerKey)) {
              newRedoStack.set(
                ownerKey,
                (newRedoStack.get(ownerKey) || []).filter((id) => !removedSet.has(id))
              );
            }

            return {
              activeStrokes: newActiveStrokes,
              strokes: newStrokes,
              strokesByPage: newStrokesByPage,
              undoStack: newUndoStack,
              redoStack: newRedoStack,
            };
          }
        }
      }

      return { activeStrokes: newActiveStrokes };
    });
  },

  addPoints: (strokeId, points) => {
    set((state) => {
      const stroke = state.activeStrokes.get(strokeId);
      if (!stroke) return state;

      const updatedStroke = {
        ...stroke,
        points: [...stroke.points, ...points],
      };

      const newActiveStrokes = new Map(state.activeStrokes);
      newActiveStrokes.set(strokeId, updatedStroke);

      // 지우개 스트로크인 경우 실시간 지우기 검사
      // ownerUserId가 같은 스트로크만 지움 (같은 캔버스 내에서만 지우개 적용)
      if (updatedStroke.penType === PenType.Eraser && updatedStroke.points.length >= 2) {
        const pageKey = pageAddressKey(updatedStroke.pageAddress);
        const ownerKey = pageOwnerKey(updatedStroke.pageAddress, updatedStroke.ownerUserId);
        const pageStrokeIds = state.strokesByPage.get(pageKey);

        if (pageStrokeIds && pageStrokeIds.size > 0) {
          const eraserPoints = updatedStroke.points;
          const eraserRadius = getStrokeRadiusPt(updatedStroke);
          const removedIds: string[] = [];

          // 새로 추가된 선분들만 검사 (기존 마지막 점 ~ 새 마지막 점)
          const startIdx = Math.max(0, stroke.points.length - 1);

          pageStrokeIds.forEach((id) => {
            const target = state.strokes.get(id);
            if (!target || target.penType === PenType.Eraser) return;
            // 같은 캔버스 소유자의 스트로크만 지우기 대상
            if (target.ownerUserId !== updatedStroke.ownerUserId) return;

            const targetRadius = getStrokeRadiusPt(target);
            const threshold = eraserRadius + targetRadius;
            const thresholdSq = threshold * threshold;
            const targetPoints = target.points;

            // 새로 추가된 지우개 선분들에 대해 검사
            for (let i = startIdx; i < eraserPoints.length - 1; i++) {
              const e1 = eraserPoints[i];
              const e2 = eraserPoints[i + 1];

              for (let j = 0; j < targetPoints.length - 1; j++) {
                const t1 = targetPoints[j];
                const t2 = targetPoints[j + 1];

                const distSq = segmentToSegmentDistanceSq(
                  e1.x, e1.y, e2.x, e2.y,
                  t1.x, t1.y, t2.x, t2.y
                );

                if (distSq <= thresholdSq) {
                  removedIds.push(id);
                  return; // 이 target은 이미 삭제 대상
                }
              }
            }
          });

          if (removedIds.length > 0) {
            const removedSet = new Set(removedIds);
            const newStrokes = new Map(state.strokes);
            const newStrokesByPage = new Map(state.strokesByPage);
            const newUndoStack = new Map(state.undoStack);
            const newRedoStack = new Map(state.redoStack);

            const updatedPageStrokes = new Set(newStrokesByPage.get(pageKey));
            removedSet.forEach((id) => {
              newStrokes.delete(id);
              updatedPageStrokes.delete(id);
            });

            if (updatedPageStrokes.size === 0) {
              newStrokesByPage.delete(pageKey);
            } else {
              newStrokesByPage.set(pageKey, updatedPageStrokes);
            }
            // undo/redo 스택에서 삭제된 스트로크 제거 (ownerKey 기준)
            if (newUndoStack.has(ownerKey)) {
              newUndoStack.set(
                ownerKey,
                (newUndoStack.get(ownerKey) || []).filter((id) => !removedSet.has(id))
              );
            }
            if (newRedoStack.has(ownerKey)) {
              newRedoStack.set(
                ownerKey,
                (newRedoStack.get(ownerKey) || []).filter((id) => !removedSet.has(id))
              );
            }

            return {
              activeStrokes: newActiveStrokes,
              strokes: newStrokes,
              strokesByPage: newStrokesByPage,
              undoStack: newUndoStack,
              redoStack: newRedoStack,
            };
          }
        }
      }

      return { activeStrokes: newActiveStrokes };
    });
  },

  endStroke: (strokeId) => {
    const { activeStrokes, strokes, strokesByPage, undoStack } = get();
    const stroke = activeStrokes.get(strokeId);

    if (!stroke) return;

    const pageKey = pageAddressKey(stroke.pageAddress);
    const ownerKey = pageOwnerKey(stroke.pageAddress, stroke.ownerUserId);

    // 활성 스트로크에서 완료된 스트로크로 이동
    const newActiveStrokes = new Map(activeStrokes);
    newActiveStrokes.delete(strokeId);

    const newStrokes = new Map(strokes);
    newStrokes.set(strokeId, stroke);

    // 페이지별 인덱스 업데이트
    const newStrokesByPage = new Map(strokesByPage);
    const pageStrokes = newStrokesByPage.get(pageKey) || new Set();
    pageStrokes.add(strokeId);
    newStrokesByPage.set(pageKey, pageStrokes);

    // Undo 스택에 추가 (소유자별)
    const newUndoStack = new Map(undoStack);
    const ownerUndos = newUndoStack.get(ownerKey) || [];
    newUndoStack.set(ownerKey, [...ownerUndos, strokeId]);

    // Redo 스택 클리어 (새 액션이 있으면 redo 불가)
    const newRedoStack = new Map(get().redoStack);
    newRedoStack.set(ownerKey, []);

    set({
      activeStrokes: newActiveStrokes,
      strokes: newStrokes,
      strokesByPage: newStrokesByPage,
      undoStack: newUndoStack,
      redoStack: newRedoStack,
    });
  },

  cancelStroke: (strokeId) => {
    set((state) => {
      const newActiveStrokes = new Map(state.activeStrokes);
      newActiveStrokes.delete(strokeId);
      return { activeStrokes: newActiveStrokes };
    });
  },

  setCurrentPage: (pageAddress) => {
    set({ currentPageAddress: pageAddress });
  },

  setPageNavigationLocked: (locked) => {
    set({ pageNavigationLocked: locked });
  },

  togglePageNavigationLock: () => {
    set((state) => ({ pageNavigationLocked: !state.pageNavigationLocked }));
  },

  clearPage: (pageAddress) => {
    const pageKey = pageAddressKey(pageAddress);
    set((state) => {
      const pageStrokeIds = state.strokesByPage.get(pageKey);
      if (!pageStrokeIds) return state;

      const newStrokes = new Map(state.strokes);
      const affectedOwners = new Set<string>();

      // 삭제될 스트로크의 소유자 수집
      pageStrokeIds.forEach((id) => {
        const stroke = state.strokes.get(id);
        if (stroke) {
          affectedOwners.add(stroke.ownerUserId);
          newStrokes.delete(id);
        }
      });

      const newStrokesByPage = new Map(state.strokesByPage);
      newStrokesByPage.delete(pageKey);

      // 영향받는 모든 소유자의 undo/redo 스택 클리어
      const newUndoStack = new Map(state.undoStack);
      const newRedoStack = new Map(state.redoStack);
      affectedOwners.forEach((ownerUserId) => {
        const ownerKey = pageOwnerKey(pageAddress, ownerUserId);
        newUndoStack.delete(ownerKey);
        newRedoStack.delete(ownerKey);
      });

      return {
        strokes: newStrokes,
        strokesByPage: newStrokesByPage,
        undoStack: newUndoStack,
        redoStack: newRedoStack,
      };
    });
  },

  clearPageByOwner: (pageAddress, ownerUserId) => {
    const pageKey = pageAddressKey(pageAddress);
    const ownerKey = pageOwnerKey(pageAddress, ownerUserId);

    set((state) => {
      const pageStrokeIds = state.strokesByPage.get(pageKey);
      if (!pageStrokeIds) return state;

      const newStrokes = new Map(state.strokes);
      const newStrokesByPage = new Map(state.strokesByPage);
      const remainingPageStrokes = new Set<string>();

      // 해당 소유자의 스트로크만 삭제
      pageStrokeIds.forEach((id) => {
        const stroke = state.strokes.get(id);
        if (stroke) {
          if (stroke.ownerUserId === ownerUserId) {
            newStrokes.delete(id);
          } else {
            remainingPageStrokes.add(id);
          }
        }
      });

      if (remainingPageStrokes.size === 0) {
        newStrokesByPage.delete(pageKey);
      } else {
        newStrokesByPage.set(pageKey, remainingPageStrokes);
      }

      // 해당 소유자의 undo/redo 스택 클리어
      const newUndoStack = new Map(state.undoStack);
      const newRedoStack = new Map(state.redoStack);
      newUndoStack.delete(ownerKey);
      newRedoStack.delete(ownerKey);

      return {
        strokes: newStrokes,
        strokesByPage: newStrokesByPage,
        undoStack: newUndoStack,
        redoStack: newRedoStack,
      };
    });
  },

  getPageStrokes: (pageAddress) => {
    const { strokes, strokesByPage, activeStrokes } = get();
    const pageKey = pageAddressKey(pageAddress);
    const pageStrokeIds = strokesByPage.get(pageKey) || new Set();

    const result: Stroke[] = [];

    // 완료된 스트로크
    pageStrokeIds.forEach((id) => {
      const stroke = strokes.get(id);
      if (stroke) result.push(stroke);
    });

    // 활성 스트로크 (해당 페이지)
    activeStrokes.forEach((stroke) => {
      if (isSamePageAddress(stroke.pageAddress, pageAddress)) {
        result.push(stroke);
      }
    });

    return result;
  },

  undo: (pageAddress, ownerUserId) => {
    const pageKey = pageAddressKey(pageAddress);
    const ownerKey = pageOwnerKey(pageAddress, ownerUserId);
    const { undoStack, strokesByPage, redoStack } = get();
    const ownerUndos = undoStack.get(ownerKey) || [];

    if (ownerUndos.length === 0) return null;

    const strokeId = ownerUndos[ownerUndos.length - 1];
    const newUndos = ownerUndos.slice(0, -1);

    // 스트로크 숨김 처리 (실제로 삭제하지 않음)
    const newStrokesByPage = new Map(strokesByPage);
    const pageStrokes = new Set(newStrokesByPage.get(pageKey));
    pageStrokes.delete(strokeId);
    newStrokesByPage.set(pageKey, pageStrokes);

    // Redo 스택에 추가 (소유자별)
    const newRedoStack = new Map(redoStack);
    const ownerRedos = newRedoStack.get(ownerKey) || [];
    newRedoStack.set(ownerKey, [...ownerRedos, strokeId]);

    const newUndoStack = new Map(undoStack);
    newUndoStack.set(ownerKey, newUndos);

    set({
      strokesByPage: newStrokesByPage,
      undoStack: newUndoStack,
      redoStack: newRedoStack,
    });

    return strokeId;
  },

  redo: (pageAddress, ownerUserId) => {
    const pageKey = pageAddressKey(pageAddress);
    const ownerKey = pageOwnerKey(pageAddress, ownerUserId);
    const { redoStack, strokesByPage, undoStack } = get();
    const ownerRedos = redoStack.get(ownerKey) || [];

    if (ownerRedos.length === 0) return null;

    const strokeId = ownerRedos[ownerRedos.length - 1];
    const newRedos = ownerRedos.slice(0, -1);

    // 스트로크 다시 표시
    const newStrokesByPage = new Map(strokesByPage);
    const pageStrokes = newStrokesByPage.get(pageKey) || new Set();
    pageStrokes.add(strokeId);
    newStrokesByPage.set(pageKey, pageStrokes);

    // Undo 스택에 다시 추가 (소유자별)
    const newUndoStack = new Map(undoStack);
    const ownerUndos = newUndoStack.get(ownerKey) || [];
    newUndoStack.set(ownerKey, [...ownerUndos, strokeId]);

    const newRedoStack = new Map(redoStack);
    newRedoStack.set(ownerKey, newRedos);

    set({
      strokesByPage: newStrokesByPage,
      undoStack: newUndoStack,
      redoStack: newRedoStack,
    });

    return strokeId;
  },

  addHistoryStroke: (stroke) => {
    const pageKey = pageAddressKey(stroke.pageAddress);
    set((state) => {
      const newStrokes = new Map(state.strokes);
      newStrokes.set(stroke.id, stroke);

      const newStrokesByPage = new Map(state.strokesByPage);
      const pageStrokes = newStrokesByPage.get(pageKey) || new Set();
      pageStrokes.add(stroke.id);
      newStrokesByPage.set(pageKey, pageStrokes);

      return {
        strokes: newStrokes,
        strokesByPage: newStrokesByPage,
      };
    });
  },

  clearAllStrokes: () => {
    set({
      strokes: new Map(),
      activeStrokes: new Map(),
      strokesByPage: new Map(),
      undoStack: new Map(),
      redoStack: new Map(),
      currentPageAddress: initialMousePageAddress,
    });
  },

  applyEraserStroke: (eraserStroke) => {
    const { strokes, strokesByPage, undoStack, redoStack } = get();
    const pageKey = pageAddressKey(eraserStroke.pageAddress);
    const ownerKey = pageOwnerKey(eraserStroke.pageAddress, eraserStroke.ownerUserId);
    const pageStrokeIds = strokesByPage.get(pageKey);

    if (!pageStrokeIds || pageStrokeIds.size === 0) {
      return [];
    }

    const removedIds: string[] = [];

    // 같은 캔버스 소유자의 스트로크만 지우기 대상
    pageStrokeIds.forEach((id) => {
      const target = strokes.get(id);
      if (!target) return;
      if (target.ownerUserId === eraserStroke.ownerUserId && shouldEraseStroke(eraserStroke, target)) {
        removedIds.push(id);
      }
    });

    if (removedIds.length === 0) {
      return [];
    }

    const removedSet = new Set(removedIds);
    const newStrokes = new Map(strokes);
    const newStrokesByPage = new Map(strokesByPage);
    const newUndoStack = new Map(undoStack);
    const newRedoStack = new Map(redoStack);

    const updatedPageStrokes = new Set(newStrokesByPage.get(pageKey));
    removedSet.forEach((id) => {
      newStrokes.delete(id);
      updatedPageStrokes.delete(id);
    });

    if (updatedPageStrokes.size === 0) {
      newStrokesByPage.delete(pageKey);
    } else {
      newStrokesByPage.set(pageKey, updatedPageStrokes);
    }
    // undo/redo 스택에서 삭제된 스트로크 제거 (ownerKey 기준)
    if (newUndoStack.has(ownerKey)) {
      newUndoStack.set(
        ownerKey,
        (newUndoStack.get(ownerKey) || []).filter((id) => !removedSet.has(id))
      );
    }
    if (newRedoStack.has(ownerKey)) {
      newRedoStack.set(
        ownerKey,
        (newRedoStack.get(ownerKey) || []).filter((id) => !removedSet.has(id))
      );
    }

    set({
      strokes: newStrokes,
      strokesByPage: newStrokesByPage,
      undoStack: newUndoStack,
      redoStack: newRedoStack,
    });

    return removedIds;
  },

  // 스마트펜 설정
  setSmartpenColor: (color) => set((state) => ({
    smartpenSettings: { ...state.smartpenSettings, penColor: color }
  })),
  setSmartpenThickness: (thickness) => set((state) => ({
    smartpenSettings: { ...state.smartpenSettings, penThickness: thickness }
  })),
  setSmartpenType: (type) => set((state) => ({
    smartpenSettings: { ...state.smartpenSettings, penType: type }
  })),

  // 스타일러스/터치 설정
  setStylusColor: (color) => set((state) => ({
    stylusSettings: { ...state.stylusSettings, penColor: color }
  })),
  setStylusThickness: (thickness) => set((state) => ({
    stylusSettings: { ...state.stylusSettings, penThickness: thickness }
  })),
  setStylusType: (type) => set((state) => ({
    stylusSettings: { ...state.stylusSettings, penType: type }
  })),

  // 게스트 캔버스 입력 설정
  setGuestInputColor: (color) => set((state) => ({
    guestInputSettings: { ...state.guestInputSettings, penColor: color }
  })),
  setGuestInputThickness: (thickness) => set((state) => ({
    guestInputSettings: { ...state.guestInputSettings, penThickness: thickness }
  })),
  setGuestInputType: (type) => set((state) => ({
    guestInputSettings: { ...state.guestInputSettings, penType: type }
  })),

  setPaperSize: (size) => set({ paperSize: size }),

  getStroke: (strokeId) => get().strokes.get(strokeId),
  getActiveStroke: (strokeId) => get().activeStrokes.get(strokeId),
  getSmartpenSettings: () => get().smartpenSettings,
  getStylusSettings: () => get().stylusSettings,
  getGuestInputSettings: () => get().guestInputSettings,
}));
