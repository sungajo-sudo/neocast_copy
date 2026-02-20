import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePenStore, formatPageAddress } from '../../stores/pen-store';

/**
 * NeoSmartpen connection panel
 */
export const PenConnectionPanel: React.FC = () => {
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
    logMessages,
    checkAvailability,
    connect,
    disconnect,
    inputPassword,
    clearLogs,
  } = usePenStore();

  const [password, setPassword] = useState('');
  const [showLogs, setShowLogs] = useState(false);

  useEffect(() => {
    checkAvailability();
  }, [checkAvailability]);

  const handleConnect = async () => {
    await connect();
  };

  const handleDisconnect = async () => {
    await disconnect();
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password) {
      inputPassword(password);
      setPassword('');
    }
  };

  if (!isAvailable) {
    return (
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
          {t('pen.title')}
        </h3>
        <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
          {t('pen.webBluetoothNotSupported')}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
        {t('pen.title')}
      </h3>

      {/* Connection Status */}
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-3 h-3 rounded-full ${isConnected ? (isAuthenticated ? 'bg-green-500' : 'bg-yellow-500') : 'bg-gray-300'}`} />
        <span className="text-sm text-gray-600">
          {isConnected
            ? isAuthenticated
              ? t('pen.connectedReady')
              : t('pen.connectedAuth')
            : t('pen.disconnected')}
        </span>
      </div>

      {/* Device Info */}
      {isConnected && (
        <div className="mb-3 p-2 bg-gray-50 rounded-lg text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-gray-500">{t('pen.device')}</span>
            <span className="font-medium">{deviceName || 'Unknown'}</span>
          </div>
          {macAddress && (
            <div className="flex justify-between">
              <span className="text-gray-500">{t('pen.mac')}</span>
              <span className="font-mono text-xs">{macAddress}</span>
            </div>
          )}
          {battery >= 0 && (
            <div className="flex justify-between items-center">
              <span className="text-gray-500">{t('pen.battery')}</span>
              <span className={`font-medium ${battery < 20 ? 'text-red-600' : battery < 50 ? 'text-yellow-600' : 'text-green-600'}`}>
                {battery}%
              </span>
            </div>
          )}
          {currentPenPageAddress && (
            <div className="flex justify-between">
              <span className="text-gray-500">{t('pen.page')}</span>
              <span className="font-mono text-xs">{formatPageAddress(currentPenPageAddress)}</span>
            </div>
          )}
        </div>
      )}

      {/* Password Input */}
      {needsPassword && (
        <form onSubmit={handlePasswordSubmit} className="mb-3">
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800 mb-2">
              {t('pen.passwordProtected')}
              {passwordRetryCount > 0 && (
                <span className="ml-1">
                  {t('pen.attempt', { current: passwordRetryCount, max: passwordMaxRetryCount })}
                </span>
              )}
            </p>
            <div className="flex gap-2">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('pen.enterPassword')}
                className="flex-1 px-3 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                maxLength={16}
              />
              <button
                type="submit"
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                OK
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Connect/Disconnect Button */}
      <div className="flex gap-2">
        {!isConnected ? (
          <button
            onClick={handleConnect}
            disabled={isConnecting}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-white transition-colors ${
              isConnecting
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isConnecting ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                {t('pen.connecting')}
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                {t('pen.connectButton')}
              </>
            )}
          </button>
        ) : (
          <button
            onClick={handleDisconnect}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            {t('pen.disconnectButton')}
          </button>
        )}

        {/* Log Toggle */}
        <button
          onClick={() => setShowLogs(!showLogs)}
          className={`px-3 py-2 rounded-lg border transition-colors ${
            showLogs ? 'bg-gray-200 border-gray-400' : 'bg-white border-gray-300 hover:bg-gray-100'
          }`}
          title={t('pen.logs')}
        >
          <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
          </svg>
        </button>
      </div>

      {/* Logs */}
      {showLogs && (
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-500">{t('pen.logs')}</span>
            <button
              onClick={clearLogs}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              {t('pen.clear')}
            </button>
          </div>
          <div className="h-32 bg-gray-900 rounded-lg p-2 overflow-y-auto font-mono text-xs text-green-400">
            {logMessages.length === 0 ? (
              <span className="text-gray-500">{t('pen.noLogs')}</span>
            ) : (
              logMessages.map((msg, i) => (
                <div key={i}>{msg}</div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PenConnectionPanel;
