import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  FileSignature,
  Filter,
  Plus,
  RefreshCw,
  Search,
  Send,
  Users,
} from "lucide-react";
import { apiFetch } from "../services/api";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function currentYearEnd() {
  const y = new Date().getFullYear();
  return `${y}-12-31`;
}

function uniqueValues(rows, key) {
  return [
    ...new Set(
      rows
        .map((row) => String(row?.[key] || "").trim())
        .filter(Boolean)
    ),
  ].sort();
}

export default function AssignReviewsPage() {
  const [templates, setTemplates] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [keyword, setKeyword] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [packageFilter, setPackageFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [form, setForm] = useState({
    templateId: "",
    periodStart: today(),
    periodEnd: currentYearEnd(),
    assignmentMode: "selected",
  });

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const [templatesRes, usersRes, reviewsRes] = await Promise.all([
        apiFetch("/performance/templates"),
        apiFetch("/users"),
        apiFetch("/performance/reviews"),
      ]);

      const activeTemplates = (templatesRes.templates || []).filter(
        (t) => t.status === "active"
      );

      const userEmployees = usersRes.employees || usersRes.users || [];

      setTemplates(activeTemplates);
      setEmployees(userEmployees);
      setReviews(reviewsRes.reviews || []);

      if (!form.templateId && activeTemplates[0]) {
        setForm((p) => ({ ...p, templateId: activeTemplates[0].id }));
      }
    } catch (err) {
      setError(err.message || "Failed to load assignment data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function showNotice(message) {
    setNotice(message);
    setTimeout(() => setNotice(""), 3500);
  }

  const projects = useMemo(() => uniqueValues(employees, "projectName"), [employees]);

  const packages = useMemo(() => {
    return uniqueValues(
      projectFilter
        ? employees.filter(
            (e) =>
              String(e.projectName || "").trim().toLowerCase() ===
              projectFilter.trim().toLowerCase()
          )
        : employees,
      "packageName"
    );
  }, [employees, projectFilter]);

  const filteredEmployees = useMemo(() => {
    const q = keyword.trim().toLowerCase();

    return employees.filter((emp) => {
      const projectOk = projectFilter
        ? String(emp.projectName || "").trim().toLowerCase() ===
          projectFilter.trim().toLowerCase()
        : true;

      const packageOk = packageFilter
        ? String(emp.packageName || "").trim().toLowerCase() ===
          packageFilter.trim().toLowerCase()
        : true;

      const keywordOk = q
        ? [
            emp.name,
            emp.full_name,
            emp.gasId,
            emp.gas_id,
            emp.jobTitle,
            emp.job_title,
            emp.projectName,
            emp.packageName,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(q)
        : true;

      return projectOk && packageOk && keywordOk;
    });
  }, [employees, keyword, projectFilter, packageFilter]);

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === form.templateId),
    [templates, form.templateId]
  );

  const selectedCount =
    form.assignmentMode === "selected"
      ? selectedEmployees.length
      : filteredEmployees.length;

  function toggleEmployee(employeeId) {
    setSelectedEmployees((prev) =>
      prev.includes(employeeId)
        ? prev.filter((id) => id !== employeeId)
        : [...prev, employeeId]
    );
  }

  function selectAllFiltered() {
    setSelectedEmployees(filteredEmployees.map((e) => e.employeeId || e.id).filter(Boolean));
  }

  function clearSelection() {
    setSelectedEmployees([]);
  }

  async function assignReviews(e) {
    e.preventDefault();

    if (!form.templateId) {
      setError("Please select an active template");
      return;
    }

    if (!form.periodStart || !form.periodEnd) {
      setError("Please select period start and end");
      return;
    }

    const payload = {
      templateId: form.templateId,
      periodStart: form.periodStart,
      periodEnd: form.periodEnd,
    };

    if (form.assignmentMode === "selected") {
      if (selectedEmployees.length === 0) {
        setError("Please select at least one employee");
        return;
      }
      payload.employeeIds = selectedEmployees;
    }

    if (form.assignmentMode === "project") {
      if (!projectFilter) {
        setError("Please select project first");
        return;
      }
      payload.projectName = projectFilter;
      if (packageFilter) payload.packageName = packageFilter;
    }

    try {
      setAssigning(true);
      setError("");

      const res = await apiFetch("/performance/assign", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      showNotice(`${res.count || 0} reviews assigned successfully`);
      setSelectedEmployees([]);
      await loadData();
    } catch (err) {
      setError(err.message || "Failed to assign reviews");
    } finally {
      setAssigning(false);
    }
  }

  return (
    <div className="assign-reviews-page">
      <style>{`
        .assign-reviews-page {
          color: #0f172a;
        }

        .ar-hero {
          border-radius: 30px;
          padding: 26px;
          background:
            radial-gradient(circle at 85% 15%, rgba(251,191,36,.24), transparent 28%),
            linear-gradient(135deg, #111827, #1d4ed8);
          color: white;
          box-shadow: 0 24px 60px rgba(15,23,42,.22);
          margin-bottom: 18px;
        }

        .ar-hero-content {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
        }

        .ar-kicker {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 7px 12px;
          border-radius: 999px;
          background: rgba(255,255,255,.13);
          border: 1px solid rgba(255,255,255,.18);
          font-size: 12px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .08em;
        }

        .ar-hero h1 {
          margin: 14px 0 8px;
          font-size: clamp(28px, 4vw, 42px);
          line-height: 1.05;
          font-weight: 950;
        }

        .ar-hero p {
          margin: 0;
          max-width: 760px;
          color: rgba(255,255,255,.78);
          line-height: 1.7;
        }

        .ar-btn {
          border: 0;
          border-radius: 16px;
          padding: 11px 15px;
          font-weight: 900;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: .2s ease;
          white-space: nowrap;
        }

        .ar-btn:hover {
          transform: translateY(-1px);
        }

        .ar-btn.primary {
          background: #2563eb;
          color: white;
        }

        .ar-btn.white {
          background: white;
          color: #0f172a;
        }

        .ar-btn.soft {
          background: #f1f5f9;
          color: #0f172a;
        }

        .ar-btn.success {
          background: #16a34a;
          color: white;
        }

        .ar-btn:disabled {
          opacity: .6;
          cursor: not-allowed;
          transform: none;
        }

        .ar-layout {
          display: grid;
          grid-template-columns: 420px minmax(0, 1fr);
          gap: 18px;
        }

        .ar-panel {
          background: rgba(255,255,255,.95);
          border: 1px solid rgba(148,163,184,.22);
          border-radius: 28px;
          box-shadow: 0 18px 45px rgba(15,23,42,.08);
          overflow: hidden;
        }

        .ar-panel-header {
          padding: 18px 20px;
          border-bottom: 1px solid rgba(148,163,184,.18);
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }

        .ar-panel-header h2 {
          margin: 0;
          font-size: 18px;
        }

        .ar-panel-header p {
          margin: 5px 0 0;
          color: #64748b;
          font-size: 13px;
        }

        .ar-form {
          padding: 16px;
          display: grid;
          gap: 12px;
        }

        .ar-field {
          display: grid;
          gap: 7px;
        }

        .ar-field label {
          font-size: 12px;
          color: #475569;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .04em;
        }

        .ar-input,
        .ar-select {
          width: 100%;
          border: 1px solid rgba(148,163,184,.35);
          background: white;
          border-radius: 15px;
          padding: 11px 12px;
          outline: none;
          color: #0f172a;
        }

        .ar-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        .ar-mode-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        .ar-mode {
          border: 1px solid rgba(148,163,184,.25);
          border-radius: 18px;
          padding: 14px;
          background: #f8fafc;
          cursor: pointer;
          display: flex;
          align-items: flex-start;
          gap: 10px;
          transition: .2s ease;
        }

        .ar-mode.active {
          border-color: rgba(37,99,235,.5);
          background: #eff6ff;
        }

        .ar-mode strong {
          display: block;
          font-size: 13px;
        }

        .ar-mode span {
          display: block;
          color: #64748b;
          font-size: 12px;
          margin-top: 3px;
          line-height: 1.5;
        }

        .ar-template-card {
          padding: 14px;
          border-radius: 20px;
          background: #f8fafc;
          border: 1px solid rgba(148,163,184,.18);
          display: grid;
          gap: 8px;
        }

        .ar-template-card strong {
          color: #0f172a;
        }

        .ar-template-card span {
          color: #64748b;
          font-size: 12px;
        }

        .ar-pill {
          display: inline-flex;
          align-items: center;
          padding: 6px 9px;
          border-radius: 999px;
          background: #e2e8f0;
          color: #334155;
          font-size: 11px;
          font-weight: 900;
          width: fit-content;
        }

        .ar-summary-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 18px;
        }

        .ar-stat {
          border-radius: 22px;
          background: white;
          border: 1px solid rgba(148,163,184,.22);
          box-shadow: 0 18px 45px rgba(15,23,42,.08);
          padding: 18px;
          display: flex;
          gap: 12px;
          align-items: center;
        }

        .ar-stat-icon {
          width: 44px;
          height: 44px;
          border-radius: 16px;
          display: grid;
          place-items: center;
          background: #eff6ff;
          color: #2563eb;
        }

        .ar-stat p {
          margin: 0;
          color: #64748b;
          font-size: 12px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .04em;
        }

        .ar-stat strong {
          display: block;
          margin-top: 4px;
          font-size: 24px;
          color: #0f172a;
        }

        .ar-tools {
          display: grid;
          grid-template-columns: minmax(240px, 1fr) 220px 220px auto auto;
          gap: 10px;
          padding: 14px;
          border-bottom: 1px solid rgba(148,163,184,.15);
        }

        .ar-search-wrap {
          position: relative;
        }

        .ar-search-wrap svg {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: #64748b;
        }

        .ar-search {
          width: 100%;
          height: 44px;
          border-radius: 15px;
          border: 1px solid rgba(148,163,184,.35);
          padding: 0 12px 0 40px;
          outline: none;
        }

        .ar-table-wrap {
          overflow-x: auto;
        }

        .ar-table {
          width: 100%;
          border-collapse: collapse;
          min-width: 820px;
        }

        .ar-table th {
          text-align: left;
          padding: 14px 18px;
          font-size: 12px;
          color: #64748b;
          background: #f8fafc;
          text-transform: uppercase;
          letter-spacing: .05em;
        }

        .ar-table td {
          padding: 15px 18px;
          border-top: 1px solid rgba(148,163,184,.15);
        }

        .ar-emp strong {
          display: block;
          font-size: 14px;
          color: #0f172a;
        }

        .ar-emp span {
          display: block;
          color: #64748b;
          font-size: 12px;
          margin-top: 3px;
        }

        .ar-checkbox {
          width: 18px;
          height: 18px;
          accent-color: #2563eb;
        }

        .ar-error,
        .ar-notice,
        .ar-empty,
        .ar-loading {
          padding: 20px;
          text-align: center;
          color: #64748b;
        }

        .ar-error {
          margin-bottom: 14px;
          border-radius: 18px;
          background: #fef2f2;
          color: #b91c1c;
          font-weight: 800;
        }

        .ar-notice {
          margin-bottom: 14px;
          border-radius: 18px;
          background: #ecfdf5;
          color: #047857;
          font-weight: 800;
        }

        @media (max-width: 1180px) {
          .ar-layout {
            grid-template-columns: 1fr;
          }

          .ar-tools {
            grid-template-columns: 1fr 1fr;
          }

          .ar-summary-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 720px) {
          .ar-hero {
            border-radius: 22px;
            padding: 20px;
          }

          .ar-hero-content {
            flex-direction: column;
            align-items: flex-start;
          }

          .ar-row,
          .ar-mode-grid,
          .ar-tools {
            grid-template-columns: 1fr;
          }

          .ar-btn {
            width: 100%;
          }
        }
      `}</style>

      <section className="ar-hero">
        <div className="ar-hero-content">
          <div>
            <div className="ar-kicker">
              <ClipboardCheck size={16} />
              Assign Reviews
            </div>
            <h1>Assign Performance Reviews</h1>
            <p>
              Select an active template, define the review period, and assign it
              to specific employees or to a complete project/package scope.
            </p>
          </div>

          <button className="ar-btn white" onClick={loadData}>
            <RefreshCw size={17} />
            Refresh
          </button>
        </div>
      </section>

      {error ? <div className="ar-error">{error}</div> : null}
      {notice ? <div className="ar-notice">{notice}</div> : null}

      <section className="ar-summary-grid">
        <div className="ar-stat">
          <div className="ar-stat-icon">
            <FileSignature size={20} />
          </div>
          <div>
            <p>Active Templates</p>
            <strong>{templates.length}</strong>
          </div>
        </div>

        <div className="ar-stat">
          <div className="ar-stat-icon">
            <Users size={20} />
          </div>
          <div>
            <p>Employees</p>
            <strong>{employees.length}</strong>
          </div>
        </div>

        <div className="ar-stat">
          <div className="ar-stat-icon">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <p>Assigned Reviews</p>
            <strong>{reviews.length}</strong>
          </div>
        </div>
      </section>

      <section className="ar-layout">
        <aside className="ar-panel">
          <div className="ar-panel-header">
            <div>
              <h2>Assignment Setup</h2>
              <p>Choose template, period, and assignment mode.</p>
            </div>
            <CalendarDays size={22} />
          </div>

          <form className="ar-form" onSubmit={assignReviews}>
            <div className="ar-field">
              <label>Active Template</label>
              <select
                className="ar-select"
                value={form.templateId}
                onChange={(e) =>
                  setForm((p) => ({ ...p, templateId: e.target.value }))
                }
              >
                <option value="">Select template</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </div>

            {selectedTemplate ? (
              <div className="ar-template-card">
                <strong>{selectedTemplate.name}</strong>
                <span>{selectedTemplate.description || "No description"}</span>
                <span className="ar-pill">
                  {String(selectedTemplate.review_type || "").replaceAll("_", " ")}
                </span>
              </div>
            ) : null}

            <div className="ar-row">
              <div className="ar-field">
                <label>Period Start</label>
                <input
                  type="date"
                  className="ar-input"
                  value={form.periodStart}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, periodStart: e.target.value }))
                  }
                />
              </div>

              <div className="ar-field">
                <label>Period End</label>
                <input
                  type="date"
                  className="ar-input"
                  value={form.periodEnd}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, periodEnd: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="ar-field">
              <label>Assignment Mode</label>
              <div className="ar-mode-grid">
                <button
                  type="button"
                  className={`ar-mode ${
                    form.assignmentMode === "selected" ? "active" : ""
                  }`}
                  onClick={() =>
                    setForm((p) => ({ ...p, assignmentMode: "selected" }))
                  }
                >
                  <Users size={18} />
                  <div>
                    <strong>Selected Employees</strong>
                    <span>Assign only checked employees.</span>
                  </div>
                </button>

                <button
                  type="button"
                  className={`ar-mode ${
                    form.assignmentMode === "project" ? "active" : ""
                  }`}
                  onClick={() =>
                    setForm((p) => ({ ...p, assignmentMode: "project" }))
                  }
                >
                  <Filter size={18} />
                  <div>
                    <strong>Project / Package</strong>
                    <span>Assign all filtered employees.</span>
                  </div>
                </button>
              </div>
            </div>

            <div className="ar-template-card">
              <strong>Ready to assign</strong>
              <span>{selectedCount} employee(s) selected for this cycle.</span>
            </div>

            <button className="ar-btn success" disabled={assigning || loading}>
              <Send size={17} />
              {assigning ? "Assigning..." : "Assign Reviews"}
            </button>
          </form>
        </aside>

        <main className="ar-panel">
          <div className="ar-panel-header">
            <div>
              <h2>Employee Selection</h2>
              <p>Filter employees by project, package, GAS ID, or name.</p>
            </div>
            <Users size={22} />
          </div>

          <div className="ar-tools">
            <div className="ar-search-wrap">
              <Search size={16} />
              <input
                className="ar-search"
                placeholder="Search name, GAS ID, project..."
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
              />
            </div>

            <select
              className="ar-select"
              value={projectFilter}
              onChange={(e) => {
                setProjectFilter(e.target.value);
                setPackageFilter("");
              }}
            >
              <option value="">All Projects</option>
              {projects.map((project) => (
                <option key={project} value={project}>
                  {project}
                </option>
              ))}
            </select>

            <select
              className="ar-select"
              value={packageFilter}
              onChange={(e) => setPackageFilter(e.target.value)}
            >
              <option value="">All Packages</option>
              {packages.map((pkg) => (
                <option key={pkg} value={pkg}>
                  {pkg}
                </option>
              ))}
            </select>

            <button className="ar-btn soft" type="button" onClick={selectAllFiltered}>
              <Plus size={16} />
              Select All
            </button>

            <button className="ar-btn soft" type="button" onClick={clearSelection}>
              Clear
            </button>
          </div>

          {loading ? (
            <div className="ar-loading">Loading employees...</div>
          ) : filteredEmployees.length === 0 ? (
            <div className="ar-empty">No employees found.</div>
          ) : (
            <div className="ar-table-wrap">
              <table className="ar-table">
                <thead>
                  <tr>
                    <th>Select</th>
                    <th>Employee</th>
                    <th>GAS ID</th>
                    <th>Job Title</th>
                    <th>Project</th>
                    <th>Package</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map((emp) => {
                    const empId = emp.employeeId || emp.id;
                    const checked = selectedEmployees.includes(empId);

                    return (
                      <tr key={empId}>
                        <td>
                          <input
                            className="ar-checkbox"
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleEmployee(empId)}
                          />
                        </td>
                        <td>
                          <div className="ar-emp">
                            <strong>
                              {emp.name || emp.full_name || emp.username || "Employee"}
                            </strong>
                            <span>{emp.email || "-"}</span>
                          </div>
                        </td>
                        <td>{emp.gasId || emp.gas_id || "-"}</td>
                        <td>{emp.jobTitle || emp.job_title || "-"}</td>
                        <td>{emp.projectName || "-"}</td>
                        <td>{emp.packageName || "-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </section>
    </div>
  );
}
