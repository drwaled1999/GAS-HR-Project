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
} from "lucide-react";
import {
  uploadAttendanceFile,
  getAttendanceSheet,
  updateAttendanceImportRow,
  approveAttendanceBatch,
  getAvailableAttendanceUsers,
  addUserToAttendanceSheet,
  excludeUserFromAttendanceSheet,
  markAttendanceUserStatus,
  directUpdateAttendance,
} from "../services/api";
import { useAuth } from "../context/AuthContext";

function exportSheet(rows, fileName, sheetName) {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, fileName);
}

function ExportButtons({ rows, fileName, sheetName, disabled }) {
  return (
    <div className="inline-actions">
      <button
        type="button"
        className="btn secondary"
        onClick={() => exportSheet(rows, fileName, sheetName)}
        disabled={disabled}
      >
        <FileSpreadsheet size={14} />
        Excel
      </button>

      <button
        type="button"
        className="btn secondary"
        onClick={() => window.print()}
        disabled={disabled}
      >
        <FileText size={14} />
        PDF
      </button>
    </div>
  );
}

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

  const filteredRows = useMemo(() => {
    const keyword = String(employeeFilter || "").toLowerCase().trim();

    if (!keyword) return safeRows;

    return safeRows.filter((row) => {
      const name = String(row?.name || "").toLowerCase();
      const userId = String(row?.userId || "").toLowerCase();
      return name.includes(keyword) || userId.includes(keyword);
    });
  }, [safeRows, employeeFilter]);

  const totalEmployees = filteredRows.length;
  const totalHours = filteredRows.reduce(
    (sum, row) => sum + Number(row?.totalHours || 0),
    0
  );
  const absentCount = filteredRows.reduce(
    (sum, row) => sum + Number(row?.absentCount || 0),
    0
  );
  const singlePunchCount = filteredRows.reduce(
    (sum, row) => sum + Number(row?.singlePunchCount || 0),
    0
  );
  const annualLeaveCount = filteredRows.reduce(
    (sum, row) => sum + Number(row?.annualLeaveCount || 0),
    0
  );
  const sickLeaveCount = filteredRows.reduce(
    (sum, row) => sum + Number(row?.sickLeaveCount || 0),
    0
  );
  const emergencyLeaveCount = filteredRows.reduce(
    (sum, row) => sum + Number(row?.emergencyLeaveCount || 0),
    0
  );
  const permissionCount = filteredRows.reduce(
    (sum, row) => sum + Number(row?.permissionCount || 0),
    0
  );
  const takleefCount = filteredRows.reduce(
    (sum, row) => sum + Number(row?.takleefCount || 0),
    0
  );

  const exportRows = [
    [
      "Employee",
      "User ID",
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

      const result = await uploadAttendanceFile(
        file,
        selectedMonth,
        selectedYear,
        actorName
      );

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
        manualHours:
          overrideType === "present"
            ? Number(manualHoursByRow[rowId] || 8)
            : null,
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
    const confirmed = window.confirm(
      `Are you sure you want to mark ${row.name} as ${label}?`
    );
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
    <div className="page-stack attendance-pro-page">
      <style>{`
        .attendance-pro-page {
          display: grid;
          gap: 20px;
          width: 100%;
          max-width: 100%;
        }

        .attendance-pro-page .hero-shell {
          display: grid;
          grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr);
          gap: 18px;
          width: 100%;
        }

        .attendance-pro-page .hero-main,
        .attendance-pro-page .hero-side,
        .attendance-pro-page .control-card,
        .attendance-pro-page .table-card {
          border-radius: 28px;
          border: 1px solid rgba(226, 232, 240, 0.95);
          background: rgba(255, 255, 255, 0.96);
          box-shadow: 0 16px 40px rgba(15, 23, 42, 0.06);
          backdrop-filter: blur(10px);
          min-width: 0;
        }

        .attendance-pro-page .hero-main {
          padding: 28px;
          background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%);
          color: #fff;
          border: none;
        }

        .attendance-pro-page .hero-badge {
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

        .attendance-pro-page .hero-main h2 {
          margin: 0 0 10px 0;
          font-size: 2.4rem;
          font-weight: 900;
          letter-spacing: -0.03em;
          color: #fff;
        }

        .attendance-pro-page .hero-main p {
          margin: 0;
          max-width: 720px;
          color: rgba(255, 255, 255, 0.84);
          line-height: 1.7;
          font-size: 0.98rem;
        }

        .attendance-pro-page .hero-kpis {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
          margin-top: 20px;
        }

        .attendance-pro-page .hero-kpi {
          border-radius: 20px;
          padding: 16px;
          background: rgba(255, 255, 255, 0.12);
          border: 1px solid rgba(255, 255, 255, 0.14);
          min-width: 0;
        }

        .attendance-pro-page .hero-kpi .label {
          display: block;
          color: rgba(255, 255, 255, 0.78);
          font-size: 0.82rem;
          font-weight: 700;
          margin-bottom: 8px;
        }

        .attendance-pro-page .hero-kpi .value {
          font-size: 1.6rem;
          font-weight: 900;
          color: #fff;
          line-height: 1;
        }

        .attendance-pro-page .hero-side {
          padding: 24px;
          display: grid;
          gap: 14px;
          align-content: start;
        }

        .attendance-pro-page .side-title {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 1rem;
          font-weight: 900;
          color: #0f172a;
        }

        .attendance-pro-page .side-stat-list {
          display: grid;
          gap: 12px;
        }

        .attendance-pro-page .side-stat {
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

        .attendance-pro-page .side-stat span {
          color: #64748b;
          font-size: 0.9rem;
          font-weight: 700;
        }

        .attendance-pro-page .side-stat strong {
          color: #0f172a;
          font-size: 1.02rem;
          font-weight: 900;
          text-align: right;
          word-break: break-word;
        }

        .attendance-pro-page .control-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
          gap: 18px;
          width: 100%;
        }

        .attendance-pro-page .control-card {
          padding: 24px;
          min-width: 0;
        }

        .attendance-pro-page .card-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 14px;
          flex-wrap: wrap;
          margin-bottom: 18px;
        }

        .attendance-pro-page .card-head h3 {
          margin: 0 0 6px 0;
          font-size: 1.2rem;
          font-weight: 900;
          color: #0f172a;
        }

        .attendance-pro-page .card-head p {
          margin: 0;
          color: #64748b;
          font-size: 0.92rem;
        }

        .attendance-pro-page .status-pill {
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

        .attendance-pro-page .status-pill.approved {
          background: #ecfdf3;
          color: #047857;
        }

        .attendance-pro-page .form-grid-pro {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .attendance-pro-page .field-pro {
          display: flex;
          flex-direction: column;
          gap: 8px;
          min-width: 0;
        }

        .attendance-pro-page .field-pro.span-2 {
          grid-column: span 2;
        }

        .attendance-pro-page .field-pro label {
          font-size: 0.88rem;
          font-weight: 800;
          color: #334155;
        }

        .attendance-pro-page .field-pro input,
        .attendance-pro-page .field-pro select {
          min-height: 50px;
          border-radius: 16px;
          border: 1px solid #dbe2ea;
          padding: 0 14px;
          background: #fff;
          color: #0f172a;
          font-size: 0.95rem;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
          min-width: 0;
          width: 100%;
        }

        .attendance-pro-page .field-pro input:focus,
        .attendance-pro-page .field-pro select:focus {
          outline: none;
          border-color: #2563eb;
          box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.08);
        }

        .attendance-pro-page .upload-panel {
          border-radius: 18px;
          border: 1px dashed #cbd5e1;
          background: linear-gradient(180deg, #f8fafc, #ffffff);
          padding: 18px;
          display: grid;
          gap: 12px;
          min-width: 0;
        }

        .attendance-pro-page .upload-main {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }

        .attendance-pro-page .upload-meta {
          color: #64748b;
          font-size: 0.9rem;
          font-weight: 700;
          word-break: break-word;
        }

        .attendance-pro-page .action-row {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .attendance-pro-page .inline-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .attendance-pro-page .btn-primary-strong,
        .attendance-pro-page .btn-soft,
        .attendance-pro-page .upload-btn-pro,
        .attendance-pro-page .btn-mini-danger,
        .attendance-pro-page .btn-mini-muted,
        .attendance-pro-page .btn-mini-primary {
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

        .attendance-pro-page .btn-primary-strong:hover,
        .attendance-pro-page .btn-soft:hover,
        .attendance-pro-page .upload-btn-pro:hover,
        .attendance-pro-page .btn-mini-danger:hover,
        .attendance-pro-page .btn-mini-muted:hover,
        .attendance-pro-page .btn-mini-primary:hover {
          transform: translateY(-1px);
        }

        .attendance-pro-page .btn-primary-strong {
          background: linear-gradient(135deg, #2563eb, #1d4ed8);
          color: #fff;
          box-shadow: 0 12px 28px rgba(37, 99, 235, 0.22);
        }

        .attendance-pro-page .btn-soft {
          background: #eef4ff;
          color: #1d4ed8;
        }

        .attendance-pro-page .upload-btn-pro {
          background: #0f172a;
          color: #fff;
        }

        .attendance-pro-page .btn-mini-danger,
        .attendance-pro-page .btn-mini-muted,
        .attendance-pro-page .btn-mini-primary {
          min-height: 34px;
          padding: 0 12px;
          font-size: 0.78rem;
          border-radius: 12px;
        }

        .attendance-pro-page .btn-mini-danger {
          background: #fff1f2;
          color: #be123c;
          border: 1px solid #fecdd3;
        }

        .attendance-pro-page .btn-mini-muted {
          background: #f8fafc;
          color: #334155;
          border: 1px solid #e2e8f0;
        }

        .attendance-pro-page .btn-mini-primary {
          background: #eef4ff;
          color: #1d4ed8;
          border: 1px solid #c7d7fe;
        }

        .attendance-pro-page .alert-pro {
          border-radius: 18px;
          padding: 14px 16px;
          font-weight: 800;
          font-size: 0.94rem;
        }

        .attendance-pro-page .alert-pro.success {
          background: #ecfdf3;
          color: #047857;
          border: 1px solid #a7f3d0;
        }

        .attendance-pro-page .alert-pro.error {
          background: #fff1f2;
          color: #be123c;
          border: 1px solid #fecdd3;
        }

        .attendance-pro-page .table-card {
          padding: 22px;
          width: 100%;
          max-width: 100%;
          overflow: hidden;
        }

        .attendance-pro-page .table-tools {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 16px;
        }

        .attendance-pro-page .table-tools h3 {
          margin: 0 0 6px 0;
          font-size: 1.2rem;
          font-weight: 900;
          color: #0f172a;
        }

        .attendance-pro-page .table-tools p {
          margin: 0;
          color: #64748b;
          font-size: 0.92rem;
        }

        .attendance-pro-page .summary-strip {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 18px;
        }

        .attendance-pro-page .summary-box {
          border-radius: 18px;
          padding: 16px;
          background: #f8fafc;
          border: 1px solid #e9eef5;
          min-width: 0;
        }

        .attendance-pro-page .summary-box span {
          display: block;
          color: #64748b;
          font-size: 0.85rem;
          font-weight: 700;
          margin-bottom: 8px;
        }

        .attendance-pro-page .summary-box strong {
          font-size: 1.35rem;
          font-weight: 900;
          color: #0f172a;
        }

        .attendance-pro-page .attendance-table-shell {
          width: 100%;
          max-width: 100%;
          overflow-x: auto;
          overflow-y: auto;
          border-radius: 22px;
          border: 1px solid #e9eef5;
          background: #fff;
          position: relative;
        }

        .attendance-pro-page .attendance-table {
          width: max-content;
          min-width: 1800px;
          border-collapse: separate;
          border-spacing: 0;
          table-layout: auto;
        }

        .attendance-pro-page .attendance-table thead th {
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

        .attendance-pro-page .attendance-table tbody td {
          padding: 10px 10px;
          border-bottom: 1px solid #eef2f7;
          border-right: 1px solid #f1f5f9;
          text-align: center;
          vertical-align: top;
          background: #fff;
          white-space: nowrap;
        }

        .attendance-pro-page .attendance-table tbody tr:hover td {
          background: #fbfdff;
        }

        .attendance-pro-page .sticky-col {
          position: sticky;
          left: 0;
          z-index: 2;
          background: #fff;
          box-shadow: 8px 0 12px -10px rgba(15, 23, 42, 0.14);
        }

        .attendance-pro-page .attendance-table thead .sticky-col {
          z-index: 3;
          background: #f8fafc;
        }

        .attendance-pro-page .employee-col {
          min-width: 320px;
          max-width: 320px;
          width: 320px;
          text-align: left !important;
          font-weight: 900;
          color: #0f172a;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .attendance-pro-page .actions-col {
          min-width: 260px;
          width: 260px;
        }

        .attendance-pro-page .weekend-head {
          background: #1e293b !important;
          color: #cbd5e1 !important;
        }

        .attendance-pro-page .attendance-cell {
          min-width: 86px;
        }

        .attendance-pro-page .attendance-cell.hours {
          background: #ffffff;
        }

        .attendance-pro-page .attendance-cell.absent {
          background: #fff5f5;
        }

        .attendance-pro-page .attendance-cell.single {
          background: #fff7ed;
        }

        .attendance-pro-page .attendance-cell.leave,
        .attendance-pro-page .attendance-cell.sick {
          background: #eff6ff;
        }

        .attendance-pro-page .attendance-cell.permission,
        .attendance-pro-page .attendance-cell.takleef {
          background: #fffbeb;
        }

        .attendance-pro-page .attendance-cell.weekend {
          background: #f8fafc;
        }

        .attendance-pro-page .cell-box {
          display: grid;
          gap: 8px;
          justify-items: center;
        }

        .attendance-pro-page .cell-value {
          min-height: 34px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 42px;
          padding: 0 8px;
          border-radius: 999px;
          background: rgba(15, 23, 42, 0.05);
          font-weight: 900;
          color: #0f172a;
          font-size: 0.88rem;
        }

        .attendance-pro-page .manual-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 26px;
          padding: 0 10px;
          border-radius: 999px;
          background: #eff6ff;
          color: #1d4ed8;
          font-size: 0.72rem;
          font-weight: 900;
          margin-top: 6px;
        }

        .attendance-pro-page .cell-select {
          min-height: 34px;
          border-radius: 12px;
          border: 1px solid #dbe2ea;
          padding: 0 8px;
          font-size: 0.82rem;
          background: #fff;
          color: #0f172a;
          max-width: 100%;
          width: 100%;
        }

        .attendance-pro-page .cell-select:focus {
          outline: none;
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.08);
        }

        .attendance-pro-page .empty-pro {
          text-align: center;
          padding: 40px 20px;
          border-radius: 20px;
          background: #f8fafc;
          border: 1px dashed #d9e2ea;
          color: #64748b;
          font-weight: 700;
        }

        .attendance-pro-page .manager-panel {
          display: grid;
          gap: 14px;
          margin-top: 14px;
          padding: 18px;
          border-radius: 18px;
          border: 1px solid #dbeafe;
          background: linear-gradient(180deg, #f8fbff, #ffffff);
        }

        .attendance-pro-page .manager-panel-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }

        .attendance-pro-page .manager-panel h4 {
          margin: 0;
          font-size: 1rem;
          font-weight: 900;
          color: #0f172a;
        }

        .attendance-pro-page .manager-panel p {
          margin: 4px 0 0 0;
          color: #64748b;
          font-size: 0.9rem;
        }

        .attendance-pro-page .available-list {
          display: grid;
          gap: 10px;
          max-height: 340px;
          overflow: auto;
        }

        .attendance-pro-page .available-item {
          border: 1px solid #e5e7eb;
          border-radius: 16px;
          padding: 14px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          background: #fff;
          flex-wrap: wrap;
        }

        .attendance-pro-page .available-item strong {
          display: block;
          color: #0f172a;
          font-size: 0.95rem;
        }

        .attendance-pro-page .available-meta {
          color: #64748b;
          font-size: 0.85rem;
          line-height: 1.6;
        }

        .attendance-pro-page .row-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          justify-content: center;
        }

        @media (max-width: 1200px) {
          .attendance-pro-page .hero-shell,
          .attendance-pro-page .control-grid {
            grid-template-columns: 1fr;
          }

          .attendance-pro-page .hero-kpis,
          .attendance-pro-page .summary-strip {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 768px) {
          .attendance-pro-page .hero-main h2 {
            font-size: 2rem;
          }

          .attendance-pro-page .hero-kpis,
          .attendance-pro-page .summary-strip,
          .attendance-pro-page .form-grid-pro {
            grid-template-columns: 1fr;
          }

          .attendance-pro-page .field-pro.span-2 {
            grid-column: span 1;
          }

          .attendance-pro-page .employee-col {
            min-width: 240px;
            max-width: 240px;
            width: 240px;
          }

          .attendance-pro-page .attendance-table {
            min-width: 1500px;
          }

          .attendance-pro-page .actions-col {
            min-width: 220px;
            width: 220px;
          }
        }
      `}</style>

      <section className="hero-shell">
        <div className="hero-main">
          <div className="hero-badge">
            <ShieldCheck size={14} />
            Attendance Control Center
          </div>

          <h2>Monthly Attendance Management</h2>
          <p>
            Upload fingerprint attendance, review daily records, apply manual overrides,
            and approve the final monthly attendance sheet before it becomes visible to employees.
          </p>

          <div className="hero-kpis">
            <div className="hero-kpi">
              <span className="label">Employees</span>
              <strong className="value">{totalEmployees}</strong>
            </div>
            <div className="hero-kpi">
              <span className="label">Total Hours</span>
              <strong className="value">{Math.round(totalHours)}</strong>
            </div>
            <div className="hero-kpi">
              <span className="label">Absent</span>
              <strong className="value">{absentCount}</strong>
            </div>
            <div className="hero-kpi">
              <span className="label">Single Punch</span>
              <strong className="value">{singlePunchCount}</strong>
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
              <span>Detected Month</span>
              <strong>{monthName}</strong>
            </div>
            <div className="side-stat">
              <span>Batch ID</span>
              <strong>{batchId || "-"}</strong>
            </div>
            <div className="side-stat">
              <span>Status</span>
              <strong>{batchStatus}</strong>
            </div>
            <div className="side-stat">
              <span>Uploaded File</span>
              <strong>{fileName || "-"}</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="control-grid">
        <div className="control-card">
          <div className="card-head">
            <div>
              <h3>Month Controls</h3>
              <p>Select the month, load an existing sheet, or filter employee records.</p>
            </div>
            <span className={`status-pill ${batchStatus === "approved" ? "approved" : ""}`}>
              {batchStatus === "approved" ? "Approved Batch" : "Draft Batch"}
            </span>
          </div>

          <div className="form-grid-pro">
            <div className="field-pro">
              <label>Month</label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {i + 1}
                  </option>
                ))}
              </select>
            </div>

            <div className="field-pro">
              <label>Year</label>
              <input
                type="number"
                value={selectedYear}
                onChange={(e) =>
                  setSelectedYear(Number(e.target.value) || now.getFullYear())
                }
              />
            </div>

            <div className="field-pro span-2">
              <label>Filter Employee</label>
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
                  value={employeeFilter}
                  onChange={(e) => setEmployeeFilter(e.target.value)}
                  placeholder="Search employee name or user ID"
                />
              </div>
            </div>
          </div>

          <div className="action-row" style={{ marginTop: 16 }}>
            <button
              type="button"
              className="btn-soft"
              onClick={loadSelectedMonthSheet}
              disabled={sheetLoading}
            >
              <RefreshCcw size={14} />
              {sheetLoading ? "Loading..." : "Load Existing Sheet"}
            </button>

            <ExportButtons
              rows={exportRows}
              fileName="attendance-sheet.xlsx"
              sheetName="Attendance"
              disabled={!filteredRows.length}
            />
          </div>
        </div>

        <div className="control-card">
          <div className="card-head">
            <div>
              <h3>Biometric Import & Approval</h3>
              <p>Upload the device export, then approve the monthly attendance sheet.</p>
            </div>
          </div>

          <div className="upload-panel">
            <div className="upload-main">
              <label className="upload-btn-pro">
                <Upload size={14} />
                {loading ? "Uploading..." : "Upload CSV"}
                <input type="file" accept=".csv" hidden onChange={onFileUpload} />
              </label>

              <button
                type="button"
                className="btn-primary-strong"
                onClick={handleApprove}
                disabled={!batchId || batchStatus === "approved" || approving}
              >
                <CheckCircle2 size={14} />
                {batchStatus === "approved"
                  ? "Approved"
                  : approving
                  ? "Approving..."
                  : "Approve Attendance Sheet"}
              </button>
            </div>

            <div className="upload-meta">
              {fileName || "No file uploaded yet"}
            </div>
          </div>

          {message ? (
            <div
              className={`alert-pro ${messageType === "error" ? "error" : "success"}`}
              style={{ marginTop: 16 }}
            >
              {message}
            </div>
          ) : null}
        </div>
      </section>

      {batchId ? (
        <section className="control-card">
          <div className="card-head">
            <div>
              <h3>Sheet Employee Tools</h3>
              <p>
                Add or exclude employees from this sheet without touching attendance records.
                This is allowed even after approval.
              </p>
            </div>

            <button
              type="button"
              className="btn-primary-strong"
              onClick={handleToggleAddEmployeePanel}
              disabled={!batchId}
            >
              <Plus size={14} />
              {showAddEmployeePanel ? "Hide Add Employee" : "Add Employee to Sheet"}
            </button>
          </div>

          {showAddEmployeePanel ? (
            <div className="manager-panel">
              <div className="manager-panel-head">
                <div>
                  <h4>Available Active Users</h4>
                  <p>Only active users not already inside this sheet will be shown.</p>
                </div>
              </div>

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
                  style={{
                    minHeight: 50,
                    borderRadius: 16,
                    border: "1px solid #dbe2ea",
                    padding: "0 14px 0 40px",
                    width: "100%",
                  }}
                  value={availableUsersSearch}
                  onChange={(e) => setAvailableUsersSearch(e.target.value)}
                  placeholder="Search active users by name, GAS ID, project..."
                />
              </div>

              <div className="inline-actions">
                <button
                  type="button"
                  className="btn-soft"
                  onClick={() => loadAvailableUsers(availableUsersSearch)}
                  disabled={availableUsersLoading}
                >
                  <RefreshCcw size={14} />
                  {availableUsersLoading ? "Loading..." : "Search Users"}
                </button>
              </div>

              {availableUsersLoading ? (
                <div className="empty-pro">Loading available users...</div>
              ) : availableUsers.length === 0 ? (
                <div className="empty-pro">No available users found for this sheet.</div>
              ) : (
                <div className="available-list">
                  {availableUsers.map((item) => (
                    <div
                      key={item.user_id || `${item.gas_id}-${item.name}`}
                      className="available-item"
                    >
                      <div>
                        <strong>{item.name || "-"}</strong>
                        <div className="available-meta">
                          GAS ID: {item.gas_id || "-"} <br />
                          Job Title: {item.job_title || "-"} <br />
                          Project: {item.project_name || "-"} | Package: {item.package_name || "-"}
                        </div>
                      </div>

                      <button
                        type="button"
                        className="btn-primary-strong"
                        onClick={() => handleAddUser(item.user_id)}
                        disabled={actionLoadingKey === `add-${item.user_id}`}
                      >
                        <Plus size={14} />
                        {actionLoadingKey === `add-${item.user_id}` ? "Adding..." : "Add to Sheet"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="table-card">
        <div className="table-tools">
          <div>
            <h3>{monthName}</h3>
            <p>Review rows, adjust individual attendance cells, and approve once final.</p>
          </div>
        </div>

        <div className="summary-strip">
          <div className="summary-box">
            <span>Annual Leave</span>
            <strong>{annualLeaveCount}</strong>
          </div>
          <div className="summary-box">
            <span>Sick Leave</span>
            <strong>{sickLeaveCount}</strong>
          </div>
          <div className="summary-box">
            <span>Emergency Leave</span>
            <strong>{emergencyLeaveCount}</strong>
          </div>
          <div className="summary-box">
            <span>Permission</span>
            <strong>{permissionCount}</strong>
          </div>
          <div className="summary-box">
            <span>Takleef</span>
            <strong>{takleefCount}</strong>
          </div>
        </div>

        {filteredRows.length === 0 ? (
          <div className="empty-pro">
            Upload the attendance CSV file or load an existing month sheet.
          </div>
        ) : (
          <div className="attendance-table-shell">
            <table className="attendance-table">
              <thead>
                <tr>
                  <th className="sticky-col">Employee</th>
                  <th>User ID</th>

                  {safeDays.map((day) => (
                    <th key={day.key} className={day.weekend ? "weekend-head" : ""}>
                      {day.label}
                    </th>
                  ))}

                  <th>Total Hours</th>
                  <th>Absent</th>
                  <th>Single Punch</th>
                  <th>Annual Leave</th>
                  <th>Sick Leave</th>
                  <th>Emergency Leave</th>
                  <th>Permission</th>
                  <th>Takleef</th>
                  <th className="actions-col">Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredRows.map((row, rowIndex) => (
                  <tr key={`${row?.name || "emp"}-${row?.userId || rowIndex}`}>
                    <td className="sticky-col employee-col" title={row?.name || "-"}>
                      <div>{row?.name || "-"}</div>
                      {row?.isManualOnly ? (
                        <div className="manual-badge">Manual Sheet Employee</div>
                      ) : null}
                    </td>
                    <td>{row?.userId || "-"}</td>

                    {safeArray(row?.cells).map((cell, index) => {
                      const day = safeDays[index];
                      const manualKey = cell?.rowId || `${row?.userId || row?.name}-${day?.key}`;

                      return (
                        <td
                          key={`${row?.name || "emp"}-${cell?.rowId || index}`}
                          className={`attendance-cell ${cell?.type || ""}`}
                        >
                          <div className="cell-box">
                            <div className="cell-value">{cell?.value ?? "-"}</div>

                            <>
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
                                disabled={
                                  batchStatus === "approved" ||
                                  savingRowId === String(manualKey)
                                }
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
                                      handleManualCellChange(
                                        row,
                                        day,
                                        "present",
                                        manualHoursByRow[manualKey] || 8
                                      );
                                    }
                                  }}
                                  disabled={
                                    batchStatus === "approved" ||
                                    savingRowId === String(manualKey)
                                  }
                                  placeholder="Hours"
                                />
                              ) : null}
                            </>
                          </div>
                        </td>
                      );
                    })}

                    <td>{Number(Number(row?.totalHours || 0).toFixed(2))}</td>
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
                          className="btn-mini-danger"
                          onClick={() => handleExcludeEmployee(row)}
                          disabled={actionLoadingKey === `${row?.userId || row?.name}-exclude`}
                        >
                          <UserMinus size={13} />
                          {actionLoadingKey === `${row?.userId || row?.name}-exclude`
                            ? "Excluding..."
                            : "Exclude"}
                        </button>

                        <button
                          type="button"
                          className="btn-mini-muted"
                          onClick={() => handleMarkStatus(row, "inactive")}
                          disabled={actionLoadingKey === `${row?.userId || row?.name}-inactive`}
                        >
                          <UserCog size={13} />
                          {actionLoadingKey === `${row?.userId || row?.name}-inactive`
                            ? "Updating..."
                            : "Inactive"}
                        </button>

                        <button
                          type="button"
                          className="btn-mini-primary"
                          onClick={() => handleMarkStatus(row, "resigned")}
                          disabled={actionLoadingKey === `${row?.userId || row?.name}-resigned`}
                        >
                          <UserX size={13} />
                          {actionLoadingKey === `${row?.userId || row?.name}-resigned`
                            ? "Updating..."
                            : "Resigned"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
