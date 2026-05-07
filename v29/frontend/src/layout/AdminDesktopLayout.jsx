import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
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
  Sparkles,
  Upload,
  Plus,
  Search,
  Activity,
  Wifi,
  CheckCircle2,
  Layers3,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../services/api";
import LanguageSwitcher from "../components/LanguageSwitcher";
import ThemeToggle from "../components/ThemeToggle";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, roles: ["all"], section: "Overview" },
  {
    to: "/attendance",
    label: "Attendance",
    icon: CalendarDays,
    roles: ["owner", "system_owner", "hr_manager", "hr_admin", "hr", "admin", "site_admin", "project_manager", "cm"],
    section: "Workforce",
  },
  { to: "/my-attendance", label: "My Attendance", icon: UserCheck, roles: ["all"], section: "Workforce" },
  {
    to: "/project-employees",
    label: "Project Employees",
    icon: Users,
    roles: ["owner", "system_owner", "hr_manager", "hr_admin", "hr", "admin"],
    section: "Workforce",
  },
  {
    to: "/projects",
    label: "Projects",
    icon: FolderKanban,
    roles: ["owner", "system_owner", "hr_manager", "hr_admin", "hr", "admin", "site_admin", "project_manager", "cm"],
    section: "Operations",
  },
  { to: "/requests", label: "Requests", icon: FileText, roles: ["all"], section: "Operations" },
  {
    to: "/reports",
    label: "Reports",
    icon: BarChart3,
    roles: ["owner", "system_owner", "hr_manager", "hr_admin", "hr", "admin", "site_admin", "project_manager", "cm"],
    section: "Operations",
  },
  { to: "/notifications", label: "Notifications", icon: Bell, roles: ["all"], badge: "notifications", section: "Operations" },
  { to: "/users", label: "Users", icon: Users, roles: ["owner", "system_owner", "hr_manager", "hr_admin", "hr", "admin"], section: "Administration" },
  {
    to: "/admin/employee-services",
    label: "Employee Services",
    icon: Database,
    roles: ["owner", "system_owner", "hr_manager", "hr_admin", "hr", "admin"],
    section: "Administration",
  },
  { to: "/settings", label: "Settings", icon: Settings, roles: ["all"], section: "System" },
  { to: "/security", label: "Security & Audit", icon: ShieldCheck, roles: ["owner", "system_owner", "hr_manager", "admin"], section: "System" },
];

const SECTION_ORDER = ["Overview", "Workforce", "Operations", "Administration", "System"];

function normalizeRole(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, "_");
}

function prettifyRole(value) {
  return String(value || "-").replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function canSeeItem(item, userRole) {
  if (item.roles.includes("all")) return true;
  return item.roles.includes(userRole);
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 18) return "Good Afternoon";
  return "Good Evening";
}

