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
  { to: "/my-project-attendance", label: "Project", icon: CalendarDays },
  { to: "/requests", label: "Requests", icon: FileText },
  { to: "/meetings", label: "Meetings", icon: Users },
  { to: "/notifications", label: "Alerts", icon: Bell, badge: "notifications" },
];

const adminItems = [
  { to: "/", label: "Home", icon: Home, end: true },
  { to: "/requests", label: "Approvals", icon: CheckCircle },
  { to: "/my-project-attendance", label: "Project", icon: CalendarDays },
  { to: "/admin/meetings", label: "Meetings", icon: Users },
  { to: "/attendance-issues", label: "Issues", icon: AlertTriangle },
  { to: "/notifications", label: "Alerts", icon: Bell, badge: "notifications" },
  { to: "/profile", label: "Profile", icon: User },
];

export default function BottomNav({ admin = false, items, unreadCount = 0 }) {
  const navItems = items || (admin ? adminItems : employeeItems);

  return (
    <nav className="bottom-nav-premium">
      <style>{`
        .bottom-nav-premium {
          position: fixed;
          left: 12px;
          right: 12px;
          bottom: 12px;
          z-index: 999;
          min-height: 82px;
          padding: 10px;
          display: grid;
          grid-template-columns: repeat(${navItems.length}, minmax(0, 1fr));
          gap: 7px;
          border-radius: 30px;
          background:
            linear-gradient(180deg, rgba(255,255,255,0.96), rgba(248,250,252,0.9));
          border: 1px solid rgba(255,255,255,0.85);
          box-shadow:
            0 22px 55px rgba(15,23,42,0.22),
            inset 0 1px 0 rgba(255,255,255,0.9);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
        }

        .bottom-nav-premium::before {
          content: "";
          position: absolute;
          inset: 8px;
          border-radius: 24px;
          background: radial-gradient(circle at 50% -20%, rgba(37,99,235,0.16), transparent 55%);
          pointer-events: none;
        }

        .bottom-nav-premium .bottom-nav-item {
          position: relative;
          min-width: 0;
          min-height: 60px;
          border-radius: 22px;
          display: grid;
          place-items: center;
          align-content: center;
          gap: 5px;
          color: #64748b;
          text-decoration: none;
          font-size: 0.68rem;
          font-weight: 900;
          letter-spacing: .2px;
          transition: all .22s ease;
          overflow: visible;
        }

        .bottom-nav-premium .bottom-nav-item svg {
          width: 23px;
          height: 23px;
          stroke-width: 2.6;
          transition: all .22s ease;
        }

        .bottom-nav-premium .bottom-nav-item span {
          max-width: 100%;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .bottom-nav-premium .bottom-nav-item.active {
          color: #fff;
          transform: translateY(-14px);
          background:
            linear-gradient(135deg, #2563eb 0%, #1d4ed8 45%, #0f46c8 100%);
          box-shadow:
            0 18px 35px rgba(37,99,235,0.38),
            0 8px 18px rgba(30,64,175,0.25),
            inset 0 1px 0 rgba(255,255,255,0.28);
          border: 1px solid rgba(255,255,255,0.25);
        }

        .bottom-nav-premium .bottom-nav-item.active::after {
          content: "";
          position: absolute;
          bottom: -9px;
          width: 6px;
          height: 6px;
          border-radius: 999px;
          background: #2563eb;
          box-shadow: 0 0 14px rgba(37,99,235,0.9);
        }

        .bottom-nav-premium .bottom-nav-item.active svg {
          filter: drop-shadow(0 4px 8px rgba(0,0,0,0.18));
        }

        .bottom-nav-premium .nav-badge {
          position: absolute;
          top: 4px;
          right: 8px;
          min-width: 19px;
          height: 19px;
          padding: 0 5px;
          border-radius: 999px;
          background: linear-gradient(135deg, #ef4444, #dc2626);
          color: #fff;
          font-size: 0.62rem;
          font-weight: 950;
          display: grid;
          place-items: center;
          border: 2px solid #fff;
          box-shadow: 0 8px 18px rgba(239,68,68,0.35);
        }

        html.dark .bottom-nav-premium {
          background:
            linear-gradient(180deg, rgba(15,23,42,0.96), rgba(15,23,42,0.88));
          border-color: rgba(148,163,184,0.18);
          box-shadow:
            0 22px 55px rgba(0,0,0,0.42),
            inset 0 1px 0 rgba(255,255,255,0.08);
        }

        html.dark .bottom-nav-premium .bottom-nav-item {
          color: #94a3b8;
        }

        html.dark .bottom-nav-premium .bottom-nav-item.active {
          color: #fff;
        }

        @media (max-width: 430px) {
          .bottom-nav-premium {
            left: 8px;
            right: 8px;
            bottom: 8px;
            min-height: 78px;
            padding: 8px;
            gap: 4px;
            border-radius: 26px;
          }

          .bottom-nav-premium .bottom-nav-item {
            min-height: 58px;
            font-size: 0.61rem;
            border-radius: 20px;
          }

          .bottom-nav-premium .bottom-nav-item svg {
            width: 21px;
            height: 21px;
          }

          .bottom-nav-premium .bottom-nav-item.active {
            transform: translateY(-11px);
          }
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
            {badgeValue > 0 ? (
              <span className="nav-badge">{badgeValue}</span>
            ) : null}
          </NavLink>
        );
      })}
    </nav>
  );
}
