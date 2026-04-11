import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import AttendancePage from './pages/AttendancePage';
import UsersPage from './pages/UsersPage';
import ProjectsPage from './pages/ProjectsPage';
import RequestsPage from './pages/RequestsPage';
import SettingsPage from './pages/SettingsPage';
import NotificationsPage from './pages/NotificationsPage';
import ReportsPage from './pages/ReportsPage';
import SecurityPage from './pages/SecurityPage';
import AttendanceIssuesPage from './pages/AttendanceIssuesPage';
import PayrollPage from './pages/PayrollPage';
import EmployeeHomePage from './pages/employee/EmployeeHomePage';
import EmployeeAttendancePage from './pages/employee/EmployeeAttendancePage';
import EmployeeRequestsPage from './pages/employee/EmployeeRequestsPage';
import EmployeeNotificationsPage from './pages/employee/EmployeeNotificationsPage';
import EmployeeProfilePage from './pages/employee/EmployeeProfilePage';
import EmployeeMobileLayout from './layout/EmployeeMobileLayout';
import EmployeeDesktopLayout from './layout/EmployeeDesktopLayout';
import AdminMobileLayout from './layout/AdminMobileLayout';
import AdminDesktopLayout from './layout/AdminDesktopLayout';
import { useDevice } from './hooks_useDevice';

function ProtectedApp() {
  const { user, loading } = useAuth();
  const { isMobile } = useDevice();

  if (loading) return <div className="page"><div className="card">Loading...</div></div>;
  if (!user) return <Navigate to="/login" replace />;

  const isEmployeeOnly = user.role === 'Employee';

  if (isEmployeeOnly) {
    const Layout = isMobile ? EmployeeMobileLayout : EmployeeDesktopLayout;
    return (
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<EmployeeHomePage />} />
          <Route path="attendance" element={<EmployeeAttendancePage />} />
          <Route path="requests" element={<EmployeeRequestsPage />} />
          <Route path="notifications" element={<EmployeeNotificationsPage />} />
          <Route path="profile" element={<EmployeeProfilePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    );
  }

  const Layout = isMobile ? AdminMobileLayout : AdminDesktopLayout;
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="attendance" element={<AttendancePage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="requests" element={<RequestsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="attendance-issues" element={<AttendanceIssuesPage />} />
        <Route path="security" element={<SecurityPage />} />
        <Route path="payroll" element={<PayrollPage />} />
        <Route path="profile" element={<EmployeeProfilePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/*" element={<ProtectedApp />} />
      </Routes>
    </AuthProvider>
  );
}
