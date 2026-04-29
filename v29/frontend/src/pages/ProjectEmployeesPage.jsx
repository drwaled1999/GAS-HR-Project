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
  BarChart3,
  PieChart,
  Activity,
  CalendarDays,
  Database,
  Sparkles,
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
  return String(
    e?.id || e?.employee_id || e?.employeeId || getGasId(e) || getName(e)
  );
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

function cellToHours(cell) {
  const value = cell?.value;
  if (value === null || value === undefined || value === "") return 0;

  const numeric = Number(value);
  if (Number.isFinite(numeric)) return Math.round(numeric);

  return 0;
}

function getAttendanceStatusFromCell(cell) {
  const value = String(cell?.value ?? "").trim().toUpperCase();
  const type = String(cell?.type || "").toLowerCase();

  if (value === "A" || type.includes("absent")) return "Absent";
  if (value === "SP" || type.includes("single")) return "Single Punch";
  if (value === "OFF" || type.includes("weekend")) return "OFF";
  if (value === "V" || type.includes("leave")) return "Leave";
  if (value === "SL" || type.includes("sick")) return "Sick Leave";
  if (value === "EL") return "Emergency Leave";
  if (value === "P" || type.includes("permission")) return "Permission";
  if (value === "TA" || type.includes("takleef")) return "Takleef";

  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) return "Present";

  return value || "-";
}

function pct(value, total) {
  if (!total) return 0;
  return Math.round((Number(value || 0) / Number(total || 1)) * 100);
}

