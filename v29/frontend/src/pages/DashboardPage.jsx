import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useDevice } from "../hooks_useDevice";

function SectionCard({ title, subtitle, children, action = null }) {
  return (
    <section className="pro-card dashboard-section-pro">
      <div className="section-head-pro">
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
    <button type="button" className={`quick-action-btn ${tone}`} onClick={onClick}>
      {label}
    </button>
  );
}

function MobileActionButton({ label, onClick }) {
  return (
    <button className="mobile-quick-button" onClick={onClick}>
      {label}
    </button>
  );
}

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
        if (!cancelled) {
          setLoading(false);
        }
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

  const totalCardValue = cards.reduce(
    (sum, item) => sum + Number(item?.value || 0),
    0
  );

  if (loading) {
    return (
      <div className="page-stack dashboard-pro-page">
        <style>{dashboardStyles}</style>
        <section className="pro-card loading-card">
          <h2>Loading dashboard...</h2>
        </section>
      </div>
    );
  }

  if (isMobile) {
    return (
      <div className="mobile-page admin-mobile-pro-dashboard dashboard-pro-page">
        <style>{dashboardStyles}</style>

        <section className="mobile-hero-pro">
          <div className="mobile-hero-top">
            <div>
              <h1>Admin Dashboard</h1>
              <p>ملخص سريع للطلبات، التنبيهات، والحضور ضمن نطاقك.</p>
            </div>
          </div>

          <div className="badge-cluster">
            <span className="soft-badge">{user?.role || "-"}</span>
            <span className="soft-badge">{user?.division || "-"}</span>
            {data?.user?.maintenanceMode ? (
              <span className="soft-badge warning">Maintenance Mode</span>
            ) : null}
          </div>

          <div className="mobile-hero-mini-grid">
            <div className="mini-stat-pro">
              <span>Cards</span>
              <strong>{cards.length}</strong>
            </div>
            <div className="mini-stat-pro">
              <span>Total Snapshot</span>
              <strong>{totalCardValue}</strong>
            </div>
          </div>
        </section>

        {error ? <div className="alert error">{error}</div> : null}

        <section className="mobile-stat-grid admin-mobile-grid">
          {cards.slice(0, 4).map((item, index) => (
            <article
              key={`${item?.label || "card"}-${item?.value || 0}-${index}`}
              className="card mobile-stat emphasis-card"
            >
              <span>{item?.label || "-"}</span>
              <strong>{item?.value ?? 0}</strong>
              <small>{item?.hint || ""}</small>
            </article>
          ))}
        </section>

        <section className="card quick-action-card">
          <div className="page-header compact">
            <div>
              <h2>Quick Actions</h2>
              <p className="muted">إجراءات سريعة من الجوال.</p>
            </div>
          </div>

          <div className="mobile-action-grid">
            {quickActions.map((item) => (
              <MobileActionButton
                key={item.label}
                label={item.label}
                onClick={() => navigate(item.path)}
              />
            ))}
          </div>
        </section>

        <section className="card compact-snapshot-card">
          <div className="page-header compact">
            <div>
              <h2>Today Snapshot</h2>
              <p className="muted">لمحة سريعة بدون جداول ثقيلة.</p>
            </div>
          </div>

          <div className="snapshot-grid compact-mobile-snapshot">
            <div className="mini-card">
              <span>Present</span>
              <strong>{data?.today?.present ?? 0}</strong>
            </div>
            <div className="mini-card">
              <span>Absent</span>
              <strong>{data?.today?.absent ?? 0}</strong>
            </div>
            <div className="mini-card">
              <span>Single Punch</span>
              <strong>{data?.today?.singlePunch ?? 0}</strong>
            </div>
            <div className="mini-card">
              <span>Date</span>
              <strong>{data?.today?.date || "-"}</strong>
            </div>
          </div>
        </section>

        <section className="card mobile-scope-card">
          <div className="page-header compact">
            <div>
              <h2>Scope Overview</h2>
              <p className="muted">المشاريع والبكجات ضمن نطاقك.</p>
            </div>
          </div>

          <div className="scope-mobile-grid">
            <div className="scope-mini-box">
              <span>Projects</span>
              <strong>{data?.projects?.length || 0}</strong>
            </div>
            <div className="scope-mini-box">
              <span>Packages</span>
              <strong>{data?.packages?.length || 0}</strong>
            </div>
          </div>
        </section>

        <section className="card recent-activity-card">
          <div className="page-header compact">
            <div>
              <h2>Recent Activity</h2>
              <p className="muted">آخر الطلبات والتحركات داخل نطاقك.</p>
            </div>
          </div>

          <div className="activity-list mobile-activity-list">
            {(data?.recentActivity || []).slice(0, 5).map((item, idx) => (
              <div className="activity-item mobile-activity-item" key={item.id || idx}>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.subtitle}</p>
                </div>
                <div className="activity-meta">
                  <span className="soft-badge">{item.status}</span>
                </div>
              </div>
            ))}
            {!data?.recentActivity?.length ? (
              <p className="muted">لا توجد حركة حديثة حاليًا.</p>
            ) : null}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="page-stack dashboard-pro-page">
      <style>{dashboardStyles}</style>

      <section className="hero-shell">
        <div className="hero-main">
          <div className="hero-badge">Dashboard Control Center</div>
          <h1>Dashboard</h1>
          <p>لوحة تحكم مخصصة حسب دورك ونطاق وصولك داخل النظام.</p>

          <div className="hero-kpis">
            <div className="hero-kpi">
              <span className="label">Cards Loaded</span>
              <strong className="value">{cards.length}</strong>
            </div>
            <div className="hero-kpi">
              <span className="label">Present Today</span>
              <strong className="value">{data?.today?.present ?? 0}</strong>
            </div>
            <div className="hero-kpi">
              <span className="label">Absent Today</span>
              <strong className="value">{data?.today?.absent ?? 0}</strong>
            </div>
            <div className="hero-kpi">
              <span className="label">Single Punch</span>
              <strong className="value">{data?.today?.singlePunch ?? 0}</strong>
            </div>
          </div>
        </div>

        <div className="hero-side">
          <div className="side-title">Current Snapshot</div>

          <div className="side-stat">
            <span>Role</span>
            <strong>{user?.role || "-"}</strong>
          </div>

          <div className="side-stat">
            <span>Division</span>
            <strong>{user?.division || "-"}</strong>
          </div>

          <div className="side-stat">
            <span>Date</span>
            <strong>{data?.today?.date || "-"}</strong>
          </div>

          <div className="side-stat">
            <span>Maintenance</span>
            <strong>{data?.user?.maintenanceMode ? "Enabled" : "Off"}</strong>
          </div>
        </div>
      </section>

      {error ? <div className="alert error">{error}</div> : null}

      <section className="stat-grid-pro">
        {cards.map((item, index) => (
          <article
            key={`${item?.label || "card"}-${item?.value || 0}-${index}`}
            className="stat-card-pro"
          >
            <div className="stat-card-top">
              <span>{item?.label || "-"}</span>
            </div>
            <strong>{item?.value ?? 0}</strong>
            <small>{item?.hint || ""}</small>
          </article>
        ))}
      </section>

      <section className="grid-two dashboard-main">
        <SectionCard title="Quick Actions" subtitle="اختصارات مفيدة حسب صلاحياتك">
          <div className="quick-actions-grid">
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
          <div className="snapshot-grid pro-snapshot-grid">
            <div className="mini-card">
              <span>Present</span>
              <strong>{data?.today?.present ?? 0}</strong>
            </div>
            <div className="mini-card">
              <span>Absent</span>
              <strong>{data?.today?.absent ?? 0}</strong>
            </div>
            <div className="mini-card">
              <span>Single Punch</span>
              <strong>{data?.today?.singlePunch ?? 0}</strong>
            </div>
            <div className="mini-card">
              <span>Date</span>
              <strong>{data?.today?.date || "-"}</strong>
            </div>
          </div>
        </SectionCard>
      </section>

      <section className="grid-two dashboard-main">
        <SectionCard
          title="Projects in Scope"
          subtitle="المشاريع التي تدخل ضمن نطاقك"
          action={
            <button
              type="button"
              className="section-link-btn"
              onClick={() => navigate("/projects")}
            >
              Open Projects
            </button>
          }
        >
          <div className="list-table-pro">
            {(data?.projects || []).length ? (
              data.projects.map((project, idx) => (
                <div className="list-row-pro" key={project.id || idx}>
                  <div>
                    <strong>{project.name}</strong>
                    <p>Project Scope</p>
                  </div>
                  <span>{project.employees ?? 0} موظف</span>
                </div>
              ))
            ) : (
              <p className="muted">لا توجد مشاريع ضمن هذا النطاق.</p>
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="Packages in Scope"
          subtitle="البكجات التي تتبع نطاقك الحالي"
          action={
            <button
              type="button"
              className="section-link-btn"
              onClick={() => navigate("/projects")}
            >
              Open Packages
            </button>
          }
        >
          <div className="list-table-pro">
            {(data?.packages || []).length ? (
              data.packages.map((pkg, idx) => (
                <div className="list-row-pro" key={pkg.id || idx}>
                  <div>
                    <strong>{pkg.name}</strong>
                    <p>Package Scope</p>
                  </div>
                  <span>{pkg.employees ?? 0} موظف</span>
                </div>
              ))
            ) : (
              <p className="muted">لا توجد بكجات ضمن هذا النطاق.</p>
            )}
          </div>
        </SectionCard>
      </section>

      <SectionCard title="Recent Activity" subtitle="أحدث الطلبات والتعديلات ضمن نطاقك">
        <div className="activity-list-pro">
          {(data?.recentActivity || []).length ? (
            data.recentActivity.map((item, idx) => (
              <div className="activity-item-pro" key={item.id || idx}>
                <div className="activity-content">
                  <strong>{item.title}</strong>
                  <p>{item.subtitle}</p>
                </div>
                <div className="activity-meta-pro">
                  <span className="soft-badge">{item.status}</span>
                  <small>{formatDateTime(item.createdAt)}</small>
                </div>
              </div>
            ))
          ) : (
            <p className="muted">لا توجد حركة حديثة حاليًا.</p>
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

  .dashboard-pro-page .pro-card,
  .dashboard-pro-page .hero-main,
  .dashboard-pro-page .hero-side {
    border-radius: 28px;
    border: 1px solid rgba(226, 232, 240, 0.95);
    background: rgba(255, 255, 255, 0.96);
    box-shadow: 0 16px 40px rgba(15, 23, 42, 0.06);
    backdrop-filter: blur(10px);
  }

  .dashboard-pro-page .loading-card {
    padding: 34px;
  }

  .dashboard-pro-page .hero-shell {
    display: grid;
    grid-template-columns: minmax(0, 1.55fr) minmax(320px, 0.95fr);
    gap: 18px;
  }

  .dashboard-pro-page .hero-main {
    padding: 28px;
    background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%);
    color: #fff;
    border: none;
  }

  .dashboard-pro-page .hero-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    border-radius: 999px;
    padding: 8px 14px;
    font-size: 0.82rem;
    font-weight: 800;
    background: rgba(255, 255, 255, 0.14);
    color: #fff;
    margin-bottom: 14px;
  }

  .dashboard-pro-page .hero-main h1 {
    margin: 0 0 10px 0;
    font-size: 2.35rem;
    font-weight: 900;
    letter-spacing: -0.03em;
    color: #fff;
  }

  .dashboard-pro-page .hero-main p {
    margin: 0;
    max-width: 760px;
    color: rgba(255, 255, 255, 0.84);
    line-height: 1.7;
    font-size: 0.98rem;
  }

  .dashboard-pro-page .hero-kpis {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 14px;
    margin-top: 20px;
  }

  .dashboard-pro-page .hero-kpi {
    border-radius: 20px;
    padding: 16px;
    background: rgba(255, 255, 255, 0.12);
    border: 1px solid rgba(255, 255, 255, 0.14);
    min-width: 0;
  }

  .dashboard-pro-page .hero-kpi .label {
    display: block;
    color: rgba(255, 255, 255, 0.78);
    font-size: 0.82rem;
    font-weight: 700;
    margin-bottom: 8px;
  }

  .dashboard-pro-page .hero-kpi .value {
    font-size: 1.6rem;
    font-weight: 900;
    color: #fff;
    line-height: 1;
  }

  .dashboard-pro-page .hero-side {
    padding: 24px;
    display: grid;
    gap: 12px;
    align-content: start;
  }

  .dashboard-pro-page .side-title {
    font-size: 1rem;
    font-weight: 900;
    color: #0f172a;
  }

  .dashboard-pro-page .side-stat {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    border-radius: 16px;
    padding: 14px 16px;
    background: #f8fafc;
    border: 1px solid #edf2f7;
  }

  .dashboard-pro-page .side-stat span {
    color: #64748b;
    font-size: 0.9rem;
    font-weight: 700;
  }

  .dashboard-pro-page .side-stat strong {
    color: #0f172a;
    font-size: 1rem;
    font-weight: 900;
    text-align: right;
    word-break: break-word;
  }

  .dashboard-pro-page .dashboard-section-pro {
    padding: 24px;
    min-width: 0;
  }

  .dashboard-pro-page .section-head-pro {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
    flex-wrap: wrap;
    margin-bottom: 18px;
  }

  .dashboard-pro-page .section-head-pro h2 {
    margin: 0 0 6px 0;
    font-size: 1.25rem;
    font-weight: 900;
    color: #0f172a;
  }

  .dashboard-pro-page .section-head-pro p {
    margin: 0;
    color: #64748b;
    font-size: 0.93rem;
  }

  .dashboard-pro-page .section-link-btn {
    min-height: 38px;
    padding: 0 14px;
    border: none;
    border-radius: 12px;
    background: #eef4ff;
    color: #1d4ed8;
    font-size: 0.84rem;
    font-weight: 900;
    cursor: pointer;
  }

  .dashboard-pro-page .stat-grid-pro {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 16px;
  }

  .dashboard-pro-page .stat-card-pro {
    border-radius: 24px;
    padding: 20px;
    border: 1px solid #e8edf4;
    background: linear-gradient(180deg, #ffffff, #f8fafc);
    box-shadow: 0 10px 28px rgba(15, 23, 42, 0.04);
  }

  .dashboard-pro-page .stat-card-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    margin-bottom: 12px;
  }

  .dashboard-pro-page .stat-card-pro span {
    color: #64748b;
    font-weight: 700;
    font-size: 0.9rem;
  }

  .dashboard-pro-page .stat-card-pro strong {
    display: block;
    font-size: 2rem;
    font-weight: 900;
    color: #0f172a;
    line-height: 1;
    margin-bottom: 10px;
  }

  .dashboard-pro-page .stat-card-pro small {
    color: #94a3b8;
    font-weight: 700;
    font-size: 0.8rem;
  }

  .dashboard-pro-page .grid-two {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
  }

  .dashboard-pro-page .quick-actions-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
  }

  .dashboard-pro-page .quick-action-btn {
    min-height: 60px;
    border: none;
    border-radius: 18px;
    padding: 14px 16px;
    font-size: 0.92rem;
    font-weight: 900;
    cursor: pointer;
    transition: transform 0.18s ease, opacity 0.2s ease;
    background: #f8fafc;
    color: #0f172a;
    border: 1px solid #e8edf4;
  }

  .dashboard-pro-page .quick-action-btn:hover {
    transform: translateY(-1px);
  }

  .dashboard-pro-page .quick-action-btn.primary {
    background: linear-gradient(135deg, #2563eb, #1d4ed8);
    color: #fff;
    border: none;
    box-shadow: 0 12px 28px rgba(37, 99, 235, 0.22);
  }

  .dashboard-pro-page .snapshot-grid {
    display: grid;
    gap: 12px;
  }

  .dashboard-pro-page .pro-snapshot-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .dashboard-pro-page .mini-card {
    border-radius: 18px;
    padding: 18px;
    background: #f8fafc;
    border: 1px solid #e8edf4;
  }

  .dashboard-pro-page .mini-card span {
    display: block;
    color: #64748b;
    font-size: 0.84rem;
    font-weight: 700;
    margin-bottom: 10px;
  }

  .dashboard-pro-page .mini-card strong {
    color: #0f172a;
    font-size: 1.35rem;
    font-weight: 900;
  }

  .dashboard-pro-page .list-table-pro {
    display: grid;
    gap: 12px;
  }

  .dashboard-pro-page .list-row-pro {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 14px;
    padding: 16px;
    border-radius: 18px;
    background: #f8fafc;
    border: 1px solid #edf2f7;
  }

  .dashboard-pro-page .list-row-pro strong {
    display: block;
    color: #0f172a;
    font-size: 0.95rem;
    font-weight: 900;
  }

  .dashboard-pro-page .list-row-pro p {
    margin: 4px 0 0 0;
    color: #64748b;
    font-size: 0.82rem;
    font-weight: 700;
  }

  .dashboard-pro-page .list-row-pro span {
    color: #1d4ed8;
    font-weight: 900;
    white-space: nowrap;
  }

  .dashboard-pro-page .activity-list-pro {
    display: grid;
    gap: 12px;
  }

  .dashboard-pro-page .activity-item-pro {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    padding: 16px;
    border-radius: 18px;
    background: #f8fafc;
    border: 1px solid #edf2f7;
  }

  .dashboard-pro-page .activity-content strong {
    color: #0f172a;
    font-size: 0.95rem;
    font-weight: 900;
  }

  .dashboard-pro-page .activity-content p {
    margin: 6px 0 0 0;
    color: #64748b;
    font-size: 0.88rem;
    line-height: 1.6;
  }

  .dashboard-pro-page .activity-meta-pro {
    display: grid;
    gap: 8px;
    justify-items: end;
  }

  .dashboard-pro-page .activity-meta-pro small {
    color: #94a3b8;
    font-size: 0.76rem;
    font-weight: 700;
    white-space: nowrap;
  }

  .dashboard-pro-page .mobile-hero-pro {
    border-radius: 24px;
    padding: 20px;
    background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%);
    color: #fff;
  }

  .dashboard-pro-page .mobile-hero-pro h1 {
    margin: 0 0 6px 0;
    font-size: 1.8rem;
    font-weight: 900;
    color: #fff;
  }

  .dashboard-pro-page .mobile-hero-pro p {
    margin: 0;
    color: rgba(255,255,255,0.82);
    line-height: 1.6;
  }

  .dashboard-pro-page .mobile-hero-mini-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-top: 16px;
  }

  .dashboard-pro-page .mini-stat-pro {
    border-radius: 16px;
    padding: 14px;
    background: rgba(255,255,255,0.12);
    border: 1px solid rgba(255,255,255,0.14);
  }

  .dashboard-pro-page .mini-stat-pro span {
    display: block;
    font-size: 0.78rem;
    color: rgba(255,255,255,0.8);
    margin-bottom: 8px;
    font-weight: 700;
  }

  .dashboard-pro-page .mini-stat-pro strong {
    font-size: 1.2rem;
    font-weight: 900;
    color: #fff;
  }

  .dashboard-pro-page .scope-mobile-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .dashboard-pro-page .scope-mini-box {
    border-radius: 16px;
    background: #f8fafc;
    border: 1px solid #edf2f7;
    padding: 16px;
  }

  .dashboard-pro-page .scope-mini-box span {
    display: block;
    color: #64748b;
    font-size: 0.8rem;
    font-weight: 700;
    margin-bottom: 8px;
  }

  .dashboard-pro-page .scope-mini-box strong {
    color: #0f172a;
    font-size: 1.2rem;
    font-weight: 900;
  }

  @media (max-width: 1200px) {
    .dashboard-pro-page .hero-shell,
    .dashboard-pro-page .grid-two,
    .dashboard-pro-page .stat-grid-pro {
      grid-template-columns: 1fr 1fr;
    }

    .dashboard-pro-page .quick-actions-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 900px) {
    .dashboard-pro-page .hero-shell,
    .dashboard-pro-page .grid-two,
    .dashboard-pro-page .stat-grid-pro,
    .dashboard-pro-page .pro-snapshot-grid {
      grid-template-columns: 1fr;
    }
  }
`;