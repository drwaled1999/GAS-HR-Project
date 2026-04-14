import {
  uploadAttendanceFile,
  getAttendanceSheet,
  updateAttendanceImportRow,
  approveAttendanceBatch,
} from "../services/api";
const [batchId, setBatchId] = useState("");
const [batchStatus, setBatchStatus] = useState("draft");

import { uploadAttendance } from "../services/api";
import React, { useState } from "react";
import * as XLSX from "xlsx";
import {
  Users,
  Clock3,
  AlertTriangle,
  Fingerprint,
  FileSpreadsheet,
  FileText,
  Upload,
} from "lucide-react";
const onFileUpload = async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;

  setFileName(file.name);
  setLoading(true);

  const now = new Date();
  const formData = new FormData();
  formData.append("file", file);
  formData.append("month", String(now.getMonth() + 1));
  formData.append("year", String(now.getFullYear()));

  try {
    const result = await uploadAttendance(formData);
    setAttendanceState(result.data);
    setMonthName(result.data?.monthTitle || "Attendance");
  } catch (error) {
    console.error(error);
    alert(error.message);
  } finally {
    setLoading(false);
  }
};


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
        className="btn secondary"
        onClick={() => exportSheet(rows, fileName, sheetName)}
      >
        <FileSpreadsheet size={14} /> Excel
      </button>

      <button className="btn secondary" onClick={() => window.print()}>
        <FileText size={14} /> PDF
      </button>
    </div>
  );
}

export default function AttendancePage() {
  const [attendanceState, setAttendanceState] = useState({
    days: [],
    rows: [],
    monthTitle: "Attendance",
  });

  const [fileName, setFileName] = useState("");
  const [monthName, setMonthName] = useState("Attendance");
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [loading, setLoading] = useState(false);

  const filteredRows = attendanceState.rows.filter((row) =>
    row.name.toLowerCase().includes(employeeFilter.toLowerCase())
  );

  const totalEmployees = filteredRows.length;
  const totalHours = filteredRows.reduce((sum, row) => sum + row.totalHours, 0);
  const absentCount = filteredRows.reduce((sum, row) => sum + row.absentCount, 0);
  const singlePunchCount = filteredRows.reduce(
    (sum, row) => sum + row.singlePunchCount,
    0
  );

  const onFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setLoading(true);

    const now = new Date();
    const formData = new FormData();
    formData.append("file", file);
    formData.append("month", String(now.getMonth() + 1));
    formData.append("year", String(now.getFullYear()));

    try {
      const response = await fetch("/api/attendance/upload", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Upload failed");
      }

      setAttendanceState(result.data);
      setMonthName(result.data?.monthTitle || "Attendance");
    } catch (error) {
      console.error(error);
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  const exportRows = [
    [
      "Employee",
      "User ID",
      ...attendanceState.days.map((day) => day.label),
      "Total Hours",
      "Absent",
      "Single Punch",
    ],
    ...filteredRows.map((row) => [
      row.name,
      row.userId || "-",
      ...row.cells.map((cell) => cell.value),
      Number(row.totalHours.toFixed(2)),
      row.absentCount,
      row.singlePunchCount,
    ]),
  ];

  return (
    <div className="page-stack">
      <div className="glass-card section-hero">
        <div>
          <div className="eyebrow dark">Attendance control</div>
          <h2>Attendance</h2>
          <p>
            Upload biometric CSV and generate a monthly attendance sheet with totals,
            absence and single punch highlighting.
          </p>
        </div>

        <div className="hero-mini-grid">
          <div className="mini-stat">
            <div className="mini-stat-icon"><Users size={14} /></div>
            <div>
              <div className="mini-stat-label">Employees</div>
              <div className="mini-stat-value">{totalEmployees}</div>
            </div>
          </div>

          <div className="mini-stat">
            <div className="mini-stat-icon"><Clock3 size={14} /></div>
            <div>
              <div className="mini-stat-label">Total Hours</div>
              <div className="mini-stat-value">{Math.round(totalHours)}</div>
            </div>
          </div>

          <div className="mini-stat">
            <div className="mini-stat-icon"><AlertTriangle size={14} /></div>
            <div>
              <div className="mini-stat-label">Absent</div>
              <div className="mini-stat-value">{absentCount}</div>
            </div>
          </div>

          <div className="mini-stat">
            <div className="mini-stat-icon"><Fingerprint size={14} /></div>
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
          <div>
            <ExportButtons
              rows={exportRows}
              fileName="attendance-sheet.xlsx"
              sheetName="Attendance"
            />
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
        </div>

        <div className="upload-box">
          <label className="upload-btn">
            <Upload size={14} /> {loading ? "Uploading..." : "Upload CSV"}
            <input type="file" accept=".csv" hidden onChange={onFileUpload} />
          </label>

          <div className="upload-note">
            {fileName || "No file uploaded yet"}
          </div>
        </div>
      </div>

      <div className="glass-card">
        <div className="section-title">
          <div>
            <h3>{monthName}</h3>
            <p>Generated monthly attendance sheet ready for HR review and Excel download.</p>
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
                </tr>
              </thead>

              <tbody>
                {filteredRows.map((row) => (
                  <tr key={`${row.name}-${row.userId}`}>
                    <td className="sticky-col employee-col">{row.name}</td>
                    <td>{row.userId || "-"}</td>
                    {row.cells.map((cell, i) => (
                      <td key={i} className={`attendance-cell ${cell.type}`}>
                        {cell.value}
                      </td>
                    ))}
                    <td>{Number(row.totalHours.toFixed(2))}</td>
                    <td>{row.absentCount}</td>
                    <td>{row.singlePunchCount}</td>
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
