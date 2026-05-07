import { NavLink, Outlet } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard,
  CalendarDays,
  UserCheck,
  Users,
  Database,
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
  Upload,
  UserPlus,
  Search,
  Circle,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../services/api";
import LanguageSwitcher from "../components/LanguageSwitcher";
import ThemeToggle from "../components/ThemeToggle";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, roles: ["all"], section: "WORKFORCE" },
  {
    to: "/attendance",
    label: "Attendance",
    icon: CalendarDays,
    roles: ["owner", "system_owner", "hr_manager", "hr_admin", "hr", "admin", "site_admin", "project_manager", "cm"],
    section: "WORKFORCE",
  },
  { to: "/my-attendance", label: "My Attendance", icon: UserCheck, roles: ["all"], section: "WORKFORCE" },
  {
    to: "/project-employees",
    label: "Project Employees",
    icon: Users,
    roles: ["owner", "system_owner", "hr_manager", "hr_admin", "hr", "admin"],
    section: "WORKFORCE",
  },
  {
    to: "/projects",
    label: "Projects",
    icon: FolderKanban,
    roles: ["owner", "system_owner", "hr_manager", "hr_admin", "hr", "admin", "site_admin", "project_manager", "cm"],
    section: "OPERATIONS",
  },
  { to: "/requests", label: "Requests", icon: FileText, roles: ["all"], section: "OPERATIONS" },
  {
    to: "/reports",
    label: "Reports",
    icon: BarChart3,
    roles: ["owner", "system_owner", "hr_manager", "hr_admin", "hr", "admin", "site_admin", "project_manager", "cm"],
    section: "OPERATIONS",
  },
  {
    to: "/users",
    label: "Users",
    icon: Users,
    roles: ["owner", "system_owner", "hr_manager", "hr_admin", "hr", "admin"],
    section: "MANAGEMENT",
  },
  {
    to: "/admin/employee-services",
    label: "Employee Services",
    icon: Database,
    roles: ["owner", "system_owner", "hr_manager", "hr_admin", "hr", "admin"],
    section: "MANAGEMENT",
  },
  { to: "/settings", label: "Settings", icon: Settings, roles: ["all"], section: "SYSTEM" },
  {
    to: "/security",
    label: "Security & Audit",
    icon: ShieldCheck,
    roles: ["owner", "system_owner", "hr_manager", "admin"],
    section: "SYSTEM",
  },
  { to: "/notifications", label: "Notifications", icon: Bell, roles: ["all"], badge: "notifications", section: "SYSTEM" },
];

const QUICK_ACTIONS = [
  { to: "/attendance", label: "Upload Attendance", icon: Upload },
  { to: "/users", label: "Add Employee", icon: UserPlus },
  { to: "/requests", label: "Create Request", icon: FileText },
];

function normalizeRole(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, "_");
}

function canSeeItem(item, userRole) {
  if (item.roles.includes("all")) return true;
  return item.roles.includes(userRole);
}

