import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../services/api";

function statusTone(cell) {
  const value = String(cell?.value ?? "").trim().toUpperCase();

  if (value !== "" && !Number.isNaN(Number(cell?.value)) && Number(cell?.value) > 0) {
    return "present";
  }

  if (value === "A") return "absent";
  if (value === "SP" || cell?.type === "single") return "single";

  if (["SL"].includes(value)) return "leave-sick";
  if (["AL", "V"].includes(value)) return "leave-annual";

  if (["W", "H", "NH"].includes(value) || cell?.type === "weekend") {
    return "holiday";
  }

  return "neutral";
}

function displayValue(cell) {
  if (!cell) return "-";

  const value = String(cell.value ?? "").trim().toUpperCase();

  if (value !== "" && !Number.isNaN(Number(cell.value)) && Number(cell.value) > 0) {
    return `Hours ${cell.value}`;
  }

  if (value === "A") return "Absent";
  if (value === "AL" || value === "V") return "Annual Leave";
  if (value === "SL") return "Sick Leave";
  if (value === "PM") return "Permission";
  if (value === "TK" || value === "TA") return "Takleef";
  if (value === "BT") return "Business Trip";
  if (value === "H") return "Holiday";
  if (value === "NH") return "National Holiday";
  if (value === "W" || cell.type === "weekend") return "Weekend";
  if (value === "SP" || cell.type === "single") return "Single Punch";

  return value || "-";
}

function shortDisplayValue(cell) {
  if (!cell) return "-";

  const value = String(cell.value ?? "").trim().toUpperCase();

  if (value !== "" && !Number.isNaN(Number(cell.value)) && Number(cell.value) > 0) {
    return String(cell.value);
  }

  if (value === "A") return "A";
  if (value === "AL" || value === "V") return "AL";
  if (value === "SL") return "SL";
  if (value === "PM") return "PM";
  if (value === "TK" || value === "TA") return "TK";
  if (value === "BT") return "BT";
  if (value === "H") return "H";
  if (value === "NH") return "NH";
  if (value === "W" || cell.type === "weekend") return "W";
  if (value === "SP" || cell.type === "single") return "SP";

  return value || "-";
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
      cell: employeeRow?.cells?.[index] || {
        value: day.weekend ? "W" : "-",
        type: day.weekend ? "weekend" : "neutral",
      },
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
                <strong>
                  {(employeeRow.annualLeaveCount || 0) + (employeeRow.sickLeaveCount || 0)}
                </strong>
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
              <div
                className="mini-month-grid"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(72px, 1fr))",
                  gap: 12,
                  marginTop: 12,
                }}
              >
                {dailyItems.map(({ day, cell, key }) => {
                  const dayNumber = String(day).split("-")[0];
                  const shortValue = shortDisplayValue(cell);

                  return (
                    <div
                      key={key}
                      className={`mini-day ${statusTone(cell)}`}
                      style={{
                        minHeight: 72,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                        textAlign: "center",
                        padding: "10px 6px",
                      }}
                    >
                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          lineHeight: 1,
                        }}
                      >
                        {dayNumber}
                      </span>

                      <strong
                        style={{
                          fontSize: 18,
                          lineHeight: 1.1,
                        }}
                      >
                        {shortValue}
                      </strong>
                    </div>
                  );
                })}
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