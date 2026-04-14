import { useEffect, useState } from "react";
import axios from "axios";

export default function AttendancePage() {
  const [data, setData] = useState([]);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const res = await axios.get("/attendance/sheet?month=3&year=2026");

      console.log("API DATA:", res.data);

      setData(res.data?.employees || []);
      setDays(res.data?.days || 30);

    } catch (err) {
      console.error("ERROR:", err);
      setError("فشل تحميل البيانات");
    } finally {
      setLoading(false);
    }
  }

  // 🔥 حماية من الكراش
  if (loading) return <h3>جاري التحميل...</h3>;
  if (error) return <h3 style={{ color: "red" }}>{error}</h3>;

  return (
    <div>
      <h2>Attendance</h2>

      <table border="1">
        <thead>
          <tr>
            <th>Name</th>
            {[...Array(days)].map((_, i) => (
              <th key={i}>{i + 1}</th>
            ))}
          </tr>
        </thead>

        <tbody>
          {Array.isArray(data) && data.length > 0 ? (
            data.map((emp, i) => (
              <tr key={i}>
                <td>{emp.name}</td>

                {[...Array(days)].map((_, d) => {
                  const val = emp.days?.[d + 1];

                  let bg = "#f8d7da";
                  if (val === "P") bg = "lightgreen";
                  if (val === "SP") bg = "orange";

                  return (
                    <td key={d} style={{ background: bg }}>
                      {val || "A"}
                    </td>
                  );
                })}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={days + 1}>لا توجد بيانات</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}