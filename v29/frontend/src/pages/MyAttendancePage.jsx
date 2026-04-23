import { useEffect, useState } from "react";
import { API_BASE } from "../services/api";

export default function MyAttendancePage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const today = new Date();
  const defaultMonth = today.getMonth() + 1;
  const defaultYear = today.getFullYear();

  const [month, setMonth] = useState(defaultMonth);
  const [year, setYear] = useState(defaultYear);

  async function loadMyAttendance() {
    try {
      setLoading(true);
      setError("");

      const token =
        localStorage.getItem("token") ||
        localStorage.getItem("authToken") ||
        localStorage.getItem("accessToken") ||
        "";

      const res = await fetch(
        `${API_BASE}/attendance/monthly?month=${month}&year=${year}`,
        {
          headers: {
            Authorization: token ? `Bearer ${token}` : "",
          },
        }
      );

      const contentType = res.headers.get("content-type") || "";

      if (!res.ok) {
        let message = "Failed to load attendance";
        if (contentType.includes("application/json")) {
          const err = await res.json();
          message = err?.message || err?.error || message;
        } else {
          const text = await res.text();
          message = text || message;
        }
        throw new Error(message);
      }

      if (!contentType.includes("application/json")) {
        const text = await res.text();
        throw new Error(
          `Expected JSON but received: ${text.slice(0, 120)}`
        );
      }

      const result = await res.json();
      setData(result?.data || { days: [], rows: [] });
    } catch (err) {
      console.error("Failed to load attendance", err);
      setData(null);
      setError(err.message || "Failed to load attendance");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMyAttendance();
  }, []);

  const days = data?.days || [];
  const row = data?.rows?.[0];

  return (
    <div style={{ padding: "20px" }}>
      <h2>My Attendance</h2>

      <div style={{ marginBottom: "20px", display: "grid", gap: "10px", maxWidth: "420px" }}>
        <input
          type="number"
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
          placeholder="Month"
        />
        <input
          type="number"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          placeholder="Year"
        />
        <button onClick={loadMyAttendance} disabled={loading}>
          {loading ? "Loading..." : "Load"}
        </button>
      </div>

      {error ? (
        <p style={{ color: "crimson", marginBottom: "16px" }}>{error}</p>
      ) : null}

      {loading && <p>Loading...</p>}

      {!loading && row && (
        <div>
          <h3>{row.name}</h3>

          <div style={{ overflowX: "auto" }}>
            <table border="1" cellPadding="8" style={{ borderCollapse: "collapse", minWidth: "900px" }}>
              <thead>
                <tr>
                  {days.map((d) => (
                    <th key={d.key}>{d.label}</th>
                  ))}
                </tr>
              </thead>

              <tbody>
                <tr>
                  {row.cells.map((cell, i) => (
                    <td key={i}>{cell.value}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: "20px" }}>
            <p>Total Hours: {row.totalHours}</p>
            <p>Absent: {row.absentCount}</p>
            <p>Single Punch: {row.singlePunchCount}</p>
            <p>Annual Leave: {row.annualLeaveCount}</p>
            <p>Sick Leave: {row.sickLeaveCount}</p>
            <p>Emergency Leave: {row.emergencyLeaveCount}</p>
            <p>Permission: {row.permissionCount}</p>
            <p>Takleef: {row.takleefCount}</p>
          </div>
        </div>
      )}

      {!loading && !row && !error && (
        <p>No attendance data found</p>
      )}
    </div>
  );
}
