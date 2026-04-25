import { NavLink, Outlet } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
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
  Menu,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../services/api";
import LanguageSwitcher from "../components/LanguageSwitcher";
import ThemeToggle from "../components/ThemeToggle";

const NAV_ITEMS = [
  {
    to: "/",
    label: "Dashboard",
    icon: LayoutDashboard,
    roles: ["all"],
  },
  {
    to: "/attendance",
    label: "Attendance",
    icon: CalendarDays,
    roles: ["owner", "system_owner", "hr_manager", "hr_admin", "hr", "admin", "site_admin", "project_manager", "cm"],
  },
  {
    to: "/my-attendance",
    label: "My Attendance",
    icon: UserCheck,
    roles: ["all"],
  },
  {
    to: "/users",
    label: "Users",
    icon: Users,
    roles: ["owner", "system_owner", "hr_manager", "hr_admin", "hr", "admin"],
  },
  {
    to: "/projects",
    label: "Projects",
    icon: FolderKanban,
    roles: ["owner", "system_owner", "hr_manager", "hr_admin", "hr", "admin", "site_admin", "project_manager", "cm"],
  },
  {
    to: "/requests",
    label: "Requests",
    icon: FileText,
    roles: ["all"],
  },
  {
    to: "/reports",
    label: "Reports",
    icon: BarChart3,
    roles: ["owner", "system_owner", "hr_manager", "hr_admin", "hr", "admin", "site_admin", "project_manager", "cm"],
  },
  {
    to: "/notifications",
    label: "Notifications",
    icon: Bell,
    roles: ["all"],
    badge: "notifications",
  },
  {
    to: "/settings",
    label: "Settings",
    icon: Settings,
    roles: ["all"],
  },
  {
    to: "/security",
    label: "Security & Audit",
    icon: ShieldCheck,
    roles: ["owner", "system_owner", "hr_manager", "admin"],
  },
];

