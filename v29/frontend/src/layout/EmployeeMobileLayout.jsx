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
  Sparkles,
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
          background:
            radial-gradient(circle at top right, rgba(37, 99, 235, 0.18), transparent 34%),
            linear-gradient(180deg, #071226 0%, #10255a 46%, #123a8c 100%);
          color: #0f172a;
          overflow-x: hidden;
        }

        .employee-mobile-pro .mobile-hero-top {
          position: sticky;
          top: 0;
          z-index: 40;
          padding: 14px 14px 12px;
          background:
            radial-gradient(circle at top left, rgba(59, 130, 246, 0.26), transparent 34%),
            linear-gradient(135deg, #020617 0%, #0f172a 55%, #1e3a8a 100%);
          color: #fff;
          box-shadow: 0 14px 40px rgba(15, 23, 42, 0.18);
          border-bottom-left-radius: 24px;
          border-bottom-right-radius: 24px;
        }

        .employee-mobile-pro .top-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .employee-mobile-pro .menu-btn,
        .employee-mobile-pro .alert-btn {
          position: relative;
          width: 44px;
          height: 44px;
          border-radius: 15px;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.10);
          color: #fff;
          display: grid;
          place-items: center;
          padding: 0;
        }

        .employee-mobile-pro .brand-mini {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          min-width: 0;
        }

        .employee-mobile-pro .brand-logo {
          width: 82px;
          height: 42px;
          border-radius: 0;
          background: transparent;
          display: grid;
          place-items: center;
          flex: 0 0 auto;
          padding: 0;
          box-shadow: none;
          overflow: visible;
        }

        .employee-mobile-pro .brand-logo img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          filter: drop-shadow(0 8px 18px rgba(0,0,0,0.28));
        }

        .employee-mobile-pro .brand-text {
          min-width: 0;
        }

        .employee-mobile-pro .brand-text strong {
          display: block;
          font-size: 1rem;
          font-weight: 950;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .employee-mobile-pro .brand-text span {
          display: block;
          margin-top: 3px;
          color: rgba(255,255,255,0.72);
          font-size: 0.78rem;
          font-weight: 800;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .employee-mobile-pro .alert-dot {
          position: absolute;
          top: -4px;
          right: -4px;
          min-width: 21px;
          height: 21px;
          padding: 0 6px;
          border-radius: 999px;
          background: #ef4444;
          color: #fff;
          font-size: 0.68rem;
          font-weight: 950;
          display: grid;
          place-items: center;
          border: 2px solid #0f172a;
        }

        .employee-mobile-pro .hero-card {
          margin-top: 14px;
          padding: 16px;
          border-radius: 22px;
          background: rgba(255,255,255,0.12);
          border: 1px solid rgba(255,255,255,0.14);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .employee-mobile-pro .hero-card p {
          margin: 0;
          color: rgba(255,255,255,0.76);
          font-size: 0.8rem;
          font-weight: 800;
        }

        .employee-mobile-pro .hero-card h2 {
          margin: 6px 0 0;
          font-size: 1.2rem;
          font-weight: 950;
          color: #fff;
        }

        .employee-mobile-pro .spark-box {
          width: 46px;
          height: 46px;
          border-radius: 16px;
          background: linear-gradient(135deg, #2563eb, #0ea5e9);
          display: grid;
          place-items: center;
          color: #fff;
          box-shadow: 0 14px 28px rgba(37,99,235,0.28);
          flex: 0 0 auto;
        }

        .employee-mobile-pro .mobile-content-pro {
          padding: 16px 12px 96px;
        }

        /* إصلاح بهتان صفحات الموظف */
        .employee-mobile-pro .mobile-content-pro .card,
        .employee-mobile-pro .mobile-content-pro .mobile-stat,
        .employee-mobile-pro .mobile-content-pro .mobile-list-card,
        .employee-mobile-pro .mobile-content-pro .mobile-filter-card,
        .employee-mobile-pro .mobile-content-pro .attendance-mobile-card,
        .employee-mobile-pro .mobile-content-pro .request-mobile-card,
        .employee-mobile-pro .mobile-content-pro .request-mobile-card-v2,
        .employee-mobile-pro .mobile-content-pro .profile-grid .list-row,
        .employee-mobile-pro .mobile-content-pro .mini-day,
        .employee-mobile-pro .mobile-content-pro .list-row {
          background: #ffffff !important;
          color: #0f172a !important;
          border: 1px solid #e2e8f0 !important;
          box-shadow: 0 12px 32px rgba(15, 23, 42, 0.08) !important;
          opacity: 1 !important;
        }

        .employee-mobile-pro .mobile-content-pro h1,
        .employee-mobile-pro .mobile-content-pro h2,
        .employee-mobile-pro .mobile-content-pro h3,
        .employee-mobile-pro .mobile-content-pro strong {
          color: #0f172a !important;
          opacity: 1 !important;
        }

        .employee-mobile-pro .mobile-content-pro p,
        .employee-mobile-pro .mobile-content-pro span,
        .employee-mobile-pro .mobile-content-pro small,
        .employee-mobile-pro .mobile-content-pro label {
          color: #475569 !important;
          opacity: 1 !important;
        }

        .employee-mobile-pro .mobile-content-pro input,
        .employee-mobile-pro .mobile-content-pro select,
        .employee-mobile-pro .mobile-content-pro textarea {
          background: #ffffff !important;
          color: #0f172a !important;
          border: 1px solid #cbd5e1 !important;
          opacity: 1 !important;
        }

        .employee-mobile-pro .mobile-content-pro input::placeholder,
        .employee-mobile-pro .mobile-content-pro textarea::placeholder {
          color: #94a3b8 !important;
        }

        .employee-mobile-pro .mobile-content-pro .soft-badge {
          background: #eef2ff !important;
          color: #3730a3 !important;
          opacity: 1 !important;
        }

        .employee-mobile-pro .mobile-content-pro .soft-badge.success {
          background: #ecfdf5 !important;
          color: #166534 !important;
        }

        .employee-mobile-pro .mobile-content-pro .soft-badge.danger {
          background: #fef2f2 !important;
          color: #991b1b !important;
        }

        .employee-mobile-pro .mobile-content-pro .mobile-stat.danger strong {
          color: #b91c1c !important;
        }

        .employee-mobile-pro .mobile-content-pro .mobile-stat.warning strong {
          color: #b45309 !important;
        }

        .employee-mobile-pro .mobile-content-pro .mobile-stat.info strong {
          color: #1d4ed8 !important;
        }

        .employee-mobile-pro .mobile-content-pro .attendance-mobile-card.present {
          border-left: 5px solid #16a34a !important;
        }

        .employee-mobile-pro .mobile-content-pro .attendance-mobile-card.absent {
          border-left: 5px solid #dc2626 !important;
        }

        .employee-mobile-pro .mobile-content-pro .attendance-mobile-card.single {
          border-left: 5px solid #f59e0b !important;
        }

        .employee-mobile-pro .drawer-overlay {
          position: fixed;
          inset: 0;
          z-index: 80;
          background: rgba(15, 23, 42, 0.52);
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.2s ease;
        }

        .employee-mobile-pro.menu-open .drawer-overlay {
          opacity: 1;
          pointer-events: auto;
        }

        .employee-mobile-pro .drawer {
          position: fixed;
          top: 0;
          bottom: 0;
          left: 0;
          z-index: 90;
          width: min(84vw, 330px);
          padding: 16px;
          background:
            radial-gradient(circle at top left, rgba(59, 130, 246, 0.24), transparent 34%),
            linear-gradient(180deg, #020617 0%, #0f172a 55%, #111827 100%);
          color: #fff;
          transform: translateX(-105%);
          transition: transform 0.24s ease;
          box-shadow: 20px 0 55px rgba(15,23,42,0.32);
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .employee-mobile-pro.menu-open .drawer {
          transform: translateX(0);
        }

        .employee-mobile-pro .drawer-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 10px;
          border-radius: 20px;
          background: rgba(255,255,255,0.075);
          border: 1px solid rgba(255,255,255,0.10);
        }

        .employee-mobile-pro .drawer-user strong {
          display: block;
          font-size: 1rem;
          font-weight: 950;
          color: #fff;
        }

        .employee-mobile-pro .drawer-user span {
          display: block;
          margin-top: 3px;
          color: rgba(255,255,255,0.66);
          font-size: 0.78rem;
          font-weight: 800;
        }

        .employee-mobile-pro .close-btn {
          width: 40px;
          height: 40px;
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.08);
          color: #fff;
          display: grid;
          place-items: center;
          padding: 0;
        }

        .employee-mobile-pro .drawer-nav {
          display: grid;
          gap: 8px;
        }

        .employee-mobile-pro .drawer-nav a {
          min-height: 48px;
          border-radius: 16px;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 0 14px;
          color: #cbd5e1;
          text-decoration: none;
          font-weight: 900;
          border: 1px solid transparent;
          position: relative;
        }

        .employee-mobile-pro .drawer-nav a.active {
          color: #fff;
          background: linear-gradient(135deg, #2563eb, #1d4ed8);
          box-shadow: 0 12px 26px rgba(37,99,235,0.28);
        }

        .employee-mobile-pro .drawer-badge {
          margin-left: auto;
          min-width: 24px;
          height: 24px;
          padding: 0 7px;
          border-radius: 999px;
          background: #ef4444;
          color: #fff;
          font-size: 0.7rem;
          font-weight: 950;
          display: grid;
          place-items: center;
        }

        .employee-mobile-pro .drawer-tools {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-top: 6px;
        }

        .employee-mobile-pro .drawer-tools button,
        .employee-mobile-pro .drawer-tools select {
          width: 100%;
          min-height: 42px;
          border-radius: 14px;
        }

        .employee-mobile-pro .logout-mobile {
          margin-top: auto;
          min-height: 46px;
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.10);
          background: rgba(239,68,68,0.14);
          color: #fff;
          font-weight: 950;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
        }

        html.dark .employee-mobile-pro {
          background:
            radial-gradient(circle at top right, rgba(37, 99, 235, 0.16), transparent 34%),
            linear-gradient(180deg, #0b1220 0%, #0f1728 100%);
        }

        html.dark .employee-mobile-pro .mobile-content-pro .card,
        html.dark .employee-mobile-pro .mobile-content-pro .mobile-stat,
        html.dark .employee-mobile-pro .mobile-content-pro .mobile-list-card,
        html.dark .employee-mobile-pro .mobile-content-pro .mobile-filter-card,
        html.dark .employee-mobile-pro .mobile-content-pro .attendance-mobile-card,
        html.dark .employee-mobile-pro .mobile-content-pro .request-mobile-card,
        html.dark .employee-mobile-pro .mobile-content-pro .request-mobile-card-v2,
        html.dark .employee-mobile-pro .mobile-content-pro .profile-grid .list-row,
        html.dark .employee-mobile-pro .mobile-content-pro .mini-day,
        html.dark .employee-mobile-pro .mobile-content-pro .list-row {
          background: #111a2d !important;
          color: #e5eefc !important;
          border-color: #24324d !important;
        }

        html.dark .employee-mobile-pro .mobile-content-pro h1,
        html.dark .employee-mobile-pro .mobile-content-pro h2,
        html.dark .employee-mobile-pro .mobile-content-pro h3,
        html.dark .employee-mobile-pro .mobile-content-pro strong {
          color: #e5eefc !important;
        }

        html.dark .employee-mobile-pro .mobile-content-pro p,
        html.dark .employee-mobile-pro .mobile-content-pro span,
        html.dark .employee-mobile-pro .mobile-content-pro small,
        html.dark .employee-mobile-pro .mobile-content-pro label {
          color: #9fb0cf !important;
        }
      `}</style>

      <header className="mobile-hero-top">
        <div className="top-row">
          <button className="menu-btn" type="button" onClick={() => setOpen(true)}>
            <Menu size={22} />
          </button>

          <div className="brand-mini">
            <div className="brand-logo">
              <img src="/logo.svg" alt="GAS" />
            </div>

            <div className="brand-text">
              <strong>Employee Portal</strong>
              <span>{user?.name || user?.username || "-"}</span>
            </div>
          </div>

          <NavLink to="/notifications" className="alert-btn">
            <Bell size={20} />
            {unreadCount > 0 ? <span className="alert-dot">{unreadCount}</span> : null}
          </NavLink>
        </div>

        <div className="hero-card">
          <div>
            <p>Welcome back</p>
            <h2>{user?.name || user?.username || "Employee"}</h2>
          </div>
          <div className="spark-box">
            <Sparkles size={21} />
          </div>
        </div>
      </header>

      <main className="mobile-content-pro">
        <Outlet />
      </main>

      <BottomNav unreadCount={unreadCount} />

      <div className="drawer-overlay" onClick={closeMenu} />

      <aside className="drawer">
        <div className="drawer-head">
          <div className="drawer-user">
            <strong>{user?.name || "Employee"}</strong>
            <span>{user?.role || "Employee"}</span>
          </div>

          <button className="close-btn" type="button" onClick={closeMenu}>
            <X size={20} />
          </button>
        </div>

        <nav className="drawer-nav">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isAlerts = item.to === "/notifications";

            return (
              <NavLink key={item.to} to={item.to} end={item.end} onClick={closeMenu}>
                <Icon size={19} />
                <span>{item.label}</span>
                {isAlerts && unreadCount > 0 ? (
                  <span className="drawer-badge">{unreadCount}</span>
                ) : null}
              </NavLink>
            );
          })}
        </nav>

        <div className="drawer-tools">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>

        <button className="logout-mobile" type="button" onClick={logout}>
          <LogOut size={18} />
          Logout
        </button>
      </aside>
    </div>
  );
}
