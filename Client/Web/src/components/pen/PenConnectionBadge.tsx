import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { usePenStore, formatPageAddress } from '../../stores/pen-store';

/**
 * NeoSmartpen connection badge for Top Bar
 * - Disconnected: Click to connect
 * - Connected: Click to show dropdown with info and disconnect
 */
export const PenConnectionBadge: React.FC = () => {
  const { t } = useTranslation();
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

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [password, setPassword] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    checkAvailability();
  }, [checkAvailability]);

  // Close menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleBadgeClick = async () => {
    if (!isAvailable) return;

    if (!isConnected && !isConnecting) {
      // Not connected - initiate connection
      await connect();
    } else {
      // Connected or connecting - toggle dropdown
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

  // Badge color based on state
  const getBadgeColor = () => {
    if (!isAvailable) return 'bg-gray-100 text-gray-400';
    if (isConnecting) return 'bg-yellow-100 text-yellow-800';
    if (isConnected && isAuthenticated) return 'bg-green-100 text-green-800';
    if (isConnected) return 'bg-yellow-100 text-yellow-800';
    return 'bg-gray-100 text-gray-600 hover:bg-gray-200';
  };

  // Status dot color
  const getStatusDotColor = () => {
    if (!isAvailable) return 'bg-gray-400';
    if (isConnecting) return 'bg-yellow-500 animate-pulse';
    if (isConnected && isAuthenticated) return 'bg-green-500';
    if (isConnected) return 'bg-yellow-500';
    return 'bg-gray-400';
  };

  // Badge text
  const getBadgeText = () => {
    if (!isAvailable) return t('pen.notAvailable');
    if (isConnecting) return t('pen.connecting');
    if (isConnected && isAuthenticated) return deviceName?.slice(0, 12) || t('pen.ready');
    if (isConnected) return t('pen.authenticating');
    return t('pen.connect');
  };

  if (!isAvailable) return null;

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={handleBadgeClick}
        disabled={!isAvailable}
        className={`flex items-center space-x-2 px-3 py-1.5 rounded-full transition-colors ${getBadgeColor()} ${!isAvailable ? 'cursor-not-allowed' : 'cursor-pointer'
          }`}
        title={isAvailable ? (isConnected ? t('pen.penSettings') : t('pen.connectButton')) : t('pen.webBluetoothNotSupported')}
      >
        {/* Pen icon */}
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
          />
        </svg>

        {/* Status dot */}
        <div className={`w-2 h-2 rounded-full ${getStatusDotColor()}`} />

        {/* Text */}
        <span className="text-sm font-medium hidden min-[860px]:inline">{getBadgeText()}</span>

        {/* Dropdown arrow (only when connected) */}
        {isConnected && (
          <svg className="w-3 h-3 ml-1 hidden min-[860px]:block" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>

      {/* Dropdown Menu */}
      {isMenuOpen && isConnected && (
        <div className="absolute right-0 top-full mt-1 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
          {/* Device Info */}
          <div className="px-4 py-2 border-b border-gray-100">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-3 h-3 rounded-full ${isAuthenticated ? 'bg-green-500' : 'bg-yellow-500'}`} />
              <span className="text-sm font-medium text-gray-800">
                {isAuthenticated ? t('pen.connectedReady') : t('pen.authenticating')}
              </span>
            </div>

            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">{t('pen.device')}</span>
                <span className="font-medium text-gray-800">{deviceName || 'Unknown'}</span>
              </div>
              {macAddress && (
                <div className="flex justify-between">
                  <span className="text-gray-500">{t('pen.mac')}</span>
                  <span className="font-mono text-xs text-gray-600">{macAddress}</span>
                </div>
              )}
              {battery >= 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">{t('pen.battery')}</span>
                  <span
                    className={`font-medium ${battery < 20 ? 'text-red-600' : battery < 50 ? 'text-yellow-600' : 'text-green-600'
                      }`}
                  >
                    {battery}%
                  </span>
                </div>
              )}
              {currentPenPageAddress && (
                <div className="flex justify-between">
                  <span className="text-gray-500">{t('pen.page')}</span>
                  <span className="font-mono text-xs text-gray-600">
                    {formatPageAddress(currentPenPageAddress)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Password Input (if needed) */}
          {needsPassword && (
            <div className="px-4 py-2 border-b border-gray-100">
              <div className="p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-xs text-yellow-800 mb-2">
                  {t('pen.passwordProtected')}
                  {passwordRetryCount > 0 && (
                    <span className="ml-1">
                      {t('pen.attempt', { current: passwordRetryCount, max: passwordMaxRetryCount })}
                    </span>
                  )}
                </p>
                <form onSubmit={handlePasswordSubmit} className="flex gap-2">
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t('pen.enterPassword')}
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

          {/* Disconnect Button */}
          <button
            onClick={handleDisconnect}
            className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
            <span>{t('pen.disconnectButton')}</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default PenConnectionBadge;
