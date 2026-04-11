import { NavLink, Outlet } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../services/api';

const navItems = [
  { to: '/', label: 'Dashboard' },
  { to: '/attendance', label: 'Attendance' },
  { to: '/users', label: 'Users' },
  { to: '/projects', label: 'Projects' },
  { to: '/requests', label: 'Requests' },
  { to: '/reports', label: 'Reports' },
  { to: '/notifications', label: 'Notifications' },
  { to: '/settings', label: 'Settings' },
  { to: '/security', label: 'Security & Audit' }
];

export default function AppShell() {
  const { user, logout } = useAuth();
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

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div>
          <h2>HR Portal</h2>
          <p className="muted">{user?.name}</p>
          <p className="muted small">{user?.role} • {user?.division}</p>
          <div className="sidebar-badge-row">
            <span className="soft-badge">{user?.project}</span>
            <span className="soft-badge warning">Unread {unreadCount}</span>
          </div>
        </div>
        <nav>
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'}>
              {item.label}
              {item.to === '/notifications' && unreadCount > 0 ? <span className="nav-pill">{unreadCount}</span> : null}
            </NavLink>
          ))}
        </nav>
        <button className="ghost" onClick={logout}>Logout</button>
      </aside>
      <main className="content"><Outlet /></main>
    </div>
  );
}
