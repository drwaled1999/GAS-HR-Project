import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useEffect, useState } from "react";
import { apiFetch } from "../services/api";
import LanguageSwitcher from "../components/LanguageSwitcher";
import ThemeToggle from "../components/ThemeToggle";

export default function AdminDesktopLayout() {
  const { user, logout } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let timer;

    async function loadNotifications() {
      if (!user?.username) return;

      try {
        const res = await apiFetch(`/notifications?username=${user.username}`);
        setUnreadCount(res.unreadCount || 0);
      } catch {
        setUnreadCount(0);
      }
    }

    loadNotifications();
    timer = setInterval(loadNotifications, 10000);

    return () => clearInterval(timer);
  }, [user?.username]);

  return (
    <div className="layout">
      <style>{`
        .layout {
          display: flex;
          min-height: 100vh;
        }

        .sidebar-pro {
          width: 250px;
          background: linear-gradient(180deg, #020617, #0f172a);
          padding: 20px;
          display: flex;
          flex-direction: column;
        }

        .brand h2 {
          color: #fff;
          margin: 0;
          font-size: 1.3rem;
        }

        .brand p {
          color: #94a3b8;
          font-size: 0.85rem;
          margin-bottom: 20px;
        }

        .sidebar-pro nav {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .sidebar-pro nav a {
          padding: 12px;
          border-radius: 12px;
          color: #cbd5f5;
          text-decoration: none;
          font-weight: 700;
          transition: 0.2s;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .sidebar-pro nav a:hover {
          background: #1e293b;
          color: #fff;
          transform: translateX(5px);
        }

        .sidebar-pro nav a.active {
          background: linear-gradient(135deg, #2563eb, #1d4ed8);
          color: #fff;
        }

        .badge {
          background: red;
          color: #fff;
          border-radius: 999px;
          padding: 2px 6px;
          font-size: 0.7rem;
        }

        .sidebar-tools {
          display: grid;
          gap: 8px;
          margin-top: 14px;
        }

        .sidebar-tools button,
        .sidebar-tools select {
          width: 100%;
          min-height: 40px;
          border-radius: 12px;
        }

        .logout-btn {
          margin-top: auto;
          padding: 10px;
          border-radius: 12px;
          background: rgba(255,255,255,0.05);
          color: #fff;
          border: none;
          cursor: pointer;
        }

        .content {
          flex: 1;
          padding: 20px;
          background: #f8fafc;
        }
      `}</style>

      {/* 🔥 Sidebar */}
      <aside className="sidebar-pro">
        <div className="brand">
          <h2>HR Portal</h2>
          <p>{user?.name}</p>
        </div>

        <nav>
          <NavLink to="/">🏠 Dashboard</NavLink>
          <NavLink to="/attendance">📅 Attendance</NavLink>
          <NavLink to="/my-attendance">👤 My Attendance</NavLink>
          <NavLink to="/users">👥 Users</NavLink>
          <NavLink to="/projects">📁 Projects</NavLink>
          <NavLink to="/requests">📄 Requests</NavLink>
          <NavLink to="/reports">📊 Reports</NavLink>

          <NavLink to="/notifications">
            🔔 Notifications
            {unreadCount > 0 && <span className="badge">{unreadCount}</span>}
          </NavLink>

          <NavLink to="/settings">⚙️ Settings</NavLink>
          <NavLink to="/security">🔐 Security</NavLink>
        </nav>

        {/* 🌐 + 🌙 */}
        <div className="sidebar-tools">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>

        <button className="logout-btn" onClick={logout}>
          🚪 Logout
        </button>
      </aside>

      {/* 🔥 Content */}
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
