import { useEffect, useState } from 'react';
import { apiFetch } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function SecurityPage() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const response = await apiFetch('/security/overview');
      setData(response);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function unlockUser(userId) {
    try {
      await apiFetch(`/security/users/${userId}/unlock`, { method: 'POST' });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <div className="page"><div className="card">Loading security dashboard...</div></div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Security & Audit</h1>
          <p className="muted">مراقبة الحسابات المقفلة ومحاولات الدخول والسجل الأمني.</p>
        </div>
      </div>
      {error ? <div className="card" style={{borderColor:'#ef4444'}}>{error}</div> : null}
      {user?.role !== 'System Owner' ? (
        <div className="card">هذه الصفحة متاحة لـ System Owner فقط.</div>
      ) : (
        <>
          <div className="stats-grid">
            <div className="stat-card"><span>Locked Users</span><strong>{data?.summary?.lockedUsers || 0}</strong></div>
            <div className="stat-card"><span>Failed Logins</span><strong>{data?.summary?.failedLogins || 0}</strong></div>
            <div className="stat-card"><span>Security Events</span><strong>{data?.summary?.securityEvents || 0}</strong></div>
            <div className="stat-card"><span>Audit Logs</span><strong>{data?.summary?.auditLogs || 0}</strong></div>
          </div>

          <div className="card">
            <h3>Locked Accounts</h3>
            <table className="table">
              <thead><tr><th>Name</th><th>Username</th><th>GAS ID</th><th>Division</th><th>Attempts</th><th>Action</th></tr></thead>
              <tbody>
                {(data?.lockedUsers || []).length ? data.lockedUsers.map((item) => (
                  <tr key={item.id}>
                    <td>{item.name}</td><td>{item.username}</td><td>{item.gasId}</td><td>{item.division}</td><td>{item.failedAttempts}</td>
                    <td><button className="ghost" onClick={() => unlockUser(item.id)}>Unlock</button></td>
                  </tr>
                )) : <tr><td colSpan="6">لا توجد حسابات مقفلة</td></tr>}
              </tbody>
            </table>
          </div>

          <div className="grid-two">
            <div className="card">
              <h3>Recent Login Attempts</h3>
              <ul className="activity-list">
                {(data?.recentLoginAttempts || []).map((item) => (
                  <li key={item.id}><strong>{item.username}</strong> — {item.status} <span className="muted">{item.createdAt}</span></li>
                ))}
              </ul>
            </div>
            <div className="card">
              <h3>Recent Security Events</h3>
              <ul className="activity-list">
                {(data?.recentSecurityEvents || []).map((item) => (
                  <li key={item.id}><strong>{item.eventType}</strong> — user #{item.userId || '-'} <span className="muted">{item.createdAt}</span></li>
                ))}
              </ul>
            </div>
          </div>

          <div className="card">
            <h3>Recent Audit Logs</h3>
            <ul className="activity-list">
              {(data?.recentAuditLogs || []).map((item) => (
                <li key={item.id}><strong>{item.action}</strong> — {item.actorName} <span className="muted">{item.createdAt}</span></li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
