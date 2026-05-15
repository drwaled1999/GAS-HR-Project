import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Clock3, FileSpreadsheet, ShieldCheck, UserRound } from "lucide-react";
import { getEmployeeProjectMonthlyAttendance } from "../../services/api";

function statusTone(cell) {
  const value = String(cell?.value ?? "").trim().toUpperCase();

  if (value !== "" && !Number.isNaN(Number(cell?.value)) && Number(cell?.value) > 0) {
    return "present";
  }

  if (value === "A") return "absent";
  if (value === "SP" || cell?.type === "single") return "single";
  if (value === "SL") return "leave-sick";
  if (value === "AL" || value === "V") return "leave-annual";
  if (value === "PM") return "permission";
  if (value === "TK" || value === "TA") return "takleef";
  if (value === "OFF" || value === "W" || cell?.type === "weekend") return "holiday";

  return "neutral";
}

function displayValue(cell) {
  if (!cell) return "-";

  const value = String(cell.value ?? "").trim().toUpperCase();

  if (value !== "" && !Number.isNaN(Number(cell.value)) && Number(cell.value) > 0) {
    return `${cell.value} Hours`;
  }

  if (value === "A") return "Absent";
  if (value === "AL" || value === "V") return "Annual Leave";
  if (value === "SL") return "Sick Leave";
  if (value === "PM") return "Permission";
  if (value === "TK" || value === "TA") return "Takleef";
  if (value === "SP" || cell.type === "single") return "Single Punch";
  if (value === "OFF" || value === "W" || cell.type === "weekend") return "Weekend";

  return value || "-";
}

function shortValue(cell) {
  if (!cell) return "-";

  const value = String(cell.value ?? "").trim().toUpperCase();

  if (value !== "" && !Number.isNaN(Number(cell.value)) && Number(cell.value) > 0) {
    return String(cell.value);
  }

  if (value === "OFF") return "W";
  return value || "-";
}

function monthName(month) {
  const date = new Date(2026, Number(month) - 1, 1);
  return date.toLocaleString("en-US", { month: "long" });
}

export default function EmployeeProjectAttendancePage() {
  const [month, setMonth] = useState(4);
  const [year, setYear] = useState(2026);
  const [projects, setProjects] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadProjectAttendance() {
    try {
      setLoading(true);
      setError("");

      const response = await getEmployeeProjectMonthlyAttendance({
        month,
        year,
      });

      const list = Array.isArray(response?.projects) ? response.projects : [];

      setProjects(list);
      setSelectedIndex(0);
    } catch (err) {
      setProjects([]);
      setError(err.message || "Failed to load project attendance");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProjectAttendance();
  }, [month, year]);

  const selectedProject = projects[selectedIndex] || null;
  const batch = selectedProject?.batch || null;
  const data = selectedProject?.data || {};
  const days = Array.isArray(data?.days) ? data.days : [];
  const employeeRow = Array.isArray(data?.rows) ? data.rows[0] : null;

  const dailyItems = useMemo(() => {
    if (!employeeRow || !Array.isArray(days)) return [];

    return days.map((day, index) => ({
      key: day.key,
      label: day.label,
      weekend: day.weekend,
      cell: employeeRow?.cells?.[index] || {
        value: day.weekend ? "OFF" : "-",
        type: day.weekend ? "weekend" : "neutral",
      },
    }));
  }, [employeeRow, days]);

  const totalLeave =
    (employeeRow?.annualLeaveCount || 0) +
    (employeeRow?.sickLeaveCount || 0) +
    (employeeRow?.emergencyLeaveCount || 0);

  return (
    <div className="page mobile-page">
      <section
        className="card"
        style={{
          borderRadius: 28,
          padding: 24,
          background:
            "linear-gradient(135deg, rgba(37,99,235,0.14), rgba(255,255,255,0.96))",
          border: "1px solid rgba(148,163,184,0.28)",
          boxShadow: "0 24px 60px rgba(15,23,42,0.12)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            marginBottom: 18,
          }}
        >
          <div
            style={{
              width: 58,
              height: 58,
              borderRadius: 18,
              display: "grid",
              placeItems: "center",
              background: "linear-gradient(135deg, #2563eb, #0f172a)",
              color: "white",
              boxShadow: "0 18px 30px rgba(37,99,235,0.28)",
            }}
          >
            <FileSpreadsheet size={26} />
          </div>

          <div>
            <h1 style={{ margin: 0, fontSize: 26, lineHeight: 1.15 }}>
              My Project Attendance
            </h1>
            <p className="muted" style={{ margin: "6px 0 0" }}>
              Project-based attendance record for {monthName(month)} {year}
            </p>
          </div>
        </div>

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

        {projects.length > 1 ? (
          <div className="controls compact-controls" style={{ marginTop: 12 }}>
            <label>
              Project
              <select
                value={selectedIndex}
                onChange={(e) => setSelectedIndex(Number(e.target.value))}
              >
                {projects.map((item, index) => (
                  <option key={item?.batch?.id || index} value={index}>
                    {item?.batch?.project_name || item?.batch?.project_key || "Project"}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}
      </section>

      {loading ? (
        <section className="card mobile-list-card">
          <p className="muted">Loading project attendance...</p>
        </section>
      ) : null}

      {error ? <div className="alert error">{error}</div> : null}

      {!loading && !employeeRow ? (
        <section className="card mobile-list-card">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <ShieldCheck size={24} />
            <div>
              <h2 style={{ margin: 0 }}>No Approved Project Attendance</h2>
              <p className="muted" style={{ margin: "6px 0 0" }}>
                No approved project attendance sheet was found for this month.
              </p>
            </div>
          </div>
        </section>
      ) : null}

      {employeeRow ? (
        <>
          <section className="card mobile-list-card">
            <div className="page-header compact">
              <div>
                <h2>{employeeRow.name || "Employee"}</h2>
                <p>
                  GAS ID: {employeeRow.userId || "-"} • Project:{" "}
                  {batch?.project_name || batch?.project_key || "-"}
                </p>
              </div>
            </div>

            <div className="mini-month-grid" style={{ marginTop: 12 }}>
              <div className="mini-day neutral">
                <Clock3 size={20} />
                <span>Total Hours</span>
                <strong>{employeeRow.totalHours || 0}</strong>
              </div>

              <div className="mini-day neutral">
                <UserRound size={20} />
                <span>Absent</span>
                <strong>{employeeRow.absentCount || 0}</strong>
              </div>

              <div className="mini-day neutral">
                <CalendarDays size={20} />
                <span>Single Punch</span>
                <strong>{employeeRow.singlePunchCount || 0}</strong>
              </div>

              <div className="mini-day neutral">
                <ShieldCheck size={20} />
                <span>Leave</span>
                <strong>{totalLeave}</strong>
              </div>
            </div>
          </section>

          <section className="attendance-mobile-list">
            {dailyItems.map(({ label, cell, key }) => (
              <article key={key} className={`attendance-mobile-card ${statusTone(cell)}`}>
                <div>
                  <strong>{label}</strong>
                  <p>{displayValue(cell)}</p>
                </div>

                {cell.overrideType ? <span className="soft-badge">Edited</span> : null}
              </article>
            ))}
          </section>

          <section className="card mobile-list-card">
            <div className="page-header compact">
              <div>
                <h2>Monthly Grid</h2>
                <p>Quick monthly overview</p>
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
                {dailyItems.map(({ label, cell, key }) => {
                  const dayNumber = String(label).split("-")[0];

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
                          fontWeight: 700,
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
                        {shortValue(cell)}
                      </strong>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="muted">Press Show to display the monthly grid.</p>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
