import { NavLink } from "react-router-dom";
import {
  Home,
  CalendarDays,
  FileText,
  Bell,
  User,
  CheckCircle,
  AlertTriangle,
  Users,
} from "lucide-react";

const employeeItems = [
  { to: "/", label: "Home", icon: Home, end: true },
  { to: "/attendance", label: "Attendance", icon: CalendarDays },
  { to: "/my-project-attendance", label: "My Project Attendance", icon:CalendarDays } , 
  { to: "/requests", label: "Requests", icon: FileText },
  { to: "/meetings", label: "Meetings", icon: Users },
  { to: "/notifications", label: "Alerts", icon: Bell, badge: "notifications" },
  { to: "/profile", label:"Profile" ,icon: "User"},
];

const adminItems = [
  { to: "/", label: "Home", icon: Home, end: true },
  { to: "/requests", label: "Approvals", icon: CheckCircle },
  { to: "/my-project-attendance", label: "My Project Attendance", icon:CalendarDays } ,
  { to: "/admin/meetings", label: "Meetings", icon: Users },
  { to: "/attendance-issues", label: "Issues", icon: AlertTriangle },
  { to: "/notifications", label: "Alerts", icon: Bell, badge: "notifications" },
  { to: "/profile", label: "Profile", icon: User },
];

export default function BottomNav({ admin = false, items, unreadCount = 0 }) {
  const navItems = items || (admin ? adminItems : employeeItems);

  return (
    <nav className="bottom-nav-pro">
      <style>{`
        .bottom-nav-pro {
          position: fixed;
          left: 10px;
          right: 10px;
          bottom: 10px;
          z-index: 70;
          min-height: 72px;
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 6px;
          padding: 8px;
          border-radius: 24px;
          background: rgba(255,255,255,0.92);
          border: 1px solid rgba(226,232,240,0.9);
          box-shadow: 0 18px 45px rgba(15, 23, 42, 0.18);
          backdrop-filter: blur(18px);
        }

        .bottom-nav-pro .bottom-nav-item {
          position: relative;
          min-width: 0;
          min-height: 54px;
          border-radius: 18px;
          display: grid;
          place-items: center;
          align-content: center;
          gap: 4px;
          color: #64748b;
          text-decoration: none;
          font-size: 0.68rem;
          font-weight: 900;
          transition: 0.18s ease;
        }

        .bottom-nav-pro .bottom-nav-item svg {
          width: 20px;
          height: 20px;
        }

        .bottom-nav-pro .bottom-nav-item.active {
          background: linear-gradient(135deg, #2563eb, #1d4ed8);
          color: #fff;
          box-shadow: 0 12px 24px rgba(37,99,235,0.24);
          transform: translateY(-2px);
        }

        .bottom-nav-pro .nav-badge {
          position: absolute;
          top: 3px;
          right: 10px;
          min-width: 19px;
          height: 19px;
          padding: 0 5px;
          border-radius: 999px;
          background: #ef4444;
          color: #fff;
          font-size: 0.62rem;
          font-weight: 950;
          display: grid;
          place-items: center;
          border: 2px solid #fff;
        }

        html.dark .bottom-nav-pro {
          background: rgba(17,26,45,0.92);
          border-color: #24324d;
        }

        html.dark .bottom-nav-pro .bottom-nav-item {
          color: #9fb0cf;
        }

        html.dark .bottom-nav-pro .bottom-nav-item.active {
          color: #fff;
        }
      `}</style>

      {navItems.map((item) => {
        const Icon = item.icon;
        const badgeValue = item.badge === "notifications" ? unreadCount : 0;

        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              isActive ? "bottom-nav-item active" : "bottom-nav-item"
            }
          >
            <Icon />
            <span>{item.label}</span>
            {badgeValue > 0 ? <span className="nav-badge">{badgeValue}</span> : null}
          </NavLink>
        );
      })}
    </nav>
  );
}
