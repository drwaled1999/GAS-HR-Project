import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import LanguageSwitcher from "../components/LanguageSwitcher";
import ThemeToggle from "../components/ThemeToggle";
import { useSettings } from "../context/SettingsContext";

const links = [
  ["/", "Home"],
  ["/attendance", "Attendance"],
  ["/my-project-attendance", "My Project Attendance"],
  ["/performance", "Performance"],
  ["/requests", "Requests"],
  ["/meetings", "Meetings"],
  ["/data-update", "Data Update"],
  ["/notifications", "Notifications"],
  ["/profile", "Profile"],
];

export default function EmployeeDesktopLayout() {
  const { user, logout } = useAuth();
  const { tr } = useSettings();

  return (
    <div className="app-shell theme-shell">
      <aside className="sidebar employee-sidebar">
        <div>
          <strong>{tr("Employee Portal")}</strong>
          <p className="muted small">{user?.name || user?.username || "-"}</p>
        </div>

        <nav>
          {links.map(([path, label]) => (
            <NavLink
              key={path}
              to={path}
              end={path === "/"}
              className={({ isActive }) =>
                isActive ? "nav-link active" : "nav-link"
              }
            >
              {tr(label)}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="toolbar-row compact-end">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>

          <button type="button" className="ghost" onClick={logout}>
            {tr("Logout")}
          </button>
        </div>
      </aside>

      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
