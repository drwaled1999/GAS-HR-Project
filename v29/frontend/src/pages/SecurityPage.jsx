import { useEffect, useState } from "react";
import { apiFetch } from "../services/api";
import { useAuth } from "../context/AuthContext";

export default function SecurityPage() {
  const { user } = useAuth();

  const [data, setData] = useState({
    summary: {
      lockedUsers: 0,
      failedLogins: 0,
      securityEvents: 0,
      auditLogs: 0,
    },
    lockedUsers: [],
    recentLoginAttempts: [],
    recentSecurityEvents: [],
    recentAuditLogs: [],
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError("");

    try {
      const [summaryRes, lockedUsersRes, loginAttemptsRes, eventsRes, auditLogsRes] =
        await Promise.all([
          apiFetch("/security/summary"),
          apiFetch("/security/locked-users"),
          apiFetch("/security/login-attempts"),
          apiFetch("/security/events"),
          apiFetch("/security/audit-logs"),
        ]);

      const lockedUsers = Array.isArray(lockedUsersRes?.users)
        ? lockedUsersRes.users
        : [];

      setData({
        summary: {
          lockedUsers: lockedUsers.length,
          failedLogins: Number(summaryRes?.failedLogins || 0),
          securityEvents: Number(summaryRes?.securityEvents || 0),
          auditLogs: Number(summaryRes?.auditLogs || 0),
        },
        lockedUsers,
        recentLoginAttempts: Array.isArray(loginAttemptsRes?.items)
          ? loginAttemptsRes.items
          : [],
        recentSecurityEvents: Array.isArray(eventsRes?.items)
          ? eventsRes.items
          : [],
        recentAuditLogs: Array.isArray(auditLogsRes?.items)
          ? auditLogsRes.items
          : [],
      });
    } catch (err) {
      console.error("Security page load error:", err);
      setError(err?.message || "Failed to load security dashboard");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function unlockUser(userId) {
    try {
      await apiFetch(`/security/unlock/${userId}`, { method: "POST" });
      await load();
    } catch (err) {
      setError(err?.message || "Failed to unlock user");
    }
  }

  if (loading) {
    return (
      <div className="page">
        <div className="card">Loading security dashboard...</div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Security & Audit</h1>
          <p className="muted">مراقبة الحسابات المقفلة ومحاولات الدخول والسجل الأمني.</p>
        </div>
      </div>

      {error ? (
        <div className="card" style={{ borderColor: "#ef4444" }}>
          {error}
        </div>
      ) : null}

      {user?.role !== "System Owner" ? (
        <div className="card">هذه الصفحة متاحة لـ System Owner فقط.</div>
      ) : (
        <>
          <div className="stats-grid">
            <div className="stat-card">
              <span>Locked Users</span>
              <strong>{data.summary.lockedUsers}</strong>
            </div>
            <div className="stat-card">
              <span>Failed Logins</span>
              <strong>{data.summary.failedLogins}</strong>
            </div>
            <div className="stat-card">
              <span>Security Events</span>
              <strong>{data.summary.securityEvents}</strong>
            </div>
            <div className="stat-card">
              <span>Audit Logs</span>
              <strong>{data.summary.auditLogs}</strong>
            </div>
          </div>

          <div className="card">
            <h3>Locked Accounts</h3>
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Username</th>
                  <th>GAS ID</th>
                  <th>Division</th>
                  <th>Attempts</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {data.lockedUsers.length ? (
                  data.lockedUsers.map((item) => (
                    <tr key={item.id}>
                      <td>{item.name || "-"}</td>
                      <td>{item.username || "-"}</td>
                      <td>{item.gasId || "-"}</td>
                      <td>{item.division || "-"}</td>
                      <td>{item.failedAttempts || 0}</td>
                      <td>
                        <button className="ghost" onClick={() => unlockUser(item.id)}>
                          Unlock
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6">لا توجد حسابات مقفلة</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="grid-two">
            <div className="card">
              <h3>Recent Login Attempts</h3>
              <ul className="activity-list">
                {data.recentLoginAttempts.map((item) => (
                  <li key={item.id}>
                    <strong>{item.username}</strong> — {item.status}{" "}
                    <span className="muted">{item.createdAt}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="card">
              <h3>Recent Security Events</h3>
              <ul className="activity-list">
                {data.recentSecurityEvents.map((item) => (
                  <li key={item.id}>
                    <strong>{item.eventType}</strong> — user #{item.userId || "-"}{" "}
                    <span className="muted">{item.createdAt}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="card">
            <h3>Recent Audit Logs</h3>
            <ul className="activity-list">
              {data.recentAuditLogs.map((item) => (
                <li key={item.id}>
                  <strong>{item.action}</strong> — {item.actorName}{" "}
                  <span className="muted">{item.createdAt}</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
