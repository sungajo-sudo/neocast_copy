import React from 'react';
import { useSessionStore } from '../stores/sessionStore';
import MonitoringView from '../components/MonitoringView';
import GuestCanvas from '../components/GuestCanvas';

export default function SessionPage() {
    const { role, sessionId } = useSessionStore();

    if (!sessionId) {
        return (
            <div style={{ minHeight: '100vh', background: '#0f0c29', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                세션 정보가 없습니다.
            </div>
        );
    }

    return role === 'host' ? <MonitoringView /> : <GuestCanvas />;
}
