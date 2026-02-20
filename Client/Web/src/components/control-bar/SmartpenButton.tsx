import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { usePenStore, formatPageAddress } from '../../stores/pen-store';
import { useStrokeStore } from '../../stores/stroke-store';
import { PenType } from '../../types';
import { ControlBarButton } from './ControlBarButton';
import { useControlBarContext } from './ControlBarContext';

// 색상 팔레트
const COLOR_PRESETS = [
  { name: 'Black', value: 0xff000000 },
  { name: 'Red', value: 0xffff0000 },
  { name: 'Blue', value: 0xff0000ff },
  { name: 'Green', value: 0xff00aa00 },
  { name: 'Yellow', value: 0xffffff00 },
  { name: 'Orange', value: 0xffff8800 },
  { name: 'Purple', value: 0xff8800ff },
  { name: 'Pink', value: 0xffff00ff },
];

// 두께 프리셋 (mm)
const THICKNESS_PRESETS = [
  { name: 'Fine', value: 0.3 },
  { name: 'Medium', value: 0.5 },
  { name: 'Thick', value: 1.0 },
  { name: 'Bold', value: 2.0 },
];

/**
 * ARGB를 CSS 색상으로 변환
 */
const argbToCss = (argb: number): string => {
  const r = (argb >> 16) & 0xff;
  const g = (argb >> 8) & 0xff;
  const b = argb & 0xff;
  return `rgb(${r}, ${g}, ${b})`;
};

/**
 * Smartpen 연결 버튼 (컨트롤 바용)
 * - 미연결: 클릭하면 연결 시도
 * - 연결됨: 클릭하면 드롭다운 메뉴 표시
 */
