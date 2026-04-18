import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import {
  AlertTriangle,
  Fingerprint,
  CalendarDays,
  Search,
  ShieldCheck,
  RefreshCcw,
  FileSpreadsheet,
} from "lucide-react";
import { apiFetch } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useDevice } from "../hooks_useDevice";

function issueTone(type) {
  if (type === "Absent") return "danger";
  if (type === "Single Punch") return "warning";
  if (type === "Missing Record") return "muted";
  if (type === "Low Hours") return "info";
  if (type === "Modified Record") return "success";
  return "muted";
}

function exportRowsToExcel(rows, fileName = "attendance-issues.xlsx") {
  const exportData = rows.map((row) => ({
    Name: row.name,
    "GAS ID": row.gasId,
    Date: row.date,
    Issue: row.issueType,
    Status: row.status,
    Hours: row.hours,
    Project: row.project,
    Package: row.package,
    Note: row.note,
  }));

  const ws = XLSX.utils.json_to_sheet(exportData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Issues");
  XLSX.writeFile(wb, fileName);
}

function IssueCard({ item, onQuickFix }) {
  return (
    <article className={`issue-pro-card tone-${issueTone(item.issueType)}`}>
      <div className="issue-pro-top">
        <div>
          <strong>{item.name}</strong>
          <p>
            {item.gasId} • {item.project} / {item.package}
          </p>
        </div>
        <span className={`soft-badge ${issueTone(item.issueType)}`}>{item.issueType}</span>
      </div>

      <div className="issue-pro-grid">
        <div>
          <span>Date</span>
          <strong>{item.date}</strong>
        </div>
        <div>
          <span>Status</span>
          <strong>{item.status}</strong>
        </div>
        <div>
          <span>Hours</span>
          <strong>{item.hours}</strong>
        </div>
        <div>
          <span>Source</span>
          <strong>{item.source}</strong>
        </div>
      </div>

      {item.note ? <p className="issue-pro-note">{item.note}</p> : null}

      <div className="issue-pro-actions">
        <button type="button" className="btn-soft" onClick={() => onQuickFix(item, "Present")}>
          Mark Present
        </button>
        <button type="button" className="btn-primary-strong" onClick={() => onQuickFix(item, "Annual Leave")}>
          Mark Leave
        </button>
      </div>
    </article>
  );
}

function IssueTable({ rows, onQuickFix }) {
  return (
    <div className="issues-table-shell">
      <table className="issues-table">
        <thead>
          <tr>
            <th className="sticky-col">Name</th>
            <th>GAS ID</th>
            <th>Date</th>
            <th>Issue</th>
            <th>Status</th>
            <th>Hours</th>
            <th>Project</th>
            <th>Package</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row) => (
              <tr key={`${row.employeeCode}-${row.date}-${row.issueType}`}>
                <td className="sticky-col issue-name-cell" title={row.name}>
                  {row.name}
                </td>
                <td>{row.gasId}</td>
                <td>{row.date}</td>
                <td>
                  <span className={`soft-badge ${issueTone(row.issueType)}`}>{row.issueType}</span>
                </td>
                <td>{row.status}</td>
                <td>{row.hours}</td>
                <td>{row.project}</td>
                <td>{row.package}</td>
                <td>
                  <div className="inline-actions wrap-actions">
                    <button type="button" className="btn-soft small-btn" onClick={() => onQuickFix(row, "Present")}>
                      Present
                    </button>
                    <button type="button" className="btn-primary-strong small-btn" onClick={() => onQuickFix(row, "Annual Leave")}>
                      Leave
                    </button>
                  </div>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="9" className="issues-empty-cell">
                No attendance issues found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function AttendanceIssuesPage() {
  const { user } = useAuth();
  const { isMobile } = useDevice();

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [typeFilter, setTypeFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [batchId, setBatchId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadIssues() {
    try {
      const response = await apiFetch(`/attendance/issues?month=${month}&year=${year}`);
      setRows(response.rows || []);
      setSummary(response.summary || null);
      setBatchId(response.batch?.id || "");
      setError("");
    } catch (err) {
      setRows([]);
      setSummary(null);
      setBatchId("");
      setError(err.message || "Failed to load attendance issues");
    }
  }

  useEffect(() => {
    loadIssues();
  }, [month, year]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const typeOk = typeFilter === "All" ? true : row.issueType === typeFilter;
      const term = search.trim().toLowerCase();
      const searchOk = !term
        ? true
        : [row.name, row.gasId, row.project, row.package, row.issueType]
            .join(" ")
            .toLowerCase()
            .includes(term);

      return typeOk && searchOk;
    });
  }, [rows, typeFilter, search]);

  async function exportIssues() {
    exportRowsToExcel(filteredRows, `attendance-issues-${year}-${month}.xlsx`);
  }

  async function quickFix(row, newStatus) {
    try {
      await apiFetch("/attendance/direct-update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: {
          batchId,
          month,
          year,
          employeeCode: row.employeeCode,
          employeeName: row.name,
          date: row.date,
          newStatus,
          hours: newStatus === "Present" ? String(row.hours || 8) : "",
          actorName: user?.name || user?.username || "HR Manager",
          note: `Quick fix from Attendance Issues (${row.issueType})`,
        },
      });

      setMessage(`Updated ${row.name} on ${row.date} → ${newStatus}`);
      setError("");
      await loadIssues();
    } catch (err) {
      setError(err.message || "Failed to update attendance row");
    }
  }

  const issueTypes = ["All", "Absent", "Single Punch", "Missing Record", "Low Hours", "Modified Record"];

  return (
    <div className="page-stack attendance-issues-pro-page">
      <style>{`
        .attendance-issues-pro-page {
          display: grid;
          gap: 20px;
          width: 100%;
          max-width: 100%;
        }

        .attendance-issues-pro-page .hero-shell {
          display: grid;
          grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr);
          gap: 18px;
          width: 100%;
        }

        .attendance-issues-pro-page .hero-main,
        .attendance-issues-pro-page .hero-side,
        .attendance-issues-pro-page .control-card,
        .attendance-issues-pro-page .table-card,
        .attendance-issues-pro-page .footer-card {
          border-radius: 28px;
          border: 1px solid rgba(226, 232, 240, 0.95);
          background: rgba(255, 255, 255, 0.96);
          box-shadow: 0 16px 40px rgba(15, 23, 42, 0.06);
          backdrop-filter: blur(10px);
          min-width: 0;
        }

        .attendance-issues-pro-page .hero-main {
          padding: 28px;
          background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%);
          color: #fff;
          border: none;
        }

        .attendance-issues-pro-page .hero-badge {
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

        .attendance-issues-pro-page .hero-main h1 {
          margin: 0 0 10px 0;
          font-size: 2.4rem;
          font-weight: 900;
          letter-spacing: -0.03em;
          color: #fff;
        }

        .attendance-issues-pro-page .hero-main p {
          margin: 0;
          max-width: 720px;
          color: rgba(255, 255, 255, 0.84);
          line-height: 1.7;
          font-size: 0.98rem;
        }

        .attendance-issues-pro-page .hero-kpis {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
          margin-top: 20px;
        }

        .attendance-issues-pro-page .hero-kpi {
          border-radius: 20px;
          padding: 16px;
          background: rgba(255, 255, 255, 0.12);
          border: 1px solid rgba(255, 255, 255, 0.14);
          min-width: 0;
        }

        .attendance-issues-pro-page .hero-kpi .label {
          display: block;
          color: rgba(255, 255, 255, 0.78);
          font-size: 0.82rem;
          font-weight: 700;
          margin-bottom: 8px;
        }

        .attendance-issues-pro-page .hero-kpi .value {
          font-size: 1.6rem;
          font-weight: 900;
          color: #fff;
          line-height: 1;
        }

        .attendance-issues-pro-page .hero-side {
          padding: 24px;
          display: grid;
          gap: 14px;
          align-content: start;
        }

        .attendance-issues-pro-page .side-title {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 1rem;
          font-weight: 900;
          color: #0f172a;
        }

        .attendance-issues-pro-page .side-stat-list {
          display: grid;
          gap: 12px;
        }

        .attendance-issues-pro-page .side-stat {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          border-radius: 16px;
          padding: 14px 16px;
          background: #f8fafc;
          border: 1px solid #edf2f7;
          min-width: 0;
        }

        .attendance-issues-pro-page .side-stat span {
          color: #64748b;
          font-size: 0.9rem;
          font-weight: 700;
        }

        .attendance-issues-pro-page .side-stat strong {
          color: #0f172a;
          font-size: 1.02rem;
          font-weight: 900;
          text-align: right;
          word-break: break-word;
        }

        .attendance-issues-pro-page .control-card,
        .attendance-issues-pro-page .table-card,
        .attendance-issues-pro-page .footer-card {
          padding: 24px;
        }

        .attendance-issues-pro-page .card-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 14px;
          flex-wrap: wrap;
          margin-bottom: 18px;
        }

        .attendance-issues-pro-page .card-head h2,
        .attendance-issues-pro-page .card-head h3 {
          margin: 0 0 6px 0;
          font-size: 1.2rem;
          font-weight: 900;
          color: #0f172a;
        }

        .attendance-issues-pro-page .card-head p {
          margin: 0;
          color: #64748b;
          font-size: 0.92rem;
        }

        .attendance-issues-pro-page .status-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 34px;
          padding: 0 12px;
          border-radius: 999px;
          background: #eff6ff;
          color: #1d4ed8;
          font-size: 0.82rem;
          font-weight: 900;
        }

        .attendance-issues-pro-page .filter-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
        }

        .attendance-issues-pro-page .field-pro {
          display: flex;
          flex-direction: column;
          gap: 8px;
          min-width: 0;
        }

        .attendance-issues-pro-page .field-pro.span-3 {
          grid-column: span 3;
        }

        .attendance-issues-pro-page .field-pro label {
          font-size: 0.88rem;
          font-weight: 800;
          color: #334155;
        }

        .attendance-issues-pro-page .field-pro input,
        .attendance-issues-pro-page .field-pro select {
          min-height: 50px;
          border-radius: 16px;
          border: 1px solid #dbe2ea;
          padding: 0 14px;
          background: #fff;
          color: #0f172a;
          font-size: 0.95rem;
          min-width: 0;
          width: 100%;
        }

        .attendance-issues-pro-page .field-pro input:focus,
        .attendance-issues-pro-page .field-pro select:focus {
          outline: none;
          border-color: #2563eb;
          box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.08);
        }

        .attendance-issues-pro-page .filter-chip-row {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          margin-bottom: 14px;
        }

        .attendance-issues-pro-page .chip {
          min-height: 38px;
          padding: 0 14px;
          border-radius: 999px;
          border: 1px solid #dbe2ea;
          background: #fff;
          color: #334155;
          font-size: 0.84rem;
          font-weight: 900;
          cursor: pointer;
        }

        .attendance-issues-pro-page .chip.active {
          background: #e8f0ff;
          color: #1d4ed8;
          border-color: #bfdbfe;
        }

        .attendance-issues-pro-page .action-row,
        .attendance-issues-pro-page .inline-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .attendance-issues-pro-page .btn-primary-strong,
        .attendance-issues-pro-page .btn-soft {
          min-height: 46px;
          border: none;
          border-radius: 16px;
          padding: 0 16px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-size: 0.9rem;
          font-weight: 900;
          cursor: pointer;
          transition: transform 0.18s ease, opacity 0.2s ease;
        }

        .attendance-issues-pro-page .small-btn {
          min-height: 36px;
          padding: 0 12px;
          border-radius: 12px;
          font-size: 0.82rem;
        }

        .attendance-issues-pro-page .btn-primary-strong:hover,
        .attendance-issues-pro-page .btn-soft:hover {
          transform: translateY(-1px);
        }

        .attendance-issues-pro-page .btn-primary-strong {
          background: linear-gradient(135deg, #2563eb, #1d4ed8);
          color: #fff;
          box-shadow: 0 12px 28px rgba(37, 99, 235, 0.22);
        }

        .attendance-issues-pro-page .btn-soft {
          background: #eef4ff;
          color: #1d4ed8;
        }

        .attendance-issues-pro-page .soft-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: fit-content;
          min-height: 32px;
          padding: 0 12px;
          border-radius: 999px;
          font-size: 0.78rem;
          font-weight: 900;
        }

        .attendance-issues-pro-page .soft-badge.danger {
          background: #fee2e2;
          color: #991b1b;
        }

        .attendance-issues-pro-page .soft-badge.warning {
          background: #fef3c7;
          color: #92400e;
        }

        .attendance-issues-pro-page .soft-badge.muted {
          background: #e5e7eb;
          color: #374151;
        }

        .attendance-issues-pro-page .soft-badge.info {
          background: #dbeafe;
          color: #1d4ed8;
        }

        .attendance-issues-pro-page .soft-badge.success {
          background: #dcfce7;
          color: #166534;
        }

        .attendance-issues-pro-page .alert-pro {
          border-radius: 18px;
          padding: 14px 16px;
          font-weight: 800;
          font-size: 0.94rem;
        }

        .attendance-issues-pro-page .alert-pro.success {
          background: #ecfdf3;
          color: #047857;
          border: 1px solid #a7f3d0;
        }

        .attendance-issues-pro-page .alert-pro.error {
          background: #fff1f2;
          color: #be123c;
          border: 1px solid #fecdd3;
        }

        .attendance-issues-pro-page .issues-table-shell {
          width: 100%;
          max-width: 100%;
          overflow-x: auto;
          overflow-y: auto;
          border-radius: 22px;
          border: 1px solid #e9eef5;
          background: #fff;
          position: relative;
        }

        .attendance-issues-pro-page .issues-table {
          width: max-content;
          min-width: 1200px;
          border-collapse: separate;
          border-spacing: 0;
          table-layout: auto;
        }

        .attendance-issues-pro-page .issues-table thead th {
          position: sticky;
          top: 0;
          z-index: 2;
          background: #f8fafc;
          color: #334155;
          font-size: 0.82rem;
          font-weight: 900;
          white-space: nowrap;
          border-bottom: 1px solid #e5e7eb;
          padding: 14px 12px;
          text-align: center;
        }

        .attendance-issues-pro-page .issues-table tbody td {
          padding: 12px 12px;
          border-bottom: 1px solid #eef2f7;
          border-right: 1px solid #f1f5f9;
          text-align: center;
          vertical-align: middle;
          background: #fff;
          white-space: nowrap;
        }

        .attendance-issues-pro-page .issues-table tbody tr:hover td {
          background: #fbfdff;
        }

        .attendance-issues-pro-page .sticky-col {
          position: sticky;
          left: 0;
          z-index: 2;
          background: #fff;
          box-shadow: 8px 0 12px -10px rgba(15, 23, 42, 0.14);
        }

        .attendance-issues-pro-page .issues-table thead .sticky-col {
          z-index: 3;
          background: #f8fafc;
        }

        .attendance-issues-pro-page .issue-name-cell {
          min-width: 280px;
          max-width: 280px;
          width: 280px;
          text-align: left !important;
          font-weight: 900;
          color: #0f172a;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .attendance-issues-pro-page .issues-empty-cell {
          text-align: center;
          padding: 24px;
          color: #64748b;
          font-weight: 700;
        }

        .attendance-issues-pro-page .issue-mobile-grid {
          display: grid;
          gap: 14px;
        }

        .attendance-issues-pro-page .issue-pro-card {
          border-radius: 22px;
          border: 1px solid #e9eef5;
          background: #fff;
          padding: 18px;
          box-shadow: 0 12px 28px rgba(15, 23, 42, 0.05);
        }

        .attendance-issues-pro-page .issue-pro-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 14px;
        }

        .attendance-issues-pro-page .issue-pro-top strong {
          display: block;
          color: #0f172a;
          font-size: 1rem;
          font-weight: 900;
          margin-bottom: 4px;
        }

        .attendance-issues-pro-page .issue-pro-top p {
          margin: 0;
          color: #64748b;
          font-size: 0.88rem;
          line-height: 1.5;
        }

        .attendance-issues-pro-page .issue-pro-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          margin-bottom: 12px;
        }

        .attendance-issues-pro-page .issue-pro-grid div {
          border-radius: 14px;
          background: #f8fafc;
          border: 1px solid #edf2f7;
          padding: 12px;
        }

        .attendance-issues-pro-page .issue-pro-grid span {
          display: block;
          color: #64748b;
          font-size: 0.78rem;
          font-weight: 700;
          margin-bottom: 6px;
        }

        .attendance-issues-pro-page .issue-pro-grid strong {
          color: #0f172a;
          font-size: 0.95rem;
          font-weight: 900;
          word-break: break-word;
        }

        .attendance-issues-pro-page .issue-pro-note {
          margin: 0 0 12px 0;
          background: #f8fafc;
          border: 1px solid #edf2f7;
          border-radius: 14px;
          padding: 12px 14px;
          color: #334155;
          line-height: 1.6;
          font-size: 0.9rem;
        }

        .attendance-issues-pro-page .issue-pro-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .attendance-issues-pro-page .footer-card p {
          margin: 0;
          color: #64748b;
          font-size: 0.92rem;
          line-height: 1.7;
          font-weight: 700;
        }

        @media (max-width: 1200px) {
          .attendance-issues-pro-page .hero-shell {
            grid-template-columns: 1fr;
          }

          .attendance-issues-pro-page .hero-kpis {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 768px) {
          .attendance-issues-pro-page .hero-main h1 {
            font-size: 2rem;
          }

          .attendance-issues-pro-page .hero-kpis,
          .attendance-issues-pro-page .filter-grid,
          .attendance-issues-pro-page .issue-pro-grid {
            grid-template-columns: 1fr;
          }

          .attendance-issues-pro-page .field-pro.span-3 {
            grid-column: span 1;
          }
        }
      `}</style>

      <section className="hero-shell">
        <div className="hero-main">
          <div className="hero-badge">
            <ShieldCheck size={14} />
            Attendance Issues Center
          </div>

          <h1>Attendance Issues</h1>
          <p>
            Review absent records, missing punch cases, missing days, low-hour entries,
            and modified attendance rows in one place with quick correction actions.
          </p>

          <div className="hero-kpis">
            <div className="hero-kpi">
              <span className="label">Absent</span>
              <strong className="value">{summary?.absent || 0}</strong>
            </div>
            <div className="hero-kpi">
              <span className="label">Single Punch</span>
              <strong className="value">{summary?.singlePunch || 0}</strong>
            </div>
            <div className="hero-kpi">
              <span className="label">Missing Record</span>
              <strong className="value">{summary?.missingRecord || 0}</strong>
            </div>
            <div className="hero-kpi">
              <span className="label">Low Hours</span>
              <strong className="value">{summary?.lowHours || 0}</strong>
            </div>
          </div>
        </div>

        <div className="hero-side">
          <div className="side-title">
            <CalendarDays size={16} />
            Monthly Snapshot
          </div>

          <div className="side-stat-list">
            <div className="side-stat">
              <span>Month</span>
              <strong>{month}</strong>
            </div>
            <div className="side-stat">
              <span>Year</span>
              <strong>{year}</strong>
            </div>
            <div className="side-stat">
              <span>Batch ID</span>
              <strong>{batchId || "-"}</strong>
            </div>
            <div className="side-stat">
              <span>Visible Rows</span>
              <strong>{filteredRows.length}</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="control-card">
        <div className="card-head">
          <div>
            <h2>Filters & Export</h2>
            <p>Filter by issue type, search employees, and export the visible issues list.</p>
          </div>
          <span className="status-pill">Issues Review</span>
        </div>

        <div className="filter-chip-row">
          {issueTypes.map((type) => (
            <button
              key={type}
              type="button"
              className={`chip ${typeFilter === type ? "active" : ""}`}
              onClick={() => setTypeFilter(type)}
            >
              {type}
            </button>
          ))}
        </div>

        <div className="filter-grid">
          <div className="field-pro">
            <label>Month</label>
            <input
              type="number"
              value={month}
              min="1"
              max="12"
              onChange={(e) => setMonth(Number(e.target.value))}
            />
          </div>

          <div className="field-pro">
            <label>Year</label>
            <input
              type="number"
              value={year}
              min="2024"
              max="2035"
              onChange={(e) => setYear(Number(e.target.value))}
            />
          </div>

          <div className="field-pro span-3">
            <label>Search</label>
            <div style={{ position: "relative" }}>
              <Search
                size={16}
                style={{
                  position: "absolute",
                  left: 14,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#64748b",
                }}
              />
              <input
                style={{ paddingLeft: 40, width: "100%" }}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name, GAS ID, project, package..."
              />
            </div>
          </div>
        </div>

        <div className="action-row" style={{ marginTop: 16 }}>
          <button type="button" className="btn-soft" onClick={loadIssues}>
            <RefreshCcw size={14} />
            Reload Issues
          </button>

          <button type="button" className="btn-primary-strong" onClick={exportIssues}>
            <FileSpreadsheet size={14} />
            Export Issues
          </button>
        </div>
      </section>

      {message ? <div className="alert-pro success">{message}</div> : null}
      {error ? <div className="alert-pro error">{error}</div> : null}

      {isMobile ? (
        <section className="issue-mobile-grid">
          {filteredRows.map((row) => (
            <IssueCard key={`${row.employeeCode}-${row.date}-${row.issueType}`} item={row} onQuickFix={quickFix} />
          ))}
          {!filteredRows.length ? (
            <div className="footer-card">
              <p>No attendance issues found.</p>
            </div>
          ) : null}
        </section>
      ) : (
        <section className="table-card">
          <div className="card-head">
            <div>
              <h3>Issues Table</h3>
              <p>Quickly review and fix attendance issues directly from the current month batch.</p>
            </div>
          </div>

          <IssueTable rows={filteredRows} onQuickFix={quickFix} />
        </section>
      )}

      <section className="footer-card">
        <p>
          This page reads from the current attendance batch and applies quick fixes directly on the same attendance rows.
        </p>
      </section>
    </div>
  );
}