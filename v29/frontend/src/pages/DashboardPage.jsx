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
  TrendingUp,
  CheckCircle2,
  Clock3,
  Building2,
  Layers3,
  Zap,
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
      date: getRiyadhDate(),
    },
    projects: [],
    packages: [],
    recentActivity: [],
  };
}

function getRiyadhDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function normalizeRole(value) {
  return String(value || "").trim().toLowerCase();
}

function formatDateTime(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("en-GB", {
    timeZone: "Asia/Riyadh",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatActivityText(value) {
  return String(value || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getActivityTone(status) {
  const value = String(status || "").toLowerCase();
  if (value === "approved") return "approved";
  if (value === "rejected") return "rejected";
  if (value === "pending") return "pending";
  if (value === "created") return "created";
  return "default";
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

function SectionCard({ title, subtitle, icon: Icon = LayoutDashboard, children, action = null, className = "" }) {
  return (
    <section className={`dash-section-card ${className}`.trim()}>
      <div className="dash-section-header">
        <div className="dash-section-title">
          <div className="dash-section-icon">
            <Icon size={19} />
          </div>
          <div>
            <h2>{title}</h2>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function QuickActionButton({ label, onClick, tone = "default" }) {
  return (
    <button type="button" className={`quick-action ${tone}`} onClick={onClick}>
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
    let refreshTimer;

    async function loadDashboard(silent = false) {
      if (!user?.username) {
        setLoading(false);
        setData(buildFallbackDashboard(user));
        return;
      }

      if (!silent) setLoading(true);
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
            date: getRiyadhDate(),
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
    refreshTimer = window.setInterval(() => loadDashboard(true), 60000);
    const refreshWhenVisible = () => {
      if (!document.hidden) loadDashboard(true);
    };
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      cancelled = true;
      window.clearInterval(refreshTimer);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [user]);

  const role = normalizeRole(user?.role || data?.user?.role);
  const cards = Array.isArray(data?.cards) ? data.cards : [];

  const quickActions = useMemo(() => {
    if (!user) return [];

    if (role === "system owner" || role === "owner" || role === "system_owner") {
      return [
        { label: "Create User", path: "/users", tone: "primary" },
        { label: "Project Attendance", path: "/project-attendance" },
        { label: "Requests", path: "/requests" },
        { label: "Projects", path: "/projects" },
        { label: "Notifications", path: "/notifications" },
        { label: "Reports", path: "/reports" },
      ];
    }

    if (role === "hr manager" || role === "hr_manager") {
      return [
        { label: "Users", path: "/users", tone: "primary" },
        { label: "Project Attendance", path: "/project-attendance" },
        { label: "Requests", path: "/requests" },
        { label: "Issues", path: "/attendance-issues" },
        { label: "Payroll", path: "/payroll" },
        { label: "Reports", path: "/reports" },
      ];
    }

    if (role === "engineer" || role === "supervisor") {
      return [
        { label: "Project Attendance", path: "/project-attendance", tone: "primary" },
        { label: "Requests", path: "/requests" },
        { label: "Notifications", path: "/notifications" },
      ];
    }

    if (["admin", "admin assistant", "admin_assistant", "site admin", "site_admin", "project manager", "project_manager", "cm"].includes(role)) {
      return [
        { label: "Project Attendance", path: "/project-attendance", tone: "primary" },
        { label: "Requests", path: "/requests" },
        { label: "Projects", path: "/projects" },
        { label: "Reports", path: "/reports" },
        { label: "Notifications", path: "/notifications" },
      ];
    }

    return [
      { label: "Project Attendance", path: "/project-attendance", tone: "primary" },
      { label: "Requests", path: "/requests" },
      { label: "Notifications", path: "/notifications" },
    ];
  }, [user, role]);

  const employeesInScope = Number(
    cards.find((item) => String(item?.label || "").toLowerCase() === "employees")?.value || 0
  );

  const scopeCards = cards.filter((item) =>
    ["users", "employees", "projects", "packages"].includes(
      String(item?.label || "").toLowerCase()
    )
  );

  const attendanceTotal =
    Number(data?.today?.present || 0) +
    Number(data?.today?.absent || 0) +
    Number(data?.today?.singlePunch || 0);

  const presentRate = attendanceTotal
    ? Math.round((Number(data?.today?.present || 0) / attendanceTotal) * 100)
    : 0;

  if (loading) {
    return (
      <div className="dashboard-premium">
        <style>{dashboardStyles}</style>
        <section className="premium-loader">
          <div className="premium-loader-ring">
            <div />
          </div>
          <h2>Loading Dashboard</h2>
          <p>Preparing executive workspace...</p>
        </section>
      </div>
    );
  }

  return (
    <div className={`dashboard-premium ${isMobile ? "is-mobile" : ""}`}>
      <style>{dashboardStyles}</style>

      <section className="premium-hero">
        <div className="hero-left">
          <div className="hero-topline">
            <span>
              <Sparkles size={15} />
              GAS Arabian Services · HR Command Center
            </span>
          </div>

          <h1>Executive Workforce</h1>

          <p>
            Today’s workforce status, requests and project activity in one clear view.
          </p>

          <div className="hero-buttons">
            <button type="button" className="main-btn" onClick={() => navigate("/project-attendance")}>
              <CalendarCheck size={17} />
              Projects Attendance
            </button>

            <button type="button" className="ghost-btn" onClick={() => navigate("/requests")}>
              <FileText size={17} />
              Requests Center
            </button>
          </div>
        </div>

        <div className="hero-right">
          <div className="identity-card">
            <div className="identity-icon">
              <ShieldCheck size={25} />
            </div>

            <div className="identity-main">
              <span>Signed in as</span>
              <strong>{user?.name || user?.username || "User"}</strong>
              <p>{user?.role || data?.user?.role || "-"}</p>
            </div>

            <div className="identity-grid">
              <div>
                <span>Division</span>
                <strong>{user?.division || data?.user?.division || "-"}</strong>
              </div>
              <div>
                <span>Date</span>
                <strong>{data?.today?.date || "-"}</strong>
              </div>
              <div>
                <span>Maintenance</span>
                <strong>{data?.user?.maintenanceMode ? "Enabled" : "Off"}</strong>
              </div>
              <div>
                <span>Health</span>
                <strong>{presentRate}%</strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      {error ? (
        <div className="dashboard-error">
          <AlertTriangle size={18} />
          {error}
        </div>
      ) : null}

      <section className="main-kpi-grid">
        <article className="main-kpi success">
          <div>
            <span>Present Today</span>
            <strong>{data?.today?.present ?? 0}</strong>
            <p>Employees marked present</p>
          </div>
          <CheckCircle2 size={28} />
        </article>

        <article className="main-kpi danger">
          <div>
            <span>Absent Today</span>
            <strong>{data?.today?.absent ?? 0}</strong>
            <p>Absence under your scope</p>
          </div>
          <AlertTriangle size={28} />
        </article>

        <article className="main-kpi warning">
          <div>
            <span>Single Punch</span>
            <strong>{data?.today?.singlePunch ?? 0}</strong>
            <p>Need HR review</p>
          </div>
          <Clock3 size={28} />
        </article>

        <article className="main-kpi blue">
          <div>
            <span>Dashboard Snapshot</span>
            <strong>{employeesInScope}</strong>
            <p>Employees under your access scope</p>
          </div>
          <TrendingUp size={28} />
        </article>
      </section>

      <section className="smart-overview">
        <div className="overview-card wide">
          <div className="overview-header">
            <div>
              <span>Attendance Health</span>
              <strong>{presentRate}%</strong>
            </div>
            <Zap size={24} />
          </div>

          <div className="progress-shell">
            <div className="progress-line" style={{ width: `${presentRate}%` }} />
          </div>

          <p>
            نسبة الحضور الحالية بناءً على بيانات اليوم داخل نطاق صلاحياتك.
          </p>
        </div>

        {scopeCards.map((item, index) => {
          const Icon = getCardIcon(item?.label);
          return (
            <article className="overview-card" key={`${item?.label || "card"}-${index}`}>
              <div className="mini-card-icon">
                <Icon size={21} />
              </div>
              <span>{item?.label || "-"}</span>
              <strong>{item?.value ?? 0}</strong>
              <p>{item?.hint || "Live system indicator"}</p>
            </article>
          );
        })}
      </section>

      <section className="content-grid">
        <SectionCard
          title="Quick Actions"
          subtitle="Fast access based on your permissions"
          icon={Zap}
          className="quick-actions-card"
        >
          <div className="quick-grid">
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

        <SectionCard
          title="Today Snapshot"
          subtitle="Daily attendance summary"
          icon={Activity}
          className="today-snapshot-card"
        >
          <div className="snapshot-list">
            <div>
              <span>Present</span>
              <strong>{data?.today?.present ?? 0}</strong>
            </div>
            <div>
              <span>Absent</span>
              <strong>{data?.today?.absent ?? 0}</strong>
            </div>
            <div>
              <span>Single Punch</span>
              <strong>{data?.today?.singlePunch ?? 0}</strong>
            </div>
            <div>
              <span>Date</span>
              <strong>{data?.today?.date || "-"}</strong>
            </div>
          </div>
        </SectionCard>
      </section>

      <section className="content-grid">
        <SectionCard
          title="Projects in Scope"
          subtitle="Projects visible under your access"
          icon={Building2}
          className="scope-panel projects-panel"
          action={
            <button className="open-section-btn" type="button" onClick={() => navigate("/projects")}>
              Open
              <ArrowRight size={16} />
            </button>
          }
        >
          <div className="scope-list">
            {(data?.projects || []).length ? (
              data.projects.map((project, idx) => (
                <div className="scope-item" key={project.id || idx}>
                  <div>
                    <strong>{project.name}</strong>
                    <p>Project Scope</p>
                  </div>
                  <span>{project.employees ?? 0} موظف</span>
                </div>
              ))
            ) : (
              <div className="empty-box">لا توجد مشاريع ضمن هذا النطاق.</div>
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="Packages in Scope"
          subtitle="Packages visible under your access"
          icon={Layers3}
          className="scope-panel packages-panel"
          action={
            <button className="open-section-btn" type="button" onClick={() => navigate("/projects")}>
              Open
              <ArrowRight size={16} />
            </button>
          }
        >
          <div className="scope-list">
            {(data?.packages || []).length ? (
              data.packages.map((pkg, idx) => (
                <div className="scope-item" key={pkg.id || idx}>
                  <div>
                    <strong>{pkg.name}</strong>
                    <p>Package Scope</p>
                  </div>
                  <span>{pkg.employees ?? 0} موظف</span>
                </div>
              ))
            ) : (
              <div className="empty-box">لا توجد بكجات ضمن هذا النطاق.</div>
            )}
          </div>
        </SectionCard>
      </section>

      <SectionCard
        title="Recent Activity"
        subtitle="Latest requests and updates under your scope"
        icon={Bell}
      >
        <div className="activity-list">
          {(data?.recentActivity || []).length ? (
            data.recentActivity.map((item, idx) => {
              const activityTone = getActivityTone(item.status);
              return (
              <div className={`activity-item ${activityTone}`} key={item.id || idx}>
                <div className="activity-marker" />
                <div className="activity-body">
                  <strong>{formatActivityText(item.title)}</strong>
                  <p>{formatActivityText(item.subtitle)}</p>
                </div>
                <div className="activity-side">
                  <span>{formatActivityText(item.status)}</span>
                  <small>{formatDateTime(item.createdAt)}</small>
                </div>
              </div>
              );
            })
          ) : (
            <div className="empty-box">لا توجد حركة حديثة حاليًا.</div>
          )}
        </div>
      </SectionCard>
    </div>
  );
}

const dashboardStyles = `
.dashboard-premium {
  width: 100%;
  display: grid;
  gap: 20px;
  color: #0f172a;
}

.dashboard-premium * {
  box-sizing: border-box;
}

.premium-loader {
  min-height: 420px;
  border-radius: 34px;
  display: grid;
  place-items: center;
  text-align: center;
  padding: 40px;
  color: #fff;
  background:
    radial-gradient(circle at 20% 20%, rgba(59,130,246,.45), transparent 30%),
    radial-gradient(circle at 80% 0%, rgba(14,165,233,.32), transparent 34%),
    linear-gradient(135deg, #020617, #0f172a 50%, #1e3a8a);
  box-shadow: 0 24px 70px rgba(15,23,42,.18);
}

.premium-loader-ring {
  width: 82px;
  height: 82px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  background: conic-gradient(from 0deg, #38bdf8, #2563eb, transparent, #38bdf8);
  animation: dashSpin 1s linear infinite;
}

.premium-loader-ring div {
  width: 62px;
  height: 62px;
  border-radius: 999px;
  background: #020617;
}

.premium-loader h2 {
  margin: 20px 0 6px;
  font-size: 1.35rem;
  font-weight: 950;
}

.premium-loader p {
  margin: 0;
  color: rgba(255,255,255,.72);
  font-weight: 800;
}

@keyframes dashSpin {
  to { transform: rotate(360deg); }
}

.premium-hero {
  position: relative;
  overflow: hidden;
  display: grid;
  grid-template-columns: minmax(0, 1.45fr) minmax(330px, .9fr);
  gap: 20px;
  border-radius: 36px;
  padding: 30px;
  color: #fff;
  background:
    radial-gradient(circle at 10% 10%, rgba(56,189,248,.28), transparent 30%),
    radial-gradient(circle at 90% 20%, rgba(37,99,235,.40), transparent 32%),
    linear-gradient(135deg, #020617 0%, #0f172a 48%, #1d4ed8 120%);
  box-shadow: 0 26px 70px rgba(15,23,42,.18);
}

.premium-hero::before {
  content: "";
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(255,255,255,.055) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,.055) 1px, transparent 1px);
  background-size: 48px 48px;
  opacity: .55;
}

.hero-left,
.hero-right {
  position: relative;
  z-index: 2;
}

.hero-topline span {
  width: fit-content;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 36px;
  border-radius: 999px;
  padding: 0 14px;
  background: rgba(255,255,255,.12);
  border: 1px solid rgba(255,255,255,.16);
  color: #dbeafe;
  font-size: .82rem;
  font-weight: 950;
}

.hero-left h1 {
  margin: 18px 0 0;
  font-size: clamp(2.1rem, 4vw, 4rem);
  line-height: 1;
  letter-spacing: -.06em;
  font-weight: 950;
  color: #fff;
}

.hero-left p {
  margin: 16px 0 0;
  max-width: 680px;
  color: rgba(255,255,255,.78);
  font-size: 1rem;
  line-height: 1.75;
  font-weight: 750;
}

.hero-buttons {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 24px;
}

.main-btn,
.ghost-btn {
  min-height: 46px;
  border-radius: 16px;
  padding: 0 17px;
  display: inline-flex;
  align-items: center;
  gap: 9px;
  cursor: pointer;
  font-weight: 950;
}

.main-btn {
  border: none;
  background: #fff;
  color: #0f172a;
  box-shadow: 0 18px 34px rgba(0,0,0,.16);
}

.ghost-btn {
  border: 1px solid rgba(255,255,255,.18);
  background: rgba(255,255,255,.10);
  color: #fff;
}

.identity-card {
  border-radius: 30px;
  padding: 22px;
  background: rgba(255,255,255,.11);
  border: 1px solid rgba(255,255,255,.16);
  backdrop-filter: blur(18px);
}

.identity-icon {
  width: 54px;
  height: 54px;
  border-radius: 20px;
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, #38bdf8, #2563eb);
  box-shadow: 0 18px 34px rgba(37,99,235,.26);
}

.identity-main {
  margin-top: 16px;
}

.identity-main span,
.identity-grid span {
  color: rgba(255,255,255,.62);
  font-size: .78rem;
  font-weight: 850;
}

.identity-main strong {
  display: block;
  margin-top: 5px;
  color: #fff;
  font-size: 1.2rem;
  font-weight: 950;
}

.identity-main p {
  margin: 4px 0 0;
  color: rgba(255,255,255,.75);
  font-weight: 800;
}

.identity-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0,1fr));
  gap: 10px;
  margin-top: 18px;
}

.identity-grid div {
  min-width: 0;
  border-radius: 17px;
  padding: 12px;
  background: rgba(255,255,255,.09);
  border: 1px solid rgba(255,255,255,.09);
}

.identity-grid strong {
  display: block;
  margin-top: 6px;
  color: #fff;
  font-size: .88rem;
  font-weight: 950;
  word-break: break-word;
}

.dashboard-error {
  display: flex;
  align-items: center;
  gap: 10px;
  border-radius: 18px;
  padding: 14px 16px;
  background: #fff1f2;
  color: #be123c;
  border: 1px solid #fecdd3;
  font-weight: 950;
}

.main-kpi-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0,1fr));
  gap: 16px;
}

.main-kpi {
  position: relative;
  overflow: hidden;
  min-height: 150px;
  border-radius: 30px;
  padding: 22px;
  display: flex;
  justify-content: space-between;
  gap: 14px;
  background: #fff;
  border: 1px solid #e8eef7;
  box-shadow: 0 18px 45px rgba(15,23,42,.07);
}

.main-kpi::after {
  content: "";
  position: absolute;
  width: 130px;
  height: 130px;
  right: -48px;
  top: -48px;
  border-radius: 999px;
  background: rgba(37,99,235,.09);
}

.main-kpi.success::after { background: rgba(34,197,94,.10); }
.main-kpi.danger::after { background: rgba(239,68,68,.10); }
.main-kpi.warning::after { background: rgba(245,158,11,.12); }
.main-kpi.blue::after { background: rgba(37,99,235,.10); }

.main-kpi span {
  color: #64748b;
  font-size: .83rem;
  font-weight: 900;
}

.main-kpi strong {
  display: block;
  margin-top: 10px;
  color: #0f172a;
  font-size: 2.35rem;
  line-height: 1;
  font-weight: 950;
  letter-spacing: -.05em;
}

.main-kpi p {
  margin: 12px 0 0;
  color: #94a3b8;
  font-size: .78rem;
  font-weight: 800;
}

.main-kpi svg {
  position: relative;
  z-index: 2;
  color: #2563eb;
}

.main-kpi.success svg { color: #16a34a; }
.main-kpi.danger svg { color: #dc2626; }
.main-kpi.warning svg { color: #d97706; }

.smart-overview {
  display: grid;
  grid-template-columns: 1.4fr repeat(4, minmax(0,1fr));
  gap: 16px;
}

.overview-card {
  min-width: 0;
  border-radius: 28px;
  padding: 20px;
  background: rgba(255,255,255,.96);
  border: 1px solid #e8eef7;
  box-shadow: 0 16px 42px rgba(15,23,42,.055);
}

.overview-card.wide {
  background:
    radial-gradient(circle at top right, rgba(37,99,235,.12), transparent 36%),
    #fff;
}

.overview-header {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 14px;
}

.overview-header span,
.overview-card span {
  color: #64748b;
  font-size: .83rem;
  font-weight: 900;
}

.overview-header strong,
.overview-card strong {
  display: block;
  margin-top: 8px;
  color: #0f172a;
  font-size: 1.8rem;
  font-weight: 950;
  letter-spacing: -.04em;
}

.overview-card p {
  margin: 12px 0 0;
  color: #94a3b8;
  font-size: .78rem;
  line-height: 1.55;
  font-weight: 800;
}

.progress-shell {
  width: 100%;
  height: 12px;
  margin-top: 22px;
  overflow: hidden;
  border-radius: 999px;
  background: #e2e8f0;
}

.progress-line {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, #2563eb, #38bdf8);
}

.mini-card-icon {
  width: 44px;
  height: 44px;
  border-radius: 16px;
  display: grid;
  place-items: center;
  margin-bottom: 14px;
  color: #1d4ed8;
  background: #eff6ff;
}

.content-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.dash-section-card {
  min-width: 0;
  border-radius: 30px;
  padding: 24px;
  background: rgba(255,255,255,.96);
  border: 1px solid #e8eef7;
  box-shadow: 0 16px 42px rgba(15,23,42,.055);
}

.dash-section-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 18px;
}

.dash-section-title {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.dash-section-icon {
  width: 42px;
  height: 42px;
  border-radius: 16px;
  display: grid;
  place-items: center;
  color: #1d4ed8;
  background: #eff6ff;
}

.dash-section-title h2 {
  margin: 0;
  color: #0f172a;
  font-size: 1.15rem;
  font-weight: 950;
}

.dash-section-title p {
  margin: 5px 0 0;
  color: #64748b;
  font-size: .86rem;
  line-height: 1.5;
  font-weight: 800;
}

.open-section-btn {
  min-height: 38px;
  border: none;
  border-radius: 14px;
  padding: 0 13px;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  background: #eff6ff;
  color: #1d4ed8;
  cursor: pointer;
  font-weight: 950;
}

.quick-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0,1fr));
  gap: 12px;
}

.quick-action {
  min-height: 58px;
  border-radius: 19px;
  border: 1px solid #e8eef7;
  background: #f8fafc;
  color: #0f172a;
  padding: 0 15px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  cursor: pointer;
  font-weight: 950;
  transition: .18s ease;
}

.quick-action:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 25px rgba(15,23,42,.08);
}

.quick-action.primary {
  border: none;
  color: #fff;
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  box-shadow: 0 16px 30px rgba(37,99,235,.22);
}

.snapshot-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0,1fr));
  gap: 12px;
}

.snapshot-list div {
  border-radius: 22px;
  padding: 17px;
  background: #f8fafc;
  border: 1px solid #e8eef7;
}

.snapshot-list span {
  color: #64748b;
  font-size: .82rem;
  font-weight: 900;
}

.snapshot-list strong {
  display: block;
  margin-top: 8px;
  color: #0f172a;
  font-size: 1.25rem;
  font-weight: 950;
}

.scope-list,
.activity-list {
  display: grid;
  gap: 12px;
}

.scope-item,
.activity-item {
  border-radius: 22px;
  padding: 16px;
  background: #f8fafc;
  border: 1px solid #edf2f7;
}

.scope-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}

.scope-item strong,
.activity-body strong {
  color: #0f172a;
  font-size: .94rem;
  font-weight: 950;
}

.scope-item p,
.activity-body p {
  margin: 5px 0 0;
  color: #64748b;
  font-size: .83rem;
  line-height: 1.5;
  font-weight: 800;
}

.scope-item span {
  white-space: nowrap;
  color: #1d4ed8;
  font-weight: 950;
}

.activity-item {
  display: grid;
  grid-template-columns: auto minmax(0,1fr) auto;
  align-items: start;
  gap: 14px;
}

.activity-marker {
  width: 12px;
  height: 12px;
  border-radius: 999px;
  margin-top: 5px;
  background: #2563eb;
  box-shadow: 0 0 0 6px rgba(37,99,235,.12);
}

.activity-side {
  display: grid;
  justify-items: end;
  gap: 8px;
}

.activity-side span {
  min-height: 28px;
  border-radius: 999px;
  padding: 0 10px;
  display: inline-flex;
  align-items: center;
  background: #eef2ff;
  color: #3730a3;
  font-size: .75rem;
  font-weight: 950;
}

.activity-side small {
  color: #94a3b8;
  font-size: .74rem;
  font-weight: 800;
  white-space: nowrap;
}

.empty-box {
  border-radius: 20px;
  padding: 18px;
  text-align: center;
  background: #f8fafc;
  border: 1px dashed #cbd5e1;
  color: #64748b;
  font-weight: 900;
}

html.dark .dashboard-premium .main-kpi,
html.dark .dashboard-premium .overview-card,
html.dark .dashboard-premium .dash-section-card {
  background: #111a2d;
  border-color: #24324d;
}

html.dark .dashboard-premium .main-kpi strong,
html.dark .dashboard-premium .overview-card strong,
html.dark .dashboard-premium .dash-section-title h2,
html.dark .dashboard-premium .scope-item strong,
html.dark .dashboard-premium .activity-body strong,
html.dark .dashboard-premium .snapshot-list strong {
  color: #e5eefc;
}

html.dark .dashboard-premium .main-kpi span,
html.dark .dashboard-premium .main-kpi p,
html.dark .dashboard-premium .overview-card span,
html.dark .dashboard-premium .overview-card p,
html.dark .dashboard-premium .dash-section-title p,
html.dark .dashboard-premium .scope-item p,
html.dark .dashboard-premium .activity-body p,
html.dark .dashboard-premium .snapshot-list span {
  color: #9fb0cf;
}

html.dark .dashboard-premium .scope-item,
html.dark .dashboard-premium .activity-item,
html.dark .dashboard-premium .snapshot-list div,
html.dark .dashboard-premium .empty-box,
html.dark .dashboard-premium .quick-action {
  background: #0f1728;
  border-color: #24324d;
  color: #e5eefc;
}

html.dark .dashboard-premium .mini-card-icon,
html.dark .dashboard-premium .dash-section-icon {
  background: #172554;
  color: #93c5fd;
}

@media (max-width: 1280px) {
  .premium-hero,
  .content-grid {
    grid-template-columns: 1fr;
  }

  .main-kpi-grid {
    grid-template-columns: repeat(2, minmax(0,1fr));
  }

  .smart-overview {
    grid-template-columns: repeat(2, minmax(0,1fr));
  }

  .overview-card.wide {
    grid-column: span 2;
  }
}

@media (max-width: 768px) {
  .dashboard-premium {
    gap: 14px;
  }

  .premium-hero {
    border-radius: 26px;
    padding: 22px;
  }

  .hero-left h1 {
    font-size: 2.15rem;
  }

  .hero-left p {
    font-size: .92rem;
  }

  .hero-right {
    display: none;
  }

  .main-kpi-grid,
  .smart-overview,
  .content-grid,
  .quick-grid,
  .snapshot-list {
    grid-template-columns: 1fr;
  }

  .overview-card.wide {
    grid-column: auto;
  }

  .main-kpi,
  .overview-card,
  .dash-section-card {
    border-radius: 24px;
  }

  .activity-item {
    grid-template-columns: auto minmax(0,1fr);
  }

  .activity-side {
    grid-column: 2;
    justify-items: start;
  }
}

/* Refined executive visual system */
.dashboard-premium {
  gap: 18px;
  max-width: 1600px;
  margin: 0 auto;
}

.premium-hero {
  min-height: 290px;
  grid-template-columns: minmax(0, 1.6fr) minmax(300px, .72fr);
  align-items: stretch;
  gap: 28px;
  border-radius: 26px;
  padding: 32px 34px;
  background:
    radial-gradient(circle at 92% 8%, rgba(59,130,246,.24), transparent 34%),
    linear-gradient(120deg, #071a33 0%, #0b2447 52%, #123c78 100%);
  border: 1px solid rgba(147,197,253,.16);
  box-shadow: 0 18px 42px rgba(15,23,42,.14);
}

.premium-hero::before {
  background-image:
    linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px);
  background-size: 64px 64px;
  opacity: .55;
}

.hero-left {
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.hero-topline span {
  min-height: 32px;
  padding: 0 12px;
  border-radius: 10px;
  background: rgba(255,255,255,.07);
  border-color: rgba(255,255,255,.12);
  font-size: .76rem;
  letter-spacing: .025em;
}

.hero-left h1 {
  margin-top: 17px;
  font-size: clamp(2.15rem, 3.1vw, 3.35rem);
  line-height: 1.04;
  letter-spacing: -.045em;
}

.hero-left p {
  margin-top: 13px;
  max-width: 650px;
  color: #bfcee2;
  font-size: .96rem;
  line-height: 1.65;
  font-weight: 650;
}

.hero-buttons { margin-top: 22px; }

.main-btn,
.ghost-btn {
  min-height: 43px;
  border-radius: 11px;
  padding: 0 16px;
  font-size: .88rem;
  transition: transform .18s ease, background .18s ease, border-color .18s ease;
}

.main-btn:hover,
.ghost-btn:hover { transform: translateY(-2px); }
.main-btn { box-shadow: 0 10px 24px rgba(0,0,0,.13); }
.ghost-btn { background: rgba(255,255,255,.07); }

.identity-card {
  height: 100%;
  border-radius: 22px;
  padding: 20px;
  background: rgba(255,255,255,.075);
  border-color: rgba(255,255,255,.13);
  backdrop-filter: blur(12px);
}

.identity-icon {
  width: 46px;
  height: 46px;
  border-radius: 14px;
  background: linear-gradient(135deg, #38bdf8, #2563eb);
  box-shadow: 0 12px 28px rgba(37,99,235,.25);
}

.identity-main { margin-top: 14px; }
.identity-main strong { font-size: 1.08rem; }
.identity-main p { font-size: .87rem; }
.identity-grid { gap: 8px; margin-top: 15px; }
.identity-grid div { border-radius: 13px; padding: 10px 11px; }
.identity-grid strong { margin-top: 4px; font-size: .82rem; }

.main-kpi-grid { gap: 13px; }
.main-kpi {
  min-height: 126px;
  border-radius: 20px;
  padding: 19px;
  border-color: #e4eaf2;
  box-shadow: 0 9px 24px rgba(15,23,42,.055);
  transition: transform .18s ease, box-shadow .18s ease;
}
.main-kpi:hover {
  transform: translateY(-3px);
  box-shadow: 0 15px 30px rgba(15,23,42,.09);
}
.main-kpi::after { width: 100px; height: 100px; right: -38px; top: -38px; }
.main-kpi strong { margin-top: 8px; font-size: 2rem; }
.main-kpi p { margin-top: 9px; font-size: .75rem; }
.main-kpi svg { width: 24px; height: 24px; }

.smart-overview { gap: 13px; }
.overview-card,
.dash-section-card {
  border-radius: 20px;
  border-color: #e4eaf2;
  box-shadow: 0 8px 24px rgba(15,23,42,.045);
}
.overview-card { padding: 18px; }
.dash-section-card { padding: 20px; }
.quick-action { border-radius: 12px; }
.scope-item,
.activity-item,
.snapshot-list div { border-radius: 12px; }

@media (max-width: 1100px) {
  .premium-hero { grid-template-columns: 1fr; min-height: auto; }
  .identity-card { display: grid; grid-template-columns: auto 1fr; column-gap: 15px; }
  .identity-main { margin-top: 0; }
  .identity-grid { grid-column: 1 / -1; }
}

@media (max-width: 768px) {
  .premium-hero { padding: 24px 20px; border-radius: 20px; }
  .hero-right { display: none; }
  .hero-left h1 { font-size: 2rem; }
  .main-kpi { min-height: 116px; border-radius: 17px; }
  .overview-card,
  .dash-section-card { border-radius: 17px; }
}

/* Executive Signature Edition */
.dashboard-premium {
  --executive-navy: #07162d;
  --executive-blue: #164c96;
  --executive-gold: #d6b56d;
  --executive-line: rgba(214,181,109,.42);
}

.premium-hero {
  min-height: 252px;
  padding: 28px 32px;
  border-radius: 24px;
  background:
    radial-gradient(circle at 74% -30%, rgba(62,134,255,.31), transparent 43%),
    radial-gradient(circle at 3% 110%, rgba(22,76,150,.48), transparent 37%),
    linear-gradient(118deg, #061326 0%, #0a1c38 55%, #102e5d 100%);
  border: 1px solid rgba(255,255,255,.09);
  box-shadow:
    0 24px 60px rgba(4,15,32,.22),
    inset 0 1px 0 rgba(255,255,255,.07);
}

.premium-hero::after {
  content: "";
  position: absolute;
  inset: 0 auto 0 0;
  width: 3px;
  background: linear-gradient(180deg, transparent, var(--executive-gold), transparent);
  opacity: .9;
}

.hero-topline span {
  color: #e9d8ad;
  background: rgba(214,181,109,.075);
  border-color: rgba(214,181,109,.26);
  letter-spacing: .045em;
}

.hero-topline svg { color: var(--executive-gold); }

.hero-left h1 {
  font-size: clamp(2rem, 2.8vw, 3.1rem);
  letter-spacing: -.04em;
  text-shadow: 0 8px 26px rgba(0,0,0,.18);
}

.hero-left p {
  max-width: 610px;
  color: #b9c8dc;
}

.main-btn {
  color: #07162d;
  background: linear-gradient(135deg, #fff, #f4f7fb);
  border: 1px solid rgba(255,255,255,.72);
}

.ghost-btn {
  color: #f5e8c8;
  border-color: rgba(214,181,109,.27);
  background: rgba(214,181,109,.07);
}

.identity-card {
  position: relative;
  overflow: hidden;
  background:
    linear-gradient(145deg, rgba(255,255,255,.105), rgba(255,255,255,.045));
  border: 1px solid rgba(255,255,255,.13);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.08);
}

.identity-card::after {
  content: "";
  position: absolute;
  width: 150px;
  height: 150px;
  right: -85px;
  bottom: -90px;
  border-radius: 50%;
  border: 1px solid rgba(214,181,109,.28);
  box-shadow: 0 0 55px rgba(214,181,109,.08);
}

.identity-icon {
  color: #f8e8bf;
  background: linear-gradient(145deg, #1d6ed0, #0e3d7c);
  border: 1px solid rgba(255,255,255,.2);
}

.identity-grid div {
  background: rgba(4,16,35,.22);
  border-color: rgba(255,255,255,.075);
}

.main-kpi {
  min-height: 122px;
  border-radius: 18px;
  border: 1px solid #e2e8f1;
  box-shadow:
    0 12px 28px rgba(15,23,42,.065),
    inset 0 1px 0 #fff;
}

.main-kpi::before {
  content: "";
  position: absolute;
  left: 18px;
  right: 18px;
  bottom: 0;
  height: 3px;
  border-radius: 3px 3px 0 0;
  background: #3478d4;
  opacity: .78;
}

.main-kpi.success::before { background: #27a866; }
.main-kpi.danger::before { background: #e05252; }
.main-kpi.warning::before { background: #d99a2b; }
.main-kpi.blue::before { background: linear-gradient(90deg, #286fc8, #d6b56d); }

.main-kpi span {
  color: #53647c;
  letter-spacing: .012em;
}

.main-kpi strong {
  color: #07162d;
  font-size: 2.05rem;
}

.overview-card,
.dash-section-card {
  background:
    linear-gradient(145deg, rgba(255,255,255,.99), rgba(248,250,253,.97));
  border: 1px solid #e1e7ef;
  box-shadow: 0 12px 30px rgba(15,23,42,.055);
}

.dash-section-header {
  padding-bottom: 14px;
  border-bottom: 1px solid #edf1f6;
}

.dash-section-icon,
.mini-card-icon {
  color: #164c96;
  background: linear-gradient(145deg, #edf5ff, #e3eefc);
  border: 1px solid #d8e7f8;
}

.quick-action {
  border: 1px solid #e1e7ef;
  background: linear-gradient(145deg, #fff, #f7f9fc);
  box-shadow: 0 5px 14px rgba(15,23,42,.035);
}

.quick-action.primary {
  background: linear-gradient(135deg, #0b2c59, #1659a8);
  border-color: transparent;
  box-shadow: 0 10px 22px rgba(22,76,150,.2);
}

.progress-line {
  background: linear-gradient(90deg, #164c96, #2b7bd6 72%, #d6b56d);
}

html.dark .dashboard-premium .main-kpi,
html.dark .dashboard-premium .overview-card,
html.dark .dashboard-premium .dash-section-card {
  background: linear-gradient(145deg, #101b2e, #0b1526);
  border-color: rgba(148,163,184,.16);
  box-shadow: 0 16px 36px rgba(0,0,0,.22);
}

html.dark .dashboard-premium .dash-section-header {
  border-bottom-color: rgba(148,163,184,.12);
}

@media (max-width: 768px) {
  .premium-hero { min-height: auto; padding: 23px 20px; }
  .hero-topline span { font-size: .72rem; letter-spacing: .02em; }
  .main-kpi { min-height: 112px; }
}

/* Scope cards and activity timeline refinement */
.smart-overview {
  grid-template-columns: minmax(280px, 1.3fr) repeat(4, minmax(150px, 1fr));
}

.smart-overview .overview-card:not(.wide) {
  position: relative;
  overflow: hidden;
  min-height: 178px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.smart-overview .overview-card:not(.wide)::after {
  content: "";
  position: absolute;
  width: 92px;
  height: 92px;
  right: -46px;
  top: -46px;
  border-radius: 50%;
  border: 1px solid rgba(22,76,150,.12);
  box-shadow: 0 0 40px rgba(22,76,150,.055);
}

.overview-card > strong {
  font-size: 2rem;
  letter-spacing: -.04em;
}

.quick-grid { gap: 11px; }

.quick-action {
  min-height: 58px;
  padding: 0 17px;
  border-radius: 14px;
  transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease;
}

.quick-action:hover {
  transform: translateY(-2px);
  border-color: rgba(22,76,150,.25);
  box-shadow: 0 11px 24px rgba(15,23,42,.08);
}

.activity-list {
  position: relative;
  gap: 10px;
  padding-left: 3px;
}

.activity-item {
  position: relative;
  min-height: 86px;
  align-items: center;
  padding: 16px 18px;
  border-radius: 16px;
  background: linear-gradient(100deg, #fbfcfe, #f7f9fc);
  border: 1px solid #e5eaf1;
  box-shadow: 0 5px 16px rgba(15,23,42,.035);
  transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease;
}

.activity-item::before {
  content: "";
  position: absolute;
  left: 0;
  top: 15px;
  bottom: 15px;
  width: 3px;
  border-radius: 0 3px 3px 0;
  background: #3478d4;
}

.activity-item:hover {
  transform: translateX(3px);
  border-color: #d5dfeb;
  box-shadow: 0 10px 24px rgba(15,23,42,.065);
}

.activity-marker {
  width: 10px;
  height: 10px;
  margin-top: 0;
  background: #3478d4;
  box-shadow: 0 0 0 5px rgba(52,120,212,.12);
}

.activity-body strong {
  font-size: .9rem;
  letter-spacing: -.01em;
}

.activity-body p {
  margin-top: 4px;
  color: #8190a5;
  font-size: .78rem;
}

.activity-side span {
  min-width: 82px;
  justify-content: center;
  border: 1px solid rgba(52,120,212,.12);
  background: #edf4ff;
  color: #215da8;
  letter-spacing: .015em;
}

.activity-item.approved::before,
.activity-item.approved .activity-marker { background: #1f9d61; }
.activity-item.approved .activity-marker { box-shadow: 0 0 0 5px rgba(31,157,97,.12); }
.activity-item.approved .activity-side span {
  color: #117347;
  background: #eaf8f1;
  border-color: #cceedd;
}

.activity-item.rejected::before,
.activity-item.rejected .activity-marker { background: #d84a55; }
.activity-item.rejected .activity-marker { box-shadow: 0 0 0 5px rgba(216,74,85,.12); }
.activity-item.rejected .activity-side span {
  color: #b42331;
  background: #fff0f1;
  border-color: #f7d6d9;
}

.activity-item.pending::before,
.activity-item.pending .activity-marker { background: #d29324; }
.activity-item.pending .activity-marker { box-shadow: 0 0 0 5px rgba(210,147,36,.13); }
.activity-item.pending .activity-side span {
  color: #9a650a;
  background: #fff8e7;
  border-color: #f2e2b9;
}

.activity-item.created::before,
.activity-item.created .activity-marker { background: #4269cf; }

html.dark .dashboard-premium .activity-item {
  background: linear-gradient(100deg, #111c2f, #0d1728);
  border-color: rgba(148,163,184,.15);
}

html.dark .dashboard-premium .activity-body p,
html.dark .dashboard-premium .activity-side small { color: #8fa0b8; }

@media (max-width: 1280px) {
  .smart-overview { grid-template-columns: repeat(2, minmax(0,1fr)); }
  .overview-card.wide { grid-column: span 2; }
}

@media (max-width: 768px) {
  .smart-overview { grid-template-columns: 1fr; }
  .overview-card.wide { grid-column: auto; }
  .smart-overview .overview-card:not(.wide) { min-height: 142px; }
  .activity-item { align-items: start; padding: 15px; }
  .activity-side { grid-column: 2; grid-template-columns: auto 1fr; align-items: center; }
}

/* Premium operational panels */
.main-kpi {
  min-height: 136px;
  padding: 20px;
  background: linear-gradient(145deg, #ffffff, #f8fafc);
}

.main-kpi.success { background: linear-gradient(145deg, #ffffff 45%, #f0fbf5); }
.main-kpi.danger { background: linear-gradient(145deg, #ffffff 45%, #fff4f4); }
.main-kpi.warning { background: linear-gradient(145deg, #ffffff 45%, #fff9ed); }
.main-kpi.blue { background: linear-gradient(145deg, #ffffff 42%, #f0f6ff); }

.main-kpi > svg {
  width: 43px;
  height: 43px;
  padding: 10px;
  border-radius: 13px;
  background: #edf4ff;
  border: 1px solid #dce9f8;
}

.main-kpi.success > svg { background: #eaf9f1; border-color: #d2efdf; }
.main-kpi.danger > svg { background: #fff0f1; border-color: #f6d7da; }
.main-kpi.warning > svg { background: #fff7e7; border-color: #f2e2ba; }

.main-kpi p {
  max-width: 180px;
  line-height: 1.45;
}

.smart-overview .overview-card:not(.wide) {
  border-top: 3px solid #2d70c5;
}

.smart-overview .overview-card:nth-child(3) { border-top-color: #25875a; }
.smart-overview .overview-card:nth-child(4) { border-top-color: #ab7c25; }
.smart-overview .overview-card:nth-child(5) { border-top-color: #6b5bc7; }

.smart-overview .overview-card:not(.wide) .mini-card-icon {
  width: 44px;
  height: 44px;
  border-radius: 13px;
}

.smart-overview .overview-card:not(.wide) > span {
  margin-top: 18px;
}

.smart-overview .overview-card:not(.wide) > strong {
  margin-top: 4px;
}

.quick-actions-card,
.today-snapshot-card,
.scope-panel {
  position: relative;
  overflow: hidden;
}

.quick-actions-card::before,
.today-snapshot-card::before,
.scope-panel::before {
  content: "";
  position: absolute;
  inset: 0 0 auto 0;
  height: 3px;
  background: linear-gradient(90deg, #154c96, #3b82d0 70%, #d6b56d);
}

.quick-actions-card {
  background:
    radial-gradient(circle at 95% 0%, rgba(44,112,198,.09), transparent 36%),
    linear-gradient(145deg, #ffffff, #f7f9fc);
}

.quick-actions-card .quick-grid {
  grid-template-columns: repeat(3, minmax(0,1fr));
  gap: 10px;
}

.quick-actions-card .quick-action {
  position: relative;
  overflow: hidden;
  min-height: 62px;
  padding: 0 18px;
  border-radius: 14px;
  color: #12213a;
  background: rgba(255,255,255,.78);
  border: 1px solid #dfe6ef;
}

.quick-actions-card .quick-action::after {
  content: "";
  position: absolute;
  width: 54px;
  height: 54px;
  right: -34px;
  bottom: -34px;
  border-radius: 50%;
  background: rgba(22,76,150,.08);
  transition: transform .22s ease;
}

.quick-actions-card .quick-action:hover::after { transform: scale(2.4); }

.quick-actions-card .quick-action.primary {
  color: #fff;
  background:
    radial-gradient(circle at 90% 10%, rgba(255,255,255,.14), transparent 34%),
    linear-gradient(135deg, #09274f, #1557a4);
  border-color: transparent;
}

.quick-actions-card .quick-action.primary::after { background: rgba(214,181,109,.18); }

.today-snapshot-card {
  background:
    radial-gradient(circle at 100% 0%, rgba(214,181,109,.09), transparent 35%),
    linear-gradient(145deg, #ffffff, #f7f9fc);
}

.today-snapshot-card .snapshot-list { gap: 10px; }

.today-snapshot-card .snapshot-list div {
  position: relative;
  min-height: 92px;
  padding: 16px 17px 14px;
  border-radius: 14px;
  background: rgba(255,255,255,.72);
  border: 1px solid #e1e7ef;
  box-shadow: 0 5px 15px rgba(15,23,42,.035);
}

.today-snapshot-card .snapshot-list div::before {
  content: "";
  position: absolute;
  left: 17px;
  top: 0;
  width: 35px;
  height: 3px;
  border-radius: 0 0 3px 3px;
  background: #27a866;
}

.today-snapshot-card .snapshot-list div:nth-child(2)::before { background: #dc4b55; }
.today-snapshot-card .snapshot-list div:nth-child(3)::before { background: #d99a2b; }
.today-snapshot-card .snapshot-list div:nth-child(4)::before { background: #3478d4; }

.today-snapshot-card .snapshot-list strong {
  margin-top: 10px;
  font-size: 1.42rem;
  letter-spacing: -.025em;
}

.scope-panel {
  background:
    radial-gradient(circle at 100% 0%, rgba(38,104,187,.075), transparent 32%),
    linear-gradient(145deg, #ffffff, #f8fafc);
}

.scope-panel .open-section-btn {
  min-height: 40px;
  padding: 0 14px;
  border-radius: 12px;
  color: #154c96;
  background: #edf5ff;
  border: 1px solid #dbe9fa;
  transition: transform .18s ease, box-shadow .18s ease;
}

.scope-panel .open-section-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 18px rgba(21,76,150,.11);
}

.scope-panel .scope-list { gap: 9px; }

.scope-panel .scope-item {
  position: relative;
  min-height: 84px;
  padding: 15px 17px 15px 21px;
  border-radius: 14px;
  background: rgba(255,255,255,.75);
  border: 1px solid #e3e9f1;
  box-shadow: 0 4px 13px rgba(15,23,42,.025);
  transition: transform .18s ease, border-color .18s ease, box-shadow .18s ease;
}

.scope-panel .scope-item::before {
  content: "";
  position: absolute;
  left: 0;
  top: 17px;
  bottom: 17px;
  width: 3px;
  border-radius: 0 3px 3px 0;
  background: linear-gradient(180deg, #2467b9, #55a2e5);
}

.packages-panel .scope-item::before {
  background: linear-gradient(180deg, #b98a2e, #ddbd72);
}

.scope-panel .scope-item:hover {
  transform: translateX(3px);
  border-color: #d4deea;
  box-shadow: 0 9px 20px rgba(15,23,42,.055);
}

.scope-panel .scope-item strong {
  font-size: .92rem;
  text-transform: capitalize;
}

.scope-panel .scope-item p {
  color: #8997aa;
  font-size: .76rem;
}

.scope-panel .scope-item > span {
  min-width: 76px;
  min-height: 34px;
  padding: 0 11px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  color: #174f94;
  background: #edf5ff;
  border: 1px solid #dceafb;
  font-size: .78rem;
}

.packages-panel .scope-item > span {
  color: #8a641d;
  background: #fff8e9;
  border-color: #f1e2bd;
}

html.dark .dashboard-premium .quick-actions-card,
html.dark .dashboard-premium .today-snapshot-card,
html.dark .dashboard-premium .scope-panel {
  background: linear-gradient(145deg, #111c2f, #0b1526);
}

html.dark .dashboard-premium .quick-actions-card .quick-action,
html.dark .dashboard-premium .today-snapshot-card .snapshot-list div,
html.dark .dashboard-premium .scope-panel .scope-item {
  background: rgba(18,31,51,.78);
  border-color: rgba(148,163,184,.15);
}

@media (max-width: 768px) {
  .quick-actions-card .quick-grid { grid-template-columns: 1fr 1fr; }
  .quick-actions-card .quick-action { min-height: 56px; }
  .scope-panel .scope-item { min-height: 78px; }
}

@media (max-width: 480px) {
  .quick-actions-card .quick-grid { grid-template-columns: 1fr; }
}
`;
