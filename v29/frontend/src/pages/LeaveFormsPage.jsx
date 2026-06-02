import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Download,
  Eye,
  FileText,
  Filter,
  Printer,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { API_BASE, apiFetch } from "../services/api";

const currentYear = new Date().getFullYear();

const leaveTypes = [
  { value: "", label: "All Types" },
  { value: "annual_leave", label: "Annual Leave" },
  { value: "emergency_leave", label: "Emergency Leave" },
  { value: "sick_leave", label: "Sick Leave" },
  { value: "unpaid_leave", label: "Unpaid Leave" },
];

const months = [
  { value: "", label: "All Months" },
  { value: "1", label: "January" },
  { value: "2", label: "February" },
  { value: "3", label: "March" },
  { value: "4", label: "April" },
  { value: "5", label: "May" },
  { value: "6", label: "June" },
  { value: "7", label: "July" },
  { value: "8", label: "August" },
  { value: "9", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

function getToken() {
  return (
    localStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    localStorage.getItem("accessToken") ||
    ""
  );
}

function buildQuery(filters) {
  const params = new URLSearchParams();
  Object.entries(filters || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      params.set(key, String(value).trim());
    }
  });
  const query = params.toString();
  return query ? `?${query}` : "";
}

function formatShortDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function StatCard({ label, value, icon: Icon, tone = "blue" }) {
  return (
    <div className={`lf-stat-card lf-stat-${tone}`}>
      <div className="lf-stat-glow" />
      <div className="lf-stat-content">
        <p>{label}</p>
        <strong>{value ?? 0}</strong>
      </div>
      <span className="lf-stat-icon">
        <Icon size={21} />
      </span>
    </div>
  );
}

