import React from 'react';
import { useTranslation } from 'react-i18next';
import { usePanelStore } from '../../stores/panel-store';
import { ControlBarButton } from './ControlBarButton';
import { useControlBarContext } from './ControlBarContext';

/**
 * Stylus ON/OFF 버튼
 * 스타일러스/터치 입력 활성화/비활성화
 * CMD/CTRL 키가 눌려있으면 자동으로 비활성화됨
 */
export const StylusButton: React.FC = () => {
  const { t } = useTranslation();
  const { compact } = useControlBarContext();
  const isStylusOn = usePanelStore((state) => state.isStylusOn);
  const isModifierKeyPressed = usePanelStore((state) => state.isModifierKeyPressed);
  const toggleStylus = usePanelStore((state) => state.toggleStylus);

  // 실제 활성 상태: 사용자 설정 ON && modifier 키 미눌림
  const effectivelyOn = isStylusOn && !isModifierKeyPressed;

  const icon = effectivelyOn ? (
    // 스타일러스 활성화 아이콘
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
    </svg>
  ) : (
    // 스타일러스 비활성화 아이콘
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
    </svg>
  );

  // modifier 키로 임시 비활성화된 경우 별도 표시
  const getLabel = () => {
    if (isModifierKeyPressed && isStylusOn) {
      return t('controlBar.stylusPaused', 'Touch Paused');
    }
    return effectivelyOn ? t('controlBar.stylusOn', 'Touch On') : t('controlBar.stylusOff', 'Touch Off');
  };

  const getTooltip = () => {
    if (isModifierKeyPressed && isStylusOn) {
      return t('controlBar.stylusPausedTip', 'Touch paused while CMD/CTRL is pressed');
    }
    return effectivelyOn
      ? t('controlBar.stylusOnTip', 'Touch input enabled')
      : t('controlBar.stylusOffTip', 'Touch input disabled');
  };

  return (
    <ControlBarButton
      icon={icon}
      label={getLabel()}
      onClick={toggleStylus}
      isActive={effectivelyOn}
      variant={effectivelyOn ? 'success' : isModifierKeyPressed && isStylusOn ? 'warning' : 'default'}
      tooltip={getTooltip()}
      compact={compact}
    />
  );
};

export default StylusButton;
