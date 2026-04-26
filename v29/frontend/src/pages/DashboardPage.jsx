import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  Boxes,
  FileText,
  CalendarCheck,
  AlertTriangle,
  Activity,
  ArrowRight,
  ShieldCheck,
  Bell,
  BarChart3,
  Sparkles,
} from "lucide-react";
import { apiFetch } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useDevice } from "../hooks_useDevice";

function buildFallbackDashboard(user) {
  return {
    user: {
      role: user?.role || "Employee",
      division: user?.division || "Saudi Division",
      maintenanceMode: false,
    },
    cards: [
      { label: "Users", value: 0, hint: "No data loaded yet" },
      { label: "Projects", value: 0, hint: "No data loaded yet" },
      { label: "Packages", value: 0, hint: "No data loaded yet" },
      { label: "Requests", value: 0, hint: "No data loaded yet" },
    ],
    today: {
      present: 0,
      absent: 0,
      singlePunch: 0,
      date: new Date().toISOString().slice(0, 10),
    },
    projects: [],
    packages: [],
    recentActivity: [],
  };
}

function normalizeRole(value) {
  return String(value || "").trim().toLowerCase();
}

function formatDateTime(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

function getCardIcon(label = "") {
  const text = String(label).toLowerCase();

  if (text.includes("user") || text.includes("employee")) return Users;
  if (text.includes("project")) return FolderKanban;
  if (text.includes("package")) return Boxes;
  if (text.includes("request")) return FileText;
  if (text.includes("attendance")) return CalendarCheck;

  return BarChart3;
}

function SectionCard({ title, subtitle, children, action = null }) {
  return (
    <section className="dash-card-shell">
      <div className="dash-section-head">
        <div>
          <h2>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function QuickActionButton({ label, onClick, tone = "default" }) {
  return (
    <button type="button" className={`dash-action-btn ${tone}`} onClick={onClick}>
      <span>{label}</span>
      <ArrowRight size={17} />
    </button>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { isMobile } = useDevice();
  const navigate = useNavigate();

  const [data, setData] = useState(buildFallbackDashboard(user));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      if (!user?.username) {
        setLoading(false);
        setData(buildFallbackDashboard(user));
        return;
      }

      setLoading(true);
      setError("");

      try {
        const response = await apiFetch(
          `/dashboard/summary?username=${encodeURIComponent(user.username)}`
        );

        if (cancelled) return;

        setData({
          user: response?.user || {
            role: user?.role || "Employee",
            division: user?.division || "Saudi Division",
            maintenanceMode: false,
          },
          cards: Array.isArray(response?.cards) ? response.cards : [],
          today: response?.today || {
            present: 0,
            absent: 0,
            singlePunch: 0,
            date: new Date().toISOString().slice(0, 10),
          },
          projects: Array.isArray(response?.projects) ? response.projects : [],
          packages: Array.isArray(response?.packages) ? response.packages : [],
          recentActivity: Array.isArray(response?.recentActivity)
            ? response.recentActivity
            : [],
        });
      } catch (err) {
        if (cancelled) return;
        setError(err.message || "Failed to load dashboard");
        setData(buildFallbackDashboard(user));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadDashboard();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const role = normalizeRole(user?.role || data?.user?.role);
  const cards = Array.isArray(data?.cards) ? data.cards : [];

  const quickActions = useMemo(() => {
    if (!user) return [];

    if (role === "system owner" || role === "owner" || role === "system_owner") {
      return [
        { label: "Create User", path: "/users", tone: "primary" },
        { label: "Attendance", path: "/attendance", tone: "default" },
        { label: "Requests", path: "/requests", tone: "default" },
        { label: "Projects", path: "/projects", tone: "default" },
        { label: "Notifications", path: "/notifications", tone: "default" },
        { label: "Reports", path: "/reports", tone: "default" },
      ];
    }

    if (role === "hr manager" || role === "hr_manager") {
      return [
        { label: "Users", path: "/users", tone: "primary" },
        { label: "Attendance", path: "/attendance", tone: "default" },
        { label: "Requests", path: "/requests", tone: "default" },
        { label: "Issues", path: "/attendance/issues", tone: "default" },
        { label: "Payroll", path: "/payroll", tone: "default" },
        { label: "Reports", path: "/reports", tone: "default" },
      ];
    }

    if (role === "engineer") {
      return [
        { label: "Attendance", path: "/attendance", tone: "primary" },
        { label: "Requests", path: "/requests", tone: "default" },
        { label: "Notifications", path: "/notifications", tone: "default" },
      ];
    }

    return [
      { label: "Attendance", path: "/attendance", tone: "primary" },
      { label: "Requests", path: "/requests", tone: "default" },
      { label: "Notifications", path: "/notifications", tone: "default" },
    ];
  }, [user, role]);

  const totalCardValue = cards.reduce((sum, item) => sum + Number(item?.value || 0), 0);

  if (loading) {
    return (
      <div className="dashboard-pro-page">
        <style>{dashboardStyles}</style>
        <section className="dash-loading">
          <div className="loader-orb" />
          <h2>Loading dashboard...</h2>
          <p>Preparing your workspace summary</p>
        </section>
      </div>
    );
  }

  return (
    <div className={`dashboard-pro-page ${isMobile ? "is-mobile" : ""}`}>
      <style>{dashboardStyles}</style>

      <section className="dash-hero">
        <div className="hero-content">
          <div className="hero-badge">
            <Sparkles size={16} />
            Dashboard Control Center
          </div>

          <h1>{isMobile ? "Dashboard" : "Executive Dashboard"}</h1>
          <p>
            لوحة تحكم مخصصة حسب دورك ونطاق وصولك داخل النظام، تعرض أهم مؤشرات
            الحضور، الطلبات، المشاريع، والنشاطات الأخيرة.
          </p>

          <div className="hero-actions">
            <button type="button" onClick={() => navigate("/attendance")}>
              <CalendarCheck size={17} />
              Attendance
            </button>
            <button type="button" onClick={() => navigate("/requests")}>
              <FileText size={17} />
              Requests
            </button>
          </div>
        </div>

        <div className="hero-panel">
          <div className="panel-icon">
            <ShieldCheck size={24} />
          </div>

          <div className="panel-row">
            <span>Role</span>
            <strong>{user?.role || "-"}</strong>
          </div>

          <div className="panel-row">
            <span>Division</span>
            <strong>{user?.division || "-"}</strong>
          </div>

          <div className="panel-row">
            <span>Date</span>
            <strong>{data?.today?.date || "-"}</strong>
          </div>

          <div className="panel-row">
            <span>Maintenance</span>
            <strong>{data?.user?.maintenanceMode ? "Enabled" : "Off"}</strong>
          </div>
        </div>
      </section>

      {error ? <div className="dash-alert">{error}</div> : null}

      <section className="hero-kpi-grid">
        <article className="hero-kpi-card">
          <span>Present Today</span>
          <strong>{data?.today?.present ?? 0}</strong>
          <small>Employees currently marked present</small>
        </article>

        <article className="hero-kpi-card danger">
          <span>Absent Today</span>
          <strong>{data?.today?.absent ?? 0}</strong>
          <small>Absence count for selected scope</small>
        </article>

        <article className="hero-kpi-card warning">
          <span>Single Punch</span>
          <strong>{data?.today?.singlePunch ?? 0}</strong>
          <small>Attendance records requiring review</small>
        </article>

        <article className="hero-kpi-card info">
          <span>Total Snapshot</span>
          <strong>{totalCardValue}</strong>
          <small>Total value from dashboard cards</small>
        </article>
      </section>

      <section className="dash-stat-grid">
        {cards.map((item, index) => {
          const Icon = getCardIcon(item?.label);

          return (
            <article
              key={`${item?.label || "card"}-${item?.value || 0}-${index}`}
              className="dash-stat-card"
            >
              <div className="stat-icon">
                <Icon size={21} />
              </div>

              <div>
                <span>{item?.label || "-"}</span>
                <strong>{item?.value ?? 0}</strong>
                <small>{item?.hint || ""}</small>
              </div>
            </article>
          );
        })}
      </section>

      <section className="dash-grid-two">
        <SectionCard title="Quick Actions" subtitle="اختصارات مفيدة حسب صلاحياتك">
          <div className="dash-actions-grid">
            {quickActions.map((item) => (
              <QuickActionButton
                key={item.label}
                label={item.label}
                tone={item.tone}
                onClick={() => navigate(item.path)}
              />
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Today Snapshot" subtitle="ملخص سريع لليوم الحالي">
          <div className="snapshot-grid">
            <div className="snapshot-box">
              <CalendarCheck size={20} />
              <span>Present</span>
              <strong>{data?.today?.present ?? 0}</strong>
            </div>

            <div className="snapshot-box danger">
              <AlertTriangle size={20} />
              <span>Absent</span>
              <strong>{data?.today?.absent ?? 0}</strong>
            </div>

            <div className="snapshot-box warning">
              <Activity size={20} />
              <span>Single Punch</span>
              <strong>{data?.today?.singlePunch ?? 0}</strong>
            </div>

            <div className="snapshot-box info">
              <Bell size={20} />
              <span>Date</span>
              <strong>{data?.today?.date || "-"}</strong>
            </div>
          </div>
        </SectionCard>
      </section>

      <section className="dash-grid-two">
        <SectionCard
          title="Projects in Scope"
          subtitle="المشاريع التي تدخل ضمن نطاقك"
          action={
            <button className="section-open-btn" type="button" onClick={() => navigate("/projects")}>
              Open
              <ArrowRight size={16} />
            </button>
          }
        >
          <div className="scope-list">
            {(data?.projects || []).length ? (
              data.projects.map((project, idx) => (
                <div className="scope-row" key={project.id || idx}>
                  <div>
                    <strong>{project.name}</strong>
                    <p>Project Scope</p>
                  </div>
                  <span>{project.employees ?? 0} موظف</span>
                </div>
              ))
            ) : (
              <div className="empty-state">لا توجد مشاريع ضمن هذا النطاق.</div>
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="Packages in Scope"
          subtitle="البكجات التي تتبع نطاقك الحالي"
          action={
            <button className="section-open-btn" type="button" onClick={() => navigate("/projects")}>
              Open
              <ArrowRight size={16} />
            </button>
          }
        >
          <div className="scope-list">
            {(data?.packages || []).length ? (
              data.packages.map((pkg, idx) => (
                <div className="scope-row" key={pkg.id || idx}>
                  <div>
                    <strong>{pkg.name}</strong>
                    <p>Package Scope</p>
                  </div>
                  <span>{pkg.employees ?? 0} موظف</span>
                </div>
              ))
            ) : (
              <div className="empty-state">لا توجد بكجات ضمن هذا النطاق.</div>
            )}
          </div>
        </SectionCard>
      </section>

      <SectionCard title="Recent Activity" subtitle="أحدث الطلبات والتعديلات ضمن نطاقك">
        <div className="activity-list-pro">
          {(data?.recentActivity || []).length ? (
            data.recentActivity.map((item, idx) => (
              <div className="activity-row" key={item.id || idx}>
                <div className="activity-dot" />
                <div className="activity-content">
                  <strong>{item.title}</strong>
                  <p>{item.subtitle}</p>
                </div>
                <div className="activity-meta">
                  <span>{item.status}</span>
                  <small>{formatDateTime(item.createdAt)}</small>
                </div>
              </div>
            ))
          ) : (
            <div className="empty-state">لا توجد حركة حديثة حاليًا.</div>
          )}
        </div>
      </SectionCard>
    </div>
  );
}

const dashboardStyles = `
  .dashboard-pro-page {
    display: grid;
    gap: 20px;
    width: 100%;
  }

  .dashboard-pro-page * {
    box-sizing: border-box;
  }

  .dash-loading {
    min-height: 360px;
    border-radius: 30px;
    display: grid;
    place-items: center;
    text-align: center;
    padding: 34px;
    color: #fff;
    background:
      radial-gradient(circle at top left, rgba(37,99,235,.35), transparent 34%),
      linear-gradient(135deg, #020617, #0f172a, #1e3a8a);
    box-shadow: 0 20px 60px rgba(15,23,42,.18);
  }

  .dash-loading h2 {
    margin: 18px 0 6px;
    font-weight: 950;
  }

  .dash-loading p {
    margin: 0;
    color: rgba(255,255,255,.72);
    font-weight: 700;
  }

  .loader-orb {
    width: 70px;
    height: 70px;
    border-radius: 999px;
    border: 4px solid rgba(255,255,255,.12);
    border-top-color: #38bdf8;
    animation: dashSpin 1s linear infinite;
  }

  @keyframes dashSpin {
    to { transform: rotate(360deg); }
  }

  .dash-hero {
    position: relative;
    overflow: hidden;
    display: grid;
    grid-template-columns: minmax(0, 1.6fr) minmax(320px, .9fr);
    gap: 18px;
    border-radius: 34px;
    padding: 28px;
    color: #fff;
    background:
      radial-gradient(circle at top right, rgba(56,189,248,.30), transparent 32%),
      radial-gradient(circle at bottom left, rgba(37,99,235,.28), transparent 34%),
      linear-gradient(135deg, #020617 0%, #0f172a 50%, #1e3a8a 100%);
    box-shadow: 0 22px 60px rgba(15,23,42,.16);
  }

  .dash-hero::after {
    content: "";
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(rgba(255,255,255,.045) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,.045) 1px, transparent 1px);
    background-size: 46px 46px;
    opacity: .55;
    pointer-events: none;
  }

  .hero-content,
  .hero-panel {
    position: relative;
    z-index: 2;
  }

  .hero-badge {
    width: fit-content;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    border-radius: 999px;
    padding: 9px 14px;
    background: rgba(255,255,255,.12);
    border: 1px solid rgba(255,255,255,.14);
    color: #dbeafe;
    font-size: .82rem;
    font-weight: 950;
    margin-bottom: 14px;
  }

  .hero-content h1 {
    margin: 0;
    font-size: 2.7rem;
    font-weight: 950;
    letter-spacing: -.05em;
    color: #fff;
  }

  .hero-content p {
    margin: 12px 0 0;
    max-width: 760px;
    color: rgba(255,255,255,.80);
    line-height: 1.8;
    font-size: 1rem;
  }

  .hero-actions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    margin-top: 22px;
  }

  .hero-actions button {
    min-height: 44px;
    border: 1px solid rgba(255,255,255,.12);
    border-radius: 15px;
    padding: 0 15px;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: rgba(255,255,255,.10);
    color: #fff;
    font-weight: 900;
    cursor: pointer;
  }

  .hero-panel {
    border-radius: 26px;
    padding: 20px;
    background: rgba(255,255,255,.10);
    border: 1px solid rgba(255,255,255,.14);
    backdrop-filter: blur(16px);
    display: grid;
    gap: 12px;
  }

  .panel-icon {
    width: 48px;
    height: 48px;
    border-radius: 18px;
    display: grid;
    place-items: center;
    color: #fff;
    background: linear-gradient(135deg, #2563eb, #0ea5e9);
    box-shadow: 0 16px 30px rgba(37,99,235,.28);
  }

  .panel-row {
    min-width: 0;
    display: flex;
    justify-content: space-between;
    gap: 12px;
    border-radius: 16px;
    padding: 12px 14px;
    background: rgba(255,255,255,.08);
  }

  .panel-row span {
    color: rgba(255,255,255,.68);
    font-weight: 800;
    font-size: .84rem;
  }

  .panel-row strong {
    color: #fff;
    font-weight: 950;
    text-align: right;
    word-break: break-word;
  }

  .dash-alert {
    border-radius: 18px;
    padding: 14px 16px;
    background: #fff1f2;
    color: #be123c;
    border: 1px solid #fecdd3;
    font-weight: 900;
  }

  .hero-kpi-grid,
  .dash-stat-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 16px;
  }

  .hero-kpi-card,
  .dash-stat-card,
  .dash-card-shell {
    border-radius: 28px;
    background: rgba(255,255,255,.96);
    border: 1px solid rgba(226,232,240,.95);
    box-shadow: 0 16px 42px rgba(15,23,42,.06);
  }

  .hero-kpi-card {
    padding: 20px;
    overflow: hidden;
    position: relative;
  }

  .hero-kpi-card::after {
    content: "";
    position: absolute;
    right: -40px;
    top: -40px;
    width: 110px;
    height: 110px;
    border-radius: 999px;
    background: rgba(37,99,235,.09);
  }

  .hero-kpi-card.danger::after {
    background: rgba(239,68,68,.10);
  }

  .hero-kpi-card.warning::after {
    background: rgba(245,158,11,.12);
  }

  .hero-kpi-card.info::after {
    background: rgba(14,165,233,.12);
  }

  .hero-kpi-card span,
  .dash-stat-card span {
    display: block;
    color: #64748b;
    font-size: .86rem;
    font-weight: 850;
    margin-bottom: 10px;
  }

  .hero-kpi-card strong {
    display: block;
    color: #0f172a;
    font-size: 2.1rem;
    font-weight: 950;
    letter-spacing: -.04em;
  }

  .hero-kpi-card small,
  .dash-stat-card small {
    display: block;
    margin-top: 10px;
    color: #94a3b8;
    font-size: .78rem;
    font-weight: 750;
    line-height: 1.45;
  }

  .dash-stat-card {
    padding: 18px;
    display: flex;
    gap: 14px;
    align-items: flex-start;
  }

  .stat-icon {
    width: 46px;
    height: 46px;
    border-radius: 16px;
    display: grid;
    place-items: center;
    color: #1d4ed8;
    background: #eff6ff;
    flex: 0 0 auto;
  }

  .dash-stat-card strong {
    display: block;
    color: #0f172a;
    font-size: 1.8rem;
    font-weight: 950;
    line-height: 1;
  }

  .dash-grid-two {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
  }

  .dash-card-shell {
    padding: 24px;
    min-width: 0;
  }

  .dash-section-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 14px;
    flex-wrap: wrap;
    margin-bottom: 18px;
  }

  .dash-section-head h2 {
    margin: 0 0 6px;
    color: #0f172a;
    font-size: 1.25rem;
    font-weight: 950;
  }

  .dash-section-head p {
    margin: 0;
    color: #64748b;
    font-size: .9rem;
    font-weight: 750;
  }

  .section-open-btn {
    min-height: 38px;
    border: none;
    border-radius: 13px;
    padding: 0 13px;
    display: inline-flex;
    align-items: center;
    gap: 7px;
    background: #eef4ff;
    color: #1d4ed8;
    font-weight: 950;
    cursor: pointer;
  }

  .dash-actions-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0,1fr));
    gap: 12px;
  }

  .dash-action-btn {
    min-height: 58px;
    border-radius: 18px;
    border: 1px solid #e8edf4;
    background: #f8fafc;
    color: #0f172a;
    font-weight: 950;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 0 15px;
    transition: transform .18s ease, box-shadow .18s ease;
  }

  .dash-action-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 26px rgba(15,23,42,.08);
  }

  .dash-action-btn.primary {
    border: none;
    color: #fff;
    background: linear-gradient(135deg, #2563eb, #1d4ed8);
    box-shadow: 0 14px 30px rgba(37,99,235,.22);
  }

  .snapshot-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0,1fr));
    gap: 12px;
  }

  .snapshot-box {
    min-height: 118px;
    border-radius: 22px;
    padding: 16px;
    background: #f8fafc;
    border: 1px solid #e8edf4;
    display: grid;
    align-content: center;
    gap: 8px;
  }

  .snapshot-box svg {
    color: #1d4ed8;
  }

  .snapshot-box.danger svg {
    color: #dc2626;
  }

  .snapshot-box.warning svg {
    color: #f59e0b;
  }

  .snapshot-box.info svg {
    color: #0ea5e9;
  }

  .snapshot-box span {
    color: #64748b;
    font-weight: 850;
    font-size: .82rem;
  }

  .snapshot-box strong {
    color: #0f172a;
    font-size: 1.35rem;
    font-weight: 950;
  }

  .scope-list,
  .activity-list-pro {
    display: grid;
    gap: 12px;
  }

  .scope-row,
  .activity-row {
    border-radius: 20px;
    padding: 16px;
    background: #f8fafc;
    border: 1px solid #edf2f7;
  }

  .scope-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
  }

  .scope-row strong,
  .activity-content strong {
    color: #0f172a;
    font-size: .94rem;
    font-weight: 950;
  }

  .scope-row p,
  .activity-content p {
    margin: 5px 0 0;
    color: #64748b;
    font-size: .84rem;
    font-weight: 750;
    line-height: 1.55;
  }

  .scope-row span {
    color: #1d4ed8;
    font-weight: 950;
    white-space: nowrap;
  }

  .activity-row {
    display: grid;
    grid-template-columns: auto minmax(0,1fr) auto;
    align-items: start;
    gap: 14px;
  }

  .activity-dot {
    width: 12px;
    height: 12px;
    border-radius: 999px;
    background: #2563eb;
    margin-top: 5px;
    box-shadow: 0 0 0 6px rgba(37,99,235,.12);
  }

  .activity-meta {
    display: grid;
    justify-items: end;
    gap: 8px;
  }

  .activity-meta span {
    min-height: 28px;
    border-radius: 999px;
    padding: 0 10px;
    display: inline-flex;
    align-items: center;
    background: #eef2ff;
    color: #3730a3;
    font-size: .76rem;
    font-weight: 950;
  }

  .activity-meta small {
    color: #94a3b8;
    font-size: .75rem;
    font-weight: 750;
    white-space: nowrap;
  }

  .empty-state {
    border-radius: 18px;
    padding: 18px;
    text-align: center;
    background: #f8fafc;
    border: 1px dashed #cbd5e1;
    color: #64748b;
    font-weight: 850;
  }

  html.dark .dashboard-pro-page .hero-kpi-card,
  html.dark .dashboard-pro-page .dash-stat-card,
  html.dark .dashboard-pro-page .dash-card-shell {
    background: #111a2d;
    border-color: #24324d;
  }

  html.dark .dashboard-pro-page .hero-kpi-card strong,
  html.dark .dashboard-pro-page .dash-stat-card strong,
  html.dark .dashboard-pro-page .dash-section-head h2,
  html.dark .dashboard-pro-page .scope-row strong,
  html.dark .dashboard-pro-page .activity-content strong,
  html.dark .dashboard-pro-page .snapshot-box strong {
    color: #e5eefc;
  }

  html.dark .dashboard-pro-page .hero-kpi-card span,
  html.dark .dashboard-pro-page .dash-stat-card span,
  html.dark .dashboard-pro-page .dash-section-head p,
  html.dark .dashboard-pro-page .scope-row p,
  html.dark .dashboard-pro-page .activity-content p,
  html.dark .dashboard-pro-page .snapshot-box span {
    color: #9fb0cf;
  }

  html.dark .dashboard-pro-page .scope-row,
  html.dark .dashboard-pro-page .activity-row,
  html.dark .dashboard-pro-page .snapshot-box,
  html.dark .dashboard-pro-page .empty-state {
    background: #0f1728;
    border-color: #24324d;
  }

  @media (max-width: 1200px) {
    .dash-hero,
    .dash-grid-two {
      grid-template-columns: 1fr;
    }

    .hero-kpi-grid,
    .dash-stat-grid {
      grid-template-columns: repeat(2, minmax(0,1fr));
    }
  }

  @media (max-width: 768px) {
    .dashboard-pro-page {
      gap: 14px;
    }

    .dash-hero {
      border-radius: 26px;
      padding: 22px;
      grid-template-columns: 1fr;
    }

    .hero-content h1 {
      font-size: 2rem;
    }

    .hero-content p {
      font-size: .92rem;
    }

    .hero-panel {
      display: none;
    }

    .hero-kpi-grid,
    .dash-stat-grid,
    .dash-grid-two,
    .dash-actions-grid,
    .snapshot-grid {
      grid-template-columns: 1fr;
    }

    .dash-card-shell {
      padding: 18px;
      border-radius: 24px;
    }

    .activity-row {
      grid-template-columns: auto minmax(0,1fr);
    }

    .activity-meta {
      grid-column: 2;
      justify-items: start;
    }
  }
`;
