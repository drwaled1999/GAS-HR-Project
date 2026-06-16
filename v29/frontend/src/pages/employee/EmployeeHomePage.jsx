import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bell,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  UserRound,
  BriefcaseBusiness,
  ShieldCheck,
  AlertTriangle,
  ChevronRight,
} from "lucide-react";
import { apiFetch } from "../../services/api";
import { useAuth } from "../../context/AuthContext";

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

function getInitials(name) {
  return String(name || "E")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function resolveTodayStatus(today) {
  const present = Number(today?.present ?? 0);
  const absent = Number(today?.absent ?? 0);
  const singlePunch = Number(today?.singlePunch ?? 0);

  if (singlePunch > 0) return { label: "Single Punch", tone: "warning" };
  if (present > 0) return { label: "Present", tone: "success" };
  if (absent > 0) return { label: "Absent", tone: "danger" };

  return { label: "No Record", tone: "muted" };
}

function resolveAlertTone(message) {
  const text = String(message || "").toLowerCase();

  if (text.includes("approved")) return "success";
  if (text.includes("rejected")) return "danger";
  if (text.includes("pending")) return "warning";

  return "";
}

function StatCard({ icon: Icon, label, value, subtext, tone }) {
  return (
    <article className={`premium-stat ${tone || ""}`}>
      <div className="premium-stat-icon">
        <Icon size={21} />
      </div>

      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        {subtext ? <small>{subtext}</small> : null}
      </div>
    </article>
  );
}

function ScopeRow({ icon: Icon, label, value }) {
  return (
    <div className="scope-row">
      <div className="scope-icon">
        <Icon size={18} />
      </div>

      <div>
        <span>{label}</span>
        <strong>{value || "-"}</strong>
      </div>
    </div>
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

  const employeeName =
    user?.name ||
    user?.fullName ||
    dashboard?.user?.name ||
    dashboard?.user?.fullName ||
    user?.username ||
    "Employee";

  const greeting = useMemo(() => getGreeting(), []);
  const todayStatus = resolveTodayStatus(today);

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
  const readNotifications = Math.max(
    totalNotifications - unreadNotifications,
    0
  );

  const statusIcon =
    todayStatus.tone === "success"
      ? CheckCircle2
      : todayStatus.tone === "warning"
      ? AlertTriangle
      : todayStatus.tone === "danger"
      ? AlertTriangle
      : Clock3;

  const StatusIcon = statusIcon;

  if (loading) {
    return (
      <div className="page mobile-page employee-home-page">
        <style>{`
          .employee-home-page {
            min-height: 100vh;
            display: grid;
            place-items: center;
            background:
              radial-gradient(circle at top right, rgba(37, 99, 235, 0.18), transparent 34%),
              radial-gradient(circle at bottom left, rgba(20, 184, 166, 0.15), transparent 32%),
              #f8fafc;
          }

          .premium-loader {
            width: min(460px, 100%);
            border-radius: 32px;
            padding: 34px;
            background: rgba(255, 255, 255, 0.78);
            border: 1px solid rgba(226, 232, 240, 0.9);
            box-shadow: 0 24px 70px rgba(15, 23, 42, 0.12);
            backdrop-filter: blur(22px);
          }

          .premium-loader h1 {
            margin: 0 0 8px;
            color: #0f172a;
            font-size: 1.8rem;
            font-weight: 950;
          }

          .premium-loader p {
            margin: 0;
            color: #64748b;
            font-weight: 700;
          }
        `}</style>

        <section className="premium-loader">
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
          min-height: 100vh;
          display: grid;
          gap: 18px;
          padding-bottom: 28px;
          background:
            radial-gradient(circle at 92% 4%, rgba(37, 99, 235, 0.16), transparent 32%),
            radial-gradient(circle at 4% 88%, rgba(20, 184, 166, 0.13), transparent 30%),
            linear-gradient(180deg, #f8fafc 0%, #eef2f7 100%);
        }

        .employee-home-page * {
          box-sizing: border-box;
        }

        .premium-hero {
          position: relative;
          overflow: hidden;
          border-radius: 34px;
          padding: 26px;
          color: #fff;
          background:
            radial-gradient(circle at 85% 10%, rgba(96, 165, 250, 0.42), transparent 28%),
            linear-gradient(135deg, #020617 0%, #0f172a 45%, #1e3a8a 100%);
          box-shadow:
            0 28px 80px rgba(15, 23, 42, 0.25),
            inset 0 1px 0 rgba(255,255,255,0.12);
          border: 1px solid rgba(255, 255, 255, 0.12);
        }

        .premium-hero::before,
        .premium-hero::after {
          content: "";
          position: absolute;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.08);
          pointer-events: none;
        }

        .premium-hero::before {
          width: 220px;
          height: 220px;
          right: -85px;
          top: -85px;
        }

        .premium-hero::after {
          width: 150px;
          height: 150px;
          left: -60px;
          bottom: -65px;
        }

        .hero-content {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 18px;
          align-items: center;
        }

        .hero-profile {
          display: flex;
          align-items: center;
          gap: 15px;
          min-width: 0;
        }

        .hero-avatar {
          width: 64px;
          height: 64px;
          flex: 0 0 auto;
          display: grid;
          place-items: center;
          border-radius: 22px;
          background: rgba(255, 255, 255, 0.14);
          border: 1px solid rgba(255, 255, 255, 0.18);
          color: #fff;
          font-size: 1.2rem;
          font-weight: 950;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.18);
          backdrop-filter: blur(14px);
        }

        .hero-kicker {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
          color: rgba(255, 255, 255, 0.76);
          font-size: 0.86rem;
          font-weight: 800;
        }

        .premium-hero h1 {
          margin: 0;
          color: #fff;
          font-size: clamp(1.55rem, 3vw, 2.25rem);
          line-height: 1.14;
          font-weight: 950;
          letter-spacing: -0.03em;
        }

        .premium-hero p {
          margin: 8px 0 0;
          color: rgba(255, 255, 255, 0.78);
          line-height: 1.7;
          font-weight: 650;
        }

        .hero-status {
          min-width: 220px;
          border-radius: 28px;
          padding: 18px;
          background: rgba(255, 255, 255, 0.11);
          border: 1px solid rgba(255, 255, 255, 0.16);
          backdrop-filter: blur(18px);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.14);
        }

        .hero-status-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          margin-bottom: 12px;
        }

        .status-orb {
          width: 44px;
          height: 44px;
          display: grid;
          place-items: center;
          border-radius: 17px;
          color: #fff;
          background: rgba(255, 255, 255, 0.16);
          border: 1px solid rgba(255, 255, 255, 0.18);
        }

        .status-pill {
          display: inline-flex;
          align-items: center;
          min-height: 34px;
          padding: 0 12px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.14);
          border: 1px solid rgba(255, 255, 255, 0.16);
          color: #fff;
          font-size: 0.78rem;
          font-weight: 950;
        }

        .hero-status strong {
          display: block;
          color: #fff;
          font-size: 1.55rem;
          font-weight: 950;
          letter-spacing: -0.03em;
          margin-bottom: 6px;
        }

        .hero-status span {
          color: rgba(255, 255, 255, 0.74);
          font-size: 0.86rem;
          font-weight: 750;
        }

        .hero-meta {
          position: relative;
          z-index: 1;
          display: flex;
          flex-wrap: wrap;
          gap: 9px;
          margin-top: 20px;
        }

        .premium-badge {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          min-height: 34px;
          padding: 0 12px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.12);
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: rgba(255, 255, 255, 0.9);
          font-size: 0.8rem;
          font-weight: 850;
          backdrop-filter: blur(12px);
        }

        .premium-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
        }

        .premium-stat {
          position: relative;
          overflow: hidden;
          min-height: 132px;
          display: flex;
          align-items: flex-start;
          gap: 14px;
          border-radius: 28px;
          padding: 18px;
          background: rgba(255, 255, 255, 0.82);
          border: 1px solid rgba(226, 232, 240, 0.92);
          box-shadow:
            0 18px 48px rgba(15, 23, 42, 0.08),
            inset 0 1px 0 rgba(255,255,255,0.75);
          backdrop-filter: blur(18px);
          transition: transform .25s ease, box-shadow .25s ease, border-color .25s ease;
        }

        .premium-stat:hover {
          transform: translateY(-4px);
          box-shadow:
            0 24px 58px rgba(15, 23, 42, 0.11),
            inset 0 1px 0 rgba(255,255,255,0.85);
          border-color: rgba(148, 163, 184, 0.48);
        }

        .premium-stat::after {
          content: "";
          position: absolute;
          width: 92px;
          height: 92px;
          right: -38px;
          bottom: -38px;
          border-radius: 999px;
          background: rgba(37, 99, 235, 0.08);
        }

        .premium-stat-icon {
          width: 46px;
          height: 46px;
          flex: 0 0 auto;
          display: grid;
          place-items: center;
          border-radius: 18px;
          background: #eff6ff;
          color: #1d4ed8;
        }

        .premium-stat.success .premium-stat-icon {
          background: #ecfdf5;
          color: #047857;
        }

        .premium-stat.danger .premium-stat-icon {
          background: #fef2f2;
          color: #b42318;
        }

        .premium-stat.warning .premium-stat-icon {
          background: #fffbeb;
          color: #b45309;
        }

        .premium-stat.info .premium-stat-icon {
          background: #eef2ff;
          color: #4338ca;
        }

        .premium-stat span {
          display: block;
          color: #64748b;
          font-size: 0.84rem;
          font-weight: 850;
          margin-bottom: 8px;
        }

        .premium-stat strong {
          display: block;
          color: #0f172a;
          font-size: 1.85rem;
          line-height: 1;
          font-weight: 950;
          letter-spacing: -0.04em;
          margin-bottom: 9px;
        }

        .premium-stat small {
          display: block;
          color: #94a3b8;
          font-size: 0.78rem;
          font-weight: 800;
        }

        .dashboard-grid {
          display: grid;
          grid-template-columns: 1.05fr 0.95fr;
          gap: 16px;
        }

        .premium-card {
          border-radius: 30px;
          padding: 22px;
          background: rgba(255, 255, 255, 0.84);
          border: 1px solid rgba(226, 232, 240, 0.95);
          box-shadow:
            0 18px 50px rgba(15, 23, 42, 0.08),
            inset 0 1px 0 rgba(255,255,255,0.74);
          backdrop-filter: blur(18px);
        }

        .premium-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          margin-bottom: 18px;
        }

        .premium-card-header h2 {
          margin: 0;
          color: #0f172a;
          font-size: 1.22rem;
          font-weight: 950;
          letter-spacing: -0.025em;
        }

        .premium-card-header p {
          margin: 6px 0 0;
          color: #64748b;
          line-height: 1.55;
          font-size: 0.9rem;
          font-weight: 650;
        }

        .quick-actions {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
        }

        .quick-action {
          min-height: 106px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 14px;
          padding: 16px;
          border-radius: 24px;
          text-decoration: none;
          background:
            linear-gradient(180deg, #ffffff, #f8fafc);
          border: 1px solid #e2e8f0;
          color: #0f172a;
          box-shadow: 0 12px 28px rgba(15, 23, 42, 0.05);
          transition: transform .22s ease, box-shadow .22s ease, border-color .22s ease;
        }

        .quick-action:hover {
          transform: translateY(-3px);
          box-shadow: 0 18px 34px rgba(15, 23, 42, 0.08);
          border-color: #cbd5e1;
        }

        .quick-action-icon {
          width: 42px;
          height: 42px;
          display: grid;
          place-items: center;
          border-radius: 17px;
          background: #f1f5f9;
          color: #1e293b;
        }

        .quick-action strong {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          font-size: 0.9rem;
          font-weight: 950;
          color: #0f172a;
        }

        .overview-card {
          position: relative;
          overflow: hidden;
          color: #fff;
          background:
            radial-gradient(circle at 90% 0%, rgba(255,255,255,0.19), transparent 30%),
            linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%);
          border: 1px solid rgba(255, 255, 255, 0.13);
        }

        .overview-card .premium-card-header h2,
        .overview-card .premium-card-header p {
          color: #fff;
        }

        .overview-card .premium-card-header p {
          color: rgba(255,255,255,0.74);
        }

        .status-overview-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }

        .status-box {
          border-radius: 22px;
          padding: 16px;
          background: rgba(255, 255, 255, 0.12);
          border: 1px solid rgba(255, 255, 255, 0.14);
          backdrop-filter: blur(14px);
        }

        .status-box span {
          display: block;
          color: rgba(255,255,255,0.72);
          font-size: 0.8rem;
          font-weight: 800;
          margin-bottom: 8px;
        }

        .status-box strong {
          display: block;
          color: #fff;
          font-size: 1.5rem;
          font-weight: 950;
        }

        .summary-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .summary-box {
          border-radius: 22px;
          padding: 16px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
        }

        .summary-box span {
          display: block;
          color: #64748b;
          font-size: 0.82rem;
          font-weight: 850;
          margin-bottom: 8px;
        }

        .summary-box strong {
          display: block;
          color: #0f172a;
          font-size: 1.35rem;
          line-height: 1.1;
          font-weight: 950;
          word-break: break-word;
        }

        .scope-list {
          display: grid;
          gap: 11px;
        }

        .scope-row {
          display: flex;
          align-items: center;
          gap: 13px;
          padding: 15px;
          border-radius: 22px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          transition: transform .22s ease, box-shadow .22s ease;
        }

        .scope-row:hover {
          transform: translateY(-2px);
          box-shadow: 0 14px 28px rgba(15, 23, 42, 0.06);
        }

        .scope-icon {
          width: 42px;
          height: 42px;
          flex: 0 0 auto;
          display: grid;
          place-items: center;
          border-radius: 16px;
          background: #eff6ff;
          color: #1d4ed8;
        }

        .scope-row span {
          display: block;
          color: #64748b;
          font-size: 0.82rem;
          font-weight: 850;
          margin-bottom: 4px;
        }

        .scope-row strong {
          display: block;
          color: #0f172a;
          font-size: 0.98rem;
          font-weight: 950;
          line-height: 1.35;
          word-break: break-word;
        }

        .activity-timeline {
          display: grid;
          gap: 12px;
          position: relative;
        }

        .activity-item {
          position: relative;
          display: flex;
          gap: 12px;
          padding: 14px;
          border-radius: 22px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          transition: transform .22s ease, box-shadow .22s ease, border-color .22s ease;
        }

        .activity-item:hover {
          transform: translateY(-2px);
          box-shadow: 0 16px 30px rgba(15, 23, 42, 0.07);
          border-color: #cbd5e1;
        }

        .activity-dot {
          width: 40px;
          height: 40px;
          flex: 0 0 auto;
          display: grid;
          place-items: center;
          border-radius: 16px;
          background: #e2e8f0;
          color: #475569;
        }

        .activity-item.success .activity-dot {
          background: #dcfce7;
          color: #047857;
        }

        .activity-item.danger .activity-dot {
          background: #fee2e2;
          color: #b42318;
        }

        .activity-item.warning .activity-dot {
          background: #fef3c7;
          color: #b45309;
        }

        .activity-body {
          flex: 1;
          min-width: 0;
        }

        .activity-body strong {
          display: block;
          color: #0f172a;
          font-size: 0.94rem;
          line-height: 1.55;
          font-weight: 900;
          margin-bottom: 5px;
        }

        .activity-body p {
          margin: 0;
          color: #64748b;
          font-size: 0.82rem;
          font-weight: 700;
        }

        .new-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 28px;
          padding: 0 10px;
          border-radius: 999px;
          background: #fff7ed;
          border: 1px solid #fed7aa;
          color: #c2410c;
          font-size: 0.72rem;
          font-weight: 950;
        }

        .empty-text {
          margin: 0;
          padding: 18px;
          border-radius: 22px;
          background: #f8fafc;
          border: 1px dashed #cbd5e1;
          color: #64748b;
          font-weight: 750;
          text-align: center;
        }

        .alert.error {
          border-radius: 22px;
          padding: 14px 16px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #b42318;
          font-weight: 850;
        }

        @media (max-width: 1050px) {
          .premium-grid,
          .quick-actions {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .dashboard-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 720px) {
          .employee-home-page {
            gap: 14px;
          }

          .premium-hero {
            border-radius: 30px;
            padding: 20px;
          }

          .hero-content {
            grid-template-columns: 1fr;
          }

          .hero-status {
            min-width: 0;
          }

          .hero-profile {
            align-items: flex-start;
          }

          .hero-avatar {
            width: 56px;
            height: 56px;
            border-radius: 20px;
          }

          .premium-grid,
          .quick-actions,
          .summary-grid,
          .status-overview-grid {
            grid-template-columns: 1fr;
          }

          .premium-card {
            border-radius: 26px;
            padding: 18px;
          }

          .premium-stat {
            min-height: 112px;
          }
        }

        @media (max-width: 420px) {
          .premium-hero h1 {
            font-size: 1.45rem;
          }

          .hero-profile {
            gap: 12px;
          }

          .premium-badge {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>

      {error ? <div className="alert error">{error}</div> : null}

      <section className="premium-hero">
        <div className="hero-content">
          <div className="hero-profile">
            <div className="hero-avatar">{getInitials(employeeName)}</div>

            <div>
              <div className="hero-kicker">
                <ShieldCheck size={16} />
                GAS HR Portal
              </div>

              <h1>
                {greeting}, {employeeName}
              </h1>

              <p>
                تابع حضورك وتنبيهاتك ونطاق عملك من لوحة ناعمة وسريعة متوافقة
                مع الجوال والكمبيوتر.
              </p>
            </div>
          </div>

          <aside className="hero-status">
            <div className="hero-status-top">
              <div className="status-orb">
                <StatusIcon size={22} />
              </div>

              <span className="status-pill">Today</span>
            </div>

            <strong>{todayStatus.label}</strong>
            <span>
              Present {today.present ?? 0} • Absent {today.absent ?? 0} • SP{" "}
              {today.singlePunch ?? 0}
            </span>
          </aside>
        </div>

        <div className="hero-meta">
          <span className="premium-badge">
            <UserRound size={15} />
            GAS ID: {user?.gasId || "-"}
          </span>

          <span className="premium-badge">
            <BriefcaseBusiness size={15} />
            {user?.division || dashboard?.user?.division || "-"}
          </span>

          <span className="premium-badge">
            <ShieldCheck size={15} />
            {scopeRole}
          </span>
        </div>
      </section>

      <section className="premium-grid">
        <StatCard
          icon={CheckCircle2}
          label="Today Present"
          value={today.present ?? 0}
          tone="success"
          subtext="حالة الحضور لليوم"
        />

        <StatCard
          icon={AlertTriangle}
          label="Today Absent"
          value={today.absent ?? 0}
          tone="danger"
          subtext="عدد الغياب اليوم"
        />

        <StatCard
          icon={Clock3}
          label="Single Punch"
          value={today.singlePunch ?? 0}
          tone="warning"
          subtext="بحاجة للمراجعة"
        />

        <StatCard
          icon={Bell}
          label="Unread Alerts"
          value={unreadNotifications}
          tone="info"
          subtext="تنبيهات غير مقروءة"
        />
      </section>

      <section className="premium-card">
        <div className="premium-card-header">
          <div>
            <h2>Quick Actions</h2>
            <p>اختصارات سريعة لأهم الخدمات اليومية للموظف</p>
          </div>
        </div>

        <div className="quick-actions">
          <Link to="/requests" className="quick-action">
            <div className="quick-action-icon">
              <FileText size={21} />
            </div>
            <strong>
              Requests
              <ChevronRight size={17} />
            </strong>
          </Link>

          <Link to="/attendance" className="quick-action">
            <div className="quick-action-icon">
              <CalendarDays size={21} />
            </div>
            <strong>
              Attendance
              <ChevronRight size={17} />
            </strong>
          </Link>

          <Link to="/notifications" className="quick-action">
            <div className="quick-action-icon">
              <Bell size={21} />
            </div>
            <strong>
              Notifications
              <ChevronRight size={17} />
            </strong>
          </Link>

          <Link to="/profile" className="quick-action">
            <div className="quick-action-icon">
              <UserRound size={21} />
            </div>
            <strong>
              Profile
              <ChevronRight size={17} />
            </strong>
          </Link>
        </div>
      </section>

      <section className="dashboard-grid">
        <section className="premium-card overview-card">
          <div className="premium-card-header">
            <div>
              <h2>Today Overview</h2>
              <p>ملخص حالة الحضور الخاصة باليوم</p>
            </div>

            <span className="status-pill">{todayStatus.label}</span>
          </div>

          <div className="status-overview-grid">
            <div className="status-box">
              <span>Present</span>
              <strong>{today.present ?? 0}</strong>
            </div>

            <div className="status-box">
              <span>Absent</span>
              <strong>{today.absent ?? 0}</strong>
            </div>

            <div className="status-box">
              <span>Single Punch</span>
              <strong>{today.singlePunch ?? 0}</strong>
            </div>
          </div>
        </section>

        <section className="premium-card">
          <div className="premium-card-header">
            <div>
              <h2>Quick Summary</h2>
              <p>ملخص سريع من بياناتك الحالية داخل النظام</p>
            </div>
          </div>

          <div className="summary-grid">
            <div className="summary-box">
              <span>Total Alerts</span>
              <strong>{totalNotifications}</strong>
            </div>

            <div className="summary-box">
              <span>Read Alerts</span>
              <strong>{readNotifications}</strong>
            </div>

            <div className="summary-box">
              <span>Unread Alerts</span>
              <strong>{unreadNotifications}</strong>
            </div>

            <div className="summary-box">
              <span>Role</span>
              <strong>{scopeRole}</strong>
            </div>
          </div>
        </section>
      </section>

      <section className="dashboard-grid">
        <section className="premium-card">
          <div className="premium-card-header">
            <div>
              <h2>My Scope</h2>
              <p>بياناتك الأساسية داخل النظام</p>
            </div>
          </div>

          <div className="scope-list">
            <ScopeRow icon={BriefcaseBusiness} label="Project" value={scopeProject} />
            <ScopeRow icon={FileText} label="Package" value={scopePackage} />
            <ScopeRow icon={ShieldCheck} label="Role" value={scopeRole} />
            <ScopeRow
              icon={BriefcaseBusiness}
              label="Division"
              value={user?.division || dashboard?.user?.division || "-"}
            />
            <ScopeRow icon={UserRound} label="GAS ID" value={user?.gasId || "-"} />
          </div>
        </section>

        <section className="premium-card">
          <div className="premium-card-header">
            <div>
              <h2>Recent Alerts</h2>
              <p>آخر الإشعارات الواردة لك</p>
            </div>
          </div>

          <div className="activity-timeline">
            {notificationItems.slice(0, 5).map((item) => {
              const alertTone = resolveAlertTone(item.message);

              return (
                <div key={item.id} className={`activity-item ${alertTone}`}>
                  <div className="activity-dot">
                    <Bell size={18} />
                  </div>

                  <div className="activity-body">
                    <strong>{item.message || "-"}</strong>
                    <p>{formatDateTime(item.createdAt)}</p>
                  </div>

                  {!item.isRead ? <span className="new-badge">New</span> : null}
                </div>
              );
            })}

            {!notificationItems.length ? (
              <p className="empty-text">لا توجد إشعارات حاليًا.</p>
            ) : null}
          </div>
        </section>
      </section>
    </div>
  );
}
