import { useState, useCallback } from 'react';
import { useConnectionStore } from '../../stores/connection-store';
import { ConnectionState } from '../../types';

interface ConnectionPanelProps {
  className?: string;
}

/**
 * 서버 연결 패널
 */
export const ConnectionPanel: React.FC<ConnectionPanelProps> = ({ className = '' }) => {
  const [token, setToken] = useState('');

  const serverUrl = useConnectionStore((state) => state.serverUrl);
  const setServerUrl = useConnectionStore((state) => state.setServerUrl);
  const connectionState = useConnectionStore((state) => state.state);
  const connect = useConnectionStore((state) => state.connect);
  const disconnect = useConnectionStore((state) => state.disconnect);

  const isConnected = connectionState === ConnectionState.Connected;
  const isConnecting = connectionState === ConnectionState.Connecting;

  /**
   * 연결 처리
   */
  const handleConnect = useCallback(async () => {
    if (!serverUrl) return;

    await connect(serverUrl, token);
  }, [serverUrl, token, connect]);

  /**
   * 연결 해제
   */
  const handleDisconnect = useCallback(() => {
    disconnect();
  }, [disconnect]);

  /**
   * 연결 상태에 따른 스타일
   */
  const getStatusColor = () => {
    switch (connectionState) {
      case ConnectionState.Connected:
        return 'bg-green-500';
      case ConnectionState.Connecting:
      case ConnectionState.Reconnecting:
        return 'bg-yellow-500';
      case ConnectionState.Disconnected:
      default:
        return 'bg-red-500';
    }
  };

  const getStatusText = () => {
    switch (connectionState) {
      case ConnectionState.Connected:
        return 'Connected';
      case ConnectionState.Connecting:
        return 'Connecting...';
      case ConnectionState.Reconnecting:
        return 'Reconnecting...';
      case ConnectionState.Disconnected:
      default:
        return 'Disconnected';
    }
  };

  return (
    <div className={`bg-white rounded-lg shadow p-4 ${className}`}>
      <h2 className="text-lg font-semibold mb-4">Server Connection</h2>

      {/* 연결 상태 */}
      <div className="flex items-center mb-4">
        <div className={`w-3 h-3 rounded-full ${getStatusColor()} mr-2`} />
        <span className="text-sm text-gray-600">{getStatusText()}</span>
      </div>

      {!isConnected ? (
        <>
          {/* 서버 URL */}
          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Server URL
            </label>
            <input
              type="text"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="http://localhost:3000"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isConnecting}
            />
          </div>

          {/* 토큰 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Auth Token (optional)
            </label>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Enter token..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isConnecting}
            />
          </div>

          {/* 연결 버튼 */}
          <button
            onClick={handleConnect}
            disabled={isConnecting || !serverUrl}
            className="w-full py-2 px-4 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isConnecting ? 'Connecting...' : 'Connect'}
          </button>
        </>
      ) : (
        <>
          {/* 연결된 서버 정보 */}
          <div className="mb-4 p-3 bg-gray-50 rounded-md">
            <p className="text-sm text-gray-600">
              Connected to: <span className="font-medium">{serverUrl}</span>
            </p>
          </div>

          {/* 연결 해제 버튼 */}
          <button
            onClick={handleDisconnect}
            className="w-full py-2 px-4 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors"
          >
            Disconnect
          </button>
        </>
      )}
    </div>
  );
};

export default ConnectionPanel;
