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
  Filter,
  X,
  Mail,
  Phone,
  Badge,
  Layers,
  UserRound,
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

function getName(e) {
  return e?.full_name || e?.name || e?.employee_name || e?.username || "-";
}

function getGasId(e) {
  return e?.gas_id || e?.gasId || "-";
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
      setProjects([]);
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
        `${API_BASE}/users/by-project/${selectedProjectId}`
      );

      const list = result?.employees || result?.data || result?.rows || [];
      setEmployees(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error(err);
      setEmployees([]);
      setError(err.message || "Failed to load project employees");
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

  const selectedProjectName =
    selectedProject?.name ||
    selectedProject?.project_name ||
    selectedProject?.title ||
    selectedProject?.code ||
    "No project selected";

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
      const gasId = String(getGasId(e));
      const name = String(getName(e));
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
        typeFilter === "all" || employeeType.toLowerCase() === typeFilter;

      const matchesJob = jobFilter === "all" || job === jobFilter;

      return (
        matchesSearch &&
        matchesNationality &&
        matchesStatus &&
        matchesType &&
        matchesJob
      );
    });
  }, [
    employees,
    search,
    nationalityFilter,
    statusFilter,
    typeFilter,
    jobFilter,
  ]);

  const stats = useMemo(() => {
    const total = filteredEmployees.length;
    const saudi = filteredEmployees.filter((e) => isSaudi(e.nationality)).length;
    const nonSaudi = total - saudi;

    const active = filteredEmployees.filter(
      (e) => String(e.status || "").toLowerCase() === "active"
    ).length;

    const inactive = total - active;

    const gas = filteredEmployees.filter(
      (e) => getEmployeeType(getGasId(e)) === "GAS"
    ).length;

    const rental = filteredEmployees.filter(
      (e) => getEmployeeType(getGasId(e)) === "Rental"
    ).length;

    return { total, saudi, nonSaudi, active, inactive, gas, rental };
  }, [filteredEmployees]);

  function resetFilters() {
    setSearch("");
    setNationalityFilter("all");
    setStatusFilter("all");
    setTypeFilter("all");
    setJobFilter("all");
  }

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
      "Project",
      "Supervisor",
    ];

    const rows = filteredEmployees.map((e) => [
      getGasId(e),
      getName(e),
      e.job_title || e.jobTitle || "",
      e.nationality || "",
      e.status || "",
      getEmployeeType(getGasId(e)),
      e.mobile || e.phone || "",
      e.email || "",
      e.package_name || e.packageName || e.package_id || "",
      e.project_name || e.projectName || "",
      e.supervisor_name || e.supervisorName || "",
    ]);

    const csv = [headers, ...rows]
      .map((row) =>
        row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `project-employees-${selectedProjectName}-${Date.now()}.csv`;
    a.click();

    URL.revokeObjectURL(url);
  }

  return (
    <div className="project-employees-page">
      <style>{styles}</style>

      <section className="pe-hero">
        <div className="pe-hero-content">
          <div className="pe-badge">
            <Building2 size={16} />
            Project Workforce Control
          </div>

          <h1>Project Employees Details</h1>

          <p>
            View project employees, filter workforce data, check status, and
            export HR-ready reports.
          </p>

          <div className="pe-hero-meta">
            <span>
              <Building2 size={15} />
              {selectedProjectName}
            </span>
            <span>
              <Users size={15} />
              {stats.total} Employees
            </span>
          </div>
        </div>

        <button
          className="pe-refresh"
          onClick={() => loadEmployees()}
          disabled={!projectId || loadingEmployees}
        >
          <RefreshCw size={17} className={loadingEmployees ? "pe-spin" : ""} />
          {loadingEmployees ? "Refreshing..." : "Refresh"}
        </button>
      </section>

      <section className="pe-control-panel">
        <div className="pe-project-box">
          <label>Select Project</label>
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
        </div>

        <div className="pe-search">
          <Search size={18} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, GAS ID, mobile, email..."
          />
        </div>

        <button className="pe-reset" onClick={resetFilters}>
          <X size={16} />
          Reset
        </button>
      </section>

      {error ? <div className="pe-error">{error}</div> : null}

      <section className="pe-stats">
        <StatCard icon={Users} label="Total Employees" value={stats.total} tone="blue" />
        <StatCard icon={Flag} label="Saudi" value={stats.saudi} tone="green" />
        <StatCard icon={Users} label="Non-Saudi" value={stats.nonSaudi} tone="orange" />
        <StatCard icon={UserCheck} label="Active" value={stats.active} tone="emerald" />
        <StatCard icon={UserX} label="Inactive" value={stats.inactive} tone="red" />
        <StatCard icon={BadgeCheck} label="GAS" value={stats.gas} tone="sky" />
        <StatCard icon={Briefcase} label="Rental" value={stats.rental} tone="purple" />
      </section>

      <section className="pe-filters-card">
        <div className="pe-filter-title">
          <Filter size={18} />
          Smart Filters
        </div>

        <div className="pe-filters">
          <select
            value={nationalityFilter}
            onChange={(e) => setNationalityFilter(e.target.value)}
          >
            <option value="all">All Nationalities</option>
            <option value="saudi">Saudi</option>
            <option value="non-saudi">Non-Saudi</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="all">All Types</option>
            <option value="gas">GAS</option>
            <option value="rental">Rental</option>
          </select>

          <select value={jobFilter} onChange={(e) => setJobFilter(e.target.value)}>
            <option value="all">All Job Titles</option>
            {jobTitles.map((j) => (
              <option key={j} value={j}>
                {j}
              </option>
            ))}
          </select>

          <button
            className="pe-export"
            onClick={exportCSV}
            disabled={!filteredEmployees.length}
          >
            <Download size={17} />
            Export CSV
          </button>
        </div>
      </section>

      <section className="pe-table-card">
        <div className="pe-table-head">
          <div>
            <h2>{selectedProjectName}</h2>
            <p>{filteredEmployees.length} employees displayed</p>
          </div>

          <div className="pe-table-actions">
            <span>{loadingEmployees ? "Loading..." : "Ready"}</span>
          </div>
        </div>

        <div className="pe-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>GAS ID</th>
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
                  <td colSpan="10">
                    <div className="pe-loading-row">
                      <RefreshCw className="pe-spin" size={20} />
                      Loading project employees...
                    </div>
                  </td>
                </tr>
              ) : filteredEmployees.length ? (
                filteredEmployees.map((e) => {
                  const gasId = getGasId(e);
                  const name = getName(e);
                  const type = getEmployeeType(gasId);
                  const status = String(e.status || "active").toLowerCase();

                  return (
                    <tr key={e.id || `${gasId}-${name}`}>
                      <td>
                        <div className="pe-employee-cell">
                          <div className="pe-avatar">
                            {String(name).charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <strong>{safeText(name)}</strong>
                            <span>@{safeText(e.username)}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="pe-gas">{safeText(gasId)}</span>
                      </td>
                      <td>{safeText(e.job_title || e.jobTitle)}</td>
                      <td>{safeText(e.nationality)}</td>
                      <td>
                        <span className={`pe-pill ${type === "Rental" ? "rental" : "gas"}`}>
                          {type}
                        </span>
                      </td>
                      <td>
                        <span className={`pe-status ${status === "active" ? "active" : "inactive"}`}>
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
                  <td colSpan="10">
                    <div className="pe-empty">
                      <Users size={34} />
                      <strong>No employees found</strong>
                      <span>Select another project or reset filters.</span>
                    </div>
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
              <div className="pe-employee-cell modal-title">
                <div className="pe-avatar big">
                  {String(getName(selectedEmployee)).charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3>{safeText(getName(selectedEmployee))}</h3>
                  <p>GAS ID: {safeText(getGasId(selectedEmployee))}</p>
                </div>
              </div>

              <button onClick={() => setSelectedEmployee(null)}>×</button>
            </div>

            <div className="pe-details-grid">
              <Detail icon={Badge} label="GAS ID" value={getGasId(selectedEmployee)} />
              <Detail icon={UserRound} label="Employee Name" value={getName(selectedEmployee)} />
              <Detail icon={Briefcase} label="Job Title" value={selectedEmployee.job_title || selectedEmployee.jobTitle} />
              <Detail icon={Flag} label="Nationality" value={selectedEmployee.nationality} />
              <Detail icon={BadgeCheck} label="Status" value={selectedEmployee.status} />
              <Detail icon={Layers} label="Type" value={getEmployeeType(getGasId(selectedEmployee))} />
              <Detail icon={Phone} label="Mobile" value={selectedEmployee.mobile || selectedEmployee.phone} />
              <Detail icon={Mail} label="Email" value={selectedEmployee.email} />
              <Detail icon={Building2} label="Project" value={selectedEmployee.project_name || selectedEmployee.projectName} />
              <Detail icon={Layers} label="Package" value={selectedEmployee.package_name || selectedEmployee.packageName || selectedEmployee.package_id} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, tone }) {
  return (
    <article className={`pe-stat ${tone}`}>
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

function Detail({ icon: Icon, label, value }) {
  return (
    <div className="pe-detail">
      <Icon size={18} />
      <div>
        <span>{label}</span>
        <strong>{safeText(value)}</strong>
      </div>
    </div>
  );
}

const styles = `
.project-employees-page {
  display: grid;
  gap: 18px;
  width: 100%;
  max-width: 100%;
  overflow-x: hidden;
  padding-bottom: 20px;
}

.project-employees-page * {
  box-sizing: border-box;
}

.pe-hero {
  width: 100%;
  max-width: 100%;
  display: flex;
  justify-content: space-between;
  gap: 18px;
  align-items: flex-start;
  padding: 30px;
  border-radius: 30px;
  color: #fff;
  overflow: hidden;
  position: relative;
  background:
    radial-gradient(circle at top right, rgba(14,165,233,.38), transparent 34%),
    radial-gradient(circle at bottom left, rgba(37,99,235,.32), transparent 34%),
    linear-gradient(135deg, #020617 0%, #0f172a 46%, #1e3a8a 100%);
  box-shadow: 0 20px 48px rgba(15, 23, 42, .14);
}

.pe-hero::after {
  content: "";
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(255,255,255,.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,.05) 1px, transparent 1px);
  background-size: 48px 48px;
  opacity: .65;
  pointer-events: none;
}

.pe-hero > * {
  position: relative;
  z-index: 2;
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
  font-weight: 950;
  font-size: .82rem;
  margin-bottom: 14px;
}

.pe-hero h1 {
  margin: 0;
  font-size: 2.4rem;
  font-weight: 950;
  letter-spacing: -.05em;
}

.pe-hero p {
  margin: 12px 0 0;
  max-width: 820px;
  color: rgba(255,255,255,.82);
  line-height: 1.7;
}

.pe-hero-meta {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 18px;
}

.pe-hero-meta span {
  min-height: 34px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0 13px;
  border-radius: 999px;
  background: rgba(255,255,255,.13);
  border: 1px solid rgba(255,255,255,.13);
  color: #eff6ff;
  font-weight: 900;
  font-size: .78rem;
}

.pe-refresh,
.pe-export,
.pe-view,
.pe-reset {
  border: none;
  cursor: pointer;
  font-weight: 950;
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

.pe-refresh:disabled,
.pe-export:disabled {
  opacity: .6;
  cursor: not-allowed;
}

.pe-control-panel,
.pe-filters-card,
.pe-table-card,
.pe-stats {
  border-radius: 28px;
  background: rgba(255,255,255,.96);
  border: 1px solid #e5eaf1;
  box-shadow: 0 14px 36px rgba(15,23,42,.06);
}

.pe-control-panel {
  padding: 18px;
  display: grid;
  grid-template-columns: minmax(220px, 340px) minmax(260px, 1fr) auto;
  gap: 14px;
  align-items: end;
  overflow: hidden;
}

.pe-project-box {
  display: grid;
  gap: 8px;
}

.pe-project-box label {
  color: #334155;
  font-weight: 950;
  font-size: .84rem;
}

.pe-project-box select,
.pe-search input,
.pe-filters select {
  width: 100%;
  min-height: 50px;
  border: 1px solid #dbe2ea;
  border-radius: 17px;
  background: #fff;
  color: #0f172a;
  padding: 0 14px;
  outline: none;
  font-weight: 750;
}

.pe-project-box select:focus,
.pe-search input:focus,
.pe-filters select:focus {
  border-color: #2563eb;
  box-shadow: 0 0 0 4px rgba(37,99,235,.08);
}

.pe-search {
  position: relative;
  display: flex;
  align-items: center;
  min-width: 0;
}

.pe-search svg {
  position: absolute;
  left: 15px;
  color: #64748b;
}

.pe-search input {
  padding-left: 44px;
  min-width: 0;
}

.pe-reset {
  min-height: 50px;
  padding: 0 16px;
  border-radius: 17px;
  background: #f1f5f9;
  color: #0f172a;
  border: 1px solid #e2e8f0;
}

.pe-error {
  padding: 15px 17px;
  border-radius: 18px;
  background: #fff1f2;
  border: 1px solid #fecdd3;
  color: #be123c;
  font-weight: 950;
}

.pe-stats {
  padding: 16px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
  overflow: hidden;
}

.pe-stat {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 15px;
  border-radius: 21px;
  background: #f8fafc;
  border: 1px solid #edf2f7;
  min-width: 0;
}

.pe-stat-icon {
  width: 43px;
  height: 43px;
  border-radius: 16px;
  display: grid;
  place-items: center;
  background: #eff6ff;
  color: #1d4ed8;
  flex: 0 0 auto;
}

.pe-stat.green .pe-stat-icon { background: #ecfdf3; color: #047857; }
.pe-stat.orange .pe-stat-icon { background: #fff7ed; color: #c2410c; }
.pe-stat.emerald .pe-stat-icon { background: #dcfce7; color: #15803d; }
.pe-stat.red .pe-stat-icon { background: #fff1f2; color: #be123c; }
.pe-stat.sky .pe-stat-icon { background: #eff6ff; color: #2563eb; }
.pe-stat.purple .pe-stat-icon { background: #f5f3ff; color: #6d28d9; }

.pe-stat span {
  display: block;
  color: #64748b;
  font-size: .75rem;
  font-weight: 900;
}

.pe-stat strong {
  display: block;
  color: #0f172a;
  font-size: 1.35rem;
  font-weight: 950;
}

.pe-filters-card {
  padding: 16px;
  overflow: hidden;
}

.pe-filter-title {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-bottom: 13px;
  color: #0f172a;
  font-weight: 950;
}

.pe-filters {
  display: grid;
  grid-template-columns: repeat(4, minmax(170px, 1fr)) minmax(140px, auto);
  gap: 12px;
  overflow-x: auto;
  padding-bottom: 2px;
}

.pe-export {
  min-height: 50px;
  min-width: 140px;
  padding: 0 17px;
  border-radius: 17px;
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  color: #fff;
  box-shadow: 0 12px 25px rgba(37,99,235,.2);
  white-space: nowrap;
}

.pe-table-card {
  padding: 20px;
  overflow: hidden;
}

.pe-table-head {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 16px;
}

.pe-table-head h2 {
  margin: 0 0 4px;
  color: #0f172a;
  font-size: 1.35rem;
  font-weight: 950;
}

.pe-table-head p {
  margin: 0;
  color: #64748b;
  font-weight: 850;
}

.pe-table-actions span {
  display: inline-flex;
  min-height: 32px;
  align-items: center;
  padding: 0 12px;
  border-radius: 999px;
  background: #ecfdf3;
  color: #047857;
  font-size: .76rem;
  font-weight: 950;
}

.pe-table-wrap {
  width: 100%;
  max-width: 100%;
  overflow-x: auto;
  border-radius: 22px;
  border: 1px solid #edf2f7;
}

table {
  width: 100%;
  border-collapse: collapse;
  min-width: 980px;
}

th {
  position: sticky;
  top: 0;
  z-index: 3;
  text-align: left;
  padding: 13px 14px;
  color: #334155;
  background: #f8fafc;
  font-size: .77rem;
  font-weight: 950;
  white-space: nowrap;
  border-bottom: 1px solid #edf2f7;
}

td {
  padding: 13px 14px;
  border-top: 1px solid #edf2f7;
  color: #0f172a;
  font-size: .87rem;
  white-space: nowrap;
}

tbody tr {
  transition: .16s ease;
}

tbody tr:hover {
  background: #f8fafc;
}

.pe-employee-cell {
  display: flex;
  align-items: center;
  gap: 12px;
}

.pe-avatar {
  width: 42px;
  height: 42px;
  border-radius: 16px;
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, #2563eb, #0ea5e9);
  color: #fff;
  font-weight: 950;
  flex: 0 0 auto;
}

.pe-avatar.big {
  width: 54px;
  height: 54px;
  border-radius: 19px;
  font-size: 1.15rem;
}

.pe-employee-cell strong {
  display: block;
  color: #0f172a;
  font-weight: 950;
}

.pe-employee-cell span {
  display: block;
  color: #64748b;
  font-size: .78rem;
  font-weight: 800;
  margin-top: 3px;
}

.pe-gas {
  display: inline-flex;
  min-height: 30px;
  align-items: center;
  padding: 0 11px;
  border-radius: 999px;
  background: #f1f5f9;
  color: #0f172a;
  font-weight: 950;
}

.pe-pill,
.pe-status {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 29px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: .74rem;
  font-weight: 950;
}

.pe-pill.gas,
.pe-status.active {
  background: #ecfdf3;
  color: #047857;
}

.pe-pill.rental {
  background: #f5f3ff;
  color: #6d28d9;
}

.pe-status.inactive {
  background: #fff1f2;
  color: #be123c;
}

.pe-view {
  min-height: 36px;
  padding: 0 12px;
  border-radius: 13px;
  background: #f1f5f9;
  color: #0f172a;
}

.pe-loading-row,
.pe-empty {
  min-height: 180px;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 10px;
  color: #64748b;
  text-align: center;
  font-weight: 900;
}

.pe-empty strong {
  color: #0f172a;
  font-size: 1rem;
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
  width: min(840px, 100%);
  max-height: 88vh;
  overflow: auto;
  border-radius: 30px;
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
  margin: 0;
  color: #0f172a;
  font-size: 1.35rem;
  font-weight: 950;
}

.pe-modal-head p {
  margin: 4px 0 0;
  color: #64748b;
  font-weight: 850;
}

.pe-modal-head button {
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 15px;
  background: #f1f5f9;
  color: #0f172a;
  font-size: 1.6rem;
  cursor: pointer;
}

.pe-details-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.pe-detail {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 14px;
  border-radius: 19px;
  background: #f8fafc;
  border: 1px solid #edf2f7;
}

.pe-detail svg {
  color: #2563eb;
  flex: 0 0 auto;
  margin-top: 2px;
}

.pe-detail span {
  display: block;
  color: #64748b;
  font-size: .76rem;
  font-weight: 900;
  margin-bottom: 5px;
}

.pe-detail strong {
  color: #0f172a;
  font-weight: 950;
  word-break: break-word;
}

html.dark .project-employees-page .pe-control-panel,
html.dark .project-employees-page .pe-filters-card,
html.dark .project-employees-page .pe-table-card,
html.dark .project-employees-page .pe-stats,
html.dark .project-employees-page .pe-modal {
  background: #111a2d;
  border-color: #24324d;
}

html.dark .project-employees-page .pe-stat,
html.dark .project-employees-page .pe-detail,
html.dark .project-employees-page .pe-table-wrap,
html.dark .project-employees-page .pe-view,
html.dark .project-employees-page .pe-reset,
html.dark .project-employees-page .pe-gas {
  background: #0f1728;
  border-color: #24324d;
}

html.dark .project-employees-page th {
  background: #0f1728;
  color: #cbd5e1;
}

html.dark .project-employees-page td,
html.dark .project-employees-page h2,
html.dark .project-employees-page h3,
html.dark .project-employees-page .pe-filter-title,
html.dark .project-employees-page .pe-detail strong,
html.dark .project-employees-page .pe-stat strong,
html.dark .project-employees-page .pe-employee-cell strong {
  color: #e5eefc;
}

html.dark .project-employees-page p,
html.dark .project-employees-page .pe-detail span,
html.dark .project-employees-page .pe-stat span,
html.dark .project-employees-page .pe-employee-cell span {
  color: #9fb0cf;
}

html.dark .project-employees-page select,
html.dark .project-employees-page input {
  background: #0f1728;
  color: #e5eefc;
  border-color: #31415f;
}

html.dark .project-employees-page tbody tr:hover {
  background: #0f1728;
}

@media (max-width: 1200px) {
  .pe-control-panel {
    grid-template-columns: 1fr 1fr;
  }

  .pe-reset {
    grid-column: 1 / -1;
  }

  .pe-filters {
    grid-template-columns: repeat(2, minmax(180px, 1fr));
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

  .pe-control-panel,
  .pe-filters,
  .pe-stats {
    grid-template-columns: 1fr;
  }

  .pe-control-panel,
  .pe-filters-card,
  .pe-table-card,
  .pe-stats {
    border-radius: 22px;
  }

  .pe-table-card {
    padding: 14px;
  }

  .pe-details-grid {
    grid-template-columns: 1fr;
  }

  .pe-table-head {
    display: grid;
  }

  table {
    min-width: 900px;
  }
}
`;
