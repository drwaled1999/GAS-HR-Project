import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FileSpreadsheet,
  Grid3X3,
  ListChecks,
  Loader2,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { getEmployeeProjectMonthlyAttendance } from "../../services/api";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function statusTone(cell) {
  const value = String(cell?.value ?? "").trim().toUpperCase();

  if (value !== "" && !Number.isNaN(Number(cell?.value)) && Number(cell?.value) > 0) {
    return "present";
  }

  if (value === "A") return "absent";
  if (value === "SP" || cell?.type === "single") return "single";
  if (value === "SL") return "sick";
  if (value === "AL" || value === "V") return "annual";
  if (value === "PM") return "permission";
  if (value === "TK" || value === "TA") return "takleef";
  if (value === "OFF" || value === "W" || cell?.type === "weekend") return "weekend";

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

function StatCard({ icon: Icon, label, value, hint, tone = "blue" }) {
  return (
    <div className={`epa-stat-card epa-${tone}`}>
      <div className="epa-stat-icon">
        <Icon size={21} />
      </div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        {hint ? <p>{hint}</p> : null}
      </div>
    </div>
  );
}

export default function EmployeeProjectAttendancePage() {
  const now = new Date();

  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [projects, setProjects] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [viewMode, setViewMode] = useState("timeline");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const currentYear = new Date().getFullYear();

  const yearOptions = Array.from(
    { length: 7 },
    (_, index) => currentYear - 3 + index
  );

  async function loadProjectAttendance() {
    try {
      setLoading(true);
      setError("");

      const response = await getEmployeeProjectMonthlyAttendance({ month, year });
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
    <div className="epa-page">
      <style>{`
        .epa-page {
          padding: 18px;
          padding-bottom: 110px;
          min-height: 100%;
        }

        .epa-spin {
          animation: epaSpin 0.8s linear infinite;
        }

        @keyframes epaSpin {
          to {
            transform: rotate(360deg);
          }
        }

        .epa-hero {
          position: relative;
          overflow: hidden;
          border-radius: 32px;
          padding: 26px;
          color: #fff;
          background:
            radial-gradient(circle at top right, rgba(56,189,248,.45), transparent 32%),
            linear-gradient(135deg, #0f172a, #1d4ed8 55%, #2563eb);
          box-shadow: 0 28px 70px rgba(15,23,42,.28);
        }

        .epa-hero:before {
          content: "";
          position: absolute;
          inset: auto -60px -100px auto;
          width: 240px;
          height: 240px;
          border-radius: 999px;
          background: rgba(255,255,255,.12);
        }

        .epa-hero-top {
          position: relative;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 18px;
        }

        .epa-brand {
          display: flex;
          align-items: center;
          gap: 15px;
        }

        .epa-logo {
          width: 62px;
          height: 62px;
          border-radius: 22px;
          display: grid;
          place-items: center;
          background: rgba(255,255,255,.16);
          border: 1px solid rgba(255,255,255,.24);
          box-shadow: inset 0 1px 0 rgba(255,255,255,.2);
        }

        .epa-brand h1 {
          margin: 0;
          font-size: clamp(1.55rem, 4vw, 2.45rem);
          line-height: 1.05;
          letter-spacing: -.04em;
        }

        .epa-brand p {
          margin: 8px 0 0;
          color: rgba(255,255,255,.78);
          font-weight: 700;
        }

        .epa-approved {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          border-radius: 999px;
          background: rgba(34,197,94,.16);
          border: 1px solid rgba(134,239,172,.35);
          color: #dcfce7;
          font-weight: 900;
          white-space: nowrap;
        }

        .epa-filters {
          position: relative;
          margin-top: 24px;
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }

        .epa-field {
          display: grid;
          gap: 7px;
        }

        .epa-field span {
          font-size: .75rem;
          font-weight: 900;
          color: rgba(255,255,255,.78);
          text-transform: uppercase;
          letter-spacing: .08em;
        }

        .epa-field input,
        .epa-field select {
          width: 100%;
          min-height: 52px;
          border-radius: 18px;
          border: 1px solid rgba(255,255,255,.22);
          background: rgba(255,255,255,.15);
          color: #fff;
          padding: 0 14px;
          font-size: 1rem;
          font-weight: 900;
          outline: none;
          backdrop-filter: blur(10px);
        }

        .epa-field select {
          appearance: none;
          -webkit-appearance: none;
          cursor: pointer;
          background:
            rgba(255,255,255,.15)
            url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' fill='white' viewBox='0 0 24 24'%3E%3Cpath d='M7 10l5 5 5-5z'/%3E%3C/svg%3E")
            no-repeat right 14px center;
          padding-right: 45px;
        }

        .epa-field select option {
          color: #0f172a;
          font-weight: 800;
        }

        .epa-card {
          margin-top: 18px;
          border-radius: 28px;
          background: rgba(255,255,255,.92);
          border: 1px solid rgba(226,232,240,.88);
          box-shadow: 0 18px 45px rgba(15,23,42,.08);
          padding: 20px;
        }

        .epa-profile {
          display: flex;
          justify-content: space-between;
          gap: 18px;
          align-items: center;
        }

        .epa-profile-main {
          display: flex;
          gap: 14px;
          align-items: center;
        }

        .epa-avatar {
          width: 58px;
          height: 58px;
          border-radius: 22px;
          display: grid;
          place-items: center;
          background: linear-gradient(135deg, #eff6ff, #dbeafe);
          color: #1d4ed8;
        }

        .epa-profile h2 {
          margin: 0;
          font-size: 1.25rem;
          color: #0f172a;
        }

        .epa-profile p {
          margin: 6px 0 0;
          color: #64748b;
          font-weight: 800;
        }

        .epa-switch {
          display: inline-flex;
          gap: 6px;
          padding: 6px;
          border-radius: 18px;
          background: #f1f5f9;
        }

        .epa-switch button {
          border: 0;
          border-radius: 14px;
          padding: 10px 13px;
          background: transparent;
          color: #64748b;
          font-weight: 950;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 7px;
        }

        .epa-switch button.active {
          background: #fff;
          color: #1d4ed8;
          box-shadow: 0 10px 24px rgba(15,23,42,.10);
        }

        .epa-stats {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
          margin-top: 18px;
        }

        .epa-stat-card {
          border-radius: 24px;
          padding: 18px;
          display: flex;
          gap: 14px;
          align-items: flex-start;
          border: 1px solid rgba(226,232,240,.9);
          background: #fff;
        }

        .epa-stat-icon {
          width: 44px;
          height: 44px;
          border-radius: 16px;
          display: grid;
          place-items: center;
          flex: 0 0 auto;
        }

        .epa-stat-card span {
          display: block;
          color: #64748b;
          font-size: .78rem;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .05em;
        }

        .epa-stat-card strong {
          display: block;
          margin-top: 6px;
          font-size: 1.7rem;
          color: #0f172a;
          letter-spacing: -.04em;
        }

        .epa-stat-card p {
          margin: 3px 0 0;
          color: #94a3b8;
          font-size: .82rem;
          font-weight: 700;
        }

        .epa-blue .epa-stat-icon { background: #dbeafe; color: #1d4ed8; }
        .epa-red .epa-stat-icon { background: #fee2e2; color: #dc2626; }
        .epa-orange .epa-stat-icon { background: #ffedd5; color: #ea580c; }
        .epa-green .epa-stat-icon { background: #dcfce7; color: #16a34a; }

        .epa-section-title {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 14px;
        }

        .epa-section-title h3 {
          margin: 0;
          color: #0f172a;
          font-size: 1.12rem;
        }

        .epa-section-title p {
          margin: 4px 0 0;
          color: #64748b;
          font-weight: 700;
        }

        .epa-timeline {
          display: grid;
          gap: 10px;
        }

        .epa-day-row {
          display: grid;
          grid-template-columns: 82px 1fr auto;
          gap: 12px;
          align-items: center;
          padding: 14px;
          border-radius: 20px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
        }

        .epa-day-date {
          font-weight: 950;
          color: #0f172a;
        }

        .epa-pill {
          justify-self: start;
          padding: 8px 12px;
          border-radius: 999px;
          font-weight: 950;
          font-size: .78rem;
        }

        .epa-cell-present .epa-pill { background: #dcfce7; color: #166534; }
        .epa-cell-absent .epa-pill { background: #fee2e2; color: #991b1b; }
        .epa-cell-single .epa-pill { background: #ffedd5; color: #9a3412; }
        .epa-cell-annual .epa-pill,
        .epa-cell-sick .epa-pill { background: #dbeafe; color: #1e40af; }
        .epa-cell-permission .epa-pill { background: #fef9c3; color: #854d0e; }
        .epa-cell-takleef .epa-pill { background: #f3e8ff; color: #6b21a8; }
        .epa-cell-weekend .epa-pill { background: #e2e8f0; color: #475569; }
        .epa-cell-neutral .epa-pill { background: #f1f5f9; color: #64748b; }

        .epa-edited {
          color: #2563eb;
          font-weight: 900;
          font-size: .75rem;
        }

        .epa-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(82px, 1fr));
          gap: 12px;
        }

        .epa-grid-day {
          min-height: 86px;
          border-radius: 22px;
          display: grid;
          place-items: center;
          text-align: center;
          padding: 10px;
          border: 1px solid #e2e8f0;
          background: #f8fafc;
        }

        .epa-grid-day span {
          font-weight: 900;
          color: #64748b;
          font-size: .78rem;
        }

        .epa-grid-day strong {
          margin-top: 8px;
          display: block;
          font-size: 1.25rem;
          color: #0f172a;
        }

        .epa-cell-present { background: #f0fdf4; border-color: #bbf7d0; }
        .epa-cell-absent { background: #fef2f2; border-color: #fecaca; }
        .epa-cell-single { background: #fff7ed; border-color: #fed7aa; }
        .epa-cell-annual,
        .epa-cell-sick { background: #eff6ff; border-color: #bfdbfe; }
        .epa-cell-permission { background: #fefce8; border-color: #fde68a; }
        .epa-cell-takleef { background: #faf5ff; border-color: #e9d5ff; }
        .epa-cell-weekend { background: #f1f5f9; border-color: #cbd5e1; }
        .epa-cell-neutral { background: #f8fafc; border-color: #e2e8f0; }

        .epa-empty {
          text-align: center;
          padding: 34px 18px;
        }

        .epa-empty-icon {
          width: 68px;
          height: 68px;
          border-radius: 24px;
          display: grid;
          place-items: center;
          margin: 0 auto 14px;
          background: #f1f5f9;
          color: #64748b;
        }

        .epa-empty h2 {
          margin: 0;
          color: #0f172a;
        }

        .epa-empty p {
          margin: 8px 0 0;
          color: #64748b;
          font-weight: 700;
        }

        .epa-refresh-btn {
          margin-top: 18px;
          border: 0;
          border-radius: 999px;
          padding: 12px 18px;
          background: linear-gradient(135deg, #2563eb, #1d4ed8);
          color: #fff;
          font-weight: 900;
          cursor: pointer;
          box-shadow: 0 14px 28px rgba(37,99,235,.25);
        }

        .epa-error {
          margin-top: 18px;
          padding: 14px 16px;
          border-radius: 18px;
          background: #fef2f2;
          color: #991b1b;
          border: 1px solid #fecaca;
          font-weight: 900;
        }

        html.dark .epa-card,
        html.dark .epa-stat-card {
          background: rgba(17,26,45,.92);
          border-color: #24324d;
        }

        html.dark .epa-profile h2,
        html.dark .epa-section-title h3,
        html.dark .epa-stat-card strong,
        html.dark .epa-empty h2,
        html.dark .epa-day-date,
        html.dark .epa-grid-day strong {
          color: #f8fafc;
        }

        html.dark .epa-profile p,
        html.dark .epa-section-title p,
        html.dark .epa-stat-card span,
        html.dark .epa-stat-card p,
        html.dark .epa-empty p {
          color: #9fb0cf;
        }

        html.dark .epa-switch {
          background: #0f172a;
        }

        html.dark .epa-switch button.active {
          background: #1e293b;
          color: #93c5fd;
        }

        html.dark .epa-day-row,
        html.dark .epa-grid-day {
          background: #0f172a;
          border-color: #24324d;
        }

        @media (max-width: 820px) {
          .epa-page {
            padding: 12px;
            padding-bottom: 110px;
          }

          .epa-hero {
            padding: 20px;
            border-radius: 26px;
          }

          .epa-hero-top {
            flex-direction: column;
          }

          .epa-approved {
            align-self: flex-start;
          }

          .epa-filters {
            grid-template-columns: 1fr 1fr;
          }

          .epa-filters .epa-field:last-child {
            grid-column: 1 / -1;
          }

          .epa-profile {
            align-items: flex-start;
            flex-direction: column;
          }

          .epa-stats {
            grid-template-columns: 1fr 1fr;
          }

          .epa-day-row {
            grid-template-columns: 68px 1fr;
          }

          .epa-edited {
            grid-column: 2;
          }
        }

        @media (max-width: 460px) {
          .epa-stats {
            grid-template-columns: 1fr;
          }

          .epa-brand {
            align-items: flex-start;
          }

          .epa-logo {
            width: 54px;
            height: 54px;
            border-radius: 18px;
          }
        }
      `}</style>

      <section className="epa-hero">
        <div className="epa-hero-top">
          <div className="epa-brand">
            <div className="epa-logo">
              <FileSpreadsheet size={28} />
            </div>
            <div>
              <h1>My Project Attendance</h1>
              <p>
                {MONTHS[month - 1]} {year} • Project-based attendance record
              </p>
            </div>
          </div>

          <div className="epa-approved">
            <CheckCircle2 size={18} />
            Approved View
          </div>
        </div>

        <div className="epa-filters">
          <label className="epa-field">
            <span>📅 Month</span>
            <select
              value={month}
              onChange={(event) => setMonth(Number(event.target.value))}
            >
              {MONTHS.map((name, index) => (
                <option key={name} value={index + 1}>
                  {name}
                </option>
              ))}
            </select>
          </label>

          <label className="epa-field">
            <span>🗓️ Year</span>
            <select
              value={year}
              onChange={(event) => setYear(Number(event.target.value))}
            >
              {yearOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label className="epa-field">
            <span>Project</span>
            <select
              value={selectedIndex}
              onChange={(event) => setSelectedIndex(Number(event.target.value))}
              disabled={!projects.length}
            >
              {projects.length ? (
                projects.map((item, index) => (
                  <option key={item?.batch?.id || index} value={index}>
                    {item?.batch?.project_name || item?.batch?.project_key || "Project"}
                  </option>
                ))
              ) : (
                <option>No project</option>
              )}
            </select>
          </label>
        </div>
      </section>

      {loading ? (
        <section className="epa-card epa-empty">
          <div className="epa-empty-icon">
            <Loader2 size={30} className="epa-spin" />
          </div>
          <h2>Loading attendance...</h2>
          <p>Please wait while we prepare your monthly record.</p>
        </section>
      ) : null}

      {error ? <div className="epa-error">{error}</div> : null}

      {!loading && !employeeRow ? (
        <section className="epa-card epa-empty">
          <div className="epa-empty-icon">
            <ShieldCheck size={30} />
          </div>
          <h2>No Approved Project Attendance</h2>
          <p>No approved project attendance sheet was found for this employee in the selected month.</p>

          <button
            type="button"
            className="epa-refresh-btn"
            onClick={() => {
              const current = new Date();
              setMonth(current.getMonth() + 1);
              setYear(current.getFullYear());
            }}
          >
            Show Current Month
          </button>
        </section>
      ) : null}

      {employeeRow ? (
        <>
          <section className="epa-card">
            <div className="epa-profile">
              <div className="epa-profile-main">
                <div className="epa-avatar">
                  <UserRound size={28} />
                </div>
                <div>
                  <h2>{employeeRow.name || "Employee"}</h2>
                  <p>
                    GAS ID: {employeeRow.userId || "-"} • Project:{" "}
                    {batch?.project_name || batch?.project_key || "-"}
                  </p>
                </div>
              </div>

              <div className="epa-switch">
                <button
                  type="button"
                  className={viewMode === "timeline" ? "active" : ""}
                  onClick={() => setViewMode("timeline")}
                >
                  <ListChecks size={16} />
                  Timeline
                </button>

                <button
                  type="button"
                  className={viewMode === "grid" ? "active" : ""}
                  onClick={() => setViewMode("grid")}
                >
                  <Grid3X3 size={16} />
                  Grid
                </button>
              </div>
            </div>

            <div className="epa-stats">
              <StatCard
                icon={Clock3}
                label="Total Hours"
                value={employeeRow.totalHours || 0}
                hint="Approved monthly total"
                tone="blue"
              />

              <StatCard
                icon={AlertTriangle}
                label="Absent"
                value={employeeRow.absentCount || 0}
                hint="Absent days"
                tone="red"
              />

              <StatCard
                icon={CalendarDays}
                label="Single Punch"
                value={employeeRow.singlePunchCount || 0}
                hint="Missing in/out"
                tone="orange"
              />

              <StatCard
                icon={BriefcaseBusiness}
                label="Leave"
                value={totalLeave}
                hint="AL / SL / Emergency"
                tone="green"
              />
            </div>
          </section>

          <section className="epa-card">
            <div className="epa-section-title">
              <div>
                <h3>{viewMode === "timeline" ? "Daily Timeline" : "Monthly Grid"}</h3>
                <p>
                  {MONTHS[month - 1]} {year} attendance breakdown
                </p>
              </div>

              <ChevronDown size={20} />
            </div>

            {viewMode === "timeline" ? (
              <div className="epa-timeline">
                {dailyItems.map(({ label, cell, key }) => {
                  const tone = statusTone(cell);

                  return (
                    <article key={key} className={`epa-day-row epa-cell-${tone}`}>
                      <div className="epa-day-date">{label}</div>
                      <div className="epa-pill">{displayValue(cell)}</div>
                      {cell.overrideType ? <div className="epa-edited">Edited</div> : null}
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="epa-grid">
                {dailyItems.map(({ label, cell, key }) => {
                  const tone = statusTone(cell);
                  const dayNumber = String(label).split("-")[0];

                  return (
                    <div key={key} className={`epa-grid-day epa-cell-${tone}`}>
                      <div>
                        <span>Day {dayNumber}</span>
                        <strong>{shortValue(cell)}</strong>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