function normalizeRole(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function canSeeItem(item, userRole) {
  if (item.roles.includes("all")) return true;
  return item.roles.includes(userRole);
}

export default function AdminDesktopLayout() {
  const { user, logout } = useAuth();

  const [unreadCount, setUnreadCount] = useState(0);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem("hr_sidebar_collapsed") === "true";
    } catch {
      return false;
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  const userRole = normalizeRole(user?.roleCode || user?.role || user?.roleName);

  const visibleItems = useMemo(() => {
    return NAV_ITEMS.filter((item) => canSeeItem(item, userRole));
  }, [userRole]);

  useEffect(() => {
    try {
      localStorage.setItem("hr_sidebar_collapsed", String(collapsed));
    } catch {
      // ignore
    }
  }, [collapsed]);

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

  function closeMobileMenu() {
    setMobileOpen(false);
  }

  return (
    <div className={`admin-layout-pro ${collapsed ? "is-collapsed" : ""}`}>
      <style>{`
        .admin-layout-pro {
          min-height: 100vh;
          display: grid;
          grid-template-columns: 292px minmax(0, 1fr);
          background:
            radial-gradient(circle at top right, rgba(37, 99, 235, 0.08), transparent 35%),
            linear-gradient(135deg, #f8fafc 0%, #eef2f7 100%);
          transition: grid-template-columns 0.22s ease;
        }

        .admin-layout-pro.is-collapsed {
          grid-template-columns: 92px minmax(0, 1fr);
        }

        .admin-layout-pro .mobile-menu-btn {
          display: none;
        }

        .admin-layout-pro .sidebar-pro {
          position: sticky;
          top: 0;
          height: 100vh;
          overflow-y: auto;
          padding: 18px;
          background:
            radial-gradient(circle at top left, rgba(59, 130, 246, 0.24), transparent 28%),
            linear-gradient(180deg, #020617 0%, #0f172a 48%, #111827 100%);
          border-right: 1px solid rgba(148, 163, 184, 0.18);
          box-shadow: 18px 0 45px rgba(15, 23, 42, 0.16);
          display: flex;
          flex-direction: column;
          gap: 16px;
          z-index: 50;
        }

        .admin-layout-pro .brand-card {
          padding: 16px;
          border-radius: 24px;
          background: rgba(255, 255, 255, 0.075);
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
        }

        .admin-layout-pro .brand-top {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .admin-layout-pro .brand-logo {
          width: 42px;
          height: 42px;
          border-radius: 16px;
          display: grid;
          place-items: center;
          color: #fff;
          background: linear-gradient(135deg, #2563eb, #7c3aed);
          box-shadow: 0 12px 28px rgba(37, 99, 235, 0.35);
          flex: 0 0 auto;
        }

        .admin-layout-pro .brand-text {
          min-width: 0;
          transition: opacity 0.18s ease;
        }

        .admin-layout-pro .brand-text h2 {
          margin: 0;
          color: #fff;
          font-size: 1.12rem;
          font-weight: 950;
          letter-spacing: -0.02em;
          white-space: nowrap;
        }

        .admin-layout-pro .brand-text p {
          margin: 4px 0 0;
          color: #94a3b8;
          font-size: 0.82rem;
          font-weight: 800;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .admin-layout-pro .user-mini {
          margin-top: 14px;
          display: grid;
          gap: 8px;
        }

        .admin-layout-pro .user-line {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          color: #cbd5e1;
          font-size: 0.8rem;
          font-weight: 800;
        }

        .admin-layout-pro .sidebar-badge-row {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-top: 8px;
        }

        .admin-layout-pro .soft-badge {
          display: inline-flex;
          align-items: center;
          width: fit-content;
          max-width: 100%;
          min-height: 28px;
          padding: 0 10px;
          border-radius: 999px;
          background: rgba(59, 130, 246, 0.16);
          color: #bfdbfe;
          font-size: 0.72rem;
          font-weight: 900;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .admin-layout-pro .soft-badge.warning {
          background: rgba(245, 158, 11, 0.16);
          color: #fde68a;
        }

        .admin-layout-pro .collapse-btn {
          width: 100%;
          min-height: 38px;
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.06);
          color: #dbeafe;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          cursor: pointer;
          font-weight: 900;
        }

        .admin-layout-pro nav {
          display: grid;
          gap: 7px;
        }

        .admin-layout-pro nav a {
          position: relative;
          min-height: 48px;
          padding: 0 14px;
          border-radius: 16px;
          display: flex;
          align-items: center;
          gap: 12px;
          color: #cbd5e1;
          text-decoration: none;
          font-size: 0.92rem;
          font-weight: 850;
          transition: 0.18s ease;
          border: 1px solid transparent;
        }

        .admin-layout-pro nav a:hover {
          background: rgba(255,255,255,0.075);
          color: #fff;
          transform: translateX(4px);
          border-color: rgba(255,255,255,0.08);
        }

        .admin-layout-pro nav a.active {
          background: linear-gradient(135deg, rgba(37, 99, 235, 0.95), rgba(29, 78, 216, 0.95));
          color: #fff;
          box-shadow: 0 14px 30px rgba(37, 99, 235, 0.32);
        }

        .admin-layout-pro .nav-icon {
          width: 19px;
          height: 19px;
          flex: 0 0 auto;
        }

        .admin-layout-pro .nav-label {
          flex: 1;
          min-width: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .admin-layout-pro .nav-pill {
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

        .admin-layout-pro .sidebar-tools {
          display: grid;
          gap: 8px;
          margin-top: 8px;
          transition: opacity 0.18s ease;
        }

        .admin-layout-pro .sidebar-tools button,
        .admin-layout-pro .sidebar-tools select {
          width: 100%;
          min-height: 40px;
          border-radius: 14px;
        }

        .admin-layout-pro .sidebar-footer {
          margin-top: auto;
          padding-top: 12px;
          border-top: 1px solid rgba(255,255,255,0.08);
        }

        .admin-layout-pro .logout-btn {
          width: 100%;
          min-height: 46px;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 16px;
          background: rgba(255,255,255,0.06);
          color: #e2e8f0;
          font-weight: 900;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          transition: 0.18s ease;
        }

        .admin-layout-pro .logout-btn:hover {
          background: rgba(239, 68, 68, 0.16);
          color: #fff;
          border-color: rgba(248, 113, 113, 0.28);
          transform: translateY(-1px);
        }

        .admin-layout-pro .content {
          min-width: 0;
          padding: 22px;
          overflow-x: hidden;
          background: transparent;
        }

        .admin-layout-pro.is-collapsed .sidebar-pro {
          padding: 18px 14px;
        }

        .admin-layout-pro.is-collapsed .brand-card {
          padding: 14px 10px;
        }

        .admin-layout-pro.is-collapsed .brand-top {
          justify-content: center;
        }

        .admin-layout-pro.is-collapsed .brand-text,
        .admin-layout-pro.is-collapsed .user-mini,
        .admin-layout-pro.is-collapsed .sidebar-tools,
        .admin-layout-pro.is-collapsed .collapse-label,
        .admin-layout-pro.is-collapsed .nav-label,
        .admin-layout-pro.is-collapsed .logout-label {
          display: none;
        }

        .admin-layout-pro.is-collapsed nav a {
          justify-content: center;
          padding: 0;
        }

        .admin-layout-pro.is-collapsed nav a:hover::after {
          content: attr(title);
          position: absolute;
          left: calc(100% + 10px);
          top: 50%;
          transform: translateY(-50%);
          background: #0f172a;
          color: #fff;
          padding: 8px 10px;
          border-radius: 10px;
          white-space: nowrap;
          box-shadow: 0 12px 30px rgba(15,23,42,0.22);
          z-index: 200;
          font-size: 0.78rem;
        }

        .admin-layout-pro.is-collapsed .nav-pill {
          position: absolute;
          top: -5px;
          right: -5px;
          min-width: 20px;
          height: 20px;
          font-size: 0.66rem;
        }

        .admin-layout-pro.is-collapsed .logout-btn {
          padding: 0;
        }

        .admin-layout-pro .mobile-overlay {
          display: none;
        }

        @media (max-width: 900px) {
          .admin-layout-pro,
          .admin-layout-pro.is-collapsed {
            grid-template-columns: 1fr;
          }

          .admin-layout-pro .mobile-menu-btn {
            position: fixed;
            top: 14px;
            left: 14px;
            z-index: 120;
            width: 44px;
            height: 44px;
            border-radius: 14px;
            border: none;
            background: #1d4ed8;
            color: #fff;
            display: grid;
            place-items: center;
            box-shadow: 0 12px 30px rgba(37,99,235,0.28);
          }

          .admin-layout-pro .sidebar-pro {
            position: fixed;
            left: 0;
            top: 0;
            width: 292px;
            height: 100vh;
            transform: translateX(-105%);
            transition: transform 0.22s ease;
          }

          .admin-layout-pro.mobile-open .sidebar-pro {
            transform: translateX(0);
          }

          .admin-layout-pro.mobile-open .mobile-overlay {
            display: block;
            position: fixed;
            inset: 0;
            z-index: 40;
            background: rgba(15, 23, 42, 0.46);
          }

          .admin-layout-pro .content {
            padding: 70px 14px 14px;
          }

          .admin-layout-pro.is-collapsed .brand-text,
          .admin-layout-pro.is-collapsed .user-mini,
          .admin-layout-pro.is-collapsed .sidebar-tools,
          .admin-layout-pro.is-collapsed .collapse-label,
          .admin-layout-pro.is-collapsed .nav-label,
          .admin-layout-pro.is-collapsed .logout-label {
            display: initial;
          }

          .admin-layout-pro.is-collapsed nav a {
            justify-content: flex-start;
            padding: 0 14px;
          }

          .admin-layout-pro.is-collapsed .sidebar-pro {
            padding: 18px;
          }

          .admin-layout-pro.is-collapsed .brand-top {
            justify-content: flex-start;
          }
        }
      `}</style>

      <button
        type="button"
        className="mobile-menu-btn"
        onClick={() => setMobileOpen(true)}
        aria-label="Open menu"
      >
        <Menu size={22} />
      </button>

      <div
        className={`mobile-overlay ${mobileOpen ? "show" : ""}`}
        onClick={closeMobileMenu}
      />

      <aside className="sidebar-pro">
        <div className="brand-card">
          <div className="brand-top">
            <div className="brand-logo">
              <Sparkles size={21} />
            </div>

            <div className="brand-text">
              <h2>HR Portal</h2>
              <p>{user?.name || "User"}</p>
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

        <button
          type="button"
          className="collapse-btn"
          onClick={() => setCollapsed((value) => !value)}
        >
          {collapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
          <span className="collapse-label">{collapsed ? "Expand" : "Collapse"}</span>
        </button>

        <nav>
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const badgeValue = item.badge === "notifications" ? unreadCount : 0;

            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                title={item.label}
                onClick={closeMobileMenu}
              >
                <Icon className="nav-icon" />
                <span className="nav-label">{item.label}</span>

                {badgeValue > 0 ? <span className="nav-pill">{badgeValue}</span> : null}
              </NavLink>
            );
          })}
        </nav>

        <div className="sidebar-tools">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>

        <div className="sidebar-footer">
          <button className="logout-btn" onClick={logout}>
            <LogOut size={18} />
            <span className="logout-label">Logout</span>
          </button>
        </div>
      </aside>

      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
