import { useEffect, useMemo, useState } from "react";
import { API_BASE, apiFetch } from "../services/api";
import { useAuth } from "../context/AuthContext";

function getToken() {
  return (
    localStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    localStorage.getItem("accessToken") ||
    ""
  );
}

function ReportCard({ label, value, hint }) {
  return (
    <div className="report-card-box">
      <div className="report-card-title">{label}</div>
      <div className="report-card-value">{value}</div>
      <div className="report-card-hint">{hint}</div>
    </div>
  );
}

function SimpleTable({ columns, rows }) {
  return (
    <div className="table-container">
      <table className="report-table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((r, i) => (
              <tr key={i}>
                {columns.map((c) => (
                  <td key={c.key}>{r[c.key] || "-"}</td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={columns.length} className="empty">
                لا توجد بيانات
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function ReportsPage() {
  const { user } = useAuth();

  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());
  const [date, setDate] = useState(today.toISOString().slice(0, 10));
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  async function loadReports() {
    if (!user?.username) return;

    try {
      const res = await apiFetch(
        `/reports/summary?username=${encodeURIComponent(
          user.username
        )}&month=${month}&year=${year}&date=${date}`
      );
      setData(res);
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    loadReports();
  }, [user?.username, month, year, date]);

  async function exportReport(type) {
    const token = getToken();

    const url = `${API_BASE}/reports/export?username=${user.username}&type=${type}&month=${month}&year=${year}&date=${date}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `report-${type}.xlsx`;
    a.click();
  }

  const cards = useMemo(() => {
    if (!data?.summary) return [];
    return [
      { label: "Employees", value: data.summary.visibleEmployees },
      { label: "Hours", value: data.summary.monthlyHours },
      { label: "Absent", value: data.summary.absentDays },
      { label: "Single Punch", value: data.summary.singlePunchCount },
    ];
  }, [data]);

  return (
    <div className="report-page">

      <h1 className="title">📊 Reports Dashboard</h1>

      <div className="filters">
        <input type="number" value={month} onChange={(e) => setMonth(e.target.value)} />
        <input type="number" value={year} onChange={(e) => setYear(e.target.value)} />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>

      {error && <div className="error">{error}</div>}

      <div className="cards">
        {cards.map((c) => (
          <ReportCard key={c.label} {...c} />
        ))}
      </div>

      <div className="export">
        <button onClick={() => exportReport("monthly")}>Monthly</button>
        <button onClick={() => exportReport("daily")}>Daily</button>
        <button onClick={() => exportReport("issues")}>Issues</button>
      </div>

      <div className="grid">
        <div>
          <h2>Top Hours</h2>
          <SimpleTable
            columns={[
              { key: "name", label: "Name" },
              { key: "totalHours", label: "Hours" },
            ]}
            rows={data?.topHoursRows || []}
          />
        </div>

        <div>
          <h2>Top Absence</h2>
          <SimpleTable
            columns={[
              { key: "name", label: "Name" },
              { key: "absentCount", label: "Absent" },
            ]}
            rows={data?.topAbsenceRows || []}
          />
        </div>
      </div>

      <style>{`
        .report-page {
          padding: 20px;
          font-family: 'Segoe UI';
        }

        .title {
          font-size: 28px;
          font-weight: bold;
          margin-bottom: 20px;
        }

        .filters {
          display: flex;
          gap: 10px;
          margin-bottom: 20px;
        }

        .cards {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 15px;
          margin-bottom: 20px;
        }

        .report-card-box {
          background: linear-gradient(135deg, #1e3a8a, #2563eb);
          color: white;
          padding: 20px;
          border-radius: 15px;
          box-shadow: 0 10px 25px rgba(0,0,0,0.1);
        }

        .report-card-value {
          font-size: 24px;
          font-weight: bold;
        }

        .export button {
          margin-right: 10px;
          padding: 10px 15px;
          border: none;
          background: #2563eb;
          color: white;
          border-radius: 8px;
          cursor: pointer;
        }

        .grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }

        .table-container {
          overflow-x: auto;
        }

        .report-table {
          width: 100%;
          border-collapse: collapse;
          background: white;
          border-radius: 10px;
          overflow: hidden;
        }

        .report-table th {
          background: #1e293b;
          color: white;
          padding: 10px;
        }

        .report-table td {
          padding: 10px;
          border-bottom: 1px solid #eee;
        }

        .report-table tr:hover {
          background: #f1f5f9;
        }

        .empty {
          text-align: center;
          padding: 20px;
        }
      `}</style>
    </div>
  );
}
