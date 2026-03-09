import React from 'react';
import { useSessionStore } from '../stores/sessionStore';
import MonitoringView from '../components/MonitoringView';
import GuestCanvas from '../components/GuestCanvas';
// Feature B — 페이지 패널 (기존 로직/컴포넌트 수정 없이 외부 주입)
import PagesPanel from '../components/panels/PagesPanel';
import PagesButton from '../components/control-bar/PagesButton';

export default function SessionPage() {
    const { role, sessionId } = useSessionStore();

    if (!sessionId) {
        return (
            <div style={{ minHeight: '100vh', background: '#0f0c29', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                세션 정보가 없습니다.
            </div>
        );
    }

    return (
        <>
            {/* Feature B: 페이지 패널 + 버튼 (fixed position, 기존 레이아웃 무간섭) */}
            <PagesPanel />
            <PagesButton />
            {role === 'host' ? <MonitoringView /> : <GuestCanvas />}
        </>
    );
}
