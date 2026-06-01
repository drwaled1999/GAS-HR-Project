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

function StatCard({ label, value, icon: Icon }) {
  return (
    <div className="lf-stat-card">
      <div>
        <p>{label}</p>
        <strong>{value ?? 0}</strong>
      </div>
      <span>
        <Icon size={20} />
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
      setPreviewHtml(`<div style="font-family:Arial;padding:24px;color:#b91c1c;">${err.message || "Failed to load form"}</div>`);
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
          padding: 22px;
          color: #0f172a;
        }

        .lf-hero {
          border: 1px solid rgba(226, 232, 240, 0.9);
          border-radius: 28px;
          padding: 24px;
          background:
            radial-gradient(circle at top left, rgba(37, 99, 235, 0.16), transparent 34%),
            linear-gradient(135deg, rgba(255,255,255,0.98), rgba(248,250,252,0.92));
          box-shadow: 0 22px 60px rgba(15, 23, 42, 0.08);
          display: flex;
          justify-content: space-between;
          gap: 18px;
          align-items: flex-start;
          margin-bottom: 18px;
        }

        .lf-hero h1 {
          margin: 0;
          font-size: clamp(1.6rem, 3vw, 2.45rem);
          letter-spacing: -0.04em;
        }

        .lf-hero p {
          margin: 8px 0 0;
          color: #64748b;
          font-weight: 700;
          max-width: 720px;
        }

        .lf-hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 9px 12px;
          border-radius: 999px;
          background: rgba(37,99,235,0.1);
          color: #1d4ed8;
          font-weight: 900;
          border: 1px solid rgba(37,99,235,0.18);
          white-space: nowrap;
        }

        .lf-stats {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 18px;
        }

        .lf-stat-card {
          border: 1px solid rgba(226,232,240,0.95);
          border-radius: 24px;
          padding: 18px;
          background: rgba(255,255,255,0.96);
          box-shadow: 0 16px 40px rgba(15, 23, 42, 0.06);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .lf-stat-card p { margin: 0 0 6px; color: #64748b; font-weight: 900; font-size: .78rem; }
        .lf-stat-card strong { font-size: 1.9rem; line-height: 1; letter-spacing: -0.04em; }
        .lf-stat-card span { width: 44px; height: 44px; display: grid; place-items: center; border-radius: 16px; background: #eff6ff; color: #2563eb; }

        .lf-panel {
          border: 1px solid rgba(226,232,240,0.95);
          border-radius: 28px;
          background: rgba(255,255,255,0.96);
          box-shadow: 0 18px 50px rgba(15, 23, 42, 0.07);
          overflow: hidden;
        }

        .lf-toolbar {
          padding: 18px;
          display: grid;
          grid-template-columns: 1.4fr repeat(5, minmax(120px, 1fr)) auto auto;
          gap: 10px;
          border-bottom: 1px solid #e2e8f0;
          align-items: center;
        }

        .lf-input, .lf-select {
          width: 100%;
          min-height: 42px;
          border: 1px solid #dbe3ef;
          border-radius: 15px;
          padding: 0 12px;
          font-weight: 800;
          color: #0f172a;
          background: #fff;
          outline: none;
        }

        .lf-search-wrap { position: relative; }
        .lf-search-wrap svg { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #94a3b8; }
        .lf-search-wrap .lf-input { padding-left: 40px; }

        .lf-btn {
          min-height: 42px;
          border: 0;
          border-radius: 15px;
          padding: 0 14px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-weight: 950;
          cursor: pointer;
          transition: 0.18s ease;
          white-space: nowrap;
        }

        .lf-btn-primary { background: #2563eb; color: #fff; box-shadow: 0 12px 24px rgba(37,99,235,0.22); }
        .lf-btn-soft { background: #f1f5f9; color: #334155; }
        .lf-btn-danger { background: #fee2e2; color: #b91c1c; }
        .lf-btn:hover { transform: translateY(-1px); }
        .lf-btn:disabled { opacity: .6; cursor: not-allowed; transform: none; }

        .lf-table-wrap { overflow-x: auto; }
        .lf-table { width: 100%; border-collapse: separate; border-spacing: 0; min-width: 1050px; }
        .lf-table th {
          text-align: left;
          padding: 13px 16px;
          color: #64748b;
          background: #f8fafc;
          font-size: .76rem;
          text-transform: uppercase;
          letter-spacing: .04em;
        }
        .lf-table td {
          padding: 14px 16px;
          border-top: 1px solid #edf2f7;
          font-weight: 800;
          color: #1e293b;
          vertical-align: middle;
        }
        .lf-employee strong { display: block; color: #0f172a; }
        .lf-employee span { display: block; color: #64748b; font-size: .78rem; margin-top: 3px; }
        .lf-chip { display: inline-flex; padding: 6px 10px; border-radius: 999px; background: #eff6ff; color: #1d4ed8; font-size: .76rem; font-weight: 950; }
        .lf-status { background: #dcfce7; color: #166534; }
        .lf-actions { display: flex; gap: 8px; align-items: center; }
        .lf-empty { padding: 34px; text-align: center; color: #64748b; font-weight: 900; }
        .lf-error { margin: 0 18px 18px; padding: 14px; border-radius: 18px; background: #fee2e2; color: #991b1b; font-weight: 900; }

        .lf-modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 120;
          background: rgba(15,23,42,0.58);
          backdrop-filter: blur(10px);
          display: grid;
          place-items: center;
          padding: 18px;
        }

        .lf-modal {
          width: min(1180px, 100%);
          height: min(760px, 94vh);
          border-radius: 28px;
          background: #fff;
          overflow: hidden;
          box-shadow: 0 30px 90px rgba(0,0,0,0.28);
          display: flex;
          flex-direction: column;
        }

        .lf-modal-head {
          padding: 14px 18px;
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .lf-modal-head strong { display: block; font-size: 1rem; }
        .lf-modal-head span { display: block; font-size: .8rem; color: #64748b; font-weight: 800; margin-top: 2px; }
        .lf-modal-actions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
        .lf-frame-wrap { flex: 1; background: #e5e7eb; padding: 12px; }
        .lf-frame { width: 100%; height: 100%; border: 0; background: #fff; border-radius: 16px; }

        html.dark .leave-forms-page { color: #e5e7eb; }
        html.dark .lf-hero, html.dark .lf-panel, html.dark .lf-stat-card, html.dark .lf-modal { background: #111827; border-color: #24324d; }
        html.dark .lf-hero p, html.dark .lf-stat-card p, html.dark .lf-table th, html.dark .lf-employee span { color: #9ca3af; }
        html.dark .lf-input, html.dark .lf-select { background: #0f172a; border-color: #334155; color: #e5e7eb; }
        html.dark .lf-table th { background: #0f172a; }
        html.dark .lf-table td { border-color: #24324d; color: #e5e7eb; }
        html.dark .lf-employee strong { color: #fff; }
        html.dark .lf-btn-soft { background: #1f2937; color: #e5e7eb; }

        @media (max-width: 1180px) {
          .lf-toolbar { grid-template-columns: 1fr 1fr; }
        }
        @media (max-width: 760px) {
          .leave-forms-page { padding: 14px 12px 92px; }
          .lf-hero { flex-direction: column; border-radius: 22px; padding: 18px; }
          .lf-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .lf-toolbar { grid-template-columns: 1fr; }
          .lf-modal { height: 94vh; border-radius: 20px; }
          .lf-modal-head { align-items: flex-start; flex-direction: column; }
          .lf-modal-actions { width: 100%; justify-content: stretch; }
          .lf-modal-actions .lf-btn { flex: 1; }
        }
      `}</style>

      <section className="lf-hero">
        <div>
          <h1>Leave Forms</h1>
          <p>
            Official GAS leave request forms generated from approved annual, emergency, sick, and unpaid leave requests.
          </p>
        </div>
        <div className="lf-hero-badge">
          <FileText size={18} /> Approved Requests Only
        </div>
      </section>

      <section className="lf-stats">
        <StatCard label="Total Forms" value={stats.total} icon={FileText} />
        <StatCard label="Annual Leave" value={stats.annual} icon={CalendarDays} />
        <StatCard label="Emergency Leave" value={stats.emergency} icon={Filter} />
        <StatCard label="Sick Leave" value={stats.sick} icon={FileText} />
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

          <select className="lf-select" value={filters.type} onChange={(event) => updateFilter("type", event.target.value)}>
            {leaveTypes.map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </select>

          <select className="lf-select" value={filters.month} onChange={(event) => updateFilter("month", event.target.value)}>
            {months.map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </select>

          <select className="lf-select" value={filters.year} onChange={(event) => updateFilter("year", event.target.value)}>
            {years.map((year) => (
              <option key={year || "all"} value={year}>{year || "All Years"}</option>
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
                <tr><td colSpan="9" className="lf-empty">Loading leave forms...</td></tr>
              ) : forms.length === 0 ? (
                <tr><td colSpan="9" className="lf-empty">No approved leave forms found.</td></tr>
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
                    <td><span className="lf-chip">{form.leaveTypeLabel || form.type}</span></td>
                    <td>{formatShortDate(form.startDate)}</td>
                    <td>{formatShortDate(form.endDate)}</td>
                    <td>{form.daysCount || 0}</td>
                    <td><span className="lf-chip lf-status">Approved</span></td>
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
                <span>GAS ID: {selectedForm.employeeGasId || "-"} · {selectedForm.leaveTypeLabel || selectedForm.type}</span>
              </div>
              <div className="lf-modal-actions">
                <button className="lf-btn lf-btn-soft" type="button" onClick={printPreview} disabled={!previewHtml || previewLoading}>
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
