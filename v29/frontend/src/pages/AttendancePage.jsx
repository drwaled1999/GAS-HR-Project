import { useEffect, useState } from "react";
import { getAttendance, uploadAttendanceFile } from "../services/api";

export default function AttendancePage() {
  const [file, setFile] = useState(null);
  const [month, setMonth] = useState(String(new Date().getMonth() + 1));
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [gasIdFilter, setGasIdFilter] = useState("");
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadAttendance() {
    try {
      setLoading(true);
      setError("");

      const data = await getAttendance({
        month,
        year,
        gasId: gasIdFilter,
      });

      setRecords(Array.isArray(data?.records) ? data.records : []);
    } catch (err) {
      setError(err.message || "فشل تحميل الحضور");
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAttendance();
  }, []);

  async function handleUpload() {
    if (!file) {
      setError("اختر ملف البصمة أولاً");
      return;
    }

    try {
      setUploading(true);
      setError("");
      setMessage("");

      const result = await uploadAttendanceFile(file);

      const inserted = result?.summary?.inserted || 0;
      const updated = result?.summary?.updated || 0;
      const createdUsers = result?.summary?.createdUsers || 0;
      const failed = result?.summary?.failed || 0;

      setMessage(
        `تم رفع الملف بنجاح. إضافة: ${inserted} | تحديث: ${updated} | حسابات جديدة: ${createdUsers} | فشل: ${failed}`
      );

      await loadAttendance();
    } catch (err) {
      setError(err.message || "فشل رفع الملف");
      alert("فشل رفع الملف");
    } finally {
      setUploading(false);
    }
  }

  function statusCellStyle(status) {
    if (status === "SP") {
      return {
        ...statusBadge,
        background: "#fff7ed",
        color: "#c2410c",
        border: "1px solid #fdba74",
      };
    }

    if (status === "P") {
      return {
        ...statusBadge,
        background: "#ecfdf3",
        color: "#067647",
        border: "1px solid #abefc6",
      };
    }

    return {
      ...statusBadge,
      background: "#fef2f2",
      color: "#b42318",
      border: "1px solid #fecdca",
    };
  }

  return (
    <div className="page">
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0 }}>Attendance Sheet</h1>
          <p style={{ marginTop: 8, color: "#667085" }}>
            ارفع ملف البصمة وسيتم عرض البيانات بشكل شبيه بالإكسل مع ربط الموظف عن طريق GAS ID
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

          <button
            type="button"
            onClick={handleUpload}
            disabled={uploading}
            style={primaryBtn}
          >
            {uploading ? "Uploading..." : "Upload"}
          </button>

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

          <input
            value={gasIdFilter}
            onChange={(e) => setGasIdFilter(e.target.value)}
            placeholder="User ID / GAS ID"
            style={{ ...inputStyle, width: 180 }}
          />

          <button
            type="button"
            onClick={loadAttendance}
            disabled={loading}
            style={secondaryBtn}
          >
            {loading ? "Loading..." : "Load"}
          </button>
        </div>
      </section>

      <section style={cardStyle}>
        <div style={{ overflowX: "auto" }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>User ID</th>
                <th style={thStyle}>Date</th>
                <th style={thStyle}>Regular</th>
                <th style={thStyle}>Regular Hours</th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr>
                  <td colSpan="5" style={emptyTd}>
                    لا توجد بيانات حضور
                  </td>
                </tr>
              ) : (
                records.map((row) => (
                  <tr key={row.id}>
                    <td style={tdStyle}>{row.name || "-"}</td>
                    <td style={tdStyle}>{row.userId || row.gasId || "-"}</td>
                    <td style={tdStyle}>{row.date || "-"}</td>
                    <td style={tdStyle}>
                      <span style={statusCellStyle(row.status)}>
                        {row.status === "SP"
                          ? "Single Punch"
                          : row.status === "P"
                          ? "Regular"
                          : "A"}
                      </span>
                    </td>
                    <td style={tdStyle}>{row.regularHours ?? row.hours ?? 0}</td>
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

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: 900,
};

const thStyle = {
  textAlign: "left",
  padding: 14,
  borderBottom: "1px solid #d0d5dd",
  background: "#f8fafc",
  color: "#344054",
  fontWeight: 700,
  whiteSpace: "nowrap",
};

const tdStyle = {
  padding: 14,
  borderBottom: "1px solid #f2f4f7",
  color: "#101828",
  whiteSpace: "nowrap",
};

const emptyTd = {
  padding: 20,
  textAlign: "center",
  color: "#667085",
};

const statusBadge = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "4px 10px",
  borderRadius: 999,
  fontSize: 12,
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
  background: "#fef3f2",
  color: "#b42318",
  border: "1px solid #fecdca",
};