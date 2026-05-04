import { Outlet, NavLink } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  Menu,
  X,
  Home,
  CalendarDays,
  FileText,
  Bell,
  User,
  LogOut,
  Database,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../services/api";
import BottomNav from "../components/BottomNav";
import LanguageSwitcher from "../components/LanguageSwitcher";
import ThemeToggle from "../components/ThemeToggle";

const menuItems = [
  { to: "/", label: "Home", icon: Home, end: true },
  { to: "/attendance", label: "Attendance", icon: CalendarDays },
  { to: "/requests", label: "Requests", icon: FileText },
  { to: "/data-update", label: "Data Update", icon: Database },
  { to: "/notifications", label: "Alerts", icon: Bell },
  { to: "/profile", label: "Profile", icon: User },
];

export default function EmployeeMobileLayout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
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

  function closeMenu() {
    setOpen(false);
  }

  return (
    <div className={`employee-mobile-pro ${open ? "menu-open" : ""}`}>
      <style>{`
        .employee-mobile-pro {
          min-height: 100vh;
          background: linear-gradient(180deg, #071226 0%, #123a8c 100%);
          overflow-x: hidden;
        }

        .mobile-hero-top {
          position: sticky;
          top: 0;
          z-index: 40;
          padding: 14px;
          background: linear-gradient(135deg, #020617, #1e3a8a);
          color: #fff;
          border-bottom-left-radius: 20px;
          border-bottom-right-radius: 20px;
        }

        .top-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .menu-btn,
        .alert-btn {
          width: 46px;
          height: 46px;
          border-radius: 16px;
          border: none;
          background: rgba(255,255,255,0.12);
          color: white;
          display: grid;
          place-items: center;
          position: relative;
          text-decoration: none;
        }

        .brand-logo {
          width: 92px;
          height: 42px;
        }

        .brand-logo img {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }

        .alert-dot {
          position: absolute;
          top: -5px;
          right: -5px;
          background: #ef4444;
          color: white;
          font-size: 11px;
          font-weight: 900;
          border-radius: 999px;
          padding: 2px 6px;
          border: 2px solid #1e3a8a;
        }

        main {
          padding: 14px;
          padding-bottom: 100px;
          min-height: calc(100vh - 74px);
        }

        .overlay {
          position: fixed;
          inset: 0;
          background: rgba(2, 6, 23, 0.62);
          opacity: 0;
          visibility: hidden;
          transition: 0.25s ease;
          z-index: 90;
        }

        .menu-open .overlay {
          opacity: 1;
          visibility: visible;
        }

        .drawer {
          position: fixed;
          left: 0;
          top: 0;
          height: 100dvh;
          width: min(86vw, 340px);
          background: linear-gradient(180deg, #020617, #0f172a);
          transform: translateX(-105%);
          transition: 0.28s ease;
          z-index: 110;
          padding: 18px;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          box-shadow: 28px 0 70px rgba(0,0,0,0.42);
        }

        .menu-open .drawer {
          transform: translateX(0);
        }

        .drawer-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 18px;
        }

        .drawer-title {
          color: #fff;
          font-weight: 900;
          font-size: 18px;
        }

        .drawer-subtitle {
          color: #94a3b8;
          font-size: 12px;
          font-weight: 700;
          margin-top: 3px;
        }

        .close-drawer {
          width: 46px;
          height: 46px;
          border: none;
          border-radius: 16px;
          background: #2563eb;
          color: #fff;
          display: grid;
          place-items: center;
        }

        .drawer-nav {
          display: grid;
          gap: 8px;
        }

        .drawer-nav a {
          display: flex;
          align-items: center;
          gap: 12px;
          min-height: 48px;
          padding: 0 14px;
          border-radius: 16px;
          color: #e5e7eb;
          text-decoration: none;
          font-weight: 850;
          font-size: 16px;
        }

        .drawer-nav a.active {
          background: #2563eb;
          color: #fff;
          box-shadow: 0 12px 30px rgba(37,99,235,0.32);
        }

        .drawer-tools {
          margin-top: auto;
          display: grid;
          gap: 10px;
        }

        .drawer-switches {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .logout {
          background: #ef4444;
          border: none;
          width: 100%;
          min-height: 50px;
          border-radius: 16px;
          color: white;
          font-weight: 900;
          font-size: 16px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
        }
      `}</style>

      <header className="mobile-hero-top">
        <div className="top-row">
          <button className="menu-btn" onClick={() => setOpen(true)}>
            <Menu size={22} />
          </button>

          <div className="brand-logo">
            <img src="/logo.svg" alt="GAS" />
          </div>

          <NavLink to="/notifications" className="alert-btn">
            <Bell size={22} />
            {unreadCount > 0 && <span className="alert-dot">{unreadCount}</span>}
          </NavLink>
        </div>
      </header>

      <main>
        <Outlet />
      </main>

      <BottomNav unreadCount={unreadCount} />

      <div className="overlay" onClick={closeMenu} />

      <aside className="drawer">
        <div className="drawer-top">
          <div>
            <div className="drawer-title">Employee Portal</div>
            <div className="drawer-subtitle">
              {user?.name || user?.full_name || user?.username || "Employee"}
            </div>
          </div>

          <button className="close-drawer" onClick={closeMenu}>
            <X size={22} />
          </button>
        </div>

        <nav className="drawer-nav">
          {menuItems.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={closeMenu}
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="drawer-tools">
          <div className="drawer-switches">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>

          <button className="logout" onClick={logout}>
            <LogOut size={18} /> Logout
          </button>
        </div>
      </aside>
    </div>
  );
}
