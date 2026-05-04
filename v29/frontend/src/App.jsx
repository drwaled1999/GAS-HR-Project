import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import AttendancePage from './pages/AttendancePage';
import UsersPage from './pages/UsersPage';
import EmployeeDataUpdatePage from './pages/employee/EmployeeDataUpdatePage';
import AdminEmployeeServicesPage from "./pages/AdminEmployeeServicesPage";
import ProjectsPage from './pages/ProjectsPage';
import RequestsPage from './pages/RequestsPage';
import SettingsPage from './pages/SettingsPage';
import NotificationsPage from './pages/NotificationsPage';
import ReportsPage from './pages/ReportsPage';
import SecurityPage from './pages/SecurityPage';
import AttendanceIssuesPage from './pages/AttendanceIssuesPage';
import PayrollPage from './pages/PayrollPage';
import MyAttendancePage from './pages/MyAttendancePage'; // 🔥 الجديد

import EmployeeHomePage from './pages/employee/EmployeeHomePage';
import EmployeeAttendancePage from './pages/employee/EmployeeAttendancePage';
import EmployeeRequestsPage from './pages/employee/EmployeeRequestsPage';
import EmployeeNotificationsPage from './pages/employee/EmployeeNotificationsPage';
import EmployeeProfilePage from './pages/employee/EmployeeProfilePage';

import EmployeeMobileLayout from './layout/EmployeeMobileLayout';
import EmployeeDesktopLayout from './layout/EmployeeDesktopLayout';
import AdminMobileLayout from './layout/AdminMobileLayout';
import AdminDesktopLayout from './layout/AdminDesktopLayout';
import ProjectEmployeesPage from "./pages/ProjectEmployeesPage";

import { useDevice } from './hooks_useDevice';

function ProtectedApp() {
  const { user, loading } = useAuth();
  const { isMobile } = useDevice();

  if (loading) return <div className="page"><div className="card">Loading...</div></div>;
  if (!user) return <Navigate to="/login" replace />;

  const isEmployeeOnly = user.role === 'Employee';

  // 👇 موظف عادي
  if (isEmployeeOnly) {
    const Layout = isMobile ? EmployeeMobileLayout : EmployeeDesktopLayout;

    return (
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<EmployeeHomePage />} />
          <Route path="attendance" element={<EmployeeAttendancePage />} />
          <Route path="data-update" element={<EmployeeDataUpdatePage />} />
          <Route path="requests" element={<EmployeeRequestsPage />} />
          <Route path="notifications" element={<EmployeeNotificationsPage />} />
          <Route path="profile" element={<EmployeeProfilePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    );
  }

  // 👇 إدارة / HR / Admin
  const Layout = isMobile ? AdminMobileLayout : AdminDesktopLayout;

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="attendance" element={<AttendancePage />} />

        {/* 🔥 الجديد: عرض حضوري أنا */}
        <Route path="my-attendance" element={<MyAttendancePage />} />

        <Route path="users" element={<UsersPage />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="project-employees" element={<ProjectEmployeesPage />} />
        <Route path="admin/employee-services" element={<AdminEmployeeServicesPage />} />
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
