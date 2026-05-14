import { useEffect, useMemo, useState } from "react";
import {
  Award,
  BarChart3,
  CheckCircle2,
  Clock,
  FileSignature,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Star,
  TrendingDown,
  TrendingUp,
  Users,
  XCircle,
  ClipboardCheck,
  Eye,
  Activity,
  Target,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { apiFetch } from "../services/api";

const statusLabels = {
  draft: "Draft",
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

function formatReviewType(value) {
  return String(value || "-").replaceAll("_", " ");
}

function getInitials(name) {
  const text = String(name || "Employee").trim();
  const parts = text.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
}

function StatCard({ icon: Icon, label, value, hint, tone = "blue" }) {
  return (
    <div className={`perf-stat-card tone-${tone}`}>
      <div className="perf-stat-icon">
        <Icon size={22} />
      </div>
      <div className="perf-stat-body">
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

function StatusBadge({ status }) {
  return (
    <span className={`perf-status ${status || "draft"}`}>
      {statusLabels[status] || status || "Draft"}
    </span>
  );
}

function EmptyState({ text }) {
  return (
    <div className="perf-empty">
      <Sparkles size={22} />
      <span>{text}</span>
    </div>
  );
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

    const list = reviews.filter((item) => {
      if (!q) return true;

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
    });

    return list.slice(0, 14);
  }, [reviews, keyword]);

  const activeTemplates = useMemo(
    () => templates.filter((item) => item.status === "active"),
    [templates]
  );

  const completionRate = useMemo(() => {
    const total = safeNumber(summary.total);
    if (!total) return 0;

    const done =
      safeNumber(summary.approved) +
      safeNumber(summary.locked) +
      safeNumber(summary.hr_reviewed);

    return Math.round((done / total) * 100);
  }, [summary]);

  const inProgressCount =
    safeNumber(summary.assigned) +
    safeNumber(summary.self_completed) +
    safeNumber(summary.supervisor_completed) +
    safeNumber(summary.hr_reviewed);

  const rejectedCount = safeNumber(summary.rejected);
  const approvedCount = safeNumber(summary.approved) + safeNumber(summary.locked);
  const averageScore = safeNumber(summary.average_score);

  const highRiskCount = useMemo(() => {
    return reviews.filter((r) => safeNumber(r.total_score) > 0 && safeNumber(r.total_score) < 60).length;
  }, [reviews]);

  const promotionCandidates = useMemo(() => {
    return reviews.filter((r) => safeNumber(r.total_score) >= 90).length;
  }, [reviews]);

  const needsTrainingCount = useMemo(() => {
    return reviews.filter((r) => {
      const score = safeNumber(r.total_score);
      return score > 0 && score < 70;
    }).length;
  }, [reviews]);

  const statusChartData = useMemo(() => {
    return [
      { name: "Assigned", value: safeNumber(summary.assigned) },
      { name: "Self Review", value: safeNumber(summary.self_completed) },
      { name: "Supervisor", value: safeNumber(summary.supervisor_completed) },
      { name: "HR Reviewed", value: safeNumber(summary.hr_reviewed) },
      { name: "Approved", value: safeNumber(summary.approved) },
      { name: "Rejected", value: safeNumber(summary.rejected) },
      { name: "Locked", value: safeNumber(summary.locked) },
    ].filter((item) => item.value > 0);
  }, [summary]);

  const scoreDistributionData = useMemo(() => {
    const buckets = [
      { name: "90-100", value: 0 },
      { name: "80-89", value: 0 },
      { name: "70-79", value: 0 },
      { name: "60-69", value: 0 },
      { name: "<60", value: 0 },
    ];

    for (const review of reviews) {
      const score = safeNumber(review.total_score);
      if (!score) continue;

      if (score >= 90) buckets[0].value += 1;
      else if (score >= 80) buckets[1].value += 1;
      else if (score >= 70) buckets[2].value += 1;
      else if (score >= 60) buckets[3].value += 1;
      else buckets[4].value += 1;
    }

    return buckets;
  }, [reviews]);

  const projectComparisonData = useMemo(() => {
    const map = new Map();

    reviews.forEach((review) => {
      const project = review.project_name || "No Project";
      const score = safeNumber(review.total_score);
      if (!score) return;

      if (!map.has(project)) {
        map.set(project, { project, total: 0, count: 0 });
      }

      const current = map.get(project);
      current.total += score;
      current.count += 1;
    });

    return Array.from(map.values())
      .map((item) => ({
        name: item.project,
        average: item.count ? Number((item.total / item.count).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.average - a.average)
      .slice(0, 6);
  }, [reviews]);

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
          border-radius: 32px;
          padding: 30px;
          background:
            radial-gradient(circle at 88% 20%, rgba(56,189,248,.32), transparent 28%),
            radial-gradient(circle at 8% 90%, rgba(34,197,94,.2), transparent 30%),
            linear-gradient(135deg, rgba(15,23,42,.98), rgba(30,64,175,.94));
          color: white;
          box-shadow: 0 28px 70px rgba(15, 23, 42, .26);
          margin-bottom: 18px;
        }

        .performance-hero::before {
          content: "";
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(255,255,255,.055) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,.055) 1px, transparent 1px);
          background-size: 46px 46px;
          opacity: .32;
        }

        .performance-hero::after {
          content: "";
          position: absolute;
          right: -90px;
          bottom: -120px;
          width: 360px;
          height: 360px;
          border-radius: 999px;
          background: rgba(255,255,255,.09);
        }

        .performance-hero-content {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 22px;
        }

        .performance-kicker {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 13px;
          border-radius: 999px;
          background: rgba(255,255,255,.14);
          border: 1px solid rgba(255,255,255,.18);
          font-size: 12px;
          font-weight: 900;
          letter-spacing: .08em;
          text-transform: uppercase;
        }

        .performance-hero h1 {
          margin: 16px 0 9px;
          font-size: clamp(30px, 4vw, 48px);
          line-height: 1.02;
          font-weight: 950;
          letter-spacing: -.04em;
        }

        .performance-hero p {
          margin: 0;
          color: rgba(255,255,255,.78);
          max-width: 760px;
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
          font-weight: 950;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
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

        .perf-btn.dark {
          background: #0f172a;
          color: #fff;
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
          border-radius: 26px;
          padding: 18px;
          background: rgba(255,255,255,.94);
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
          width: 88px;
          height: 88px;
          border-radius: 999px;
          opacity: .11;
          background: currentColor;
        }

        .perf-stat-icon {
          width: 48px;
          height: 48px;
          border-radius: 18px;
          display: grid;
          place-items: center;
          background: rgba(37,99,235,.1);
          color: #2563eb;
          flex: 0 0 auto;
        }

        .perf-stat-body {
          min-width: 0;
        }

        .perf-stat-card p {
          margin: 0;
          color: #64748b;
          font-size: 12px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .04em;
        }

        .perf-stat-card strong {
          display: block;
          margin-top: 7px;
          font-size: 28px;
          line-height: 1;
          color: #0f172a;
        }

        .perf-stat-card span {
          display: block;
          margin-top: 8px;
          color: #64748b;
          font-size: 12px;
          line-height: 1.4;
        }

        .tone-green .perf-stat-icon { background: rgba(22,163,74,.1); color: #16a34a; }
        .tone-amber .perf-stat-icon { background: rgba(245,158,11,.12); color: #d97706; }
        .tone-red .perf-stat-icon { background: rgba(239,68,68,.1); color: #dc2626; }
        .tone-purple .perf-stat-icon { background: rgba(124,58,237,.1); color: #7c3aed; }
        .tone-sky .perf-stat-icon { background: rgba(14,165,233,.1); color: #0284c7; }

        .quick-strip {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 18px;
        }

        .quick-card {
          border: 1px solid rgba(148,163,184,.2);
          border-radius: 22px;
          padding: 15px;
          background: rgba(255,255,255,.9);
          box-shadow: 0 14px 34px rgba(15,23,42,.07);
          text-decoration: none;
          color: #0f172a;
          display: flex;
          align-items: center;
          gap: 12px;
          transition: .2s ease;
        }

        .quick-card:hover {
          transform: translateY(-2px);
          border-color: rgba(37,99,235,.35);
        }

        .quick-card-icon {
          width: 42px;
          height: 42px;
          border-radius: 16px;
          display: grid;
          place-items: center;
          background: #eff6ff;
          color: #2563eb;
          flex: 0 0 auto;
        }

        .quick-card strong {
          display: block;
          font-size: 13px;
        }

        .quick-card span {
          display: block;
          margin-top: 3px;
          font-size: 12px;
          color: #64748b;
        }

        .performance-main {
          display: grid;
          grid-template-columns: minmax(0, 1.45fr) minmax(360px, .85fr);
          gap: 18px;
        }

        .perf-panel {
          background: rgba(255,255,255,.95);
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

        .charts-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 18px;
          margin-bottom: 18px;
        }

        .chart-body {
          padding: 16px;
          height: 280px;
        }

        .perf-search {
          height: 42px;
          border-radius: 15px;
          border: 1px solid rgba(148,163,184,.35);
          padding: 0 14px 0 40px;
          outline: none;
          min-width: 270px;
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
          min-width: 820px;
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

        .perf-table tr {
          transition: .16s ease;
        }

        .perf-table tbody tr:hover {
          background: #f8fafc;
        }

        .emp-cell {
          display: flex;
          align-items: center;
          gap: 11px;
        }

        .emp-avatar {
          width: 40px;
          height: 40px;
          border-radius: 15px;
          display: grid;
          place-items: center;
          background: linear-gradient(135deg, #dbeafe, #eff6ff);
          color: #1d4ed8;
          font-weight: 950;
          flex: 0 0 auto;
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
          text-transform: capitalize;
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

        .perf-status.hr_reviewed,
        .perf-status.supervisor_completed {
          background: #f5f3ff;
          color: #7c3aed;
        }

        .perf-status.assigned,
        .perf-status.self_review_completed {
          background: #fffbeb;
          color: #b45309;
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

        .row-action {
          width: 36px;
          height: 36px;
          border: 0;
          border-radius: 13px;
          display: grid;
          place-items: center;
          background: #eff6ff;
          color: #2563eb;
          cursor: pointer;
        }

        .mobile-review-list {
          display: none;
          padding: 14px;
          gap: 12px;
        }

        .mobile-review-card {
          border: 1px solid rgba(148,163,184,.18);
          border-radius: 22px;
          padding: 14px;
          background: #fff;
          display: grid;
          gap: 12px;
        }

        .mobile-review-top {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: flex-start;
        }

        .mobile-review-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

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
          flex: 0 0 auto;
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

        .progress-big {
          display: flex;
          align-items: flex-end;
          gap: 8px;
        }

        .progress-big strong {
          font-size: 38px;
          line-height: 1;
        }

        .progress-big span {
          color: #64748b;
          font-weight: 800;
          margin-bottom: 4px;
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

        .insight-grid {
          padding: 12px;
          display: grid;
          gap: 10px;
        }

        .insight-card {
          padding: 13px;
          border-radius: 18px;
          border: 1px solid rgba(148,163,184,.16);
          background: #f8fafc;
          display: flex;
          gap: 12px;
          align-items: center;
        }

        .insight-icon {
          width: 40px;
          height: 40px;
          border-radius: 15px;
          display: grid;
          place-items: center;
          background: #eff6ff;
          color: #2563eb;
          flex: 0 0 auto;
        }

        .insight-card strong {
          display: block;
          font-size: 13px;
        }

        .insight-card span {
          display: block;
          margin-top: 3px;
          font-size: 12px;
          color: #64748b;
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
          display: grid;
          place-items: center;
          gap: 8px;
        }

        .perf-error {
          color: #b91c1c;
          background: #fef2f2;
          border-radius: 18px;
          margin-bottom: 18px;
          font-weight: 800;
        }

        @media (max-width: 1280px) {
          .performance-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .quick-strip {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .performance-main {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 980px) {
          .charts-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 720px) {
          .performance-page {
            padding-bottom: 80px;
          }

          .performance-hero {
            border-radius: 24px;
            padding: 20px;
          }

          .performance-hero-content {
            align-items: flex-start;
            flex-direction: column;
          }

          .performance-actions {
            width: 100%;
            display: grid;
            grid-template-columns: 1fr;
          }

          .perf-btn {
            width: 100%;
          }

          .performance-grid,
          .quick-strip {
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
            border-radius: 22px;
          }

          .perf-table-wrap {
            display: none;
          }

          .mobile-review-list {
            display: grid;
          }

          .chart-body {
            height: 250px;
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
              Enterprise performance management for annual, semi-annual, quarterly,
              probation, and custom reviews with dynamic templates, scoring,
              recommendations, approvals, signatures, and audit trail.
            </p>
          </div>

          <div className="performance-actions">
            <button className="perf-btn secondary" onClick={loadData}>
              <RefreshCw size={17} />
              Refresh
            </button>
            <a className="perf-btn secondary" href="/performance/assign">
              <ClipboardCheck size={17} />
              Assign Reviews
            </a>
            <a className="perf-btn primary" href="/performance/templates">
              <FileSignature size={17} />
              Templates
            </a>
          </div>
        </div>
      </section>

      {error ? <div className="perf-error">{error}</div> : null}

      <section className="quick-strip">
        <a className="quick-card" href="/performance/assign">
          <div className="quick-card-icon">
            <ClipboardCheck size={19} />
          </div>
          <div>
            <strong>Assign Review Cycle</strong>
            <span>Create review assignments by project or employee.</span>
          </div>
        </a>

        <a className="quick-card" href="/performance/templates">
          <div className="quick-card-icon">
            <FileSignature size={19} />
          </div>
          <div>
            <strong>Manage Templates</strong>
            <span>Build dynamic HR Manager review forms.</span>
          </div>
        </a>

        <a className="quick-card" href="/performance">
          <div className="quick-card-icon">
            <BarChart3 size={19} />
          </div>
          <div>
            <strong>Analytics</strong>
            <span>Track completion, score trends, and risks.</span>
          </div>
        </a>

        <a className="quick-card" href="/reports">
          <div className="quick-card-icon">
            <Activity size={19} />
          </div>
          <div>
            <strong>HR Reports</strong>
            <span>Export and analyze employee performance data.</span>
          </div>
        </a>
      </section>

      <section className="performance-grid">
        <StatCard
          icon={Users}
          label="Total Reviews"
          value={safeNumber(summary.total)}
          hint="All performance cycles"
        />
        <StatCard
          icon={CheckCircle2}
          label="Approved / Locked"
          value={approvedCount}
          hint="Finalized employee reviews"
          tone="green"
        />
        <StatCard
          icon={Clock}
          label="In Progress"
          value={inProgressCount}
          hint="Pending workflow steps"
          tone="amber"
        />
        <StatCard
          icon={BarChart3}
          label="Average Score"
          value={`${averageScore.toFixed(1)}%`}
          hint={`${completionRate}% completion progress`}
          tone="purple"
        />
        <StatCard
          icon={ShieldAlert}
          label="High Risk"
          value={highRiskCount}
          hint="Employees below 60%"
          tone="red"
        />
        <StatCard
          icon={TrendingUp}
          label="Promotion Candidates"
          value={promotionCandidates}
          hint="Employees scoring 90%+"
          tone="green"
        />
        <StatCard
          icon={Target}
          label="Needs Training"
          value={needsTrainingCount}
          hint="Employees below 70%"
          tone="amber"
        />
        <StatCard
          icon={XCircle}
          label="Rejected"
          value={rejectedCount}
          hint="Returned or rejected reviews"
          tone="red"
        />
      </section>

      <section className="charts-grid">
        <div className="perf-panel">
          <div className="perf-panel-header">
            <div>
              <h2>Review Workflow Status</h2>
              <p>Distribution of reviews across approval stages.</p>
            </div>
            <ShieldCheck size={22} />
          </div>

          <div className="chart-body">
            {statusChartData.length === 0 ? (
              <EmptyState text="No status data available yet." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusChartData}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={86}
                    innerRadius={52}
                    paddingAngle={4}
                  >
                    {statusChartData.map((_, index) => (
                      <Cell key={index} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="perf-panel">
          <div className="perf-panel-header">
            <div>
              <h2>Score Distribution</h2>
              <p>Performance rating buckets by total score.</p>
            </div>
            <BarChart3 size={22} />
          </div>

          <div className="chart-body">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={scoreDistributionData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" radius={[12, 12, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {projectComparisonData.length > 0 ? (
        <section className="perf-panel" style={{ marginBottom: 18 }}>
          <div className="perf-panel-header">
            <div>
              <h2>Project Performance Comparison</h2>
              <p>Average score by project based on available reviews.</p>
            </div>
            <TrendingUp size={22} />
          </div>

          <div className="chart-body">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={projectComparisonData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Bar dataKey="average" radius={[12, 12, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      ) : null}

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
            <EmptyState text="No reviews found." />
          ) : (
            <>
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
                      <th>Open</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredReviews.map((review) => (
                      <tr
                        key={review.id}
                        style={{ cursor: "pointer" }}
                        onClick={() => {
                          window.location.href = `/performance/reviews/${review.id}`;
                        }}
                      >
                        <td>
                          <div className="emp-cell">
                            <div className="emp-avatar">
                              {getInitials(review.employee_name)}
                            </div>
                            <div>
                              <strong>{review.employee_name || "Employee"}</strong>
                              <span>GAS ID: {review.gas_id || "-"}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="emp-cell">
                            <div>
                              <strong>{review.project_name || "-"}</strong>
                              <span>{review.package_name || "No package"}</span>
                            </div>
                          </div>
                        </td>
                        <td>{formatReviewType(review.review_type)}</td>
                        <td>
                          <StatusBadge status={review.status} />
                        </td>
                        <td>
                          <ScoreBadge score={review.total_score} />
                        </td>
                        <td>{review.final_rating || "-"}</td>
                        <td>
                          <button
                            className="row-action"
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.location.href = `/performance/reviews/${review.id}`;
                            }}
                          >
                            <Eye size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mobile-review-list">
                {filteredReviews.map((review) => (
                  <div className="mobile-review-card" key={review.id}>
                    <div className="mobile-review-top">
                      <div className="emp-cell">
                        <div className="emp-avatar">
                          {getInitials(review.employee_name)}
                        </div>
                        <div>
                          <strong>{review.employee_name || "Employee"}</strong>
                          <span>GAS ID: {review.gas_id || "-"}</span>
                        </div>
                      </div>
                      <ScoreBadge score={review.total_score} />
                    </div>

                    <div className="mobile-review-meta">
                      <span className="perf-status">{formatReviewType(review.review_type)}</span>
                      <StatusBadge status={review.status} />
                      <span className="perf-status">{review.project_name || "-"}</span>
                    </div>

                    <a className="perf-btn dark" href={`/performance/reviews/${review.id}`}>
                      <Eye size={17} />
                      Open Review
                    </a>
                  </div>
                ))}
              </div>
            </>
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
              <div className="progress-big">
                <strong>{completionRate}%</strong>
                <span>complete</span>
              </div>
              <div className="progress-ring">
                <div style={{ width: `${completionRate}%` }} />
              </div>
            </div>
          </div>

          <div className="perf-panel">
            <div className="perf-panel-header">
              <div>
                <h2>Smart HR Insights</h2>
                <p>Auto-generated indicators from current reviews.</p>
              </div>
              <Sparkles size={22} />
            </div>

            <div className="insight-grid">
              <div className="insight-card">
                <div className="insight-icon">
                  <TrendingUp size={18} />
                </div>
                <div>
                  <strong>{promotionCandidates} Promotion Candidates</strong>
                  <span>Employees with 90%+ performance score.</span>
                </div>
              </div>

              <div className="insight-card">
                <div className="insight-icon">
                  <Target size={18} />
                </div>
                <div>
                  <strong>{needsTrainingCount} Need Training</strong>
                  <span>Employees below 70% score threshold.</span>
                </div>
              </div>

              <div className="insight-card">
                <div className="insight-icon">
                  <ShieldAlert size={18} />
                </div>
                <div>
                  <strong>{highRiskCount} High Risk Employees</strong>
                  <span>Employees below 60% require attention.</span>
                </div>
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
                <EmptyState text="No top performers yet." />
              ) : (
                topPerformers.slice(0, 5).map((person) => (
                  <div className="perf-person" key={person.id}>
                    <div className="perf-avatar">
                      {getInitials(person.employee_name)}
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
                <EmptyState text="No records yet." />
              ) : (
                lowPerformers.slice(0, 5).map((person) => (
                  <div className="perf-person" key={person.id}>
                    <div className="perf-avatar">
                      {getInitials(person.employee_name)}
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
              {activeTemplates.length === 0 ? (
                <EmptyState text="No active templates." />
              ) : (
                activeTemplates.slice(0, 5).map((template) => (
                  <div className="template-row" key={template.id}>
                    <div>
                      <strong>{template.name}</strong>
                      <span>
                        {formatReviewType(template.review_type)} · v{template.version || 1}
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
