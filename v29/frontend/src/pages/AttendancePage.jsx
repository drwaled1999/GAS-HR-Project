import { useMemo, useState } from "react";
import ExcelJS from "exceljs";
import {
  approveAttendanceBatch,
  getAttendanceSheet,
  updateAttendanceImportRow,
  uploadAttendanceFile,
} from "../services/api";

const STATUS_OPTIONS = [
  { value: "P", label: "Present" },
  { value: "A", label: "Absent" },
  { value: "SP", label: "Single Punch" },
  { value: "SKL", label: "تكليف" },
  { value: "VAC-EM", label: "اجازة طوارئ" },
  { value: "SL", label: "مرضي" },
  { value: "VAC", label: "إجازة" },
  { value: "H", label: "عيد / عطلة" },
];

export default function AttendancePage() {
  const [file, setFile] = useState(null);
  const [month, setMonth] = useState("3");
  const [year, setYear] = useState("2026");
  const [batchId, setBatchId] = useState(null);
  const [sheet, setSheet] = useState(null);
  const [search, setSearch] = useState("");

  const [uploading, setUploading] = useState(false);
  const [loadingSheet, setLoadingSheet] = useState(false);
  const [approving, setApproving] = useState(false);
  const [savingCell, setSavingCell] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const username =
    localStorage.getItem("username") ||
    localStorage.getItem("userName") ||
    "system";

  const role =
    (localStorage.getItem("role") || localStorage.getItem("userRole") || "")
      .toLowerCase();

  const canApprove = ["owner", "system owner", "hr_manager", "hr manager"].includes(role);
  const canEditBeforeApprove = canApprove;

  const filteredEmployees = useMemo(() => {
    const employees = sheet?.employees || [];
    const term = search.trim().toLowerCase();

    if (!term) return employees;

    return employees.filter((employee) => {
      return (
        String(employee.name || "").toLowerCase().includes(term) ||
        String(employee.gasId || "").toLowerCase().includes(term)
      );
    });
  }, [sheet, search]);

  async function handleUpload() {
    if (!file) {
      setError("اختر ملف CSV أولاً");
      return;
    }

    try {
      setUploading(true);
      setError("");
      setMessage("");

      const result = await uploadAttendanceFile(file, month, year, username);
      setBatchId(result.batchId || null);
      setMessage(result.message || "تم رفع الملف");

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

  async function handleStatusChange(dayData, nextStatus) {
    if (!dayData?.importRowId) return;

    try {
      setSavingCell(String(dayData.importRowId));
      setError("");

      await updateAttendanceImportRow(dayData.importRowId, {
        statusOverride: nextStatus,
        notes: dayData.notes || "",
      });

      await loadSheet();
    } catch (err) {
      setError(err.message || "فشل تعديل الحالة");
    } finally {
      setSavingCell("");
    }
  }

  async function handleApprove() {
    if (!batchId) {
      setError("لا يوجد batch للاعتماد");
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

      setMessage(result.message || "تم اعتماد الحضور");
      await loadSheet(batchId);
    } catch (err) {
      setError(err.message || "فشل الاعتماد");
    } finally {
      setApproving(false);
    }
  }

  async function handleExportExcel() {
    if (!sheet?.employees?.length) {
      setError("لا توجد بيانات للتصدير");
      return;
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Attendance");

    const daysInMonth = Number(sheet.daysInMonth || 30);
    const monthLabel = getMonthShortName(sheet.month);

    const headers = [
      "S/NO",
      "NAME",
      "TRADE / CATEGORY",
      "ID",
      "GAS ID",
      "NATIONALITY",
      ...Array.from({ length: daysInMonth }).map((_, i) => `${i + 1}-${monthLabel}`),
    ];

    worksheet.addRow(headers);

    worksheet.columns = [
      { width: 8 },
      { width: 28 },
      { width: 22 },
      { width: 14 },
      { width: 14 },
      { width: 14 },
      ...Array.from({ length: daysInMonth }).map(() => ({ width: 12 })),
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.eachCell((cell, col) => {
      cell.border = thinBorder;
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.font = { bold: true };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: col >= 7 ? "DBEAFE" : "E2E8F0" },
      };
    });

    (sheet.employees || []).forEach((employee, index) => {
      const rowValues = [
        index + 1,
        employee.name || "",
        employee.tradeCategory || "",
        employee.employeeId || "",
        employee.gasId || "",
        employee.nationality || "",
        ...Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const dayData = employee.days?.[day];
          return getDisplayValue(dayData);
        }),
      ];

      const row = worksheet.addRow(rowValues);
      row.eachCell((cell, col) => {
        cell.border = thinBorder;
        cell.alignment = { horizontal: "center", vertical: "middle" };

        if (col >= 7) {
          const day = col - 6;
          const dayData = employee.days?.[day];
          const display = getDisplayValue(dayData);

          if (display === "A") {
            cell.fill = fillColor("FEF2F2");
            cell.font = { bold: true, color: { argb: "B42318" } };
          } else if (display === "SP") {
            cell.fill = fillColor("FEF3C7");
            cell.font = { bold: true, color: { argb: "B45309" } };
          } else if (["SKL", "SL", "VAC", "H"].includes(display)) {
            cell.fill = fillColor("E0EAFF");
            cell.font = { bold: true, color: { argb: "1D4ED8" } };
          } else {
            cell.fill = fillColor("ECFDF3");
            cell.font = { bold: true, color: { argb: "067647" } };
          }
        }
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Attendance-${monthLabel}-${sheet.year}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="page">
      <div style={heroStyle}>
        <h1 style={{ margin: 0, fontSize: 44, fontWeight: 800 }}>Attendance</h1>
        <p style={{ color: "#667085", marginTop: 10, fontSize: 16 }}>
          Upload biometric CSV and generate a monthly attendance sheet with totals,
          absence and single punch highlighting.
        </p>
      </div>

      {message ? <div style={successBox}>{message}</div> : null}
      {error ? <div style={errorBox}>{error}</div> : null}

      <section style={cardStyle}>
        <h2 style={sectionTitle}>Biometric Import</h2>
        <p style={sectionHint}>Upload the raw CSV exported from your attendance device</p>

        <div style={toolbarWrap}>
          <input
            type="text"
            placeholder="Search employee name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ ...inputStyle, minWidth: 240 }}
          />

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
            style={{ ...inputStyle, width: 110 }}
          />

          <input
            value={year}
            onChange={(e) => setYear(e.target.value)}
            placeholder="Year"
            style={{ ...inputStyle, width: 110 }}
          />

          <button onClick={handleUpload} disabled={uploading} style={primaryBtn}>
            {uploading ? "Uploading..." : "Upload CSV"}
          </button>

          <button onClick={() => loadSheet()} disabled={loadingSheet} style={ghostBtn}>
            {loadingSheet ? "Loading..." : "Load Sheet"}
          </button>

          <button onClick={handleExportExcel} style={purpleBtn}>
            Export Excel
          </button>

          {canApprove ? (
            <button onClick={handleApprove} disabled={approving || !batchId} style={greenBtn}>
              {approving ? "Approving..." : "Approve Batch"}
            </button>
          ) : null}
        </div>
      </section>

      <section style={cardStyle}>
        <h2 style={sectionTitle}>
          {getMonthLongName(month)} Attendance
        </h2>
        <p style={sectionHint}>
          Generated monthly attendance sheet ready for HR review and Excel download.
        </p>

        <div style={{ overflowX: "auto" }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={headerCell}>Employee</th>
                <th style={headerCell}>GAS ID</th>
                {Array.from({ length: Number(sheet?.daysInMonth || 30) }).map((_, i) => {
                  const day = i + 1;
                  return (
                    <th key={day} style={dayHeaderCell}>
                      {day}-{getMonthShortName(month)}
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody>
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={2 + Number(sheet?.daysInMonth || 30)} style={emptyCell}>
                    لا توجد بيانات
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((employee) => (
                  <tr key={`${employee.gasId}-${employee.sno}`}>
                    <td style={nameCell}>{employee.name}</td>
                    <td style={bodyCell}>{employee.gasId}</td>

                    {Array.from({ length: Number(sheet?.daysInMonth || 30) }).map((_, i) => {
                      const day = i + 1;
                      const dayData = employee.days?.[day];
                      const displayValue = getDisplayValue(dayData);

                      return (
                        <td key={day} style={getAttendanceCellStyle(displayValue)}>
                          <div style={{ display: "grid", gap: 6 }}>
                            <div style={{ fontWeight: 700 }}>{displayValue}</div>

                            {canEditBeforeApprove && dayData?.importRowId ? (
                              <select
                                value={displayValue}
                                onChange={(e) => handleStatusChange(dayData, e.target.value)}
                                disabled={savingCell === String(dayData.importRowId)}
                                style={selectStyle}
                              >
                                {STATUS_OPTIONS.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            ) : null}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function getDisplayValue(dayData) {
  if (!dayData) return "A";
  if (["A", "SP", "SKL", "SL", "VAC", "H"].includes(dayData.status)) {
    return dayData.status;
  }
  return Number(dayData.regularHours || 0) > 0 ? String(dayData.regularHours) : "P";
}

function getMonthShortName(month) {
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return names[Number(month) - 1] || "Mon";
}

function getMonthLongName(month) {
  const names = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return names[Number(month) - 1] || "Month";
}

function getAttendanceCellStyle(value) {
  const base = {
    border: "1px solid #d0d5dd",
    padding: 8,
    textAlign: "center",
    minWidth: 90,
    verticalAlign: "top",
  };

  if (value === "A") {
    return { ...base, background: "#fef2f2", color: "#b42318" };
  }

  if (value === "SP") {
    return { ...base, background: "#fef3c7", color: "#b45309" };
  }

  if (["SKL", "SL", "VAC", "H"].includes(value)) {
    return { ...base, background: "#e0e7ff", color: "#3730a3" };
  }

  return { ...base, background: "#ecfdf3", color: "#067647" };
}

function fillColor(argb) {
  return {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb },
  };
}

const thinBorder = {
  top: { style: "thin", color: { argb: "CBD5E1" } },
  left: { style: "thin", color: { argb: "CBD5E1" } },
  bottom: { style: "thin", color: { argb: "CBD5E1" } },
  right: { style: "thin", color: { argb: "CBD5E1" } },
};

const heroStyle = {
  marginBottom: 20,
};

const cardStyle = {
  background: "#ffffff",
  border: "1px solid #eaecf0",
  borderRadius: 18,
  padding: 20,
  marginBottom: 20,
};

const sectionTitle = {
  margin: 0,
  fontSize: 28,
  fontWeight: 700,
};

const sectionHint = {
  marginTop: 8,
  color: "#667085",
};

const toolbarWrap = {
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
  alignItems: "center",
  marginTop: 18,
};

const inputStyle = {
  border: "1px solid #d0d5dd",
  borderRadius: 10,
  padding: "12px 14px",
  fontSize: 14,
  background: "#fff",
};

const primaryBtn = {
  border: "none",
  borderRadius: 12,
  padding: "12px 18px",
  background: "#155eef",
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer",
};

const ghostBtn = {
  border: "1px solid #d0d5dd",
  borderRadius: 12,
  padding: "12px 18px",
  background: "#fff",
  color: "#344054",
  fontWeight: 700,
  cursor: "pointer",
};

const purpleBtn = {
  border: "none",
  borderRadius: 12,
  padding: "12px 18px",
  background: "#7c3aed",
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer",
};

const greenBtn = {
  border: "none",
  borderRadius: 12,
  padding: "12px 18px",
  background: "#067647",
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer",
};

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: 1600,
};

const headerCell = {
  border: "1px solid #d0d5dd",
  background: "#f8fafc",
  padding: 10,
  textAlign: "center",
  fontWeight: 700,
};

const dayHeaderCell = {
  border: "1px solid #d0d5dd",
  background: "#bfd9f2",
  padding: 10,
  textAlign: "center",
  fontWeight: 700,
  minWidth: 90,
};

const bodyCell = {
  border: "1px solid #d0d5dd",
  padding: 10,
  textAlign: "center",
};

const nameCell = {
  border: "1px solid #d0d5dd",
  padding: 10,
  minWidth: 230,
  fontWeight: 700,
};

const emptyCell = {
  border: "1px solid #d0d5dd",
  padding: 20,
  textAlign: "center",
  color: "#667085",
};

const selectStyle = {
  width: "100%",
  border: "1px solid #d0d5dd",
  borderRadius: 8,
  padding: "6px 8px",
  fontSize: 12,
  background: "#fff",
};

const successBox = {
  marginBottom: 16,
  padding: 12,
  borderRadius: 10,
  background: "#ecfdf3",
  color: "#067647",
  border: "1px solid #abefc6",
};

const errorBox = {
  marginBottom: 16,
  padding: 12,
  borderRadius: 10,
  background: "#fef2f2",
  color: "#b42318",
  border: "1px solid #fecdca",
};
