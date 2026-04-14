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

  function getMonthShortName(monthNumber) {
    const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return names[Number(monthNumber) - 1] || "Mon";
  }

  return (
    <div className="page">
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0 }}>Attendance Sheet</h1>
          <p style={{ marginTop: 8, color: "#667085" }}>
            رفع ملف البصمة، عرض الشيت الشهري بنفس شكل الإكسل، وأخذ الساعات من عمود Regular Hours
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
                  <th style={headerCell}>TOTAL REGULAR HOURS</th>
                  {Array.from({ length: sheet.daysInMonth }).map((_, idx) => {
                    const day = idx + 1;
                    return (
                      <th key={day} style={dayHeaderCell}>
                        {`${day}-${getMonthShortName(sheet.month)}`}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {sheet.employees.length === 0 ? (
                  <tr>
                    <td colSpan={7 + sheet.daysInMonth} style={emptyTd}>
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
                      <td style={bodyCell}>{employee.totalRegularHours || 0}</td>

                      {Array.from({ length: sheet.daysInMonth }).map((_, idx) => {
                        const day = idx + 1;
                        const dayData = employee.days[day];

                        let cellStyle = { ...attendanceCell };
                        if (dayData.color === "orange") {
                          cellStyle = {
                            ...attendanceCell,
                            background: "#fef3c7",
                            color: "#b45309",
                            fontWeight: 700,
                          };
                        } else if (dayData.color === "green") {
                          cellStyle = {
                            ...attendanceCell,
                            background: "#ecfdf3",
                            color: "#067647",
                            fontWeight: 700,
                          };
                        } else {
                          cellStyle = {
                            ...attendanceCell,
                            background: "#fef2f2",
                            color: "#b42318",
                            fontWeight: 700,
                          };
                        }

                        return (
                          <td
                            key={day}
                            style={cellStyle}
                            title={`Regular Hours: ${dayData.regularHours || 0}`}
                          >
                            {dayData.value}
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

      {sheet ? (
        <section style={cardStyle}>
          <h3 style={{ marginTop: 0 }}>Legend</h3>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <span style={{ ...legendBadge, background: "#ecfdf3", color: "#067647" }}>
              P = Present / Regular
            </span>
            <span style={{ ...legendBadge, background: "#fef3c7", color: "#b45309" }}>
              SP = Single Punch
            </span>
            <span style={{ ...legendBadge, background: "#fef2f2", color: "#b42318" }}>
              A = Absent
            </span>
          </div>
        </section>
      ) : null}
    </div>
  );
}

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

const excelTable = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: 1800,
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

const emptyTd = {
  padding: 20,
  textAlign: "center",
  color: "#667085",
};

const legendBadge = {
  display: "inline-flex",
  padding: "8px 12px",
  borderRadius: 999,
  fontWeight: 700,
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