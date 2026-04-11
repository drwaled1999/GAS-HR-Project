import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LanguageSwitcher from '../components/LanguageSwitcher';
import ThemeToggle from '../components/ThemeToggle';

const links = [
  ['/', 'Dashboard'],
  ['/attendance', 'Attendance'],
  ['/attendance-issues', 'Issues'],
  ['/users', 'Users'],
  ['/projects', 'Projects'],
  ['/requests', 'Requests'],
  ['/notifications', 'Notifications'],
  ['/reports', 'Reports'],
  ['/payroll', 'Payroll'],
  ['/security', 'Security'],
  ['/settings', 'Settings']
];

export default function AdminDesktopLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="app-shell theme-shell">
      <aside className="sidebar">
        <div>
          <strong>HR Portal</strong>
          <p className="muted small">{user?.name}</p>
        </div>
        <nav>
          {links.map(([path, label]) => (
            <NavLink key={path} to={path} end={path === '/'}>{label}</NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="toolbar-row compact-end">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
          <button className="ghost" onClick={logout}>Logout</button>
        </div>
      </aside>
      <main className="content"><Outlet /></main>
    </div>
  );
}
