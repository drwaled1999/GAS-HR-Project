import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useContext } from "react";
import { AuthContext } from "./context/AuthContext";

// الصفحات
import LoginPage from "./pages/LoginPage";
import Dashboard from "./pages/Dashboard";
import AttendancePage from "./pages/AttendancePage";
import RequestsPage from "./pages/RequestsPage";
import UsersPage from "./pages/UsersPage";
import MyAttendancePage from "./pages/MyAttendancePage";

// كومبوننت حماية
function PrivateRoute({ children }) {
  const { user, loading } = useContext(AuthContext);

  if (loading) return <div>Loading...</div>;

  if (!user) return <Navigate to="/login" />;

  return children;
}

export default function App() {
  return (
    <Router>
      <Routes>

        {/* تسجيل الدخول */}
        <Route path="/login" element={<LoginPage />} />

        {/* داشبورد */}
        <Route
          path="/"
          element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          }
        />

        {/* Attendance (للإدارة) */}
        <Route
          path="/attendance"
          element={
            <PrivateRoute>
              <AttendancePage />
            </PrivateRoute>
          }
        />

        {/* My Attendance (الجديد 🔥) */}
        <Route
          path="/my-attendance"
          element={
            <PrivateRoute>
              <MyAttendancePage />
            </PrivateRoute>
          }
        />

        {/* Requests */}
        <Route
          path="/requests"
          element={
            <PrivateRoute>
              <RequestsPage />
            </PrivateRoute>
          }
        />

        {/* Users */}
        <Route
          path="/users"
          element={
            <PrivateRoute>
              <UsersPage />
            </PrivateRoute>
          }
        />

        {/* أي رابط غلط */}
        <Route path="*" element={<Navigate to="/" />} />

      </Routes>
    </Router>
  );
}
