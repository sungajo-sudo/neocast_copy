import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useVoiceStore } from '../../stores/voice-store';
import { voiceService } from '../../services/voice-service';

/**
 * 오디오 설정 탭 (Zoom 스타일)
 * - 마이크 선택 + 레벨 미터
 * - 마이크 테스트 (3초 녹음 → 재생)
 * - 스피커 선택
 * - 스피커 테스트 (440Hz 톤)
 */
export const AudioSettingsTab: React.FC = () => {
  const { t } = useTranslation();

  const inputDevices = useVoiceStore((state) => state.inputDevices);
  const outputDevices = useVoiceStore((state) => state.outputDevices);
  const selectedInputDeviceId = useVoiceStore((state) => state.selectedInputDeviceId);
  const selectedOutputDeviceId = useVoiceStore((state) => state.selectedOutputDeviceId);

  const [micTestLevel, setMicTestLevel] = useState(0);
  const [isMicTesting, setMicTesting] = useState(false);
  const [isSpeakerTesting, setSpeakerTesting] = useState(false);

  const micTestRef = useRef(false);

  // 설정 탭 열릴 때 장치 목록 갱신
  useEffect(() => {
    voiceService.enumerateDevices();
  }, []);

  const handleInputDeviceChange = useCallback(async (e: React.ChangeEvent<HTMLSelectElement>) => {
    await voiceService.switchInputDevice(e.target.value);
  }, []);

  const handleOutputDeviceChange = useCallback(async (e: React.ChangeEvent<HTMLSelectElement>) => {
    await voiceService.switchOutputDevice(e.target.value);
  }, []);

  const handleMicTest = useCallback(async () => {
    if (isMicTesting) return;
    setMicTesting(true);
    micTestRef.current = true;

    try {
      await voiceService.testMicrophone((level) => {
        if (micTestRef.current) {
          setMicTestLevel(level);
        }
      });
    } catch (error) {
      console.error('[AudioSettingsTab] Mic test failed:', error);
    } finally {
      micTestRef.current = false;
      setMicTesting(false);
      setMicTestLevel(0);
    }
  }, [isMicTesting]);

  const handleSpeakerTest = useCallback(async () => {
    if (isSpeakerTesting) return;
    setSpeakerTesting(true);

    try {
      await voiceService.testSpeaker();
    } catch (error) {
      console.error('[AudioSettingsTab] Speaker test failed:', error);
    } finally {
      setSpeakerTesting(false);
    }
  }, [isSpeakerTesting]);

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">
        {t('settings.audioSettings', 'Audio Settings')}
      </h3>

      {/* 마이크 섹션 */}
      <div className="p-4 bg-gray-50 rounded-lg space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
          <label className="text-sm font-medium text-gray-800">
            {t('settings.microphone', 'Microphone')}
          </label>
        </div>

        {/* 마이크 드롭다운 */}
        <select
          value={selectedInputDeviceId}
          onChange={handleInputDeviceChange}
          className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          {inputDevices.length === 0 ? (
            <option value="default">{t('voice.noDevices', 'No microphone detected')}</option>
          ) : (
            inputDevices.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label}
              </option>
            ))
          )}
        </select>

        {/* 레벨 미터 */}
        <div className="space-y-1">
          <span className="text-xs text-gray-500">{t('settings.inputVolume', 'Input Volume')}</span>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all duration-75"
              style={{ width: `${Math.round(micTestLevel * 100)}%` }}
            />
          </div>
        </div>

        {/* 마이크 테스트 */}
        <button
          type="button"
          onClick={handleMicTest}
          disabled={isMicTesting}
          className="w-full py-2.5 px-4 bg-white border border-gray-300 hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400 text-gray-700 rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
        >
          {isMicTesting ? (
            <>
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              {t('voice.micTesting', 'Recording... (3 sec)')}
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
              {t('voice.testMicrophone', 'Test Microphone')}
            </>
          )}
        </button>
      </div>

      {/* 스피커 섹션 */}
      <div className="p-4 bg-gray-50 rounded-lg space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
          </svg>
          <label className="text-sm font-medium text-gray-800">
            {t('settings.speaker', 'Speaker')}
          </label>
        </div>

        {/* 스피커 드롭다운 */}
        <select
          value={selectedOutputDeviceId}
          onChange={handleOutputDeviceChange}
          className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          {outputDevices.length === 0 ? (
            <option value="default">{t('voice.noSpeakers', 'System Default')}</option>
          ) : (
            outputDevices.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label}
              </option>
            ))
          )}
        </select>

        {/* 스피커 테스트 */}
        <button
          type="button"
          onClick={handleSpeakerTest}
          disabled={isSpeakerTesting}
          className="w-full py-2.5 px-4 bg-white border border-gray-300 hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400 text-gray-700 rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
        >
          {isSpeakerTesting ? (
            <>
              <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
              {t('voice.speakerTesting', 'Playing...')}
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
              {t('voice.testSpeaker', 'Test Speaker')}
            </>
          )}
        </button>
      </div>

      {/* 안내 메시지 */}
      <div className="p-4 bg-blue-50 rounded-lg">
        <p className="text-sm text-blue-700">
          {t('settings.audioHint', 'Audio settings will be applied to voice chat when available.')}
        </p>
      </div>
    </div>
  );
};

export default AudioSettingsTab;