export const SmartpenButton: React.FC = () => {
  const { t } = useTranslation();
  const { compact } = useControlBarContext();
  const {
    isAvailable,
    isConnecting,
    isConnected,
    isAuthenticated,
    needsPassword,
    passwordRetryCount,
    passwordMaxRetryCount,
    deviceName,
    macAddress,
    battery,
    currentPenPageAddress,
    checkAvailability,
    connect,
    disconnect,
    inputPassword,
  } = usePenStore();

  // 스마트펜 스트로크 설정
  const smartpenSettings = useStrokeStore((state) => state.smartpenSettings);
  const setSmartpenColor = useStrokeStore((state) => state.setSmartpenColor);
  const setSmartpenThickness = useStrokeStore((state) => state.setSmartpenThickness);
  const setSmartpenType = useStrokeStore((state) => state.setSmartpenType);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [password, setPassword] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    checkAvailability();
  }, [checkAvailability]);

  // 메뉴 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen]);

  const handleClick = async () => {
    if (!isAvailable) return;

    if (!isConnected && !isConnecting) {
      await connect();
    } else {
      setIsMenuOpen(!isMenuOpen);
    }
  };

  const handleDisconnect = async () => {
    await disconnect();
    setIsMenuOpen(false);
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password) {
      inputPassword(password);
      setPassword('');
    }
  };

  // 상태에 따른 라벨
  const getLabel = () => {
    if (!isAvailable) return t('pen.notAvailable', 'N/A');
    if (isConnecting) return t('pen.connecting', 'Connecting...');
    if (isConnected && isAuthenticated) return deviceName?.slice(0, 8) || t('pen.ready', 'Ready');
    if (isConnected) return t('pen.authenticating', 'Auth...');
    return t('controlBar.smartpen', 'Smartpen');
  };

  // 상태에 따른 variant
  const getVariant = (): 'default' | 'success' => {
    if (isConnected && isAuthenticated) return 'success';
    return 'default';
  };

  const icon = (
    <div className="relative">
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
      </svg>
      {/* 상태 도트 */}
      <div
        className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ${
          !isAvailable ? 'bg-gray-400' :
          isConnecting ? 'bg-yellow-500 animate-pulse' :
          isConnected && isAuthenticated ? 'bg-green-500' :
          isConnected ? 'bg-yellow-500' :
          'bg-gray-400'
        }`}
      />
    </div>
  );

  if (!isAvailable) return null;

  return (
    <div className="relative" ref={menuRef}>
      <ControlBarButton
        icon={icon}
        label={getLabel()}
        onClick={handleClick}
        isActive={isConnected}
        variant={getVariant()}
        tooltip={isConnected ? t('pen.penSettings', 'Pen Settings') : t('pen.connectButton', 'Connect Pen')}
        compact={compact}
      />

      {/* 드롭다운 메뉴 - 팝업의 왼쪽 아래 모서리가 버튼의 왼쪽 위 모서리에 위치 */}
      {isMenuOpen && isConnected && (
        <div className="absolute bottom-full left-0 mb-1 w-72 bg-white/95 backdrop-blur-xl rounded-lg shadow-lg border border-gray-200/50 py-2 z-50">
          {/* 펜 설정 (인증 완료 후에만 표시) */}
          {isAuthenticated && (
            <div className="px-4 py-3 border-b border-gray-100">
              {/* 펜 타입 선택 */}
              <div className="mb-3">
                <label className="block text-xs font-medium text-gray-500 mb-1.5">{t('pen.penType', 'Pen Type')}</label>
                <div className="flex space-x-1">
                  <button
                    onClick={() => setSmartpenType(PenType.Pen)}
                    className={`flex-1 py-1.5 rounded text-xs font-medium transition-colors ${smartpenSettings.penType === PenType.Pen
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                  >
                    {t('pen.pen', 'Pen')}
                  </button>
                  <button
                    onClick={() => setSmartpenType(PenType.Highlighter)}
                    className={`flex-1 py-1.5 rounded text-xs font-medium transition-colors ${smartpenSettings.penType === PenType.Highlighter
                      ? 'bg-yellow-400 text-gray-900'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                  >
                    {t('pen.highlighter', 'Highlighter')}
                  </button>
                  <button
                    onClick={() => setSmartpenType(PenType.Eraser)}
                    className={`flex-1 py-1.5 rounded text-xs font-medium transition-colors ${smartpenSettings.penType === PenType.Eraser
                      ? 'bg-gray-700 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                  >
                    {t('pen.eraser', 'Eraser')}
                  </button>
                </div>
              </div>

              {/* 색상 선택 (Eraser 아닐 때만) */}
              {smartpenSettings.penType !== PenType.Eraser && (
                <div className="mb-3">
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">{t('pen.color', 'Color')}</label>
                  <div className="flex flex-wrap gap-1.5">
                    {COLOR_PRESETS.map((color) => (
                      <button
                        key={color.name}
                        onClick={() => setSmartpenColor(color.value)}
                        className={`w-7 h-7 rounded-full border-2 transition-transform ${smartpenSettings.penColor === color.value
                          ? 'border-blue-500 scale-110'
                          : 'border-gray-300 hover:scale-105'
                          }`}
                        style={{ backgroundColor: argbToCss(color.value) }}
                        title={color.name}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* 두께 선택 */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">{t('pen.thickness', 'Thickness')}</label>
                <div className="flex space-x-1 mb-2">
                  {THICKNESS_PRESETS.map((preset) => (
                    <button
                      key={preset.name}
                      onClick={() => setSmartpenThickness(preset.value)}
                      className={`flex-1 py-1 rounded text-xs font-medium transition-colors ${smartpenSettings.penThickness === preset.value
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="5"
                  step="0.1"
                  value={smartpenSettings.penThickness}
                  onChange={(e) => setSmartpenThickness(parseFloat(e.target.value))}
                  className="w-full h-1.5"
                />
                <div className="text-center text-xs text-gray-500 mt-0.5">
                  {smartpenSettings.penThickness.toFixed(1)} mm
                </div>
              </div>
            </div>
          )}

          {/* 디바이스 정보 */}
          <div className="px-4 py-2 border-b border-gray-100">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-3 h-3 rounded-full ${isAuthenticated ? 'bg-green-500' : 'bg-yellow-500'}`} />
              <span className="text-sm font-medium text-gray-800">
                {isAuthenticated ? t('pen.connectedReady', 'Connected & Ready') : t('pen.authenticating', 'Authenticating...')}
              </span>
            </div>

            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">{t('pen.device', 'Device:')}</span>
                <span className="font-medium text-gray-800">{deviceName || 'Unknown'}</span>
              </div>
              {macAddress && (
                <div className="flex justify-between">
                  <span className="text-gray-500">{t('pen.mac', 'MAC:')}</span>
                  <span className="font-mono text-xs text-gray-600">{macAddress}</span>
                </div>
              )}
              {battery >= 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">{t('pen.battery', 'Battery:')}</span>
                  <span className={`font-medium ${battery < 20 ? 'text-red-600' : battery < 50 ? 'text-yellow-600' : 'text-green-600'}`}>
                    {battery}%
                  </span>
                </div>
              )}
              {currentPenPageAddress && (
                <div className="flex justify-between">
                  <span className="text-gray-500">{t('pen.page', 'Page:')}</span>
                  <span className="font-mono text-xs text-gray-600">
                    {formatPageAddress(currentPenPageAddress)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* 비밀번호 입력 */}
          {needsPassword && (
            <div className="px-4 py-2 border-b border-gray-100">
              <div className="p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-xs text-yellow-800 mb-2">
                  {t('pen.passwordProtected', 'Password protected')}
                  {passwordRetryCount > 0 && (
                    <span className="ml-1">
                      {t('pen.attempt', '(Attempt {{current}}/{{max}})', { current: passwordRetryCount, max: passwordMaxRetryCount })}
                    </span>
                  )}
                </p>
                <form onSubmit={handlePasswordSubmit} className="flex gap-2">
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t('pen.enterPassword', 'Enter password')}
                    className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    maxLength={16}
                  />
                  <button
                    type="submit"
                    className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    OK
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* 연결 해제 버튼 */}
          <button
            onClick={handleDisconnect}
            className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>{t('pen.disconnectButton', 'Disconnect')}</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default SmartpenButton;
