import React, { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import {
  FileSpreadsheet,
  FileText,
  Upload,
  CheckCircle2,
  RefreshCcw,
  CalendarDays,
  Search,
  ShieldCheck,
  Plus,
  UserMinus,
  UserX,
  UserCog,
  AlertTriangle,
  Activity,
  Users,
  Clock3,
  Building2,
  Layers3,
  Sparkles,
  TrendingUp,
  Filter,
  Lock,
  Unlock,
} from "lucide-react";
import {
  uploadAttendanceFile,
  getAttendanceSheet,
  updateAttendanceImportRow,
  approveAttendanceBatch,
  reopenAttendanceBatch,
  getAvailableAttendanceUsers,
  addUserToAttendanceSheet,
  excludeUserFromAttendanceSheet,
  markAttendanceUserStatus,
  directUpdateAttendance,
} from "../services/api";
import { useAuth } from "../context/AuthContext";

const OVERRIDE_OPTIONS = [
  { value: "", label: "Auto" },
  { value: "present", label: "Present" },
  { value: "takleef", label: "Takleef" },
  { value: "annual_leave", label: "Annual Leave" },
  { value: "sick_leave", label: "Sick Leave" },
  { value: "emergency_leave", label: "Emergency Leave" },
  { value: "permission", label: "Permission" },
  { value: "absent", label: "Absent" },
  { value: "weekend", label: "OFF" },
];

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function exportSheet(rows, fileName, sheetName) {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, fileName);
}

function getSafeSheetName(value) {
  const clean = String(value || "Project")
    .replace(/[\/?*:[\]]/g, " ")
    .trim();

  return (clean || "Project").slice(0, 31);
}

function getProjectSummary(rows) {
  const safeRows = safeArray(rows);

  const employees = safeRows.length;
  const hours = safeRows.reduce((sum, row) => sum + Number(row?.totalHours || 0), 0);
  const absent = safeRows.reduce((sum, row) => sum + Number(row?.absentCount || 0), 0);
  const singlePunch = safeRows.reduce((sum, row) => sum + Number(row?.singlePunchCount || 0), 0);
  const annualLeave = safeRows.reduce((sum, row) => sum + Number(row?.annualLeaveCount || 0), 0);
  const sickLeave = safeRows.reduce((sum, row) => sum + Number(row?.sickLeaveCount || 0), 0);
  const emergencyLeave = safeRows.reduce((sum, row) => sum + Number(row?.emergencyLeaveCount || 0), 0);
  const permission = safeRows.reduce((sum, row) => sum + Number(row?.permissionCount || 0), 0);
  const takleef = safeRows.reduce((sum, row) => sum + Number(row?.takleefCount || 0), 0);

  const issueScore = absent + singlePunch;
  const totalPossible = Math.max(employees * 26, 1);
  const health = Math.max(0, Math.round(100 - (issueScore / totalPossible) * 100));

  let status = "excellent";
  if (health < 75) status = "critical";
  else if (health < 90) status = "warning";

  return {
    employees,
    hours,
    absent,
    singlePunch,
    annualLeave,
    sickLeave,
    emergencyLeave,
    permission,
    takleef,
    health,
    status,
  };
}

function buildProjectExportRows(projectName, rows, days) {
  return [
    [`Project: ${projectName}`],
    [],
    [
      "Employee",
      "User ID",
      "Project",
      "Package",
      ...safeArray(days).map((day) => day.label),
      "Total Hours",
      "Absent",
      "Single Punch",
      "Annual Leave",
      "Sick Leave",
      "Emergency Leave",
      "Permission",
      "Takleef",
    ],
    ...safeArray(rows).map((row) => [
      row?.name || "-",
      row?.userId || "-",
      row?.project || "-",
      row?.package || "-",
      ...safeArray(row?.cells).map((cell) => cell?.value ?? ""),
      Number(Number(row?.totalHours || 0).toFixed(2)),
      row?.absentCount || 0,
      row?.singlePunchCount || 0,
      row?.annualLeaveCount || 0,
      row?.sickLeaveCount || 0,
      row?.emergencyLeaveCount || 0,
      row?.permissionCount || 0,
      row?.takleefCount || 0,
    ]),
  ];
}

function KpiCard({ icon: Icon, label, value, hint, tone = "blue" }) {
  return (
    <article className={`att-kpi-card ${tone}`}>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <p>{hint}</p>
      </div>
      <div className="att-kpi-icon">
        <Icon size={24} />
      </div>
    </article>
  );
}

function ExportButtons({ rows, fileName, sheetName, disabled }) {
  return (
    <div className="att-inline-actions">
      <button
        type="button"
        className="att-btn soft"
        onClick={() => exportSheet(rows, fileName, sheetName)}
        disabled={disabled}
      >
        <FileSpreadsheet size={15} />
        Excel
      </button>

      <button type="button" className="att-btn soft" onClick={() => window.print()} disabled={disabled}>
        <FileText size={15} />
        PDF
      </button>
    </div>
  );
}

