import { Navigate, Route, Routes } from "react-router-dom";
import { useEffect, useState } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";

import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import AttendancePage from "./pages/AttendancePage";
import EmployeeProjectAttendancePage from "./pages/employee/EmployeeProjectAttendancePage";
import ProjectAttendancePage from "./pages/ProjectAttendancePage";
import UsersPage from "./pages/UsersPage";
import EmployeeDataUpdatePage from "./pages/employee/EmployeeDataUpdatePage";
import AdminEmployeeServicesPage from "./pages/AdminEmployeeServicesPage";
import AccountDeletionPage from "./pages/AccountDeletionPage";
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
import LeaveFormsPage from "./pages/LeaveFormsPage";

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
import NotificationCenter from "./components/NotificationCenter";

function ProtectedApp() {
  const { user, loading } = useAuth();
  const { isMobile } = useDevice();
  const [maintenanceNotice, setMaintenanceNotice] = useState(null);

  useEffect(() => {
    const handleMaintenance = (event) => setMaintenanceNotice(event.detail || {});
    window.addEventListener("hr-portal-maintenance", handleMaintenance);
    return () => window.removeEventListener("hr-portal-maintenance", handleMaintenance);
  }, []);

  if (loading) {
    return (
      <div className="page">
        <div className="card">Loading...</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (maintenanceNotice) {
    const isArabic = document.documentElement.lang === "ar";
    const endAt = maintenanceNotice.maintenanceEndAt
      ? new Date(maintenanceNotice.maintenanceEndAt).toLocaleString()
      : null;
    return <main style={{minHeight:"100vh",display:"grid",placeItems:"center",padding:24,
      background:"radial-gradient(circle at top,#1e3a8a,#070d19 68%)",color:"#fff"}}>
      <section style={{width:"min(100%,620px)",padding:"38px 28px",textAlign:"center",borderRadius:28,
        background:"rgba(15,23,42,.78)",border:"1px solid rgba(255,255,255,.15)",boxShadow:"0 28px 80px rgba(0,0,0,.35)"}}>
        <div style={{fontSize:54,marginBottom:12}}>⚙️</div>
        <h1 style={{margin:"0 0 12px",fontSize:"clamp(28px,6vw,42px)"}}>{isArabic ? "صيانة النظام" : "System Maintenance"}</h1>
        <p style={{margin:"0 auto 16px",maxWidth:520,lineHeight:1.8,color:"#cbd5e1"}}>
          {maintenanceNotice.message || "The system is currently under maintenance. Please try again later."}
        </p>
        {endAt && <p style={{color:"#93c5fd",fontWeight:700}}>{isArabic ? "الوقت المتوقع للانتهاء:" : "Expected end:"} {endAt}</p>}
        <button type="button" onClick={() => window.location.reload()} style={{marginTop:12,border:0,borderRadius:12,
          padding:"12px 22px",background:"#2563eb",color:"#fff",fontWeight:800,cursor:"pointer"}}>{isArabic ? "إعادة المحاولة" : "Try Again"}</button>
      </section>
    </main>;
  }

  const isEmployeeOnly = user.role === "Employee";

  if (isEmployeeOnly) {
    const Layout = isMobile ? EmployeeMobileLayout : EmployeeDesktopLayout;

    return (<>
      <NotificationCenter user={user} />
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
          <Route path="/account-deletion" element={<AccountDeletionPage />} />
          <Route path="performance" element={<EmployeePerformancePage />} />
          <Route path="notifications" element={<EmployeeNotificationsPage />} />
          <Route path="profile" element={<EmployeeProfilePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </>);
  }

  const Layout = isMobile ? AdminMobileLayout : AdminDesktopLayout;

  return (<>
    <NotificationCenter user={user} />
    <Routes>
      {/* Full screen route خارج Admin Layout */}
      <Route path="/meeting-room/:meetingId" element={<MeetingRoomPage />} />

      <Route path="/" element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="attendance" element={<AttendancePage />} />
        <Route path="timesheet-reports" element={<TimesheetReportGeneratorPage />} />
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
        <Route path="leave-forms" element={<LeaveFormsPage />} />
        <Route path="performance" element={<PerformanceDashboardPage />} />
        <Route path="performance/templates" element={<ReviewTemplatesPage />} />
        <Route path="performance/assign" element={<AssignReviewsPage />} />
        <Route path="performance/reviews/:id" element={<PerformanceReviewPage />} />
        <Route path="profile" element={<EmployeeProfilePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  </>);
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
