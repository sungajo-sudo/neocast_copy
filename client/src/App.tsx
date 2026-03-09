import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import SessionPage from './pages/SessionPage';
import GuestJoin from './pages/GuestJoin';
import GuestWaiting from './pages/GuestWaiting';
import PdfBackground from './components/canvas/PdfBackground';

// 호스트 레이아웃
import HostLayout from './components/layout/HostLayout';
import Worksheets from './pages/host/Worksheets';
import Sessions from './pages/host/Sessions';
import Archive from './pages/host/Archive';
import ArchiveDetail from './pages/host/ArchiveDetail';
import StudentReport from './pages/host/StudentReport';

export default function App() {
    return (
        <BrowserRouter>
            <Routes>
                {/* 루트: 워크시트로 바로 이동 */}
                <Route path="/" element={<Navigate to="/host/worksheets" replace />} />

                {/* 호스트 레이아웃 (LNB 포함) */}
                <Route path="/host" element={<HostLayout />}>
                    <Route index element={<Navigate to="/host/worksheets" replace />} />
                    <Route path="worksheets" element={<Worksheets />} />
                    <Route path="sessions" element={<Sessions />} />
                    <Route path="archive" element={<Archive />} />
                    <Route path="archive/:sessionId" element={<ArchiveDetail />} />
                    <Route path="archive/:sessionId/student/:studentId" element={<StudentReport />} />
                </Route>

                {/* 게스트 / 세션 (기존 유지, 수정 금지) */}
                <Route path="/join" element={<GuestJoin />} />
                <Route path="/waiting" element={<GuestWaiting />} />
                <Route path="/session" element={<><PdfBackground /><SessionPage /></>} />

                <Route path="*" element={<Navigate to="/host/worksheets" replace />} />
            </Routes>
        </BrowserRouter>
    );
}
