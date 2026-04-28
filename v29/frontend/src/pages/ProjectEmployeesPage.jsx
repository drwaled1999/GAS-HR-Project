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
  CheckSquare,
  Square,
  ArrowUpDown,
  FileText,
  Clock3,
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

function getRowId(e) {
  return String(e?.id || e?.employee_id || e?.employeeId || getGasId(e) || getName(e));
}

function hasMissingData(e) {
  return (
    !getGasId(e) ||
    getGasId(e) === "-" ||
    !getName(e) ||
    getName(e) === "-" ||
    !e?.job_title ||
    !e?.nationality ||
    !e?.package_name ||
    !e?.email
  );
}

function formatDate(value) {
  if (!value) return "-";

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;

  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getRowHours(r) {
  const savedHours = Number(r.hours ?? r.regular_hours);

  if (Number.isFinite(savedHours) && savedHours > 0) {
    return savedHours;
  }

  if (!r.check_in || !r.check_out || r.check_in === "-" || r.check_out === "-") {
    return 0;
  }

  const [inH, inM, inS = 0] = String(r.check_in).split(":").map(Number);
  const [outH, outM, outS = 0] = String(r.check_out).split(":").map(Number);

  if (
    Number.isNaN(inH) ||
    Number.isNaN(inM) ||
    Number.isNaN(outH) ||
    Number.isNaN(outM)
  ) {
    return 0;
  }

  const inMinutes = inH * 60 + inM + inS / 60;
  const outMinutes = outH * 60 + outM + outS / 60;

  const diff = Math.max(0, outMinutes - inMinutes) / 60;
  return Math.round(diff * 100) / 100;
}

function getAttendanceStatus(r) {
  const note = String(r.exception_text || r.override_note || r.leave_text || "").toLowerCase();
  const status = String(r.status || "").toLowerCase();

  if (
    note.includes("absence") ||
    note.includes("absent") ||
    status.includes("absent") ||
    (!r.check_in && !r.check_out)
  ) {
    return "Absent";
  }

  if (r.check_in && !r.check_out) return "Single Punch";
  if (r.check_in && r.check_out) return "Present";

  return r.status || "-";
}

export default function ProjectEmployeesPage() {
  const now = new Date();

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
  const [packageFilter, setPackageFilter] = useState("all");
  const [missingFilter, setMissingFilter] = useState("all");

  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [sortKey, setSortKey] = useState("name");
  const [sortDir, setSortDir] = useState("asc");

  const [attendanceModal, setAttendanceModal] = useState(null);
  const [attendanceRows, setAttendanceRows] = useState([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceError, setAttendanceError] = useState("");
  const [attendanceMonth, setAttendanceMonth] = useState(now.getMonth() + 1);
  const [attendanceYear, setAttendanceYear] = useState(now.getFullYear());

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
      const list = result?.projects || result?.data || result?.rows || result || [];

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
      setSelectedIds([]);
      return;
    }

    try {
      setLoadingEmployees(true);
      setError("");

      const result = await apiFetch(`${API_BASE}/users/by-project/${selectedProjectId}`);
      const list = result?.employees || result?.data || result?.rows || [];

      setEmployees(Array.isArray(list) ? list : []);
      setSelectedIds([]);
    } catch (err) {
      console.error(err);
      setEmployees([]);
      setSelectedIds([]);
      setError(err.message || "Failed to load project employees");
    } finally {
      setLoadingEmployees(false);
    }
  }

  async function loadAttendanceForEmployee(employee, month = attendanceMonth, year = attendanceYear) {
    const gasId = getGasId(employee);

    try {
      setAttendanceModal(employee);
      setAttendanceLoading(true);
      setAttendanceError("");
      setAttendanceRows([]);

      const result = await apiFetch(
        `${API_BASE}/attendance/employee/${encodeURIComponent(gasId)}?month=${month}&year=${year}`
      );

      const rows = result?.records || result?.data || result?.rows || [];
      setAttendanceRows(Array.isArray(rows) ? rows : []);
    } catch (err) {
      console.error(err);
      setAttendanceRows([]);
      setAttendanceError(err.message || "Failed to load attendance");
    } finally {
      setAttendanceLoading(false);
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

  const packages = useMemo(() => {
    const set = new Set();
    employees.forEach((e) => {
      const pkg = e.package_name || e.packageName || e.package_id;
      if (pkg) set.add(String(pkg));
    });
    return Array.from(set).sort();
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    const q = search.trim().toLowerCase();

    const filtered = employees.filter((e) => {
      const gasId = String(getGasId(e));
      const name = String(getName(e));
      const mobile = String(e.mobile || e.phone || "");
      const email = String(e.email || "");
      const nationality = e.nationality || "";
      const status = String(e.status || "").toLowerCase();
      const job = e.job_title || e.jobTitle || "";
      const pkg = String(e.package_name || e.packageName || e.package_id || "");
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

      const matchesStatus = statusFilter === "all" || status === statusFilter;
      const matchesType = typeFilter === "all" || employeeType.toLowerCase() === typeFilter;
      const matchesJob = jobFilter === "all" || job === jobFilter;
      const matchesPackage = packageFilter === "all" || pkg === packageFilter;

      const matchesMissing =
        missingFilter === "all" ||
        (missingFilter === "missing" && hasMissingData(e)) ||
        (missingFilter === "complete" && !hasMissingData(e));

      return (
        matchesSearch &&
        matchesNationality &&
        matchesStatus &&
        matchesType &&
        matchesJob &&
        matchesPackage &&
        matchesMissing
      );
    });

    return [...filtered].sort((a, b) => {
      const getValue = (row) => {
        if (sortKey === "name") return getName(row);
        if (sortKey === "gas") return getGasId(row);
        if (sortKey === "job") return row.job_title || row.jobTitle || "";
        if (sortKey === "nationality") return row.nationality || "";
        if (sortKey === "package") return row.package_name || row.packageName || row.package_id || "";
        if (sortKey === "status") return row.status || "";
        return "";
      };

      const av = String(getValue(a)).toLowerCase();
      const bv = String(getValue(b)).toLowerCase();

      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [
    employees,
    search,
    nationalityFilter,
    statusFilter,
    typeFilter,
    jobFilter,
    packageFilter,
    missingFilter,
    sortKey,
    sortDir,
  ]);

  const stats = useMemo(() => {
    const total = filteredEmployees.length;
    const saudi = filteredEmployees.filter((e) => isSaudi(e.nationality)).length;
    const nonSaudi = total - saudi;
    const active = filteredEmployees.filter(
      (e) => String(e.status || "").toLowerCase() === "active"
    ).length;
    const inactive = total - active;
    const gas = filteredEmployees.filter((e) => getEmployeeType(getGasId(e)) === "GAS").length;
    const rental = filteredEmployees.filter((e) => getEmployeeType(getGasId(e)) === "Rental").length;
    const missing = filteredEmployees.filter((e) => hasMissingData(e)).length;

    return { total, saudi, nonSaudi, active, inactive, gas, rental, missing };
  }, [filteredEmployees]);

  const selectedRows = useMemo(() => {
    return filteredEmployees.filter((e) => selectedIds.includes(getRowId(e)));
  }, [filteredEmployees, selectedIds]);

  function resetFilters() {
    setSearch("");
    setNationalityFilter("all");
    setStatusFilter("all");
    setTypeFilter("all");
    setJobFilter("all");
    setPackageFilter("all");
    setMissingFilter("all");
    setSortKey("name");
    setSortDir("asc");
    setSelectedIds([]);
  }

  function toggleSort(key) {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir("asc");
  }

  function toggleRow(e) {
    const id = getRowId(e);
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function toggleAllRows() {
    const allIds = filteredEmployees.map((e) => getRowId(e));
    const allSelected =
      allIds.length > 0 && allIds.every((id) => selectedIds.includes(id));

    setSelectedIds(allSelected ? [] : allIds);
  }

  function exportCSV(onlySelected = false) {
    const sourceRows = onlySelected && selectedRows.length ? selectedRows : filteredEmployees;

    const headers = [
      "GAS ID",
      "Employee Name",
      "Username",
      "Job Title",
      "Nationality",
      "Status",
      "Type",
      "Mobile",
      "Email",
      "Package",
      "Project",
      "Missing Data",
    ];

    const rows = sourceRows.map((e) => [
      getGasId(e),
      getName(e),
      e.username || "",
      e.job_title || e.jobTitle || "",
      e.nationality || "",
      e.status || "",
      getEmployeeType(getGasId(e)),
      e.mobile || e.phone || "",
      e.email || "",
      e.package_name || e.packageName || e.package_id || "",
      e.project_name || e.projectName || selectedProjectName || "",
      hasMissingData(e) ? "Yes" : "No",
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

  function openEditUser(e) {
    const id = e.id || e.employee_id || e.employeeId;
    window.open(`/users?edit=${encodeURIComponent(id)}`, "_blank");
  }

  return (
    <div className="project-employees-page">
      <style>{styles}</style>

      <section className="pe-hero">
        <div>
          <div className="pe-badge">
            <Building2 size={16} />
            Enterprise Workforce Console
          </div>

          <h1>Project Employees Details</h1>

          <p>
            Advanced HR view for project workforce, employee details, missing data,
            filtering, selection, export, and attendance preview.
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
            <span>
              <FileText size={15} />
              {stats.missing} Missing Data
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
        <StatCard icon={Users} label="Total" value={stats.total} tone="blue" />
        <StatCard icon={Flag} label="Saudi" value={stats.saudi} tone="green" />
        <StatCard icon={Users} label="Non-Saudi" value={stats.nonSaudi} tone="orange" />
        <StatCard icon={UserCheck} label="Active" value={stats.active} tone="emerald" />
        <StatCard icon={UserX} label="Inactive" value={stats.inactive} tone="red" />
        <StatCard icon={BadgeCheck} label="GAS" value={stats.gas} tone="sky" />
        <StatCard icon={Briefcase} label="Rental" value={stats.rental} tone="purple" />
        <StatCard icon={FileText} label="Missing" value={stats.missing} tone="amber" />
      </section>

      <section className="pe-filters-card">
        <div className="pe-filter-head">
          <div className="pe-filter-title">
            <Filter size={18} />
            Smart Filters
          </div>

          <div className="pe-selected-info">{selectedRows.length} selected</div>
        </div>

        <div className="pe-filters">
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

          <select value={packageFilter} onChange={(e) => setPackageFilter(e.target.value)}>
            <option value="all">All Packages</option>
            {packages.map((pkg) => (
              <option key={pkg} value={pkg}>
                {pkg}
              </option>
            ))}
          </select>

          <select value={jobFilter} onChange={(e) => setJobFilter(e.target.value)}>
            <option value="all">All Job Titles</option>
            {jobTitles.map((j) => (
              <option key={j} value={j}>
                {j}
              </option>
            ))}
          </select>

          <select value={missingFilter} onChange={(e) => setMissingFilter(e.target.value)}>
            <option value="all">All Data</option>
            <option value="missing">Missing Info</option>
            <option value="complete">Complete Info</option>
          </select>
        </div>

        <div className="pe-actions-bar">
          <button className="pe-export" onClick={() => exportCSV(false)} disabled={!filteredEmployees.length}>
            <Download size={17} />
            Export All
          </button>

          <button className="pe-export secondary" onClick={() => exportCSV(true)} disabled={!selectedRows.length}>
            <Download size={17} />
            Export Selected
          </button>
        </div>
      </section>

      <section className="pe-table-card">
        <div className="pe-table-head">
          <div>
            <h2>{selectedProjectName}</h2>
            <p>
              {filteredEmployees.length} employees displayed
              {selectedRows.length ? ` • ${selectedRows.length} selected` : ""}
            </p>
          </div>

          <div className="pe-table-actions">
            <span>{loadingEmployees ? "Loading..." : "Ready"}</span>
          </div>
        </div>

        <div className="pe-table-wrap">
          <table>
            <thead>
              <tr>
                <th>
                  <button className="pe-check-btn" onClick={toggleAllRows}>
                    {filteredEmployees.length > 0 &&
                    filteredEmployees.every((e) => selectedIds.includes(getRowId(e))) ? (
                      <CheckSquare size={18} />
                    ) : (
                      <Square size={18} />
                    )}
                  </button>
                </th>
                <SortableTh label="Employee" sortKey="name" current={sortKey} dir={sortDir} onClick={toggleSort} />
                <SortableTh label="GAS ID" sortKey="gas" current={sortKey} dir={sortDir} onClick={toggleSort} />
                <SortableTh label="Job Title" sortKey="job" current={sortKey} dir={sortDir} onClick={toggleSort} />
                <SortableTh label="Nationality" sortKey="nationality" current={sortKey} dir={sortDir} onClick={toggleSort} />
                <th>Type</th>
                <SortableTh label="Status" sortKey="status" current={sortKey} dir={sortDir} onClick={toggleSort} />
                <SortableTh label="Package" sortKey="package" current={sortKey} dir={sortDir} onClick={toggleSort} />
                <th>Data</th>
                <th>Actions</th>
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
                  const rowId = getRowId(e);
                  const gasId = getGasId(e);
                  const name = getName(e);
                  const type = getEmployeeType(gasId);
                  const status = String(e.status || "active").toLowerCase();
                  const selected = selectedIds.includes(rowId);
                  const missing = hasMissingData(e);

                  return (
                    <tr key={rowId} className={selected ? "selected" : ""}>
                      <td>
                        <button className="pe-check-btn" onClick={() => toggleRow(e)}>
                          {selected ? <CheckSquare size={18} /> : <Square size={18} />}
                        </button>
                      </td>

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

                      <td>{safeText(e.package_name || e.packageName || e.package_id)}</td>

                      <td>
                        <span className={`pe-data ${missing ? "missing" : "complete"}`}>
                          {missing ? "Missing" : "Complete"}
                        </span>
                      </td>

                      <td>
                        <div className="pe-row-actions">
                          <button className="pe-view" onClick={() => setSelectedEmployee(e)}>
                            <Eye size={15} />
                            View
                          </button>

                          <button className="pe-view" onClick={() => openEditUser(e)}>
                            Edit
                          </button>

                          <button className="pe-view" onClick={() => loadAttendanceForEmployee(e)}>
                            <Clock3 size={15} />
                            Attendance
                          </button>
                        </div>
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
        <EmployeeDetailsModal
          employee={selectedEmployee}
          selectedProjectName={selectedProjectName}
          onClose={() => setSelectedEmployee(null)}
          onEdit={openEditUser}
          onAttendance={loadAttendanceForEmployee}
        />
      ) : null}

      {attendanceModal ? (
        <AttendanceModal
          employee={attendanceModal}
          rows={attendanceRows}
          loading={attendanceLoading}
          error={attendanceError}
          month={attendanceMonth}
          year={attendanceYear}
          setMonth={setAttendanceMonth}
          setYear={setAttendanceYear}
          onReload={() => loadAttendanceForEmployee(attendanceModal, attendanceMonth, attendanceYear)}
          onClose={() => setAttendanceModal(null)}
        />
      ) : null}
    </div>
  );
}

function EmployeeDetailsModal({ employee, selectedProjectName, onClose, onEdit, onAttendance }) {
  return (
    <div className="pe-modal-backdrop" onClick={onClose}>
      <div className="pe-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pe-modal-head">
          <div className="pe-employee-cell modal-title">
            <div className="pe-avatar big">
              {String(getName(employee)).charAt(0).toUpperCase()}
            </div>
            <div>
              <h3>{safeText(getName(employee))}</h3>
              <p>GAS ID: {safeText(getGasId(employee))}</p>
            </div>
          </div>

          <button onClick={onClose}>×</button>
        </div>

        <div className="pe-details-grid">
          <Detail icon={Badge} label="GAS ID" value={getGasId(employee)} />
          <Detail icon={UserRound} label="Employee Name" value={getName(employee)} />
          <Detail icon={Briefcase} label="Job Title" value={employee.job_title || employee.jobTitle} />
          <Detail icon={Flag} label="Nationality" value={employee.nationality} />
          <Detail icon={BadgeCheck} label="Status" value={employee.status} />
          <Detail icon={Layers} label="Type" value={getEmployeeType(getGasId(employee))} />
          <Detail icon={Phone} label="Mobile" value={employee.mobile || employee.phone} />
          <Detail icon={Mail} label="Email" value={employee.email} />
          <Detail icon={Building2} label="Project" value={employee.project_name || employee.projectName || selectedProjectName} />
          <Detail icon={Layers} label="Package" value={employee.package_name || employee.packageName || employee.package_id} />
        </div>

        <div className="pe-modal-actions">
          <button onClick={() => onEdit(employee)}>Edit Employee</button>
          <button onClick={() => onAttendance(employee)}>View Attendance</button>
        </div>
      </div>
    </div>
  );
}

function AttendanceModal({
  employee,
  rows,
  loading,
  error,
  month,
  year,
  setMonth,
  setYear,
  onReload,
  onClose,
}) {
  const cleanedRows = Array.isArray(rows) ? rows : [];

  const summary = cleanedRows.reduce(
    (acc, r) => {
      const status = getAttendanceStatus(r);
      const hours = getRowHours(r);

      acc.days += 1;
      acc.hours += hours;

      if (status === "Present") acc.present += 1;
      if (status === "Absent") acc.absent += 1;
      if (status === "Single Punch") acc.singlePunch += 1;

      return acc;
    },
    { days: 0, hours: 0, present: 0, absent: 0, singlePunch: 0 }
  );

  return (
    <div className="pe-modal-backdrop" onClick={onClose}>
      <div className="pe-modal attendance-modal pro-attendance" onClick={(e) => e.stopPropagation()}>
        <div className="attendance-header">
          <div className="attendance-identity">
            <div className="pe-avatar big">
              {String(getName(employee)).charAt(0).toUpperCase()}
            </div>

            <div>
              <span className="attendance-label">Attendance Preview</span>
              <h3>{safeText(getName(employee))}</h3>
              <p>GAS ID: {safeText(getGasId(employee))}</p>
            </div>
          </div>

          <button className="attendance-close" onClick={onClose}>×</button>
        </div>

        <div className="attendance-toolbar pro">
          <label>
            <span>Month</span>
            <input
              type="number"
              min="1"
              max="12"
              value={month}
              onChange={(e) => setMonth(Number(e.target.value) || 1)}
            />
          </label>

          <label>
            <span>Year</span>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value) || new Date().getFullYear())}
            />
          </label>

          <button onClick={onReload}>
            <RefreshCw size={16} className={loading ? "pe-spin" : ""} />
            Load Attendance
          </button>
        </div>

        <div className="attendance-kpis">
          <div className="attendance-kpi blue">
            <span>Loaded Days</span>
            <strong>{summary.days}</strong>
          </div>

          <div className="attendance-kpi green">
            <span>Total Hours</span>
            <strong>{summary.hours.toFixed(2)}</strong>
          </div>

          <div className="attendance-kpi emerald">
            <span>Present</span>
            <strong>{summary.present}</strong>
          </div>

          <div className="attendance-kpi red">
            <span>Absent</span>
            <strong>{summary.absent}</strong>
          </div>

          <div className="attendance-kpi orange">
            <span>Single Punch</span>
            <strong>{summary.singlePunch}</strong>
          </div>
        </div>

        {error ? <div className="pe-error">{error}</div> : null}

        {loading ? (
          <div className="pe-loading-row">
            <RefreshCw className="pe-spin" size={20} />
            Loading attendance...
          </div>
        ) : cleanedRows.length ? (
          <div className="attendance-table-card">
            <table className="attendance-pro-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Check In</th>
                  <th>Check Out</th>
                  <th>Hours</th>
                  <th>Status</th>
                  <th>Note</th>
                </tr>
              </thead>

              <tbody>
                {cleanedRows.map((r, index) => {
                  const status = getAttendanceStatus(r);
                  const hours = getRowHours(r);

                  return (
                    <tr key={r.id || `${r.work_date || r.date}-${index}`}>
                      <td>
                        <strong>{formatDate(r.work_date || r.date)}</strong>
                      </td>

                      <td>{safeText(r.check_in)}</td>
                      <td>{safeText(r.check_out)}</td>

                      <td>
                        <span className="hours-pill">{hours.toFixed(2)}</span>
                      </td>

                      <td>
                        <span
                          className={`attendance-status ${
                            status === "Present"
                              ? "present"
                              : status === "Absent"
                              ? "absent"
                              : "single"
                          }`}
                        >
                          {status}
                        </span>
                      </td>

                      <td className="attendance-note">
                        {safeText(r.exception_text || r.override_note || r.leave_text)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="pe-empty">
            <Clock3 size={34} />
            <strong>No attendance found</strong>
            <span>No attendance records for this employee in selected month.</span>
          </div>
        )}
      </div>
    </div>
  );
}

function SortableTh({ label, sortKey, current, dir, onClick }) {
  return (
    <th>
      <button className="pe-sort-btn" onClick={() => onClick(sortKey)}>
        {label}
        <ArrowUpDown size={14} />
        {current === sortKey ? <span>{dir === "asc" ? "ASC" : "DESC"}</span> : null}
      </button>
    </th>
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

button {
  font-family: inherit;
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
.pe-filters select,
.attendance-toolbar.pro input {
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
.pe-filters select:focus,
.attendance-toolbar.pro input:focus {
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
  grid-template-columns: repeat(auto-fit, minmax(145px, 1fr));
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
.pe-stat.amber .pe-stat-icon { background: #fffbeb; color: #b45309; }

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

.pe-filter-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  margin-bottom: 13px;
}

.pe-filter-title {
  display: flex;
  align-items: center;
  gap: 9px;
  color: #0f172a;
  font-weight: 950;
}

.pe-selected-info {
  min-height: 30px;
  padding: 0 11px;
  border-radius: 999px;
  background: #eff6ff;
  color: #1d4ed8;
  display: inline-flex;
  align-items: center;
  font-size: .78rem;
  font-weight: 950;
}

.pe-filters {
  display: grid;
  grid-template-columns: repeat(3, minmax(170px, 1fr));
  gap: 12px;
}

.pe-actions-bar {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 12px;
}

.pe-export {
  min-height: 44px;
  min-width: 140px;
  padding: 0 17px;
  border-radius: 15px;
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  color: #fff;
  box-shadow: 0 12px 25px rgba(37,99,235,.2);
  white-space: nowrap;
}

.pe-export.secondary {
  background: #0f172a;
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
  min-width: 1080px;
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

tbody tr.selected {
  background: #eff6ff;
}

.pe-check-btn,
.pe-sort-btn {
  border: 0;
  background: transparent;
  cursor: pointer;
  color: #334155;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 950;
  padding: 0;
}

.pe-sort-btn span {
  font-size: .62rem;
  color: #2563eb;
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
.pe-status,
.pe-data {
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
.pe-status.active,
.pe-data.complete {
  background: #ecfdf3;
  color: #047857;
}

.pe-pill.rental {
  background: #f5f3ff;
  color: #6d28d9;
}

.pe-status.inactive,
.pe-data.missing {
  background: #fff1f2;
  color: #be123c;
}

.pe-row-actions {
  display: flex;
  gap: 7px;
}

.pe-view {
  min-height: 34px;
  padding: 0 10px;
  border-radius: 12px;
  background: #f1f5f9;
  color: #0f172a;
  border: 1px solid #e2e8f0;
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

.pe-modal-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 16px;
}

.pe-modal-actions button {
  min-height: 42px;
  border: none;
  border-radius: 14px;
  padding: 0 14px;
  cursor: pointer;
  background: #2563eb;
  color: #fff;
  font-weight: 950;
}

.pe-modal-actions button:nth-child(2) {
  background: #0f172a;
}

.pro-attendance {
  width: min(1180px, 96vw);
  padding: 26px;
  border-radius: 34px;
}

.attendance-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 18px;
  margin-bottom: 20px;
  padding: 22px;
  border-radius: 26px;
  color: #fff;
  background:
    radial-gradient(circle at top right, rgba(59,130,246,.45), transparent 35%),
    linear-gradient(135deg, #020617, #0f172a 48%, #1e3a8a);
}

.attendance-identity {
  display: flex;
  align-items: center;
  gap: 14px;
}

.attendance-label {
  display: inline-flex;
  margin-bottom: 6px;
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(255,255,255,.14);
  color: #dbeafe;
  font-size: .75rem;
  font-weight: 950;
}

.attendance-header h3 {
  margin: 0;
  font-size: 1.45rem;
  font-weight: 950;
  color: #fff;
}

.attendance-header p {
  margin: 5px 0 0;
  color: rgba(255,255,255,.78);
  font-weight: 850;
}

.attendance-close {
  width: 42px;
  height: 42px;
  border: 0;
  border-radius: 16px;
  background: rgba(255,255,255,.13);
  color: #fff;
  font-size: 1.6rem;
  cursor: pointer;
}

.attendance-toolbar.pro {
  display: grid;
  grid-template-columns: 170px 170px 1fr;
  gap: 12px;
  padding: 16px;
  border-radius: 24px;
  background: #f8fafc;
  border: 1px solid #e5eaf1;
  margin-bottom: 16px;
}

.attendance-toolbar.pro label {
  display: grid;
  gap: 7px;
}

.attendance-toolbar.pro span {
  color: #64748b;
  font-size: .78rem;
  font-weight: 950;
}

.attendance-toolbar.pro button {
  align-self: end;
  min-height: 50px;
  border: 0;
  border-radius: 17px;
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  color: #fff;
  font-weight: 950;
  cursor: pointer;
  display: inline-flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
}

.attendance-kpis {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.attendance-kpi {
  padding: 16px;
  border-radius: 22px;
  border: 1px solid #e5eaf1;
  background: #f8fafc;
}

.attendance-kpi span {
  display: block;
  color: #64748b;
  font-size: .76rem;
  font-weight: 950;
  margin-bottom: 8px;
}

.attendance-kpi strong {
  display: block;
  color: #0f172a;
  font-size: 1.55rem;
  font-weight: 950;
}

.attendance-kpi.blue { background: #eff6ff; }
.attendance-kpi.green { background: #ecfdf3; }
.attendance-kpi.emerald { background: #dcfce7; }
.attendance-kpi.red { background: #fff1f2; }
.attendance-kpi.orange { background: #fff7ed; }

.attendance-table-card {
  overflow: auto;
  border: 1px solid #e5eaf1;
  border-radius: 24px;
  max-height: 470px;
}

.attendance-pro-table {
  width: 100%;
  min-width: 850px;
  border-collapse: collapse;
}

.attendance-pro-table th {
  position: sticky;
  top: 0;
  z-index: 2;
  padding: 14px 16px;
  background: #f8fafc;
  color: #334155;
  font-size: .78rem;
  font-weight: 950;
  text-align: left;
  border-bottom: 1px solid #e5eaf1;
}

.attendance-pro-table td {
  padding: 15px 16px;
  color: #0f172a;
  border-top: 1px solid #eef2f7;
  white-space: nowrap;
}

.attendance-pro-table tbody tr:hover {
  background: #f8fafc;
}

.hours-pill {
  display: inline-flex;
  min-height: 30px;
  align-items: center;
  padding: 0 11px;
  border-radius: 999px;
  background: #eff6ff;
  color: #1d4ed8;
  font-weight: 950;
}

.attendance-status {
  display: inline-flex;
  min-height: 30px;
  align-items: center;
  padding: 0 12px;
  border-radius: 999px;
  font-size: .75rem;
  font-weight: 950;
}

.attendance-status.present {
  background: #ecfdf3;
  color: #047857;
}

.attendance-status.absent {
  background: #fff1f2;
  color: #be123c;
}

.attendance-status.single {
  background: #fff7ed;
  color: #c2410c;
}

.attendance-note {
  color: #475569;
  white-space: normal !important;
  min-width: 260px;
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
}

@media (max-width: 900px) {
  .attendance-toolbar.pro,
  .attendance-kpis {
    grid-template-columns: 1fr;
  }

  .pro-attendance {
    padding: 16px;
  }

  .attendance-header {
    padding: 18px;
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
    min-width: 1000px;
  }
}
`;
