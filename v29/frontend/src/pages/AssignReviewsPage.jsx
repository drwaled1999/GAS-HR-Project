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
  X,
  Sparkles,
  ShieldCheck,
  Target,
  Layers,
  UserCheck,
  CheckSquare,
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

function getEmployeeId(emp) {
  return emp.employeeId || emp.employee_id || emp.id;
}

function getInitials(name) {
  const text = String(name || "Employee").trim();
  const parts = text.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0]?.[0] || ""}${parts[1]?.[0] || ""}`.toUpperCase();
}

function formatType(value) {
  return String(value || "").replaceAll("_", " ");
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
            emp.username,
            emp.email,
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

  const assignedThisYear = useMemo(() => {
    const y = new Date().getFullYear();
    return reviews.filter((r) => String(r.period_start || "").startsWith(String(y))).length;
  }, [reviews]);

  const selectedEmployeesDetails = useMemo(() => {
    const ids = new Set(selectedEmployees);
    return employees.filter((emp) => ids.has(getEmployeeId(emp)));
  }, [employees, selectedEmployees]);

  function toggleEmployee(employeeId) {
    setSelectedEmployees((prev) =>
      prev.includes(employeeId)
        ? prev.filter((id) => id !== employeeId)
        : [...prev, employeeId]
    );
  }

  function selectAllFiltered() {
    setSelectedEmployees(
      filteredEmployees.map((e) => getEmployeeId(e)).filter(Boolean)
    );
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
          position: relative;
          overflow: hidden;
          border-radius: 32px;
          padding: 30px;
          background:
            radial-gradient(circle at 86% 18%, rgba(251,191,36,.24), transparent 28%),
            radial-gradient(circle at 8% 92%, rgba(34,197,94,.18), transparent 30%),
            linear-gradient(135deg, #0f172a, #1d4ed8);
          color: white;
          box-shadow: 0 28px 70px rgba(15,23,42,.24);
          margin-bottom: 18px;
        }

        .ar-hero::before {
          content: "";
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(255,255,255,.055) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,.055) 1px, transparent 1px);
          background-size: 46px 46px;
          opacity: .25;
        }

        .ar-hero-content {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 22px;
        }

        .ar-kicker {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 13px;
          border-radius: 999px;
          background: rgba(255,255,255,.13);
          border: 1px solid rgba(255,255,255,.18);
          font-size: 12px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .08em;
        }

        .ar-hero h1 {
          margin: 16px 0 9px;
          font-size: clamp(30px, 4vw, 46px);
          line-height: 1.05;
          font-weight: 950;
          letter-spacing: -.04em;
        }

        .ar-hero p {
          margin: 0;
          max-width: 780px;
          color: rgba(255,255,255,.78);
          line-height: 1.7;
        }

        .ar-hero-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .ar-btn {
          border: 0;
          border-radius: 16px;
          padding: 11px 15px;
          font-weight: 950;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: .2s ease;
          white-space: nowrap;
          text-decoration: none;
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

        .ar-btn.dark {
          background: #0f172a;
          color: white;
        }

        .ar-btn:disabled {
          opacity: .6;
          cursor: not-allowed;
          transform: none;
        }

        .ar-summary-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 18px;
        }

        .ar-stat {
          position: relative;
          overflow: hidden;
          border-radius: 24px;
          background: rgba(255,255,255,.94);
          border: 1px solid rgba(148,163,184,.22);
          box-shadow: 0 18px 45px rgba(15,23,42,.08);
          padding: 18px;
          display: flex;
          gap: 12px;
          align-items: flex-start;
        }

        .ar-stat::after {
          content: "";
          position: absolute;
          right: -22px;
          bottom: -24px;
          width: 84px;
          height: 84px;
          border-radius: 999px;
          background: currentColor;
          opacity: .1;
        }

        .ar-stat-icon {
          width: 46px;
          height: 46px;
          border-radius: 17px;
          display: grid;
          place-items: center;
          background: #eff6ff;
          color: #2563eb;
          flex: 0 0 auto;
        }

        .ar-stat.green .ar-stat-icon { background: #ecfdf5; color: #16a34a; }
        .ar-stat.amber .ar-stat-icon { background: #fffbeb; color: #d97706; }
        .ar-stat.purple .ar-stat-icon { background: #f5f3ff; color: #7c3aed; }

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
          margin-top: 6px;
          font-size: 26px;
          line-height: 1;
          color: #0f172a;
        }

        .ar-stat span {
          display: block;
          margin-top: 7px;
          color: #64748b;
          font-size: 12px;
        }

        .ar-steps {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 18px;
        }

        .ar-step {
          background: rgba(255,255,255,.9);
          border: 1px solid rgba(148,163,184,.22);
          border-radius: 22px;
          padding: 14px;
          box-shadow: 0 14px 34px rgba(15,23,42,.06);
          display: flex;
          gap: 12px;
          align-items: center;
        }

        .ar-step-icon {
          width: 40px;
          height: 40px;
          border-radius: 15px;
          display: grid;
          place-items: center;
          background: #eff6ff;
          color: #2563eb;
          flex: 0 0 auto;
        }

        .ar-step strong {
          display: block;
          font-size: 13px;
        }

        .ar-step span {
          display: block;
          margin-top: 3px;
          color: #64748b;
          font-size: 12px;
        }

        .ar-layout {
          display: grid;
          grid-template-columns: 430px minmax(0, 1fr);
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
          color: #0f172a;
          text-align: left;
        }

        .ar-mode:hover {
          transform: translateY(-1px);
        }

        .ar-mode.active {
          border-color: rgba(37,99,235,.5);
          background: #eff6ff;
          box-shadow: 0 12px 26px rgba(37,99,235,.12);
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
          line-height: 1.5;
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

        .ar-ready-card {
          border: 1px solid rgba(22,163,74,.18);
          background: #ecfdf5;
          color: #14532d;
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
          min-width: 860px;
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
          vertical-align: middle;
        }

        .ar-table tbody tr {
          transition: .16s ease;
        }

        .ar-table tbody tr:hover {
          background: #f8fafc;
        }

        .ar-emp {
          display: flex;
          align-items: center;
          gap: 11px;
        }

        .ar-avatar {
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

        .ar-mobile-list {
          display: none;
          padding: 14px;
          gap: 12px;
        }

        .ar-mobile-card {
          border: 1px solid rgba(148,163,184,.18);
          border-radius: 22px;
          padding: 14px;
          background: white;
          display: grid;
          gap: 12px;
        }

        .ar-mobile-top {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: flex-start;
        }

        .ar-mobile-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .ar-side-list {
          padding: 12px 16px 16px;
          display: grid;
          gap: 10px;
          max-height: 250px;
          overflow: auto;
        }

        .ar-selected-chip {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 10px 12px;
          border-radius: 16px;
          background: #f8fafc;
          border: 1px solid rgba(148,163,184,.16);
          font-size: 12px;
          font-weight: 800;
        }

        .ar-chip-remove {
          width: 28px;
          height: 28px;
          border: 0;
          border-radius: 10px;
          display: grid;
          place-items: center;
          background: #fef2f2;
          color: #dc2626;
          cursor: pointer;
        }

        .ar-error,
        .ar-notice,
        .ar-empty,
        .ar-loading {
          padding: 20px;
          text-align: center;
          color: #64748b;
          display: grid;
          place-items: center;
          gap: 8px;
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

        @media (max-width: 1280px) {
          .ar-summary-grid,
          .ar-steps {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .ar-layout {
            grid-template-columns: 1fr;
          }

          .ar-tools {
            grid-template-columns: 1fr 1fr;
          }
        }

        @media (max-width: 720px) {
          .ar-hero {
            border-radius: 24px;
            padding: 20px;
          }

          .ar-hero-content {
            flex-direction: column;
            align-items: flex-start;
          }

          .ar-hero-actions {
            width: 100%;
            display: grid;
            grid-template-columns: 1fr;
          }

          .ar-summary-grid,
          .ar-steps,
          .ar-row,
          .ar-mode-grid,
          .ar-tools {
            grid-template-columns: 1fr;
          }

          .ar-btn {
            width: 100%;
          }

          .ar-table-wrap {
            display: none;
          }

          .ar-mobile-list {
            display: grid;
          }

          .ar-panel-header {
            align-items: flex-start;
            flex-direction: column;
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

          <div className="ar-hero-actions">
            <button className="ar-btn white" onClick={loadData}>
              <RefreshCw size={17} />
              Refresh
            </button>
            <a className="ar-btn white" href="/performance/templates">
              <FileSignature size={17} />
              Templates
            </a>
          </div>
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
            <span>Ready for assignment</span>
          </div>
        </div>

        <div className="ar-stat green">
          <div className="ar-stat-icon">
            <Users size={20} />
          </div>
          <div>
            <p>Total Employees</p>
            <strong>{employees.length}</strong>
            <span>Available employees</span>
          </div>
        </div>

        <div className="ar-stat amber">
          <div className="ar-stat-icon">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <p>Assigned Reviews</p>
            <strong>{reviews.length}</strong>
            <span>All review records</span>
          </div>
        </div>

        <div className="ar-stat purple">
          <div className="ar-stat-icon">
            <CalendarDays size={20} />
          </div>
          <div>
            <p>This Year</p>
            <strong>{assignedThisYear}</strong>
            <span>Current year cycles</span>
          </div>
        </div>
      </section>

      <section className="ar-steps">
        <div className="ar-step">
          <div className="ar-step-icon">
            <FileSignature size={18} />
          </div>
          <div>
            <strong>1. Template</strong>
            <span>Choose active review form</span>
          </div>
        </div>

        <div className="ar-step">
          <div className="ar-step-icon">
            <CalendarDays size={18} />
          </div>
          <div>
            <strong>2. Period</strong>
            <span>Define start and end dates</span>
          </div>
        </div>

        <div className="ar-step">
          <div className="ar-step-icon">
            <Target size={18} />
          </div>
          <div>
            <strong>3. Scope</strong>
            <span>Select employees or project</span>
          </div>
        </div>

        <div className="ar-step">
          <div className="ar-step-icon">
            <Send size={18} />
          </div>
          <div>
            <strong>4. Assign</strong>
            <span>Create review cycle</span>
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
            <ShieldCheck size={22} />
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
                  {formatType(selectedTemplate.review_type)}
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
                  <Layers size={18} />
                  <div>
                    <strong>Project / Package</strong>
                    <span>Assign all filtered employees.</span>
                  </div>
                </button>
              </div>
            </div>

            <div className="ar-template-card ar-ready-card">
              <strong>Ready to assign</strong>
              <span>{selectedCount} employee(s) selected for this cycle.</span>
            </div>

            {form.assignmentMode === "selected" && selectedEmployeesDetails.length > 0 ? (
              <div className="ar-side-list">
                {selectedEmployeesDetails.slice(0, 8).map((emp) => {
                  const empId = getEmployeeId(emp);
                  return (
                    <div className="ar-selected-chip" key={empId}>
                      <span>{emp.name || emp.full_name || emp.username || "Employee"}</span>
                      <button
                        className="ar-chip-remove"
                        type="button"
                        onClick={() => toggleEmployee(empId)}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : null}

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
            <UserCheck size={22} />
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
              <CheckSquare size={16} />
              Select All
            </button>

            <button className="ar-btn soft" type="button" onClick={clearSelection}>
              <X size={16} />
              Clear
            </button>
          </div>

          {loading ? (
            <div className="ar-loading">
              <Sparkles size={22} />
              Loading employees...
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="ar-empty">
              <Sparkles size={22} />
              No employees found.
            </div>
          ) : (
            <>
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
                      const empId = getEmployeeId(emp);
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
                              <div className="ar-avatar">
                                {getInitials(emp.name || emp.full_name || emp.username)}
                              </div>
                              <div>
                                <strong>
                                  {emp.name || emp.full_name || emp.username || "Employee"}
                                </strong>
                                <span>{emp.email || "-"}</span>
                              </div>
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

              <div className="ar-mobile-list">
                {filteredEmployees.map((emp) => {
                  const empId = getEmployeeId(emp);
                  const checked = selectedEmployees.includes(empId);

                  return (
                    <div className="ar-mobile-card" key={empId}>
                      <div className="ar-mobile-top">
                        <div className="ar-emp">
                          <div className="ar-avatar">
                            {getInitials(emp.name || emp.full_name || emp.username)}
                          </div>
                          <div>
                            <strong>
                              {emp.name || emp.full_name || emp.username || "Employee"}
                            </strong>
                            <span>GAS ID: {emp.gasId || emp.gas_id || "-"}</span>
                          </div>
                        </div>

                        <input
                          className="ar-checkbox"
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleEmployee(empId)}
                        />
                      </div>

                      <div className="ar-mobile-meta">
                        <span className="ar-pill">{emp.jobTitle || emp.job_title || "-"}</span>
                        <span className="ar-pill">{emp.projectName || "-"}</span>
                        <span className="ar-pill">{emp.packageName || "No package"}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </main>
      </section>
    </div>
  );
}
