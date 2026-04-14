import { useState } from "react";
import {
  approveAttendanceBatch,
  getAttendanceSheet,
  uploadAttendanceFile,
} from "../services/api";

export default function AttendancePage() {
  const [file, setFile] = useState(null);
  const [month, setMonth] = useState("3");
  const [year, setYear] = useState("2026");
  const [sheet, setSheet] = useState(null);
  const [batchId, setBatchId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [loadingSheet, setLoadingSheet] = useState(false);
  const [approving, setApproving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const username = localStorage.getItem("username") || "system";
  const role = (localStorage.getItem("role") || "").toLowerCase();

  async function handleUpload() {
    if (!file) {
      setError("اختر ملف البصمة أولاً");
      return;
    }

    try {
      setUploading(true);
      setError("");
      setMessage("");

      const result = await uploadAttendanceFile(file, month, year, username);
      setBatchId(result.batchId || null);

      setMessage(
        `تم رفع الملف كـ Pending. الصفوف المحفوظة: ${result?.summary?.savedRows || 0}`
      );

      if (result.batchId) {
        await loadSheet(result.batchId);
      }
    } catch (err) {
      setError(err.message || "فشل رفع الملف");
    } finally {
      setUploading(false);
    }
  }

  async function loadSheet(overrideBatchId = batchId) {
    try {
      setLoadingSheet(true);
      setError("");

      const data = await getAttendanceSheet({
        month,
        year,
        batchId: overrideBatchId || "",
      });

      setSheet(data);
    } catch (err) {
      setError(err.message || "فشل تحميل الشيت");
      setSheet(null);
    } finally {
      setLoadingSheet(false);
    }
  }

  async function handleApprove() {
    if (!batchId) {
      setError("لا يوجد Batch للاعتماد");
      return;
    }

    try {
      setApproving(true);
      setError("");
      setMessage("");

      const result = await approveAttendanceBatch(batchId, {
        username,
        role,
      });

      setMessage(result?.message || "تم اعتماد الحضور بنجاح");
      await loadSheet(batchId);
    } catch (err) {
      setError(err.message || "فشل اعتماد الحضور");
    } finally {
      setApproving(false);
    }
  }

  const canApprove =
    role === "system owner" ||
    role === "owner" ||
    role === "hr manager" ||
    role === "hr_manager";

  return (
    <div className="page">
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0 }}>Attendance Sheet</h1>
          <p style={{ marginTop: 8, color: "#667085" }}>
            رفع ملف البصمة، عرض الشيت الشهري بنفس شكل الإكسل، ثم الاعتماد من HR Manager أو System Owner
          </p>
        </div>
      </div>

      {message ? <div style={successBox}>{message}</div> : null}
      {error ? <div style={errorBox}>{error}</div> : null}

      <section style={cardStyle}>
        <div style={toolbarStyle}>
          <input
            type="file"
            accept=".csv"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            style={inputStyle}
          />

          <input
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            placeholder="Month"
            style={{ ...inputStyle, width: 120 }}
          />

          <input
            value={year}
            onChange={(e) => setYear(e.target.value)}
            placeholder="Year"
            style={{ ...inputStyle, width: 120 }}
          />

          <button type="button" onClick={handleUpload} disabled={uploading} style={primaryBtn}>
            {uploading ? "Uploading..." : "Upload"}
          </button>

          <button type="button" onClick={() => loadSheet()} disabled={loadingSheet} style={secondaryBtn}>
            {loadingSheet ? "Loading..." : "Load Sheet"}
          </button>

          {canApprove ? (
            <button type="button" onClick={handleApprove} disabled={approving || !batchId} style={approveBtn}>
              {approving ? "Approving..." : "Approve"}
            </button>
          ) : null}
        </div>
      </section>

      <section style={cardStyle}>
        {!sheet ? (
          <div style={{ color: "#667085" }}>لا توجد بيانات لعرضها</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={excelTable}>
              <thead>
                <tr>
                  <th style={headerCell}>S/NO</th>
                  <th style={headerCell}>NAME</th>
                  <th style={headerCell}>TRADE / CATEGORY</th>
                  <th style={headerCell}>ID</th>
                  <th style={headerCellRed}>GAS ID</th>
                  <th style={headerCell}>NATIONALITY</th>
                  {Array.from({ length: sheet.daysInMonth }).map((_, idx) => {
                    const day = idx + 1;
                    return (
                      <th key={day} style={dayHeaderCell}>
                        {`${day}-Mar`}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {sheet.employees.length === 0 ? (
                  <tr>
                    <td colSpan={6 + sheet.daysInMonth} style={emptyTd}>
                      لا توجد بيانات
                    </td>
                  </tr>
                ) : (
                  sheet.employees.map((employee) => (
                    <tr key={`${employee.id}-${employee.gasId}`}>
                      <td style={bodyCell}>{employee.sno}</td>
                      <td style={bodyCell}>{employee.name}</td>
                      <td style={bodyCell}>{employee.tradeCategory || ""}</td>
                      <td style={bodyCell}>{employee.id || ""}</td>
                      <td style={bodyCell}>{employee.gasId || ""}</td>
                      <td style={bodyCell}>{employee.nationality || ""}</td>

                      {Array.from({ length: sheet.daysInMonth }).map((_, idx) => {
                        const day = idx + 1;
                        const dayData = employee.days[day];

                        let cellStyle = { ...attendanceCell };
                        if (dayData.color === "orange") {
                          cellStyle = { ...attendanceCell, background: "#fef3c7", color: "#b45309", fontWeight: 700 };
                        } else if (dayData.color === "green") {
                          cellStyle = { ...attendanceCell, background: "#ecfdf3", color: "#067647", fontWeight: 700 };
                        } else {
                          cellStyle = { ...attendanceCell, background: "#fef2f2", color: "#b42318", fontWeight: 700 };
                        }

                        return (
                          <td key