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
    <nav className="bottom-nav-luxury">
      <style>{`
        .bottom-nav-luxury {
          position: fixed;
          left: 12px;
          right: 12px;
          bottom: 12px;
          z-index: 999;

          min-height: 78px;
          padding: 9px;

          display: grid;
          grid-template-columns: repeat(${navItems.length}, minmax(0, 1fr));
          gap: 5px;

          border-radius: 999px;

          background:
            linear-gradient(180deg, rgba(255,255,255,0.97), rgba(248,250,252,0.90));

          border: 1px solid rgba(255,255,255,0.92);

          box-shadow:
            0 24px 60px rgba(15,23,42,0.20),
            0 8px 24px rgba(37,99,235,0.08),
            inset 0 1px 0 rgba(255,255,255,0.95);

          backdrop-filter: blur(28px);
          -webkit-backdrop-filter: blur(28px);

          overflow: visible;
        }

        .bottom-nav-luxury::before {
          content: "";
          position: absolute;
          inset: 7px;
          border-radius: 999px;
          background:
            radial-gradient(circle at 50% -20%, rgba(59,130,246,0.14), transparent 48%),
            linear-gradient(180deg, rgba(255,255,255,0.28), transparent);
          pointer-events: none;
        }

        .bottom-nav-luxury .bottom-nav-item {
          position: relative;
          min-width: 0;
          min-height: 56px;

          display: grid;
          place-items: center;
          align-content: center;
          gap: 5px;

          border-radius: 999px;

          color: #64748b;
          text-decoration: none;

          font-size: 0.66rem;
          font-weight: 850;
          letter-spacing: .15px;

          transition: all .24s cubic-bezier(.2,.8,.2,1);
          overflow: visible;
        }

        .bottom-nav-luxury .bottom-nav-item svg {
          width: 22px;
          height: 22px;
          stroke-width: 2.5;
          transition: all .24s cubic-bezier(.2,.8,.2,1);
        }

        .bottom-nav-luxury .bottom-nav-item span {
          max-width: 100%;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .bottom-nav-luxury .bottom-nav-item.active {
          color: #fff;

          transform: translateY(-10px);

          background:
            radial-gradient(circle at 30% 18%, rgba(255,255,255,0.34), transparent 34%),
            linear-gradient(145deg, #3b82f6 0%, #2563eb 45%, #1e40af 100%);

          border: 1px solid rgba(255,255,255,0.34);

          box-shadow:
            0 16px 34px rgba(37,99,235,0.30),
            0 6px 16px rgba(30,64,175,0.18),
            inset 0 1px 1px rgba(255,255,255,0.38);

          border-radius: 26px;
        }

        .bottom-nav-luxury .bottom-nav-item.active::before {
          content: "";
          position: absolute;
          inset: -3px;
          border-radius: 29px;
          background: linear-gradient(135deg, rgba(255,255,255,0.42), rgba(59,130,246,0.22));
          z-index: -1;
          filter: blur(.2px);
        }

        .bottom-nav-luxury .bottom-nav-item.active::after {
          content: "";
          position: absolute;
          bottom: -8px;
          width: 5px;
          height: 5px;
          border-radius: 999px;
          background: rgba(37,99,235,0.85);
          box-shadow: 0 0 10px rgba(37,99,235,0.55);
        }

        .bottom-nav-luxury .bottom-nav-item.active svg {
          transform: translateY(-1px);
          filter: drop-shadow(0 4px 8px rgba(0,0,0,0.16));
        }

        .bottom-nav-luxury .nav-badge {
          position: absolute;
          top: 2px;
          right: 7px;

          min-width: 18px;
          height: 18px;
          padding: 0 5px;

          border-radius: 999px;
          background: linear-gradient(135deg, #ef4444, #dc2626);
          color: #fff;

          font-size: 0.6rem;
          font-weight: 950;

          display: grid;
          place-items: center;

          border: 2px solid #fff;

          box-shadow:
            0 8px 18px rgba(239,68,68,0.32),
            inset 0 1px 0 rgba(255,255,255,0.28);
        }

        html.dark .bottom-nav-luxury {
          background:
            linear-gradient(180deg, rgba(15,23,42,0.96), rgba(15,23,42,0.88));
          border-color: rgba(148,163,184,0.18);
          box-shadow:
            0 24px 60px rgba(0,0,0,0.45),
            inset 0 1px 0 rgba(255,255,255,0.08);
        }

        html.dark .bottom-nav-luxury::before {
          background:
            radial-gradient(circle at 50% -20%, rgba(59,130,246,0.20), transparent 48%),
            linear-gradient(180deg, rgba(255,255,255,0.06), transparent);
        }

        html.dark .bottom-nav-luxury .bottom-nav-item {
          color: #94a3b8;
        }

        html.dark .bottom-nav-luxury .bottom-nav-item.active {
          color: #fff;
        }

        @media (max-width: 430px) {
          .bottom-nav-luxury {
            left: 8px;
            right: 8px;
            bottom: 8px;
            min-height: 74px;
            padding: 8px;
            gap: 3px;
          }

          .bottom-nav-luxury .bottom-nav-item {
            min-height: 54px;
            font-size: 0.6rem;
          }

          .bottom-nav-luxury .bottom-nav-item svg {
            width: 21px;
            height: 21px;
          }

          .bottom-nav-luxury .bottom-nav-item.active {
            transform: translateY(-8px);
            border-radius: 23px;
          }

          .bottom-nav-luxury .bottom-nav-item.active::before {
            border-radius: 26px;
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
