import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import SessionPage from './pages/SessionPage';
import HostHome from './pages/HostHome';
import GuestJoin from './pages/GuestJoin';
import GuestWaiting from './pages/GuestWaiting';
import ReportDetail from './pages/ReportDetail';
import StudentReport from './pages/StudentReport';

// 새로운 호스트 레이아웃
import HostLayout from './components/layout/HostLayout';
import Dashboard from './pages/host/Dashboard';
import SessionList from './pages/host/SessionList';
import Worksheets from './pages/host/Worksheets';
import Results from './pages/host/Results';

export default function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Login />} />

                {/* 새로운 호스트 레이아웃 (LNB 포함) */}
                <Route path="/host" element={<HostLayout />}>
                    <Route index element={<Navigate to="/host/dashboard" replace />} />
                    <Route path="dashboard" element={<Dashboard />} />
                    <Route path="sessions" element={<SessionList />} />
                    <Route path="worksheets" element={<Worksheets />} />
                    <Route path="results" element={<Results />} />
                </Route>

                {/* 기존 라우트 (절대 수정 금지) */}
                <Route path="/join" element={<GuestJoin />} />
                <Route path="/waiting" element={<GuestWaiting />} />
                <Route path="/session" element={<SessionPage />} />
                <Route path="/report/:archiveId" element={<ReportDetail />} />
                <Route path="/report/:archiveId/student/:studentId" element={<StudentReport />} />

                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </BrowserRouter>
    );
}
