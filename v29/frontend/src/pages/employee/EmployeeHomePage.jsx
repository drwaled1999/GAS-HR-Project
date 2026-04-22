import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../services/api";
import { useAuth } from "../../context/AuthContext";

function QuickStat({ label, value, tone, subtext }) {
  return (
    <article className={`stat-card mobile-stat ${tone || ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {subtext ? <small>{subtext}</small> : null}
    </article>
  );
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 18) return "Good Afternoon";
  return "Good Evening";
}

function resolveTodayStatus(today) {
  const present = Number(today?.present ?? 0);
  const absent = Number(today?.absent ?? 0);
  const singlePunch = Number(today?.singlePunch ?? 0);

  if (singlePunch > 0) {
    return { label: "Single Punch", tone: "warning" };
  }

  if (present > 0) {
    return { label: "Present", tone: "success" };
  }

  if (absent > 0) {
    return { label: "Absent", tone: "danger" };
  }

  return { label: "No Record", tone: "muted" };
}

function resolveAlertTone(message) {
  const text = String(message || "").toLowerCase();

  if (text.includes("approved")) return "success";
  if (text.includes("rejected")) return "danger";
  if (text.includes("pending")) return "warning";
  return "";
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

  const employeeName =
    user?.name ||
    user?.fullName ||
    dashboard?.user?.name ||
    dashboard?.user?.fullName ||
    user?.username ||
    "Employee";

  const greeting = useMemo(() => getGreeting(), []);
  const todayStatus = resolveTodayStatus(today);

  const statusBackgrounds = {
    success: "linear-gradient(135deg, #16a34a, #22c55e)",
    danger: "linear-gradient(135deg, #dc2626, #ef4444)",
    warning: "linear-gradient(135deg, #d97706, #f59e0b)",
    muted: "linear-gradient(135deg, #475569, #64748b)",
  };

  const scopeProject =
    user?.projectName ||
    user?.project ||
    dashboard?.user?.projectName ||
    dashboard?.user?.project ||
    dashboard?.user?.projectId ||
    "-";

  const scopePackage =
    user?.packageName ||
    user?.package ||
    dashboard?.user?.packageName ||
    dashboard?.user?.package ||
    dashboard?.user?.packageId ||
    "-";

  const scopeRole =
    user?.role ||
    dashboard?.user?.role ||
    user?.roleName ||
    dashboard?.user?.roleName ||
    "-";

  const totalNotifications = notificationItems.length;
  const unreadNotifications = Number(notifications?.unreadCount ?? 0);
  const readNotifications = Math.max(totalNotifications - unreadNotifications, 0);

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
          gap: 18px;
        }

        .employee-home-page .hero-card {
          border-radius: 28px;
          padding: 24px;
          background: linear-gradient(135deg, #0f172a 0%, #1d4ed8 100%);
          color: #fff;
          border: none;
          box-shadow: 0 20px 48px rgba(15, 23, 42, 0.16);
          overflow: hidden;
          position: relative;
        }

        .employee-home-page .hero-card::after {
          content: "";
          position: absolute;
          right: -60px;
          top: -60px;
          width: 180px;
          height: 180px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.08);
        }

        .employee-home-page .hero-card h1 {
          margin: 0 0 8px 0;
          font-size: 1.9rem;
          font-weight: 900;
          color: #fff;
          position: relative;
          z-index: 1;
        }

        .employee-home-page .hero-card p {
          margin: 0;
          color: rgba(255, 255, 255, 0.84);
          line-height: 1.7;
          position: relative;
          z-index: 1;
        }

        .employee-home-page .hero-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 16px;
          position: relative;
          z-index: 1;
        }

        .employee-home-page .hero-grid {
          display: grid;
          grid-template-columns: 1.4fr 0.9fr;
          gap: 16px;
        }

        .employee-home-page .hero-side-card {
          border-radius: 24px;
          padding: 20px;
          color: #fff;
          border: none;
          box-shadow: 0 16px 36px rgba(15, 23, 42, 0.12);
        }

        .employee-home-page .hero-side-card span {
          display: block;
          font-size: 0.85rem;
          color: rgba(255, 255, 255, 0.78);
          margin-bottom: 10px;
          font-weight: 700;
        }

        .employee-home-page .hero-side-card strong {
          display: block;
          font-size: 2rem;
          line-height: 1.05;
          font-weight: 900;
          color: #fff;
          margin-bottom: 10px;
        }

        .employee-home-page .hero-side-card p {
          font-size: 0.95rem;
          margin: 0;
          color: rgba(255, 255, 255, 0.88);
        }

        .employee-home-page .mobile-stat-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
        }

        .employee-home-page .mobile-stat {
          min-height: 110px;
          border-radius: 22px;
          padding: 16px;
          border: 1px solid #e8edf4;
          background: linear-gradient(180deg, #ffffff, #f8fafc);
          box-shadow: 0 12px 26px rgba(15, 23, 42, 0.05);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .employee-home-page .mobile-stat:hover {
          transform: translateY(-2px);
          box-shadow: 0 16px 30px rgba(15, 23, 42, 0.08);
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
          font-size: 1.65rem;
          line-height: 1;
          font-weight: 900;
          color: #0f172a;
          margin-bottom: 10px;
        }

        .employee-home-page .mobile-stat small {
          display: block;
          color: #94a3b8;
          font-size: 0.8rem;
          font-weight: 700;
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

        .employee-home-page .mobile-stat.success strong {
          color: #047857;
        }

        .employee-home-page .dashboard-grid {
          display: grid;
          grid-template-columns: 1.05fr 0.95fr;
          gap: 16px;
        }

        .employee-home-page .mobile-list-card {
          border-radius: 24px;
          padding: 20px;
        }

        .employee-home-page .section-card {
          border-radius: 24px;
          padding: 20px;
        }

        .employee-home-page .today-status-card {
          border-radius: 24px;
          padding: 20px;
          color: #fff;
          box-shadow: 0 16px 34px rgba(15, 23, 42, 0.12);
        }

        .employee-home-page .today-status-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 14px;
        }

        .employee-home-page .today-status-top h2 {
          margin: 0;
          color: rgba(255, 255, 255, 0.9);
          font-size: 1.15rem;
          font-weight: 800;
        }

        .employee-home-page .today-status-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 38px;
          padding: 0 14px;
          border-radius: 999px;
          font-size: 0.84rem;
          font-weight: 900;
          background: rgba(255, 255, 255, 0.16);
          color: #fff;
          border: 1px solid rgba(255, 255, 255, 0.18);
        }

        .employee-home-page .today-status-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }

        .employee-home-page .today-status-item {
          border-radius: 18px;
          padding: 14px;
          background: rgba(255, 255, 255, 0.14);
          border: 1px solid rgba(255, 255, 255, 0.15);
          backdrop-filter: blur(8px);
        }

        .employee-home-page .today-status-item span {
          display: block;
          color: rgba(255, 255, 255, 0.78);
          font-size: 0.8rem;
          font-weight: 700;
          margin-bottom: 8px;
        }

        .employee-home-page .today-status-item strong {
          color: #fff;
          font-size: 1.2rem;
          font-weight: 900;
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
          padding: 14px 16px;
          border-radius: 16px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .employee-home-page .list-row:hover {
          transform: translateY(-1px);
          box-shadow: 0 10px 20px rgba(15, 23, 42, 0.05);
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
          border-radius: 18px;
          background: #f8fafc;
          transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
        }

        .employee-home-page .activity-item.simple:hover {
          transform: translateY(-2px);
          box-shadow: 0 14px 24px rgba(15, 23, 42, 0.06);
        }

        .employee-home-page .activity-item.simple.success {
          border-left: 4px solid #16a34a;
        }

        .employee-home-page .activity-item.simple.danger {
          border-left: 4px solid #dc2626;
        }

        .employee-home-page .activity-item.simple.warning {
          border-left: 4px solid #d97706;
        }

        .employee-home-page .activity-item.simple strong {
          display: block;
          color: #0f172a;
          margin-bottom: 6px;
          line-height: 1.55;
        }

        .employee-home-page .activity-item.simple p {
          margin: 0;
          color: #64748b;
          font-size: 0.88rem;
        }

        .employee-home-page .mini-summary-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .employee-home-page .mini-summary-card {
          border-radius: 18px;
          border: 1px solid #edf2f7;
          background: #f8fafc;
          padding: 14px;
        }

        .employee-home-page .mini-summary-card span {
          display: block;
          color: #64748b;
          font-size: 0.82rem;
          font-weight: 700;
          margin-bottom: 8px;
        }

        .employee-home-page .mini-summary-card strong {
          display: block;
          color: #0f172a;
          font-size: 1.25rem;
          font-weight: 900;
        }

        @media (max-width: 900px) {
          .employee-home-page .hero-grid,
          .employee-home-page .dashboard-grid,
          .employee-home-page .mobile-stat-grid {
            grid-template-columns: 1fr;
          }

          .employee-home-page .today-status-grid,
          .employee-home-page .mini-summary-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 420px) {
          .employee-home-page .hero-card h1 {
            font-size: 1.6rem;
          }
        }
      `}</style>

      {error ? <div className="alert error">{error}</div> : null}

      <section className="hero-grid">
        <section className="card hero-card">
          <h1>
            {greeting}, {employeeName}
          </h1>
          <p>تابع حضورك وتنبيهاتك ونطاق عملك بسرعة من الجوال أو الكمبيوتر.</p>

          <div className="hero-meta">
            <span className="soft-badge">{user?.gasId || "-"}</span>
            <span className="soft-badge">
              {user?.division || dashboard?.user?.division || "-"}
            </span>
            <span className="soft-badge">{scopeRole}</span>
          </div>
        </section>

        <section
          className="hero-side-card"
          style={{
            background:
              statusBackgrounds[todayStatus.tone] || statusBackgrounds.muted,
          }}
        >
          <span>Today Status</span>
          <strong>{todayStatus.label}</strong>
          <p>
            Present: {today.present ?? 0} • Absent: {today.absent ?? 0} • Single Punch:{" "}
            {today.singlePunch ?? 0}
          </p>
        </section>
      </section>

      <section className="mobile-stat-grid">
        <QuickStat
          label="Today Present"
          value={today.present ?? 0}
          tone="success"
          subtext="حالة الحضور لليوم"
        />
        <QuickStat
          label="Today Absent"
          value={today.absent ?? 0}
          tone="danger"
          subtext="عدد الغياب اليوم"
        />
        <QuickStat
          label="Single Punch"
          value={today.singlePunch ?? 0}
          tone="warning"
          subtext="بحاجة للمراجعة"
        />
        <QuickStat
          label="Unread Alerts"
          value={notifications.unreadCount ?? 0}
          tone="info"
          subtext="تنبيهات غير مقروءة"
        />
      </section>

      <section className="dashboard-grid">
        <section
          className="today-status-card"
          style={{
            background:
              statusBackgrounds[todayStatus.tone] || statusBackgrounds.muted,
          }}
        >
          <div className="today-status-top">
            <h2>Today Overview</h2>
            <span className="today-status-badge">{todayStatus.label}</span>
          </div>

          <div className="today-status-grid">
            <div className="today-status-item">
              <span>Present</span>
              <strong>{today.present ?? 0}</strong>
            </div>
            <div className="today-status-item">
              <span>Absent</span>
              <strong>{today.absent ?? 0}</strong>
            </div>
            <div className="today-status-item">
              <span>Single Punch</span>
              <strong>{today.singlePunch ?? 0}</strong>
            </div>
          </div>
        </section>

        <section className="card section-card mobile-list-card">
          <div className="page-header compact">
            <div>
              <h2>Quick Summary</h2>
              <p>ملخص سريع من بياناتك الحالية داخل النظام</p>
            </div>
          </div>

          <div className="mini-summary-grid">
            <div className="mini-summary-card">
              <span>Total Alerts</span>
              <strong>{totalNotifications}</strong>
            </div>
            <div className="mini-summary-card">
              <span>Read Alerts</span>
              <strong>{readNotifications}</strong>
            </div>
            <div className="mini-summary-card">
              <span>Unread Alerts</span>
              <strong>{unreadNotifications}</strong>
            </div>
            <div className="mini-summary-card">
              <span>Role</span>
              <strong>{scopeRole}</strong>
            </div>
          </div>
        </section>
      </section>

      <section className="dashboard-grid">
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
              <strong>{scopeProject}</strong>
            </div>

            <div className="list-row">
              <span>Package</span>
              <strong>{scopePackage}</strong>
            </div>

            <div className="list-row">
              <span>Role</span>
              <strong>{scopeRole}</strong>
            </div>

            <div className="list-row">
              <span>Division</span>
              <strong>{user?.division || dashboard?.user?.division || "-"}</strong>
            </div>

            <div className="list-row">
              <span>GAS ID</span>
              <strong>{user?.gasId || "-"}</strong>
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
            {notificationItems.slice(0, 4).map((item) => {
              const alertTone = resolveAlertTone(item.message);

              return (
                <div key={item.id} className={`activity-item simple ${alertTone}`}>
                  <div>
                    <strong>{item.message || "-"}</strong>
                    <p>{formatDateTime(item.createdAt)}</p>
                  </div>

                  {!item.isRead ? (
                    <span className="soft-badge warning">New</span>
                  ) : null}
                </div>
              );
            })}

            {!notificationItems.length ? (
              <p className="muted">لا توجد إشعارات حاليًا.</p>
            ) : null}
          </div>
        </section>
      </section>
    </div>
  );
}
