import { useMemo, useState } from "react";
import ExcelJS from "exceljs";
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
  const [exporting, setExporting] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const username =
    localStorage.getItem("username") ||
    localStorage.getItem("userName") ||
    "system";

  const role = (
    localStorage.getItem("role") ||
    localStorage.getItem("userRole") ||
    ""
  ).toLowerCase();

  const canApprove = [
    "hr manager",
    "hr_manager",
    "system owner",
    "owner",
  ].includes(role);

  const employees = useMemo(() => {
    if (!sheet?.employees) return [];
    return sheet.employees.map((employee) =>
      enrichEmployeeTotals(employee, sheet.daysInMonth)
    );
  }, [sheet]);

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

      setBatchId(result?.batchId || null);

      const saved = result?.summary?.savedRows || 0;
      const failed = result?.summary?.failed || 0;

      setMessage(`تم رفع الملف بنجاح. الصفوف المحفوظة: ${saved} | الفاشلة: ${failed}`);

      if (result?.batchId) {
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

  async function handleExportExcel() {
    if (!sheet || !employees.length) {
      setError("لا توجد بيانات لتصديرها");
      return;
    }

    try {
      setExporting(true);
      setError("");

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Attendance Sheet", {
        views: [{ state: "frozen", xSplit: 10, ySplit: 1 }],
      });

      const monthLabel = getMonthShortName(sheet.month);

      const headers = [
        "S/NO",
        "NAME",
        "TRADE / CATEGORY",
        "ID",
        "GAS ID",
        "NATIONALITY",
        "TOTAL REGULAR HOURS",
        "TOTAL P",
        "TOTAL SP",
        "TOTAL A",
        ...Array.from({ length: sheet.daysInMonth }).map(
          (_, index) => `${index + 1}-${monthLabel}`
        ),
      ];

      worksheet.addRow(headers);

      worksheet.columns = [
        { width: 9 },
        { width: 28 },
        { width: 22 },
        { width: 14 },
        { width: 14 },
        { width: 14 },
        { width: 18 },
        { width: 10 },
        { width: 10 },
        { width: 10 },
        ...Array.from({ length: sheet.daysInMonth }).map(() => ({ width: 12 })),
      ];

      const headerRow = worksheet.getRow(1);
      headerRow.height = 24;

      headerRow.eachCell((cell, colNumber) => {
        cell.font = { bold: true };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = thinBorder;

        if (colNumber === 5) {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FEE2E2" },
          };
          cell.font = { bold: true, color: { argb: "991B1B" } };
          return;
        }

        if (colNumber >= 11) {
          const day = colNumber - 10;
          const weekend = isWeekend(day, Number(sheet.month), Number(sheet.year));

          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: weekend ? "BFDBFE" : "DBEAFE" },
          };
          return;
        }

        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "DBEAFE" },
        };
      });

      employees.forEach((employee) => {
        const rowValues = [
          employee.sno,
          employee.name || "",
          employee.tradeCategory || "",
          employee.id || "",
          employee.gasId || "",
          employee.nationality || "",
          employee.totalRegularHours || 0,
          employee.totalP || 0,
          employee.totalSP || 0,
          employee.totalA || 0,
          ...Array.from({ length: sheet.daysInMonth }).map((_, index) => {
            const day = index + 1;
            return getDayCellDisplay(employee.days?.[day]);
          }),
        ];

        const row = worksheet.addRow(rowValues);

        row.eachCell((cell, colNumber) => {
          cell.border = thinBorder;
          cell.alignment = { horizontal: "center", vertical: "middle" };

          if (colNumber >= 11) {
            const day = colNumber - 10;
            const dayData = employee.days?.[day];
            const weekend = isWeekend(day, Number(sheet.month), Number(sheet.year));

            if (weekend) {
              cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "EFF6FF" },
              };
            }

            if (dayData?.value === "A") {
              cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: weekend ? "FDE68A" : "FEF2F2" },
              };
              cell.font = { bold: true, color: { argb: "B42318" } };
            } else if (dayData?.value === "SP") {
              cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FEF3C7" },
              };
              cell.font = { bold: true, color: { argb: "B45309" } };
            } else if ((dayData?.regularHours || 0) > 0) {
              cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: weekend ? "BAE6FD" : "ECFDF3" },
              };
              cell.font = { bold: true, color: { argb: "067647" } };
            }
          }
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Attendance-${monthLabel}-${sheet.year}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message || "فشل تصدير الإكسل");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="page">
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0 }}>Attendance Sheet</h1>
          <p style={{ marginTop: 8, color: "#667085" }}>
            في اليوم نفسه، مع تمييز الجمعة والسبت، وإمكانية التصدير إلى Excel،
            يعرض ساعات الدوام من عمود Regular Hours
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

          <button
            type="button"
            onClick={handleUpload}
            disabled={uploading}
            style={primaryBtn}
          >
            {uploading ? "Uploading..." : "Upload"}
          </button>

          <button
            type="button"
            onClick={() => loadSheet()}
            disabled={loadingSheet}
            style={secondaryBtn}
          >
            {loadingSheet ? "Loading..." : "Load Sheet"}
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            disabled={exporting || !sheet}
            style={exportBtn}
          >
            {exporting ? "Exporting..." : "Export Excel"}
          </button>

          {canApprove ? (
            <button
              type="button"
              onClick={handleApprove}
              disabled={approving || !batchId}
              style={approveBtn}
            >
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
                  <th style={headerCell}>TOTAL REGULAR HOURS</th>
                  <th style={headerCell}>TOTAL P</th>
                  <th style={headerCell}>TOTAL SP</th>
                  <th style={headerCell}>TOTAL A</th>
                  {Array.from({ length: sheet.daysInMonth }).map((_, index) => {
                    const day = index + 1;
                    const weekend = isWeekend(day, Number(sheet.month), Number(sheet.year));

                    return (
                      <th
                        key={`head-day-${day}`}
                        style={weekend ? weekendHeaderCell : dayHeaderCell}
                      >
                        {`${day}-${getMonthShortName(sheet.month)}`}
                      </th>
                    );
                  })}
                </tr>
              </thead>

              <tbody>
                {employees.length === 0 ? (
                  <tr>
                    <td colSpan={10 + (sheet.daysInMonth || 0)} style={emptyTd}>
                      لا توجد بيانات
                    </td>
                  </tr>
                ) : (
                  employees.map((employee) => (
                    <tr key={`${employee.id || employee.gasId}-${employee.sno}`}>
                      <td style={bodyCell}>{employee.sno}</td>
                      <td style={bodyCell}>{employee.name}</td>
                      <td style={bodyCell}>{employee.tradeCategory || ""}</td>
                      <td style={bodyCell}>{employee.id || ""}</td>
                      <td style={bodyCell}>{employee.gasId || ""}</td>
                      <td style={bodyCell}>{employee.nationality || ""}</td>
                      <td style={bodyCell}>{employee.totalRegularHours || 0}</td>
                      <td style={bodyCell}>{employee.totalP || 0}</td>
                      <td style={bodyCell}>{employee.totalSP || 0}</td>
                      <td style={bodyCell}>{employee.totalA || 0}</td>

                      {Array.from({ length: sheet.daysInMonth }).map((_, index) => {
                        const day = index + 1;
                        const dayData = employee.days?.[day];
                        const weekend = isWeekend(day, Number(sheet.month), Number(sheet.year));

                        let cellStyle = weekend
                          ? { ...weekendAttendanceCell }
                          : { ...attendanceCell };

                        if (dayData?.value === "A") {
                          cellStyle = {
                            ...cellStyle,
                            background: weekend ? "#fde68a" : "#fef2f2",
                            color: "#b42318",
                            fontWeight: 700,
                          };
                        } else if (dayData?.value === "SP") {
                          cellStyle = {
                            ...cellStyle,
                            background: "#fef3c7",
                            color: "#b45309",
                            fontWeight: 700,
                          };
                        } else if ((dayData?.regularHours || 0) > 0) {
                          cellStyle = {
                            ...cellStyle,
                            background: weekend ? "#bae6fd" : "#ecfdf3",
                            color: "#067647",
                            fontWeight: 700,
                          };
                        }

                        return (
                          <td
                            key={`emp-${employee.sno}-day-${day}`}
                            style={cellStyle}
                            title={`Regular Hours: ${dayData?.regularHours || 0}`}
                          >
                            {getDayCellDisplay(dayData)}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function enrichEmployeeTotals(employee, daysInMonth) {
  let totalRegularHours = 0;
  let totalP = 0;
  let totalSP = 0;
  let totalA = 0;

  const days = { ...(employee.days || {}) };

  for (let d = 1; d <= daysInMonth; d += 1) {
    const dayData = days[d] || {
      value: "A",
      regularHours: 0,
      color: "red",
    };

    const hours = Number(dayData.regularHours || 0);
    totalRegularHours += hours;

    if (dayData.value === "SP") totalSP += 1;
    else if (dayData.value === "A") totalA += 1;
    else totalP += 1;

    days[d] = dayData;
  }

  return {
    ...employee,
    days,
    totalRegularHours: Number(totalRegularHours.toFixed(2)),
    totalP,
    totalSP,
    totalA,
  };
}

function getMonthShortName(monthNumber) {
  const names = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return names[Number(monthNumber) - 1] || "Mon";
}

function isWeekend(day, month, year) {
  const date = new Date(year, month - 1, day);
  const jsDay = date.getDay();
  return jsDay === 5 || jsDay === 6;
}

function getDayCellDisplay(dayData) {
  if (!dayData) return "A";
  if (dayData.value === "A") return "A";
  if (dayData.value === "SP") return "SP";
  return dayData.regularHours ?? 0;
}

const thinBorder = {
  top: { style: "thin", color: { argb: "CBD5E1" } },
  left: { style: "thin", color: { argb: "CBD5E1" } },
  bottom: { style: "thin", color: { argb: "CBD5E1" } },
  right: { style: "thin", color: { argb: "CBD5E1" } },
};

const cardStyle = {
  background: "#fff",
  border: "1px solid #eaecf0",
  borderRadius: 16,
  padding: 18,
  marginBottom: 18,
};

const toolbarStyle = {
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
  alignItems: "center",
};

const inputStyle = {
  padding: "12px 14px",
  border: "1px solid #d0d5dd",
  borderRadius: 10,
  fontSize: 14,
  background: "#fff",
};

const primaryBtn = {
  background: "#155eef",
  color: "#fff",
  border: "none",
  padding: "12px 18px",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 600,
};

const secondaryBtn = {
  background: "#fff",
  color: "#344054",
  border: "1px solid #d0d5dd",
  padding: "12px 18px",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 600,
};

const approveBtn = {
  background: "#067647",
  color: "#fff",
  border: "none",
  padding: "12px 18px",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 700,
};

const exportBtn = {
  background: "#7c3aed",
  color: "#fff",
  border: "none",
  padding: "12px 18px",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 700,
};

const excelTable = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: 1900,
};

const headerCell = {
  border: "1px solid #94a3b8",
  background: "#dbeafe",
  color: "#1e293b",
  padding: 10,
  fontWeight: 700,
  textAlign: "center",
  whiteSpace: "nowrap",
};

const headerCellRed = {
  border: "1px solid #94a3b8",
  background: "#fee2e2",
  color: "#991b1b",
  padding: 10,
  fontWeight: 700,
  textAlign: "center",
  whiteSpace: "nowrap",
};

const dayHeaderCell = {
  border: "1px solid #94a3b8",
  background: "#dbeafe",
  color: "#1e293b",
  padding: 10,
  fontWeight: 700,
  textAlign: "center",
  whiteSpace: "nowrap",
  minWidth: 70,
};

const weekendHeaderCell = {
  border: "1px solid #94a3b8",
  background: "#bfdbfe",
  color: "#1d4ed8",
  padding: 10,
  fontWeight: 700,
  textAlign: "center",
  whiteSpace: "nowrap",
  minWidth: 70,
};

const bodyCell = {
  border: "1px solid #cbd5e1",
  padding: 8,
  textAlign: "center",
  whiteSpace: "nowrap",
};

const attendanceCell = {
  border: "1px solid #cbd5e1",
  padding: 8,
  textAlign: "center",
  whiteSpace: "nowrap",
  minWidth: 60,
};

const weekendAttendanceCell = {
  border: "1px solid #cbd5e1",
  padding: 8,
  textAlign: "center",
  whiteSpace: "nowrap",
  minWidth: 60,
  background: "#eff6ff",
};

const emptyTd = {
  padding: 20,
  textAlign: "center",
  color: "#667085",
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