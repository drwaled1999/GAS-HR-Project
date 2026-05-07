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

function SectionCard({ title, subtitle, icon: Icon = LayoutDashboard, children, action = null }) {
  return (
    <section className="dash-section-card">
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
        { label: "Attendance", path: "/attendance" },
        { label: "Requests", path: "/requests" },
        { label: "Projects", path: "/projects" },
        { label: "Notifications", path: "/notifications" },
        { label: "Reports", path: "/reports" },
      ];
    }

    if (role === "hr manager" || role === "hr_manager") {
      return [
        { label: "Users", path: "/users", tone: "primary" },
        { label: "Attendance", path: "/attendance" },
        { label: "Requests", path: "/requests" },
        { label: "Issues", path: "/attendance/issues" },
        { label: "Payroll", path: "/payroll" },
        { label: "Reports", path: "/reports" },
      ];
    }

    if (role === "engineer") {
      return [
        { label: "Attendance", path: "/attendance", tone: "primary" },
        { label: "Requests", path: "/requests" },
        { label: "Notifications", path: "/notifications" },
      ];
    }

    return [
      { label: "Attendance", path: "/attendance", tone: "primary" },
      { label: "Requests", path: "/requests" },
      { label: "Notifications", path: "/notifications" },
    ];
  }, [user, role]);

  const totalCardValue = cards.reduce((sum, item) => sum + Number(item?.value || 0), 0);

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
              GAS HR Control Center
            </span>
          </div>

          <h1>Executive Dashboard</h1>

          <p>
            Smart overview for attendance, projects, requests, packages and latest HR activities.
          </p>

          <div className="hero-buttons">
            <button type="button" className="main-btn" onClick={() => navigate("/attendance")}>
              <CalendarCheck size={17} />
              Open Attendance
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
            <strong>{totalCardValue}</strong>
            <p>Total cards value</p>
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

        {cards.map((item, index) => {
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
            data.recentActivity.map((item, idx) => (
              <div className="activity-item" key={item.id || idx}>
                <div className="activity-marker" />
                <div className="activity-body">
                  <strong>{item.title}</strong>
                  <p>{item.subtitle}</p>
                </div>
                <div className="activity-side">
                  <span>{item.status}</span>
                  <small>{formatDateTime(item.createdAt)}</small>
                </div>
              </div>
            ))
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
`;
