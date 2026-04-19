import { NavLink } from "react-router-dom";

const employeeItems = [
  { to: "/", label: "Home", icon: "🏠", end: true },
  { to: "/attendance", label: "Attendance", icon: "📅" },
  { to: "/requests", label: "Requests", icon: "📝" },
  { to: "/notifications", label: "Alerts", icon: "🔔" },
  { to: "/profile", label: "Profile", icon: "👤" },
];

const adminItems = [
  { to: "/", label: "Home", icon: "🏠", end: true },
  { to: "/requests", label: "Approvals", icon: "✅" },
  { to: "/attendance-issues", label: "Issues", icon: "⚠️" },
  { to: "/notifications", label: "Alerts", icon: "🔔" },
  { to: "/profile", label: "Profile", icon: "👤" },
];

export default function BottomNav({ admin = false, items }) {
  const navItems = items || (admin ? adminItems : employeeItems);

  return (
    <nav className="bottom-nav">
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            isActive ? "bottom-nav-item active" : "bottom-nav-item"
          }
        >
          <span className="bottom-nav-icon">{item.icon}</span>
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}