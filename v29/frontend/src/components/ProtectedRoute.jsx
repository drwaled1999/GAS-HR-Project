import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function normalizePermissions(user) {
  if (!user) return [];

  if (Array.isArray(user.permissions)) return user.permissions;

  if (typeof user.permissions === "string") {
    try {
      const parsed = JSON.parse(user.permissions);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return [];
}

function normalizeRole(user) {
  return String(
    user?.roleCode ||
      user?.role_code ||
      user?.roleName ||
      user?.role_name ||
      user?.role ||
      ""
  )
    .trim()
    .toLowerCase();
}

function isElevatedRole(user) {
  return [
    "owner",
    "system owner",
    "system_owner",
    "hr manager",
    "hr_manager",
  ].includes(normalizeRole(user));
}

export default function ProtectedRoute({ permission, children, fallbackPath = "/" }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="page">
        <div className="card">Loading...</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (!permission || isElevatedRole(user)) return children;

  const permissions = normalizePermissions(user);

  if (!permissions.includes(permission)) {
    return <Navigate to={fallbackPath} replace />;
  }

  return children;
}
