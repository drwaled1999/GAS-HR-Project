import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";

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
import TimesheetReportGeneratorPage from "./pages/TimesheetReportGeneratorPage";
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
        <Route path="/meeting-room/:meetingId" element={<MeetingRoomPage />} />

        <Route path="/" element={<Layout />}>
          <Route index element={<EmployeeHomePage />} />

          <Route
            path="attendance"
            element={
              <ProtectedRoute permission="attendance.view">
                <EmployeeAttendancePage />
              </ProtectedRoute>
            }
          />

          <Route
            path="my-project-attendance"
            element={
              <ProtectedRoute permission="attendance.my_project">
                <EmployeeProjectAttendancePage />
              </ProtectedRoute>
            }
          />

          <Route
            path="performance"
            element={
              <ProtectedRoute permission="performance.view">
                <EmployeePerformancePage />
              </ProtectedRoute>
            }
          />

          <Route
            path="data-update"
            element={
              <ProtectedRoute permission="employee_services.view">
                <EmployeeDataUpdatePage />
              </ProtectedRoute>
            }
          />

          <Route
            path="requests"
            element={
              <ProtectedRoute permission="requests.view">
                <EmployeeRequestsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="meetings"
            element={
              <ProtectedRoute permission="meetings.employee">
                <EmployeeMeetingsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="notifications"
            element={
              <ProtectedRoute permission="notifications.view">
                <EmployeeNotificationsPage />
              </ProtectedRoute>
            }
          />

          <Route path="profile" element={<EmployeeProfilePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    );
  }

  const Layout = isMobile ? AdminMobileLayout : AdminDesktopLayout;

  return (
    <Routes>
      <Route path="/meeting-room/:meetingId" element={<MeetingRoomPage />} />

      <Route path="/" element={<Layout />}>
        <Route
          index
          element={
            <ProtectedRoute permission="dashboard.view">
              <DashboardPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="attendance"
          element={
            <ProtectedRoute permission="attendance.view">
              <AttendancePage />
            </ProtectedRoute>
          }
        />

        <Route
          path="timesheet-reports"
          element={
            <ProtectedRoute permission="attendance.timesheet_report">
              <TimesheetReportGeneratorPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="my-project-attendance"
          element={
            <ProtectedRoute permission="attendance.my_project">
              <EmployeeProjectAttendancePage />
            </ProtectedRoute>
          }
        />

        <Route
          path="project-attendance"
          element={
            <ProtectedRoute permission="attendance.project">
              <ProjectAttendancePage />
            </ProtectedRoute>
          }
        />

        <Route
          path="my-attendance"
          element={
            <ProtectedRoute permission="attendance.view">
              <MyAttendancePage />
            </ProtectedRoute>
          }
        />

        <Route
          path="users"
          element={
            <ProtectedRoute permission="users.view">
              <UsersPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="projects"
          element={
            <ProtectedRoute permission="projects.view">
              <ProjectsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="project-employees"
          element={
            <ProtectedRoute permission="projects.view">
              <ProjectEmployeesPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="admin/employee-services"
          element={
            <ProtectedRoute permission="employee_services.review">
              <AdminEmployeeServicesPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="admin/meetings"
          element={
            <ProtectedRoute permission="meetings.manage">
              <AdminMeetingsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="requests"
          element={
            <ProtectedRoute permission="requests.view">
              <RequestsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="settings"
          element={
            <ProtectedRoute permission="settings.manage">
              <SettingsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="notifications"
          element={
            <ProtectedRoute permission="notifications.view">
              <NotificationsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="reports"
          element={
            <ProtectedRoute permission="reports.view">
              <ReportsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="attendance-issues"
          element={
            <ProtectedRoute permission="attendance.issues">
              <AttendanceIssuesPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="security"
          element={
            <ProtectedRoute permission="security.view">
              <SecurityPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="payroll"
          element={
            <ProtectedRoute permission="payroll.view">
              <PayrollPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="performance"
          element={
            <ProtectedRoute permission="performance.view">
              <PerformanceDashboardPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="performance/templates"
          element={
            <ProtectedRoute permission="performance.manage">
              <ReviewTemplatesPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="performance/assign"
          element={
            <ProtectedRoute permission="performance.manage">
              <AssignReviewsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="performance/reviews/:id"
          element={
            <ProtectedRoute permission="performance.manage">
              <PerformanceReviewPage />
            </ProtectedRoute>
          }
        />

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
