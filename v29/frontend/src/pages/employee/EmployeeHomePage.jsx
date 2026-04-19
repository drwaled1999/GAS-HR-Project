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

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
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
          <p>جاري تحميل بياناتك...</p>
        </section>
      </div>
    );
  }

  return (
    <div className="page mobile-page employee-home-page">
      <style>{`
        .employee-home-page {
          display: grid;
          gap: 16px;
        }

        .employee-home-page .hero-card {
          border-radius: 24px;
          padding: 22px;
          background: linear-gradient(135deg, #0f172a 0%, #1d4ed8 100%);
          color: #fff;
          border: none;
          box-shadow: 0 18px 42px rgba(15, 23, 42, 0.14);
        }

        .employee-home-page .hero-card h1 {
          margin: 0 0 8px 0;
          font-size: 1.8rem;
          font-weight: 900;
          color: #fff;
        }

        .employee-home-page .hero-card p {
          margin: 0;
          color: rgba(255, 255, 255, 0.84);
          line-height: 1.7;
        }

        .employee-home-page .hero-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 16px;
        }

        .employee-home-page .mobile-stat-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .employee-home-page .mobile-stat {
          min-height: 96px;
          border-radius: 20px;
          padding: 16px;
          border: 1px solid #e8edf4;
          background: linear-gradient(180deg, #ffffff, #f8fafc);
          box-shadow: 0 12px 26px rgba(15, 23, 42, 0.05);
        }

        .employee-home-page .mobile-stat span {
          display: block;
          color: #64748b;
          font-size: 0.86rem;
          font-weight: 700;
          margin-bottom: 10px;
        }

        .employee-home-page .mobile-stat strong {
          display: block;
          font-size: 1.6rem;
          line-height: 1;
          font-weight: 900;
          color: #0f172a;
        }

        .employee-home-page .mobile-stat.danger strong {
          color: #b42318;
        }

        .employee-home-page .mobile-stat.warning strong {
          color: #b45309;
        }

        .employee-home-page .mobile-stat.info strong {
          color: #1d4ed8;
        }

        .employee-home-page .mobile-list-card {
          border-radius: 22px;
        }

        .employee-home-page .detail-list,
        .employee-home-page .activity-list {
          display: grid;
          gap: 10px;
        }

        .employee-home-page .list-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 14px 0;
          border-bottom: 1px solid #eef2f7;
        }

        .employee-home-page .list-row:last-child {
          border-bottom: none;
        }

        .employee-home-page .list-row span {
          color: #64748b;
          font-weight: 700;
        }

        .employee-home-page .list-row strong {
          color: #0f172a;
          font-weight: 900;
          text-align: right;
          word-break: break-word;
        }

        .employee-home-page .activity-item.simple {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          padding: 14px;
          border: 1px solid #edf2f7;
          border-radius: 16px;
          background: #f8fafc;
        }

        .employee-home-page .activity-item.simple strong {
          display: block;
          color: #0f172a;
          margin-bottom: 6px;
          line-height: 1.5;
        }

        .employee-home-page .activity-item.simple p {
          margin: 0;
          color: #64748b;
          font-size: 0.88rem;
        }

        @media (max-width: 420px) {
          .employee-home-page .mobile-stat-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      {error ? <div className="alert error">{error}</div> : null}

      <section className="card hero-card">
        <h1>Welcome</h1>
        <p>تابع حضورك وطلباتك بسرعة من الجوال أو الكمبيوتر.</p>
        <div className="hero-meta">
          <span className="soft-badge">{user?.gasId || "-"}</span>
          <span className="soft-badge">{user?.division || dashboard?.user?.division || "-"}</span>
          <span className="soft-badge">{user?.role || dashboard?.user?.role || "-"}</span>
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
            <strong>{user?.projectName || user?.project || dashboard?.user?.projectId || "-"}</strong>
          </div>

          <div className="list-row">
            <span>Package</span>
            <strong>{user?.packageName || user?.package || dashboard?.user?.packageId || "-"}</strong>
          </div>

          <div className="list-row">
            <span>Role</span>
            <strong>{user?.role || dashboard?.user?.role || "-"}</strong>
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
                <p>{formatDateTime(item.createdAt)}</p>
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