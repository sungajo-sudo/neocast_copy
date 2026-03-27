import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { BackgroundCanvas } from './BackgroundCanvas';
import { StrokeCanvas } from './StrokeCanvas';
import { InputCanvas } from './InputCanvas';
import { CanvasContextMenu } from './CanvasContextMenu';
import { AnnotationCanvas } from './AnnotationCanvas';
import { useStrokeStore } from '../../stores/stroke-store';
import { useAnnotationStore } from '../../stores/annotation-store';
import { useAnnotationStatusStore } from '../../stores/annotation-status-store';
import { devBridge } from '../../services/dev-bridge';
import { useSessionStore } from '../../stores/session-store';
import { usePageStore } from '../../stores/page-store';
import { usePanelStore } from '../../stores/panel-store';
import { strokeService } from '../../services/stroke-service';
import { formatPageAddress, isMousePage, getPaperSizeInPoints, pointToScreenPx, isSamePageAddress, ParticipantRole } from '../../types';
import type { NcodePageAddress } from '../../types';
import { paperInfoService } from '../../services/paper-info-service';
import { GridSelector } from '../session/GridSelector';
import { useAuthStore } from '../../stores/auth-store';
import { useConnectionStore } from '../../stores/connection-store';
import { useAlert } from '../../contexts/AlertContext';
import { sessionService } from '../../services/session-service';
import { mockPenConnected } from '../../utils/dev-mock';
import { useParticipantActivity } from '../../hooks/useParticipantActivity';

// 컨텍스트 메뉴 상태 타입
interface ContextMenuState {
  isOpen: boolean;
  x: number;
  y: number;
  userId: string;
  userName: string;
}

interface CanvasContainerProps {
  pageAddress?: NcodePageAddress;
  className?: string;
  inputEnabled?: boolean;
  /** true이면 그리드 뷰 전환을 막고 단일 캔버스만 표시 */
  forceSingleView?: boolean;
}

/**
 * 캔버스 컨테이너 - 렌더링 + 입력 캔버스 결합
 * 선택된 용지 크기에 따른 캔버스
 */
