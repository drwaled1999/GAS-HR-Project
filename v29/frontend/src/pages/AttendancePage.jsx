import React, { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import {
  Users,
  Clock3,
  AlertTriangle,
  Fingerprint,
  FileSpreadsheet,
  FileText,
  Upload,
  CheckCircle2,
} from "lucide-react";
import {
  uploadAttendanceFile,
  getAttendanceSheet,
  updateAttendanceImportRow,
  approveAttendanceBatch,
} from "../services/api";

function exportSheet(rows, fileName, sheetName) {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, fileName);
}

function ExportButtons({ rows, fileName, sheetName }) {
  return (
    <div className="inline-actions">
      <button
        type="button"
        className="btn secondary"
        onClick={() => exportSheet(rows, fileName, sheetName)}
      >
        <FileSpreadsheet size={14} />
        Excel
      </button>

      <button
        type="button"
        className="btn secondary"
        onClick={() => window.print()}
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
  { value: "permission", label: "Permission" },
  { value: "absent", label: "Absent" },
  { value: "weekend", label: "Weekend" },
];

export default function AttendancePage() {
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
  const [loading, setLoading] = useState(false);
  const [savingRowId, setSavingRowId] = useState("");
  const [approving, setApproving] = useState(false);
  const [message, setMessage] = useState("");

  const filteredRows = useMemo(() => {
    return attendanceState.rows.filter((row) =>
      row.name.toLowerCase().includes(employeeFilter.toLowerCase())
    );
  }, [attendanceState.rows, employeeFilter]);

  const totalEmployees = filteredRows.length;
  const totalHours = filteredRows.reduce((sum, row) => sum + Number(row.totalHours || 0), 0);
  const absentCount = filteredRows.reduce((sum, row) => sum + Number(row.absentCount || 0), 0);
  const singlePunchCount = filteredRows.reduce(
    (sum, row) => sum + Number(row.singlePunchCount || 0),
    0
  );
  const annualLeaveCount = filteredRows.reduce(
    (sum, row) => sum + Number(row.annualLeaveCount || 0),
    0
  );
  const sickLeaveCount = filteredRows.reduce(
    (sum, row) => sum + Number(row.sickLeaveCount || 0),
    0
  );
  const permissionCount = filteredRows.reduce(
    (sum, row) => sum + Number(row.permissionCount || 0),
    0
  );
  const takleefCount = filteredRows.reduce(
    (sum, row) => sum + Number(row.takleefCount || 0),
    0
  );

  const exportRows = [
    [
      "Employee",
      "User ID",
      ...attendanceState.days.map((day) => day.label),
      "Total Hours",
      "Absent",
      "Single Punch",
      "Annual Leave",
      "Sick Leave",
      "Permission",
      "Takleef",
    ],
    ...filteredRows.map((row) => [
      row.name,
      row.userId || "-",
      ...row.cells.map((cell) => cell.value),
      Number(Number(row.totalHours || 0).toFixed(2)),
      row.absentCount || 0,
      row.singlePunchCount || 0,
      row.annualLeaveCount || 0,
      row.sickLeaveCount || 0,
      row.permissionCount || 0,
      row.takleefCount || 0,
    ]),
  ];

  async function refreshSheet(currentBatchId) {
    const result = await getAttendanceSheet({ batchId: currentBatchId });
    setAttendanceState(result.data || { days: [], rows: [], monthTitle: "Attendance" });
    setMonthName(result.data?.monthTitle || "Attendance");
    setBatchStatus(result.batch?.status || "draft");
  }

  async function onFileUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setMessage("");
    setFileName(file.name);
    setLoading(true);

    try {
      const now = new Date();

      const result = await uploadAttendanceFile(
        file,
        now.getMonth() + 1,
        now.getFullYear(),
        "HR Manager"
      );

      setBatchId(result.batchId || "");
      setBatchStatus(result.status || "draft");
      setAttendanceState(result.data || { days: [], rows: [], monthTitle: "Attendance" });
      setMonthName(result.data?.monthTitle || "Attendance");
      setMessage("Attendance file uploaded successfully.");
    } catch (error) {
      console.error(error);
      setMessage(error.message || "Failed to upload attendance file.");
    } finally {
      setLoading(false);
      event.target.value = "";
    }
  }

  async function handleOverrideChange(rowId, overrideType) {
    if (!rowId || !batchId || batchStatus === "approved") return;

    setMessage("");
    setSavingRowId(String(rowId));

    try {
      await updateAttendanceImportRow(rowId, {
        overrideType,
        overrideNote: "",
        username: "HR Manager",
      });

      await refreshSheet(batchId);
      setMessage("Attendance row updated successfully.");
    } catch (error) {
      console.error(error);
      setMessage(error.message || "Failed to update attendance row.");
    } finally {
      setSavingRowId("");
    }
  }

  async function handleApprove() {
    if (!batchId || batchStatus === "approved") return;

    setMessage("");
    setApproving(true);

    try {
      await approveAttendanceBatch(batchId, {
        username: "HR Manager",
      });

      await refreshSheet(batchId);
      setMessage("Attendance sheet approved and now visible to employees.");
    } catch (error) {
      console.error(error);
      setMessage(error.message || "Failed to approve attendance sheet.");
    } finally {
      setApproving(false);
    }
  }

  return (
    <div className="page-stack">
      <div className="glass-card section-hero">
        <div>
          <div className="eyebrow dark">Attendance control</div>
          <h2>Attendance</h2>
          <p>
            Upload biometric CSV, review rows, apply manual overrides, and approve
            the final attendance sheet for employees.
          </p>
        </div>

        <div className="hero-mini-grid">
          <div className="mini-stat">
            <div className="mini-stat-icon">
              <Users size={14} />
            </div>
            <div>
              <div className="mini-stat-label">Employees</div>
              <div className="mini-stat-value">{totalEmployees}</div>
            </div>
          </div>

          <div className="mini-stat">
            <div className="mini-stat-icon">
              <Clock3 size={14} />
            </div>
            <div>
              <div className="mini-stat-label">Total Hours</div>
              <div className="mini-stat-value">{Math.round(totalHours)}</div>
            </div>
          </div>

          <div className="mini-stat">
            <div className="mini-stat-icon">
              <AlertTriangle size={14} />
            </div>
            <div>
              <div className="mini-stat-label">Absent</div>
              <div className="mini-stat-value">{absentCount}</div>
            </div>
          </div>

          <div className="mini-stat">
            <div className="mini-stat-icon">
              <Fingerprint size={14} />
            </div>
            <div>
              <div className="mini-stat-label">Single Punch</div>
              <div className="mini-stat-value">{singlePunchCount}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="glass-card">
        <div className="section-title">
          <div>
            <h3>Biometric Import</h3>
            <p>Upload the raw CSV exported from your attendance device.</p>
          </div>

          <div className="inline-actions">
            <ExportButtons
              rows={exportRows}
              fileName="attendance-sheet.xlsx"
              sheetName="Attendance"
            />

            <button
              type="button"
              className="btn primary"
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
        </div>

        <div className="form-grid" style={{ marginBottom: 14 }}>
          <div className="field">
            <label>Filter Employee</label>
            <input
              value={employeeFilter}
              onChange={(e) => setEmployeeFilter(e.target.value)}
              placeholder="Search employee name"
            />
          </div>

          <div className="field">
            <label>Detected Month</label>
            <input value={monthName} readOnly />
          </div>

          <div className="field">
            <label>Batch ID</label>
            <input value={batchId} readOnly />
          </div>

          <div className="field">
            <label>Status</label>
            <input value={batchStatus} readOnly />
          </div>
        </div>

        <div className="upload-box">
          <label className="upload-btn">
            <Upload size={14} />
            {loading ? "Uploading..." : "Upload CSV"}
            <input type="file" accept=".csv" hidden onChange={onFileUpload} />
          </label>

          <div className="upload-note">
            {fileName || "No file uploaded yet"}
          </div>
        </div>

        {message ? (
          <div
            className="empty-box"
            style={{ marginTop: 14, color: message.toLowerCase().includes("failed") ? "#991b1b" : "#166534" }}
          >
            {message}
          </div>
        ) : null}
      </div>

      <div className="glass-card">
        <div className="section-title">
          <div>
            <h3>{monthName}</h3>
            <p>Review, override, and approve attendance before publishing to employees.</p>
          </div>
        </div>

        <div className="hero-mini-grid" style={{ marginBottom: 16 }}>
          <div className="mini-stat">
            <div>
              <div className="mini-stat-label">Annual Leave</div>
              <div className="mini-stat-value">{annualLeaveCount}</div>
            </div>
          </div>

          <div className="mini-stat">
            <div>
              <div className="mini-stat-label">Sick Leave</div>
              <div className="mini-stat-value">{sickLeaveCount}</div>
            </div>
          </div>

          <div className="mini-stat">
            <div>
              <div className="mini-stat-label">Permission</div>
              <div className="mini-stat-value">{permissionCount}</div>
            </div>
          </div>

          <div className="mini-stat">
            <div>
              <div className="mini-stat-label">Takleef</div>
              <div className="mini-stat-value">{takleefCount}</div>
            </div>
          </div>
        </div>

        {filteredRows.length === 0 ? (
          <div className="empty-box">
            Upload the attendance CSV file to generate the monthly grid.
          </div>
        ) : (
          <div className="attendance-table-wrap">
            <table className="attendance-table">
              <thead>
                <tr>
                  <th className="sticky-col">Employee</th>
                  <th>User ID</th>

                  {attendanceState.days.map((day) => (
                    <th key={day.key} className={day.weekend ? "weekend-head" : ""}>
                      {day.label}
                    </th>
                  ))}

                  <th>Total Hours</th>
                  <th>Absent</th>
                  <th>Single Punch</th>
                  <th>Annual Leave</th>
                  <th>Sick Leave</th>
                  <th>Permission</th>
                  <th>Takleef</th>
                </tr>
              </thead>

              <tbody>
                {filteredRows.map((row) => (
                  <tr key={`${row.name}-${row.userId}`}>
                    <td className="sticky-col employee-col">{row.name}</td>
                    <td>{row.userId || "-"}</td>

                    {row.cells.map((cell, index) => (
                      <td key={`${row.name}-${cell.rowId || index}`} className={`attendance-cell ${cell.type || ""}`}>
                        <div style={{ display: "grid", gap: 6 }}>
                          <div>{cell.value}</div>

                          {cell.rowId ? (
                            <select
                              value={cell.overrideType || ""}
                              onChange={(e) =>
                                handleOverrideChange(cell.rowId, e.target.value)
                              }
                              disabled={
                                batchStatus === "approved" ||
                                savingRowId === String(cell.rowId)
                              }
                            >
                              {OVERRIDE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          ) : null}
                        </div>
                      </td>
                    ))}

                    <td>{Number(Number(row.totalHours || 0).toFixed(2))}</td>
                    <td>{row.absentCount || 0}</td>
                    <td>{row.singlePunchCount || 0}</td>
                    <td>{row.annualLeaveCount || 0}</td>
                    <td>{row.sickLeaveCount || 0}</td>
                    <td>{row.permissionCount || 0}</td>
                    <td>{row.takleefCount || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
