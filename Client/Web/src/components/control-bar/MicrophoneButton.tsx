import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { usePanelStore } from '../../stores/panel-store';
import { useVoiceStore } from '../../stores/voice-store';
import { voiceService } from '../../services/voice-service';
import { useControlBarContext } from './ControlBarContext';

/**
 * 마이크 ON/OFF 버튼 (Zoom 스타일 split button)
 * - 메인 영역: 마이크 토글 (음소거/음소거 해제)
 * - 드롭다운 화살표: 오디오 설정 열기
 */
export const MicrophoneButton: React.FC = () => {
  const { t } = useTranslation();
  const { compact } = useControlBarContext();
  const isMicOn = usePanelStore((state) => state.isMicOn);
  const canTransmit = useVoiceStore((state) => state.canTransmit);
  const error = useVoiceStore((state) => state.error);

  const handleToggle = useCallback(async () => {
    if (!canTransmit) {
      usePanelStore.getState().showToast(
        t('voice.transmitNotAllowed', 'Microphone is disabled by the host.'),
        3000
      );
      return;
    }

    const result = await voiceService.toggleCapture();
    if (!result && useVoiceStore.getState().error) {
      const err = useVoiceStore.getState().error;
      if (err === 'microphone_permission_denied') {
        usePanelStore.getState().showToast(
          t('voice.micPermissionDenied', 'Microphone permission denied. Please allow access in browser settings.'),
          4000
        );
      } else {
        usePanelStore.getState().showToast(
          t('voice.micError', 'Failed to access microphone.'),
          3000
        );
      }
    }
  }, [t, canTransmit]);

  const handleOpenAudioSettings = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    usePanelStore.getState().openSettingsTab('audio');
  }, []);

  const tooltip = !canTransmit
    ? t('voice.transmitNotAllowed', 'Microphone is disabled by the host.')
    : error
      ? t('voice.micError', 'Failed to access microphone.')
      : isMicOn
        ? t('controlBar.muteTip', 'Click to mute')
        : t('controlBar.unmuteTip', 'Click to unmute');

  const micIcon = isMicOn ? (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
    </svg>
  ) : (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
    </svg>
  );

  const isDisabled = !canTransmit;
  const disabledClasses = isDisabled ? 'opacity-50 cursor-not-allowed' : '';

  // 색상 결정 (컨테이너용 - hover 없음)
  const containerColor = isMicOn ? 'text-green-400' : 'text-white/80';
  // 아이콘 영역 hover
  const iconHover = isMicOn ? 'hover:bg-green-500/40' : 'hover:bg-white/10 hover:text-white';
  // 텍스트+▾ 영역 hover
  const labelHover = isMicOn ? 'hover:bg-green-500/40' : 'hover:bg-white/10 hover:text-white';

  if (compact) {
    // 컴팩트 모드: 아이콘만
    return (
      <div className={`relative w-8 h-8 ${disabledClasses}`} title={tooltip}>
        <button
          type="button"
          onClick={isDisabled ? undefined : handleToggle}
          disabled={isDisabled}
          className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200 focus:outline-none ${containerColor} ${iconHover}`}
        >
          <div className="w-5 h-5 flex items-center justify-center">
            {micIcon}
          </div>
        </button>
        {/* 컴팩트 모드에서는 우하단에 작은 화살표 */}
        <button
          type="button"
          onClick={handleOpenAudioSettings}
          className="absolute -bottom-0.5 -right-0.5 flex items-center justify-center w-3 h-3 rounded-sm bg-white/10 hover:bg-white/25 text-white/60 hover:text-white transition-all"
          title={t('settings.audio', 'Audio')}
        >
          <svg className="w-1.5 h-1.5" fill="currentColor" viewBox="0 0 8 5">
            <path d="M0 0l4 5 4-5z" />
          </svg>
        </button>
      </div>
    );
  }

  // 기본 모드: 아이콘 클릭 = 음소거 토글, 텍스트+▾ 클릭 = 오디오 설정
  return (
    <div
      className={`flex flex-col items-center w-[60px] h-[52px] rounded-lg overflow-hidden ${containerColor} ${disabledClasses}`}
      title={tooltip}
    >
      {/* 아이콘 영역 - 음소거 토글 */}
      <div
        className={`w-full flex items-center justify-center flex-1 cursor-pointer rounded-t-lg transition-colors duration-150 ${iconHover}`}
        onClick={isDisabled ? undefined : handleToggle}
      >
        <div className="w-6 h-6 flex items-center justify-center">
          {micIcon}
        </div>
      </div>
      {/* 텍스트 + ▾ 영역 - 오디오 설정 열기 */}
      <div
        className={`w-full flex items-center justify-center gap-0.5 cursor-pointer rounded-b-lg transition-colors duration-150 pb-1 pt-0.5 ${labelHover}`}
        onClick={handleOpenAudioSettings}
        title={t('settings.audio', 'Audio')}
      >
        <span className="text-[10px] font-medium whitespace-nowrap">
          {isMicOn ? t('controlBar.mute', 'Mute') : t('controlBar.unmute', 'Unmute')}
        </span>
        <svg className="w-2 h-1.5" fill="currentColor" viewBox="0 0 8 5">
          <path d="M0 0l4 5 4-5z" />
        </svg>
      </div>
    </div>
  );
};

export default MicrophoneButton;
