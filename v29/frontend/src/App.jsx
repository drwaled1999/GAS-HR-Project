import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";

import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import AttendancePage from "./pages/AttendancePage";
import EmployeeProjectAttendancePage from "./pages/employee/EmployeeProjectAttendancePage";
import ProjectAttendancePage from "./pages/ProjectAttendancePage";
import UsersPage from "./pages/UsersPage";
import EmployeeDataUpdatePage from "./pages/employee/EmployeeDataUpdatePage";
import AdminEmployeeServicesPage from "./pages/AdminEmployeeServicesPage";
import ProjectsPage from "./pages/ProjectsPage";
import RequestsPage from "./pages/RequestsPage";
import SettingsPage from "./pages/SettingsPage";
import MeetingRoomPage from "./pages/MeetingRoomPage";
import NotificationsPage from "./pages/NotificationsPage";
import ReportsPage from "./pages/ReportsPage";
import AdminMeetingsPage from "./pages/AdminMeetingsPage";
import PerformanceDashboardPage from "./pages/PerformanceDashboardPage";
import ReviewTemplatesPage from "./pages/ReviewTemplatesPage";
import AssignReviewsPage from "./pages/AssignReviewsPage";
import PerformanceReviewPage from "./pages/PerformanceReviewPage";
import EmployeePerformancePage from "./pages/employee/EmployeePerformancePage";
import EmployeeMeetingsPage from "./pages/employee/EmployeeMeetingsPage";
import SecurityPage from "./pages/SecurityPage";
import AttendanceIssuesPage from "./pages/AttendanceIssuesPage";
import PayrollPage from "./pages/PayrollPage";
import MyAttendancePage from "./pages/MyAttendancePage";

import EmployeeHomePage from "./pages/employee/EmployeeHomePage";
import EmployeeAttendancePage from "./pages/employee/EmployeeAttendancePage";
import EmployeeRequestsPage from "./pages/employee/EmployeeRequestsPage";
import EmployeeNotificationsPage from "./pages/employee/EmployeeNotificationsPage";
import EmployeeProfilePage from "./pages/employee/EmployeeProfilePage";

import EmployeeMobileLayout from "./layout/EmployeeMobileLayout";
import EmployeeDesktopLayout from "./layout/EmployeeDesktopLayout";
import AdminMobileLayout from "./layout/AdminMobileLayout";
import AdminDesktopLayout from "./layout/AdminDesktopLayout";
import ProjectEmployeesPage from "./pages/ProjectEmployeesPage";

import { useDevice } from "./hooks_useDevice";

function ProtectedApp() {
  const { user, loading } = useAuth();
  const { isMobile } = useDevice();

  if (loading) {
    return (
      <div className="page">
        <div className="card">Loading...</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  const isEmployeeOnly = user.role === "Employee";

  if (isEmployeeOnly) {
    const Layout = isMobile ? EmployeeMobileLayout : EmployeeDesktopLayout;

    return (
      <Routes>
        {/* Full screen route خارج Employee Layout */}
        <Route path="/meeting-room/:meetingId" element={<MeetingRoomPage />} />

        <Route path="/" element={<Layout />}>
          <Route index element={<EmployeeHomePage />} />
          <Route path="attendance" element={<EmployeeAttendancePage />} />
          <Route path="my-project-attendance" element={<EmployeeProjectAttendancePage />} />
          <Route path="performance" element={<EmployeePerformancePage />} />
          <Route path="data-update" element={<EmployeeDataUpdatePage />} />
          <Route path="requests" element={<EmployeeRequestsPage />} />
          <Route path="meetings" element={<EmployeeMeetingsPage />} />
          <Route path="performance" element={<EmployeePerformancePage />} />
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
      {/* Full screen route خارج Admin Layout */}
      <Route path="/meeting-room/:meetingId" element={<MeetingRoomPage />} />

      <Route path="/" element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="attendance" element={<AttendancePage />} />
        <Route path="my-project-attendance" element={<EmployeeProjectAttendancePage />} />
        <Route path="project-attendance" element={<ProjectAttendancePage />} />
        <Route path="my-attendance" element={<MyAttendancePage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="project-employees" element={<ProjectEmployeesPage />} />
        <Route path="admin/employee-services" element={<AdminEmployeeServicesPage />} />
        <Route path="admin/meetings" element={<AdminMeetingsPage />} />
        <Route path="requests" element={<RequestsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="attendance-issues" element={<AttendanceIssuesPage />} />
        <Route path="security" element={<SecurityPage />} />
        <Route path="payroll" element={<PayrollPage />} />
        <Route path="performance" element={<PerformanceDashboardPage />} />
        <Route path="performance/templates" element={<ReviewTemplatesPage />} />
        <Route path="performance/assign" element={<AssignReviewsPage />} />
        <Route path="performance/reviews/:id" element={<PerformanceReviewPage />} />
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
