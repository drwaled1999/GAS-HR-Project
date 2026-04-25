import { NavLink, Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  CalendarDays,
  UserCheck,
  Users,
  FolderKanban,
  FileText,
  Bell,
  BarChart3,
  Settings,
  ShieldCheck,
  LogOut,
  Sparkles,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../services/api";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/attendance", label: "Attendance", icon: CalendarDays },
  { to: "/my-attendance", label: "My Attendance", icon: UserCheck },
  { to: "/users", label: "Users", icon: Users },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/requests", label: "Requests", icon: FileText },
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/notifications", label: "Notifications", icon: Bell },
  { to: "/settings", label: "Settings", icon: Settings },
  { to: "/security", label: "Security & Audit", icon: ShieldCheck },
];

export default function AppShell() {
  const { user, logout } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let timer;

    async function loadNotifications() {
      if (!user?.username) return;

      try {
        const response = await apiFetch(`/notifications?username=${user.username}`);
        setUnreadCount(response.unreadCount || 0);
      } catch {
        setUnreadCount(0);
      }
    }

    loadNotifications();
    timer = setInterval(loadNotifications, 10000);

    return () => clearInterval(timer);
  }, [user?.username]);

  return (
    <div className="app-shell shell-pro">
      <style>{`
        .shell-pro {
          min-height: 100vh;
          display: grid;
          grid-template-columns: 292px minmax(0, 1fr);
          background:
            radial-gradient(circle at top right, rgba(37, 99, 235, 0.08), transparent 35%),
            linear-gradient(135deg, #f8fafc 0%, #eef2f7 100%);
        }

        .shell-pro .sidebar {
          position: sticky;
          top: 0;
          height: 100vh;
          overflow-y: auto;
          padding: 18px;
          background:
            radial-gradient(circle at top left, rgba(59, 130, 246, 0.26), transparent 28%),
            linear-gradient(180deg, #020617 0%, #0f172a 48%, #111827 100%);
          border-right: 1px solid rgba(148, 163, 184, 0.18);
          box-shadow: 18px 0 45px rgba(15, 23, 42, 0.18);
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .shell-pro .brand-card {
          padding: 18px;
          border-radius: 24px;
          background: rgba(255, 255, 255, 0.075);
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
        }

        .shell-pro .brand-top {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .shell-pro .brand-logo {
          width: 42px;
          height: 42px;
          border-radius: 16px;
          display: grid;
          place-items: center;
          color: #fff;
          background: linear-gradient(135deg, #2563eb, #7c3aed);
          box-shadow: 0 12px 28px rgba(37, 99, 235, 0.35);
        }

        .shell-pro .brand-card h2 {
          margin: 0;
          color: #fff;
          font-size: 1.15rem;
          font-weight: 950;
          letter-spacing: -0.02em;
        }

        .shell-pro .brand-card .muted {
          margin: 4px 0 0;
          color: #94a3b8;
          font-size: 0.84rem;
          font-weight: 800;
        }

        .shell-pro .user-mini {
          margin-top: 16px;
          display: grid;
          gap: 8px;
        }

        .shell-pro .user-line {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          color: #cbd5e1;
          font-size: 0.82rem;
          font-weight: 800;
        }

        .shell-pro .soft-badge {
          display: inline-flex;
          align-items: center;
          width: fit-content;
          max-width: 100%;
          min-height: 28px;
          padding: 0 10px;
          border-radius: 999px;
          background: rgba(59, 130, 246, 0.16);
          color: #bfdbfe;
          font-size: 0.75rem;
          font-weight: 900;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .shell-pro .soft-badge.warning {
          background: rgba(245, 158, 11, 0.16);
          color: #fde68a;
        }

        .shell-pro .sidebar-badge-row {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-top: 10px;
        }

        .shell-pro nav {
          display: grid;
          gap: 7px;
        }

        .shell-pro nav a {
          position: relative;
          min-height: 48px;
          padding: 0 14px;
          border-radius: 16px;
          display: flex;
          align-items: center;
          gap: 12px;
          color: #cbd5e1;
          text-decoration: none;
          font-size: 0.95rem;
          font-weight: 850;
          transition: 0.18s ease;
          border: 1px solid transparent;
        }

        .shell-pro nav a:hover {
          background: rgba(255, 255, 255, 0.075);
          color: #fff;
          transform: translateX(4px);
          border-color: rgba(255, 255, 255, 0.08);
        }

        .shell-pro nav a.active {
          background:
            linear-gradient(135deg, rgba(37, 99, 235, 0.95), rgba(29, 78, 216, 0.95));
          color: #fff;
          box-shadow: 0 14px 30px rgba(37, 99, 235, 0.32);
        }

        .shell-pro .nav-icon {
          width: 19px;
          height: 19px;
          flex: 0 0 auto;
        }

        .shell-pro .nav-label {
          flex: 1;
          min-width: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .shell-pro .nav-pill {
          min-width: 24px;
          height: 24px;
          padding: 0 7px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          background: #ef4444;
          color: #fff;
          font-size: 0.72rem;
          font-weight: 950;
        }

        .shell-pro .sidebar-footer {
          margin-top: auto;
          padding-top: 12px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
        }

        .shell-pro .ghost {
          width: 100%;
          min-height: 46px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.06);
          color: #e2e8f0;
          font-weight: 900;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          transition: 0.18s ease;
        }

        .shell-pro .ghost:hover {
          background: rgba(239, 68, 68, 0.16);
          color: #fff;
          border-color: rgba(248, 113, 113, 0.28);
          transform: translateY(-1px);
        }

        .shell-pro .content {
          min-width: 0;
          padding: 22px;
          overflow-x: hidden;
        }

        @media (max-width: 900px) {
          .shell-pro {
            grid-template-columns: 1fr;
          }

          .shell-pro .sidebar {
            position: relative;
            height: auto;
            border-right: none;
            border-bottom: 1px solid rgba(148, 163, 184, 0.18);
          }

          .shell-pro nav {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .shell-pro nav a:hover {
            transform: none;
          }
        }

        @media (max-width: 560px) {
          .shell-pro .content {
            padding: 14px;
          }

          .shell-pro nav {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <aside className="sidebar">
        <div className="brand-card">
          <div className="brand-top">
            <div className="brand-logo">
              <Sparkles size={21} />
            </div>

            <div>
              <h2>HR Portal</h2>
              <p className="muted">{user?.name || "User"}</p>
            </div>
          </div>

          <div className="user-mini">
            <div className="user-line">
              <span>Role</span>
              <strong>{user?.role || "-"}</strong>
            </div>

            <div className="user-line">
              <span>Division</span>
              <strong>{user?.division || "-"}</strong>
            </div>

            <div className="sidebar-badge-row">
              {user?.project ? <span className="soft-badge">{user.project}</span> : null}
              <span className="soft-badge warning">Unread {unreadCount}</span>
            </div>
          </div>
        </div>

        <nav>
          {navItems.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink key={item.to} to={item.to} end={item.to === "/"}>
                <Icon className="nav-icon" />
                <span className="nav-label">{item.label}</span>

                {item.to === "/notifications" && unreadCount > 0 ? (
                  <span className="nav-pill">{unreadCount}</span>
                ) : null}
              </NavLink>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <button className="ghost" onClick={logout}>
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </aside>

      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
