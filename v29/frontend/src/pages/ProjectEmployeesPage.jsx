import { useEffect, useMemo, useState } from "react";
import {
  Users,
  Search,
  Building2,
  Download,
  RefreshCw,
  Eye,
  UserCheck,
  UserX,
  Flag,
  Briefcase,
  BadgeCheck,
} from "lucide-react";
import { API_BASE } from "../services/api";

function getToken() {
  return (
    localStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    localStorage.getItem("accessToken") ||
    ""
  );
}

function safeText(value) {
  return value === null || value === undefined || value === "" ? "-" : value;
}

function isSaudi(nationality) {
  return String(nationality || "").toLowerCase().includes("saudi");
}

function getEmployeeType(gasId) {
  const v = String(gasId || "").trim();
  if (!v) return "-";
  return v.length > 7 ? "Rental" : "GAS";
}

export default function ProjectEmployeesPage() {
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState("");
  const [employees, setEmployees] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [nationalityFilter, setNationalityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [jobFilter, setJobFilter] = useState("all");
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  async function apiFetch(url) {
    const token = getToken();

    const res = await fetch(url, {
      headers: {
        Authorization: token ? `Bearer ${token}` : "",
        "Content-Type": "application/json",
      },
    });

    const contentType = res.headers.get("content-type") || "";

    if (!res.ok) {
      let message = "Request failed";
      if (contentType.includes("application/json")) {
        const err = await res.json();
        message = err?.message || err?.error || message;
      } else {
        message = await res.text();
      }
      throw new Error(message);
    }

    if (!contentType.includes("application/json")) {
      throw new Error("API did not return JSON");
    }

    return res.json();
  }

  async function loadProjects() {
    try {
      setLoadingProjects(true);
      setError("");

      const result = await apiFetch(`${API_BASE}/projects`);

      const list =
        result?.projects ||
        result?.data ||
        result?.rows ||
        result ||
        [];

      setProjects(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to load projects");
    } finally {
      setLoadingProjects(false);
    }
  }

  async function loadEmployees(selectedProjectId = projectId) {
    if (!selectedProjectId) {
      setEmployees([]);
      return;
    }

    try {
      setLoadingEmployees(true);
      setError("");

      const result = await apiFetch(
        `${API_BASE}/employees/by-project/${selectedProjectId}`
      );

      const list =
        result?.employees ||
        result?.data ||
        result?.rows ||
        [];

      setEmployees(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error(err);
      setEmployees([]);
      setError(err.message || "Failed to load employees");
    } finally {
      setLoadingEmployees(false);
    }
  }

  useEffect(() => {
    loadProjects();
  }, []);

  const selectedProject = useMemo(() => {
    return projects.find((p) => String(p.id) === String(projectId));
  }, [projects, projectId]);

  const jobTitles = useMemo(() => {
    const set = new Set();
    employees.forEach((e) => {
      const title = e.job_title || e.jobTitle;
      if (title) set.add(title);
    });
    return Array.from(set).sort();
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    const q = search.trim().toLowerCase();

    return employees.filter((e) => {
      const gasId = String(e.gas_id || e.gasId || "");
      const name = String(e.full_name || e.name || e.employee_name || "");
      const mobile = String(e.mobile || e.phone || "");
      const email = String(e.email || "");
      const nationality = e.nationality || "";
      const status = String(e.status || "").toLowerCase();
      const job = e.job_title || e.jobTitle || "";
      const employeeType = getEmployeeType(gasId);

      const matchesSearch =
        !q ||
        gasId.toLowerCase().includes(q) ||
        name.toLowerCase().includes(q) ||
        mobile.toLowerCase().includes(q) ||
        email.toLowerCase().includes(q);

      const matchesNationality =
        nationalityFilter === "all" ||
        (nationalityFilter === "saudi" && isSaudi(nationality)) ||
        (nationalityFilter === "non-saudi" && !isSaudi(nationality));

      const matchesStatus =
        statusFilter === "all" || status === statusFilter;

      const matchesType =
        typeFilter === "all" ||
        employeeType.toLowerCase() === typeFilter;

      const matchesJob =
        jobFilter === "all" || job === jobFilter;

      return (
        matchesSearch &&
        matchesNationality &&
        matchesStatus &&
        matchesType &&
        matchesJob
      );
    });
  }, [employees, search, nationalityFilter, statusFilter, typeFilter, jobFilter]);

  const stats = useMemo(() => {
    const total = filteredEmployees.length;
    const saudi = filteredEmployees.filter((e) => isSaudi(e.nationality)).length;
    const nonSaudi = total - saudi;
    const active = filteredEmployees.filter(
      (e) => String(e.status || "").toLowerCase() === "active"
    ).length;
    const inactive = total - active;
    const gas = filteredEmployees.filter(
      (e) => getEmployeeType(e.gas_id || e.gasId) === "GAS"
    ).length;
    const rental = filteredEmployees.filter(
      (e) => getEmployeeType(e.gas_id || e.gasId) === "Rental"
    ).length;

    return { total, saudi, nonSaudi, active, inactive, gas, rental };
  }, [filteredEmployees]);

  function exportCSV() {
    const headers = [
      "GAS ID",
      "Employee Name",
      "Job Title",
      "Nationality",
      "Status",
      "Type",
      "Mobile",
      "Email",
      "Package",
      "Supervisor",
    ];

    const rows = filteredEmployees.map((e) => [
      e.gas_id || e.gasId || "",
      e.full_name || e.name || e.employee_name || "",
      e.job_title || e.jobTitle || "",
      e.nationality || "",
      e.status || "",
      getEmployeeType(e.gas_id || e.gasId),
      e.mobile || e.phone || "",
      e.email || "",
      e.package_name || e.packageName || e.package_id || "",
      e.supervisor_name || e.supervisorName || "",
    ]);

    const csv = [headers, ...rows]
      .map((row) =>
        row
          .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `project-employees-${Date.now()}.csv`;
    a.click();

    URL.revokeObjectURL(url);
  }

  return (
    <div className="project-employees-page">
      <style>{styles}</style>

      <section className="pe-hero">
        <div>
          <div className="pe-badge">
            <Building2 size={16} />
            HR Project Employees
          </div>
          <h1>Project Employees Details</h1>
          <p>
            Select a project to view all assigned employees with full details,
            smart filters, statistics, and export options.
          </p>
        </div>

        <button className="pe-refresh" onClick={() => loadEmployees()} disabled={!projectId || loadingEmployees}>
          <RefreshCw size={17} className={loadingEmployees ? "pe-spin" : ""} />
          Refresh
        </button>
      </section>

      <section className="pe-controls">
        <label>
          <span>Select Project</span>
          <select
            value={projectId}
            onChange={(e) => {
              setProjectId(e.target.value);
              loadEmployees(e.target.value);
            }}
            disabled={loadingProjects}
          >
            <option value="">Choose project...</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name || p.project_name || p.title || p.code || p.id}
              </option>
            ))}
          </select>
        </label>

        <div className="pe-search">
          <Search size={18} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, GAS ID, mobile, email..."
          />
        </div>
      </section>

      {error ? <div className="pe-error">{error}</div> : null}

      <section className="pe-stats">
        <Stat icon={Users} label="Total" value={stats.total} />
        <Stat icon={Flag} label="Saudi" value={stats.saudi} />
        <Stat icon={Users} label="Non-Saudi" value={stats.nonSaudi} />
        <Stat icon={UserCheck} label="Active" value={stats.active} />
        <Stat icon={UserX} label="Inactive" value={stats.inactive} />
        <Stat icon={BadgeCheck} label="GAS" value={stats.gas} />
        <Stat icon={Briefcase} label="Rental" value={stats.rental} />
      </section>

      <section className="pe-filters">
        <select value={nationalityFilter} onChange={(e) => setNationalityFilter(e.target.value)}>
          <option value="all">All Nationalities</option>
          <option value="saudi">Saudi</option>
          <option value="non-saudi">Non-Saudi</option>
        </select>

        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>

        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="all">All Types</option>
          <option value="gas">GAS</option>
          <option value="rental">Rental</option>
        </select>

        <select value={jobFilter} onChange={(e) => setJobFilter(e.target.value)}>
          <option value="all">All Job Titles</option>
          {jobTitles.map((j) => (
            <option key={j} value={j}>{j}</option>
          ))}
        </select>

        <button className="pe-export" onClick={exportCSV} disabled={!filteredEmployees.length}>
          <Download size={17} />
          Export CSV
        </button>
      </section>

      <section className="pe-table-card">
        <div className="pe-table-head">
          <div>
            <h2>{selectedProject ? selectedProject.name || selectedProject.project_name : "Employees"}</h2>
            <p>{filteredEmployees.length} employees displayed</p>
          </div>
        </div>

        <div className="pe-table-wrap">
          <table>
            <thead>
              <tr>
                <th>GAS ID</th>
                <th>Employee Name</th>
                <th>Job Title</th>
                <th>Nationality</th>
                <th>Type</th>
                <th>Status</th>
                <th>Mobile</th>
                <th>Email</th>
                <th>Package</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {loadingEmployees ? (
                <tr>
                  <td colSpan="10" className="pe-empty">Loading employees...</td>
                </tr>
              ) : filteredEmployees.length ? (
                filteredEmployees.map((e) => {
                  const gasId = e.gas_id || e.gasId;
                  const name = e.full_name || e.name || e.employee_name;
                  const type = getEmployeeType(gasId);

                  return (
                    <tr key={e.id || `${gasId}-${name}`}>
                      <td><strong>{safeText(gasId)}</strong></td>
                      <td>{safeText(name)}</td>
                      <td>{safeText(e.job_title || e.jobTitle)}</td>
                      <td>{safeText(e.nationality)}</td>
                      <td>
                        <span className={`pe-pill ${type === "Rental" ? "rental" : "gas"}`}>
                          {type}
                        </span>
                      </td>
                      <td>
                        <span className={`pe-status ${String(e.status || "").toLowerCase() === "active" ? "active" : "inactive"}`}>
                          {safeText(e.status)}
                        </span>
                      </td>
                      <td>{safeText(e.mobile || e.phone)}</td>
                      <td>{safeText(e.email)}</td>
                      <td>{safeText(e.package_name || e.packageName || e.package_id)}</td>
                      <td>
                        <button className="pe-view" onClick={() => setSelectedEmployee(e)}>
                          <Eye size={16} />
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="10" className="pe-empty">
                    No employees found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selectedEmployee ? (
        <div className="pe-modal-backdrop" onClick={() => setSelectedEmployee(null)}>
          <div className="pe-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pe-modal-head">
              <div>
                <h3>{safeText(selectedEmployee.full_name || selectedEmployee.name || selectedEmployee.employee_name)}</h3>
                <p>GAS ID: {safeText(selectedEmployee.gas_id || selectedEmployee.gasId)}</p>
              </div>
              <button onClick={() => setSelectedEmployee(null)}>×</button>
            </div>

            <div className="pe-details-grid">
              <Detail label="Job Title" value={selectedEmployee.job_title || selectedEmployee.jobTitle} />
              <Detail label="Nationality" value={selectedEmployee.nationality} />
              <Detail label="Status" value={selectedEmployee.status} />
              <Detail label="Type" value={getEmployeeType(selectedEmployee.gas_id || selectedEmployee.gasId)} />
              <Detail label="Mobile" value={selectedEmployee.mobile || selectedEmployee.phone} />
              <Detail label="Email" value={selectedEmployee.email} />
              <Detail label="Package" value={selectedEmployee.package_name || selectedEmployee.packageName || selectedEmployee.package_id} />
              <Detail label="Supervisor" value={selectedEmployee.supervisor_name || selectedEmployee.supervisorName} />
              <Detail label="Iqama / ID" value={selectedEmployee.iqama_no || selectedEmployee.iqamaNo} />
              <Detail label="Created At" value={selectedEmployee.created_at || selectedEmployee.createdAt} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Stat({ icon: Icon, label, value }) {
  return (
    <article className="pe-stat">
      <div className="pe-stat-icon">
        <Icon size={20} />
      </div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </article>
  );
}

function Detail({ label, value }) {
  return (
    <div className="pe-detail">
      <span>{label}</span>
      <strong>{safeText(value)}</strong>
    </div>
  );
}

const styles = `
.project-employees-page {
  display: grid;
  gap: 18px;
  width: 100%;
}

.project-employees-page * {
  box-sizing: border-box;
}

.pe-hero {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  align-items: flex-start;
  padding: 30px;
  border-radius: 30px;
  color: #fff;
  background:
    radial-gradient(circle at top right, rgba(56,189,248,.35), transparent 35%),
    linear-gradient(135deg, #020617 0%, #0f172a 48%, #1e3a8a 100%);
  box-shadow: 0 20px 45px rgba(15, 23, 42, .12);
}

.pe-badge {
  width: fit-content;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 9px 14px;
  border-radius: 999px;
  background: rgba(255,255,255,.13);
  border: 1px solid rgba(255,255,255,.14);
  color: #dbeafe;
  font-weight: 900;
  font-size: .82rem;
  margin-bottom: 14px;
}

.pe-hero h1 {
  margin: 0;
  font-size: 2.45rem;
  font-weight: 950;
  letter-spacing: -.04em;
}

.pe-hero p {
  margin: 12px 0 0;
  max-width: 760px;
  color: rgba(255,255,255,.78);
  line-height: 1.7;
}

.pe-refresh,
.pe-export,
.pe-view {
  border: none;
  cursor: pointer;
  font-weight: 900;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.pe-refresh {
  min-height: 46px;
  padding: 0 16px;
  border-radius: 16px;
  background: rgba(255,255,255,.14);
  color: #fff;
  border: 1px solid rgba(255,255,255,.16);
}

.pe-controls,
.pe-filters,
.pe-table-card,
.pe-stats {
  border-radius: 26px;
  background: rgba(255,255,255,.96);
  border: 1px solid #e5eaf1;
  box-shadow: 0 14px 35px rgba(15,23,42,.06);
}

.pe-controls {
  padding: 18px;
  display: grid;
  grid-template-columns: minmax(260px, .45fr) minmax(320px, 1fr);
  gap: 14px;
}

.pe-controls label {
  display: grid;
  gap: 8px;
}

.pe-controls label span {
  color: #334155;
  font-weight: 900;
  font-size: .86rem;
}

.pe-controls select,
.pe-controls input,
.pe-filters select {
  width: 100%;
  min-height: 48px;
  border: 1px solid #dbe2ea;
  border-radius: 16px;
  background: #fff;
  color: #0f172a;
  padding: 0 14px;
  outline: none;
}

.pe-search {
  position: relative;
  display: flex;
  align-items: center;
}

.pe-search svg {
  position: absolute;
  left: 14px;
  color: #64748b;
}

.pe-search input {
  padding-left: 42px;
}

.pe-stats {
  padding: 16px;
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 12px;
}

.pe-stat {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 15px;
  border-radius: 20px;
  background: #f8fafc;
  border: 1px solid #edf2f7;
}

.pe-stat-icon {
  width: 42px;
  height: 42px;
  border-radius: 15px;
  display: grid;
  place-items: center;
  color: #1d4ed8;
  background: #eff6ff;
}

.pe-stat span {
  display: block;
  color: #64748b;
  font-size: .78rem;
  font-weight: 850;
}

.pe-stat strong {
  display: block;
  color: #0f172a;
  font-size: 1.35rem;
  font-weight: 950;
}

.pe-filters {
  padding: 16px;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr)) auto;
  gap: 12px;
}

.pe-export {
  min-height: 48px;
  padding: 0 16px;
  border-radius: 16px;
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  color: #fff;
  box-shadow: 0 12px 25px rgba(37,99,235,.2);
}

.pe-error {
  padding: 14px 16px;
  border-radius: 18px;
  background: #fff1f2;
  border: 1px solid #fecdd3;
  color: #be123c;
  font-weight: 900;
}

.pe-table-card {
  padding: 20px;
}

.pe-table-head {
  display: flex;
  justify-content: space-between;
  margin-bottom: 16px;
}

.pe-table-head h2 {
  margin: 0 0 4px;
  color: #0f172a;
  font-weight: 950;
}

.pe-table-head p {
  margin: 0;
  color: #64748b;
  font-weight: 800;
}

.pe-table-wrap {
  overflow: auto;
  border-radius: 20px;
  border: 1px solid #edf2f7;
}

table {
  width: 100%;
  border-collapse: collapse;
  min-width: 1100px;
}

th {
  text-align: left;
  padding: 14px;
  color: #334155;
  background: #f8fafc;
  font-size: .78rem;
  font-weight: 950;
  white-space: nowrap;
}

td {
  padding: 14px;
  border-top: 1px solid #edf2f7;
  color: #0f172a;
  font-size: .88rem;
  white-space: nowrap;
}

.pe-pill,
.pe-status {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: .76rem;
  font-weight: 950;
}

.pe-pill.gas {
  background: #ecfdf3;
  color: #047857;
}

.pe-pill.rental {
  background: #eff6ff;
  color: #1d4ed8;
}

.pe-status.active {
  background: #ecfdf3;
  color: #047857;
}

.pe-status.inactive {
  background: #fff1f2;
  color: #be123c;
}

.pe-view {
  min-height: 34px;
  padding: 0 11px;
  border-radius: 12px;
  background: #f1f5f9;
  color: #0f172a;
}

.pe-empty {
  text-align: center;
  color: #64748b;
  font-weight: 900;
  padding: 30px;
}

.pe-spin {
  animation: peSpin 1s linear infinite;
}

@keyframes peSpin {
  to { transform: rotate(360deg); }
}

.pe-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 999;
  background: rgba(15,23,42,.55);
  display: grid;
  place-items: center;
  padding: 18px;
}

.pe-modal {
  width: min(760px, 100%);
  max-height: 88vh;
  overflow: auto;
  border-radius: 28px;
  background: #fff;
  box-shadow: 0 25px 80px rgba(15,23,42,.28);
  padding: 22px;
}

.pe-modal-head {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 18px;
}

.pe-modal-head h3 {
  margin: 0 0 4px;
  color: #0f172a;
  font-size: 1.35rem;
  font-weight: 950;
}

.pe-modal-head p {
  margin: 0;
  color: #64748b;
  font-weight: 850;
}

.pe-modal-head button {
  width: 38px;
  height: 38px;
  border: none;
  border-radius: 14px;
  background: #f1f5f9;
  color: #0f172a;
  font-size: 1.5rem;
  cursor: pointer;
}

.pe-details-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.pe-detail {
  padding: 14px;
  border-radius: 18px;
  background: #f8fafc;
  border: 1px solid #edf2f7;
}

.pe-detail span {
  display: block;
  color: #64748b;
  font-size: .78rem;
  font-weight: 850;
  margin-bottom: 5px;
}

.pe-detail strong {
  color: #0f172a;
  font-weight: 950;
  word-break: break-word;
}

@media (max-width: 1200px) {
  .pe-stats {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .pe-filters {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .pe-export {
    width: 100%;
  }
}

@media (max-width: 768px) {
  .pe-hero {
    display: grid;
    padding: 20px;
    border-radius: 22px;
  }

  .pe-hero h1 {
    font-size: 1.8rem;
  }

  .pe-controls,
  .pe-filters,
  .pe-stats {
    grid-template-columns: 1fr;
    border-radius: 22px;
  }

  .pe-table-card {
    padding: 14px;
    border-radius: 22px;
  }

  .pe-details-grid {
    grid-template-columns: 1fr;
  }
}
`;
