import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { usePanelStore } from '../../stores/panel-store';
import { usePenStore } from '../../stores/pen-store';
import { useSettingsStore } from '../../stores/settings-store';
import { useAlert } from '../../contexts/AlertContext';
import { AudioSettingsTab } from '../settings/AudioSettingsTab';

type SettingsTab = 'smartpen' | 'ncode' | 'audio';

/**
 * 설정 모달
 */
export const SettingsModal: React.FC = () => {
  const { t } = useTranslation();
  const { showConfirm } = useAlert();
  const isSettingsOpen = usePanelStore((state) => state.isSettingsOpen);
  const settingsInitialTab = usePanelStore((state) => state.settingsInitialTab);
  const setSettingsOpen = usePanelStore((state) => state.setSettingsOpen);
  const [activeTab, setActiveTab] = useState<SettingsTab>('smartpen');

  // 외부에서 특정 탭으로 열기 요청 시
  useEffect(() => {
    if (isSettingsOpen && settingsInitialTab) {
      setActiveTab(settingsInitialTab as SettingsTab);
    }
  }, [isSettingsOpen, settingsInitialTab]);

  // 스마트펜 정보
  const penIsConnected = usePenStore((state) => state.isConnected);
  const penIsConnecting = usePenStore((state) => state.isConnecting);
  const penDeviceName = usePenStore((state) => state.deviceName);
  const penBattery = usePenStore((state) => state.battery);
  const penFirmwareVersion = usePenStore((state) => state.firmwareVersion);
  const connect = usePenStore((state) => state.connect);
  const disconnect = usePenStore((state) => state.disconnect);

  // NCode 설정
  const printInBlue = useSettingsStore((state) => state.printInBlue);
  const ncodeGlyphScale = useSettingsStore((state) => state.ncodeGlyphScale);
  const setPrintInBlue = useSettingsStore((state) => state.setPrintInBlue);
  const setNcodeGlyphScale = useSettingsStore((state) => state.setNcodeGlyphScale);
  const resetToDefaults = useSettingsStore((state) => state.resetToDefaults);

  if (!isSettingsOpen) {
    return null;
  }

  const handleClose = () => {
    setSettingsOpen(false);
  };

  const handleConnectPen = async () => {
    try {
      await connect();
    } catch (error) {
      console.error('Failed to connect pen:', error);
    }
  };

  const handleDisconnectPen = async () => {
    try {
      await disconnect();
    } catch (error) {
      console.error('Failed to disconnect pen:', error);
    }
  };

  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    {
      id: 'smartpen',
      label: t('settings.smartpen', 'Smart Pen'),
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
      ),
    },
    {
      id: 'ncode',
      label: t('settings.ncode', 'NCode'),
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
        </svg>
      ),
    },
    {
      id: 'audio',
      label: t('settings.audio', 'Audio'),
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 배경 오버레이 */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* 모달 */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col animate-in fade-in zoom-in duration-200">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-800">
            {t('settings.title', 'Settings')}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 본문 */}
        <div className="flex flex-1 overflow-hidden">
          {/* 사이드바 탭 */}
          <div className="w-48 border-r border-gray-200 p-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                  activeTab === tab.id
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {tab.icon}
                <span className="font-medium">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* 콘텐츠 영역 */}
          <div className="flex-1 p-6 overflow-y-auto">
            {/* 스마트펜 설정 */}
            {activeTab === 'smartpen' && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">
                  {t('settings.penManagement', 'Smart Pen Management')}
                </h3>

                {penIsConnected ? (
                  // 펜이 연결된 경우
                  <div className="space-y-4">
                    {/* 연결된 펜 정보 */}
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                          <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                            <span className="font-medium text-green-700">
                              {t('pen.connected', 'Connected')}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">
                            {penDeviceName || 'Neo Smartpen'}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm">
                        {penBattery >= 0 && (
                          <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            <span className="text-gray-600">
                              {t('pen.battery', 'Battery')}: <span className="font-medium">{penBattery}%</span>
                            </span>
                          </div>
                        )}
                        {penFirmwareVersion && (
                          <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                            </svg>
                            <span className="text-gray-600">
                              {t('pen.firmware', 'Firmware')}: <span className="font-medium">{penFirmwareVersion}</span>
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 연결 해제 버튼 */}
                    <button
                      type="button"
                      onClick={handleDisconnectPen}
                      className="w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                      </svg>
                      {t('pen.disconnect', 'Disconnect')}
                    </button>
                  </div>
                ) : (
                  // 펜이 연결되지 않은 경우
                  <div className="space-y-4">
                    <div className="p-8 bg-gray-50 rounded-lg text-center">
                      <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </div>
                      <p className="text-gray-600 mb-4">
                        {t('pen.notConnected', 'No pen connected')}
                      </p>
                      <button
                        type="button"
                        onClick={handleConnectPen}
                        disabled={penIsConnecting}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white rounded-lg transition-colors"
                      >
                        {penIsConnecting ? (
                          <>
                            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            {t('pen.connecting', 'Connecting...')}
                          </>
                        ) : (
                          <>
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M14.88 10.12a3 3 0 1 0-4.24-4.24L2.88 13.64a3 3 0 0 0 0 4.24l4.24 4.24a3 3 0 0 0 4.24 0l7.76-7.76a3 3 0 0 0 0-4.24l-4.24-4.24z"/>
                            </svg>
                            {t('pen.connectButton', 'Connect Pen')}
                          </>
                        )}
                      </button>
                    </div>

                    <div className="p-4 bg-blue-50 rounded-lg">
                      <p className="text-sm text-blue-700">
                        {t('pen.connectionHint', 'Turn on your Neo Smartpen and click the Connect button. Make sure Bluetooth is enabled on your device.')}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 오디오 설정 */}
            {activeTab === 'audio' && <AudioSettingsTab />}

            {/* NCode 설정 */}
            {activeTab === 'ncode' && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">
                  {t('settings.ncodeSettings', 'NCode Settings')}
                </h3>

                {/* Print in Blue Toggle */}
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-800">
                        {t('settings.printInBlue', 'Print in Blue')}
                      </label>
                      <p className="text-sm text-gray-500 mt-1">
                        {t('settings.printInBlueDesc', 'Convert document lines to blue for blueprint-style printing')}
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer ml-4">
                      <input
                        type="checkbox"
                        checked={printInBlue}
                        onChange={(e) => setPrintInBlue(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
                    </label>
                  </div>
                </div>

                {/* NCode Glyph Scale Slider */}
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-800">
                      {t('settings.ncodeGlyphScale', 'NCode Glyph Scale')}
                    </label>
                    <p className="text-sm text-gray-500 mt-1">
                      {t('settings.ncodeGlyphScaleDesc', 'Adjust the size of NCode patterns (0.1 ~ 2.0)')}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min="0.1"
                      max="2.0"
                      step="0.1"
                      value={ncodeGlyphScale}
                      onChange={(e) => setNcodeGlyphScale(parseFloat(e.target.value))}
                      className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                    <span className="w-12 text-center text-sm font-medium text-gray-700 bg-white px-2 py-1 rounded border border-gray-200">
                      {ncodeGlyphScale.toFixed(1)}
                    </span>
                  </div>
                  {/* Scale 시각적 힌트 */}
                  <div className="flex justify-between text-xs text-gray-400 mt-2 px-1">
                    <span>{t('settings.smaller', 'Smaller')}</span>
                    <span>{t('settings.default', 'Default (1.0)')}</span>
                    <span>{t('settings.larger', 'Larger')}</span>
                  </div>
                </div>

                {/* Reset to Defaults */}
                <div className="pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={async () => {
                      if (await showConfirm(t('settings.resetSettingsConfirm', 'Reset all NCode settings to default values?'))) {
                        resetToDefaults();
                      }
                    }}
                    className="w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    {t('settings.resetSettings', 'Reset to Defaults')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
