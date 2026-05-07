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
  Sparkles,
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

function ExportButtons({ rows, fileName, sheetName, disabled }) {
  return (
    <div className="v3-inline-actions">
      <button
        type="button"
        className="v3-btn soft"
        onClick={() => exportSheet(rows, fileName, sheetName)}
        disabled={disabled}
      >
        <FileSpreadsheet size={15} />
        Excel
      </button>

      <button type="button" className="v3-btn soft" onClick={() => window.print()} disabled={disabled}>
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
    <div className="attendance-v3-page">
      <style>{attendanceV3Styles}</style>

      <section className="v3-command-bar">
        <div className="v3-title-wrap">
          <div className="v3-title-icon">
            <CalendarDays size={22} />
          </div>

          <div>
            <h1>Attendance Command Workspace</h1>
            <p>Enterprise attendance management and analytics center.</p>
          </div>
        </div>

        <div className="v3-command-right">
          <div className="v3-filter-group">
            <label>Month</label>
            <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))}>
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>{i + 1}</option>
              ))}
            </select>
          </div>

          <div className="v3-filter-group">
            <label>Year</label>
            <input
              type="number"
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value) || now.getFullYear())}
            />
          </div>

          <div className="v3-filter-group wide">
            <label>Search</label>
            <div className="v3-search-box">
              <Search size={16} />
              <input
                value={employeeFilter}
                onChange={(e) => setEmployeeFilter(e.target.value)}
                placeholder="Search employee, GAS ID, project..."
              />
            </div>
          </div>

          <div className="v3-filter-group">
            <label>Project</label>
            <select value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)}>
              {projectOptions.map((project) => (
                <option key={project} value={project}>
                  {project === "all" ? "All Projects" : project}
                </option>
              ))}
            </select>
          </div>

          <div className="v3-filter-group">
            <label>Issues</label>
            <select value={issueFilter} onChange={(e) => setIssueFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="issues">Only Issues</option>
              <option value="absent">Absent</option>
              <option value="single">Single Punch</option>
              <option value="leaves">Leaves</option>
            </select>
          </div>

          <div className="v3-command-actions">
            <button type="button" className="v3-btn soft" onClick={loadSelectedMonthSheet} disabled={sheetLoading}>
              <RefreshCcw size={15} />
              {sheetLoading ? "Loading..." : "Load"}
            </button>

            <label className="v3-btn dark">
              <Upload size={15} />
              {loading ? "Uploading..." : "Upload CSV"}
              <input hidden type="file" accept=".csv" onChange={onFileUpload} />
            </label>

            {batchStatus === "approved" ? (
              <button type="button" className="v3-btn orange" onClick={handleReopen} disabled={!batchId || approving}>
                <Unlock size={15} />
                {approving ? "Reopening..." : "Reopen"}
              </button>
            ) : (
              <button type="button" className="v3-btn primary" onClick={handleApprove} disabled={!batchId || approving}>
                <CheckCircle2 size={15} />
                {approving ? "Approving..." : "Approve"}
              </button>
            )}
          </div>
        </div>

        {message ? (
          <div className={`v3-alert ${messageType === "error" ? "error" : "success"}`}>
            {message}
          </div>
        ) : null}
      </section>

      <section className="v3-overview-grid">
        <article className="v3-overview-card blue">
          <div>
            <span>Total Employees</span>
            <strong>{totalEmployees}</strong>
            <p>Employees inside current sheet</p>
          </div>
          <Users size={30} />
        </article>

        <article className="v3-overview-card green">
          <div>
            <span>Total Hours</span>
            <strong>{Math.round(totalHours)}</strong>
            <p>Total monthly accumulated hours</p>
          </div>
          <Clock3 size={30} />
        </article>

        <article className="v3-overview-card orange">
          <div>
            <span>Single Punch</span>
            <strong>{singlePunchCount}</strong>
            <p>Records need HR review</p>
          </div>
          <AlertTriangle size={30} />
        </article>

        <article className="v3-overview-card red">
          <div>
            <span>Absent</span>
            <strong>{absentCount}</strong>
            <p>Absence cases detected</p>
          </div>
          <UserX size={30} />
        </article>

        <article className="v3-overview-card dark">
          <div>
            <span>Health Score</span>
            <strong>{healthScore}%</strong>
            <p>Attendance system health</p>
          </div>
          <ShieldCheck size={30} />
        </article>
      </section>

      <section className="v3-status-panel">
        <div>
          <div className="v3-status-icon">
            {batchStatus === "approved" ? <Lock size={22} /> : <Unlock size={22} />}
          </div>
          <div>
            <h2>{monthName}</h2>
            <p>
              Batch: <strong>{batchId || "-"}</strong> · File: <strong>{fileName || "-"}</strong>
            </p>
          </div>
        </div>

        <div className="v3-health-bar">
          <span>{batchStatus === "approved" ? "Approved Batch" : "Draft Batch"}</span>
          <div>
            <i style={{ width: `${healthScore}%` }} />
          </div>
          <strong>{healthScore}%</strong>
        </div>
      </section>

      <section className="v3-tabs">
        <button className="active" type="button">
          <Activity size={15} />
          Overview
        </button>
        <button type="button">
          <Building2 size={15} />
          Projects
        </button>
        <button type="button">
          <AlertTriangle size={15} />
          Issues Center
        </button>
        <button type="button">
          <FileSpreadsheet size={15} />
          Attendance Sheet
        </button>
      </section>

      <section className="v3-project-grid">
        {Object.entries(groupedRows).length ? (
          Object.entries(groupedRows).map(([projectName, projectRows]) => {
            const summary = projectSummaries[projectName];

            return (
              <article className="v3-project-card" key={projectName}>
                <div className="v3-project-top">
                  <div>
                    <h3>{projectName}</h3>
                    <p>Attendance analytics and project health</p>
                  </div>

                  <div
                    className={`v3-health-ring ${
                      summary?.health >= 90 ? "good" : summary?.health >= 75 ? "warning" : "danger"
                    }`}
                  >
                    <strong>{summary?.health || 0}%</strong>
                  </div>
                </div>

                <div className="v3-project-stats">
                  <div><span>Employees</span><strong>{summary?.employees || 0}</strong></div>
                  <div><span>Total Hours</span><strong>{Math.round(summary?.hours || 0)}</strong></div>
                  <div><span>Absent</span><strong>{summary?.absent || 0}</strong></div>
                  <div><span>Single Punch</span><strong>{summary?.singlePunch || 0}</strong></div>
                </div>

                <div className="v3-project-actions">
                  <button
                    type="button"
                    className="v3-btn soft"
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
              </article>
            );
          })
        ) : (
          <div className="v3-empty span-all">
            No project data loaded yet. Upload CSV or load an existing month.
          </div>
        )}
      </section>

      {batchId ? (
        <section className="v3-card">
          <div className="v3-card-head">
            <div>
              <h2>Sheet Employee Tools</h2>
              <p>Add or exclude employees from this monthly sheet.</p>
            </div>

            <button type="button" className="v3-btn primary" onClick={handleToggleAddEmployeePanel} disabled={!batchId}>
              <Plus size={15} />
              {showAddEmployeePanel ? "Hide Panel" : "Add Employee"}
            </button>
          </div>

          {showAddEmployeePanel ? (
            <div className="v3-manager-panel">
              <div className="v3-search-box">
                <Search size={16} />
                <input
                  value={availableUsersSearch}
                  onChange={(e) => setAvailableUsersSearch(e.target.value)}
                  placeholder="Search active users by name, GAS ID, project..."
                />
              </div>

              <button
                type="button"
                className="v3-btn soft"
                onClick={() => loadAvailableUsers(availableUsersSearch)}
                disabled={availableUsersLoading}
              >
                <RefreshCcw size={15} />
                {availableUsersLoading ? "Loading..." : "Search Users"}
              </button>

              {availableUsersLoading ? (
                <div className="v3-empty">Loading available users...</div>
              ) : availableUsers.length === 0 ? (
                <div className="v3-empty">No available users found for this sheet.</div>
              ) : (
                <div className="v3-available-list">
                  {availableUsers.map((item) => (
                    <div key={item.user_id || `${item.gas_id}-${item.name}`} className="v3-available-item">
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
                        className="v3-btn primary"
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

      <section className="v3-table-wrapper">
        <div className="v3-table-top">
          <div>
            <h2>{monthName}</h2>
            <p>Attendance sheet with smart editing and project grouping.</p>
          </div>

          <div className="v3-table-actions">
            <ExportButtons
              rows={exportRows}
              fileName="attendance-sheet.xlsx"
              sheetName="Attendance"
              disabled={!filteredRows.length}
            />
          </div>
        </div>

        <div className="v3-summary-strip">
          <div><span>Annual Leave</span><strong>{annualLeaveCount}</strong></div>
          <div><span>Sick Leave</span><strong>{sickLeaveCount}</strong></div>
          <div><span>Emergency Leave</span><strong>{emergencyLeaveCount}</strong></div>
          <div><span>Permission</span><strong>{permissionCount}</strong></div>
          <div><span>Takleef</span><strong>{takleefCount}</strong></div>
        </div>

        {filteredRows.length === 0 ? (
          <div className="v3-empty large">
            Upload the attendance CSV file or load an existing month sheet.
          </div>
        ) : (
          <div className="v3-table-shell">
            <table className="v3-att-table">
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

const attendanceV3Styles = `
.attendance-v3-page{
  display:grid;
  gap:20px;
  color:#0f172a;
  width:100%;
}

.attendance-v3-page *{
  box-sizing:border-box;
}

.v3-command-bar{
  position:sticky;
  top:12px;
  z-index:30;
  border-radius:32px;
  padding:22px;
  backdrop-filter:blur(20px);
  background:rgba(255,255,255,.9);
  border:1px solid #e8eef7;
  box-shadow:0 18px 50px rgba(15,23,42,.08);
}

.v3-title-wrap{
  display:flex;
  gap:14px;
  align-items:flex-start;
}

.v3-title-icon{
  width:54px;
  height:54px;
  border-radius:20px;
  display:grid;
  place-items:center;
  background:linear-gradient(135deg,#2563eb,#1d4ed8);
  color:#fff;
  box-shadow:0 16px 30px rgba(37,99,235,.22);
}

.v3-title-wrap h1{
  margin:0;
  font-size:2rem;
  font-weight:950;
  letter-spacing:-.05em;
}

.v3-title-wrap p{
  margin:6px 0 0;
  color:#64748b;
  font-weight:800;
}

.v3-command-right{
  margin-top:20px;
  display:grid;
  grid-template-columns:110px 120px minmax(260px,1fr) 190px 140px auto;
  gap:14px;
  align-items:end;
}

.v3-filter-group{
  display:grid;
  gap:8px;
  min-width:0;
}

.v3-filter-group label{
  color:#475569;
  font-size:.82rem;
  font-weight:900;
}

.v3-filter-group input,
.v3-filter-group select,
.v3-search-box input{
  width:100%;
  min-height:50px;
  border-radius:16px;
  border:1px solid #dbe2ea;
  padding:0 14px;
  background:#fff;
  color:#0f172a;
  font-size:.92rem;
}

.v3-filter-group input:focus,
.v3-filter-group select:focus,
.v3-search-box input:focus{
  outline:none;
  border-color:#2563eb;
  box-shadow:0 0 0 4px rgba(37,99,235,.08);
}

.v3-search-box{
  position:relative;
}

.v3-search-box svg{
  position:absolute;
  left:14px;
  top:50%;
  transform:translateY(-50%);
  color:#64748b;
}

.v3-search-box input{
  padding-left:42px;
}

.v3-command-actions,
.v3-inline-actions{
  display:flex;
  gap:10px;
  flex-wrap:wrap;
}

.v3-btn{
  min-height:48px;
  border:none;
  border-radius:16px;
  padding:0 16px;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  gap:8px;
  cursor:pointer;
  font-weight:950;
  font-size:.88rem;
  transition:.18s ease;
}

.v3-btn:hover{
  transform:translateY(-1px);
}

.v3-btn:disabled{
  opacity:.55;
  cursor:not-allowed;
  transform:none;
}

.v3-btn.primary{
  background:linear-gradient(135deg,#2563eb,#1d4ed8);
  color:#fff;
  box-shadow:0 14px 28px rgba(37,99,235,.22);
}

.v3-btn.soft{
  background:#eef4ff;
  color:#1d4ed8;
}

.v3-btn.dark{
  background:#0f172a;
  color:#fff;
}

.v3-btn.orange{
  background:linear-gradient(135deg,#f97316,#ea580c);
  color:#fff;
  box-shadow:0 14px 28px rgba(249,115,22,.22);
}

.v3-alert{
  margin-top:16px;
  border-radius:18px;
  padding:14px 16px;
  font-weight:900;
  font-size:.9rem;
}

.v3-alert.success{
  background:#ecfdf3;
  color:#047857;
  border:1px solid #a7f3d0;
}

.v3-alert.error{
  background:#fff1f2;
  color:#be123c;
  border:1px solid #fecdd3;
}

.v3-overview-grid{
  display:grid;
  grid-template-columns:repeat(5,minmax(0,1fr));
  gap:16px;
}

.v3-overview-card{
  position:relative;
  overflow:hidden;
  border-radius:28px;
  padding:22px;
  background:#fff;
  border:1px solid #e8eef7;
  box-shadow:0 16px 42px rgba(15,23,42,.05);
  display:flex;
  justify-content:space-between;
  gap:14px;
  min-height:145px;
}

.v3-overview-card::after{
  content:"";
  position:absolute;
  width:120px;
  height:120px;
  right:-40px;
  top:-40px;
  border-radius:999px;
  background:rgba(37,99,235,.08);
}

.v3-overview-card.green::after{background:rgba(34,197,94,.1);}
.v3-overview-card.orange::after{background:rgba(249,115,22,.1);}
.v3-overview-card.red::after{background:rgba(239,68,68,.1);}
.v3-overview-card.dark::after{background:rgba(15,23,42,.1);}

.v3-overview-card svg{
  position:relative;
  z-index:2;
  color:#1d4ed8;
}

.v3-overview-card.green svg{color:#16a34a;}
.v3-overview-card.orange svg{color:#ea580c;}
.v3-overview-card.red svg{color:#dc2626;}
.v3-overview-card.dark svg{color:#0f172a;}

.v3-overview-card span{
  color:#64748b;
  font-size:.82rem;
  font-weight:900;
}

.v3-overview-card strong{
  display:block;
  margin-top:10px;
  font-size:2.2rem;
  font-weight:950;
  letter-spacing:-.05em;
}

.v3-overview-card p{
  margin:10px 0 0;
  color:#94a3b8;
  font-size:.76rem;
  font-weight:800;
  line-height:1.45;
}

.v3-status-panel,
.v3-card,
.v3-table-wrapper{
  border-radius:32px;
  padding:24px;
  background:#fff;
  border:1px solid #e8eef7;
  box-shadow:0 16px 42px rgba(15,23,42,.05);
}

.v3-status-panel{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:18px;
  flex-wrap:wrap;
}

.v3-status-panel > div:first-child{
  display:flex;
  align-items:center;
  gap:14px;
}

.v3-status-icon{
  width:54px;
  height:54px;
  border-radius:20px;
  display:grid;
  place-items:center;
  color:#fff;
  background:linear-gradient(135deg,#0f172a,#1e3a8a);
}

.v3-status-panel h2{
  margin:0;
  font-size:1.3rem;
  font-weight:950;
}

.v3-status-panel p{
  margin:5px 0 0;
  color:#64748b;
  font-weight:800;
}

.v3-health-bar{
  min-width:280px;
  display:grid;
  gap:8px;
}

.v3-health-bar span{
  color:#64748b;
  font-size:.8rem;
  font-weight:900;
}

.v3-health-bar div{
  height:12px;
  overflow:hidden;
  border-radius:999px;
  background:#e2e8f0;
}

.v3-health-bar i{
  display:block;
  height:100%;
  border-radius:inherit;
  background:linear-gradient(90deg,#2563eb,#22c55e);
}

.v3-health-bar strong{
  font-weight:950;
}

.v3-tabs{
  display:flex;
  gap:12px;
  flex-wrap:wrap;
}

.v3-tabs button{
  min-height:46px;
  border:none;
  border-radius:16px;
  padding:0 16px;
  display:flex;
  align-items:center;
  gap:8px;
  background:#f8fafc;
  color:#334155;
  cursor:pointer;
  font-weight:900;
}

.v3-tabs button.active{
  background:#0f172a;
  color:#fff;
}

.v3-project-grid{
  display:grid;
  grid-template-columns:repeat(3,minmax(0,1fr));
  gap:18px;
}

.v3-project-card{
  border-radius:30px;
  padding:24px;
  background:#fff;
  border:1px solid #e8eef7;
  box-shadow:0 16px 42px rgba(15,23,42,.05);
}

.v3-project-top{
  display:flex;
  justify-content:space-between;
  gap:14px;
}

.v3-project-top h3{
  margin:0;
  font-size:1.2rem;
  font-weight:950;
}

.v3-project-top p{
  margin:6px 0 0;
  color:#64748b;
  font-size:.84rem;
  font-weight:800;
}

.v3-health-ring{
  width:82px;
  height:82px;
  border-radius:999px;
  display:grid;
  place-items:center;
  border:6px solid #22c55e;
  flex:0 0 auto;
}

.v3-health-ring.warning{border-color:#f59e0b;}
.v3-health-ring.danger{border-color:#ef4444;}

.v3-health-ring strong{
  font-size:1rem;
  font-weight:950;
}

.v3-project-stats{
  margin-top:20px;
  display:grid;
  grid-template-columns:repeat(2,minmax(0,1fr));
  gap:12px;
}

.v3-project-stats div{
  border-radius:18px;
  padding:14px;
  background:#f8fafc;
  border:1px solid #eef2f7;
}

.v3-project-stats span{
  display:block;
  color:#64748b;
  font-size:.76rem;
  font-weight:900;
  margin-bottom:8px;
}

.v3-project-stats strong{
  font-size:1.1rem;
  font-weight:950;
}

.v3-project-actions{
  margin-top:18px;
  display:flex;
  gap:10px;
  flex-wrap:wrap;
}

.v3-card-head,
.v3-table-top{
  display:flex;
  justify-content:space-between;
  gap:14px;
  align-items:flex-start;
  flex-wrap:wrap;
  margin-bottom:18px;
}

.v3-card-head h2,
.v3-table-top h2{
  margin:0;
  font-size:1.3rem;
  font-weight:950;
}

.v3-card-head p,
.v3-table-top p{
  margin:6px 0 0;
  color:#64748b;
  font-weight:800;
}

.v3-manager-panel{
  display:grid;
  gap:12px;
  padding:18px;
  border-radius:22px;
  border:1px solid #dbeafe;
  background:linear-gradient(180deg,#f8fbff,#fff);
}

.v3-available-list{
  display:grid;
  gap:10px;
  max-height:340px;
  overflow:auto;
}

.v3-available-item{
  border-radius:18px;
  padding:15px;
  background:#fff;
  border:1px solid #e8eef7;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:14px;
  flex-wrap:wrap;
}

.v3-available-item strong{
  color:#0f172a;
  font-size:.96rem;
  font-weight:950;
}

.v3-available-item p{
  margin:6px 0 0;
  color:#64748b;
  font-size:.84rem;
  line-height:1.55;
  font-weight:800;
}

.v3-summary-strip{
  display:grid;
  grid-template-columns:repeat(5,minmax(0,1fr));
  gap:12px;
  margin-bottom:18px;
}

.v3-summary-strip div{
  border-radius:20px;
  padding:16px;
  background:#f8fafc;
  border:1px solid #e8eef7;
}

.v3-summary-strip span{
  display:block;
  color:#64748b;
  font-size:.82rem;
  font-weight:900;
  margin-bottom:8px;
}

.v3-summary-strip strong{
  color:#0f172a;
  font-size:1.35rem;
  font-weight:950;
}

.v3-table-shell{
  width:100%;
  max-width:100%;
  overflow:auto;
  border-radius:24px;
  border:1px solid #e8eef7;
  background:#fff;
}

.v3-att-table{
  width:max-content;
  min-width:1900px;
  border-collapse:separate;
  border-spacing:0;
  table-layout:auto;
}

.v3-att-table thead th{
  position:sticky;
  top:0;
  z-index:3;
  background:#f8fafc;
  color:#334155;
  font-size:.8rem;
  font-weight:950;
  white-space:nowrap;
  border-bottom:1px solid #e5e7eb;
  padding:14px 12px;
  text-align:center;
}

.v3-att-table tbody td{
  padding:10px;
  border-bottom:1px solid #eef2f7;
  border-right:1px solid #f1f5f9;
  text-align:center;
  vertical-align:top;
  background:#fff;
  white-space:nowrap;
}

.v3-att-table tbody tr:hover td{
  background:#fbfdff;
}

.sticky-col{
  position:sticky;
  left:0;
  z-index:2;
  background:#fff !important;
  box-shadow:8px 0 12px -10px rgba(15,23,42,.18);
}

.v3-att-table thead .sticky-col{
  z-index:4;
  background:#f8fafc !important;
}

.emp-col{
  min-width:330px;
  max-width:330px;
  width:330px;
  text-align:left !important;
}

.emp-box{
  display:grid;
  gap:4px;
}

.emp-box strong{
  color:#0f172a;
  font-size:.92rem;
  font-weight:950;
  overflow:hidden;
  text-overflow:ellipsis;
}

.emp-box span{
  color:#64748b;
  font-size:.75rem;
  font-weight:800;
}

.emp-box em{
  width:fit-content;
  border-radius:999px;
  padding:4px 8px;
  background:#eff6ff;
  color:#1d4ed8;
  font-style:normal;
  font-size:.68rem;
  font-weight:950;
}

.actions-col{
  min-width:260px;
  width:260px;
}

.weekend-head{
  background:#1e293b !important;
  color:#cbd5e1 !important;
}

.att-cell{
  min-width:92px;
}

.att-cell.absent{background:#fff5f5 !important;}
.att-cell.single{background:#fff7ed !important;}
.att-cell.leave,
.att-cell.sick{background:#eff6ff !important;}
.att-cell.permission,
.att-cell.takleef{background:#fffbeb !important;}
.att-cell.weekend{background:#f8fafc !important;}

.cell-inner{
  display:grid;
  gap:8px;
  justify-items:center;
}

.cell-value{
  min-height:34px;
  min-width:44px;
  border-radius:999px;
  padding:0 9px;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  background:#eef2ff;
  color:#0f172a;
  font-size:.86rem;
  font-weight:950;
}

.cell-value.absent{
  background:#ffe4e6;
  color:#be123c;
}

.cell-value.single{
  background:#ffedd5;
  color:#c2410c;
}

.cell-value.weekend{
  background:#e2e8f0;
  color:#334155;
}

.cell-select{
  width:100%;
  min-height:34px;
  border-radius:12px;
  border:1px solid #dbe2ea;
  padding:0 8px;
  background:#fff;
  color:#0f172a;
  font-size:.78rem;
}

.project-title-row td{
  position:sticky;
  left:0;
  z-index:4;
  padding:0 !important;
  background:linear-gradient(135deg,#0f172a,#1e3a8a) !important;
}

.project-title-content{
  min-width:100%;
  padding:15px 18px;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:14px;
  color:#fff;
}

.project-title-content div{
  display:flex;
  align-items:center;
  gap:10px;
  flex-wrap:wrap;
}

.project-title-content strong{
  color:#fff;
  font-weight:950;
}

.project-title-content span{
  border-radius:999px;
  padding:6px 10px;
  background:rgba(255,255,255,.12);
  color:#dbeafe;
  font-size:.78rem;
  font-weight:900;
}

.project-title-content button{
  min-height:36px;
  border:1px solid rgba(255,255,255,.18);
  border-radius:13px;
  padding:0 12px;
  background:rgba(255,255,255,.12);
  color:#fff;
  display:inline-flex;
  align-items:center;
  gap:7px;
  cursor:pointer;
  font-weight:950;
}

.row-actions{
  display:flex;
  justify-content:center;
  gap:8px;
  flex-wrap:wrap;
}

.mini{
  min-height:34px;
  border-radius:12px;
  padding:0 10px;
  border:1px solid transparent;
  display:inline-flex;
  align-items:center;
  gap:6px;
  cursor:pointer;
  font-size:.74rem;
  font-weight:950;
}

.mini.danger{
  background:#fff1f2;
  color:#be123c;
  border-color:#fecdd3;
}

.mini.muted{
  background:#f8fafc;
  color:#334155;
  border-color:#e2e8f0;
}

.mini.blue{
  background:#eef4ff;
  color:#1d4ed8;
  border-color:#c7d7fe;
}

.v3-empty{
  border-radius:20px;
  padding:18px;
  text-align:center;
  background:#f8fafc;
  border:1px dashed #cbd5e1;
  color:#64748b;
  font-weight:900;
}

.v3-empty.large{
  padding:42px 20px;
}

.v3-empty.span-all{
  grid-column:1 / -1;
}

html.dark .attendance-v3-page .v3-command-bar,
html.dark .attendance-v3-page .v3-overview-card,
html.dark .attendance-v3-page .v3-status-panel,
html.dark .attendance-v3-page .v3-project-card,
html.dark .attendance-v3-page .v3-card,
html.dark .attendance-v3-page .v3-table-wrapper{
  background:#111a2d;
  border-color:#24324d;
}

html.dark .attendance-v3-page h1,
html.dark .attendance-v3-page h2,
html.dark .attendance-v3-page h3,
html.dark .attendance-v3-page .v3-overview-card strong,
html.dark .attendance-v3-page .v3-summary-strip strong{
  color:#e5eefc;
}

html.dark .attendance-v3-page p,
html.dark .attendance-v3-page span,
html.dark .attendance-v3-page label{
  color:#9fb0cf;
}

html.dark .attendance-v3-page .v3-filter-group input,
html.dark .attendance-v3-page .v3-filter-group select,
html.dark .attendance-v3-page .v3-search-box input{
  background:#0f1728;
  border-color:#24324d;
  color:#e5eefc;
}

html.dark .attendance-v3-page .v3-summary-strip div,
html.dark .attendance-v3-page .v3-manager-panel,
html.dark .attendance-v3-page .v3-empty,
html.dark .attendance-v3-page .v3-project-stats div{
  background:#0f1728;
  border-color:#24324d;
}

@media (max-width:1280px){
  .v3-command-right{
    grid-template-columns:repeat(2,minmax(0,1fr));
  }

  .v3-overview-grid{
    grid-template-columns:repeat(2,minmax(0,1fr));
  }

  .v3-project-grid{
    grid-template-columns:repeat(2,minmax(0,1fr));
  }

  .v3-summary-strip{
    grid-template-columns:repeat(2,minmax(0,1fr));
  }
}

@media (max-width:768px){
  .v3-command-bar{
    position:relative;
    top:auto;
    border-radius:24px;
  }

  .v3-title-wrap h1{
    font-size:1.55rem;
  }

  .v3-command-right,
  .v3-overview-grid,
  .v3-project-grid,
  .v3-summary-strip{
    grid-template-columns:1fr;
  }

  .v3-status-panel{
    align-items:flex-start;
  }

  .v3-health-bar{
    min-width:100%;
  }

  .emp-col{
    min-width:245px;
    max-width:245px;
    width:245px;
  }

  .v3-att-table{
    min-width:1550px;
  }

  .actions-col{
    min-width:220px;
    width:220px;
  }
}
`;
