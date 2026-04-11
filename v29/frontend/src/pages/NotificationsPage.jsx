import { useEffect, useState } from 'react';
import { apiFetch } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function NotificationsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function loadNotifications() {
    if (!user?.username) return;
    const response = await apiFetch(`/notifications?username=${user.username}`);
    setItems(response.items);
    setUnreadCount(response.unreadCount);
  }

  useEffect(() => {
    loadNotifications().catch((err) => setError(err.message));
  }, [user?.username]);

  async function handleRead(id) {
    try {
      const response = await apiFetch(`/notifications/${id}/read`, {
        method: 'POST',
        body: JSON.stringify({ username: user.username })
      });
      setUnreadCount(response.unreadCount);
      setItems((current) => current.map((item) => (item.id === id ? { ...item, isRead: true } : item)));
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleReadAll() {
    try {
      const response = await apiFetch('/notifications/read-all', {
        method: 'POST',
        body: JSON.stringify({ username: user.username })
      });
      setUnreadCount(response.unreadCount);
      setItems((current) => current.map((item) => ({ ...item, isRead: true })));
      setMessage(`تم تحديث ${response.updated} إشعار`);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="page">
      <section className="card page-header">
        <div>
          <h1>Notifications</h1>
          <p>كل طلب تعديل وموافقة ورفض يظهر لك هنا.</p>
        </div>
        <div className="inline-actions">
          <span className="soft-badge">Unread: {unreadCount}</span>
          <button className="ghost" onClick={handleReadAll}>Mark all as read</button>
        </div>
      </section>

      {message ? <div className="alert success">{message}</div> : null}
      {error ? <div className="alert error">{error}</div> : null}

      <section className="card activity-list">
        {!items.length ? <div className="muted">No notifications yet.</div> : null}
        {items.map((item) => (
          <div key={item.id} className={`notification-item ${item.isRead ? 'is-read' : ''}`}>
            <div>
              <strong>{item.message}</strong>
              <p>{new Date(item.createdAt).toLocaleString()}</p>
            </div>
            <div className="activity-meta">
              <span className={`soft-badge ${item.isRead ? '' : 'warning'}`}>{item.type}</span>
              {!item.isRead ? <button className="ghost" onClick={() => handleRead(item.id)}>Mark read</button> : null}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