export const CanvasContainer: React.FC<CanvasContainerProps> = ({
  pageAddress: propPageAddress,
  className = '',
  inputEnabled = true,
  forceSingleView = false,
}) => {
  const { t } = useTranslation();
  const { tokens } = useAuthStore();
  const { showConfirm } = useAlert();
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scale, setScaleLocal] = useState(1);
  const [, setFitScaleLocal] = useState(1); // 화면에 맞는 스케일 (100% Lock 기준)
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 });
  // 캔버스 오프셋 (스크롤 영역 내 위치 조정용)
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  // 패닝 상태
  const [isPanning, setIsPanning] = useState(false);
  const [isMetaKeyDown, setIsMetaKeyDown] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0, offsetX: 0, offsetY: 0 });

  // 사이드바 도킹 위치 및 드래그/접힘 상태
  const sidebarSize = 120;
  const [sidebarDock, setSidebarDock] = useState<'right' | 'left' | 'bottom'>('right');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isDraggingSidebar, setIsDraggingSidebar] = useState(false);
  const [dragTarget, setDragTarget] = useState<'right' | 'left' | 'bottom' | null>(null);
  const spotlightContainerRef = useRef<HTMLDivElement>(null);

  // 100% Lock 상태 (화면에 맞춤 자동 조정)
  const isZoomLocked = usePanelStore((state) => state.isZoomLocked);
  const setZoomLocked = usePanelStore((state) => state.setZoomLocked);
  const setCanvasScale = usePanelStore((state) => state.setCanvasScale);
  const setCanvasFitScale = usePanelStore((state) => state.setCanvasFitScale);

  // Stylus 상태 (터치 입력 활성화/비활성화)
  const isStylusOn = usePanelStore((state) => state.isStylusOn);
  const isPenStreamOn = usePanelStore((state) => state.isPenStreamOn);
  const isModifierKeyPressed = usePanelStore((state) => state.isModifierKeyPressed);
  // 실제 Stylus 활성 상태: 사용자 설정 ON && PenStream ON && modifier 키 미눌림
  const effectivelyStylusOn = isStylusOn && isPenStreamOn && !isModifierKeyPressed;

  // 패널 상태 (패널 열림/닫힘에 따른 크기 재계산 트리거용)
  const activeRightPanel = usePanelStore((state) => state.activeRightPanel);
  const activeLeftPanel = usePanelStore((state) => state.activeLeftPanel);
  const leftPanelWidth = usePanelStore((state) => state.leftPanelWidth);

  // 로컬 스케일 상태를 스토어와 동기화하는 래퍼
  const setScale = useCallback((newScale: number) => {
    setScaleLocal(newScale);
    setCanvasScale(newScale);
  }, [setCanvasScale]);

  const setFitScale = useCallback((newFitScale: number) => {
    setFitScaleLocal(newFitScale);
    setCanvasFitScale(newFitScale);
  }, [setCanvasFitScale]);

  const currentPageAddress = useStrokeStore((state) => state.currentPageAddress);
  const paperSize = useStrokeStore((state) => state.paperSize);
  const participantCurrentPages = useStrokeStore((state) => state.participantCurrentPages);
  const pageAddress = propPageAddress ?? currentPageAddress;

  // 세션 상태 (그리드 뷰용)
  const isHost = useSessionStore((state) => state.isHost);
  const session = useSessionStore((state) => state.session);
  const currentUserId = useSessionStore((state) => state.currentUserId);
  const selectedViewUserIds = useSessionStore((state) => state.selectedViewUserIds);
  const storedGridLayout = useSessionStore((state) => state.gridLayout);
  const setGridLayout = useSessionStore((state) => state.setGridLayout);
  const resetGridLayout = useSessionStore((state) => state.resetGridLayout);
  const isGridLayoutAuto = useSessionStore((state) => state.isGridLayoutAuto);
  const minGridCells = useSessionStore((state) => state.minGridCells);
  const updateMinGridCells = useSessionStore((state) => state.updateMinGridCells);
  const getUserColor = useSessionStore((state) => state.getUserColor);
  const activeCanvasUserId = useSessionStore((state) => state.activeCanvasUserId);
  const setActiveCanvasUserId = useSessionStore((state) => state.setActiveCanvasUserId);
  const viewMode = useSessionStore((state) => state.viewMode);
  const setViewMode = useSessionStore((state) => state.setViewMode);
  const spotlightUserId = useSessionStore((state) => state.spotlightUserId);
  const setSpotlightUserId = useSessionStore((state) => state.setSpotlightUserId);
  const smartpenTargetUserId = useSessionStore((state) => state.smartpenTargetUserId);
  const setSmartpenTargetUserId = useSessionStore((state) => state.setSmartpenTargetUserId);
  const getSmartpenTargetUserId = useSessionStore((state) => state.getSmartpenTargetUserId);
  const updateParticipant = useSessionStore((state) => state.updateParticipant);
  const spotlightShareUserId = useSessionStore((state) => state.spotlightShareUserId);
  const guestInputSettings = useStrokeStore((state) => state.guestInputSettings);

  // Control 소켓 (주목 공유 전송용)
  const controlSocket = useConnectionStore((state) => state.controlSocket);

  // 페이지 상태 (페이지 소유 확인용)
  // pages를 직접 subscribe하여 페이지 추가/삭제 시 리렌더링 트리거
  const pages = usePageStore((state) => state.pages);
  const addPage = usePageStore((state) => state.addPage);

  // 첨삭 모드 상태 (스포트라이트 뷰에서 사용)
  const [spotAnnotationMode, setSpotAnnotationMode] = useState(false);
  // 실시간(follow) vs 수동(browse) 모드 — 스포트라이트에서 학생 페이지 자동 따라가기
  const [spotlightFollowMode, setSpotlightFollowMode] = useState<'follow' | 'browse'>('follow');
  // browse 모드에서 고정된 페이지 주소 (null이면 현재 학생 페이지 사용)
  const [browsePageOverride, setBrowsePageOverride] = useState<NcodePageAddress | null>(null);
  const annotationsMap = useAnnotationStore((state) => state.annotations);
  const addAnnotation = useAnnotationStore((state) => state.addAnnotation);
  const clearAnnotations = useAnnotationStore((state) => state.clearAnnotations);
  const setAnnotating = useAnnotationStatusStore((state) => state.setAnnotating);
  const activeAnnotationTargets = useAnnotationStatusStore((state) => state.activeAnnotationTargets);
  const { getStatus: getActivityStatus } = useParticipantActivity();

  // 그리드 선택 팝업 상태
  const [isGridSelectorOpen, setIsGridSelectorOpen] = useState(false);

  // 컨텍스트 메뉴 상태
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    isOpen: false,
    x: 0,
    y: 0,
    userId: '',
    userName: '',
  });

  // 논리적 페이지 번호 (NCode 주소 → "P.1", "P.2", ...)
  const getLogicalPageNumber = useCallback((userId: string, addr: NcodePageAddress): string => {
    const userPages = pages
      .filter((p) => p.ownerUserId === userId)
      .sort((a, b) => a.address.page - b.address.page);
    const idx = userPages.findIndex((p) => isSamePageAddress(p.address, addr));
    return idx >= 0 ? `P.${idx + 1}` : `P.?`;
  }, [pages]);

  // 페이지 변경 flash 추적
  const [flashingUsers, setFlashingUsers] = useState<Set<string>>(new Set());
  const prevPagesRef = useRef<Map<string, NcodePageAddress>>(new Map());

  useEffect(() => {
    const prev = prevPagesRef.current;
    const changed = new Set<string>();
    participantCurrentPages.forEach((addr, userId) => {
      const prevAddr = prev.get(userId);
      if (prevAddr && !isSamePageAddress(prevAddr, addr)) {
        changed.add(userId);
      }
    });
    if (changed.size > 0) {
      setFlashingUsers(changed);
      const timer = setTimeout(() => setFlashingUsers(new Set()), 800);
      return () => clearTimeout(timer);
    }
    prevPagesRef.current = new Map(participantCurrentPages);
  }, [participantCurrentPages]);

  // 그리드 뷰에 표시할 사용자 목록 결정
  const gridUsers = useMemo(() => {
    if (!session) return [];

    // 게스트: 기본은 자신만, 주목공유 시 호스트 캔버스 추가
    if (!isHost) {
      if (!currentUserId) return [];
      const userIds = new Set<string>();
      userIds.add(currentUserId);
      // 주목공유가 활성화된 경우에만 대상 추가
      if (spotlightShareUserId) userIds.add(spotlightShareUserId);

      // 자신만 보는 경우(1명)는 빈 배열 반환 → 스포트라이트(단일) 뷰
      if (userIds.size <= 1) return [];

      return [...userIds]
        .map((uid) => {
          const p = session.participants.find((pp) => pp.userId === uid);
          return p ? { userId: p.userId, userName: p.userName, color: getUserColor(p.userId) } : null;
        })
        .filter((u): u is NonNullable<typeof u> => u !== null);
    }

    // 호스트: 빈 배열 = 전체 보기
    if (selectedViewUserIds.length === 0) {
      return session.participants.map((p) => ({
        userId: p.userId,
        userName: p.userName,
        color: getUserColor(p.userId),
      }));
    }

    // 복수 선택된 경우
    if (selectedViewUserIds.length > 1) {
      return selectedViewUserIds
        .map((userId) => {
          const participant = session.participants.find((p) => p.userId === userId);
          return participant
            ? {
              userId: participant.userId,
              userName: participant.userName,
              color: getUserColor(userId),
            }
            : null;
        })
        .filter((u): u is NonNullable<typeof u> => u !== null);
    }

    // 단일 선택이면 그리드 뷰 아님
    return [];
  }, [isHost, session, currentUserId, selectedViewUserIds, getUserColor, spotlightShareUserId]);

  // 그리드 뷰 모드 여부
  const isGridView = !forceSingleView && gridUsers.length > 1;

  // 실제 활성 캔버스 사용자 ID (단일 뷰면 자동 설정)
  const effectiveActiveUserId = useMemo(() => {
    // 단일 선택 (1명)이면 그 사용자가 자동 active
    if (selectedViewUserIds.length === 1) {
      return selectedViewUserIds[0];
    }
    // 멀티 뷰면 명시적으로 선택된 activeCanvasUserId 사용
    return activeCanvasUserId;
  }, [selectedViewUserIds, activeCanvasUserId]);

  // 캔버스가 활성화되어 있는지 확인
  const isCanvasActive = useCallback((userId: string): boolean => {
    return effectiveActiveUserId === userId;
  }, [effectiveActiveUserId]);

  // 해당 사용자의 캔버스가 스마트펜 입력 대상인지 확인
  const isSmartpenTargetCanvas = useCallback((userId: string): boolean => {
    if (!isHost) return false;
    const targetId = getSmartpenTargetUserId();
    return targetId === userId;
  }, [isHost, getSmartpenTargetUserId]);

  // 캔버스 클릭 시 활성화 (왼쪽 클릭)
  const handleCanvasClick = useCallback((e: React.MouseEvent, userId: string) => {
    // 우클릭은 컨텍스트 메뉴가 처리
    if (e.button !== 0) return;
    // 주목공유 활성 중에는 비호스트 전환 차단
    if (!isHost && spotlightShareUserId) return;
    setActiveCanvasUserId(userId);
  }, [isHost, spotlightShareUserId, setActiveCanvasUserId]);

  /**
   * 페이지 추가 핸들러 (해당 사용자에게 현재 페이지 추가)
   */
  const handleAddPageForUser = useCallback((userId: string) => {
    if (!isHost && userId !== currentUserId) return;

    // 로컬에 페이지 추가
    addPage(pageAddress, userId);
    // 서버로 PAGE_ADD 메시지 전송 (ownerUserId = userId, 해당 사용자의 캔버스에 페이지 추가)
    strokeService.addPage(userId, pageAddress);
    console.log('[CanvasContainer] Page added for user:', userId, 'page:', formatPageAddress(pageAddress));
  }, [isHost, currentUserId, pageAddress, addPage]);

  /**
   * 최적 그리드 레이아웃 계산
   * 컨테이너 크기와 페이지 비율을 고려하여 각 페이지가 가장 크게 보이는 그리드를 찾음
   */
  const calculateOptimalGridLayout = useCallback((
    containerWidth: number,
    containerHeight: number,
    pageAspectRatio: number,
    userCount: number
  ): { rows: number; cols: number } => {
    if (userCount <= 1) return { rows: 1, cols: 1 };

    const padding = 16; // 그리드 패딩
    const gap = 8; // 셀 간격
    const labelHeight = 28; // 라벨 높이

    let bestLayout = { rows: 1, cols: userCount };
    let maxPageArea = 0;

    // 모든 유효한 (rows, cols) 조합 시도
    for (let rows = 1; rows <= userCount; rows++) {
      const cols = Math.ceil(userCount / rows);

      // 각 셀에 사용 가능한 공간 계산
      const availableWidth = containerWidth - padding * 2 - gap * (cols - 1);
      const availableHeight = containerHeight - padding * 2 - gap * (rows - 1);

      const cellWidth = availableWidth / cols;
      const cellHeight = availableHeight / rows - labelHeight;

      if (cellWidth <= 0 || cellHeight <= 0) continue;

      // 셀 내에서 비율을 유지하면서 페이지 크기 계산
      const cellAspectRatio = cellWidth / cellHeight;
      let pageWidth: number;
      let pageHeight: number;

      if (cellAspectRatio > pageAspectRatio) {
        // 셀이 페이지보다 넓음 - 높이가 제한
        pageHeight = cellHeight;
        pageWidth = pageHeight * pageAspectRatio;
      } else {
        // 셀이 페이지보다 높음 - 너비가 제한
        pageWidth = cellWidth;
        pageHeight = pageWidth / pageAspectRatio;
      }

      const pageArea = pageWidth * pageHeight;

      if (pageArea > maxPageArea) {
        maxPageArea = pageArea;
        bestLayout = { rows, cols };
      }
    }

    return bestLayout;
  }, []);

  // NPROJ 기반 페이지 크기 상태 (Ncode 페이지용)
  const [nprojSizeInPoints, setNprojSizeInPoints] = useState<{
    widthPt: number;
    heightPt: number;
  } | null>(null);

  // 페이지 변경 시 NPROJ 크기 로드
  useEffect(() => {
    // 마우스 페이지는 NPROJ 없음 - fallback 사용
    if (isMousePage(pageAddress)) {
      setNprojSizeInPoints(null);
      return;
    }

    // 1. 캐시에서 먼저 확인 (동기)
    // 캐시에 없으면 null로 설정하여 fallback 사용
    const cachedSize = paperInfoService.getPageSizeInPoints(pageAddress);
    setNprojSizeInPoints(cachedSize);

    // 캐시에 있으면 완료
    if (cachedSize) {
      return;
    }

    // 2. 캐시 없으면 비동기 로드 시도
    let cancelled = false;
    paperInfoService.requestPaperInfo(pageAddress).then((result) => {
      if (cancelled) return;

      // paper-info가 없는 경우 (404 등) - fallback 유지
      if (!result) {
        setNprojSizeInPoints(null);
        return;
      }

      const size = paperInfoService.getPageSizeInPoints(pageAddress);
      setNprojSizeInPoints(size);
    });

    return () => {
      cancelled = true;
    };
  }, [pageAddress]);

  // 선택된 용지 크기에 따른 캔버스 크기 계산 (픽셀)
  // Ncode 페이지: NPROJ 크기 사용, 마우스 페이지: 기본 용지 크기 사용
  const { canvasWidth, canvasHeight } = useMemo(() => {
    // NPROJ 크기가 있으면 사용 (Ncode 페이지)
    if (nprojSizeInPoints) {
      return {
        canvasWidth: pointToScreenPx(nprojSizeInPoints.widthPt, 96),
        canvasHeight: pointToScreenPx(nprojSizeInPoints.heightPt, 96),
      };
    }
    // 기본 용지 크기 사용 (마우스 페이지 또는 NPROJ 로드 전)
    const { widthPt, heightPt } = getPaperSizeInPoints(paperSize);
    return {
      canvasWidth: pointToScreenPx(widthPt, 96),
      canvasHeight: pointToScreenPx(heightPt, 96),
    };
  }, [nprojSizeInPoints, paperSize]);

  // 실제 사용할 그리드 레이아웃 계산 (자동 또는 수동)
  const gridLayout = useMemo(() => {
    if (!isGridLayoutAuto) {
      return storedGridLayout;
    }

    const userCount = gridUsers.length;
    if (userCount <= 1) return { cols: 1, rows: 1 };

    // 컨테이너 크기를 기반으로 최적 레이아웃 계산
    const pageAspectRatio = canvasWidth / canvasHeight;
    const optimal = calculateOptimalGridLayout(
      containerSize.width,
      containerSize.height,
      pageAspectRatio,
      userCount
    );

    // minGridCells 이상을 유지 (자동 축소 방지)
    const calculatedCells = optimal.cols * optimal.rows;
    if (calculatedCells < minGridCells) {
      // minGridCells를 만족하는 최적 레이아웃 재계산
      const minOptimal = calculateOptimalGridLayout(
        containerSize.width,
        containerSize.height,
        pageAspectRatio,
        minGridCells
      );
      return minOptimal;
    }

    return optimal;
  }, [isGridLayoutAuto, storedGridLayout, gridUsers.length, minGridCells, containerSize, canvasWidth, canvasHeight, calculateOptimalGridLayout]);

  // 그리드 셀 수가 증가하면 minGridCells 업데이트 (자동 축소 방지용)
  useEffect(() => {
    if (isGridLayoutAuto && isGridView) {
      const currentCells = gridLayout.cols * gridLayout.rows;
      updateMinGridCells(currentCells);
    }
  }, [isGridLayoutAuto, isGridView, gridLayout.cols, gridLayout.rows, updateMinGridCells]);

  /**
   * 컨테이너 크기 감지
   */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateContainerSize = () => {
      const rect = container.getBoundingClientRect();
      setContainerSize({ width: rect.width, height: rect.height });
    };

    updateContainerSize();

    const resizeObserver = new ResizeObserver(updateContainerSize);
    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, []);

  /**
   * 패널 열림/닫힘 시 애니메이션 종료 후 크기 재계산
   * RightPanelContainer의 transition-all duration-300을 기다림
   */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 즉시 업데이트 + 애니메이션 종료 후(350ms) 재업데이트
    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      setContainerSize({ width: rect.width, height: rect.height });
    };

    updateSize();
    const timer = setTimeout(updateSize, 350);

    return () => clearTimeout(timer);
  }, [activeRightPanel, activeLeftPanel, leftPanelWidth]);

  /**
   * 용지 크기 또는 컨테이너 크기 변경 시 fit 스케일 계산
   * isZoomLocked가 true일 때만 실제 스케일 적용
   */
  useEffect(() => {
    const padding = isGridView ? 48 : 16; // 그리드: 양쪽 24px, 단일 뷰: 양쪽 8px
    // 스포트라이트 모드에서 사이드바가 차지하는 공간 차감
    const sidebarOffset = (isGridView && viewMode === 'spotlight') ? (isSidebarCollapsed ? 24 : sidebarSize) : 0;
    const availableWidth = containerSize.width - padding - (sidebarDock !== 'bottom' ? sidebarOffset : 0);
    const availableHeight = containerSize.height - padding - (sidebarDock === 'bottom' ? sidebarOffset : 0);

    // 가로/세로 비율에 맞춰 fit 스케일 계산 (fit-contain)
    const scaleX = availableWidth / canvasWidth;
    const scaleY = availableHeight / canvasHeight;
    const maxScale = isGridView ? 1 : 2;
    const newFitScale = Math.min(scaleX, scaleY, maxScale);
    const minScale = isGridView ? 0.25 : 0.4;
    const clampedFitScale = Math.max(newFitScale, minScale);

    setFitScale(clampedFitScale);

    // 100% Lock이 켜져 있으면 fit 스케일 적용
    if (isZoomLocked) {
      setScale(clampedFitScale);
      setOffset({ x: 0, y: 0 }); // 오프셋 리셋
    }
  // activeRightPanel, activeLeftPanel, leftPanelWidth를 의존성에 추가하여
  // 패널 열림/닫힘 시 강제로 재계산 트리거
  }, [canvasWidth, canvasHeight, containerSize, isZoomLocked, setScale, setFitScale, activeRightPanel, activeLeftPanel, leftPanelWidth, isGridView, viewMode, sidebarDock, sidebarSize, isSidebarCollapsed]);

  /**
   * 줌 처리 (휠 이벤트) - 마우스 위치 기준
   * CMD/CTRL + 휠로 줌 시 100% Lock 해제
   */
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();

      const container = containerRef.current;
      if (!container) return;

      // 100% Lock 해제
      if (isZoomLocked) {
        setZoomLocked(false);
      }

      const containerRect = container.getBoundingClientRect();

      // 마우스 위치 (컨테이너 기준)
      const mouseX = e.clientX - containerRect.left;
      const mouseY = e.clientY - containerRect.top;

      // 컨테이너 중심
      const centerX = containerRect.width / 2;
      const centerY = containerRect.height / 2;

      // 현재 캔버스의 화면상 위치 (중심 기준 + 오프셋)
      const currentCanvasX = centerX + offset.x;
      const currentCanvasY = centerY + offset.y;

      // 마우스가 캔버스 상에서 가리키는 상대 좌표 (스케일 적용 전 기준)
      const canvasPointX = (mouseX - currentCanvasX) / scale;
      const canvasPointY = (mouseY - currentCanvasY) / scale;

      // 새 스케일 계산
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newScale = Math.min(Math.max(scale * delta, 0.25), 4);

      // 새 스케일 적용 후, 같은 캔버스 좌표가 마우스 위치에 오도록 오프셋 조정
      // mouseX = centerX + newOffset.x + canvasPointX * newScale
      // newOffset.x = mouseX - centerX - canvasPointX * newScale
      const newOffsetX = mouseX - centerX - canvasPointX * newScale;
      const newOffsetY = mouseY - centerY - canvasPointY * newScale;

      setScale(newScale);
      setOffset({ x: newOffsetX, y: newOffsetY });
    }
  }, [scale, offset, isZoomLocked, setZoomLocked]);

  /**
   * CMD/Ctrl 키 상태 감지
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        setIsMetaKeyDown(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (!e.metaKey && !e.ctrlKey) {
        setIsMetaKeyDown(false);
        setIsPanning(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  /**
   * 패닝 시작 (CMD + 마우스 다운)
   */
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey) {
      e.preventDefault();
      setIsPanning(true);
      panStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        offsetX: offset.x,
        offsetY: offset.y,
      };
    }
  }, [offset]);

  /**
   * 패닝 진행 (마우스 이동)
   */
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning) return;

    const deltaX = e.clientX - panStartRef.current.x;
    const deltaY = e.clientY - panStartRef.current.y;

    setOffset({
      x: panStartRef.current.offsetX + deltaX,
      y: panStartRef.current.offsetY + deltaY,
    });
  }, [isPanning]);

  /**
   * 패닝 종료 (마우스 업)
   */
  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  /**
   * 패닝 취소 (마우스가 컨테이너를 벗어남)
   */
  const handleMouseLeave = useCallback(() => {
    setIsPanning(false);
  }, []);

  // 커서 스타일 결정
  const cursorStyle = isPanning ? 'grabbing' : isMetaKeyDown ? 'grab' : 'default';

  // 컨텍스트 메뉴 핸들러
  const handleContextMenu = useCallback((e: React.MouseEvent, userId: string, userName: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      isOpen: true,
      x: e.clientX,
      y: e.clientY,
      userId,
      userName,
    });
  }, []);

  const handleContextMenuClose = useCallback(() => {
    setContextMenu((prev) => ({ ...prev, isOpen: false }));
  }, []);

  // 스마트펜 입력 대상 설정/토글
  const handleSmartpenInput = useCallback((userId: string) => {
    if (smartpenTargetUserId === userId) {
      setSmartpenTargetUserId(null); // 이미 대상이면 해제
    } else {
      setSmartpenTargetUserId(userId);
    }
  }, [smartpenTargetUserId, setSmartpenTargetUserId]);

  // 호스트 임명
  const handlePromoteToHost = useCallback(async (userId: string) => {
    if (!session || !tokens?.accessToken) return;
    try {
      await sessionService.promoteToHost(tokens.accessToken, session.id, userId);
      updateParticipant(userId, { role: ParticipantRole.Host });
    } catch (error) {
      console.error('Failed to promote to host:', error);
    }
  }, [session, tokens, updateParticipant]);

  // 참가자 내보내기
  const handleKickParticipant = useCallback(async (userId: string, userName: string) => {
    if (!session || !tokens?.accessToken) return;
    const confirmed = await showConfirm(t('participant.kickConfirm', { name: userName }));
    if (!confirmed) return;
    try {
      await sessionService.kickParticipant(tokens.accessToken, session.id, userId);
    } catch (error) {
      console.error('Failed to kick participant:', error);
    }
  }, [session, tokens, showConfirm, t]);

  // 그리드 셀 크기 계산
  const gridCellSize = useMemo(() => {
    if (!isGridView) return { width: 0, height: 0 };

    const padding = 16; // 그리드 패딩
    const gap = 8; // 셀 간격
    const labelHeight = 28; // 라벨 높이

    const availableWidth = containerSize.width - padding * 2 - gap * (gridLayout.cols - 1);
    const availableHeight = containerSize.height - padding * 2 - gap * (gridLayout.rows - 1);

    const cellWidth = Math.floor(availableWidth / gridLayout.cols);
    const cellHeight = Math.floor(availableHeight / gridLayout.rows);

    // 용지 비율 유지하면서 셀 내에 맞추기
    const aspectRatio = canvasWidth / canvasHeight;
    const cellContentHeight = cellHeight - labelHeight;

    let finalWidth = cellWidth;
    let finalHeight = finalWidth / aspectRatio;

    if (finalHeight > cellContentHeight) {
      finalHeight = cellContentHeight;
      finalWidth = finalHeight * aspectRatio;
    }

    return {
      width: Math.floor(finalWidth),
      height: Math.floor(finalHeight),
    };
  }, [isGridView, containerSize, gridLayout, canvasWidth, canvasHeight]);

  // 스포트라이트 뷰에서 유효한 스포트라이트 사용자 ID 결정
  const effectiveSpotlightUserId = useMemo(() => {
    if (!isGridView) return null;
    // 명시적으로 선택된 사용자가 있고, 현재 gridUsers에 있으면 사용
    if (spotlightUserId && gridUsers.some((u) => u.userId === spotlightUserId)) {
      return spotlightUserId;
    }
    // 게스트: 자신의 캔버스를 기본 스포트라이트로 선택
    if (!isHost && currentUserId && gridUsers.some((u) => u.userId === currentUserId)) {
      return currentUserId;
    }
    // 호스트가 gridUsers에 있으면 호스트 선택
    if (session?.hostId && gridUsers.some((u) => u.userId === session.hostId)) {
      return session.hostId;
    }
    // 첫 번째 사용자 fallback
    return gridUsers[0]?.userId ?? null;
  }, [isGridView, isHost, currentUserId, spotlightUserId, gridUsers, session?.hostId]);

  // 사이드바 썸네일 크기 계산
  const sidebarPadding = 16;
  const verticalLabelWidth = 22; // 좌/우 도킹 시 세로 라벨 폭
  const thumbnailCellSize = useMemo(() => {
    const aspectRatio = canvasWidth / canvasHeight;
    if (sidebarDock === 'bottom') {
      // 하단: 높이 기준으로 계산
      const h = sidebarSize - sidebarPadding - 20; // 가로 라벨 높이 제외
      const w = Math.floor(h * aspectRatio);
      return { width: w, height: h };
    }
    // 좌/우: 폭 기준 (세로 라벨 폭 차감)
    const w = sidebarSize - sidebarPadding - verticalLabelWidth;
    const h = Math.floor(w / aspectRatio);
    return { width: w, height: h };
  }, [canvasWidth, canvasHeight, sidebarDock, sidebarSize, sidebarPadding, verticalLabelWidth]);

  // 사이드바 드래그 핸들러
  const handleSidebarDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingSidebar(true);

    const handleMove = (me: MouseEvent) => {
      const container = spotlightContainerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const relX = (me.clientX - rect.left) / rect.width;
      const relY = (me.clientY - rect.top) / rect.height;

      if (relX < 0.2) setDragTarget('left');
      else if (relX > 0.8) setDragTarget('right');
      else if (relY > 0.75) setDragTarget('bottom');
      else setDragTarget(null);
    };

    const handleUp = () => {
      setIsDraggingSidebar(false);
      setDragTarget((current) => {
        if (current) setSidebarDock(current);
        return null;
      });
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  }, []);

  // 스포트라이트 썸네일 클릭 핸들러
  const handleSpotlightThumbnailClick = useCallback((userId: string) => {
    // 주목공유 활성 중에는 비호스트 전환 차단
    if (!isHost && spotlightShareUserId) return;
    setSpotlightUserId(userId);
    setActiveCanvasUserId(userId);
  }, [isHost, spotlightShareUserId, setSpotlightUserId, setActiveCanvasUserId]);

  // 뷰 모드 토글 핸들러
  const handleToggleViewMode = useCallback(() => {
    // 주목공유 활성 중에는 뷰 모드 전환 차단
    if (spotlightShareUserId) return;
    setViewMode(viewMode === 'spotlight' ? 'grid' : 'spotlight');
  }, [viewMode, setViewMode, spotlightShareUserId]);

  // 주목으로 공유 (호스트 전용)
  const handleSpotlightShare = useCallback((userId: string) => {
    if (!isHost || !controlSocket) return;
    controlSocket.emit('control', { type: 'SPOTLIGHT_SHARE', userId, timestamp: Date.now() });
  }, [isHost, controlSocket]);

  // 주목 공유 끄기 (호스트 전용)
  const handleSpotlightUnshare = useCallback(() => {
    if (!isHost || !controlSocket) return;
    controlSocket.emit('control', { type: 'SPOTLIGHT_SHARE', userId: null, timestamp: Date.now() });
  }, [isHost, controlSocket]);

  // 썸네일 카드 렌더링 헬퍼
  const renderThumbnailCard = (user: { userId: string; userName: string; color: string }) => {
    // 이 사용자의 현재 페이지
    const thumbPageAddress = user.userId === currentUserId
      ? pageAddress
      : participantCurrentPages.get(user.userId) ?? pageAddress;
    const userHasPage = pages.some(
      (p) => isSamePageAddress(p.address, thumbPageAddress) && p.ownerUserId === user.userId
    );
    const isVerticalLabel = sidebarDock === 'left' || sidebarDock === 'right';

    // 썸네일 콘텐츠
    const thumbnailContent = (
      <div className="flex items-center justify-center bg-gray-50 p-0.5">
        {userHasPage ? (
          <div
            className="relative bg-white shadow-sm"
            style={{ width: `${thumbnailCellSize.width}px`, height: `${thumbnailCellSize.height}px` }}
          >
            <BackgroundCanvas pageAddress={thumbPageAddress} width={thumbnailCellSize.width} height={thumbnailCellSize.height} scale={1} />
            <StrokeCanvas pageAddress={thumbPageAddress} width={thumbnailCellSize.width} height={thumbnailCellSize.height} scale={1} userId={user.userId} className="absolute inset-0" />
          </div>
        ) : (
          <div
            className="flex items-center justify-center bg-gray-200 rounded border-2 border-dashed border-gray-400"
            style={{ width: `${thumbnailCellSize.width}px`, height: `${thumbnailCellSize.height}px` }}
          >
            <span className="text-gray-500 text-xs">{t('canvas.noPage')}</span>
          </div>
        )}
      </div>
    );

    // 활동 상태/첨삭/펜 정보
    const activityStatus = user.userId !== currentUserId ? getActivityStatus(user.userId) : null;
    const isBeingAnnotated = activeAnnotationTargets.has(user.userId);
    const isPenConnected = user.userId !== currentUserId && mockPenConnected(user.userId);

    // 이름 라벨
    const nameLabel = isVerticalLabel ? (
      // 좌/우: 세로 라벨 (90도 회전 텍스트)
      <div
        className="flex items-center justify-center text-white font-medium overflow-hidden"
        style={{
          backgroundColor: isBeingAnnotated ? '#ef4444' : userHasPage ? user.color : '#9ca3af',
          width: `${verticalLabelWidth}px`,
          minWidth: `${verticalLabelWidth}px`,
          writingMode: 'vertical-rl',
          // 왼쪽: 아래→위 (180도 회전), 오른쪽: 위→아래
          transform: sidebarDock === 'left' ? 'rotate(180deg)' : undefined,
          fontSize: '12px',
          lineHeight: 1.4,
        }}
      >
        <span className="truncate px-0.5">{user.userName}</span>
        <span className="text-[8px] font-bold bg-white/30 px-1 rounded mt-0.5">
          {getLogicalPageNumber(user.userId, thumbPageAddress)}
        </span>
        {activityStatus === 'writing' && (
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 mt-0.5 animate-pulse flex-shrink-0" />
        )}
      </div>
    ) : (
      // 하단: 가로 라벨
      <div
        className="flex items-center justify-center gap-1 px-2 py-0.5 text-white text-xs font-medium"
        style={{ backgroundColor: isBeingAnnotated ? '#ef4444' : userHasPage ? user.color : '#9ca3af' }}
      >
        <span className="truncate">{user.userName}</span>
        <span className="text-[8px] font-bold bg-white/30 px-1 rounded flex-shrink-0">
          {getLogicalPageNumber(user.userId, thumbPageAddress)}
        </span>
        {activityStatus === 'writing' && (
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
        )}
        {isPenConnected && (
          <svg className="w-2.5 h-2.5 opacity-75 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        )}
      </div>
    );

    return (
      <div
        key={user.userId}
        className={`cursor-pointer rounded-lg overflow-hidden transition-all flex-shrink-0 ${
          isBeingAnnotated
            ? 'ring-2 ring-red-500 ring-offset-1'
            : effectiveSpotlightUserId === user.userId
              ? 'ring-2 ring-blue-500 ring-offset-1'
              : 'hover:ring-2 hover:ring-blue-300'
        } ${isVerticalLabel ? 'flex flex-row' : ''}`}
        onClick={() => handleSpotlightThumbnailClick(user.userId)}
        onContextMenu={(e) => handleContextMenu(e, user.userId, user.userName)}
      >
        {/* 좌측 도킹: 라벨 왼쪽 → 썸네일 오른쪽 */}
        {/* 우측 도킹: 썸네일 왼쪽 → 라벨 오른쪽 */}
        {/* 하단 도킹: 라벨 위 → 썸네일 아래 */}
        {sidebarDock === 'right' ? <>{thumbnailContent}{nameLabel}</> :
         sidebarDock === 'left' ? <>{nameLabel}{thumbnailContent}</> :
         <>{nameLabel}{thumbnailContent}</>}
      </div>
    );
  };

  // 스포트라이트용 데이터 (훅은 조건 블록 밖에서 호출)
  const spotAnnotations = useMemo(
    () => (effectiveSpotlightUserId ? annotationsMap.get(effectiveSpotlightUserId) ?? [] : []),
    [annotationsMap, effectiveSpotlightUserId]
  );

  // 스포트라이트 뷰 렌더링
  if (isGridView && viewMode === 'spotlight') {
    // 호스트와 나머지 사용자 분리 (사이드바용)
    const hostUser = gridUsers.find((u) => u.userId === session?.hostId);
    const otherUsers = gridUsers.filter((u) => u.userId !== session?.hostId);

    // 스포트라이트 대상 사용자 정보
    const spotlightUser = gridUsers.find((u) => u.userId === effectiveSpotlightUserId);
    // 스포트라이트 대상의 현재 페이지 (follow/browse 모드 분기)
    const studentLivePage = spotlightUser
      ? (spotlightUser.userId === currentUserId
          ? pageAddress
          : participantCurrentPages.get(spotlightUser.userId) ?? pageAddress)
      : pageAddress;
    const spotlightPageAddress = (spotlightFollowMode === 'browse' && browsePageOverride)
      ? browsePageOverride
      : studentLivePage;
    const spotlightHasPage = spotlightUser ? pages.some(
      (p) => isSamePageAddress(p.address, spotlightPageAddress) && p.ownerUserId === spotlightUser.userId
    ) : false;
    const canDrawSpotlight = isHost || spotlightUser?.userId === currentUserId;
    // 스포트라이트 첨삭: 호스트가 다른 학생 캔버스를 볼 때만 활성 가능
    const canAnnotateSpotlight = isHost && spotlightUser && spotlightUser.userId !== session?.hostId;
    const handleSpotAnnotationDrawStart = () => {
      if (!effectiveSpotlightUserId) return;
      setAnnotating(effectiveSpotlightUserId);
      if (import.meta.env.DEV) {
        devBridge.send({
          type: 'ANNOTATION_ADDED',
          targetUserId: effectiveSpotlightUserId,
          annotation: { points: [], color: '#FF3B30', lineWidth: 3 },
          code: session?.code ?? '',
        });
      }
    };
    const handleSpotAnnotationStroke = (points: { x: number; y: number }[]) => {
      if (!effectiveSpotlightUserId) return;
      const stroke = { points, color: '#FF3B30', lineWidth: 3 };
      addAnnotation(effectiveSpotlightUserId, stroke);
      setAnnotating(effectiveSpotlightUserId);
      if (controlSocket) {
        controlSocket.emit('annotation:stroke', { targetUserId: effectiveSpotlightUserId, points });
      } else if (import.meta.env.DEV) {
        devBridge.send({
          type: 'ANNOTATION_ADDED',
          targetUserId: effectiveSpotlightUserId,
          annotation: stroke,
          code: session?.code ?? '',
        });
      }
    };

    const isBottomDock = sidebarDock === 'bottom';
    const flexDir = isBottomDock ? 'flex-col' : (sidebarDock === 'left' ? 'flex-row-reverse' : 'flex-row');
    const borderClass = isBottomDock ? 'border-t' : (sidebarDock === 'left' ? 'border-r' : 'border-l');
    const collapsedSize = 24; // 접힌 상태에서의 토글 바 크기
    const effectiveSidebarSize = isSidebarCollapsed ? collapsedSize : sidebarSize;
    const sidebarStyle = isBottomDock
      ? { height: `${effectiveSidebarSize}px`, minHeight: `${effectiveSidebarSize}px`, flexShrink: 0 }
      : { width: `${effectiveSidebarSize}px`, minWidth: `${effectiveSidebarSize}px`, flexShrink: 0 };

    return (
      <div
        ref={(el) => {
          // 두 ref를 동시에 연결
          (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
          (spotlightContainerRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
        }}
        className={`relative overflow-hidden ${className}`}
        style={{
          minHeight: '400px',
          backgroundColor: '#e5e7eb',
        }}
      >
        <div className={`absolute inset-0 flex ${flexDir}`}>
          {/* 메인 스포트라이트 영역 */}
          <div
            className="flex-1 relative overflow-hidden"
            style={{
              cursor: cursorStyle,
              backgroundColor: 'transparent',
            }}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
          >
            {spotlightUser && spotlightHasPage ? (
              <>
                <div
                  className="absolute inset-0 overflow-auto"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '24px',
                  }}
                >
                  <div
                    style={{
                      width: `${canvasWidth * scale}px`,
                      height: `${canvasHeight * scale}px`,
                      transform: `translate(${offset.x}px, ${offset.y}px)`,
                      flexShrink: 0,
                    }}
                  >
                    <div
                      className="relative"
                      style={{
                        transform: `scale(${scale})`,
                        transformOrigin: 'top left',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04), 0 0 0 1px rgba(0,0,0,0.05)',
                        borderRadius: '2px',
                        backgroundColor: '#ffffff',
                        width: `${canvasWidth}px`,
                        height: `${canvasHeight}px`,
                      }}
                    >
                      <BackgroundCanvas
                        pageAddress={spotlightPageAddress}
                        width={canvasWidth}
                        height={canvasHeight}
                        scale={1}
                      />
                      <StrokeCanvas
                        pageAddress={spotlightPageAddress}
                        width={canvasWidth}
                        height={canvasHeight}
                        scale={1}
                        userId={spotlightUser.userId}
                        className="absolute inset-0"
                      />
                      <InputCanvas
                        pageAddress={spotlightPageAddress}
                        width={canvasWidth}
                        height={canvasHeight}
                        scale={scale}
                        userId={spotlightUser.userId}
                        disabled={!inputEnabled || !canDrawSpotlight || !effectivelyStylusOn || spotAnnotationMode}
                      />
                      {/* 첨삭 오버레이 (호스트가 학생 캔버스를 볼 때) */}
                      {canAnnotateSpotlight && (
                        <AnnotationCanvas
                          width={canvasWidth}
                          height={canvasHeight}
                          strokes={spotAnnotations}
                          drawingMode={spotAnnotationMode}
                          onStroke={handleSpotAnnotationStroke}
                          onDrawStart={handleSpotAnnotationDrawStart}
                          className="absolute inset-0 z-10"
                        />
                      )}
                    </div>
                  </div>
                </div>
                {/* 스포트라이트 헤더: 학생 이름 + 실시간/수동 토글 */}
                {spotlightUser && (
                  <div className="absolute top-4 left-4 flex items-center gap-2 z-20">
                    {/* 학생 이름 pill */}
                    <span
                      className="px-3 py-1 rounded-full text-xs font-semibold text-white shadow-lg"
                      style={{ backgroundColor: spotlightUser.color }}
                    >
                      {spotlightUser.userName} · {getLogicalPageNumber(spotlightUser.userId, spotlightPageAddress)}
                    </span>

                    {/* 실시간/수동 토글 (호스트가 다른 학생을 볼 때만) */}
                    {isHost && spotlightUser.userId !== currentUserId && (
                      <div className="flex items-center bg-white/90 backdrop-blur rounded-full shadow-lg p-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            setSpotlightFollowMode('follow');
                            setBrowsePageOverride(null);
                          }}
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all ${
                            spotlightFollowMode === 'follow'
                              ? 'bg-blue-500 text-white'
                              : 'text-gray-500 hover:text-gray-700'
                          }`}
                        >
                          실시간
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSpotlightFollowMode('browse');
                            setBrowsePageOverride(studentLivePage);
                          }}
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all ${
                            spotlightFollowMode === 'browse'
                              ? 'bg-blue-500 text-white'
                              : 'text-gray-500 hover:text-gray-700'
                          }`}
                        >
                          수동
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* 첨삭 토글 버튼 (호스트가 학생 캔버스를 볼 때) */}
                {canAnnotateSpotlight && (
                  <div className="absolute top-4 right-4 flex items-center gap-2 z-20">
                    <button
                      type="button"
                      onClick={() => {
                        const next = !spotAnnotationMode;
                        setSpotAnnotationMode(next);
                        // 첨삭 모드 ON → 자동으로 수동 모드 전환 (페이지 따라가기 방지)
                        if (next) {
                          setSpotlightFollowMode('browse');
                          setBrowsePageOverride(studentLivePage);
                        }
                        if (!next && effectiveSpotlightUserId) {
                          clearAnnotations(effectiveSpotlightUserId);
                        }
                      }}
                      className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold transition-all duration-200 shadow-lg ${
                        spotAnnotationMode
                          ? 'bg-gradient-to-r from-red-500 to-rose-500 text-white'
                          : 'bg-white/90 backdrop-blur border-2 border-app-border text-brand-primary hover:bg-brand-tint'
                      }`}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                      {spotAnnotationMode ? '첨삭 중' : '첨삭'}
                    </button>
                    {spotAnnotationMode && (
                      <button
                        type="button"
                        onClick={() => effectiveSpotlightUserId && clearAnnotations(effectiveSpotlightUserId)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold bg-white/90 backdrop-blur border-2 border-app-border text-slate-500 hover:text-brand-primary hover:bg-brand-tint transition-all duration-200 shadow-lg"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        지우기
                      </button>
                    )}
                  </div>
                )}
              </>
            ) : spotlightUser ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                  <button
                    onClick={() => handleAddPageForUser(spotlightUser.userId)}
                    className="flex flex-col items-center justify-center gap-2 p-6 rounded-xl bg-white/80 hover:bg-white shadow-md hover:shadow-lg transition-all"
                  >
                    <svg className="w-12 h-12 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span className="text-sm font-medium text-gray-700">{t('canvas.addPageButton')}</span>
                  </button>
                </div>
              </div>
            ) : null}

            {/* 스포트라이트 사용자 이름 + 페이지 표시 */}
            {spotlightUser && (
              <div className="absolute top-4 left-4 flex items-center gap-2">
                <div
                  className="flex items-center gap-2 px-3 py-1 rounded-full text-white text-sm font-medium shadow-sm"
                  style={{ backgroundColor: spotlightUser.color }}
                >
                  <span>{spotlightUser.userName}</span>
                </div>
                <div className="bg-white/90 px-3 py-1 rounded-full text-sm text-gray-600 shadow-sm">
                  {formatPageAddress(spotlightPageAddress)}
                </div>
              </div>
            )}

            {/* 호스트: 주목 공유 끄기 버튼 */}
            {isHost && spotlightShareUserId && (
              <button
                onClick={handleSpotlightUnshare}
                className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-full shadow-lg transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                {t('canvas.stopSpotlightShare')}
              </button>
            )}

            {/* 게스트: 주목 공유 중 표시 */}
            {!isHost && spotlightShareUserId && (
              <div className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 text-white text-sm font-medium rounded-full shadow-lg">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" />
                </svg>
                {t('canvas.spotlightSharing')}
              </div>
            )}

            {/* 뷰 모드 토글 버튼 (캔버스 영역 우하단) */}
            <button
              onClick={handleToggleViewMode}
              className="absolute bottom-4 right-4 bg-white/90 hover:bg-white px-3 py-1.5 rounded-full text-sm text-gray-600 shadow-sm hover:shadow transition-all flex items-center gap-1.5"
              title={t('canvas.gridView')}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
              <span>{t('canvas.gridView')}</span>
            </button>
          </div>

          {/* 사이드바 */}
          <div
            className={`flex ${isBottomDock ? 'flex-row' : 'flex-col'} ${borderClass} border-gray-300 bg-gray-100 transition-all duration-200`}
            style={sidebarStyle}
          >
            {/* 드래그 핸들 + 접기/펼치기 토글 */}
            <div
              className={`flex-shrink-0 flex items-center justify-center select-none ${
                isBottomDock ? 'w-5 border-r border-gray-300' : 'h-5 border-b border-gray-300'
              }`}
            >
              {/* 드래그 핸들 (접혀있지 않을 때만) */}
              {!isSidebarCollapsed && (
                <div
                  className="cursor-grab active:cursor-grabbing flex-1 flex items-center justify-center"
                  onMouseDown={handleSidebarDragStart}
                  title="Drag to reposition"
                >
                  {isBottomDock ? (
                    <svg className="w-3 h-4 text-gray-400" viewBox="0 0 6 10" fill="currentColor">
                      <circle cx="1.5" cy="1.5" r="1" /><circle cx="4.5" cy="1.5" r="1" />
                      <circle cx="1.5" cy="5" r="1" /><circle cx="4.5" cy="5" r="1" />
                      <circle cx="1.5" cy="8.5" r="1" /><circle cx="4.5" cy="8.5" r="1" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-3 text-gray-400" viewBox="0 0 10 6" fill="currentColor">
                      <circle cx="1.5" cy="1.5" r="1" /><circle cx="5" cy="1.5" r="1" /><circle cx="8.5" cy="1.5" r="1" />
                      <circle cx="1.5" cy="4.5" r="1" /><circle cx="5" cy="4.5" r="1" /><circle cx="8.5" cy="4.5" r="1" />
                    </svg>
                  )}
                </div>
              )}
              {/* 접기/펼치기 버튼 */}
              <button
                onClick={() => setIsSidebarCollapsed((prev) => !prev)}
                className={`flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors ${
                  isSidebarCollapsed ? 'flex-1' : ''
                } ${isBottomDock ? 'px-0.5' : 'py-0.5'}`}
                title={isSidebarCollapsed ? 'Expand' : 'Collapse'}
              >
                {/* 화살표 방향: 접힌 상태→펼침 방향, 펼친 상태→접힘 방향 */}
                {isBottomDock ? (
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d={isSidebarCollapsed ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'} />
                  </svg>
                ) : sidebarDock === 'right' ? (
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d={isSidebarCollapsed ? 'M15 19l-7-7 7-7' : 'M9 5l7 7-7 7'} />
                  </svg>
                ) : (
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d={isSidebarCollapsed ? 'M9 5l7 7-7 7' : 'M15 19l-7-7 7-7'} />
                  </svg>
                )}
              </button>
            </div>

            {/* 사이드바 콘텐츠 (접히지 않았을 때만 표시) */}
            {!isSidebarCollapsed && (
              <>
                {/* 호스트 썸네일 (고정) */}
                {hostUser && (
                  <div className={`flex-shrink-0 ${isBottomDock ? 'p-1 border-r border-gray-300' : 'p-2 border-b border-gray-300'}`}>
                    {renderThumbnailCard(hostUser)}
                  </div>
                )}

                {/* 나머지 참가자 썸네일 (스크롤 가능) */}
                <div className={`flex-1 ${
                  isBottomDock
                    ? 'overflow-x-auto overflow-y-hidden flex flex-row gap-1 p-1 items-start'
                    : 'overflow-y-auto p-2 space-y-2'
                }`}>
                  {otherUsers.map((user) => renderThumbnailCard(user))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* 드래그 중 드롭 존 표시 */}
        {isDraggingSidebar && (
          <>
            <div className={`absolute left-0 top-0 bottom-0 transition-colors pointer-events-none ${
              dragTarget === 'left' ? 'bg-blue-400/40' : 'bg-blue-200/20'
            }`} style={{ width: `${sidebarSize}px` }} />
            <div className={`absolute right-0 top-0 bottom-0 transition-colors pointer-events-none ${
              dragTarget === 'right' ? 'bg-blue-400/40' : 'bg-blue-200/20'
            }`} style={{ width: `${sidebarSize}px` }} />
            <div className={`absolute left-0 right-0 bottom-0 transition-colors pointer-events-none ${
              dragTarget === 'bottom' ? 'bg-blue-400/40' : 'bg-blue-200/20'
            }`} style={{ height: `${sidebarSize}px` }} />
          </>
        )}

        {/* 컨텍스트 메뉴 (호스트만) */}
        {isHost && contextMenu.isOpen && (
          <CanvasContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            userName={contextMenu.userName}
            userId={contextMenu.userId}
            isHost={isHost}
            isSmartpenTarget={smartpenTargetUserId === contextMenu.userId}
            onSmartpenInput={handleSmartpenInput}
            onPromoteToHost={handlePromoteToHost}
            onKick={handleKickParticipant}
            onSpotlightShare={handleSpotlightShare}
            onClose={handleContextMenuClose}
          />
        )}
      </div>
    );
  }

  // 그리드 뷰 렌더링
  if (isGridView) {
    return (
      <div
        ref={containerRef}
        className={`relative overflow-hidden ${className}`}
        style={{
          minHeight: '400px',
          backgroundColor: '#e5e7eb',
        }}
      >
        {/* 그리드 레이아웃 */}
        <div
          className="absolute inset-0 p-4 overflow-auto"
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${gridLayout.cols}, 1fr)`,
            gridTemplateRows: `repeat(${gridLayout.rows}, 1fr)`,
            gap: '8px',
          }}
        >
          {gridUsers.slice(0, gridLayout.cols * gridLayout.rows).map((user) => {
            const isActive = isCanvasActive(user.userId);
            const canDraw = isHost || user.userId === currentUserId;
            // 이 사용자가 현재 보고 있는 페이지 (자신이면 글로벌, 타인이면 추적된 페이지)
            const userPageAddress = user.userId === currentUserId
              ? pageAddress
              : participantCurrentPages.get(user.userId) ?? pageAddress;
            // 해당 페이지를 이 사용자가 소유하고 있는지 확인
            const userHasPage = pages.some(
              (p) => isSamePageAddress(p.address, userPageAddress) && p.ownerUserId === user.userId
            );
            // 스마트펜 타겟 여부
            const isSmartpenTarget = isSmartpenTargetCanvas(user.userId);
            // 스마트펜 펜 색상 (호스트가 게스트에 쓸 때 사용)
            const smartpenColor = user.userId !== currentUserId
              ? `#${(guestInputSettings.penColor & 0xffffff).toString(16).padStart(6, '0')}`
              : '#ff0000';

            return (
              <div
                key={user.userId}
                className={`flex flex-col rounded-lg shadow overflow-hidden transition-all ${isActive
                  ? 'ring-4 ring-blue-500 ring-offset-2 bg-blue-50'
                  : flashingUsers.has(user.userId)
                    ? 'ring-2 ring-amber-400 bg-white'
                    : userHasPage
                      ? 'bg-white hover:ring-2 hover:ring-blue-300'
                      : 'bg-gray-200 hover:ring-2 hover:ring-gray-400'
                  }`}
                onClick={(e) => userHasPage ? handleCanvasClick(e, user.userId) : undefined}
                onContextMenu={(e) => handleContextMenu(e, user.userId, user.userName)}
              >
                {/* 사용자 라벨 */}
                <div
                  className="flex items-center justify-between px-2 py-1 text-white text-sm font-medium"
                  style={{ backgroundColor: userHasPage ? user.color : '#9ca3af' }}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="truncate">{user.userName}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 transition-all ${
                      flashingUsers.has(user.userId)
                        ? 'bg-white/70 text-gray-800 animate-[badgePop_0.5s_ease]'
                        : 'bg-white/30 text-white'
                    }`}>
                      {getLogicalPageNumber(user.userId, userPageAddress)}
                    </span>
                    {mockPenConnected(user.userId) && (
                      <svg className="w-3 h-3 opacity-75 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    )}
                  </div>
                  {isSmartpenTarget && (
                    <span
                      className="ml-1 px-1.5 py-0.5 rounded text-xs flex items-center gap-1"
                      style={{ backgroundColor: smartpenColor }}
                      title="Smartpen Input Target"
                    >
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                      </svg>
                    </span>
                  )}
                  {isActive && userHasPage && !isSmartpenTarget && (
                    <span className="ml-1 px-1.5 py-0.5 bg-white/30 rounded text-xs">
                      {t('canvas.active')}
                    </span>
                  )}
                  {!userHasPage && (
                    <span className="ml-1 px-1.5 py-0.5 bg-white/30 rounded text-xs">
                      {t('canvas.noPage')}
                    </span>
                  )}
                </div>

                {/* 캔버스 영역 */}
                <div className="flex-1 flex items-center justify-center bg-gray-100 p-1">
                  {userHasPage ? (
                    // 페이지 소유: 정상 캔버스 표시
                    <div
                      className="relative bg-white shadow-sm"
                      style={{
                        width: `${gridCellSize.width}px`,
                        height: `${gridCellSize.height}px`,
                      }}
                    >
                      {/* PDF 배경 캔버스 */}
                      <BackgroundCanvas
                        pageAddress={userPageAddress}
                        width={gridCellSize.width}
                        height={gridCellSize.height}
                        scale={1}
                      />

                      <StrokeCanvas
                        pageAddress={userPageAddress}
                        width={gridCellSize.width}
                        height={gridCellSize.height}
                        scale={1}
                        userId={user.userId}
                        className="absolute inset-0"
                      />

                      {/* 입력 캔버스 (활성 캔버스에서만 입력 가능) */}
                      <InputCanvas
                        pageAddress={userPageAddress}
                        width={gridCellSize.width}
                        height={gridCellSize.height}
                        scale={1}
                        userId={user.userId}
                        disabled={!inputEnabled || !isActive || !canDraw || !effectivelyStylusOn}
                      />

                      {/* 비활성 캔버스: 활성화 안내 (아무 캔버스도 활성화되지 않은 경우만) */}
                      {!isActive && !effectiveActiveUserId && (
                        <div
                          className="absolute inset-0 flex items-center justify-center"
                          style={{ pointerEvents: 'none' }}
                        >
                          <span className="text-gray-500 text-sm bg-white/90 px-2 py-1 rounded shadow-sm">
                            {t('canvas.clickToActivate')}
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    // 페이지 미소유: (+) 버튼 표시
                    <div
                      className="relative flex items-center justify-center bg-gray-200 rounded-lg border-2 border-dashed border-gray-400"
                      style={{
                        width: `${gridCellSize.width}px`,
                        height: `${gridCellSize.height}px`,
                      }}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddPageForUser(user.userId);
                        }}
                        className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-white/80 hover:bg-white shadow-md hover:shadow-lg transition-all"
                        title={`${user.userName}에게 이 페이지 추가`}
                      >
                        <svg
                          className="w-10 h-10 text-green-600"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 4v16m8-8H4"
                          />
                        </svg>
                        <span className="text-sm font-medium text-gray-700">
                          {t('canvas.addPageButton')}
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* 빈 셀 채우기 (그리드 정렬용) */}
          {Array.from({
            length: Math.max(0, gridLayout.cols * gridLayout.rows - gridUsers.length),
          }).map((_, index) => (
            <div
              key={`empty-${index}`}
              className="bg-gray-200 rounded-lg opacity-30"
            />
          ))}
        </div>

        {/* 그리드 정보 + 뷰 모드 토글 */}
        <div className="absolute bottom-4 right-4 flex items-center gap-2">
          <button
            onClick={() => setIsGridSelectorOpen(true)}
            className="bg-white/90 hover:bg-white px-3 py-1 rounded-full text-sm text-gray-600 shadow-sm hover:shadow transition-all cursor-pointer"
          >
            {gridLayout.cols} x {gridLayout.rows} ({gridUsers.length}명)
          </button>
          <button
            onClick={handleToggleViewMode}
            className="bg-white/90 hover:bg-white px-3 py-1.5 rounded-full text-sm text-gray-600 shadow-sm hover:shadow transition-all flex items-center gap-1.5"
            title={t('canvas.spotlightView')}
          >
            {/* Spotlight 아이콘 (1 large + 2 small) */}
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <rect x="2" y="2" width="10" height="16" rx="1" />
              <rect x="14" y="2" width="4" height="7" rx="1" />
              <rect x="14" y="11" width="4" height="7" rx="1" />
            </svg>
            <span>{t('canvas.spotlightView')}</span>
          </button>
        </div>

        {/* 컨텍스트 메뉴 (호스트만) */}
        {isHost && contextMenu.isOpen && (
          <CanvasContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            userName={contextMenu.userName}
            userId={contextMenu.userId}
            isHost={isHost}
            isSmartpenTarget={smartpenTargetUserId === contextMenu.userId}
            onSmartpenInput={handleSmartpenInput}
            onPromoteToHost={handlePromoteToHost}
            onKick={handleKickParticipant}
            onSpotlightShare={handleSpotlightShare}
            onClose={handleContextMenuClose}
          />
        )}

        {/* 그리드 선택 팝업 */}
        <GridSelector
          isOpen={isGridSelectorOpen}
          onClose={() => setIsGridSelectorOpen(false)}
          onSelect={setGridLayout}
          onAutoLayout={resetGridLayout}
        />
      </div>
    );
  }

  // 단일 캔버스 뷰 렌더링
  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden ${className}`}
      style={{
        minHeight: '400px',
        backgroundColor: 'transparent',
        cursor: cursorStyle,
      }}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >
      {/* 스크롤 가능한 캔버스 영역 */}
      <div
        ref={scrollRef}
        className="absolute inset-0 overflow-auto"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '8px',
        }}
      >
        {/* 센터링용 외부 래퍼 - 스케일된 시각적 크기 사용 */}
        <div
          style={{
            width: `${canvasWidth * scale}px`,
            height: `${canvasHeight * scale}px`,
            transform: `translate(${offset.x}px, ${offset.y}px)`,
            flexShrink: 0,
          }}
        >
          {/* 종이 래퍼 (그림자 + 흰색 배경) - 스케일 적용 */}
          <div
            className="relative"
            style={{
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04), 0 0 0 1px rgba(0,0,0,0.05)',
              borderRadius: '2px',
              backgroundColor: '#ffffff',
              width: `${canvasWidth}px`,
              height: `${canvasHeight}px`,
            }}
          >
          {/* PDF 배경 캔버스 */}
          <BackgroundCanvas
            pageAddress={pageAddress}
            width={canvasWidth}
            height={canvasHeight}
            scale={1}
          />

          {/* 스트로크 렌더링 캔버스 */}
          <StrokeCanvas
            pageAddress={pageAddress}
            width={canvasWidth}
            height={canvasHeight}
            scale={1}
            className="absolute inset-0"
          />

          {/* 입력 캔버스 (오버레이) */}
          <InputCanvas
            pageAddress={pageAddress}
            width={canvasWidth}
            height={canvasHeight}
            scale={scale}
            disabled={!inputEnabled || !effectivelyStylusOn}
          />
          </div>
        </div>
      </div>

      {/* 페이지 표시 */}
      <div className="absolute top-4 left-4 bg-white/90 px-3 py-1 rounded-full text-sm text-gray-600 shadow-sm">
        {isMousePage(pageAddress) ? `Page ${pageAddress.page}` : formatPageAddress(pageAddress)}
      </div>

      {/* 스마트펜 타겟 표시 (호스트만, 타겟이 다른 사용자인 경우) */}
      {isHost && smartpenTargetUserId && smartpenTargetUserId !== currentUserId && (() => {
        // 단일 뷰에서 보고 있는 사용자 ID
        const viewedUserId = selectedViewUserIds.length === 1 ? selectedViewUserIds[0] : currentUserId;
        // 현재 보고 있는 캔버스가 스마트펜 타겟인 경우만 표시
        if (viewedUserId !== smartpenTargetUserId) return null;

        const targetUser = session?.participants.find(p => p.userId === smartpenTargetUserId);
        const smartpenColor = `#${(guestInputSettings.penColor & 0xffffff).toString(16).padStart(6, '0')}`;

        return (
          <div
            className="absolute top-4 right-4 flex items-center gap-2 px-3 py-1.5 rounded-full text-white text-sm shadow-lg"
            style={{ backgroundColor: smartpenColor }}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
            </svg>
            <span className="font-medium">{targetUser?.userName}</span>
          </div>
        );
      })()}
    </div>
  );
};

export default CanvasContainer;