export default function AttendancePage() {
  const { user } = useAuth();
  const now = new Date();

  const [attendanceState, setAttendanceState] = useState({
    days: [],
    rows: [],
    monthTitle: "Attendance",
  });

  const [batchId, setBatchId] = useState("");
  const [batchStatus, setBatchStatus] = useState("draft");
  const [fileName, setFileName] = useState("");
  const [monthName, setMonthName] = useState("Attendance");
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [selectedProject, setSelectedProject] = useState("all");
  const [issueFilter, setIssueFilter] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [loading, setLoading] = useState(false);
  const [sheetLoading, setSheetLoading] = useState(false);
  const [savingRowId, setSavingRowId] = useState("");
  const [approving, setApproving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");
  const [manualHoursByRow, setManualHoursByRow] = useState({});
  const [availableUsers, setAvailableUsers] = useState([]);
  const [availableUsersLoading, setAvailableUsersLoading] = useState(false);
  const [availableUsersSearch, setAvailableUsersSearch] = useState("");
  const [showAddEmployeePanel, setShowAddEmployeePanel] = useState(false);
  const [actionLoadingKey, setActionLoadingKey] = useState("");

  const safeDays = safeArray(attendanceState?.days);
  const safeRows = safeArray(attendanceState?.rows);

  const projectOptions = useMemo(() => {
    const projects = new Set();

    safeRows.forEach((row) => {
      const project = String(row?.project || "").trim();
      if (project && project !== "-") projects.add(project);
    });

    return ["all", ...Array.from(projects).sort((a, b) => a.localeCompare(b))];
  }, [safeRows]);

  const filteredRows = useMemo(() => {
    const keyword = String(employeeFilter || "").toLowerCase().trim();

    let rows = safeRows;

    if (keyword) {
      rows = rows.filter((row) => {
        const name = String(row?.name || "").toLowerCase();
        const userId = String(row?.userId || "").toLowerCase();
        const project = String(row?.project || "").toLowerCase();
        const packageName = String(row?.package || "").toLowerCase();

        return (
          name.includes(keyword) ||
          userId.includes(keyword) ||
          project.includes(keyword) ||
          packageName.includes(keyword)
        );
      });
    }

    if (selectedProject !== "all") {
      rows = rows.filter((row) => String(row?.project || "").trim() === selectedProject);
    }

    if (issueFilter === "absent") {
      rows = rows.filter((row) => Number(row?.absentCount || 0) > 0);
    }

    if (issueFilter === "single") {
      rows = rows.filter((row) => Number(row?.singlePunchCount || 0) > 0);
    }

    if (issueFilter === "leaves") {
      rows = rows.filter(
        (row) =>
          Number(row?.annualLeaveCount || 0) > 0 ||
          Number(row?.sickLeaveCount || 0) > 0 ||
          Number(row?.emergencyLeaveCount || 0) > 0
      );
    }

    if (issueFilter === "issues") {
      rows = rows.filter(
        (row) => Number(row?.absentCount || 0) > 0 || Number(row?.singlePunchCount || 0) > 0
      );
    }

    return rows;
  }, [safeRows, employeeFilter, selectedProject, issueFilter]);

  const groupedRows = useMemo(() => {
    return filteredRows.reduce((acc, row) => {
      const projectName = String(row?.project || "").trim() || "Unassigned";
      const key = projectName === "-" ? "Unassigned" : projectName;

      if (!acc[key]) acc[key] = [];
      acc[key].push(row);
      return acc;
    }, {});
  }, [filteredRows]);

  const projectSummaries = useMemo(() => {
    return Object.entries(groupedRows).reduce((acc, [projectName, rows]) => {
      acc[projectName] = getProjectSummary(rows);
      return acc;
    }, {});
  }, [groupedRows]);

  const totalEmployees = filteredRows.length;
  const totalHours = filteredRows.reduce((sum, row) => sum + Number(row?.totalHours || 0), 0);
  const absentCount = filteredRows.reduce((sum, row) => sum + Number(row?.absentCount || 0), 0);
  const singlePunchCount = filteredRows.reduce((sum, row) => sum + Number(row?.singlePunchCount || 0), 0);
  const annualLeaveCount = filteredRows.reduce((sum, row) => sum + Number(row?.annualLeaveCount || 0), 0);
  const sickLeaveCount = filteredRows.reduce((sum, row) => sum + Number(row?.sickLeaveCount || 0), 0);
  const emergencyLeaveCount = filteredRows.reduce((sum, row) => sum + Number(row?.emergencyLeaveCount || 0), 0);
  const permissionCount = filteredRows.reduce((sum, row) => sum + Number(row?.permissionCount || 0), 0);
  const takleefCount = filteredRows.reduce((sum, row) => sum + Number(row?.takleefCount || 0), 0);

  const totalPossible = Math.max(totalEmployees * 26, 1);
  const healthScore = Math.max(0, Math.round(100 - ((absentCount + singlePunchCount) / totalPossible) * 100));
  const openIssues = absentCount + singlePunchCount;

  const exportRows = [
    [
      "Employee",
      "User ID",
      "Project",
      "Package",
      ...safeDays.map((day) => day.label),
      "Total Hours",
      "Absent",
      "Single Punch",
      "Annual Leave",
      "Sick Leave",
      "Emergency Leave",
      "Permission",
      "Takleef",
    ],
    ...filteredRows.map((row) => [
      row?.name || "-",
      row?.userId || "-",
      row?.project || "-",
      row?.package || "-",
      ...safeArray(row?.cells).map((cell) => cell?.value ?? ""),
      Number(Number(row?.totalHours || 0).toFixed(2)),
      row?.absentCount || 0,
      row?.singlePunchCount || 0,
      row?.annualLeaveCount || 0,
      row?.sickLeaveCount || 0,
      row?.emergencyLeaveCount || 0,
      row?.permissionCount || 0,
      row?.takleefCount || 0,
    ]),
  ];

  function setAlert(text, type = "success") {
    setMessage(text);
    setMessageType(type);
  }

  async function refreshSheet(currentBatchId) {
    const result = await getAttendanceSheet({ batchId: currentBatchId });
    setAttendanceState(result?.data || { days: [], rows: [], monthTitle: "Attendance" });
    setMonthName(result?.data?.monthTitle || "Attendance");
    setBatchStatus(result?.batch?.status || "draft");
    setBatchId(result?.batch?.id || currentBatchId || "");
  }

  async function loadSelectedMonthSheet() {
    try {
      setSheetLoading(true);
      setAlert("", "success");

      const result = await getAttendanceSheet({
        month: selectedMonth,
        year: selectedYear,
      });

      setAttendanceState(result?.data || { days: [], rows: [], monthTitle: "Attendance" });
      setMonthName(result?.data?.monthTitle || "Attendance");
      setBatchStatus(result?.batch?.status || "draft");
      setBatchId(result?.batch?.id || "");
      setShowAddEmployeePanel(false);
      setAvailableUsers([]);
      setAvailableUsersSearch("");
      setAlert("Attendance sheet loaded successfully.");
    } catch (error) {
      console.error(error);
      setAttendanceState({ days: [], rows: [], monthTitle: "Attendance" });
      setMonthName("Attendance");
      setBatchStatus("draft");
      setBatchId("");
      setAvailableUsers([]);
      setShowAddEmployeePanel(false);
      setAlert(error.message || "Failed to load attendance sheet.", "error");
    } finally {
      setSheetLoading(false);
    }
  }

  async function onFileUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setLoading(true);
    setAlert("", "success");

    try {
      const actorName = user?.name || user?.username || "HR Manager";
      const result = await uploadAttendanceFile(file, selectedMonth, selectedYear, actorName);

      setBatchId(result?.batchId || "");
      setBatchStatus(result?.status || "draft");
      setAttendanceState(result?.data || { days: [], rows: [], monthTitle: "Attendance" });
      setMonthName(result?.data?.monthTitle || "Attendance");
      setShowAddEmployeePanel(false);
      setAvailableUsers([]);
      setAvailableUsersSearch("");
      setAlert("Attendance file uploaded successfully.");
    } catch (error) {
      console.error(error);
      setAlert(error.message || "Failed to upload attendance file.", "error");
    } finally {
      setLoading(false);
      event.target.value = "";
    }
  }

  async function handleOverrideChange(rowId, overrideType) {
    if (!rowId || !batchId || batchStatus === "approved") return;

    setAlert("", "success");
    setSavingRowId(String(rowId));

    try {
      await updateAttendanceImportRow(rowId, {
        overrideType,
        overrideNote: "",
        manualHours: overrideType === "present" ? Number(manualHoursByRow[rowId] || 8) : null,
        username: user?.name || user?.username || "HR Manager",
      });

      await refreshSheet(batchId);
      setAlert("Attendance row updated successfully.");
    } catch (error) {
      console.error(error);
      setAlert(error.message || "Failed to update attendance row.", "error");
    } finally {
      setSavingRowId("");
    }
  }

  async function handleManualCellChange(row, day, overrideType, manualHours = null) {
    if (!batchId || !row?.name || !day?.key || batchStatus === "approved") return;

    setAlert("", "success");
    setSavingRowId(`${row?.userId || row?.name}-${day.key}`);

    try {
      const statusMap = {
        "": "",
        present: "Present",
        takleef: "Takleef",
        annual_leave: "Annual Leave",
        sick_leave: "Sick Leave",
        emergency_leave: "Emergency Leave",
        permission: "Permission",
        absent: "Absent",
        weekend: "OFF",
      };

      await directUpdateAttendance({
        batchId,
        employeeCode: row?.userId === "-" ? "" : row?.userId || "",
        employeeName: row?.name || "",
        date: day.key,
        newStatus: statusMap[overrideType] || "",
        hours: overrideType === "present" ? Number(manualHours || 8) : 0,
        actorName: user?.name || user?.username || "HR Manager",
        note: "Manual sheet cell update",
      });

      await refreshSheet(batchId);
      setAlert("Attendance cell updated successfully.");
    } catch (error) {
      console.error(error);
      setAlert(error.message || "Failed to update attendance cell.", "error");
    } finally {
      setSavingRowId("");
    }
  }

  async function handleApprove() {
    if (!batchId || batchStatus === "approved") return;

    const confirmed =
      openIssues > 0
        ? window.confirm(
            `There are ${openIssues} open attendance issues before approval. Do you want to continue?`
          )
        : true;

    if (!confirmed) return;

    setAlert("", "success");
    setApproving(true);

    try {
      await approveAttendanceBatch(batchId, {
        username: user?.name || user?.username || "HR Manager",
      });

      await refreshSheet(batchId);
      setAlert("Attendance sheet approved and now visible to employees.");
    } catch (error) {
      console.error(error);
      setAlert(error.message || "Failed to approve attendance sheet.", "error");
    } finally {
      setApproving(false);
    }
  }

  async function handleReopen() {
    if (!batchId || batchStatus !== "approved") return;

    const confirmed = window.confirm(
      "Are you sure you want to reopen this approved attendance sheet for editing?"
    );

    if (!confirmed) return;

    try {
      setApproving(true);
      setAlert("", "success");

      await reopenAttendanceBatch(batchId);
      await refreshSheet(batchId);

      setAlert("Attendance sheet reopened. You can edit it now.");
    } catch (error) {
      console.error(error);
      setAlert(error.message || "Failed to reopen attendance sheet.", "error");
    } finally {
      setApproving(false);
    }
  }

  async function loadAvailableUsers(searchValue = "") {
    if (!batchId) return;

    try {
      setAvailableUsersLoading(true);
      const result = await getAvailableAttendanceUsers(batchId, searchValue);
      setAvailableUsers(safeArray(result?.users));
    } catch (error) {
      console.error(error);
      setAlert(error.message || "Failed to load available users.", "error");
    } finally {
      setAvailableUsersLoading(false);
    }
  }

  async function handleToggleAddEmployeePanel() {
    if (!batchId) return;

    const next = !showAddEmployeePanel;
    setShowAddEmployeePanel(next);

    if (next) {
      await loadAvailableUsers("");
    }
  }

  async function handleAddUser(userId) {
    if (!batchId || !userId) return;

    try {
      setActionLoadingKey(`add-${userId}`);
      setAlert("", "success");

      await addUserToAttendanceSheet(batchId, { userId });
      await refreshSheet(batchId);
      await loadAvailableUsers(availableUsersSearch);

      setAlert("Employee added to this attendance sheet successfully.");
    } catch (error) {
      console.error(error);
      setAlert(error.message || "Failed to add employee to sheet.", "error");
    } finally {
      setActionLoadingKey("");
    }
  }

  async function handleExcludeEmployee(row) {
    if (!batchId) return;

    const confirmed = window.confirm(
      `Exclude ${row?.name || "this employee"} from this attendance sheet only?`
    );
    if (!confirmed) return;

    try {
      const unique = `${row?.userId || row?.name}-exclude`;
      setActionLoadingKey(unique);
      setAlert("", "success");

      await excludeUserFromAttendanceSheet(batchId, {
        employeeCode: row?.userId || "",
        employeeName: row?.name || "",
        reason: "Excluded manually from this sheet",
      });

      await refreshSheet(batchId);
      await loadAvailableUsers(availableUsersSearch);

      setAlert("Employee excluded from this attendance sheet successfully.");
    } catch (error) {
      console.error(error);
      setAlert(error.message || "Failed to exclude employee.", "error");
    } finally {
      setActionLoadingKey("");
    }
  }

  async function handleMarkStatus(row, status) {
    if (!row?.name) return;

    const label = status === "resigned" ? "resigned" : "inactive";
    const confirmed = window.confirm(`Are you sure you want to mark ${row.name} as ${label}?`);
    if (!confirmed) return;

    try {
      const unique = `${row?.userId || row?.name}-${status}`;
      setActionLoadingKey(unique);
      setAlert("", "success");

      await markAttendanceUserStatus({
        employeeCode: row?.userId || "",
        employeeName: row?.name || "",
        status,
      });

      setAlert(`Employee status updated to ${label} successfully.`);
    } catch (error) {
      console.error(error);
      setAlert(error.message || "Failed to update employee status.", "error");
    } finally {
      setActionLoadingKey("");
    }
  }

  return (
    <div className="attendance-ultra-page">
      <style>{attendanceUltraStyles}</style>

      <section className="att-hero">
        <div className="att-hero-content">
          <div className="att-badge">
            <Sparkles size={15} />
            Attendance Ultra Command Center
          </div>

          <h1>Monthly Attendance Management</h1>

          <p>
            Upload biometric files, analyze project attendance, review exceptions, edit daily records,
            and approve the final sheet before publishing it to employees.
          </p>

          <div className="att-hero-actions">
            <button type="button" onClick={loadSelectedMonthSheet} disabled={sheetLoading}>
              <RefreshCcw size={16} />
              {sheetLoading ? "Loading..." : "Load Month"}
            </button>

            <label>
              <Upload size={16} />
              {loading ? "Uploading..." : "Upload CSV"}
              <input type="file" accept=".csv" hidden onChange={onFileUpload} />
            </label>
          </div>
        </div>

        <div className="att-hero-panel">
          <div className="att-lock-icon">
            {batchStatus === "approved" ? <Lock size={24} /> : <Unlock size={24} />}
          </div>

          <div className="att-panel-row">
            <span>Month</span>
            <strong>{monthName}</strong>
          </div>

          <div className="att-panel-row">
            <span>Batch Status</span>
            <strong>{batchStatus === "approved" ? "Approved" : "Draft"}</strong>
          </div>

          <div className="att-panel-row">
            <span>Health Score</span>
            <strong>{healthScore}%</strong>
          </div>

          <div className="att-progress">
            <div style={{ width: `${healthScore}%` }} />
          </div>
        </div>
      </section>

      <section className="att-kpi-grid">
        <KpiCard icon={Users} label="Employees" value={totalEmployees} hint="Employees in current view" tone="blue" />
        <KpiCard icon={Clock3} label="Total Hours" value={Math.round(totalHours)} hint="Monthly accumulated hours" tone="green" />
        <KpiCard icon={AlertTriangle} label="Absent" value={absentCount} hint="Absence cases" tone="red" />
        <KpiCard icon={Activity} label="Single Punch" value={singlePunchCount} hint="Records need review" tone="orange" />
        <KpiCard icon={CalendarDays} label="Annual Leave" value={annualLeaveCount} hint="Annual leave records" tone="cyan" />
        <KpiCard icon={ShieldCheck} label="Sick Leave" value={sickLeaveCount} hint="Sick leave records" tone="purple" />
        <KpiCard icon={TrendingUp} label="Takleef" value={takleefCount} hint="Takleef records" tone="dark" />
        <KpiCard icon={Filter} label="Open Issues" value={openIssues} hint="Absent + Single Punch" tone="red" />
      </section>

      <section className="att-control-grid">
        <div className="att-card">
          <div className="att-card-head">
            <div>
              <h2>Month Controls</h2>
              <p>Select month, year, project, and issue filters.</p>
            </div>

            <span className={`att-status ${batchStatus === "approved" ? "approved" : "draft"}`}>
              {batchStatus === "approved" ? "Approved Batch" : "Draft Batch"}
            </span>
          </div>

          <div className="att-form-grid">
            <div className="att-field">
              <label>Month</label>
              <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))}>
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>{i + 1}</option>
                ))}
              </select>
            </div>

            <div className="att-field">
              <label>Year</label>
              <input
                type="number"
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value) || now.getFullYear())}
              />
            </div>

            <div className="att-field span-2">
              <label>Search</label>
              <div className="att-search-box">
                <Search size={16} />
                <input
                  value={employeeFilter}
                  onChange={(e) => setEmployeeFilter(e.target.value)}
                  placeholder="Search employee, GAS ID, project, or package"
                />
              </div>
            </div>

            <div className="att-field">
              <label>Project</label>
              <select value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)}>
                {projectOptions.map((project) => (
                  <option key={project} value={project}>
                    {project === "all" ? "All Projects" : project}
                  </option>
                ))}
              </select>
            </div>

            <div className="att-field">
              <label>Issue Filter</label>
              <select value={issueFilter} onChange={(e) => setIssueFilter(e.target.value)}>
                <option value="all">All Employees</option>
                <option value="issues">Only Issues</option>
                <option value="absent">Only Absent</option>
                <option value="single">Only Single Punch</option>
                <option value="leaves">Only Leaves</option>
              </select>
            </div>
          </div>

          <div className="att-card-actions">
            <button type="button" className="att-btn soft" onClick={loadSelectedMonthSheet} disabled={sheetLoading}>
              <RefreshCcw size={15} />
              {sheetLoading ? "Loading..." : "Load Existing Sheet"}
            </button>

            <ExportButtons rows={exportRows} fileName="attendance-sheet.xlsx" sheetName="Attendance" disabled={!filteredRows.length} />
          </div>
        </div>

        <div className="att-card">
          <div className="att-card-head">
            <div>
              <h2>Import & Approval</h2>
              <p>Upload biometric CSV and approve the month.</p>
            </div>
          </div>

          <div className="att-upload-box">
            <label className="att-upload-btn">
              <Upload size={16} />
              {loading ? "Uploading..." : "Upload CSV"}
              <input type="file" accept=".csv" hidden onChange={onFileUpload} />
            </label>

            <div>
              <span>Uploaded File</span>
              <strong>{fileName || "No file uploaded yet"}</strong>
            </div>
          </div>

          <div className="att-approval-box">
            <div>
              <span>Batch ID</span>
              <strong>{batchId || "-"}</strong>
            </div>

            {batchStatus === "approved" ? (
              <button type="button" className="att-btn orange" onClick={handleReopen} disabled={!batchId || approving}>
                <RefreshCcw size={15} />
                {approving ? "Reopening..." : "Reopen Editing"}
              </button>
            ) : (
              <button type="button" className="att-btn primary" onClick={handleApprove} disabled={!batchId || approving}>
                <CheckCircle2 size={15} />
                {approving ? "Approving..." : "Approve Sheet"}
              </button>
            )}
          </div>

          {message ? (
            <div className={`att-alert ${messageType === "error" ? "error" : "success"}`}>
              {message}
            </div>
          ) : null}
        </div>
      </section>

      {batchId ? (
        <section className="att-card">
          <div className="att-card-head">
            <div>
              <h2>Sheet Employee Tools</h2>
              <p>Add or exclude employees from this monthly sheet.</p>
            </div>

            <button type="button" className="att-btn primary" onClick={handleToggleAddEmployeePanel} disabled={!batchId}>
              <Plus size={15} />
              {showAddEmployeePanel ? "Hide Panel" : "Add Employee"}
            </button>
          </div>

          {showAddEmployeePanel ? (
            <div className="att-manager-panel">
              <div className="att-search-box">
                <Search size={16} />
                <input
                  value={availableUsersSearch}
                  onChange={(e) => setAvailableUsersSearch(e.target.value)}
                  placeholder="Search active users by name, GAS ID, project..."
                />
              </div>

              <button type="button" className="att-btn soft" onClick={() => loadAvailableUsers(availableUsersSearch)} disabled={availableUsersLoading}>
                <RefreshCcw size={15} />
                {availableUsersLoading ? "Loading..." : "Search Users"}
              </button>

              {availableUsersLoading ? (
                <div className="att-empty">Loading available users...</div>
              ) : availableUsers.length === 0 ? (
                <div className="att-empty">No available users found for this sheet.</div>
              ) : (
                <div className="att-available-list">
                  {availableUsers.map((item) => (
                    <div key={item.user_id || `${item.gas_id}-${item.name}`} className="att-available-item">
                      <div>
                        <strong>{item.name || "-"}</strong>
                        <p>
                          GAS ID: {item.gas_id || "-"} <br />
                          Job Title: {item.job_title || "-"} <br />
                          Project: {item.project_name || "-"} | Package: {item.package_name || "-"}
                        </p>
                      </div>

                      <button
                        type="button"
                        className="att-btn primary"
                        onClick={() => handleAddUser(item.user_id)}
                        disabled={actionLoadingKey === `add-${item.user_id}`}
                      >
                        <Plus size={15} />
                        {actionLoadingKey === `add-${item.user_id}` ? "Adding..." : "Add"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="att-table-card">
        <div className="att-table-head">
          <div>
            <h2>{monthName}</h2>
            <p>Review attendance records, edit cells, and export project sheets.</p>
          </div>

          <div className="att-table-meta">
            <span>{filteredRows.length} Employees</span>
            <span>{safeDays.length} Days</span>
            <span>{Object.keys(groupedRows).length} Projects</span>
          </div>
        </div>

        <div className="att-summary-strip">
          <div><span>Annual Leave</span><strong>{annualLeaveCount}</strong></div>
          <div><span>Sick Leave</span><strong>{sickLeaveCount}</strong></div>
          <div><span>Emergency Leave</span><strong>{emergencyLeaveCount}</strong></div>
          <div><span>Permission</span><strong>{permissionCount}</strong></div>
          <div><span>Takleef</span><strong>{takleefCount}</strong></div>
        </div>

        {filteredRows.length === 0 ? (
          <div className="att-empty large">
            Upload the attendance CSV file or load an existing month sheet.
          </div>
        ) : (
          <div className="att-table-shell">
            <table className="att-table">
              <thead>
                <tr>
                  <th className="sticky-col emp-col">Employee</th>
                  <th>User ID</th>

                  {safeDays.map((day) => (
                    <th key={day.key} className={day.weekend ? "weekend-head" : ""}>
                      {day.label}
                    </th>
                  ))}

                  <th>Total</th>
                  <th>Absent</th>
                  <th>SP</th>
                  <th>AL</th>
                  <th>SL</th>
                  <th>EL</th>
                  <th>PM</th>
                  <th>TK</th>
                  <th className="actions-col">Actions</th>
                </tr>
              </thead>

              <tbody>
                {Object.entries(groupedRows).map(([projectName, projectRows]) => {
                  const summary = projectSummaries[projectName] || getProjectSummary(projectRows);

                  return (
                    <React.Fragment key={projectName}>
                      <tr className="project-title-row">
                        <td colSpan={safeDays.length + 12}>
                          <div className="project-title-content">
                            <div>
                              <Building2 size={17} />
                              <strong>{projectName}</strong>
                              <span>{summary.employees} Employees</span>
                              <span>Health {summary.health}%</span>
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                exportSheet(
                                  buildProjectExportRows(projectName, projectRows, safeDays),
                                  `${projectName}-attendance.xlsx`,
                                  getSafeSheetName(projectName)
                                )
                              }
                            >
                              <FileSpreadsheet size={14} />
                              Export Project
                            </button>
                          </div>
                        </td>
                      </tr>

                      <tr>
                        <td colSpan={safeDays.length + 12} className="project-summary-cell">
                          <div className="project-summary">
                            <div><span>Employees</span><strong>{summary.employees}</strong></div>
                            <div><span>Total Hours</span><strong>{Math.round(summary.hours)}</strong></div>
                            <div><span>Absent</span><strong>{summary.absent}</strong></div>
                            <div><span>Single Punch</span><strong>{summary.singlePunch}</strong></div>
                            <div><span>Annual Leave</span><strong>{summary.annualLeave}</strong></div>
                            <div><span>Sick Leave</span><strong>{summary.sickLeave}</strong></div>
                          </div>
                        </td>
                      </tr>

                      {projectRows.map((row, rowIndex) => (
                        <tr key={`${row?.name || "emp"}-${row?.userId || rowIndex}`}>
                          <td className="sticky-col emp-col" title={row?.name || "-"}>
                            <div className="emp-box">
                              <strong>{row?.name || "-"}</strong>
                              <span>{row?.project || "-"} | {row?.package || "-"}</span>
                              {row?.isManualOnly ? <em>Manual Sheet Employee</em> : null}
                            </div>
                          </td>

                          <td>{row?.userId || "-"}</td>

                          {safeArray(row?.cells).map((cell, index) => {
                            const day = safeDays[index];
                            const manualKey = cell?.rowId || `${row?.userId || row?.name}-${day?.key}`;

                            return (
                              <td
                                key={`${row?.name || "emp"}-${cell?.rowId || index}`}
                                className={`att-cell ${cell?.type || ""}`}
                              >
                                <div className="cell-inner">
                                  <div className={`cell-value ${cell?.type || ""}`}>
                                    {cell?.value ?? "-"}
                                  </div>

                                  <select
                                    className="cell-select"
                                    value={cell?.overrideType || ""}
                                    onChange={(e) => {
                                      if (cell?.rowId) {
                                        handleOverrideChange(cell.rowId, e.target.value);
                                      } else {
                                        handleManualCellChange(row, day, e.target.value);
                                      }
                                    }}
                                    disabled={batchStatus === "approved" || savingRowId === String(manualKey)}
                                  >
                                    {OVERRIDE_OPTIONS.map((option) => (
                                      <option key={option.value} value={option.value}>
                                        {option.label}
                                      </option>
                                    ))}
                                  </select>

                                  {(cell?.overrideType || "") === "present" ? (
                                    <input
                                      type="number"
                                      min="0"
                                      step="1"
                                      className="cell-select"
                                      value={manualHoursByRow[manualKey] ?? (cell?.value || 8)}
                                      onChange={(e) =>
                                        setManualHoursByRow((prev) => ({
                                          ...prev,
                                          [manualKey]: e.target.value,
                                        }))
                                      }
                                      onBlur={() => {
                                        if (cell?.rowId) {
                                          handleOverrideChange(cell.rowId, "present");
                                        } else {
                                          handleManualCellChange(row, day, "present", manualHoursByRow[manualKey] || 8);
                                        }
                                      }}
                                      disabled={batchStatus === "approved" || savingRowId === String(manualKey)}
                                      placeholder="Hours"
                                    />
                                  ) : null}
                                </div>
                              </td>
                            );
                          })}

                          <td><strong>{Number(Number(row?.totalHours || 0).toFixed(2))}</strong></td>
                          <td>{row?.absentCount || 0}</td>
                          <td>{row?.singlePunchCount || 0}</td>
                          <td>{row?.annualLeaveCount || 0}</td>
                          <td>{row?.sickLeaveCount || 0}</td>
                          <td>{row?.emergencyLeaveCount || 0}</td>
                          <td>{row?.permissionCount || 0}</td>
                          <td>{row?.takleefCount || 0}</td>

                          <td className="actions-col">
                            <div className="row-actions">
                              <button
                                type="button"
                                className="mini danger"
                                onClick={() => handleExcludeEmployee(row)}
                                disabled={actionLoadingKey === `${row?.userId || row?.name}-exclude`}
                              >
                                <UserMinus size={13} />
                                Exclude
                              </button>

                              <button
                                type="button"
                                className="mini muted"
                                onClick={() => handleMarkStatus(row, "inactive")}
                                disabled={actionLoadingKey === `${row?.userId || row?.name}-inactive`}
                              >
                                <UserCog size={13} />
                                Inactive
                              </button>

                              <button
                                type="button"
                                className="mini blue"
                                onClick={() => handleMarkStatus(row, "resigned")}
                                disabled={actionLoadingKey === `${row?.userId || row?.name}-resigned`}
                              >
                                <UserX size={13} />
                                Resigned
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

const attendanceUltraStyles = `
.attendance-ultra-page {
  width: 100%;
  display: grid;
  gap: 20px;
  color: #0f172a;
}

.attendance-ultra-page * {
  box-sizing: border-box;
}

.att-hero {
  position: relative;
  overflow: hidden;
  display: grid;
  grid-template-columns: minmax(0, 1.55fr) minmax(320px, .9fr);
  gap: 20px;
  border-radius: 36px;
  padding: 30px;
  color: #fff;
  background:
    radial-gradient(circle at 12% 15%, rgba(56,189,248,.28), transparent 30%),
    radial-gradient(circle at 92% 5%, rgba(37,99,235,.42), transparent 34%),
    linear-gradient(135deg, #020617 0%, #0f172a 50%, #1e3a8a 120%);
  box-shadow: 0 26px 70px rgba(15,23,42,.18);
}

.att-hero::before {
  content: "";
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(255,255,255,.055) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,.055) 1px, transparent 1px);
  background-size: 48px 48px;
  opacity: .5;
}

.att-hero-content,
.att-hero-panel {
  position: relative;
  z-index: 2;
}

.att-badge {
  width: fit-content;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 36px;
  border-radius: 999px;
  padding: 0 14px;
  background: rgba(255,255,255,.12);
  border: 1px solid rgba(255,255,255,.16);
  color: #dbeafe;
  font-size: .82rem;
  font-weight: 950;
}

.att-hero h1 {
  margin: 18px 0 0;
  font-size: clamp(2.2rem, 4vw, 4rem);
  line-height: 1;
  letter-spacing: -.06em;
  color: #fff;
  font-weight: 950;
}

.att-hero p {
  max-width: 720px;
  margin: 16px 0 0;
  color: rgba(255,255,255,.78);
  font-size: 1rem;
  line-height: 1.75;
  font-weight: 750;
}

.att-hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 24px;
}

.att-hero-actions button,
.att-hero-actions label {
  min-height: 46px;
  border-radius: 16px;
  border: 1px solid rgba(255,255,255,.18);
  padding: 0 17px;
  display: inline-flex;
  align-items: center;
  gap: 9px;
  background: rgba(255,255,255,.10);
  color: #fff;
  cursor: pointer;
  font-weight: 950;
}

.att-hero-actions button:first-child {
  background: #fff;
  color: #0f172a;
  border: none;
}

.att-hero-panel {
  align-self: stretch;
  border-radius: 30px;
  padding: 22px;
  background: rgba(255,255,255,.11);
  border: 1px solid rgba(255,255,255,.16);
  backdrop-filter: blur(18px);
  display: grid;
  gap: 12px;
}

.att-lock-icon {
  width: 54px;
  height: 54px;
  border-radius: 20px;
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, #38bdf8, #2563eb);
  box-shadow: 0 18px 34px rgba(37,99,235,.26);
}

.att-panel-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  border-radius: 17px;
  padding: 12px;
  background: rgba(255,255,255,.09);
}

.att-panel-row span {
  color: rgba(255,255,255,.65);
  font-size: .78rem;
  font-weight: 850;
}

.att-panel-row strong {
  color: #fff;
  font-size: .9rem;
  font-weight: 950;
  text-align: right;
  word-break: break-word;
}

.att-progress {
  height: 12px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(255,255,255,.14);
}

.att-progress div {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #38bdf8, #22c55e);
}

.att-kpi-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0,1fr));
  gap: 16px;
}

.att-kpi-card {
  position: relative;
  overflow: hidden;
  min-height: 148px;
  border-radius: 30px;
  padding: 22px;
  display: flex;
  justify-content: space-between;
  gap: 14px;
  background: #fff;
  border: 1px solid #e8eef7;
  box-shadow: 0 18px 45px rgba(15,23,42,.07);
}

.att-kpi-card::after {
  content: "";
  position: absolute;
  width: 135px;
  height: 135px;
  right: -50px;
  top: -50px;
  border-radius: 999px;
  background: rgba(37,99,235,.09);
}

.att-kpi-card.green::after { background: rgba(34,197,94,.10); }
.att-kpi-card.red::after { background: rgba(239,68,68,.10); }
.att-kpi-card.orange::after { background: rgba(245,158,11,.14); }
.att-kpi-card.cyan::after { background: rgba(14,165,233,.12); }
.att-kpi-card.purple::after { background: rgba(124,58,237,.11); }
.att-kpi-card.dark::after { background: rgba(15,23,42,.10); }

.att-kpi-card span {
  color: #64748b;
  font-size: .83rem;
  font-weight: 900;
}

.att-kpi-card strong {
  display: block;
  margin-top: 10px;
  color: #0f172a;
  font-size: 2.25rem;
  line-height: 1;
  font-weight: 950;
  letter-spacing: -.05em;
}

.att-kpi-card p {
  margin: 12px 0 0;
  color: #94a3b8;
  font-size: .78rem;
  line-height: 1.45;
  font-weight: 800;
}

.att-kpi-icon {
  position: relative;
  z-index: 2;
  width: 48px;
  height: 48px;
  border-radius: 18px;
  display: grid;
  place-items: center;
  color: #1d4ed8;
  background: #eff6ff;
}

.att-control-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(360px, .85fr);
  gap: 20px;
}

.att-card,
.att-table-card {
  border-radius: 30px;
  padding: 24px;
  background: rgba(255,255,255,.96);
  border: 1px solid #e8eef7;
  box-shadow: 0 16px 42px rgba(15,23,42,.055);
  min-width: 0;
}

.att-card-head,
.att-table-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 14px;
  flex-wrap: wrap;
  margin-bottom: 18px;
}

.att-card-head h2,
.att-table-head h2 {
  margin: 0 0 6px;
  color: #0f172a;
  font-size: 1.2rem;
  font-weight: 950;
}

.att-card-head p,
.att-table-head p {
  margin: 0;
  color: #64748b;
  font-size: .9rem;
  line-height: 1.5;
  font-weight: 800;
}

.att-status {
  min-height: 34px;
  border-radius: 999px;
  padding: 0 12px;
  display: inline-flex;
  align-items: center;
  font-size: .8rem;
  font-weight: 950;
}

.att-status.draft {
  background: #fffbeb;
  color: #b45309;
}

.att-status.approved {
  background: #ecfdf3;
  color: #047857;
}

.att-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0,1fr));
  gap: 14px;
}

.att-field {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.att-field.span-2 {
  grid-column: span 2;
}

.att-field label {
  color: #334155;
  font-size: .86rem;
  font-weight: 900;
}

.att-field input,
.att-field select,
.att-search-box input {
  width: 100%;
  min-height: 50px;
  border-radius: 16px;
  border: 1px solid #dbe2ea;
  padding: 0 14px;
  background: #fff;
  color: #0f172a;
  font-size: .94rem;
}

.att-field input:focus,
.att-field select:focus,
.att-search-box input:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 4px rgba(37,99,235,.08);
}

.att-search-box {
  position: relative;
}

.att-search-box svg {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  color: #64748b;
}

.att-search-box input {
  padding-left: 42px;
}

.att-card-actions,
.att-inline-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.att-card-actions {
  margin-top: 16px;
}

.att-btn,
.att-upload-btn {
  min-height: 44px;
  border: none;
  border-radius: 15px;
  padding: 0 15px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  font-size: .88rem;
  font-weight: 950;
}

.att-btn.primary {
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  color: #fff;
  box-shadow: 0 14px 30px rgba(37,99,235,.22);
}

.att-btn.soft {
  background: #eef4ff;
  color: #1d4ed8;
}

.att-btn.orange {
  background: linear-gradient(135deg, #f97316, #ea580c);
  color: #fff;
  box-shadow: 0 14px 30px rgba(249,115,22,.22);
}

.att-upload-box,
.att-approval-box {
  border-radius: 22px;
  padding: 18px;
  background: #f8fafc;
  border: 1px solid #e8eef7;
}

.att-upload-box {
  display: grid;
  gap: 14px;
}

.att-upload-btn {
  width: fit-content;
  background: #0f172a;
  color: #fff;
}

.att-upload-box span,
.att-approval-box span {
  display: block;
  color: #64748b;
  font-size: .8rem;
  font-weight: 900;
  margin-bottom: 6px;
}

.att-upload-box strong,
.att-approval-box strong {
  display: block;
  color: #0f172a;
  font-size: .92rem;
  font-weight: 950;
  word-break: break-word;
}

.att-approval-box {
  margin-top: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.att-alert {
  margin-top: 14px;
  border-radius: 18px;
  padding: 14px 16px;
  font-size: .9rem;
  font-weight: 900;
}

.att-alert.success {
  background: #ecfdf3;
  color: #047857;
  border: 1px solid #a7f3d0;
}

.att-alert.error {
  background: #fff1f2;
  color: #be123c;
  border: 1px solid #fecdd3;
}

.att-manager-panel {
  display: grid;
  gap: 12px;
  padding: 18px;
  border-radius: 22px;
  border: 1px solid #dbeafe;
  background: linear-gradient(180deg, #f8fbff, #fff);
}

.att-available-list {
  display: grid;
  gap: 10px;
  max-height: 340px;
  overflow: auto;
}

.att-available-item {
  border-radius: 18px;
  padding: 15px;
  background: #fff;
  border: 1px solid #e8eef7;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
}

.att-available-item strong {
  color: #0f172a;
  font-size: .96rem;
  font-weight: 950;
}

.att-available-item p {
  margin: 6px 0 0;
  color: #64748b;
  font-size: .84rem;
  line-height: 1.55;
  font-weight: 800;
}

.att-table-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.att-table-meta span {
  min-height: 32px;
  border-radius: 999px;
  padding: 0 11px;
  display: inline-flex;
  align-items: center;
  background: #eff6ff;
  color: #1d4ed8;
  font-size: .78rem;
  font-weight: 950;
}

.att-summary-strip {
  display: grid;
  grid-template-columns: repeat(5, minmax(0,1fr));
  gap: 12px;
  margin-bottom: 18px;
}

.att-summary-strip div {
  border-radius: 20px;
  padding: 16px;
  background: #f8fafc;
  border: 1px solid #e8eef7;
}

.att-summary-strip span {
  display: block;
  color: #64748b;
  font-size: .82rem;
  font-weight: 900;
  margin-bottom: 8px;
}

.att-summary-strip strong {
  color: #0f172a;
  font-size: 1.35rem;
  font-weight: 950;
}

.att-table-shell {
  width: 100%;
  max-width: 100%;
  overflow: auto;
  border-radius: 24px;
  border: 1px solid #e8eef7;
  background: #fff;
}

.att-table {
  width: max-content;
  min-width: 1900px;
  border-collapse: separate;
  border-spacing: 0;
  table-layout: auto;
}

.att-table thead th {
  position: sticky;
  top: 0;
  z-index: 3;
  background: #f8fafc;
  color: #334155;
  font-size: .8rem;
  font-weight: 950;
  white-space: nowrap;
  border-bottom: 1px solid #e5e7eb;
  padding: 14px 12px;
  text-align: center;
}

.att-table tbody td {
  padding: 10px;
  border-bottom: 1px solid #eef2f7;
  border-right: 1px solid #f1f5f9;
  text-align: center;
  vertical-align: top;
  background: #fff;
  white-space: nowrap;
}

.att-table tbody tr:hover td {
  background: #fbfdff;
}

.sticky-col {
  position: sticky;
  left: 0;
  z-index: 2;
  background: #fff !important;
  box-shadow: 8px 0 12px -10px rgba(15,23,42,.18);
}

.att-table thead .sticky-col {
  z-index: 4;
  background: #f8fafc !important;
}

.emp-col {
  min-width: 330px;
  max-width: 330px;
  width: 330px;
  text-align: left !important;
}

.emp-box {
  display: grid;
  gap: 4px;
}

.emp-box strong {
  color: #0f172a;
  font-size: .92rem;
  font-weight: 950;
  overflow: hidden;
  text-overflow: ellipsis;
}

.emp-box span {
  color: #64748b;
  font-size: .75rem;
  font-weight: 800;
}

.emp-box em {
  width: fit-content;
  border-radius: 999px;
  padding: 4px 8px;
  background: #eff6ff;
  color: #1d4ed8;
  font-style: normal;
  font-size: .68rem;
  font-weight: 950;
}

.actions-col {
  min-width: 260px;
  width: 260px;
}

.weekend-head {
  background: #1e293b !important;
  color: #cbd5e1 !important;
}

.att-cell {
  min-width: 92px;
}

.att-cell.absent { background: #fff5f5 !important; }
.att-cell.single { background: #fff7ed !important; }
.att-cell.leave,
.att-cell.sick { background: #eff6ff !important; }
.att-cell.permission,
.att-cell.takleef { background: #fffbeb !important; }
.att-cell.weekend { background: #f8fafc !important; }

.cell-inner {
  display: grid;
  gap: 8px;
  justify-items: center;
}

.cell-value {
  min-height: 34px;
  min-width: 44px;
  border-radius: 999px;
  padding: 0 9px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #eef2ff;
  color: #0f172a;
  font-size: .86rem;
  font-weight: 950;
}

.cell-value.absent {
  background: #ffe4e6;
  color: #be123c;
}

.cell-value.single {
  background: #ffedd5;
  color: #c2410c;
}

.cell-value.weekend {
  background: #e2e8f0;
  color: #334155;
}

.cell-select {
  width: 100%;
  min-height: 34px;
  border-radius: 12px;
  border: 1px solid #dbe2ea;
  padding: 0 8px;
  background: #fff;
  color: #0f172a;
  font-size: .78rem;
}

.project-title-row td {
  position: sticky;
  left: 0;
  z-index: 4;
  padding: 0 !important;
  background: linear-gradient(135deg, #0f172a, #1e3a8a) !important;
}

.project-title-content {
  min-width: 100%;
  padding: 15px 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  color: #fff;
}

.project-title-content div {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.project-title-content strong {
  color: #fff;
  font-weight: 950;
}

.project-title-content span {
  border-radius: 999px;
  padding: 6px 10px;
  background: rgba(255,255,255,.12);
  color: #dbeafe;
  font-size: .78rem;
  font-weight: 900;
}

.project-title-content button {
  min-height: 36px;
  border: 1px solid rgba(255,255,255,.18);
  border-radius: 13px;
  padding: 0 12px;
  background: rgba(255,255,255,.12);
  color: #fff;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  cursor: pointer;
  font-weight: 950;
}

.project-summary-cell {
  padding: 0 !important;
  background: #fff !important;
}

.project-summary {
  margin: 14px;
  display: grid;
  grid-template-columns: repeat(6, minmax(0,1fr));
  gap: 10px;
  padding: 16px;
  border-radius: 22px;
  background: linear-gradient(180deg, #fff, #f8fafc);
  border: 1px solid #e8eef7;
}

.project-summary div {
  border-radius: 16px;
  padding: 13px;
  background: #f8fafc;
  border: 1px solid #eef2f7;
}

.project-summary span {
  display: block;
  color: #64748b;
  font-size: .76rem;
  font-weight: 900;
  margin-bottom: 6px;
}

.project-summary strong {
  color: #0f172a;
  font-size: 1.1rem;
  font-weight: 950;
}

.row-actions {
  display: flex;
  justify-content: center;
  gap: 8px;
  flex-wrap: wrap;
}

.mini {
  min-height: 34px;
  border-radius: 12px;
  padding: 0 10px;
  border: 1px solid transparent;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  font-size: .74rem;
  font-weight: 950;
}

.mini.danger {
  background: #fff1f2;
  color: #be123c;
  border-color: #fecdd3;
}

.mini.muted {
  background: #f8fafc;
  color: #334155;
  border-color: #e2e8f0;
}

.mini.blue {
  background: #eef4ff;
  color: #1d4ed8;
  border-color: #c7d7fe;
}

.att-empty {
  border-radius: 20px;
  padding: 18px;
  text-align: center;
  background: #f8fafc;
  border: 1px dashed #cbd5e1;
  color: #64748b;
  font-weight: 900;
}

.att-empty.large {
  padding: 42px 20px;
}

html.dark .attendance-ultra-page .att-card,
html.dark .attendance-ultra-page .att-table-card,
html.dark .attendance-ultra-page .att-kpi-card {
  background: #111a2d;
  border-color: #24324d;
}

html.dark .attendance-ultra-page .att-card h2,
html.dark .attendance-ultra-page .att-table-head h2,
html.dark .attendance-ultra-page .att-kpi-card strong,
html.dark .attendance-ultra-page .att-summary-strip strong,
html.dark .attendance-ultra-page .att-upload-box strong,
html.dark .attendance-ultra-page .att-approval-box strong {
  color: #e5eefc;
}

html.dark .attendance-ultra-page .att-card p,
html.dark .attendance-ultra-page .att-table-head p,
html.dark .attendance-ultra-page .att-kpi-card span,
html.dark .attendance-ultra-page .att-kpi-card p,
html.dark .attendance-ultra-page .att-field label {
  color: #9fb0cf;
}

html.dark .attendance-ultra-page .att-upload-box,
html.dark .attendance-ultra-page .att-approval-box,
html.dark .attendance-ultra-page .att-summary-strip div,
html.dark .attendance-ultra-page .att-manager-panel,
html.dark .attendance-ultra-page .att-empty {
  background: #0f1728;
  border-color: #24324d;
}

@media (max-width: 1280px) {
  .att-hero,
  .att-control-grid {
    grid-template-columns: 1fr;
  }

  .att-kpi-grid {
    grid-template-columns: repeat(2, minmax(0,1fr));
  }

  .att-summary-strip,
  .project-summary {
    grid-template-columns: repeat(2, minmax(0,1fr));
  }
}

@media (max-width: 768px) {
  .attendance-ultra-page {
    gap: 14px;
  }

  .att-hero {
    border-radius: 26px;
    padding: 22px;
  }

  .att-hero h1 {
    font-size: 2.1rem;
  }

  .att-hero-panel {
    display: none;
  }

  .att-kpi-grid,
  .att-form-grid,
  .att-summary-strip,
  .project-summary {
    grid-template-columns: 1fr;
  }

  .att-field.span-2 {
    grid-column: span 1;
  }

  .att-card,
  .att-table-card,
  .att-kpi-card {
    border-radius: 24px;
  }

  .emp-col {
    min-width: 245px;
    max-width: 245px;
    width: 245px;
  }

  .att-table {
    min-width: 1550px;
  }

  .actions-col {
    min-width: 220px;
    width: 220px;
  }
}
`;
