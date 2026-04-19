import { useEffect, useState } from "react";
import { apiFetch } from "../../services/api";
import { useAuth } from "../../context/AuthContext";

function QuickStat({ label, value, tone }) {
  return (
    <article className={`stat-card mobile-stat ${tone || ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

export default function EmployeeHomePage() {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState(null);
  const [notifications, setNotifications] = useState({
    unreadCount: 0,
    items: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError("");

        const [summary, alerts] = await Promise.all([
          apiFetch("/dashboard/summary"),
          apiFetch("/notifications"),
        ]);

        if (cancelled) return;

        setDashboard(summary || null);
        setNotifications({
          unreadCount: Number(alerts?.unreadCount ?? 0),
          items: Array.isArray(alerts?.items) ? alerts.items : [],
        });
      } catch (err) {
        if (cancelled) return;
        console.error("Employee home load error:", err);
        setError(err?.message || "Failed to load homepage");
        setDashboard(null);
        setNotifications({
          unreadCount: 0,
          items: [],
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (user?.username) {
      load();
    } else {
      setLoading(false);
    }

    return () => {
      cancelled = true;
    };
  }, [user?.username]);

  const today = dashboard?.today || {};
  const notificationItems = Array.isArray(notifications?.items)
    ? notifications.items
    : [];

  if (loading) {
    return (
      <div className="page mobile-page employee-home-page">
        <section className="card hero-card">
          <h1>Loading...</h1>
        </section>
      </div>
    );
  }

  return (
    <div className="page mobile-page employee-home-page">
      {error ? <div className="alert error">{error}</div> : null}

      <section className="card hero-card">
        <h1>Welcome</h1>
        <p>تابع حضورك وطلباتك بسرعة من الجوال أو الكمبيوتر.</p>
        <div className="hero-meta">
          <span className="soft-badge">{user?.gasId || "-"}</span>
          <span className="soft-badge">{user?.division || "-"}</span>
        </div>
      </section>

      <section className="mobile-stat-grid">
        <QuickStat label="Today Present" value={today.present ?? 0} />
        <QuickStat label="Today Absent" value={today.absent ?? 0} tone="danger" />
        <QuickStat label="Single Punch" value={today.singlePunch ?? 0} tone="warning" />
        <QuickStat label="Alerts" value={notifications.unreadCount ?? 0} tone="info" />
      </section>

      <section className="card mobile-list-card">
        <div className="page-header compact">
          <div>
            <h2>My Scope</h2>
            <p>بياناتك الأساسية داخل النظام</p>
          </div>
        </div>
        <div className="detail-list">
          <div className="list-row">
            <span>Project</span>
            <strong>{user?.projectName || user?.project || "-"}</strong>
          </div>
          <div className="list-row">
            <span>Package</span>
            <strong>{user?.packageName || user?.package || "-"}</strong>
          </div>
          <div className="list-row">
            <span>Role</span>
            <strong>{user?.role || "-"}</strong>
          </div>
        </div>
      </section>

      <section className="card mobile-list-card">
        <div className="page-header compact">
          <div>
            <h2>Recent Alerts</h2>
            <p>آخر الإشعارات الواردة لك</p>
          </div>
        </div>
        <div className="activity-list compact-activity">
          {notificationItems.slice(0, 4).map((item) => (
            <div key={item.id} className="activity-item simple">
              <div>
                <strong>{item.message || "-"}</strong>
                <p>
                  {item?.createdAt
                    ? new Date(item.createdAt).toLocaleString()
                    : "-"}
                </p>
              </div>
              {!item.isRead ? (
                <span className="soft-badge warning">New</span>
              ) : null}
            </div>
          ))}
          {!notificationItems.length ? (
            <p className="muted">لا توجد إشعارات حاليًا.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}