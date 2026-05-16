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
  Award,
  ClipboardCheck,
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
  {
  to: "/project-attendance",
  label: "Projects Attendance",
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
  to: "/timesheet-reports",
  label: "Timesheet Reports",
  icon: FileSpreadsheet,
  roles: [
    "owner",
    "system_owner",
    "hr_manager",
    "hr_admin",
    "hr",
    "admin",
    "site_admin",
    "project_manager",
    "cm",
  ],
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
    to: "/admin/meetings",
    label: "Meetings",
    icon: CalendarDays,
    roles: ["owner", "system_owner", "hr_manager", "hr_admin", "hr", "admin"],
    section: "MANAGEMENT",
  },
  {
    to: "/performance",
    label: "Performance",
    icon: Award,
    roles: ["owner", "system_owner", "hr_manager", "hr_admin", "hr", "admin", "site_admin", "project_manager", "cm", "supervisor"],
    section: "MANAGEMENT",
  },
  {
    to: "/performance/assign",
    label: "Assign Reviews",
    icon: ClipboardCheck,
    roles: ["owner", "system_owner", "hr_manager", "hr_admin", "hr"],
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
    <div className={`admin-layout-gas ${collapsed ? "is-collapsed" : ""} ${mobileOpen ? "mobile-open" : ""}`}>
      <style>{`
        .admin-layout-gas {
          min-height: 100vh;
          display: grid;
          grid-template-columns: 306px minmax(0, 1fr);
          position: relative;
          overflow-x: hidden;
          background:
            radial-gradient(circle at 88% 78%, rgba(56, 189, 248, .55), transparent 20%),
            radial-gradient(circle at 16% 8%, rgba(37, 99, 235, .36), transparent 28%),
            linear-gradient(135deg, #0b2a5d 0%, #0b3b78 38%, #0d4f8f 72%, #123d79 100%);
          transition: grid-template-columns .22s ease;
        }

        .admin-layout-gas::before {
          content: "";
          position: fixed;
          inset: 0;
          pointer-events: none;
          background-image:
            linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px);
          background-size: 64px 64px;
          opacity: .75;
          z-index: 0;
        }

        .admin-layout-gas::after {
          content: "جاز";
          position: fixed;
          left: 18%;
          top: 28%;
          font-size: 15rem;
          line-height: 1;
          font-weight: 950;
          color: rgba(255,255,255,.055);
          pointer-events: none;
          z-index: 0;
        }

        .admin-layout-gas.is-collapsed {
          grid-template-columns: 92px minmax(0, 1fr);
        }

        .admin-layout-gas .mobile-menu-btn {
          display: none;
        }

        .admin-layout-gas .sidebar-ultra {
          position: sticky;
          top: 0;
          height: 100vh;
          overflow-y: auto;
          padding: 16px;
          z-index: 60;
          display: flex;
          flex-direction: column;
          gap: 14px;
          background: rgba(14, 48, 92, .62);
          border-right: 1px solid rgba(255,255,255,.14);
          box-shadow: 22px 0 55px rgba(2, 6, 23, .24);
          backdrop-filter: blur(22px);
        }

        .admin-layout-gas .sidebar-ultra::-webkit-scrollbar {
          width: 8px;
        }

        .admin-layout-gas .sidebar-ultra::-webkit-scrollbar-thumb {
          background: rgba(191,219,254,.32);
          border-radius: 999px;
        }

        .admin-layout-gas .brand-logo-card {
          min-height: 136px;
          border-radius: 24px;
          padding: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          background:
            radial-gradient(circle at 80% 22%, rgba(34,211,238,.26), transparent 32%),
            linear-gradient(145deg, rgba(255,255,255,.12), rgba(255,255,255,.045));
          border: 1px solid rgba(255,255,255,.18);
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,.14),
            0 20px 44px rgba(0,0,0,.18);
          overflow: hidden;
        }

        .admin-layout-gas .company-logo-img {
          width: 100%;
          max-width: 190px;
          max-height: 104px;
          object-fit: contain;
          display: block;
          filter: drop-shadow(0 14px 20px rgba(0,0,0,.22));
        }

        .admin-layout-gas .logo-fallback {
          display: none;
          color: #fff;
          text-align: center;
        }

        .admin-layout-gas .logo-fallback strong {
          display: block;
          font-size: 1.65rem;
          font-weight: 950;
        }

        .admin-layout-gas .logo-fallback span {
          display: block;
          margin-top: 4px;
          color: #bfdbfe;
          font-size: .78rem;
          font-weight: 900;
        }

        .admin-layout-gas .profile-card {
          border-radius: 22px;
          padding: 14px;
          display: flex;
          align-items: center;
          gap: 12px;
          background: rgba(255,255,255,.08);
          border: 1px solid rgba(255,255,255,.14);
        }

        .admin-layout-gas .avatar {
          width: 56px;
          height: 56px;
          border-radius: 18px;
          display: grid;
          place-items: center;
          color: #0f3b73;
          font-weight: 950;
          font-size: 1.25rem;
          background: linear-gradient(135deg, #e0f2fe, #ffffff);
          flex: 0 0 auto;
          box-shadow: 0 12px 24px rgba(0,0,0,.12);
        }

        .admin-layout-gas .profile-meta {
          min-width: 0;
          flex: 1;
        }

        .admin-layout-gas .profile-meta strong {
          display: block;
          color: #fff;
          font-size: .96rem;
          font-weight: 950;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .admin-layout-gas .profile-meta span {
          display: block;
          margin-top: 3px;
          color: #dbeafe;
          font-size: .82rem;
          font-weight: 750;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .admin-layout-gas .online-line {
          display: inline-flex !important;
          align-items: center;
          gap: 6px;
          margin-top: 6px !important;
          color: #e0f2fe !important;
          font-size: .76rem !important;
        }

        .admin-layout-gas .online-dot {
          width: 9px;
          height: 9px;
          border-radius: 50%;
          background: #22c55e;
          box-shadow: 0 0 0 4px rgba(34,197,94,.15);
        }

        .admin-layout-gas .search-box {
          position: relative;
        }

        .admin-layout-gas .search-box svg {
          position: absolute;
          left: 13px;
          top: 50%;
          transform: translateY(-50%);
          color: #bfdbfe;
        }

        .admin-layout-gas .search-box input {
          width: 100%;
          min-height: 44px;
          border-radius: 15px;
          border: 1px solid rgba(255,255,255,.14);
          background: rgba(255,255,255,.09);
          color: #fff;
          padding: 0 42px;
          outline: none;
          font-weight: 800;
        }

        .admin-layout-gas .search-box input::placeholder {
          color: rgba(219,234,254,.65);
        }

        .admin-layout-gas .quick-actions {
          display: grid;
          gap: 7px;
          border-radius: 20px;
          padding: 8px;
          background: rgba(255,255,255,.055);
          border: 1px solid rgba(255,255,255,.09);
        }

        .admin-layout-gas .quick-actions a,
        .admin-layout-gas nav a {
          position: relative;
          min-height: 44px;
          padding: 0 12px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          gap: 11px;
          color: #dbeafe;
          text-decoration: none;
          font-size: .9rem;
          font-weight: 850;
          transition: .18s ease;
          border: 1px solid transparent;
          outline: none;
        }

        .admin-layout-gas .quick-actions a:focus,
        .admin-layout-gas .quick-actions a:focus-visible,
        .admin-layout-gas nav a:focus,
        .admin-layout-gas nav a:focus-visible {
          outline: none !important;
          box-shadow: none !important;
        }

        .admin-layout-gas .quick-actions a:hover,
        .admin-layout-gas nav a:hover {
          background: rgba(255,255,255,.11);
          color: #fff;
          transform: translateX(3px);
          border-color: rgba(255,255,255,.12);
        }

        .admin-layout-gas nav a.active {
          background: linear-gradient(135deg, #2f6df6, #1d4ed8);
          color: #fff;
          box-shadow: 0 16px 34px rgba(37,99,235,.34);
          border-color: rgba(255,255,255,.12);
        }

        .admin-layout-gas .section-label {
          margin: 9px 8px 6px;
          color: #93c5fd;
          font-size: .72rem;
          font-weight: 950;
          letter-spacing: .08em;
        }

        .admin-layout-gas nav {
          display: grid;
          gap: 5px;
        }

        .admin-layout-gas .nav-icon {
          width: 18px;
          height: 18px;
          flex: 0 0 auto;
        }

        .admin-layout-gas .nav-label {
          flex: 1;
          min-width: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .admin-layout-gas .nav-pill {
          min-width: 24px;
          height: 24px;
          padding: 0 7px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          background: #38bdf8;
          color: #082f49;
          font-size: .72rem;
          font-weight: 950;
          box-shadow: 0 8px 18px rgba(56,189,248,.25);
        }

        .admin-layout-gas .collapse-btn {
          width: 100%;
          min-height: 40px;
          border-radius: 15px;
          border: 1px solid rgba(255,255,255,.14);
          background: rgba(255,255,255,.08);
          color: #dbeafe;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          cursor: pointer;
          font-weight: 900;
        }

        .admin-layout-gas .system-card {
          margin-top: auto;
          border-radius: 20px;
          padding: 14px;
          background: rgba(255,255,255,.08);
          border: 1px solid rgba(255,255,255,.13);
          color: #fff;
        }

        .admin-layout-gas .system-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: .82rem;
          font-weight: 950;
        }

        .admin-layout-gas .system-card p {
          margin: 7px 0 0 17px;
          color: #dbeafe;
          font-size: .78rem;
          font-weight: 750;
        }

        .admin-layout-gas .sidebar-tools {
          display: grid;
          gap: 8px;
        }

        .admin-layout-gas .sidebar-tools button,
        .admin-layout-gas .sidebar-tools select {
          width: 100%;
          min-height: 40px;
          border-radius: 14px;
        }

        .admin-layout-gas .logout-btn {
          width: 100%;
          min-height: 44px;
          border: 1px solid rgba(255,255,255,.14);
          border-radius: 15px;
          background: rgba(255,255,255,.08);
          color: #e2e8f0;
          font-weight: 900;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          transition: .18s ease;
        }

        .admin-layout-gas .logout-btn:hover {
          background: rgba(239,68,68,.18);
          color: #fff;
          border-color: rgba(248,113,113,.32);
        }

        .admin-layout-gas .content-shell {
          position: relative;
          z-index: 1;
          min-width: 0;
          display: grid;
          grid-template-rows: auto minmax(0, 1fr);
          background: rgba(255,255,255,.07);
          backdrop-filter: blur(2px);
        }

        .admin-layout-gas .topbar {
          position: sticky;
          top: 0;
          z-index: 35;
          min-height: 84px;
          padding: 16px 26px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          background: rgba(255,255,255,.15);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(255,255,255,.18);
        }

        .admin-layout-gas .welcome h1 {
          margin: 0;
          color: #fff;
          font-size: 1.42rem;
          font-weight: 950;
          letter-spacing: -.03em;
          text-shadow: 0 12px 28px rgba(0,0,0,.18);
        }

        .admin-layout-gas .welcome p {
          margin: 4px 0 0;
          color: rgba(219,234,254,.9);
          font-size: .9rem;
          font-weight: 750;
        }

        .admin-layout-gas .topbar-actions {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .admin-layout-gas .top-card {
          min-height: 54px;
          padding: 0 14px;
          border-radius: 17px;
          background: rgba(255,255,255,.18);
          border: 1px solid rgba(255,255,255,.22);
          display: flex;
          align-items: center;
          gap: 10px;
          box-shadow: 0 14px 30px rgba(2,6,23,.12);
          backdrop-filter: blur(14px);
        }

        .admin-layout-gas .top-card span {
          display: block;
          color: rgba(219,234,254,.84);
          font-size: .75rem;
          font-weight: 850;
        }

        .admin-layout-gas .top-card strong {
          display: block;
          color: #fff;
          font-size: .95rem;
          font-weight: 950;
        }

        .admin-layout-gas .content {
          min-width: 0;
          padding: 22px;
          overflow-x: hidden;
        }

        .admin-layout-gas .content > * {
          position: relative;
          z-index: 2;
        }

        .admin-layout-gas .mobile-overlay {
          display: none;
        }

        .admin-layout-gas.is-collapsed .sidebar-ultra {
          padding: 14px 10px;
        }

        .admin-layout-gas.is-collapsed .brand-logo-card {
          min-height: 72px;
          padding: 8px;
        }

        .admin-layout-gas.is-collapsed .company-logo-img {
          max-width: 58px;
          max-height: 48px;
        }

        .admin-layout-gas.is-collapsed .profile-meta,
        .admin-layout-gas.is-collapsed .search-box,
        .admin-layout-gas.is-collapsed .quick-actions,
        .admin-layout-gas.is-collapsed .section-label,
        .admin-layout-gas.is-collapsed .nav-label,
        .admin-layout-gas.is-collapsed .collapse-label,
        .admin-layout-gas.is-collapsed .sidebar-tools,
        .admin-layout-gas.is-collapsed .system-card p,
        .admin-layout-gas.is-collapsed .logout-label {
          display: none;
        }

        .admin-layout-gas.is-collapsed .profile-card {
          justify-content: center;
          padding: 10px;
        }

        .admin-layout-gas.is-collapsed .avatar {
          width: 46px;
          height: 46px;
        }

        .admin-layout-gas.is-collapsed nav a {
          justify-content: center;
          padding: 0;
        }

        .admin-layout-gas.is-collapsed nav a:hover::after {
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

        .admin-layout-gas.is-collapsed .nav-pill {
          position: absolute;
          top: -5px;
          right: -5px;
          min-width: 20px;
          height: 20px;
          font-size: .66rem;
        }

        @media (max-width: 900px) {
          .admin-layout-gas,
          .admin-layout-gas.is-collapsed {
            grid-template-columns: 1fr;
          }

          .admin-layout-gas .mobile-menu-btn {
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

          .admin-layout-gas .sidebar-ultra {
            position: fixed;
            left: 0;
            top: 0;
            width: 306px;
            height: 100vh;
            transform: translateX(-105%);
            transition: transform .22s ease;
          }

          .admin-layout-gas.mobile-open .sidebar-ultra {
            transform: translateX(0);
          }

          .admin-layout-gas.mobile-open .mobile-overlay {
            display: block;
            position: fixed;
            inset: 0;
            z-index: 45;
            background: rgba(15,23,42,.46);
          }

          .admin-layout-gas .topbar {
            padding: 14px 14px 14px 72px;
            min-height: 76px;
          }

          .admin-layout-gas .topbar-actions {
            display: none;
          }

          .admin-layout-gas .content {
            padding: 14px;
          }

          .admin-layout-gas.is-collapsed .profile-meta,
          .admin-layout-gas.is-collapsed .search-box,
          .admin-layout-gas.is-collapsed .quick-actions,
          .admin-layout-gas.is-collapsed .section-label,
          .admin-layout-gas.is-collapsed .nav-label,
          .admin-layout-gas.is-collapsed .collapse-label,
          .admin-layout-gas.is-collapsed .sidebar-tools,
          .admin-layout-gas.is-collapsed .system-card p,
          .admin-layout-gas.is-collapsed .logout-label {
            display: initial;
          }

          .admin-layout-gas.is-collapsed .brand-logo-card {
            min-height: 136px;
          }

          .admin-layout-gas.is-collapsed .company-logo-img {
            max-width: 190px;
            max-height: 104px;
          }

          .admin-layout-gas.is-collapsed nav a {
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
            src="/logo.svg"
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
              <ShieldCheck size={20} color="#22c55e" />
              <div>
                <span>Attendance Health</span>
                <strong>94% ↑</strong>
              </div>
            </div>

            <div className="top-card">
              <Bell size={20} color="#93c5fd" />
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
