import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
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
    <article className={`issue-card tone-${issueTone(item.issueType)}`}>
      <div className="issue-card-top">
        <div>
          <strong>{item.name}</strong>
          <p>
            {item.gasId} • {item.project} / {item.package}
          </p>
        </div>
        <span className={`soft-badge ${issueTone(item.issueType)}`}>{item.issueType}</span>
      </div>

      <div className="issue-meta-grid">
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

      {item.note ? <p className="muted small">{item.note}</p> : null}

      <div className="inline-actions wrap-actions">
        <button type="button" className="ghost" onClick={() => onQuickFix(item, "Present")}>
          Mark Present
        </button>
        <button type="button" onClick={() => onQuickFix(item, "Annual Leave")}>
          Mark Leave
        </button>
      </div>
    </article>
  );
}

function IssueTable({ rows, onQuickFix }) {
  return (
    <div className="table-wrap compact-table">
      <table>
        <thead>
          <tr>
            <th>Name</th>
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
                <td>{row.name}</td>
                <td>{row.gasId}</td>
                <td>{row.date}</td>
                <td>{row.issueType}</td>
                <td>{row.status}</td>
                <td>{row.hours}</td>
                <td>{row.project}</td>
                <td>{row.package}</td>
                <td>
                  <div className="inline-actions wrap-actions">
                    <button type="button" className="ghost" onClick={() => onQuickFix(row, "Present")}>
                      Present
                    </button>
                    <button type="button" onClick={() => onQuickFix(row, "Annual Leave")}>
                      Leave
                    </button>
                  </div>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="9" className="muted center-cell">
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

  const [month, setMonth] = useState(4);
  const [year, setYear] = useState(2026);
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
    <div className="page attendance-issues-page">
      <div className="page-header">
        <div>
          <h1>Attendance Issues</h1>
          <p>Review Absent, Single Punch, missing days, and low-hour records in one place.</p>
        </div>

        <div className="controls compact-controls wrap-actions">
          <input type="number" value={month} min="1" max="12" onChange={(e) => setMonth(Number(e.target.value))} />
          <input type="number" value={year} min="2024" max="2035" onChange={(e) => setYear(Number(e.target.value))} />
          <button type="button" onClick={exportIssues}>
            Export Issues
          </button>
        </div>
      </div>

      {summary ? (
        <section className="stats-grid issue-stats-grid">
          <div className="stat-card">
            <span>Absent</span>
            <strong>{summary.absent || 0}</strong>
          </div>
          <div className="stat-card">
            <span>Single Punch</span>
            <strong>{summary.singlePunch || 0}</strong>
          </div>
          <div className="stat-card">
            <span>Missing Record</span>
            <strong>{summary.missingRecord || 0}</strong>
          </div>
          <div className="stat-card">
            <span>Low Hours</span>
            <strong>{summary.lowHours || 0}</strong>
          </div>
        </section>
      ) : null}

      <section className="card">
        <div className="page-header compact">
          <div>
            <h2>Filters</h2>
            <p>Filter by issue type or search by employee or GAS ID.</p>
          </div>
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

        <div className="form-grid" style={{ marginTop: 12 }}>
          <label className="span-2">
            Search
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, GAS ID, project, package..."
            />
          </label>
        </div>
      </section>

      {message ? <div className="alert success">{message}</div> : null}
      {error ? <div className="alert error">{error}</div> : null}

      {isMobile ? (
        <section className="mobile-page">
          {filteredRows.map((row) => (
            <IssueCard key={`${row.employeeCode}-${row.date}-${row.issueType}`} item={row} onQuickFix={quickFix} />
          ))}
          {!filteredRows.length ? <div className="card muted">No attendance issues found.</div> : null}
        </section>
      ) : (
        <section className="card dashboard-section">
          <IssueTable rows={filteredRows} onQuickFix={quickFix} />
        </section>
      )}

      <section className="card">
        <p className="muted small">
          This page now reads from the current approved/uploaded attendance batch and applies quick fixes directly on the same attendance rows.
        </p>
      </section>
    </div>
  );
}
