import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Clock3,
  FileText,
  CheckCircle2,
  CircleX,
  AlertTriangle,
  Briefcase,
  Umbrella,
  RefreshCw,
} from "lucide-react";
import { API_BASE } from "../services/api";

function getToken() {
  return (
    localStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    localStorage.getItem("accessToken") ||
    ""
  );
}

function getCellTone(value) {
  const safe = String(value || "").trim().toUpperCase();

  if (safe === "A") return "absent";
  if (safe === "OFF" || safe === "W") return "weekend";
  if (safe === "SP") return "single";
  if (["AL", "SL", "EL", "V", "UL"].includes(safe)) return "leave";
  if (["PM", "P"].includes(safe)) return "permission";
  if (["TK", "BT", "TA"].includes(safe)) return "task";
  if (!Number.isNaN(Number(safe)) && safe !== "") return "hours";

  return "default";
}

function getCellLabel(value) {
  const safe = String(value || "").trim().toUpperCase();

  if (safe === "A") return "Absent";
  if (safe === "OFF" || safe === "W") return "Weekend";
  if (safe === "SP") return "Single Punch";
  if (safe === "AL" || safe === "V") return "Annual Leave";
  if (safe === "SL") return "Sick Leave";
  if (safe === "EL") return "Emergency Leave";
  if (safe === "UL") return "Unpaid Leave";
  if (["PM", "P"].includes(safe)) return "Permission";
  if (["TK", "BT", "TA"].includes(safe)) return "Task";
  if (!Number.isNaN(Number(safe)) && safe !== "") return `${safe} Hours`;

  return safe || "-";
}

function formatMonthTitle(month, year) {
  const d = new Date(Number(year), Number(month) - 1, 1);
  return d.toLocaleString("en-US", { month: "long", year: "numeric" });
}

function StatCard({ icon: Icon, label, value, tone = "default" }) {
  return (
    <article className={`ma-stat-card ${tone}`}>
      <div className="ma-stat-icon">
        <Icon size={20} />
      </div>
      <div>
        <span>{label}</span>
        <strong>{value ?? 0}</strong>
      </div>
    </article>
  );
}

