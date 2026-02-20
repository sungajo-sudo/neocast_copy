import { useState, useCallback } from 'react';
import { useConnectionStore } from '../../stores/connection-store';
import { useSessionStore, createMockSession } from '../../stores/session-store';
import { ConnectionState } from '../../types';
import { v4 as uuidv4 } from 'uuid';
import { copyToClipboard } from '../../utils/clipboard';

interface SessionPanelProps {
  className?: string;
}

/**
 * 세션 관리 패널
 */
export const SessionPanel: React.FC<SessionPanelProps> = ({ className = '' }) => {
  const [sessionCode, setSessionCode] = useState('');
  const [userName, setUserName] = useState('User');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  const connectionState = useConnectionStore((state) => state.state);
  const joinSession = useConnectionStore((state) => state.joinSession);
  const leaveSession = useConnectionStore((state) => state.leaveSession);

  const session = useSessionStore((state) => state.session);
  const setSession = useSessionStore((state) => state.setSession);
  const setCurrentUserId = useSessionStore((state) => state.setCurrentUserId);
  const clearSession = useSessionStore((state) => state.clearSession);

  const isConnected = connectionState === ConnectionState.Connected;
  const hasSession = session !== null;

  /**
   * 세션 생성
   */
  const handleCreateSession = useCallback(async () => {
    if (!isConnected) return;

    setIsCreating(true);
    try {
      const userId = uuidv4();
      setCurrentUserId(userId);

      // 목 세션 생성 (실제로는 서버에서 생성)
      const newSession = createMockSession(userId);
      setSession(newSession);

      // 세션 참가
      await joinSession(newSession.id);
    } catch (error) {
      console.error('Failed to create session:', error);
    } finally {
      setIsCreating(false);
    }
  }, [isConnected, setCurrentUserId, setSession, joinSession]);

  /**
   * 세션 참가
   */
  const handleJoinSession = useCallback(async () => {
    if (!isConnected || !sessionCode) return;

    setIsJoining(true);
    try {
      const userId = uuidv4();
      setCurrentUserId(userId);

      // 실제로는 서버에서 세션 정보를 받아와야 함
      // 여기서는 세션 ID로 참가만 함
      await joinSession(sessionCode);
    } catch (error) {
      console.error('Failed to join session:', error);
    } finally {
      setIsJoining(false);
    }
  }, [isConnected, sessionCode, setCurrentUserId, joinSession]);

  /**
   * 세션 나가기
   */
  const handleLeaveSession = useCallback(async () => {
    try {
      await leaveSession();
      clearSession();
    } catch (error) {
      console.error('Failed to leave session:', error);
    }
  }, [leaveSession, clearSession]);

  if (!isConnected) {
    return (
      <div className={`bg-white rounded-lg shadow p-4 ${className}`}>
        <h2 className="text-lg font-semibold mb-4">Session</h2>
        <p className="text-sm text-gray-500">Connect to server first</p>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow p-4 ${className}`}>
      <h2 className="text-lg font-semibold mb-4">Session</h2>

      {!hasSession ? (
        <>
          {/* 사용자 이름 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Your Name
            </label>
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="Enter your name"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 세션 생성 */}
          <button
            onClick={handleCreateSession}
            disabled={isCreating}
            className="w-full py-2 px-4 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors mb-3"
          >
            {isCreating ? 'Creating...' : 'Create New Session'}
          </button>

          {/* 구분선 */}
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">or</span>
            </div>
          </div>

          {/* 세션 참가 */}
          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Session Code
            </label>
            <input
              type="text"
              value={sessionCode}
              onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
              placeholder="Enter code (e.g., ABC123)"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
              maxLength={6}
            />
          </div>

          <button
            onClick={handleJoinSession}
            disabled={isJoining || !sessionCode}
            className="w-full py-2 px-4 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isJoining ? 'Joining...' : 'Join Session'}
          </button>
        </>
      ) : (
        <>
          {/* 현재 세션 정보 */}
          <div className="mb-4 p-3 bg-gray-50 rounded-md">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Session Code:</span>
              <span className="font-mono font-bold text-lg">{session.code}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Participants:</span>
              <span className="font-medium">{session.participants.length}</span>
            </div>
          </div>

          {/* 세션 코드 복사 */}
          <button
            onClick={() => copyToClipboard(session.code)}
            className="w-full py-2 px-4 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors mb-3"
          >
            Copy Session Code
          </button>

          {/* 세션 나가기 */}
          <button
            onClick={handleLeaveSession}
            className="w-full py-2 px-4 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors"
          >
            Leave Session
          </button>
        </>
      )}
    </div>
  );
};

export default SessionPanel;
