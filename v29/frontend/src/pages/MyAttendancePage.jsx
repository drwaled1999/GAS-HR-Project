import { useEffect, useState } from "react";

export default function MyAttendancePage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const today = new Date();
  const defaultMonth = today.getMonth() + 1;
  const defaultYear = today.getFullYear();

  const [month, setMonth] = useState(defaultMonth);
  const [year, setYear] = useState(defaultYear);

  async function loadMyAttendance() {
    try {
      setLoading(true);

      const token =
        localStorage.getItem("token") ||
        localStorage.getItem("authToken");

      const res = await fetch(
        `/attendance/monthly?month=${month}&year=${year}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const result = await res.json();

      setData(result.data);
    } catch (err) {
      console.error("❌ Failed to load attendance", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMyAttendance();
  }, []);

  const days = data?.days || [];
  const row = data?.rows?.[0]; // الموظف نفسه

  return (
    <div style={{ padding: "20px" }}>
      <h2>My Attendance</h2>

      {/* اختيار الشهر */}
      <div style={{ marginBottom: "20px" }}>
        <input
          type="number"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          placeholder="Month"
        />
        <input
          type="number"
          value={year}
          onChange={(e) => setYear(e.target.value)}
          placeholder="Year"
        />
        <button onClick={loadMyAttendance}>
          Load
        </button>
      </div>

      {loading && <p>Loading...</p>}

      {!loading && row && (
        <div>
          <h3>{row.name}</h3>

          <table border="1" cellPadding="8">
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

          {/* إحصائيات */}
          <div style={{ marginTop: "20px" }}>
            <p>✅ Total Hours: {row.totalHours}</p>
            <p>❌ Absent: {row.absentCount}</p>
            <p>⚠️ Single Punch: {row.singlePunchCount}</p>
            <p>🏖️ Annual Leave: {row.annualLeaveCount}</p>
            <p>🤒 Sick Leave: {row.sickLeaveCount}</p>
          </div>
        </div>
      )}

      {!loading && !row && (
        <p>No attendance data found</p>
      )}
    </div>
  );
}