function countBy(list, getter) {
  const map = {};
  list.forEach((item) => {
    const key = safeText(getter(item));
    map[key] = (map[key] || 0) + 1;
  });
  return Object.entries(map)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
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
  const [attendanceTotalHours, setAttendanceTotalHours] = useState(0);

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
        result?.projects || result?.data || result?.rows || result || [];

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

      const result = await apiFetch(
        `${API_BASE}/users/by-project/${selectedProjectId}`
      );

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

  async function loadAttendanceForEmployee(
    employee,
    month = attendanceMonth,
    year = attendanceYear
  ) {
    const gasId = String(getGasId(employee)).trim();

    try {
      setAttendanceModal(employee);
      setAttendanceLoading(true);
      setAttendanceError("");
      setAttendanceRows([]);
      setAttendanceTotalHours(0);

      const result = await apiFetch(
        `${API_BASE}/attendance/sheet?month=${month}&year=${year}`
      );

      const rows = result?.data?.rows || result?.rows || [];
      const days = result?.data?.days || [];

      const employeeRow = rows.find((row) => {
        return String(row?.userId || "").trim() === gasId;
      });

      if (!employeeRow) {
        setAttendanceRows([]);
        setAttendanceTotalHours(0);
        setAttendanceError(
          "No attendance found for this employee in attendance sheet."
        );
        return;
      }

      const mappedRows = (employeeRow.cells || []).map((cell, index) => {
        const day = days[index] || {};
        const status = getAttendanceStatusFromCell(cell);
        const hours = cellToHours(cell);

        return {
          id: cell?.rowId || `${gasId}-${day?.key || index}`,
          work_date: day?.key || "",
          date: day?.key || "",
          day_label: day?.label || "",
          check_in: cell?.checkIn || cell?.check_in || "",
          check_out: cell?.checkOut || cell?.check_out || "",
          hours,
          status,
          exception_text: cell?.value ?? "",
          type: cell?.type || "",
        };
      });

      setAttendanceRows(mappedRows);
      setAttendanceTotalHours(Math.round(Number(employeeRow.totalHours || 0)));
    } catch (err) {
      console.error(err);
      setAttendanceRows([]);
      setAttendanceTotalHours(0);
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

      const matchesType =
        typeFilter === "all" || employeeType.toLowerCase() === typeFilter;

      const matchesJob = jobFilter === "all" || job === jobFilter;

      const matchesPackage =
        packageFilter === "all" || pkg === packageFilter;

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
        if (sortKey === "package")
          return row.package_name || row.packageName || row.package_id || "";
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

    const gas = filteredEmployees.filter(
      (e) => getEmployeeType(getGasId(e)) === "GAS"
    ).length;

    const rental = filteredEmployees.filter(
      (e) => getEmployeeType(getGasId(e)) === "Rental"
    ).length;

    const missing = filteredEmployees.filter((e) => hasMissingData(e)).length;

    return { total, saudi, nonSaudi, active, inactive, gas, rental, missing };
  }, [filteredEmployees]);

  const analytics = useMemo(() => {
    const jobData = countBy(
      filteredEmployees,
      (e) => e.job_title || e.jobTitle || "Unassigned"
    ).slice(0, 7);

    const packageData = countBy(
      filteredEmployees,
      (e) => e.package_name || e.packageName || e.package_id || "No Package"
    ).slice(0, 7);

    const maxJob = Math.max(1, ...jobData.map((x) => x.value));
    const maxPackage = Math.max(1, ...packageData.map((x) => x.value));

    return { jobData, packageData, maxJob, maxPackage };
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
    const sourceRows =
      onlySelected && selectedRows.length ? selectedRows : filteredEmployees;

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

  function exportAttendanceCSV() {
    if (!attendanceModal || !attendanceRows.length) return;

    const headers = [
      "Date",
      "Check In",
      "Check Out",
      "Hours",
      "Status",
      "Value / Note",
    ];

    const rows = attendanceRows.map((r) => [
      r.work_date || r.date || "",
      r.check_in || "",
      r.check_out || "",
      r.hours || 0,
      r.status || "",
      r.exception_text || "",
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
    a.download = `attendance-${getGasId(attendanceModal)}-${attendanceMonth}-${attendanceYear}.csv`;
    a.click();

    URL.revokeObjectURL(url);
  }

  function openEditUser(e) {
    const id = e.id || e.employee_id || e.employeeId;
    window.open(`/users?edit=${encodeURIComponent(id)}`, "_blank");
  }

  return (
    <div className="project-employees-page v4-page">
      <style>{styles}</style>

      <section className="v4-hero">
        <div className="v4-hero-main">
          <div className="v4-badge">
            <Sparkles size={16} />
            GAS Arabian HR Intelligence
          </div>

          <h1>Project Workforce Command Center</h1>

          <p>
            Enterprise dashboard for project employees, workforce analytics,
            project filtering, CSV export, and attendance intelligence from the
            same monthly attendance sheet source.
          </p>

          <div className="v4-hero-actions">
            <button
              className="v4-hero-btn primary"
              onClick={() => loadEmployees()}
              disabled={!projectId || loadingEmployees}
            >
              <RefreshCw
                size={17}
                className={loadingEmployees ? "pe-spin" : ""}
              />
              {loadingEmployees ? "Refreshing..." : "Refresh Workforce"}
            </button>

            <button
              className="v4-hero-btn"
              onClick={() => exportCSV(false)}
              disabled={!filteredEmployees.length}
            >
              <Download size={17} />
              Export All
            </button>
          </div>
        </div>

        <div className="v4-hero-side">
          <div className="v4-project-chip">
            <Building2 size={18} />
            <div>
              <span>Selected Project</span>
              <strong>{selectedProjectName}</strong>
            </div>
          </div>

          <div className="v4-donut-card">
            <div
              className="v4-donut"
              style={{
                background: `conic-gradient(#2563eb 0 ${pct(
                  stats.saudi,
                  stats.total
                )}%, #f97316 ${pct(stats.saudi, stats.total)}% 100%)`,
              }}
            >
              <div>
                <strong>{stats.total}</strong>
                <span>Total</span>
              </div>
            </div>

            <div className="v4-donut-legend">
              <span>
                <i className="blue" /> Saudi {stats.saudi}
              </span>
              <span>
                <i className="orange" /> Non-Saudi {stats.nonSaudi}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="v4-kpis">
        <Kpi icon={Users} label="Total Employees" value={stats.total} tone="blue" />
        <Kpi icon={Flag} label="Saudi" value={stats.saudi} tone="green" />
        <Kpi icon={Users} label="Non-Saudi" value={stats.nonSaudi} tone="orange" />
        <Kpi icon={BadgeCheck} label="GAS" value={stats.gas} tone="sky" />
        <Kpi icon={Briefcase} label="Rental" value={stats.rental} tone="purple" />
        <Kpi icon={UserCheck} label="Active" value={stats.active} tone="emerald" />
        <Kpi icon={UserX} label="Inactive" value={stats.inactive} tone="red" />
        <Kpi icon={Database} label="Missing Data" value={stats.missing} tone="amber" />
      </section>

      <section className="v4-toolbar">
        <div className="v4-toolbar-head">
          <div>
            <h2>Smart Workforce Filters</h2>
            <p>
              Filter by project, employee, nationality, package, type, status, or missing data.
            </p>
          </div>

          <div className="v4-toolbar-actions">
            <button onClick={resetFilters}>
              <X size={16} />
              Reset
            </button>

            <button
              className="dark"
              onClick={() => exportCSV(true)}
              disabled={!selectedRows.length}
            >
              <Download size={16} />
              Export Selected
            </button>
          </div>
        </div>

        <div className="v4-filters">
          <div className="v4-field project">
            <label>Project</label>
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

          <div className="v4-field search">
            <label>Search</label>
            <div className="v4-searchbox">
              <Search size={18} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name, GAS ID, mobile, email..."
              />
            </div>
          </div>

          <div className="v4-field">
            <label>Nationality</label>
            <select
              value={nationalityFilter}
              onChange={(e) => setNationalityFilter(e.target.value)}
            >
              <option value="all">All</option>
              <option value="saudi">Saudi</option>
              <option value="non-saudi">Non-Saudi</option>
            </select>
          </div>

          <div className="v4-field">
            <label>Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <div className="v4-field">
            <label>Type</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="all">All</option>
              <option value="gas">GAS</option>
              <option value="rental">Rental</option>
            </select>
          </div>

          <div className="v4-field">
            <label>Package</label>
            <select
              value={packageFilter}
              onChange={(e) => setPackageFilter(e.target.value)}
            >
              <option value="all">All</option>
              {packages.map((pkg) => (
                <option key={pkg} value={pkg}>
                  {pkg}
                </option>
              ))}
            </select>
          </div>

          <div className="v4-field">
            <label>Job Title</label>
            <select
              value={jobFilter}
              onChange={(e) => setJobFilter(e.target.value)}
            >
              <option value="all">All</option>
              {jobTitles.map((j) => (
                <option key={j} value={j}>
                  {j}
                </option>
              ))}
            </select>
          </div>

          <div className="v4-field">
            <label>Data</label>
            <select
              value={missingFilter}
              onChange={(e) => setMissingFilter(e.target.value)}
            >
              <option value="all">All</option>
              <option value="missing">Missing</option>
              <option value="complete">Complete</option>
            </select>
          </div>
        </div>
      </section>

      {error ? <div className="v4-error">{error}</div> : null}

      <section className="v4-analytics-grid">
        <div className="v4-panel">
          <PanelTitle
            icon={PieChart}
            title="Nationality Mix"
            subtitle="Saudi vs Non-Saudi distribution"
          />
          <div className="v4-split-bars">
            <SplitBar label="Saudi" value={stats.saudi} total={stats.total} tone="blue" />
            <SplitBar label="Non-Saudi" value={stats.nonSaudi} total={stats.total} tone="orange" />
            <SplitBar label="GAS" value={stats.gas} total={stats.total} tone="green" />
            <SplitBar label="Rental" value={stats.rental} total={stats.total} tone="purple" />
          </div>
        </div>

        <div className="v4-panel">
          <PanelTitle
            icon={BarChart3}
            title="Top Job Titles"
            subtitle="Most common job titles"
          />
          <MiniBars data={analytics.jobData} max={analytics.maxJob} />
        </div>

        <div className="v4-panel">
          <PanelTitle
            icon={Layers}
            title="Package Breakdown"
            subtitle="Employees by package"
          />
          <MiniBars data={analytics.packageData} max={analytics.maxPackage} />
        </div>
      </section>

      <section className="v4-table-card">
        <div className="v4-table-head">
          <div>
            <h2>{selectedProjectName}</h2>
            <p>
              {filteredEmployees.length} employees displayed
              {selectedRows.length ? ` • ${selectedRows.length} selected` : ""}
            </p>
          </div>

          <div className="v4-ready-pill">
            <Activity size={15} />
            {loadingEmployees ? "Loading..." : "Live View"}
          </div>
        </div>

        <div className="v4-table-wrap">
          <table className="v4-table">
            <thead>
              <tr>
                <th>
                  <button className="pe-check-btn" onClick={toggleAllRows}>
                    {filteredEmployees.length > 0 &&
                    filteredEmployees.every((e) =>
                      selectedIds.includes(getRowId(e))
                    ) ? (
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
                  const type = getEmployeeType(gasId);
                  const status = String(e.status || "active").toLowerCase();
                  const selected = selectedIds.includes(rowId);
                  const missing = hasMissingData(e);

                  return (
                    <tr key={rowId} className={selected ? "selected" : ""}>
                      <td>
                        <button
                          className="pe-check-btn"
                          onClick={() => toggleRow(e)}
                        >
                          {selected ? <CheckSquare size={18} /> : <Square size={18} />}
                        </button>
                      </td>

                      <td>
                        <EmployeeMini employee={e} />
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
                          {safeText(e.status || "active")}
                        </span>
                      </td>

                      <td>
                        {safeText(e.package_name || e.packageName || e.package_id)}
                      </td>

                      <td>
                        <span className={`pe-data ${missing ? "missing" : "complete"}`}>
                          {missing ? "Missing" : "Complete"}
                        </span>
                      </td>

                      <td>
                        <div className="v4-row-actions">
                          <button title="View" onClick={() => setSelectedEmployee(e)}>
                            <Eye size={16} />
                          </button>

                          <button title="Edit" onClick={() => openEditUser(e)}>
                            <UserRound size={16} />
                          </button>

                          <button
                            title="Attendance"
                            className="primary"
                            onClick={() => loadAttendanceForEmployee(e)}
                          >
                            <Clock3 size={16} />
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

          <div className="v4-mobile-cards">
            {filteredEmployees.map((e) => (
              <MobileEmployeeCard
                key={getRowId(e)}
                employee={e}
                onView={() => setSelectedEmployee(e)}
                onEdit={() => openEditUser(e)}
                onAttendance={() => loadAttendanceForEmployee(e)}
              />
            ))}
          </div>
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
          totalHours={attendanceTotalHours}
          onExport={exportAttendanceCSV}
          onReload={() =>
            loadAttendanceForEmployee(
              attendanceModal,
              attendanceMonth,
              attendanceYear
            )
          }
          onClose={() => setAttendanceModal(null)}
        />
      ) : null}
    </div>
  );
}

function EmployeeMini({ employee }) {
  const name = getName(employee);

  return (
    <div className="pe-employee-cell">
      <div className="pe-avatar">{String(name).charAt(0).toUpperCase()}</div>
      <div>
        <strong>{safeText(name)}</strong>
        <span>@{safeText(employee.username)}</span>
      </div>
    </div>
  );
}

function MobileEmployeeCard({ employee, onView, onEdit, onAttendance }) {
  const gasId = getGasId(employee);
  const type = getEmployeeType(gasId);
  const missing = hasMissingData(employee);

  return (
    <article className="v4-mobile-card">
      <div className="v4-mobile-card-head">
        <EmployeeMini employee={employee} />
        <span className={`pe-pill ${type === "Rental" ? "rental" : "gas"}`}>
          {type}
        </span>
      </div>

      <div className="v4-mobile-info">
        <InfoItem label="GAS ID" value={gasId} />
        <InfoItem label="Job" value={employee.job_title || employee.jobTitle} />
        <InfoItem label="Nationality" value={employee.nationality} />
        <InfoItem
          label="Package"
          value={employee.package_name || employee.packageName || employee.package_id}
        />
        <InfoItem label="Status" value={employee.status || "active"} />
        <InfoItem label="Data" value={missing ? "Missing" : "Complete"} />
      </div>

      <div className="v4-mobile-actions">
        <button onClick={onView}>
          <Eye size={15} />
          View
        </button>
        <button onClick={onEdit}>
          <UserRound size={15} />
          Edit
        </button>
        <button className="primary" onClick={onAttendance}>
          <Clock3 size={15} />
          Attendance
        </button>
      </div>
    </article>
  );
}

function InfoItem({ label, value }) {
  return (
    <div className="v4-info-item">
      <span>{label}</span>
      <strong>{safeText(value)}</strong>
    </div>
  );
}

function EmployeeDetailsModal({
  employee,
  selectedProjectName,
  onClose,
  onEdit,
  onAttendance,
}) {
  return (
    <div className="pe-modal-backdrop" onClick={onClose}>
      <div className="pe-modal v4-details-modal" onClick={(e) => e.stopPropagation()}>
        <div className="v4-modal-hero">
          <div className="pe-employee-cell modal-title">
            <div className="pe-avatar big">
              {String(getName(employee)).charAt(0).toUpperCase()}
            </div>
            <div>
              <span>Employee Profile</span>
              <h3>{safeText(getName(employee))}</h3>
              <p>GAS ID: {safeText(getGasId(employee))}</p>
            </div>
          </div>

          <button onClick={onClose}>×</button>
        </div>

        <div className="pe-details-grid">
          <Detail icon={Badge} label="GAS ID" value={getGasId(employee)} />
          <Detail icon={UserRound} label="Employee Name" value={getName(employee)} />
          <Detail
            icon={Briefcase}
            label="Job Title"
            value={employee.job_title || employee.jobTitle}
          />
          <Detail icon={Flag} label="Nationality" value={employee.nationality} />
          <Detail icon={BadgeCheck} label="Status" value={employee.status} />
          <Detail icon={Layers} label="Type" value={getEmployeeType(getGasId(employee))} />
          <Detail icon={Phone} label="Mobile" value={employee.mobile || employee.phone} />
          <Detail icon={Mail} label="Email" value={employee.email} />
          <Detail
            icon={Building2}
            label="Project"
            value={employee.project_name || employee.projectName || selectedProjectName}
          />
          <Detail
            icon={Layers}
            label="Package"
            value={employee.package_name || employee.packageName || employee.package_id}
          />
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
  totalHours,
  onReload,
  onExport,
  onClose,
}) {
  const cleanedRows = Array.isArray(rows) ? rows : [];

  const summary = cleanedRows.reduce(
    (acc, r) => {
      const status = String(r.status || "");

      acc.days += 1;

      if (status === "Present") acc.present += 1;
      if (status === "Absent") acc.absent += 1;
      if (status === "Single Punch") acc.singlePunch += 1;
      if (
        ["Leave", "Sick Leave", "Emergency Leave", "Permission", "Takleef", "OFF"].includes(status)
      ) {
        acc.other += 1;
      }

      return acc;
    },
    { days: 0, present: 0, absent: 0, singlePunch: 0, other: 0 }
  );

  return (
    <div className="pe-modal-backdrop" onClick={onClose}>
      <div
        className="pe-modal attendance-modal pro-attendance v4-attendance-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="attendance-header v4-attendance-header">
          <div className="attendance-identity">
            <div className="pe-avatar big">
              {String(getName(employee)).charAt(0).toUpperCase()}
            </div>

            <div>
              <span className="attendance-label">Attendance Intelligence</span>
              <h3>{safeText(getName(employee))}</h3>
              <p>GAS ID: {safeText(getGasId(employee))}</p>
            </div>
          </div>

          <button className="attendance-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="attendance-toolbar pro v4-attendance-tools">
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
              onChange={(e) =>
                setYear(Number(e.target.value) || new Date().getFullYear())
              }
            />
          </label>

          <button onClick={onReload}>
            <RefreshCw size={16} className={loading ? "pe-spin" : ""} />
            Load Attendance
          </button>

          <button className="dark" onClick={onExport} disabled={!cleanedRows.length}>
            <Download size={16} />
            Export
          </button>
        </div>

        <div className="attendance-kpis">
          <div className="attendance-kpi blue">
            <span>Loaded Days</span>
            <strong>{summary.days}</strong>
          </div>

          <div className="attendance-kpi green">
            <span>Total Hours</span>
            <strong>{totalHours}</strong>
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

        {cleanedRows.length ? (
          <div className="v4-heatmap-card">
            <div className="v4-heatmap-head">
              <div>
                <h4>Monthly Attendance Heatmap</h4>
                <p>Daily attendance status based on the approved sheet data.</p>
              </div>
              <CalendarDays size={20} />
            </div>

            <div className="v4-heatmap">
              {cleanedRows.map((r, index) => (
                <div
                  key={r.id || index}
                  title={`${formatDate(r.work_date || r.date)} - ${r.status} - ${r.exception_text}`}
                  className={`v4-heat ${
                    r.status === "Present"
                      ? "present"
                      : r.status === "Absent"
                      ? "absent"
                      : r.status === "Single Punch"
                      ? "single"
                      : "other"
                  }`}
                >
                  {index + 1}
                </div>
              ))}
            </div>
          </div>
        ) : null}

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
                  <th>Value / Note</th>
                </tr>
              </thead>

              <tbody>
                {cleanedRows.map((r, index) => (
                  <tr key={r.id || `${r.work_date || r.date}-${index}`}>
                    <td>
                      <strong>{formatDate(r.work_date || r.date)}</strong>
                    </td>

                    <td>{safeText(r.check_in)}</td>
                    <td>{safeText(r.check_out)}</td>

                    <td>
                      <span className="hours-pill">{r.hours || 0}</span>
                    </td>

                    <td>
                      <span
                        className={`attendance-status ${
                          r.status === "Present"
                            ? "present"
                            : r.status === "Absent"
                            ? "absent"
                            : r.status === "Single Punch"
                            ? "single"
                            : "other"
                        }`}
                      >
                        {safeText(r.status)}
                      </span>
                    </td>

                    <td className="attendance-note">
                      {safeText(r.exception_text)}
                    </td>
                  </tr>
                ))}
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
        {current === sortKey ? (
          <span>{dir === "asc" ? "ASC" : "DESC"}</span>
        ) : null}
      </button>
    </th>
  );
}

function Kpi({ icon: Icon, label, value, tone }) {
  return (
    <article className={`v4-kpi ${tone}`}>
      <div className="v4-kpi-icon">
        <Icon size={21} />
      </div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </article>
  );
}

function PanelTitle({ icon: Icon, title, subtitle }) {
  return (
    <div className="v4-panel-title">
      <div>
        <Icon size={19} />
      </div>
      <section>
        <h3>{title}</h3>
        <p>{subtitle}</p>
      </section>
    </div>
  );
}

function SplitBar({ label, value, total, tone }) {
  const percentage = pct(value, total);

  return (
    <div className="v4-split-row">
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <div className="v4-progress">
        <i className={tone} style={{ width: `${percentage}%` }} />
      </div>
      <small>{percentage}%</small>
    </div>
  );
}

function MiniBars({ data, max }) {
  if (!data.length) {
    return <div className="v4-empty-mini">No data available.</div>;
  }

  return (
    <div className="v4-mini-bars">
      {data.map((item) => (
        <div className="v4-mini-bar-row" key={item.label}>
          <div className="v4-mini-label">
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
          <div className="v4-mini-track">
            <i style={{ width: `${Math.max(8, (item.value / max) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
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
  color: #0f172a;
}

.project-employees-page,
.project-employees-page * {
  box-sizing: border-box;
}

.v4-page {
  --blue: #2563eb;
  --blue2: #1d4ed8;
  --sky: #0ea5e9;
  --green: #047857;
  --emerald: #059669;
  --orange: #f97316;
  --red: #e11d48;
  --purple: #7c3aed;
  --slate: #0f172a;
  --muted: #64748b;
  --line: #e5eaf1;
  --soft: #f8fafc;
  width: 100%;
  max-width: 100%;
  overflow-x: hidden;
  padding-right: 10px;
}

/* HERO */
.v4-hero {
  width: 100%;
  max-width: 100%;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(260px, 320px);
  gap: 16px;
  align-items: stretch;
  overflow: hidden;
}

.v4-hero-main,
.v4-hero-side,
.v4-toolbar,
.v4-panel,
.v4-table-card,
.v4-kpi {
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid rgba(226, 232, 240, 0.95);
  box-shadow: 0 18px 50px rgba(15, 23, 42, .07);
  backdrop-filter: blur(14px);
}

.v4-hero-main,
.v4-hero-side {
  min-width: 0;
  max-width: 100%;
}

.v4-hero-main {
  position: relative;
  overflow: hidden;
  min-height: 310px;
  padding: 34px;
  border-radius: 34px;
  color: #fff;
  background:
    radial-gradient(circle at 88% 8%, rgba(56,189,248,.42), transparent 28%),
    radial-gradient(circle at 10% 90%, rgba(37,99,235,.38), transparent 30%),
    linear-gradient(135deg, #020617 0%, #0f172a 48%, #1e3a8a 100%);
  box-shadow:
    0 24px 60px rgba(15, 23, 42, 0.18),
    inset 0 1px 0 rgba(255, 255, 255, 0.12);
}

.v4-hero-main::after {
  content: "";
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(255,255,255,.055) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,.055) 1px, transparent 1px);
  background-size: 46px 46px;
  opacity: .8;
  pointer-events: none;
}

.v4-hero-main > * {
  position: relative;
  z-index: 2;
}

.v4-badge {
  width: fit-content;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 36px;
  padding: 0 14px;
  border-radius: 999px;
  color: #dbeafe;
  background: rgba(255,255,255,.13);
  border: 1px solid rgba(255,255,255,.15);
  font-weight: 950;
  font-size: .82rem;
  margin-bottom: 18px;
}

.v4-hero-main h1 {
  margin: 0;
  max-width: 100%;
  font-size: clamp(2rem, 4vw, 3.2rem);
  font-weight: 950;
  letter-spacing: -.06em;
  line-height: 1.05;
  color: #fff;
}

.v4-hero-main p {
  margin: 15px 0 0;
  max-width: 900px;
  color: rgba(255,255,255,.82);
  line-height: 1.75;
  font-weight: 650;
}

.v4-hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 22px;
}

.v4-hero-btn {
  min-height: 46px;
  border: 1px solid rgba(255,255,255,.18);
  border-radius: 16px;
  padding: 0 16px;
  background: rgba(255,255,255,.13);
  color: #fff;
  font-weight: 950;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.v4-hero-btn.primary {
  background: linear-gradient(135deg, #38bdf8, #2563eb);
  border-color: transparent;
  box-shadow: 0 18px 35px rgba(37,99,235,.28);
}

.v4-hero-btn:disabled {
  opacity: .6;
  cursor: not-allowed;
}

/* HERO SIDE */
.v4-hero-side {
  border-radius: 34px;
  padding: 20px;
  display: grid;
  gap: 16px;
  align-content: stretch;
  overflow: hidden;
}

.v4-project-chip {
  border-radius: 24px;
  padding: 18px;
  display: flex;
  gap: 12px;
  align-items: center;
  background: linear-gradient(135deg, #eff6ff, #ffffff);
  border: 1px solid #dbeafe;
}

.v4-project-chip svg {
  color: var(--blue);
}

.v4-project-chip span {
  display: block;
  color: var(--muted);
  font-size: .78rem;
  font-weight: 900;
  margin-bottom: 4px;
}

.v4-project-chip strong {
  display: block;
  color: var(--slate);
  font-weight: 950;
  font-size: 1.02rem;
}

.v4-donut-card {
  border-radius: 26px;
  padding: 22px;
  min-height: 205px;
  background: var(--soft);
  border: 1px solid var(--line);
  display: grid;
  place-items: center;
  gap: 14px;
  max-width: 100%;
  overflow: hidden;
}

.v4-donut {
  width: min(138px, 100%);
  height: auto;
  aspect-ratio: 1 / 1;
  border-radius: 999px;
  display: grid;
  place-items: center;
  box-shadow: inset 0 0 0 1px rgba(15,23,42,.06);
}

.v4-donut > div {
  width: 92px;
  height: 92px;
  border-radius: 999px;
  background: #fff;
  display: grid;
  place-items: center;
  align-content: center;
  box-shadow: 0 12px 28px rgba(15,23,42,.08);
}

.v4-donut strong {
  font-size: 1.55rem;
  font-weight: 950;
  color: var(--slate);
  line-height: 1;
}

.v4-donut span {
  color: var(--muted);
  font-size: .72rem;
  font-weight: 900;
}

.v4-donut-legend {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: center;
}

.v4-donut-legend span {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: #334155;
  font-weight: 900;
  font-size: .78rem;
}

.v4-donut-legend i {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  display: inline-block;
}

.v4-donut-legend i.blue { background: var(--blue); }
.v4-donut-legend i.orange { background: var(--orange); }

/* KPI */
.v4-kpis {
  width: 100%;
  max-width: 100%;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(145px, 1fr));
  gap: 12px;
}

.v4-kpi {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border-radius: 24px;
  background:
    linear-gradient(180deg, rgba(255,255,255,.98), rgba(248,250,252,.96));
  box-shadow:
    0 14px 34px rgba(15, 23, 42, 0.07),
    inset 0 1px 0 rgba(255, 255, 255, 0.85);
  transition: transform .22s ease, box-shadow .22s ease;
}

.v4-kpi:hover {
  transform: translateY(-4px);
  box-shadow: 0 20px 44px rgba(15,23,42,.1);
}

.v4-kpi-icon {
  width: 46px;
  height: 46px;
  border-radius: 18px;
  display: grid;
  place-items: center;
  background: #eff6ff;
  color: var(--blue);
  flex: 0 0 auto;
}

.v4-kpi.green .v4-kpi-icon { background: #ecfdf3; color: #047857; }
.v4-kpi.orange .v4-kpi-icon { background: #fff7ed; color: #c2410c; }
.v4-kpi.emerald .v4-kpi-icon { background: #dcfce7; color: #15803d; }
.v4-kpi.red .v4-kpi-icon { background: #fff1f2; color: #be123c; }
.v4-kpi.sky .v4-kpi-icon { background: #eff6ff; color: #2563eb; }
.v4-kpi.purple .v4-kpi-icon { background: #f5f3ff; color: #6d28d9; }
.v4-kpi.amber .v4-kpi-icon { background: #fffbeb; color: #b45309; }

.v4-kpi span {
  display: block;
  color: var(--muted);
  font-size: .73rem;
  font-weight: 950;
  margin-bottom: 5px;
}

.v4-kpi strong {
  display: block;
  color: var(--slate);
  font-size: 1.42rem;
  font-weight: 950;
  line-height: 1;
}

/* TOOLBAR */
.v4-toolbar {
  width: 100%;
  max-width: 100%;
  overflow: hidden;
  padding: 18px;
  border-radius: 28px;
}

.v4-toolbar-head {
  width: 100%;
  display: flex;
  justify-content: space-between;
  gap: 14px;
  align-items: flex-start;
  margin-bottom: 16px;
}

.v4-toolbar-head h2,
.v4-table-head h2,
.v4-panel-title h3 {
  margin: 0;
  color: var(--slate);
  font-weight: 950;
  letter-spacing: -.03em;
}

.v4-toolbar-head h2 {
  font-size: 1.25rem;
}

.v4-toolbar-head p,
.v4-table-head p,
.v4-panel-title p {
  margin: 5px 0 0;
  color: var(--muted);
  font-weight: 800;
  font-size: .86rem;
}

.v4-toolbar-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.v4-toolbar-actions button,
.v4-attendance-tools button {
  min-height: 42px;
  border: 0;
  border-radius: 14px;
  padding: 0 13px;
  background: #f1f5f9;
  color: var(--slate);
  font-weight: 950;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.v4-toolbar-actions button.dark,
.v4-attendance-tools button.dark {
  background: var(--slate);
  color: #fff;
}

.v4-toolbar-actions button:disabled,
.v4-attendance-tools button:disabled {
  opacity: .6;
  cursor: not-allowed;
}

/* FILTERS */
.v4-filters {
  width: 100%;
  max-width: 100%;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(165px, 1fr));
  gap: 12px;
}

.v4-field,
.v4-field.project,
.v4-field.search {
  min-width: 0;
  grid-column: auto;
  display: grid;
  gap: 7px;
}

.v4-field label {
  color: #475569;
  font-weight: 950;
  font-size: .74rem;
}

.v4-field select,
.v4-searchbox input {
  width: 100%;
  min-width: 0;
  max-width: 100%;
  min-height: 46px;
  border: 1px solid #dbe2ea;
  border-radius: 15px;
  background: #fff;
  color: var(--slate);
  padding: 0 12px;
  outline: none;
  font-weight: 800;
}

.v4-searchbox {
  position: relative;
  display: flex;
  align-items: center;
  min-width: 0;
  max-width: 100%;
}

.v4-searchbox svg {
  position: absolute;
  left: 13px;
  color: var(--muted);
}

.v4-searchbox input {
  padding-left: 40px;
}

/* ERROR */
.v4-error,
.pe-error {
  padding: 15px 17px;
  border-radius: 18px;
  background: #fff1f2;
  border: 1px solid #fecdd3;
  color: #be123c;
  font-weight: 950;
}

/* ANALYTICS */
.v4-analytics-grid {
  width: 100%;
  max-width: 100%;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 14px;
}

.v4-panel {
  min-width: 0;
  overflow: hidden;
  padding: 18px;
  border-radius: 28px;
}

.v4-panel-title {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  margin-bottom: 16px;
}

.v4-panel-title > div {
  width: 42px;
  height: 42px;
  border-radius: 16px;
  background: #eff6ff;
  color: var(--blue);
  display: grid;
  place-items: center;
  flex: 0 0 auto;
}

.v4-split-bars,
.v4-mini-bars {
  display: grid;
  gap: 13px;
}

.v4-split-row {
  display: grid;
  grid-template-columns: 92px 1fr 45px;
  gap: 10px;
  align-items: center;
}

.v4-split-row span,
.v4-mini-label span {
  display: block;
  color: var(--muted);
  font-weight: 900;
  font-size: .75rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.v4-split-row strong,
.v4-mini-label strong {
  color: var(--slate);
  font-weight: 950;
}

.v4-progress,
.v4-mini-track {
  height: 10px;
  border-radius: 999px;
  background: #eef2f7;
  overflow: hidden;
}

.v4-progress i,
.v4-mini-track i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #2563eb, #38bdf8);
}

.v4-progress i.orange { background: linear-gradient(90deg, #f97316, #fdba74); }
.v4-progress i.green { background: linear-gradient(90deg, #047857, #34d399); }
.v4-progress i.purple { background: linear-gradient(90deg, #7c3aed, #c4b5fd); }

.v4-split-row small {
  color: var(--muted);
  font-weight: 900;
  text-align: right;
}

.v4-mini-bar-row {
  display: grid;
  gap: 7px;
}

.v4-mini-label {
  display: flex;
  justify-content: space-between;
  gap: 10px;
}

.v4-empty-mini {
  min-height: 120px;
  display: grid;
  place-items: center;
  border-radius: 18px;
  background: var(--soft);
  color: var(--muted);
  font-weight: 900;
}

/* TABLE */
.v4-table-card {
  width: 100%;
  max-width: 100%;
  overflow: hidden;
  padding: 20px;
  border-radius: 30px;
}

.v4-table-head {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  align-items: flex-start;
  margin-bottom: 16px;
}

.v4-ready-pill {
  min-height: 34px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  border-radius: 999px;
  background: #ecfdf3;
  color: #047857;
  font-size: .76rem;
  font-weight: 950;
}

.v4-table-wrap {
  width: 100%;
  max-width: 100%;
  overflow-x: auto;
  border-radius: 24px;
  border: 1px solid #edf2f7;
  background: #fff;
}

.v4-table {
  width: 100%;
  min-width: 1080px;
  border-collapse: collapse;
}

.v4-table th {
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

.v4-table td {
  padding: 13px 14px;
  border-top: 1px solid #edf2f7;
  color: #0f172a;
  font-size: .87rem;
  white-space: nowrap;
}

.v4-table tbody tr {
  transition: .18s ease;
}

.v4-table tbody tr:hover {
  background: #f8fafc;
}

.v4-table tbody tr.selected {
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

/* EMPLOYEE */
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

/* ACTIONS */
.v4-row-actions {
  display: flex;
  gap: 7px;
  white-space: nowrap;
}

.v4-row-actions button {
  width: 36px;
  height: 36px;
  border: 0;
  border-radius: 13px;
  background: #f1f5f9;
  color: var(--slate);
  cursor: pointer;
  display: grid;
  place-items: center;
}

.v4-row-actions button.primary {
  background: #eff6ff;
  color: var(--blue);
}

/* MOBILE CARDS */
.v4-mobile-cards {
  display: none;
}

.v4-mobile-card {
  padding: 16px;
  border-radius: 22px;
  background: #fff;
  border: 1px solid var(--line);
  box-shadow: 0 12px 30px rgba(15,23,42,.07);
}

.v4-mobile-card-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.v4-mobile-info {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 14px;
}

.v4-info-item {
  border-radius: 14px;
  padding: 10px;
  background: var(--soft);
  border: 1px solid #edf2f7;
}

.v4-info-item span {
  display: block;
  color: var(--muted);
  font-size: .72rem;
  font-weight: 900;
  margin-bottom: 5px;
}

.v4-info-item strong {
  display: block;
  color: var(--slate);
  font-size: .82rem;
  font-weight: 950;
}

.v4-mobile-actions {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-top: 14px;
}

.v4-mobile-actions button {
  min-height: 38px;
  border: 0;
  border-radius: 13px;
  background: #f1f5f9;
  color: var(--slate);
  font-weight: 950;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.v4-mobile-actions button.primary {
  background: var(--blue);
  color: #fff;
}

/* EMPTY / LOADING */
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

/* MODALS */
.pe-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 999;
  background: rgba(15,23,42,.62);
  display: grid;
  place-items: center;
  padding: 14px;
  backdrop-filter: blur(8px);
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

.v4-details-modal {
  width: min(900px, 100%);
  max-width: min(1180px, calc(100vw - 28px));
  max-height: calc(100vh - 28px);
}

.v4-modal-hero {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 18px;
  padding: 20px;
  border-radius: 24px;
  color: #fff;
  background:
    radial-gradient(circle at top right, rgba(59,130,246,.45), transparent 35%),
    linear-gradient(135deg, #020617, #0f172a 48%, #1e3a8a);
}

.v4-modal-hero span {
  color: #bfdbfe;
  font-weight: 900;
  font-size: .78rem;
}

.v4-modal-hero h3 {
  margin: 3px 0 0;
  color: #fff;
  font-size: 1.3rem;
  font-weight: 950;
}

.v4-modal-hero p {
  margin: 4px 0 0;
  color: rgba(255,255,255,.78);
  font-weight: 850;
}

.v4-modal-hero button,
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

/* ATTENDANCE MODAL */
.pro-attendance {
  width: min(1180px, 96vw);
  padding: 26px;
  border-radius: 34px;
  max-width: min(1180px, calc(100vw - 28px));
  max-height: calc(100vh - 28px);
}

.v4-attendance-header {
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

.attendance-toolbar.pro {
  width: 100%;
  max-width: 100%;
  display: grid;
  grid-template-columns: 150px 150px 1fr 130px;
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

.attendance-toolbar.pro button.dark {
  background: #0f172a;
}

.attendance-toolbar.pro button:disabled {
  opacity: .6;
  cursor: not-allowed;
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
  transition: all .24s ease;
}

.attendance-kpi:hover {
  transform: translateY(-3px);
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

/* HEATMAP */
.v4-heatmap-card {
  padding: 16px;
  border-radius: 24px;
  border: 1px solid #e5eaf1;
  background: #f8fafc;
  margin-bottom: 16px;
}

.v4-heatmap-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
  margin-bottom: 12px;
}

.v4-heatmap-head h4 {
  margin: 0;
  color: var(--slate);
  font-weight: 950;
}

.v4-heatmap-head p {
  margin: 4px 0 0;
  color: var(--muted);
  font-size: .82rem;
  font-weight: 850;
}

.v4-heatmap {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(34px, 1fr));
  gap: 7px;
}

.v4-heat {
  height: 34px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  font-size: .72rem;
  font-weight: 950;
  color: #334155;
  background: #e2e8f0;
}

.v4-heat.present { background: #bbf7d0; color: #166534; }
.v4-heat.absent { background: #fecdd3; color: #9f1239; }
.v4-heat.single { background: #fed7aa; color: #9a3412; }
.v4-heat.other { background: #dbeafe; color: #1d4ed8; }

/* ATTENDANCE TABLE */
.attendance-table-card {
  max-width: 100%;
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

.attendance-status.other {
  background: #f1f5f9;
  color: #334155;
}

.attendance-note {
  color: #475569;
  white-space: normal !important;
  min-width: 260px;
}

/* RESPONSIVE */
@media (max-width: 1180px) {
  .v4-hero {
    grid-template-columns: 1fr;
  }

  .v4-hero-side {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(260px, 320px);
    gap: 14px;
  }

  .v4-donut-card {
    min-height: 180px;
  }

  .attendance-toolbar.pro {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .attendance-toolbar.pro button {
    align-self: stretch;
  }
}

@media (max-width: 768px) {
  .v4-page {
    padding-right: 0;
  }

  .v4-hero {
    grid-template-columns: 1fr;
  }

  .v4-hero-side {
    grid-template-columns: 1fr;
  }

  .v4-hero-main {
    min-height: auto;
    padding: 22px;
    border-radius: 26px;
  }

  .v4-hero-main h1 {
    font-size: 2rem;
  }

  .v4-toolbar-head,
  .v4-table-head {
    display: grid;
  }

  .v4-kpis,
  .v4-filters,
  .v4-analytics-grid,
  .attendance-kpis,
  .attendance-toolbar.pro,
  .pe-details-grid {
    grid-template-columns: 1fr;
  }

  .v4-table {
    display: none;
  }

  .v4-mobile-cards {
    display: grid;
    gap: 12px;
    padding: 12px;
  }

  .v4-table-wrap {
    overflow: visible;
  }

  .v4-mobile-info {
    grid-template-columns: 1fr;
  }

  .v4-mobile-actions {
    grid-template-columns: 1fr;
  }

  .pro-attendance {
    padding: 16px;
  }

  .v4-attendance-header {
    padding: 18px;
  }

  .attendance-pro-table {
    min-width: 760px;
  }
}
`;
