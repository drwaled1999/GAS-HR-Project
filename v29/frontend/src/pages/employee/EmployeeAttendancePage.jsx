import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../services/api";

function statusTone(cell) {
  const value = String(cell?.value ?? "").toLowerCase();

  if (!Number.isNaN(Number(cell?.value)) && Number(cell?.value) > 0) return "present";
  if (value === "a") return "absent";
  if (cell?.type === "single") return "single";
  if (value === "sl") return "leave-sick";
  if (value === "al") return "leave-annual";
  if (cell?.type === "weekend") return "holiday";
  return "neutral";
}

function displayValue(cell) {
  if (!cell) return "A";

  if (!Number.isNaN(Number(cell.value)) && Number(cell.value) > 0) {
    return `${cell.value} Hours`;
  }

  if (cell.value === "A") return "Absent";
  if (cell.value === "AL") return "Annual Leave";
  if (cell.value === "SL") return "Sick Leave";
  if (cell.value === "PM") return "Permission";
  if (cell.value === "TK") return "Takleef";
  if (cell.type === "single") return `Single Punch${cell.value ? ` (${cell.value}h)` : ""}`;
  if (cell.type === "weekend") return "Weekend";

  return cell.value || "Absent";
}

export default function EmployeeAttendancePage() {
  const [month, setMonth] = useState(4);
  const [year, setYear] = useState(2026);
  const [days, setDays] = useState([]);
  const [employeeRow, setEmployeeRow] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState("");

  async function loadAttendance() {
    try {
      const response = await apiFetch(`/attendance/monthly?month=${month}&year=${year}`);
      const data = response?.data || {};
      const rows = Array.isArray(data.rows) ? data.rows : [];

      setDays(Array.isArray(data.days) ? data.days : []);
      setEmployeeRow(rows[0] || null);
      setError("");
    } catch (err) {
      setDays([]);
      setEmployeeRow(null);
      setError(err.message || "Failed to load attendance");
    }
  }

  useEffect(() => {
    loadAttendance();
  }, [month, year]);

  const dailyItems = useMemo(() => {
    if (!employeeRow || !Array.isArray(days)) return [];

    return days.map((day, index) => ({
      day: day.label,
      key: day.key,
      cell: employeeRow?.cells?.[index] || { value: "A", type: "absent" },
    }));
  }, [employeeRow, days]);

  return (
    <div className="page mobile-page">
      <section className="card mobile-filter-card">
        <div className="controls compact-controls two-up">
          <label>
            Month
            <input
              type="number"
              value={month}
              min="1"
              max="12"
              onChange={(e) => setMonth(Number(e.target.value))}
            />
          </label>

          <label>
            Year
            <input
              type="number"
              value={year}
              min="2024"
              max="2035"
              onChange={(e) => setYear(Number(e.target.value))}
            />
          </label>
        </div>
      </section>

      {error ? <div className="alert error">{error}</div> : null}

      {!employeeRow ? (
        <section className="card mobile-list-card">
          <p className="muted">No approved attendance sheet found for this employee.</p>
        </section>
      ) : (
        <>
          <section className="card mobile-list-card">
            <div className="page-header compact">
              <div>
                <h2>{employeeRow.name || "Employee"}</h2>
                <p>{employeeRow.userId || "-"}</p>
              </div>
            </div>

            <div className="mini-month-grid" style={{ marginTop: 12 }}>
              <div className="mini-day neutral">
                <span>Total Hours</span>
                <strong>{employeeRow.totalHours || 0}</strong>
              </div>
              <div className="mini-day neutral">
                <span>Absent</span>
                <strong>{employeeRow.absentCount || 0}</strong>
              </div>
              <div className="mini-day neutral">
                <span>Single Punch</span>
                <strong>{employeeRow.singlePunchCount || 0}</strong>
              </div>
              <div className="mini-day neutral">
                <span>Leave</span>
                <strong>{(employeeRow.annualLeaveCount || 0) + (employeeRow.sickLeaveCount || 0)}</strong>
              </div>
            </div>
          </section>

          <section className="attendance-mobile-list">
            {dailyItems.map(({ day, cell, key }) => (
              <article key={key} className={`attendance-mobile-card ${statusTone(cell)}`}>
                <div>
                  <strong>{day}</strong>
                  <p>{displayValue(cell)}</p>
                </div>
                {cell.overrideType ? <span className="soft-badge">Edited</span> : null}
              </article>
            ))}
          </section>

          <section className="card mobile-list-card">
            <div className="page-header compact">
              <div>
                <h2>Monthly View</h2>
                <p>عرض جدول شهري مختصر عند الحاجة</p>
              </div>
              <button className="ghost" onClick={() => setExpanded((prev) => !prev)}>
                {expanded ? "Hide" : "Show"}
              </button>
            </div>

            {expanded ? (
              <div className="mini-month-grid">
                {dailyItems.map(({ day, cell, key }) => (
                  <div key={key} className={`mini-day ${statusTone(cell)}`}>
                    <span>{day.split("-")[0]}</span>
                    <strong>
                      {!Number.isNaN(Number(cell?.value)) && Number(cell?.value) > 0
                        ? cell.value
                        : String(cell?.value || "A").slice(0, 2)}
                    </strong>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">اضغط Show لعرض الشبكة الشهرية.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