export default function AdminDesktopLayout() {
  const { user, logout } = useAuth();

  const [unreadCount, setUnreadCount] = useState(0);
  const [menuSearch, setMenuSearch] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem("hr_sidebar_collapsed") === "true";
    } catch {
      return false;
    }
  });

  const userRole = normalizeRole(user?.roleCode || user?.role || user?.roleName);

  const visibleItems = useMemo(() => {
    const keyword = String(menuSearch || "").toLowerCase().trim();

    return NAV_ITEMS.filter((item) => canSeeItem(item, userRole)).filter((item) => {
      if (!keyword) return true;
      return item.label.toLowerCase().includes(keyword) || item.section.toLowerCase().includes(keyword);
    });
  }, [userRole, menuSearch]);

  const groupedItems = useMemo(() => {
    return visibleItems.reduce((acc, item) => {
      const section = item.section || "GENERAL";
      if (!acc[section]) acc[section] = [];
      acc[section].push(item);
      return acc;
    }, {});
  }, [visibleItems]);

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
    <div className={`admin-layout-ultra ${collapsed ? "is-collapsed" : ""} ${mobileOpen ? "mobile-open" : ""}`}>
      <style>{`
        .admin-layout-ultra {
          min-height: 100vh;
          display: grid;
          grid-template-columns: 306px minmax(0, 1fr);
          background:
            radial-gradient(circle at top right, rgba(37,99,235,.08), transparent 36%),
            linear-gradient(135deg, #f8fafc 0%, #eef2f7 100%);
          transition: grid-template-columns .22s ease;
        }

        .admin-layout-ultra.is-collapsed {
          grid-template-columns: 92px minmax(0, 1fr);
        }

        .admin-layout-ultra .mobile-menu-btn {
          display: none;
        }

        .admin-layout-ultra .sidebar-ultra {
          position: sticky;
          top: 0;
          height: 100vh;
          overflow-y: auto;
          padding: 14px;
          background:
            radial-gradient(circle at top left, rgba(14,165,233,.25), transparent 26%),
            linear-gradient(180deg, #071b3d 0%, #04122b 48%, #020617 100%);
          border-right: 1px solid rgba(148,163,184,.18);
          box-shadow: 18px 0 45px rgba(15,23,42,.16);
          display: flex;
          flex-direction: column;
          gap: 14px;
          z-index: 60;
        }

        .admin-layout-ultra .brand-logo-card {
          min-height: 134px;
          border-radius: 22px;
          padding: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          background:
            radial-gradient(circle at 80% 20%, rgba(34,211,238,.22), transparent 34%),
            linear-gradient(145deg, rgba(15,23,42,.58), rgba(30,64,175,.24));
          border: 1px solid rgba(147,197,253,.35);
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,.12),
            0 18px 36px rgba(0,0,0,.18);
          overflow: hidden;
        }

        .admin-layout-ultra .company-logo-img {
          width: 100%;
          max-width: 205px;
          max-height: 104px;
          object-fit: contain;
          display: block;
          filter: drop-shadow(0 14px 18px rgba(0,0,0,.18));
        }

        .admin-layout-ultra .logo-fallback {
          display: none;
          color: #fff;
          text-align: center;
        }

        .admin-layout-ultra .logo-fallback strong {
          display: block;
          font-size: 1.55rem;
          font-weight: 950;
          letter-spacing: -.03em;
        }

        .admin-layout-ultra .logo-fallback span {
          display: block;
          margin-top: 4px;
          color: #bfdbfe;
          font-size: .78rem;
          font-weight: 900;
        }

        .admin-layout-ultra .profile-card {
          border-radius: 20px;
          padding: 14px;
          display: flex;
          align-items: center;
          gap: 12px;
          background: rgba(255,255,255,.06);
          border: 1px solid rgba(255,255,255,.1);
        }

        .admin-layout-ultra .avatar {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          color: #1e3a8a;
          font-weight: 950;
          font-size: 1.25rem;
          background: linear-gradient(135deg, #e0f2fe, #ffffff);
          flex: 0 0 auto;
        }

        .admin-layout-ultra .profile-meta {
          min-width: 0;
          flex: 1;
        }

        .admin-layout-ultra .profile-meta strong {
          display: block;
          color: #fff;
          font-size: .96rem;
          font-weight: 950;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .admin-layout-ultra .profile-meta span {
          display: block;
          margin-top: 3px;
          color: #cbd5e1;
          font-size: .82rem;
          font-weight: 750;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .admin-layout-ultra .online-line {
          display: inline-flex !important;
          align-items: center;
          gap: 6px;
          margin-top: 5px !important;
          color: #dbeafe !important;
          font-size: .76rem !important;
        }

        .admin-layout-ultra .online-dot {
          width: 9px;
          height: 9px;
          border-radius: 50%;
          background: #22c55e;
          box-shadow: 0 0 0 4px rgba(34,197,94,.12);
        }

        .admin-layout-ultra .search-box {
          position: relative;
        }

        .admin-layout-ultra .search-box svg {
          position: absolute;
          left: 13px;
          top: 50%;
          transform: translateY(-50%);
          color: #bfdbfe;
        }

        .admin-layout-ultra .search-box input {
          width: 100%;
          min-height: 44px;
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,.1);
          background: rgba(255,255,255,.07);
          color: #fff;
          padding: 0 42px;
          outline: none;
          font-weight: 800;
        }

        .admin-layout-ultra .search-box input::placeholder {
          color: #94a3b8;
        }

        .admin-layout-ultra .quick-actions {
          display: grid;
          gap: 6px;
          border-radius: 18px;
          padding: 8px;
          background: rgba(255,255,255,.045);
          border: 1px solid rgba(255,255,255,.075);
        }

        .admin-layout-ultra .quick-actions a,
        .admin-layout-ultra nav a {
          position: relative;
          min-height: 43px;
          padding: 0 12px;
          border-radius: 13px;
          display: flex;
          align-items: center;
          gap: 11px;
          color: #dbeafe;
          text-decoration: none;
          font-size: .9rem;
          font-weight: 850;
          transition: .18s ease;
          border: 1px solid transparent;
        }

        .admin-layout-ultra .quick-actions a:hover,
        .admin-layout-ultra nav a:hover {
          background: rgba(255,255,255,.09);
          color: #fff;
          transform: translateX(3px);
          border-color: rgba(255,255,255,.09);
        }

        .admin-layout-ultra nav a.active {
          background: linear-gradient(135deg, #2563eb, #1d4ed8);
          color: #fff;
          box-shadow: 0 14px 30px rgba(37,99,235,.32);
        }

        .admin-layout-ultra .section-label {
          margin: 8px 8px 5px;
          color: #93c5fd;
          font-size: .72rem;
          font-weight: 950;
          letter-spacing: .06em;
        }

        .admin-layout-ultra nav {
          display: grid;
          gap: 4px;
        }

        .admin-layout-ultra .nav-icon {
          width: 18px;
          height: 18px;
          flex: 0 0 auto;
        }

        .admin-layout-ultra .nav-label {
          flex: 1;
          min-width: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .admin-layout-ultra .nav-pill {
          min-width: 24px;
          height: 24px;
          padding: 0 7px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          background: #2563eb;
          color: #fff;
          font-size: .72rem;
          font-weight: 950;
          box-shadow: 0 8px 18px rgba(37,99,235,.25);
        }

        .admin-layout-ultra .collapse-btn {
          width: 100%;
          min-height: 38px;
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,.1);
          background: rgba(255,255,255,.06);
          color: #dbeafe;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          cursor: pointer;
          font-weight: 900;
        }

        .admin-layout-ultra .system-card {
          margin-top: auto;
          border-radius: 18px;
          padding: 14px;
          background: rgba(255,255,255,.06);
          border: 1px solid rgba(255,255,255,.1);
          color: #fff;
        }

        .admin-layout-ultra .system-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: .82rem;
          font-weight: 950;
        }

        .admin-layout-ultra .system-card p {
          margin: 7px 0 0 17px;
          color: #cbd5e1;
          font-size: .78rem;
          font-weight: 750;
        }

        .admin-layout-ultra .sidebar-tools {
          display: grid;
          gap: 8px;
        }

        .admin-layout-ultra .sidebar-tools button,
        .admin-layout-ultra .sidebar-tools select {
          width: 100%;
          min-height: 40px;
          border-radius: 14px;
        }

        .admin-layout-ultra .logout-btn {
          width: 100%;
          min-height: 44px;
          border: 1px solid rgba(255,255,255,.1);
          border-radius: 14px;
          background: rgba(255,255,255,.06);
          color: #e2e8f0;
          font-weight: 900;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          transition: .18s ease;
        }

        .admin-layout-ultra .logout-btn:hover {
          background: rgba(239,68,68,.16);
          color: #fff;
          border-color: rgba(248,113,113,.28);
        }

        .admin-layout-ultra .content-shell {
          min-width: 0;
          display: grid;
          grid-template-rows: auto minmax(0, 1fr);
          background: transparent;
        }

        .admin-layout-ultra .topbar {
          position: sticky;
          top: 0;
          z-index: 35;
          min-height: 82px;
          padding: 16px 26px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          background: rgba(255,255,255,.78);
          backdrop-filter: blur(14px);
          border-bottom: 1px solid rgba(226,232,240,.9);
        }

        .admin-layout-ultra .welcome h1 {
          margin: 0;
          color: #0f172a;
          font-size: 1.35rem;
          font-weight: 950;
          letter-spacing: -.03em;
        }

        .admin-layout-ultra .welcome p {
          margin: 4px 0 0;
          color: #475569;
          font-size: .9rem;
          font-weight: 750;
        }

        .admin-layout-ultra .topbar-actions {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .admin-layout-ultra .top-card {
          min-height: 52px;
          padding: 0 14px;
          border-radius: 16px;
          background: #fff;
          border: 1px solid #e2e8f0;
          display: flex;
          align-items: center;
          gap: 10px;
          box-shadow: 0 10px 24px rgba(15,23,42,.04);
        }

        .admin-layout-ultra .top-card span {
          display: block;
          color: #64748b;
          font-size: .75rem;
          font-weight: 850;
        }

        .admin-layout-ultra .top-card strong {
          display: block;
          color: #0f172a;
          font-size: .95rem;
          font-weight: 950;
        }

        .admin-layout-ultra .content {
          min-width: 0;
          padding: 22px;
          overflow-x: hidden;
        }

        .admin-layout-ultra .mobile-overlay {
          display: none;
        }

        .admin-layout-ultra.is-collapsed .sidebar-ultra {
          padding: 14px 10px;
        }

        .admin-layout-ultra.is-collapsed .brand-logo-card {
          min-height: 68px;
          padding: 8px;
        }

        .admin-layout-ultra.is-collapsed .company-logo-img {
          max-width: 56px;
          max-height: 46px;
        }

        .admin-layout-ultra.is-collapsed .profile-meta,
        .admin-layout-ultra.is-collapsed .search-box,
        .admin-layout-ultra.is-collapsed .quick-actions,
        .admin-layout-ultra.is-collapsed .section-label,
        .admin-layout-ultra.is-collapsed .nav-label,
        .admin-layout-ultra.is-collapsed .collapse-label,
        .admin-layout-ultra.is-collapsed .sidebar-tools,
        .admin-layout-ultra.is-collapsed .system-card p,
        .admin-layout-ultra.is-collapsed .logout-label {
          display: none;
        }

        .admin-layout-ultra.is-collapsed .profile-card {
          justify-content: center;
          padding: 10px;
        }

        .admin-layout-ultra.is-collapsed .avatar {
          width: 46px;
          height: 46px;
        }

        .admin-layout-ultra.is-collapsed nav a {
          justify-content: center;
          padding: 0;
        }

        .admin-layout-ultra.is-collapsed nav a:hover::after {
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
          box-shadow: 0 12px 30px rgba(15,23,42,.22);
          z-index: 200;
          font-size: .78rem;
        }

        .admin-layout-ultra.is-collapsed .nav-pill {
          position: absolute;
          top: -5px;
          right: -5px;
          min-width: 20px;
          height: 20px;
          font-size: .66rem;
        }

        @media (max-width: 900px) {
          .admin-layout-ultra,
          .admin-layout-ultra.is-collapsed {
            grid-template-columns: 1fr;
          }

          .admin-layout-ultra .mobile-menu-btn {
            position: fixed;
            top: 18px;
            left: 16px;
            z-index: 150;
            width: 44px;
            height: 44px;
            border-radius: 14px;
            border: none;
            background: #1d4ed8;
            color: #fff;
            display: grid;
            place-items: center;
            box-shadow: 0 12px 30px rgba(37,99,235,.28);
          }

          .admin-layout-ultra .sidebar-ultra {
            position: fixed;
            left: 0;
            top: 0;
            width: 306px;
            height: 100vh;
            transform: translateX(-105%);
            transition: transform .22s ease;
          }

          .admin-layout-ultra.mobile-open .sidebar-ultra {
            transform: translateX(0);
          }

          .admin-layout-ultra.mobile-open .mobile-overlay {
            display: block;
            position: fixed;
            inset: 0;
            z-index: 45;
            background: rgba(15,23,42,.46);
          }

          .admin-layout-ultra .topbar {
            padding: 14px 14px 14px 72px;
            min-height: 76px;
          }

          .admin-layout-ultra .topbar-actions {
            display: none;
          }

          .admin-layout-ultra .content {
            padding: 14px;
          }

          .admin-layout-ultra.is-collapsed .profile-meta,
          .admin-layout-ultra.is-collapsed .search-box,
          .admin-layout-ultra.is-collapsed .quick-actions,
          .admin-layout-ultra.is-collapsed .section-label,
          .admin-layout-ultra.is-collapsed .nav-label,
          .admin-layout-ultra.is-collapsed .collapse-label,
          .admin-layout-ultra.is-collapsed .sidebar-tools,
          .admin-layout-ultra.is-collapsed .system-card p,
          .admin-layout-ultra.is-collapsed .logout-label {
            display: initial;
          }

          .admin-layout-ultra.is-collapsed .brand-logo-card {
            min-height: 134px;
          }

          .admin-layout-ultra.is-collapsed .company-logo-img {
            max-width: 205px;
            max-height: 104px;
          }

          .admin-layout-ultra.is-collapsed nav a {
            justify-content: flex-start;
            padding: 0 12px;
          }
        }
      `}</style>

      <button type="button" className="mobile-menu-btn" onClick={() => setMobileOpen(true)} aria-label="Open menu">
        <Menu size={22} />
      </button>

      <div className="mobile-overlay" onClick={closeMobileMenu} />

      <aside className="sidebar-ultra">
        <div className="brand-logo-card">
          <img
            src="/logo.png"
            alt="GAS Arabian Services"
            className="company-logo-img"
            onError={(event) => {
              event.currentTarget.style.display = "none";
              const fallback = event.currentTarget.nextElementSibling;
              if (fallback) fallback.style.display = "block";
            }}
          />
          <div className="logo-fallback">
            <strong>GAS</strong>
            <span>GAS HR Portal</span>
          </div>
        </div>

        <div className="profile-card">
          <div className="avatar">
            {String(user?.name || user?.username || "U").trim().slice(0, 1).toUpperCase()}
          </div>
          <div className="profile-meta">
            <strong>{user?.name || user?.username || "User"}</strong>
            <span>{user?.role || user?.roleName || "-"}</span>
            <span className="online-line">
              <i className="online-dot" />
              Online
            </span>
          </div>
        </div>

        <div className="search-box">
          <Search size={16} />
          <input
            value={menuSearch}
            onChange={(e) => setMenuSearch(e.target.value)}
            placeholder="Search menu..."
          />
        </div>

        {!collapsed ? (
          <div className="quick-actions">
            {QUICK_ACTIONS.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink key={item.to} to={item.to} onClick={closeMobileMenu}>
                  <Icon className="nav-icon" />
                  <span className="nav-label">{item.label}</span>
                </NavLink>
              );
            })}
          </div>
        ) : null}

        <button type="button" className="collapse-btn" onClick={() => setCollapsed((value) => !value)}>
          {collapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
          <span className="collapse-label">{collapsed ? "Expand" : "Collapse"}</span>
        </button>

        <nav>
          {Object.entries(groupedItems).map(([section, items]) => (
            <div key={section}>
              <div className="section-label">{section}</div>

              {items.map((item) => {
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
            </div>
          ))}
        </nav>

        <div className="sidebar-tools">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>

        <button className="logout-btn" onClick={logout}>
          <LogOut size={18} />
          <span className="logout-label">Logout</span>
        </button>

        <div className="system-card">
          <div className="system-title">
            <Circle size={10} fill="#22c55e" color="#22c55e" />
            System Status
          </div>
          <p>All Systems Operational</p>
        </div>
      </aside>

      <section className="content-shell">
        <header className="topbar">
          <div className="welcome">
            <h1>Welcome back, {user?.name || user?.username || "User"} 👋</h1>
            <p>Manage attendance, requests, projects, and HR operations from one place.</p>
          </div>

          <div className="topbar-actions">
            <div className="top-card">
              <ShieldCheck size={20} color="#16a34a" />
              <div>
                <span>Attendance Health</span>
                <strong>94% ↑</strong>
              </div>
            </div>

            <div className="top-card">
              <Bell size={20} color="#1d4ed8" />
              <div>
                <span>Notifications</span>
                <strong>{unreadCount} New</strong>
              </div>
            </div>
          </div>
        </header>

        <main className="content">
          <Outlet />
        </main>
      </section>
    </div>
  );
}
