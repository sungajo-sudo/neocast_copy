import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/auth';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import SessionsPage from './pages/SessionsPage';
import ArchivesPage from './pages/ArchivesPage';
import UserStatsPage from './pages/UserStatsPage';
import NcodeStatsPage from './pages/NcodeStatsPage';
import ChatStatsPage from './pages/ChatStatsPage';
import StoragePage from './pages/StoragePage';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="dashboard/users" element={<UserStatsPage />} />
        <Route path="dashboard/ncode" element={<NcodeStatsPage />} />
        <Route path="dashboard/chat" element={<ChatStatsPage />} />
        <Route path="dashboard/storage" element={<StoragePage />} />
        <Route path="sessions" element={<SessionsPage />} />
        <Route path="archives" element={<ArchivesPage />} />
      </Route>
    </Routes>
  );
}

export default App;
