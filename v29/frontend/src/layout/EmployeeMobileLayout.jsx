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
  { to: "/Data Update", path: "data-update", icon: FileText },
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

    return () => clearTimeout(timer);
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

        /* 🔥 HEADER */
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
          width: 42px;
          height: 42px;
          border-radius: 12px;
          border: none;
          background: rgba(255,255,255,0.1);
          color: white;
          display: grid;
          place-items: center;
        }

        .brand-logo {
          width: 80px;
          height: 40px;
        }

        .brand-logo img {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }

        .alert-dot {
          position: absolute;
          top: -4px;
          right: -4px;
          background: red;
          color: white;
          font-size: 10px;
          border-radius: 50%;
          padding: 2px 5px;
        }

        main {
          padding: 14px;
          padding-bottom: 90px;
        }

        /* drawer */
        .drawer {
          position: fixed;
          left: 0;
          top: 0;
          height: 100%;
          width: 260px;
          background: #020617;
          transform: translateX(-100%);
          transition: 0.3s;
          z-index: 100;
          padding: 20px;
        }

        .menu-open .drawer {
          transform: translateX(0);
        }

        .overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.5);
          display: none;
        }

        .menu-open .overlay {
          display: block;
        }

        .drawer a {
          display: block;
          padding: 12px;
          border-radius: 12px;
          color: white;
          text-decoration: none;
          margin-bottom: 6px;
        }

        .drawer a.active {
          background: #2563eb;
        }

        .logout {
          margin-top: auto;
          background: #ef4444;
          border: none;
          width: 100%;
          padding: 12px;
          border-radius: 12px;
          color: white;
        }
      `}</style>

      {/* 🔥 HEADER */}
      <header className="mobile-hero-top">
        <div className="top-row">
          <button className="menu-btn" onClick={() => setOpen(true)}>
            <Menu size={20} />
          </button>

          <div className="brand-logo">
            <img src="/logo.svg" />
          </div>

          <NavLink to="/notifications" className="alert-btn">
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="alert-dot">{unreadCount}</span>
            )}
          </NavLink>
        </div>
      </header>

      {/* 🔥 CONTENT */}
      <main>
        <Outlet />
      </main>

      <BottomNav unreadCount={unreadCount} />

      <div className="overlay" onClick={closeMenu}></div>

      {/* 🔥 DRAWER */}
      <div className="drawer">
        <button onClick={closeMenu}>
          <X />
        </button>

        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink key={item.to} to={item.to} onClick={closeMenu}>
              <Icon size={18} /> {item.label}
            </NavLink>
          );
        })}

        <LanguageSwitcher />
        <ThemeToggle />

        <button className="logout" onClick={logout}>
          <LogOut size={16} /> Logout
        </button>
      </div>
    </div>
  );
}