export default function AdminDesktopLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [unreadCount, setUnreadCount] = useState(0);
  const [navSearch, setNavSearch] = useState("");
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
    const keyword = String(navSearch || "").trim().toLowerCase();

    return NAV_ITEMS.filter((item) => canSeeItem(item, userRole)).filter((item) => {
      if (!keyword) return true;
      return String(item.label || "").toLowerCase().includes(keyword) || String(item.section || "").toLowerCase().includes(keyword);
    });
  }, [userRole, navSearch]);

  const groupedItems = useMemo(() => {
    return SECTION_ORDER.map((section) => ({ section, items: visibleItems.filter((item) => item.section === section) })).filter((group) => group.items.length > 0);
  }, [visibleItems]);

  const activeItem = useMemo(() => {
    const exact = NAV_ITEMS.find((item) => item.to === location.pathname);
    if (exact) return exact;
    return NAV_ITEMS.find((item) => item.to !== "/" && location.pathname.startsWith(item.to));
  }, [location.pathname]);

  const visibleQuickActions = useMemo(() => {
    const actions = [
      {
        label: "Attendance",
        icon: Upload,
        to: "/attendance",
        roles: ["owner", "system_owner", "hr_manager", "hr_admin", "hr", "admin", "site_admin", "project_manager", "cm"],
      },
      { label: "Add User", icon: Plus, to: "/users", roles: ["owner", "system_owner", "hr_manager", "hr_admin", "hr", "admin"] },
      { label: "Requests", icon: FileText, to: "/requests", roles: ["all"] },
    ];

    return actions.filter((action) => action.roles.includes("all") || action.roles.includes(userRole));
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

  function goTo(path) {
    navigate(path);
    closeMobileMenu();
  }

  return (
    <div className={`admin-layout-ultra ${collapsed ? "is-collapsed" : ""} ${mobileOpen ? "mobile-open" : ""}`}>
      <style>{`
        .admin-layout-ultra {
          min-height: 100vh;
          display: grid;
          grid-template-columns: 304px minmax(0, 1fr);
          background:
            radial-gradient(circle at top right, rgba(37, 99, 235, 0.08), transparent 34%),
            radial-gradient(circle at bottom left, rgba(124, 58, 237, 0.07), transparent 32%),
            linear-gradient(135deg, #f8fafc 0%, #eef2f7 100%);
          transition: grid-template-columns 0.22s ease;
        }

        .admin-layout-ultra.is-collapsed {
          grid-template-columns: 96px minmax(0, 1fr);
        }

        .admin-layout-ultra .mobile-menu-btn {
          display: none;
        }

        .admin-layout-ultra .sidebar-ultra {
          position: sticky;
          top: 0;
          height: 100vh;
          overflow-y: auto;
          padding: 18px;
          background:
            radial-gradient(circle at top left, rgba(59, 130, 246, 0.32), transparent 30%),
            radial-gradient(circle at bottom right, rgba(124, 58, 237, 0.18), transparent 32%),
            linear-gradient(180deg, #020617 0%, #0f172a 52%, #111827 100%);
          border-right: 1px solid rgba(148, 163, 184, 0.18);
          box-shadow: 20px 0 50px rgba(15, 23, 42, 0.18);
          display: flex;
          flex-direction: column;
          gap: 14px;
          z-index: 50;
        }

        .admin-layout-ultra .sidebar-ultra::-webkit-scrollbar {
          width: 7px;
        }

        .admin-layout-ultra .sidebar-ultra::-webkit-scrollbar-thumb {
          background: rgba(148, 163, 184, 0.24);
          border-radius: 999px;
        }

        .admin-layout-ultra .brand-card {
          position: relative;
          overflow: hidden;
          padding: 16px;
          border-radius: 26px;
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.055));
          border: 1px solid rgba(255, 255, 255, 0.12);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.09), 0 18px 36px rgba(2, 6, 23, 0.18);
        }

        .admin-layout-ultra .brand-card::after {
          content: "";
          position: absolute;
          width: 120px;
          height: 120px;
          right: -48px;
          top: -48px;
          border-radius: 50%;
          background: rgba(96, 165, 250, 0.2);
          filter: blur(2px);
        }

        .admin-layout-ultra .brand-top {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .admin-layout-ultra .brand-logo {
          width: 46px;
          height: 46px;
          border-radius: 18px;
          display: grid;
          place-items: center;
          color: #fff;
          background: radial-gradient(circle at top left, rgba(255, 255, 255, 0.32), transparent 34%), linear-gradient(135deg, #2563eb, #7c3aed);
          box-shadow: 0 15px 32px rgba(37, 99, 235, 0.38);
          flex: 0 0 auto;
        }

        .admin-layout-ultra .brand-text {
          min-width: 0;
          transition: opacity 0.18s ease;
        }

        .admin-layout-ultra .brand-text h2 {
          margin: 0;
          color: #fff;
          font-size: 1.16rem;
          font-weight: 950;
          letter-spacing: -0.025em;
          white-space: nowrap;
        }

        .admin-layout-ultra .brand-text p {
          margin: 4px 0 0;
          color: #bfdbfe;
          font-size: 0.78rem;
          font-weight: 850;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .admin-layout-ultra .user-card {
          margin-top: 14px;
          position: relative;
          z-index: 1;
          display: grid;
          gap: 10px;
        }

        .admin-layout-ultra .user-name-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .admin-layout-ultra .user-name {
          min-width: 0;
        }

        .admin-layout-ultra .user-name strong {
          display: block;
          color: #fff;
          font-size: 0.95rem;
          font-weight: 950;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .admin-layout-ultra .user-name span {
          display: block;
          color: #94a3b8;
          font-size: 0.74rem;
          font-weight: 800;
          margin-top: 3px;
        }

        .admin-layout-ultra .role-chip {
          display: inline-flex;
          align-items: center;
          min-height: 28px;
          padding: 0 9px;
          border-radius: 999px;
          background: rgba(59, 130, 246, 0.18);
          color: #bfdbfe;
          font-size: 0.7rem;
          font-weight: 950;
          white-space: nowrap;
        }

        .admin-layout-ultra .scope-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 8px;
        }

        .admin-layout-ultra .scope-line {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          min-height: 34px;
          padding: 0 10px;
          border-radius: 13px;
          background: rgba(255, 255, 255, 0.065);
          color: #cbd5e1;
          font-size: 0.75rem;
          font-weight: 850;
        }

        .admin-layout-ultra .scope-line strong {
          color: #f8fafc;
          min-width: 0;
          text-align: right;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .admin-layout-ultra .quick-actions {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
          padding: 10px;
          border-radius: 20px;
          background: rgba(255, 255, 255, 0.055);
          border: 1px solid rgba(255, 255, 255, 0.08);
        }

        .admin-layout-ultra .quick-action-btn {
          min-height: 58px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.07);
          color: #dbeafe;
          display: grid;
          place-items: center;
          gap: 5px;
          cursor: pointer;
          transition: 0.18s ease;
          font-size: 0.68rem;
          font-weight: 900;
          text-align: center;
          padding: 8px 6px;
        }

        .admin-layout-ultra .quick-action-btn:hover {
          transform: translateY(-2px);
          background: rgba(37, 99, 235, 0.26);
          color: #fff;
          border-color: rgba(147, 197, 253, 0.24);
        }

        .admin-layout-ultra .collapse-btn {
          width: 100%;
          min-height: 40px;
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.06);
          color: #dbeafe;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          cursor: pointer;
          font-weight: 950;
          transition: 0.18s ease;
        }

        .admin-layout-ultra .collapse-btn:hover {
          background: rgba(255,255,255,0.09);
          transform: translateY(-1px);
        }

        .admin-layout-ultra .nav-search {
          position: relative;
          transition: opacity 0.18s ease;
        }

        .admin-layout-ultra .nav-search svg {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: #94a3b8;
        }

        .admin-layout-ultra .nav-search input {
          width: 100%;
          min-height: 42px;
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.07);
          color: #fff;
          padding: 0 12px 0 38px;
          outline: none;
          font-weight: 850;
        }

        .admin-layout-ultra .nav-search input::placeholder {
          color: #94a3b8;
        }

        .admin-layout-ultra .nav-section {
          display: grid;
          gap: 7px;
        }

        .admin-layout-ultra .section-label {
          margin: 8px 2px 3px;
          color: #64748b;
          font-size: 0.68rem;
          font-weight: 950;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .admin-layout-ultra nav {
          display: grid;
          gap: 6px;
        }

        .admin-layout-ultra nav a {
          position: relative;
          min-height: 48px;
          padding: 0 13px;
          border-radius: 16px;
          display: flex;
          align-items: center;
          gap: 12px;
          color: #cbd5e1;
          text-decoration: none;
          font-size: 0.9rem;
          font-weight: 900;
          transition: 0.18s ease;
          border: 1px solid transparent;
          isolation: isolate;
        }

        .admin-layout-ultra nav a::before {
          content: "";
          position: absolute;
          left: 8px;
          width: 4px;
          height: 0;
          border-radius: 999px;
          background: #93c5fd;
          transition: height 0.18s ease;
        }

        .admin-layout-ultra nav a:hover {
          background: rgba(255,255,255,0.075);
          color: #fff;
          transform: translateX(4px);
          border-color: rgba(255,255,255,0.08);
        }

        .admin-layout-ultra nav a.active {
          background: radial-gradient(circle at top left, rgba(255, 255, 255, 0.26), transparent 28%), linear-gradient(135deg, rgba(37, 99, 235, 0.98), rgba(29, 78, 216, 0.98));
          color: #fff;
          box-shadow: 0 14px 30px rgba(37, 99, 235, 0.32);
        }

        .admin-layout-ultra nav a.active::before {
          height: 24px;
        }

        .admin-layout-ultra .nav-icon {
          width: 19px;
          height: 19px;
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
          background: #ef4444;
          color: #fff;
          font-size: 0.72rem;
          font-weight: 950;
          box-shadow: 0 8px 18px rgba(239, 68, 68, 0.25);
        }

        .admin-layout-ultra .sidebar-tools {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-top: 4px;
          transition: opacity 0.18s ease;
        }

        .admin-layout-ultra .sidebar-tools > * {
          min-width: 0;
        }

        .admin-layout-ultra .sidebar-tools button,
        .admin-layout-ultra .sidebar-tools select {
          width: 100%;
          min-height: 40px;
          border-radius: 14px;
        }

        .admin-layout-ultra .system-status-card {
          margin-top: auto;
          display: grid;
          gap: 10px;
          padding: 13px;
          border-radius: 20px;
          background: rgba(255, 255, 255, 0.055);
          border: 1px solid rgba(255, 255, 255, 0.08);
          transition: opacity 0.18s ease;
        }

        .admin-layout-ultra .status-title {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #f8fafc;
          font-size: 0.82rem;
          font-weight: 950;
        }

        .admin-layout-ultra .status-lines {
          display: grid;
          gap: 7px;
        }

        .admin-layout-ultra .status-line {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          color: #94a3b8;
          font-size: 0.74rem;
          font-weight: 850;
        }

        .admin-layout-ultra .status-ok {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          color: #86efac;
          font-weight: 950;
        }

        .admin-layout-ultra .sidebar-footer {
          padding-top: 0;
        }

        .admin-layout-ultra .logout-btn {
          width: 100%;
          min-height: 46px;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 16px;
          background: rgba(255,255,255,0.06);
          color: #e2e8f0;
          font-weight: 950;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          transition: 0.18s ease;
        }

        .admin-layout-ultra .logout-btn:hover {
          background: rgba(239, 68, 68, 0.16);
          color: #fff;
          border-color: rgba(248, 113, 113, 0.28);
          transform: translateY(-1px);
        }

        .admin-layout-ultra .content-wrap {
          min-width: 0;
          display: grid;
          grid-template-rows: auto minmax(0, 1fr);
        }

        .admin-layout-ultra .topbar {
          position: sticky;
          top: 0;
          z-index: 30;
          min-width: 0;
          padding: 18px 22px 0;
          background: linear-gradient(180deg, rgba(248, 250, 252, 0.96), rgba(248, 250, 252, 0.78) 78%, transparent);
          backdrop-filter: blur(10px);
        }

        .admin-layout-ultra .topbar-card {
          min-height: 74px;
          border-radius: 24px;
          border: 1px solid rgba(226, 232, 240, 0.95);
          background: rgba(255, 255, 255, 0.86);
          box-shadow: 0 16px 34px rgba(15, 23, 42, 0.065);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 14px 18px;
        }

        .admin-layout-ultra .topbar-title {
          min-width: 0;
        }

        .admin-layout-ultra .topbar-title span {
          display: block;
          color: #64748b;
          font-size: 0.82rem;
          font-weight: 850;
          margin-bottom: 3px;
        }

        .admin-layout-ultra .topbar-title h1 {
          margin: 0;
          color: #0f172a;
          font-size: 1.24rem;
          font-weight: 950;
          letter-spacing: -0.025em;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .admin-layout-ultra .topbar-meta {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .admin-layout-ultra .topbar-pill {
          min-height: 36px;
          padding: 0 12px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          color: #334155;
          font-size: 0.8rem;
          font-weight: 900;
        }

        .admin-layout-ultra .topbar-pill.critical {
          background: #fff1f2;
          color: #be123c;
          border-color: #fecdd3;
        }

        .admin-layout-ultra .content {
          min-width: 0;
          padding: 22px;
          overflow-x: hidden;
          background: transparent;
        }

        .admin-layout-ultra.is-collapsed .sidebar-ultra {
          padding: 18px 14px;
        }

        .admin-layout-ultra.is-collapsed .brand-card {
          padding: 14px 10px;
        }

        .admin-layout-ultra.is-collapsed .brand-top {
          justify-content: center;
        }

        .admin-layout-ultra.is-collapsed .brand-text,
        .admin-layout-ultra.is-collapsed .user-card,
        .admin-layout-ultra.is-collapsed .quick-actions,
        .admin-layout-ultra.is-collapsed .nav-search,
        .admin-layout-ultra.is-collapsed .section-label,
        .admin-layout-ultra.is-collapsed .sidebar-tools,
        .admin-layout-ultra.is-collapsed .system-status-card,
        .admin-layout-ultra.is-collapsed .collapse-label,
        .admin-layout-ultra.is-collapsed .nav-label,
        .admin-layout-ultra.is-collapsed .logout-label {
          display: none;
        }

        .admin-layout-ultra.is-collapsed nav a {
          justify-content: center;
          padding: 0;
        }

        .admin-layout-ultra.is-collapsed nav a::before {
          display: none;
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
          box-shadow: 0 12px 30px rgba(15,23,42,0.22);
          z-index: 200;
          font-size: 0.78rem;
        }

        .admin-layout-ultra.is-collapsed .nav-pill {
          position: absolute;
          top: -5px;
          right: -5px;
          min-width: 20px;
          height: 20px;
          font-size: 0.66rem;
        }

        .admin-layout-ultra.is-collapsed .logout-btn {
          padding: 0;
        }

        .admin-layout-ultra .mobile-overlay {
          display: none;
        }

        @media (max-width: 1100px) {
          .admin-layout-ultra .topbar-card {
            align-items: flex-start;
            flex-direction: column;
          }

          .admin-layout-ultra .topbar-meta {
            justify-content: flex-start;
          }
        }

        @media (max-width: 900px) {
          .admin-layout-ultra,
          .admin-layout-ultra.is-collapsed {
            grid-template-columns: 1fr;
          }

          .admin-layout-ultra .mobile-menu-btn {
            position: fixed;
            top: 16px;
            left: 16px;
            z-index: 120;
            width: 46px;
            height: 46px;
            border-radius: 16px;
            border: none;
            background: linear-gradient(135deg, #2563eb, #1d4ed8);
            color: #fff;
            display: grid;
            place-items: center;
            box-shadow: 0 14px 32px rgba(37,99,235,0.3);
          }

          .admin-layout-ultra .sidebar-ultra {
            position: fixed;
            left: 0;
            top: 0;
            width: 304px;
            max-width: calc(100vw - 36px);
            height: 100vh;
            transform: translateX(-105%);
            transition: transform 0.22s ease;
          }

          .admin-layout-ultra.mobile-open .sidebar-ultra {
            transform: translateX(0);
          }

          .admin-layout-ultra.mobile-open .mobile-overlay {
            display: block;
            position: fixed;
            inset: 0;
            z-index: 40;
            background: rgba(15, 23, 42, 0.5);
            backdrop-filter: blur(2px);
          }

          .admin-layout-ultra .topbar {
            padding: 14px 14px 0 72px;
          }

          .admin-layout-ultra .topbar-card {
            min-height: 60px;
            border-radius: 20px;
            padding: 12px 14px;
          }

          .admin-layout-ultra .topbar-title h1 {
            font-size: 1rem;
          }

          .admin-layout-ultra .topbar-meta {
            display: none;
          }

          .admin-layout-ultra .content {
            padding: 14px;
          }

          .admin-layout-ultra.is-collapsed .brand-text,
          .admin-layout-ultra.is-collapsed .user-card,
          .admin-layout-ultra.is-collapsed .quick-actions,
          .admin-layout-ultra.is-collapsed .nav-search,
          .admin-layout-ultra.is-collapsed .section-label,
          .admin-layout-ultra.is-collapsed .sidebar-tools,
          .admin-layout-ultra.is-collapsed .system-status-card,
          .admin-layout-ultra.is-collapsed .collapse-label,
          .admin-layout-ultra.is-collapsed .nav-label,
          .admin-layout-ultra.is-collapsed .logout-label {
            display: initial;
          }

          .admin-layout-ultra.is-collapsed .quick-actions,
          .admin-layout-ultra.is-collapsed .sidebar-tools,
          .admin-layout-ultra.is-collapsed .system-status-card,
          .admin-layout-ultra.is-collapsed .user-card {
            display: grid;
          }

          .admin-layout-ultra.is-collapsed .nav-search {
            display: block;
          }

          .admin-layout-ultra.is-collapsed nav a {
            justify-content: flex-start;
            padding: 0 13px;
          }

          .admin-layout-ultra.is-collapsed .sidebar-ultra {
            padding: 18px;
          }

          .admin-layout-ultra.is-collapsed .brand-top {
            justify-content: flex-start;
          }

          .admin-layout-ultra.is-collapsed nav a:hover::after {
            display: none;
          }
        }
      `}</style>

      <button type="button" className="mobile-menu-btn" onClick={() => setMobileOpen(true)} aria-label="Open menu">
        <Menu size={22} />
      </button>

      <div className={`mobile-overlay ${mobileOpen ? "show" : ""}`} onClick={closeMobileMenu} />

      <aside className="sidebar-ultra">
        <div className="brand-card">
          <div className="brand-top">
            <div className="brand-logo">
              <Sparkles size={22} />
            </div>

            <div className="brand-text">
              <h2>GAS HR Portal</h2>
              <p>Enterprise Workforce Suite</p>
            </div>
          </div>

          <div className="user-card">
            <div className="user-name-row">
              <div className="user-name">
                <strong>{user?.name || user?.username || "User"}</strong>
                <span>{user?.username || "Signed in user"}</span>
              </div>

              <span className="role-chip">{prettifyRole(user?.role || user?.roleName || userRole)}</span>
            </div>

            <div className="scope-grid">
              <div className="scope-line">
                <span>Division</span>
                <strong>{user?.division || "-"}</strong>
              </div>

              <div className="scope-line">
                <span>Project</span>
                <strong>{user?.project || user?.projectName || "All Projects"}</strong>
              </div>
            </div>
          </div>
        </div>

        {!collapsed ? (
          <div className="quick-actions">
            {visibleQuickActions.map((action) => {
              const Icon = action.icon;
              return (
                <button type="button" key={action.to} className="quick-action-btn" onClick={() => goTo(action.to)} title={action.label}>
                  <Icon size={17} />
                  <span>{action.label}</span>
                </button>
              );
            })}
          </div>
        ) : null}

        <button type="button" className="collapse-btn" onClick={() => setCollapsed((value) => !value)}>
          {collapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
          <span className="collapse-label">{collapsed ? "Expand" : "Collapse"}</span>
        </button>

        <div className="nav-search">
          <Search size={16} />
          <input value={navSearch} onChange={(e) => setNavSearch(e.target.value)} placeholder="Search pages..." />
        </div>

        <nav>
          {groupedItems.map((group) => (
            <div className="nav-section" key={group.section}>
              <div className="section-label">{group.section}</div>

              {group.items.map((item) => {
                const Icon = item.icon;
                const badgeValue = item.badge === "notifications" ? unreadCount : 0;

                return (
                  <NavLink key={item.to} to={item.to} end={item.to === "/"} title={item.label} onClick={closeMobileMenu}>
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

        <div className="system-status-card">
          <div className="status-title">
            <Activity size={15} />
            System Status
          </div>

          <div className="status-lines">
            <div className="status-line">
              <span>Portal</span>
              <strong className="status-ok">
                <Wifi size={13} />
                Online
              </strong>
            </div>

            <div className="status-line">
              <span>Notifications</span>
              <strong className="status-ok">
                <CheckCircle2 size={13} />
                Active
              </strong>
            </div>

            <div className="status-line">
              <span>Unread</span>
              <strong>{unreadCount}</strong>
            </div>
          </div>
        </div>

        <div className="sidebar-footer">
          <button className="logout-btn" onClick={logout}>
            <LogOut size={18} />
            <span className="logout-label">Logout</span>
          </button>
        </div>
      </aside>

      <div className="content-wrap">
        <header className="topbar">
          <div className="topbar-card">
            <div className="topbar-title">
              <span>
                {getGreeting()}, {user?.name || user?.username || "User"}
              </span>
              <h1>{activeItem?.label || "HR Portal"}</h1>
            </div>

            <div className="topbar-meta">
              <span className="topbar-pill">
                <Layers3 size={15} />
                {activeItem?.section || "Workspace"}
              </span>

              <span className="topbar-pill">
                <ShieldCheck size={15} />
                {prettifyRole(user?.role || user?.roleName || userRole)}
              </span>

              <span className={`topbar-pill ${unreadCount > 0 ? "critical" : ""}`}>
                <Bell size={15} />
                {unreadCount} Unread
              </span>
            </div>
          </div>
        </header>

        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
