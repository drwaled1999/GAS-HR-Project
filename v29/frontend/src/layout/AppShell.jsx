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
          grid-template-columns: 280px 1fr;
        }

        .shell-pro .sidebar-pro {
          height: 100vh;
          background: linear-gradient(180deg, #020617, #0f172a);
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .brand-card {
          background: rgba(255,255,255,0.05);
          padding: 16px;
          border-radius: 20px;
        }

        .brand-top {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .brand-logo {
          width: 40px;
          height: 40px;
          background: linear-gradient(135deg, #2563eb, #7c3aed);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
        }

        .brand-card h2 {
          color: #fff;
          margin: 0;
        }

        .muted {
          color: #94a3b8;
          font-size: 0.85rem;
        }

        nav {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        nav a {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          border-radius: 12px;
          color: #cbd5f5;
          text-decoration: none;
          transition: 0.2s;
        }

        nav a:hover {
          background: #1e293b;
          color: #fff;
          transform: translateX(5px);
        }

        nav a.active {
          background: linear-gradient(135deg, #2563eb, #1d4ed8);
          color: #fff;
        }

        .nav-pill {
          margin-left: auto;
          background: red;
          color: #fff;
          padding: 2px 6px;
          border-radius: 999px;
          font-size: 0.7rem;
        }

        .ghost {
          margin-top: auto;
          padding: 10px;
          border-radius: 12px;
          border: none;
          background: rgba(255,255,255,0.05);
          color: #fff;
          cursor: pointer;
        }

        .content {
          padding: 20px;
        }
      `}</style>

      <aside className="sidebar-pro">
        <div className="brand-card">
          <div className="brand-top">
            <div className="brand-logo">
              <Sparkles size={18} />
            </div>
            <div>
              <h2>HR Portal</h2>
              <p className="muted">{user?.name}</p>
            </div>
          </div>
        </div>

        <nav>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink key={item.to} to={item.to} end={item.to === "/"}>
                <Icon size={18} />
                {item.label}
                {item.to === "/notifications" && unreadCount > 0 && (
                  <span className="nav-pill">{unreadCount}</span>
                )}
              </NavLink>
            );
          })}
        </nav>

        <button className="ghost" onClick={logout}>
          <LogOut size={16} />
          Logout
        </button>
      </aside>

      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
