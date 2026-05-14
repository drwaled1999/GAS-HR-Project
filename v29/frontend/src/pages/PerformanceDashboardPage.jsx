import { useEffect, useMemo, useState } from "react";
import {
  Award,
  BarChart3,
  CheckCircle2,
  Clock,
  FileSignature,
  RefreshCw,
  Search,
  ShieldCheck,
  Star,
  TrendingDown,
  TrendingUp,
  Users,
  XCircle,
} from "lucide-react";
import { apiFetch } from "../services/api";

const statusLabels = {
  assigned: "Assigned",
  self_review_completed: "Self Review",
  supervisor_completed: "Supervisor Completed",
  hr_reviewed: "HR Reviewed",
  approved: "Approved",
  rejected: "Rejected",
  locked: "Locked",
};

function safeNumber(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function StatCard({ icon: Icon, label, value, hint, tone = "blue" }) {
  return (
    <div className={`perf-stat-card tone-${tone}`}>
      <div className="perf-stat-icon">
        <Icon size={22} />
      </div>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        {hint ? <span>{hint}</span> : null}
      </div>
    </div>
  );
}

function ScoreBadge({ score }) {
  const value = safeNumber(score);

  let cls = "low";
  if (value >= 90) cls = "excellent";
  else if (value >= 80) cls = "great";
  else if (value >= 70) cls = "good";
  else if (value >= 60) cls = "warning";

  return <span className={`perf-score ${cls}`}>{value.toFixed(1)}%</span>;
}

export default function PerformanceDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({});
  const [topPerformers, setTopPerformers] = useState([]);
  const [lowPerformers, setLowPerformers] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [keyword, setKeyword] = useState("");
  const [error, setError] = useState("");

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const [dashboardRes, reviewsRes, templatesRes] = await Promise.all([
        apiFetch("/performance/dashboard"),
        apiFetch("/performance/reviews"),
        apiFetch("/performance/templates"),
      ]);

      setSummary(dashboardRes.summary || {});
      setTopPerformers(dashboardRes.topPerformers || []);
      setLowPerformers(dashboardRes.lowPerformers || []);
      setReviews(reviewsRes.reviews || []);
      setTemplates(templatesRes.templates || []);
    } catch (err) {
      setError(err.message || "Failed to load performance dashboard");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const filteredReviews = useMemo(() => {
    const q = keyword.trim().toLowerCase();

    if (!q) return reviews.slice(0, 12);

    return reviews
      .filter((item) => {
        return [
          item.employee_name,
          item.gas_id,
          item.project_name,
          item.package_name,
          item.review_type,
          item.status,
          item.final_rating,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q);
      })
      .slice(0, 12);
  }, [reviews, keyword]);

  const completionRate = useMemo(() => {
    const total = safeNumber(summary.total);
    if (!total) return 0;

    const done =
      safeNumber(summary.approved) +
      safeNumber(summary.locked) +
      safeNumber(summary.hr_reviewed);

    return Math.round((done / total) * 100);
  }, [summary]);

  return (
    <div className="performance-page">
      <style>{`
        .performance-page {
          min-height: 100%;
          color: #0f172a;
        }

        .performance-hero {
          position: relative;
          overflow: hidden;
          border-radius: 30px;
          padding: 28px;
          background:
            radial-gradient(circle at 85% 20%, rgba(59,130,246,.28), transparent 28%),
            linear-gradient(135deg, rgba(15,23,42,.98), rgba(30,64,175,.92));
          color: white;
          box-shadow: 0 24px 60px rgba(15, 23, 42, .22);
          margin-bottom: 20px;
        }

        .performance-hero::after {
          content: "";
          position: absolute;
          right: -80px;
          bottom: -100px;
          width: 320px;
          height: 320px;
          border-radius: 999px;
          background: rgba(255,255,255,.08);
        }

        .performance-hero-content {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
        }

        .performance-kicker {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 7px 12px;
          border-radius: 999px;
          background: rgba(255,255,255,.13);
          border: 1px solid rgba(255,255,255,.18);
          font-size: 12px;
          font-weight: 800;
          letter-spacing: .08em;
          text-transform: uppercase;
        }

        .performance-hero h1 {
          margin: 14px 0 8px;
          font-size: clamp(28px, 4vw, 44px);
          line-height: 1.05;
          font-weight: 950;
        }

        .performance-hero p {
          margin: 0;
          color: rgba(255,255,255,.78);
          max-width: 720px;
          line-height: 1.7;
        }

        .performance-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .perf-btn {
          border: 0;
          border-radius: 16px;
          padding: 12px 16px;
          font-weight: 900;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          transition: .2s ease;
          text-decoration: none;
          white-space: nowrap;
        }

        .perf-btn.primary {
          background: #fff;
          color: #0f172a;
        }

        .perf-btn.secondary {
          background: rgba(255,255,255,.12);
          color: #fff;
          border: 1px solid rgba(255,255,255,.18);
        }

        .perf-btn:hover {
          transform: translateY(-1px);
        }

        .performance-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 18px;
        }

        .perf-stat-card {
          position: relative;
          overflow: hidden;
          border-radius: 24px;
          padding: 18px;
          background: rgba(255,255,255,.92);
          border: 1px solid rgba(148,163,184,.22);
          box-shadow: 0 18px 45px rgba(15,23,42,.08);
          display: flex;
          gap: 14px;
          align-items: flex-start;
        }

        .perf-stat-card::after {
          content: "";
          position: absolute;
          inset: auto -24px -24px auto;
          width: 86px;
          height: 86px;
          border-radius: 999px;
          opacity: .12;
          background: currentColor;
        }

        .perf-stat-icon {
          width: 46px;
          height: 46px;
          border-radius: 18px;
          display: grid;
          place-items: center;
          background: rgba(37,99,235,.1);
          color: #2563eb;
          flex: 0 0 auto;
        }

        .perf-stat-card p {
          margin: 0;
          color: #64748b;
          font-size: 12px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: .04em;
        }

        .perf-stat-card strong {
          display: block;
          margin-top: 6px;
          font-size: 28px;
          line-height: 1;
          color: #0f172a;
        }

        .perf-stat-card span {
          display: block;
          margin-top: 7px;
          color: #64748b;
          font-size: 12px;
        }

        .tone-green .perf-stat-icon { background: rgba(22,163,74,.1); color: #16a34a; }
        .tone-amber .perf-stat-icon { background: rgba(245,158,11,.12); color: #d97706; }
        .tone-red .perf-stat-icon { background: rgba(239,68,68,.1); color: #dc2626; }
        .tone-purple .perf-stat-icon { background: rgba(124,58,237,.1); color: #7c3aed; }

        .performance-main {
          display: grid;
          grid-template-columns: minmax(0, 1.5fr) minmax(360px, .8fr);
          gap: 18px;
        }

        .perf-panel {
          background: rgba(255,255,255,.94);
          border: 1px solid rgba(148,163,184,.22);
          border-radius: 28px;
          box-shadow: 0 18px 45px rgba(15,23,42,.08);
          overflow: hidden;
        }

        .perf-panel-header {
          padding: 20px 22px;
          border-bottom: 1px solid rgba(148,163,184,.18);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .perf-panel-header h2 {
          margin: 0;
          font-size: 18px;
          color: #0f172a;
        }

        .perf-panel-header p {
          margin: 5px 0 0;
          color: #64748b;
          font-size: 13px;
        }

        .perf-search {
          height: 42px;
          border-radius: 15px;
          border: 1px solid rgba(148,163,184,.35);
          padding: 0 14px 0 40px;
          outline: none;
          min-width: 260px;
          background: #fff;
        }

        .perf-search-wrap {
          position: relative;
        }

        .perf-search-wrap svg {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: #64748b;
        }

        .perf-table-wrap {
          overflow-x: auto;
        }

        .perf-table {
          width: 100%;
          border-collapse: collapse;
          min-width: 760px;
        }

        .perf-table th {
          text-align: left;
          padding: 14px 18px;
          font-size: 12px;
          color: #64748b;
          background: #f8fafc;
          text-transform: uppercase;
          letter-spacing: .05em;
        }

        .perf-table td {
          padding: 15px 18px;
          border-top: 1px solid rgba(148,163,184,.15);
          vertical-align: middle;
        }

        .emp-cell strong {
          display: block;
          color: #0f172a;
          font-size: 14px;
        }

        .emp-cell span {
          display: block;
          color: #64748b;
          font-size: 12px;
          margin-top: 3px;
        }

        .perf-status {
          display: inline-flex;
          padding: 7px 10px;
          border-radius: 999px;
          background: #eff6ff;
          color: #1d4ed8;
          font-size: 12px;
          font-weight: 900;
          white-space: nowrap;
        }

        .perf-status.approved,
        .perf-status.locked {
          background: #ecfdf5;
          color: #15803d;
        }

        .perf-status.rejected {
          background: #fef2f2;
          color: #dc2626;
        }

        .perf-score {
          display: inline-flex;
          min-width: 76px;
          justify-content: center;
          padding: 7px 10px;
          border-radius: 999px;
          font-weight: 950;
          font-size: 12px;
        }

        .perf-score.excellent { background: #ecfdf5; color: #047857; }
        .perf-score.great { background: #f0fdf4; color: #15803d; }
        .perf-score.good { background: #eff6ff; color: #1d4ed8; }
        .perf-score.warning { background: #fffbeb; color: #b45309; }
        .perf-score.low { background: #fef2f2; color: #b91c1c; }

        .side-stack {
          display: grid;
          gap: 18px;
        }

        .perf-list {
          padding: 12px;
          display: grid;
          gap: 10px;
        }

        .perf-person {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 13px;
          border-radius: 18px;
          background: #f8fafc;
          border: 1px solid rgba(148,163,184,.16);
        }

        .perf-avatar {
          width: 42px;
          height: 42px;
          border-radius: 16px;
          display: grid;
          place-items: center;
          background: linear-gradient(135deg, #dbeafe, #eff6ff);
          color: #1d4ed8;
          font-weight: 950;
        }

        .perf-person-info {
          min-width: 0;
          flex: 1;
        }

        .perf-person-info strong {
          display: block;
          font-size: 13px;
          color: #0f172a;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .perf-person-info span {
          display: block;
          color: #64748b;
          font-size: 12px;
          margin-top: 3px;
        }

        .progress-card {
          padding: 18px;
        }

        .progress-ring {
          height: 14px;
          border-radius: 999px;
          background: #e2e8f0;
          overflow: hidden;
          margin-top: 14px;
        }

        .progress-ring div {
          height: 100%;
          border-radius: 999px;
          background: linear-gradient(90deg, #2563eb, #22c55e);
        }

        .template-row {
          padding: 14px;
          border-radius: 18px;
          border: 1px solid rgba(148,163,184,.16);
          background: #f8fafc;
          display: flex;
          justify-content: space-between;
          gap: 12px;
        }

        .template-row strong {
          display: block;
          color: #0f172a;
          font-size: 13px;
        }

        .template-row span {
          color: #64748b;
          font-size: 12px;
        }

        .perf-empty,
        .perf-error,
        .perf-loading {
          padding: 26px;
          text-align: center;
          color: #64748b;
        }

        .perf-error {
          color: #b91c1c;
          background: #fef2f2;
          border-radius: 18px;
          margin: 18px;
        }

        @media (max-width: 1180px) {
          .performance-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .performance-main {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 720px) {
          .performance-page {
            padding-bottom: 80px;
          }

          .performance-hero {
            border-radius: 22px;
            padding: 20px;
          }

          .performance-hero-content {
            align-items: flex-start;
            flex-direction: column;
          }

          .performance-actions {
            width: 100%;
            justify-content: stretch;
          }

          .perf-btn {
            flex: 1;
            justify-content: center;
          }

          .performance-grid {
            grid-template-columns: 1fr;
          }

          .perf-panel-header {
            align-items: flex-start;
            flex-direction: column;
          }

          .perf-search-wrap,
          .perf-search {
            width: 100%;
            min-width: 0;
          }

          .perf-stat-card {
            border-radius: 20px;
          }

          .perf-table {
            min-width: 680px;
          }
        }
      `}</style>

      <section className="performance-hero">
        <div className="performance-hero-content">
          <div>
            <div className="performance-kicker">
              <Award size={16} />
              Performance Management
            </div>
            <h1>Employee Performance Reviews</h1>
            <p>
              Annual, semi-annual, quarterly, probation, and custom reviews with
              dynamic HR Manager templates, scoring, recommendations, approvals,
              signatures, and full audit trail.
            </p>
          </div>

          <div className="performance-actions">
            <button className="perf-btn secondary" onClick={loadData}>
              <RefreshCw size={17} />
              Refresh
            </button>
            <a className="perf-btn primary" href="/performance/templates">
              <FileSignature size={17} />
              Review Templates
            </a>
          </div>
        </div>
      </section>

      {error ? <div className="perf-error">{error}</div> : null}

      <section className="performance-grid">
        <StatCard
          icon={Users}
          label="Total Reviews"
          value={safeNumber(summary.total)}
          hint="All performance cycles"
        />
        <StatCard
          icon={CheckCircle2}
          label="Approved"
          value={safeNumber(summary.approved)}
          hint="Final HR Manager approval"
          tone="green"
        />
        <StatCard
          icon={Clock}
          label="In Progress"
          value={
            safeNumber(summary.assigned) +
            safeNumber(summary.self_completed) +
            safeNumber(summary.supervisor_completed) +
            safeNumber(summary.hr_reviewed)
          }
          hint="Pending workflow steps"
          tone="amber"
        />
        <StatCard
          icon={BarChart3}
          label="Average Score"
          value={`${safeNumber(summary.average_score).toFixed(1)}%`}
          hint={`${completionRate}% completion progress`}
          tone="purple"
        />
      </section>

      <section className="performance-main">
        <div className="perf-panel">
          <div className="perf-panel-header">
            <div>
              <h2>Recent Reviews</h2>
              <p>Latest employee evaluations and approval status.</p>
            </div>

            <div className="perf-search-wrap">
              <Search size={16} />
              <input
                className="perf-search"
                placeholder="Search employee, GAS ID, project..."
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
              />
            </div>
          </div>

          {loading ? (
            <div className="perf-loading">Loading performance reviews...</div>
          ) : filteredReviews.length === 0 ? (
            <div className="perf-empty">No reviews found.</div>
          ) : (
            <div className="perf-table-wrap">
              <table className="perf-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Project</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Score</th>
                    <th>Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReviews.map((review) => (
                    <tr key={review.id}>
                      <td>
                        <div className="emp-cell">
                          <strong>{review.employee_name || "Employee"}</strong>
                          <span>GAS ID: {review.gas_id || "-"}</span>
                        </div>
                      </td>
                      <td>
                        <div className="emp-cell">
                          <strong>{review.project_name || "-"}</strong>
                          <span>{review.package_name || "No package"}</span>
                        </div>
                      </td>
                      <td>{String(review.review_type || "-").replaceAll("_", " ")}</td>
                      <td>
                        <span className={`perf-status ${review.status}`}>
                          {statusLabels[review.status] || review.status}
                        </span>
                      </td>
                      <td>
                        <ScoreBadge score={review.total_score} />
                      </td>
                      <td>{review.final_rating || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="side-stack">
          <div className="perf-panel">
            <div className="perf-panel-header">
              <div>
                <h2>Completion Progress</h2>
                <p>Approved, locked, and HR reviewed records.</p>
              </div>
              <ShieldCheck size={22} />
            </div>

            <div className="progress-card">
              <strong style={{ fontSize: 34 }}>{completionRate}%</strong>
              <div className="progress-ring">
                <div style={{ width: `${completionRate}%` }} />
              </div>
            </div>
          </div>

          <div className="perf-panel">
            <div className="perf-panel-header">
              <div>
                <h2>Top Performers</h2>
                <p>Highest scored employees.</p>
              </div>
              <TrendingUp size={22} />
            </div>

            <div className="perf-list">
              {topPerformers.length === 0 ? (
                <div className="perf-empty">No top performers yet.</div>
              ) : (
                topPerformers.slice(0, 5).map((person) => (
                  <div className="perf-person" key={person.id}>
                    <div className="perf-avatar">
                      <Star size={18} />
                    </div>
                    <div className="perf-person-info">
                      <strong>{person.employee_name || "Employee"}</strong>
                      <span>{person.gas_id || "-"} · {person.project_name || "-"}</span>
                    </div>
                    <ScoreBadge score={person.total_score} />
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="perf-panel">
            <div className="perf-panel-header">
              <div>
                <h2>Needs Attention</h2>
                <p>Lowest scored reviews.</p>
              </div>
              <TrendingDown size={22} />
            </div>

            <div className="perf-list">
              {lowPerformers.length === 0 ? (
                <div className="perf-empty">No records yet.</div>
              ) : (
                lowPerformers.slice(0, 5).map((person) => (
                  <div className="perf-person" key={person.id}>
                    <div className="perf-avatar">
                      <XCircle size={18} />
                    </div>
                    <div className="perf-person-info">
                      <strong>{person.employee_name || "Employee"}</strong>
                      <span>{person.gas_id || "-"} · {person.project_name || "-"}</span>
                    </div>
                    <ScoreBadge score={person.total_score} />
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="perf-panel">
            <div className="perf-panel-header">
              <div>
                <h2>Active Templates</h2>
                <p>Templates ready for assignment.</p>
              </div>
              <FileSignature size={22} />
            </div>

            <div className="perf-list">
              {templates.filter((t) => t.status === "active").length === 0 ? (
                <div className="perf-empty">No active templates.</div>
              ) : (
                templates
                  .filter((t) => t.status === "active")
                  .slice(0, 5)
                  .map((template) => (
                    <div className="template-row" key={template.id}>
                      <div>
                        <strong>{template.name}</strong>
                        <span>
                          {String(template.review_type || "").replaceAll("_", " ")} · v
                          {template.version || 1}
                        </span>
                      </div>
                      <span className="perf-status approved">Active</span>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