export default function LeaveFormsPage() {
  const [forms, setForms] = useState([]);
  const [stats, setStats] = useState({ total: 0, annual: 0, emergency: 0, sick: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [selectedForm, setSelectedForm] = useState(null);
  const [filters, setFilters] = useState({
    search: "",
    project: "",
    packageName: "",
    type: "",
    month: "",
    year: String(currentYear),
  });

  const years = useMemo(() => {
    return ["", ...Array.from({ length: 6 }, (_, index) => String(currentYear - index))];
  }, []);

  async function loadForms() {
    setLoading(true);
    setError("");

    try {
      const data = await apiFetch(`/leave-forms${buildQuery(filters)}`);
      setForms(Array.isArray(data.forms) ? data.forms : []);
      setStats(data.stats || { total: 0, annual: 0, emergency: 0, sick: 0 });
    } catch (err) {
      setError(err.message || "Failed to load leave forms");
      setForms([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadForms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function resetFilters() {
    const next = {
      search: "",
      project: "",
      packageName: "",
      type: "",
      month: "",
      year: String(currentYear),
    };
    setFilters(next);
    setTimeout(() => loadForms(), 0);
  }

  async function openPreview(form) {
    setPreviewLoading(true);
    setSelectedForm(form);
    setPreviewHtml("");

    try {
      const data = await apiFetch(`/leave-forms/${form.requestId}`);
      setPreviewHtml(data.html || "");
    } catch (err) {
      setPreviewHtml(
        `<div style="font-family:Arial;padding:24px;color:#b91c1c;">${
          err.message || "Failed to load form"
        }</div>`
      );
    } finally {
      setPreviewLoading(false);
    }
  }

  async function downloadPdf(form) {
    try {
      const token = getToken();
      const response = await fetch(`${API_BASE}/leave-forms/${form.requestId}/pdf`, {
        method: "GET",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!response.ok) {
        let message = "Failed to download PDF";
        try {
          const data = await response.json();
          message = data.message || message;
        } catch {
          // ignore
        }
        throw new Error(message);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      const gasId = String(form.employeeGasId || "employee").replace(/[^a-zA-Z0-9_-]+/g, "_");
      a.href = url;
      a.download = `Leave_Request_Form_${gasId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.message || "Failed to download PDF");
    }
  }

  function printPreview() {
    const frame = document.getElementById("leave-form-preview-frame");
    if (frame?.contentWindow) {
      frame.contentWindow.focus();
      frame.contentWindow.print();
    }
  }

  return (
    <div className="leave-forms-page">
      <style>{`
        .leave-forms-page {
          min-height: 100%;
          padding: 24px;
          color: #0f172a;
          position: relative;
          overflow: hidden;
          background:
            radial-gradient(circle at 7% 0%, rgba(37, 99, 235, 0.14), transparent 28%),
            radial-gradient(circle at 95% 14%, rgba(14, 165, 233, 0.14), transparent 30%),
            radial-gradient(circle at 50% 100%, rgba(15, 23, 42, 0.06), transparent 35%);
        }

        .leave-forms-page::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background-image:
            linear-gradient(rgba(15,23,42,0.035) 1px, transparent 1px),
            linear-gradient(90deg, rgba(15,23,42,0.035) 1px, transparent 1px);
          background-size: 44px 44px;
          mask-image: linear-gradient(to bottom, rgba(0,0,0,0.7), transparent 80%);
        }

        .leave-forms-page > * {
          position: relative;
          z-index: 1;
        }

        .lf-hero {
          border: 1px solid rgba(255, 255, 255, 0.78);
          border-radius: 34px;
          padding: 28px;
          background:
            linear-gradient(135deg, rgba(15, 23, 42, 0.96), rgba(30, 64, 175, 0.92)),
            radial-gradient(circle at top right, rgba(56, 189, 248, 0.34), transparent 38%);
          box-shadow:
            0 30px 80px rgba(15, 23, 42, 0.18),
            inset 0 1px 0 rgba(255,255,255,0.22);
          display: flex;
          justify-content: space-between;
          gap: 22px;
          align-items: flex-start;
          margin-bottom: 18px;
          overflow: hidden;
          position: relative;
        }

        .lf-hero::before {
          content: "";
          position: absolute;
          width: 310px;
          height: 310px;
          right: -80px;
          top: -120px;
          border-radius: 999px;
          background: radial-gradient(circle, rgba(125,211,252,0.36), transparent 66%);
        }

        .lf-hero::after {
          content: "";
          position: absolute;
          inset: auto 26px 0 auto;
          width: 280px;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.7), transparent);
        }

        .lf-kicker {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          border-radius: 999px;
          background: rgba(255,255,255,0.1);
          color: #bfdbfe;
          border: 1px solid rgba(255,255,255,0.18);
          font-weight: 950;
          font-size: .76rem;
          margin-bottom: 14px;
          backdrop-filter: blur(12px);
        }

        .lf-hero h1 {
          margin: 0;
          font-size: clamp(1.9rem, 3.6vw, 3.25rem);
          letter-spacing: -0.065em;
          color: #fff;
          line-height: .95;
        }

        .lf-hero p {
          margin: 12px 0 0;
          color: rgba(226, 232, 240, 0.88);
          font-weight: 750;
          max-width: 780px;
          line-height: 1.65;
        }

        .lf-hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 12px 15px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.12);
          color: #fff;
          font-weight: 950;
          border: 1px solid rgba(255,255,255,0.2);
          white-space: nowrap;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.18);
          backdrop-filter: blur(14px);
        }

        .lf-stats {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 18px;
        }

        .lf-stat-card {
          border: 1px solid rgba(255,255,255,0.72);
          border-radius: 28px;
          padding: 20px;
          background: rgba(255,255,255,0.82);
          box-shadow:
            0 22px 55px rgba(15, 23, 42, 0.09),
            inset 0 1px 0 rgba(255,255,255,0.8);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          position: relative;
          overflow: hidden;
          backdrop-filter: blur(18px);
          transition: .22s ease;
        }

        .lf-stat-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 28px 70px rgba(15, 23, 42, 0.13);
        }

        .lf-stat-glow {
          position: absolute;
          inset: auto -42px -55px auto;
          width: 150px;
          height: 150px;
          border-radius: 999px;
          opacity: .26;
          background: #2563eb;
          filter: blur(4px);
        }

        .lf-stat-green .lf-stat-glow { background: #16a34a; }
        .lf-stat-orange .lf-stat-glow { background: #f97316; }
        .lf-stat-red .lf-stat-glow { background: #dc2626; }

        .lf-stat-content {
          position: relative;
          z-index: 1;
        }

        .lf-stat-card p {
          margin: 0 0 8px;
          color: #64748b;
          font-weight: 950;
          font-size: .76rem;
          text-transform: uppercase;
          letter-spacing: .055em;
        }

        .lf-stat-card strong {
          font-size: 2.15rem;
          line-height: 1;
          letter-spacing: -0.06em;
          color: #0f172a;
        }

        .lf-stat-icon {
          width: 48px;
          height: 48px;
          display: grid;
          place-items: center;
          border-radius: 18px;
          background: linear-gradient(135deg, #eff6ff, #dbeafe);
          color: #2563eb;
          position: relative;
          z-index: 1;
          box-shadow: inset 0 1px 0 rgba(255,255,255,.85);
        }

        .lf-stat-green .lf-stat-icon {
          background: linear-gradient(135deg, #ecfdf5, #dcfce7);
          color: #16a34a;
        }

        .lf-stat-orange .lf-stat-icon {
          background: linear-gradient(135deg, #fff7ed, #ffedd5);
          color: #f97316;
        }

        .lf-stat-red .lf-stat-icon {
          background: linear-gradient(135deg, #fef2f2, #fee2e2);
          color: #dc2626;
        }

        .lf-panel {
          border: 1px solid rgba(255,255,255,0.76);
          border-radius: 32px;
          background: rgba(255,255,255,0.86);
          box-shadow:
            0 26px 75px rgba(15, 23, 42, 0.10),
            inset 0 1px 0 rgba(255,255,255,0.86);
          overflow: hidden;
          backdrop-filter: blur(18px);
        }

        .lf-toolbar {
          padding: 18px;
          display: grid;
          grid-template-columns: 1.55fr repeat(5, minmax(118px, 1fr)) auto auto;
          gap: 10px;
          border-bottom: 1px solid rgba(226,232,240,0.85);
          align-items: center;
          background:
            linear-gradient(180deg, rgba(248,250,252,0.9), rgba(255,255,255,0.72));
        }

        .lf-input,
        .lf-select {
          width: 100%;
          min-height: 44px;
          border: 1px solid rgba(203,213,225,0.9);
          border-radius: 16px;
          padding: 0 13px;
          font-weight: 850;
          color: #0f172a;
          background: rgba(255,255,255,0.92);
          outline: none;
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.9),
            0 8px 20px rgba(15,23,42,0.035);
          transition: .18s ease;
        }

        .lf-input:focus,
        .lf-select:focus {
          border-color: rgba(37,99,235,0.62);
          box-shadow:
            0 0 0 4px rgba(37,99,235,0.12),
            0 12px 25px rgba(15,23,42,0.06);
        }

        .lf-search-wrap {
          position: relative;
        }

        .lf-search-wrap svg {
          position: absolute;
          left: 13px;
          top: 50%;
          transform: translateY(-50%);
          color: #94a3b8;
        }

        .lf-search-wrap .lf-input {
          padding-left: 42px;
        }

        .lf-btn {
          min-height: 44px;
          border: 0;
          border-radius: 16px;
          padding: 0 15px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-weight: 950;
          cursor: pointer;
          transition: 0.18s ease;
          white-space: nowrap;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.18);
        }

        .lf-btn-primary {
          background: linear-gradient(135deg, #2563eb, #1d4ed8);
          color: #fff;
          box-shadow:
            0 14px 28px rgba(37,99,235,0.24),
            inset 0 1px 0 rgba(255,255,255,0.22);
        }

        .lf-btn-soft {
          background: linear-gradient(135deg, #f8fafc, #eef2f7);
          color: #334155;
          border: 1px solid rgba(203,213,225,0.8);
        }

        .lf-btn-danger {
          background: linear-gradient(135deg, #fee2e2, #fecaca);
          color: #b91c1c;
          border: 1px solid rgba(248,113,113,0.35);
        }

        .lf-btn:hover {
          transform: translateY(-1px);
          filter: saturate(1.04);
        }

        .lf-btn:disabled {
          opacity: .6;
          cursor: not-allowed;
          transform: none;
        }

        .lf-table-wrap {
          overflow-x: auto;
        }

        .lf-table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          min-width: 1100px;
        }

        .lf-table th {
          text-align: left;
          padding: 14px 17px;
          color: #64748b;
          background: rgba(248,250,252,0.82);
          font-size: .73rem;
          text-transform: uppercase;
          letter-spacing: .07em;
          border-bottom: 1px solid rgba(226,232,240,0.9);
        }

        .lf-table td {
          padding: 16px 17px;
          border-top: 1px solid rgba(237,242,247,0.92);
          font-weight: 850;
          color: #1e293b;
          vertical-align: middle;
          background: rgba(255,255,255,0.44);
        }

        .lf-table tbody tr {
          transition: .18s ease;
        }

        .lf-table tbody tr:hover td {
          background: rgba(239,246,255,0.58);
        }

        .lf-employee {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .lf-employee strong {
          display: block;
          color: #0f172a;
          font-size: .96rem;
        }

        .lf-employee span {
          display: inline-flex;
          width: fit-content;
          color: #475569;
          font-size: .76rem;
          font-weight: 950;
          margin-top: 1px;
          padding: 5px 8px;
          border-radius: 999px;
          background: #f1f5f9;
        }

        .lf-chip {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 7px 11px;
          border-radius: 999px;
          background: linear-gradient(135deg, #eff6ff, #dbeafe);
          color: #1d4ed8;
          font-size: .75rem;
          font-weight: 950;
          border: 1px solid rgba(37,99,235,0.13);
          white-space: nowrap;
        }

        .lf-status {
          background: linear-gradient(135deg, #dcfce7, #bbf7d0);
          color: #166534;
          border-color: rgba(22,101,52,0.14);
        }

        .lf-actions {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .lf-empty {
          padding: 38px;
          text-align: center;
          color: #64748b;
          font-weight: 950;
        }

        .lf-error {
          margin: 18px 18px 0;
          padding: 14px 16px;
          border-radius: 18px;
          background: linear-gradient(135deg, #fee2e2, #fff1f2);
          color: #991b1b;
          font-weight: 950;
          border: 1px solid rgba(248,113,113,0.25);
        }

        .lf-modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 120;
          background:
            radial-gradient(circle at 50% 12%, rgba(37,99,235,0.28), transparent 42%),
            rgba(15,23,42,0.66);
          backdrop-filter: blur(14px);
          display: grid;
          place-items: center;
          padding: 18px;
        }

        .lf-modal {
          width: min(1200px, 100%);
          height: min(790px, 94vh);
          border-radius: 32px;
          background: rgba(255,255,255,0.96);
          overflow: hidden;
          box-shadow:
            0 35px 110px rgba(0,0,0,0.34),
            inset 0 1px 0 rgba(255,255,255,0.88);
          display: flex;
          flex-direction: column;
          border: 1px solid rgba(255,255,255,0.64);
        }

        .lf-modal-head {
          padding: 16px 18px;
          border-bottom: 1px solid rgba(226,232,240,0.9);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          background:
            linear-gradient(135deg, rgba(15,23,42,0.98), rgba(30,64,175,0.92));
          color: #fff;
        }

        .lf-modal-head strong {
          display: block;
          font-size: 1.03rem;
          letter-spacing: -0.02em;
        }

        .lf-modal-head span {
          display: block;
          font-size: .8rem;
          color: rgba(226,232,240,0.84);
          font-weight: 850;
          margin-top: 3px;
        }

        .lf-modal-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .lf-frame-wrap {
          flex: 1;
          background:
            linear-gradient(135deg, #e2e8f0, #f8fafc);
          padding: 14px;
        }

        .lf-frame {
          width: 100%;
          height: 100%;
          border: 0;
          background: #fff;
          border-radius: 18px;
          box-shadow: 0 16px 40px rgba(15,23,42,0.12);
        }

        html.dark .leave-forms-page {
          color: #e5e7eb;
          background:
            radial-gradient(circle at 7% 0%, rgba(37, 99, 235, 0.2), transparent 28%),
            radial-gradient(circle at 95% 14%, rgba(14, 165, 233, 0.12), transparent 30%),
            #020617;
        }

        html.dark .lf-panel,
        html.dark .lf-stat-card,
        html.dark .lf-modal {
          background: rgba(15,23,42,0.86);
          border-color: rgba(51,65,85,0.88);
        }

        html.dark .lf-toolbar {
          background: rgba(15,23,42,0.7);
          border-color: rgba(51,65,85,0.75);
        }

        html.dark .lf-stat-card p,
        html.dark .lf-table th,
        html.dark .lf-employee span {
          color: #94a3b8;
        }

        html.dark .lf-stat-card strong,
        html.dark .lf-employee strong {
          color: #fff;
        }

        html.dark .lf-input,
        html.dark .lf-select {
          background: rgba(2,6,23,0.84);
          border-color: rgba(51,65,85,0.95);
          color: #e5e7eb;
        }

        html.dark .lf-table th {
          background: rgba(2,6,23,0.68);
        }

        html.dark .lf-table td {
          border-color: rgba(51,65,85,0.65);
          color: #e5e7eb;
          background: rgba(15,23,42,0.46);
        }

        html.dark .lf-table tbody tr:hover td {
          background: rgba(30,64,175,0.18);
        }

        html.dark .lf-btn-soft {
          background: rgba(30,41,59,0.9);
          color: #e5e7eb;
          border-color: rgba(71,85,105,0.75);
        }

        @media (max-width: 1180px) {
          .lf-toolbar {
            grid-template-columns: 1fr 1fr;
          }
        }

        @media (max-width: 760px) {
          .leave-forms-page {
            padding: 14px 12px 92px;
          }

          .lf-hero {
            flex-direction: column;
            border-radius: 26px;
            padding: 20px;
          }

          .lf-hero-badge {
            width: 100%;
            justify-content: center;
          }

          .lf-stats {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .lf-stat-card {
            border-radius: 22px;
            padding: 16px;
          }

          .lf-stat-card strong {
            font-size: 1.85rem;
          }

          .lf-toolbar {
            grid-template-columns: 1fr;
          }

          .lf-panel {
            border-radius: 26px;
          }

          .lf-modal {
            height: 94vh;
            border-radius: 22px;
          }

          .lf-modal-head {
            align-items: flex-start;
            flex-direction: column;
          }

          .lf-modal-actions {
            width: 100%;
            justify-content: stretch;
          }

          .lf-modal-actions .lf-btn {
            flex: 1;
          }
        }
      `}</style>

      <section className="lf-hero">
        <div>
          <div className="lf-kicker">
            <FileText size={15} />
            GAS Official Leave Documents
          </div>
          <h1>Leave Forms</h1>
          <p>
            Official GAS leave request forms generated from approved annual, emergency, sick,
            and unpaid leave requests.
          </p>
        </div>

        <div className="lf-hero-badge">
          <FileText size={18} /> Approved Requests Only
        </div>
      </section>

      <section className="lf-stats">
        <StatCard label="Total Forms" value={stats.total} icon={FileText} tone="blue" />
        <StatCard label="Annual Leave" value={stats.annual} icon={CalendarDays} tone="green" />
        <StatCard label="Emergency Leave" value={stats.emergency} icon={Filter} tone="orange" />
        <StatCard label="Sick Leave" value={stats.sick} icon={FileText} tone="red" />
      </section>

      <section className="lf-panel">
        <div className="lf-toolbar">
          <div className="lf-search-wrap">
            <Search size={18} />
            <input
              className="lf-input"
              value={filters.search}
              onChange={(event) => updateFilter("search", event.target.value)}
              placeholder="Search by GAS ID or employee name"
            />
          </div>

          <input
            className="lf-input"
            value={filters.project}
            onChange={(event) => updateFilter("project", event.target.value)}
            placeholder="Project"
          />

          <input
            className="lf-input"
            value={filters.packageName}
            onChange={(event) => updateFilter("packageName", event.target.value)}
            placeholder="Package"
          />

          <select
            className="lf-select"
            value={filters.type}
            onChange={(event) => updateFilter("type", event.target.value)}
          >
            {leaveTypes.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>

          <select
            className="lf-select"
            value={filters.month}
            onChange={(event) => updateFilter("month", event.target.value)}
          >
            {months.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>

          <select
            className="lf-select"
            value={filters.year}
            onChange={(event) => updateFilter("year", event.target.value)}
          >
            {years.map((year) => (
              <option key={year || "all"} value={year}>
                {year || "All Years"}
              </option>
            ))}
          </select>

          <button className="lf-btn lf-btn-primary" type="button" onClick={loadForms} disabled={loading}>
            <RefreshCw size={16} /> Apply
          </button>

          <button className="lf-btn lf-btn-soft" type="button" onClick={resetFilters}>
            Reset
          </button>
        </div>

        {error ? <div className="lf-error">{error}</div> : null}

        <div className="lf-table-wrap">
          <table className="lf-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Project</th>
                <th>Package</th>
                <th>Leave Type</th>
                <th>From</th>
                <th>To</th>
                <th>Days</th>
                <th>Status</th>
                <th>Form</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="9" className="lf-empty">
                    Loading leave forms...
                  </td>
                </tr>
              ) : forms.length === 0 ? (
                <tr>
                  <td colSpan="9" className="lf-empty">
                    No approved leave forms found.
                  </td>
                </tr>
              ) : (
                forms.map((form) => (
                  <tr key={form.requestId}>
                    <td>
                      <div className="lf-employee">
                        <strong>{form.employeeName || "-"}</strong>
                        <span>GAS ID: {form.employeeGasId || "-"}</span>
                      </div>
                    </td>
                    <td>{form.projectName || "-"}</td>
                    <td>{form.packageName || "-"}</td>
                    <td>
                      <span className="lf-chip">{form.leaveTypeLabel || form.type}</span>
                    </td>
                    <td>{formatShortDate(form.startDate)}</td>
                    <td>{formatShortDate(form.endDate)}</td>
                    <td>{form.daysCount || 0}</td>
                    <td>
                      <span className="lf-chip lf-status">Approved</span>
                    </td>
                    <td>
                      <div className="lf-actions">
                        <button className="lf-btn lf-btn-soft" type="button" onClick={() => openPreview(form)}>
                          <Eye size={16} /> View
                        </button>
                        <button className="lf-btn lf-btn-primary" type="button" onClick={() => downloadPdf(form)}>
                          <Download size={16} /> PDF
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selectedForm ? (
        <div className="lf-modal-backdrop" role="dialog" aria-modal="true">
          <div className="lf-modal">
            <div className="lf-modal-head">
              <div>
                <strong>{selectedForm.employeeName || "Leave Form"}</strong>
                <span>
                  GAS ID: {selectedForm.employeeGasId || "-"} ·{" "}
                  {selectedForm.leaveTypeLabel || selectedForm.type}
                </span>
              </div>

              <div className="lf-modal-actions">
                <button
                  className="lf-btn lf-btn-soft"
                  type="button"
                  onClick={printPreview}
                  disabled={!previewHtml || previewLoading}
                >
                  <Printer size={16} /> Print
                </button>

                <button className="lf-btn lf-btn-primary" type="button" onClick={() => downloadPdf(selectedForm)}>
                  <Download size={16} /> Download PDF
                </button>

                <button className="lf-btn lf-btn-danger" type="button" onClick={() => setSelectedForm(null)}>
                  <X size={16} /> Close
                </button>
              </div>
            </div>

            <div className="lf-frame-wrap">
              {previewLoading ? (
                <div className="lf-empty">Loading official form...</div>
              ) : (
                <iframe
                  id="leave-form-preview-frame"
                  title="Leave Request Form Preview"
                  className="lf-frame"
                  srcDoc={previewHtml}
                />
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
