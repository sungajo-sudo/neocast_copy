import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import SessionPage from './pages/SessionPage';
import HostHome from './pages/HostHome';
import GuestJoin from './pages/GuestJoin';
import GuestWaiting from './pages/GuestWaiting';
import ReportDetail from './pages/ReportDetail';
import StudentReport from './pages/StudentReport';

export default function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Login />} />
                <Route path="/host" element={<HostHome />} />
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
