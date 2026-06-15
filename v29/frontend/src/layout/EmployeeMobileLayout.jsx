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
  Award,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../services/api";
import BottomNav from "../components/BottomNav";
import LanguageSwitcher from "../components/LanguageSwitcher";
import ThemeToggle from "../components/ThemeToggle";

const menuItems = [
  { to: "/", label: "Home", icon: Home, end: true },
  { to: "/performance", label: "Performance", icon: Award },
  { to: "/my-project-attendance", label: "Project", icon: CalendarDays },
  { to: "/requests", label: "Requests", icon: FileText },
  { to: "/meetings", label: "Meetings", icon: CalendarDays },
  { to: "/data-update", label: "Data Update", icon: Database },
  { to: "/notifications", label: "Alerts", icon: Bell },
  { to: "/profile", label: "Profile", icon: User },
];

export default function EmployeeMobileLayout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

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
          background: rgba(2, 6, 23, 0.68);
          backdrop-filter: blur(3px);
          -webkit-backdrop-filter: blur(3px);
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
          width: min(88vw, 380px);
          background:
            radial-gradient(circle at top right, rgba(37,99,235,.22), transparent 34%),
            linear-gradient(180deg, #020617, #0f172a 65%, #020617);
          transform: translateX(-105%);
          transition: 0.28s cubic-bezier(.2,.8,.2,1);
          z-index: 110;
          padding: 20px;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          box-shadow: 32px 0 80px rgba(0,0,0,0.50);
          border-right: 1px solid rgba(255,255,255,.08);
        }

        .menu-open .drawer {
          transform: translateX(0);
        }

        .drawer-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }

        .drawer-title {
          color: #fff;
          font-weight: 950;
          font-size: 20px;
          letter-spacing: -.03em;
        }

        .drawer-subtitle {
          color: #94a3b8;
          font-size: 13px;
          font-weight: 800;
          margin-top: 5px;
        }

        .close-drawer {
          width: 50px;
          height: 50px;
          border: none;
          border-radius: 18px;
          background: linear-gradient(135deg, #3b82f6, #1d4ed8);
          color: #fff;
          display: grid;
          place-items: center;
          box-shadow: 0 16px 34px rgba(37,99,235,.34);
        }

        .drawer-nav {
          display: grid;
          gap: 10px;
        }

        .drawer-nav a {
          display: flex;
          align-items: center;
          gap: 14px;
          min-height: 56px;
          padding: 0 16px;
          border-radius: 18px;
          color: #e5e7eb;
          text-decoration: none;
          font-weight: 900;
          font-size: 17px;
          transition: all .2s ease;
          border: 1px solid transparent;
        }

        .drawer-nav a svg {
          flex: 0 0 auto;
          opacity: .95;
        }

        .drawer-nav a.active {
          background:
            radial-gradient(circle at 20% 10%, rgba(255,255,255,.18), transparent 32%),
            linear-gradient(135deg, #2563eb, #1d4ed8);
          color: #fff;
          box-shadow: 0 15px 35px rgba(37,99,235,.35);
          transform: translateX(4px);
          border-color: rgba(255,255,255,.16);
        }

        .drawer-tools {
          margin-top: auto;
          display: grid;
          gap: 12px;
          padding-top: 18px;
        }

        .drawer-switches {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .logout {
          background: linear-gradient(135deg, #ef4444, #dc2626);
          border: none;
          width: 100%;
          min-height: 52px;
          border-radius: 18px;
          color: white;
          font-weight: 950;
          font-size: 16px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          box-shadow: 0 16px 34px rgba(239,68,68,.28);
        }

        @media (max-width: 430px) {
          .drawer {
            width: 78vw;
            padding: 18px;
          }

          .drawer-nav a {
            min-height: 54px;
            font-size: 16px;
          }
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

      {!open && <BottomNav unreadCount={unreadCount} />}

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
