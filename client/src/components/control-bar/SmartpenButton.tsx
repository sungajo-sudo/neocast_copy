// SmartpenButton 컴포넌트
import React, { useState, useRef, useEffect } from 'react';
import { usePenStore, formatPageAddress } from '../../stores/pen-store';

const IcoPen = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9"/>
    <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
  </svg>
);

interface CtrlBtnProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  activeColor?: string;
  onClick?: () => void;
}

function CtrlBtn({ icon, label, active, activeColor = '#facc15', onClick }: CtrlBtnProps) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 2, minWidth: 56, padding: '6px 8px',
        background: 'transparent', border: 'none', cursor: 'pointer',
        borderRadius: 8, transition: 'background 0.15s',
        position: 'relative',
      }}
      onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.08)'}
      onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'transparent'}
    >
      <div style={{ position: 'relative' }}>
        <div style={{ color: active ? activeColor : 'rgba(255,255,255,0.85)', fontSize: '1.2rem', lineHeight: 1 }}>
          {icon}
        </div>
        {/* 상태 도트 */}
        <div
          style={{
            position: 'absolute',
            top: -2,
            right: -2,
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: active ? '#22c55e' : 'rgba(255,255,255,0.3)',
            boxShadow: active ? '0 0 8px rgba(34, 197, 94, 0.6)' : 'none',
          }}
        />
      </div>
      <span style={{
        fontSize: '0.62rem', fontWeight: 500,
        color: active ? activeColor : 'rgba(255,255,255,0.6)',
        letterSpacing: '-0.01em', whiteSpace: 'nowrap',
      }}>
        {label}
      </span>
    </button>
  );
}

export default function SmartpenButton() {
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
    if (!isAvailable) return 'N/A';
    if (isConnecting) return '연결중';
    if (isConnected && isAuthenticated) return deviceName?.slice(0, 8) || '준비됨';
    if (isConnected) return '인증중';
    return '스마트펜';
  };

  if (!isAvailable) return null;

  return (
    <div style={{ position: 'relative' }} ref={menuRef}>
      <CtrlBtn
        icon={<IcoPen />}
        label={getLabel()}
        onClick={handleClick}
        active={isConnected && isAuthenticated}
        activeColor="#22c55e"
      />

      {/* 드롭다운 메뉴 */}
      {isMenuOpen && isConnected && (
        <div style={{
          position: 'absolute',
          bottom: 'calc(100% + 8px)',
          left: 0,
          width: 320,
          background: 'rgba(255,255,255,0.98)',
          backdropFilter: 'blur(20px)',
          borderRadius: 16,
          boxShadow: '0 20px 40px rgba(0,0,0,0.25), 0 0 0 1px rgba(0,0,0,0.1)',
          padding: 4,
          zIndex: 100,
        }}>
          {/* 디바이스 정보 */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: isAuthenticated ? '#22c55e' : '#eab308',
                boxShadow: isAuthenticated ? '0 0 10px rgba(34, 197, 94, 0.5)' : '0 0 10px rgba(234, 179, 8, 0.5)',
              }} />
              <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1e293b' }}>
                {isAuthenticated ? '연결됨 · 준비' : '인증 중...'}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>기기:</span>
                <span style={{ fontWeight: 600, color: '#1e293b' }}>{deviceName || 'Unknown'}</span>
              </div>
              {macAddress && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>MAC:</span>
                  <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#475569' }}>{macAddress}</span>
                </div>
              )}
              {battery >= 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#64748b' }}>배터리:</span>
                  <span style={{
                    fontWeight: 600,
                    color: battery < 20 ? '#dc2626' : battery < 50 ? '#eab308' : '#22c55e',
                  }}>
                    {battery}%
                  </span>
                </div>
              )}
              {currentPenPageAddress && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>페이지:</span>
                  <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#475569' }}>
                    {formatPageAddress(currentPenPageAddress)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* 비밀번호 입력 */}
          {needsPassword && (
            <div style={{ padding: 12 }}>
              <div style={{ padding: 12, background: '#fef3c7', border: '1px solid #fbbf24', borderRadius: 10 }}>
                <p style={{ fontSize: '0.8rem', color: '#92400e', marginBottom: 8 }}>
                  비밀번호 필요
                  {passwordRetryCount > 0 && (
                    <span style={{ marginLeft: 4 }}>
                      (시도 {passwordRetryCount}/{passwordMaxRetryCount})
                    </span>
                  )}
                </p>
                <form onSubmit={handlePasswordSubmit} style={{ display: 'flex', gap: 6 }}>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="비밀번호 입력"
                    style={{
                      flex: 1,
                      padding: '6px 10px',
                      fontSize: '0.8rem',
                      border: '1px solid #d1d5db',
                      borderRadius: 6,
                      outline: 'none',
                    }}
                    maxLength={16}
                  />
                  <button
                    type="submit"
                    style={{
                      padding: '6px 12px',
                      fontSize: '0.8rem',
                      background: '#3b82f6',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 6,
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    확인
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* 연결 해제 버튼 */}
          <button
            onClick={handleDisconnect}
            style={{
              width: '100%',
              padding: '10px 16px',
              textAlign: 'left',
              fontSize: '0.85rem',
              color: '#dc2626',
              background: 'transparent',
              border: 'none',
              borderRadius: 12,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(220, 38, 38, 0.08)'}
            onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'transparent'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span style={{ fontWeight: 600 }}>연결 해제</span>
          </button>
        </div>
      )}
    </div>
  );
}