export default function MyAttendancePage() {
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());

  const [data, setData] = useState({
    days: [],
    rows: [],
    monthTitle: "Attendance",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadMyAttendance() {
    try {
      setLoading(true);
      setError("");

      const token = getToken();

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
        throw new Error(`Expected JSON but received: ${text.slice(0, 120)}`);
      }

      const result = await res.json();
      setData(
        result?.data || {
          days: [],
          rows: [],
          monthTitle: "Attendance",
        }
      );
    } catch (err) {
      console.error("Failed to load attendance", err);
      setData({ days: [], rows: [], monthTitle: "Attendance" });
      setError(err.message || "Failed to load attendance");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMyAttendance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const row = data?.rows?.[0] || null;
  const days = Array.isArray(data?.days) ? data.days : [];
  const cells = Array.isArray(row?.cells) ? row.cells : [];

  const pageMonthTitle = useMemo(() => {
    if (data?.monthTitle && data.monthTitle !== "Attendance") {
      return data.monthTitle;
    }
    return formatMonthTitle(month, year);
  }, [data?.monthTitle, month, year]);

  const calendarItems = useMemo(() => {
    return days.map((day, index) => {
      const cell = cells[index] || {};
      return {
        ...day,
        value: cell?.value ?? "-",
        tone: getCellTone(cell?.value),
        note: getCellLabel(cell?.value),
      };
    });
  }, [days, cells]);

  const leaveTotal =
    Number(row?.annualLeaveCount || 0) +
    Number(row?.sickLeaveCount || 0) +
    Number(row?.emergencyLeaveCount || 0);

  return (
    <div className="my-attendance-pro">
      <style>{styles}</style>

      <section className="ma-hero">
        <div className="ma-hero-main">
          <div className="ma-badge">
            <CalendarDays size={15} />
            Personal Attendance
          </div>

          <h1>My Attendance</h1>
          <p>
            Review your monthly attendance, daily status, leave codes, single
            punch records, and total working hours in one clean view.
          </p>

          <div className="ma-employee">
            {row?.name || "Employee Attendance"}
          </div>

          <div className="ma-hero-stats">
            <StatCard
              icon={Clock3}
              label="Total Hours"
              value={row?.totalHours || 0}
              tone="hours"
            />
            <StatCard
              icon={CircleX}
              label="Absent"
              value={row?.absentCount || 0}
              tone="absent"
            />
            <StatCard
              icon={AlertTriangle}
              label="Single Punch"
              value={row?.singlePunchCount || 0}
              tone="single"
            />
            <StatCard
              icon={Umbrella}
              label="Leaves"
              value={leaveTotal}
              tone="leave"
            />
          </div>
        </div>

        <aside className="ma-side">
          <div className="ma-side-title">
            <CalendarDays size={18} />
            Monthly Snapshot
          </div>

          <div className="ma-side-list">
            <div className="ma-side-row">
              <span>Selected Month</span>
              <strong>{pageMonthTitle}</strong>
            </div>
            <div className="ma-side-row">
              <span>Days Loaded</span>
              <strong>{days.length}</strong>
            </div>
            <div className="ma-side-row">
              <span>Annual Leave</span>
              <strong>{row?.annualLeaveCount || 0}</strong>
            </div>
            <div className="ma-side-row">
              <span>Sick Leave</span>
              <strong>{row?.sickLeaveCount || 0}</strong>
            </div>
            <div className="ma-side-row">
              <span>Emergency Leave</span>
              <strong>{row?.emergencyLeaveCount || 0}</strong>
            </div>
            <div className="ma-side-row">
              <span>Permission / Task</span>
              <strong>
                {Number(row?.permissionCount || 0) +
                  Number(row?.takleefCount || 0)}
              </strong>
            </div>
          </div>
        </aside>
      </section>

      <section className="ma-controls-card">
        <div className="ma-card-head">
          <div>
            <h2>Attendance Filters</h2>
            <p>Select month and year to load your attendance sheet.</p>
          </div>
        </div>

        <div className="ma-filter-grid">
          <label>
            <span>Month</span>
            <input
              type="number"
              min="1"
              max="12"
              value={month}
              onChange={(e) =>
                setMonth(Number(e.target.value) || today.getMonth() + 1)
              }
            />
          </label>

          <label>
            <span>Year</span>
            <input
              type="number"
              value={year}
              onChange={(e) =>
                setYear(Number(e.target.value) || today.getFullYear())
              }
            />
          </label>

          <button
            type="button"
            className="ma-load-btn"
            onClick={loadMyAttendance}
            disabled={loading}
          >
            <RefreshCw size={17} className={loading ? "spin-icon" : ""} />
            {loading ? "Loading..." : "Load Attendance"}
          </button>
        </div>

        {error ? <div className="ma-error">{error}</div> : null}
      </section>

      <section className="ma-calendar-card">
        <div className="ma-card-head">
          <div>
            <h2>Attendance Calendar</h2>
            <p>Daily status in a responsive calendar layout.</p>
          </div>
        </div>

        {!loading && !row ? (
          <div className="ma-empty">
            <FileText size={22} />
            <strong>No attendance data found</strong>
            <span>No attendance data found for this month.</span>
          </div>
        ) : (
          <>
            <div className="ma-calendar-grid">
              {calendarItems.map((item, index) => (
                <article
                  key={item.key || `${item.label}-${index}`}
                  className={`ma-day-card tone-${item.tone}`}
                >
                  <div className="ma-day-top">
                    <strong>{item.label}</strong>
                    {item.weekend ? <span>OFF</span> : null}
                  </div>

                  <div className="ma-day-status">
                    <b>{item.value}</b>
                  </div>

                  <p>{item.note}</p>
                </article>
              ))}
            </div>

            <div className="ma-legend">
              <span>
                <i className="dot hours" />
                Hours
              </span>
              <span>
                <i className="dot absent" />
                Absent
              </span>
              <span>
                <i className="dot single" />
                Single Punch
              </span>
              <span>
                <i className="dot leave" />
                Leave
              </span>
              <span>
                <i className="dot weekend" />
                Weekend
              </span>
              <span>
                <i className="dot task" />
                Task
              </span>
            </div>
          </>
        )}
      </section>

      <section className="ma-summary-card">
        <div className="ma-card-head">
          <div>
            <h2>Attendance Summary</h2>
            <p>Quick counts for the selected month.</p>
          </div>
        </div>

        <div className="ma-summary-grid">
          <StatCard
            icon={CheckCircle2}
            label="Annual Leave"
            value={row?.annualLeaveCount || 0}
            tone="leave"
          />
          <StatCard
            icon={Briefcase}
            label="Task / Business"
            value={row?.takleefCount || 0}
            tone="task"
          />
          <StatCard
            icon={Clock3}
            label="Permission"
            value={row?.permissionCount || 0}
            tone="permission"
          />
          <StatCard
            icon={AlertTriangle}
            label="Single Punch"
            value={row?.singlePunchCount || 0}
            tone="single"
          />
        </div>
      </section>
    </div>
  );
}

const styles = `
  .my-attendance-pro {
    display: grid;
    gap: 20px;
    width: 100%;
  }

  .my-attendance-pro * {
    box-sizing: border-box;
  }

  .ma-hero {
    display: grid;
    grid-template-columns: minmax(0, 1.55fr) minmax(320px, 0.9fr);
    gap: 18px;
  }

  .ma-hero-main,
  .ma-side,
  .ma-controls-card,
  .ma-calendar-card,
  .ma-summary-card {
    border-radius: 30px;
    border: 1px solid rgba(226, 232, 240, 0.95);
    background: rgba(255, 255, 255, 0.96);
    box-shadow: 0 16px 42px rgba(15, 23, 42, 0.07);
    backdrop-filter: blur(12px);
    min-width: 0;
  }

  .ma-hero-main {
    position: relative;
    overflow: hidden;
    padding: 30px;
    color: #fff;
    border: none;
    background:
      radial-gradient(circle at top right, rgba(56,189,248,.35), transparent 34%),
      radial-gradient(circle at bottom left, rgba(37,99,235,.28), transparent 36%),
      linear-gradient(135deg, #020617 0%, #0f172a 48%, #1e3a8a 100%);
  }

  .ma-hero-main::after {
    content: "";
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(rgba(255,255,255,.045) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,.045) 1px, transparent 1px);
    background-size: 48px 48px;
    opacity: .6;
    pointer-events: none;
  }

  .ma-hero-main > * {
    position: relative;
    z-index: 2;
  }

  .ma-badge {
    width: fit-content;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 9px 14px;
    border-radius: 999px;
    background: rgba(255,255,255,.13);
    border: 1px solid rgba(255,255,255,.14);
    color: #dbeafe;
    font-size: .82rem;
    font-weight: 950;
    margin-bottom: 14px;
  }

  .ma-hero-main h1 {
    margin: 0;
    color: #fff;
    font-size: 2.55rem;
    font-weight: 950;
    letter-spacing: -.05em;
  }

  .ma-hero-main p {
    margin: 12px 0 0;
    max-width: 760px;
    color: rgba(255,255,255,.82);
    line-height: 1.75;
    font-size: 1rem;
  }

  .ma-employee {
    width: fit-content;
    margin-top: 18px;
    padding: 10px 14px;
    border-radius: 16px;
    background: rgba(255,255,255,.12);
    border: 1px solid rgba(255,255,255,.14);
    color: #fff;
    font-weight: 950;
  }

  .ma-hero-stats,
  .ma-summary-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 14px;
    margin-top: 22px;
  }

  .ma-stat-card {
    display: flex;
    align-items: center;
    gap: 13px;
    min-width: 0;
    border-radius: 22px;
    padding: 16px;
    background: #f8fafc;
    border: 1px solid #e8edf4;
  }

  .ma-hero-main .ma-stat-card {
    background: rgba(255,255,255,.12);
    border-color: rgba(255,255,255,.14);
  }

  .ma-stat-icon {
    width: 42px;
    height: 42px;
    flex: 0 0 auto;
    border-radius: 15px;
    display: grid;
    place-items: center;
    color: #1d4ed8;
    background: #eff6ff;
  }

  .ma-hero-main .ma-stat-icon {
    color: #fff;
    background: linear-gradient(135deg, #2563eb, #0ea5e9);
  }

  .ma-stat-card span {
    display: block;
    color: #64748b;
    font-size: .78rem;
    font-weight: 850;
    margin-bottom: 5px;
  }

  .ma-hero-main .ma-stat-card span {
    color: rgba(255,255,255,.75);
  }

  .ma-stat-card strong {
    display: block;
    color: #0f172a;
    font-size: 1.35rem;
    font-weight: 950;
    line-height: 1;
  }

  .ma-hero-main .ma-stat-card strong {
    color: #fff;
  }

  .ma-side {
    padding: 24px;
    display: grid;
    gap: 16px;
    align-content: start;
  }

  .ma-side-title {
    display: flex;
    align-items: center;
    gap: 10px;
    color: #0f172a;
    font-size: 1.05rem;
    font-weight: 950;
  }

  .ma-side-list {
    display: grid;
    gap: 11px;
  }

  .ma-side-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    padding: 14px 15px;
    border-radius: 17px;
    background: #f8fafc;
    border: 1px solid #edf2f7;
  }

  .ma-side-row span {
    color: #64748b;
    font-size: .86rem;
    font-weight: 850;
  }

  .ma-side-row strong {
    color: #0f172a;
    font-size: .98rem;
    font-weight: 950;
    text-align: right;
    word-break: break-word;
  }

  .ma-controls-card,
  .ma-calendar-card,
  .ma-summary-card {
    padding: 24px;
  }

  .ma-card-head {
    display: flex;
    justify-content: space-between;
    gap: 14px;
    flex-wrap: wrap;
    margin-bottom: 18px;
  }

  .ma-card-head h2 {
    margin: 0 0 6px;
    color: #0f172a;
    font-size: 1.25rem;
    font-weight: 950;
  }

  .ma-card-head p {
    margin: 0;
    color: #64748b;
    font-size: .92rem;
    font-weight: 750;
  }

  .ma-filter-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr)) auto;
    gap: 14px;
    align-items: end;
  }

  .ma-filter-grid label {
    display: grid;
    gap: 8px;
  }

  .ma-filter-grid label span {
    color: #334155;
    font-size: .88rem;
    font-weight: 900;
  }

  .ma-filter-grid input {
    min-height: 50px;
    border: 1px solid #dbe2ea;
    border-radius: 16px;
    padding: 0 14px;
    background: #fff;
    color: #0f172a;
    font-size: .95rem;
    width: 100%;
  }

  .ma-filter-grid input:focus {
    outline: none;
    border-color: #2563eb;
    box-shadow: 0 0 0 4px rgba(37,99,235,.08);
  }

  .ma-load-btn {
    min-height: 50px;
    border: none;
    border-radius: 16px;
    padding: 0 18px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 9px;
    color: #fff;
    background: linear-gradient(135deg, #2563eb, #1d4ed8);
    box-shadow: 0 13px 28px rgba(37,99,235,.22);
    font-weight: 950;
    cursor: pointer;
    white-space: nowrap;
  }

  .ma-load-btn:disabled {
    opacity: .7;
    cursor: not-allowed;
  }

  .spin-icon {
    animation: maSpin 1s linear infinite;
  }

  @keyframes maSpin {
    to { transform: rotate(360deg); }
  }

  .ma-error {
    margin-top: 14px;
    border-radius: 16px;
    padding: 13px 15px;
    background: #fff1f2;
    border: 1px solid #fecdd3;
    color: #be123c;
    font-weight: 900;
  }

  .ma-empty {
    min-height: 220px;
    border-radius: 22px;
    border: 1px dashed #cbd5e1;
    background: #f8fafc;
    display: grid;
    place-items: center;
    align-content: center;
    gap: 8px;
    color: #64748b;
    text-align: center;
  }

  .ma-empty strong {
    color: #0f172a;
    font-size: 1rem;
    font-weight: 950;
  }

  .ma-calendar-grid {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 12px;
  }

  .ma-day-card {
    min-height: 122px;
    display: grid;
    align-content: space-between;
    gap: 10px;
    padding: 13px;
    border-radius: 22px;
    background: #fff;
    border: 1px solid #e5e7eb;
    box-shadow: 0 8px 22px rgba(15,23,42,.045);
  }

  .ma-day-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .ma-day-top strong {
    color: #0f172a;
    font-size: .9rem;
    font-weight: 950;
  }

  .ma-day-top span {
    min-height: 22px;
    padding: 0 8px;
    border-radius: 999px;
    background: #f1f5f9;
    color: #475569;
    font-size: .68rem;
    font-weight: 950;
  }

  .ma-day-status b {
    min-height: 42px;
    min-width: 52px;
    width: fit-content;
    padding: 0 12px;
    border-radius: 999px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: .92rem;
    font-weight: 950;
    background: #f1f5f9;
    color: #0f172a;
  }

  .ma-day-card p {
    margin: 0;
    color: #64748b;
    font-size: .76rem;
    font-weight: 800;
    line-height: 1.35;
  }

  .ma-day-card.tone-hours .ma-day-status b {
    background: #ecfdf3;
    color: #047857;
    border: 1px solid #a7f3d0;
  }

  .ma-day-card.tone-absent .ma-day-status b {
    background: #fff1f2;
    color: #be123c;
    border: 1px solid #fecdd3;
  }

  .ma-day-card.tone-single .ma-day-status b {
    background: #fff7ed;
    color: #c2410c;
    border: 1px solid #fed7aa;
  }

  .ma-day-card.tone-leave .ma-day-status b {
    background: #eff6ff;
    color: #1d4ed8;
    border: 1px solid #bfdbfe;
  }

  .ma-day-card.tone-weekend .ma-day-status b {
    background: #f8fafc;
    color: #475569;
    border: 1px solid #e2e8f0;
  }

  .ma-day-card.tone-permission .ma-day-status b {
    background: #fefce8;
    color: #a16207;
    border: 1px solid #fde68a;
  }

  .ma-day-card.tone-task .ma-day-status b {
    background: #f5f3ff;
    color: #6d28d9;
    border: 1px solid #ddd6fe;
  }

  .ma-legend {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    margin-top: 18px;
  }

  .ma-legend span {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 34px;
    padding: 0 11px;
    border-radius: 999px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    color: #334155;
    font-size: .8rem;
    font-weight: 900;
  }

  .dot {
    width: 11px;
    height: 11px;
    border-radius: 999px;
    display: inline-block;
  }

  .dot.hours { background: #10b981; }
  .dot.absent { background: #e11d48; }
  .dot.single { background: #f97316; }
  .dot.leave { background: #3b82f6; }
  .dot.weekend { background: #94a3b8; }
  .dot.task { background: #7c3aed; }

  html.dark .my-attendance-pro .ma-side,
  html.dark .my-attendance-pro .ma-controls-card,
  html.dark .my-attendance-pro .ma-calendar-card,
  html.dark .my-attendance-pro .ma-summary-card {
    background: #111a2d;
    border-color: #24324d;
  }

  html.dark .my-attendance-pro .ma-card-head h2,
  html.dark .my-attendance-pro .ma-side-title,
  html.dark .my-attendance-pro .ma-side-row strong,
  html.dark .my-attendance-pro .ma-stat-card strong,
  html.dark .my-attendance-pro .ma-day-top strong,
  html.dark .my-attendance-pro .ma-empty strong {
    color: #e5eefc;
  }

  html.dark .my-attendance-pro .ma-card-head p,
  html.dark .my-attendance-pro .ma-side-row span,
  html.dark .my-attendance-pro .ma-stat-card span,
  html.dark .my-attendance-pro .ma-day-card p {
    color: #9fb0cf;
  }

  html.dark .my-attendance-pro .ma-side-row,
  html.dark .my-attendance-pro .ma-stat-card,
  html.dark .my-attendance-pro .ma-day-card,
  html.dark .my-attendance-pro .ma-empty,
  html.dark .my-attendance-pro .ma-legend span {
    background: #0f1728;
    border-color: #24324d;
  }

  html.dark .my-attendance-pro .ma-filter-grid input {
    background: #0f1728;
    color: #e5eefc;
    border-color: #31415f;
  }

  @media (max-width: 1200px) {
    .ma-hero {
      grid-template-columns: 1fr;
    }

    .ma-hero-stats,
    .ma-summary-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .ma-calendar-grid {
      grid-template-columns: repeat(5, minmax(0, 1fr));
    }
  }

  @media (max-width: 768px) {
    .my-attendance-pro {
      gap: 14px;
    }

    .ma-hero-main,
    .ma-side,
    .ma-controls-card,
    .ma-calendar-card,
    .ma-summary-card {
      border-radius: 22px;
      padding: 16px;
    }

    .ma-hero-main h1 {
      font-size: 2rem;
    }

    .ma-hero-main p {
      font-size: .9rem;
    }

    .ma-hero-stats,
    .ma-summary-grid,
    .ma-filter-grid {
      grid-template-columns: 1fr;
    }

    .ma-load-btn {
      width: 100%;
    }

    .ma-calendar-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }

    .ma-day-card {
      min-height: 116px;
      padding: 11px;
      border-radius: 18px;
    }

    .ma-day-top strong {
      font-size: .84rem;
    }

    .ma-day-status b {
      min-height: 38px;
      min-width: 48px;
      font-size: .86rem;
    }

    .ma-legend {
      gap: 8px;
    }

    .ma-legend span {
      font-size: .72rem;
      padding: 0 9px;
    }
  }
`;
