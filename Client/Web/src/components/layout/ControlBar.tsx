import React, { useRef, useState, useEffect } from 'react';
import { ControlBarContext } from '../control-bar/ControlBarContext';
import {
  SmartpenButton,
  StylusButton,
  MicrophoneButton,
  PagesButton,
  PdfUploadButton,
  MyPapersButton,
  SessionButton,
  ParticipantsButton,
  ChatButton,
  SettingsButton,
  MoreButton,
  LeaveButton,
} from '../control-bar';
import { FEATURE_FLAGS } from '../../utils/feature-flags';

interface ControlBarProps {
  onCopySessionCode?: () => void;
  onCopyInviteLink?: () => void;
}

// 버튼 크기 상수
const BUTTON_DEFAULT_WIDTH = 60; // 기본 버튼 너비
const BUTTON_COMPACT_WIDTH = 32; // 컴팩트 버튼 너비
const GAP_WIDTH = 4; // gap-1 = 4px
const DIVIDER_WIDTH = 24; // 구분선 너비
const PADDING_WIDTH = 32; // px-4 양쪽 = 32px

// 전체 버튼 (12개) + 구분선 (3개)
const ALL_BUTTON_COUNT = 12;
const ALL_DIVIDER_COUNT = 3;

/**
 * 하단 컨트롤 바
 * Zoom 스타일의 세션 컨트롤 바
 *
 * 레이아웃:
 * [왼쪽 정렬] Smartpen | Stylus | Mic || Pages | Upload | My Materials || Session | Participants | Chat || Settings | More
 * [오른쪽 정렬] Leave
 *
 * 반응형:
 * - 기본 모드: 60x52 버튼 (아이콘 + 라벨)
 * - 컴팩트 모드: 32x32 버튼 (아이콘 + 배지만)
 * - 매우 좁은 화면: 필수 버튼만 표시, 나머지는 More 메뉴에
 *
 * 필수 버튼: Smartpen, Stylus, Mic, Pages, Participants, Chat, More, Leave
 * 비필수 버튼 (More 메뉴로 이동): Upload, My Materials, Session, Settings
 */
export const ControlBar: React.FC<ControlBarProps> = ({
  onCopySessionCode,
  onCopyInviteLink,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);
  const [showAllButtons, setShowAllButtons] = useState(true);

  // 컨테이너 크기 감지 및 모드 결정
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const checkSize = () => {
      const containerWidth = container.offsetWidth;

      // 기본 모드 (60px 버튼)에 필요한 최소 폭
      const defaultModeWidth =
        ALL_BUTTON_COUNT * BUTTON_DEFAULT_WIDTH +
        (ALL_BUTTON_COUNT - 1) * GAP_WIDTH +
        ALL_DIVIDER_COUNT * DIVIDER_WIDTH +
        PADDING_WIDTH;

      // 컴팩트 모드 (32px 버튼)에서 전체 버튼을 표시하는 데 필요한 최소 폭
      const compactAllButtonsWidth =
        ALL_BUTTON_COUNT * BUTTON_COMPACT_WIDTH +
        (ALL_BUTTON_COUNT - 1) * GAP_WIDTH +
        ALL_DIVIDER_COUNT * DIVIDER_WIDTH +
        PADDING_WIDTH;

      // 모드 결정
      if (containerWidth >= defaultModeWidth) {
        // 기본 모드, 전체 버튼 표시
        setCompact(false);
        setShowAllButtons(true);
      } else if (containerWidth >= compactAllButtonsWidth) {
        // 컴팩트 모드, 전체 버튼 표시
        setCompact(true);
        setShowAllButtons(true);
      } else {
        // 컴팩트 모드, 필수 버튼만 표시
        setCompact(true);
        setShowAllButtons(false);
      }
    };

    checkSize();

    const resizeObserver = new ResizeObserver(checkSize);
    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, []);

  return (
    <ControlBarContext.Provider value={{ compact, showAllButtons }}>
      <div className="relative z-30 flex-shrink-0" ref={containerRef}>
        {/* 컨트롤 바 컨테이너 */}
        <div className="bg-gray-900/90 backdrop-blur-md border-t border-white/10">
          <div className="flex items-center justify-between px-4 pt-0.5 pb-1">
            {/* 왼쪽 정렬 그룹 */}
            <div className="flex items-center gap-1">
              {/* 펜 입력 그룹: Smartpen, Stylus, Mic */}
              <SmartpenButton />
              <StylusButton />
              {FEATURE_FLAGS.VOICE_ENABLED && <MicrophoneButton />}

              {/* 구분선 */}
              <div className={`w-px ${compact ? 'h-6' : 'h-8'} bg-white/20 mx-2`} />

              {/* 문서 그룹: Pages(필수), Upload(비필수), My Materials(비필수) */}
              <PagesButton />
              {showAllButtons && <PdfUploadButton />}
              {showAllButtons && <MyPapersButton />}

              {/* 구분선 - showAllButtons일 때만 표시 */}
              {showAllButtons && (
                <div className={`w-px ${compact ? 'h-6' : 'h-8'} bg-white/20 mx-2`} />
              )}

              {/* 세션/소통 그룹: Session(비필수), Participants(필수), Chat(필수) */}
              {showAllButtons && (
                <SessionButton
                  onCopySessionCode={onCopySessionCode}
                  onCopyInviteLink={onCopyInviteLink}
                />
              )}
              <ParticipantsButton />
              <ChatButton />

              {/* 구분선 */}
              <div className={`w-px ${compact ? 'h-6' : 'h-8'} bg-white/20 mx-2`} />

              {/* 설정 그룹: Settings(비필수), More(필수) */}
              {showAllButtons && <SettingsButton />}
              <MoreButton
                onCopySessionCode={onCopySessionCode}
                onCopyInviteLink={onCopyInviteLink}
              />
            </div>

            {/* 오른쪽 정렬: Leave (필수) */}
            <div className="flex items-center">
              <LeaveButton />
            </div>
          </div>
        </div>
      </div>
    </ControlBarContext.Provider>
  );
};

export default ControlBar;
