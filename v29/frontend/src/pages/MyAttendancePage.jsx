import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Clock3, FileText, CheckCircle2, CircleX, AlertTriangle } from "lucide-react";
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
  if (["AL"].includes(safe)) return "Annual Leave";
  if (["SL"].includes(safe)) return "Sick Leave";
  if (["EL"].includes(safe)) return "Emergency Leave";
  if (["PM", "P"].includes(safe)) return "Permission";
  if (["TK", "BT", "TA"].includes(safe)) return "Task";
  if (!Number.isNaN(Number(safe)) && safe !== "") return `${safe} Hours`;

  return safe || "-";
}

function formatMonthTitle(month, year) {
  const d = new Date(Number(year), Number(month) - 1, 1);
  return d.toLocaleString("en-US", { month: "long", year: "numeric" });
}

export default function MyAttendancePage() {
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());

  const [data, setData] = useState({ days: [], rows: [], monthTitle: "Attendance" });
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
      setData(result?.data || { days: [], rows: [], monthTitle: "Attendance" });
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
  }, []);

  const row = data?.rows?.[0] || null;
  const days = Array.isArray(data?.days) ? data.days : [];
  const cells = Array.isArray(row?.cells) ? row.cells : [];

  const pageMonthTitle = useMemo(() => {
    if (data?.monthTitle && data.monthTitle !== "Attendance") return data.monthTitle;
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

  return (
    <div className="page-stack my-attendance-page">
      <style>{`
        .my-attendance-page {
          display: grid;
          gap: 20px;
          width: 100%;
          max-width: 100%;
        }

        .my-attendance-page .hero-shell {
          display: grid;
          grid-template-columns: minmax(0, 1.45fr) minmax(320px, 0.85fr);
          gap: 18px;
          width: 100%;
        }

        .my-attendance-page .hero-main,
        .my-attendance-page .hero-side,
        .my-attendance-page .control-card,
        .my-attendance-page .table-card {
          border-radius: 28px;
          border: 1px solid rgba(226, 232, 240, 0.95);
          background: rgba(255, 255, 255, 0.96);
          box-shadow: 0 16px 40px rgba(15, 23, 42, 0.06);
          backdrop-filter: blur(10px);
          min-width: 0;
        }

        .my-attendance-page .hero-main {
          padding: 28px;
          background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%);
          color: #fff;
          border: none;
        }

        .my-attendance-page .hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border-radius: 999px;
          padding: 8px 14px;
          font-size: 0.82rem;
          font-weight: 800;
          background: rgba(255, 255, 255, 0.14);
          color: #fff;
          margin-bottom: 14px;
        }

        .my-attendance-page .hero-main h2 {
          margin: 0 0 10px 0;
          font-size: 2.1rem;
          font-weight: 900;
          letter-spacing: -0.03em;
          color: #fff;
        }

        .my-attendance-page .hero-main p {
          margin: 0;
          max-width: 720px;
          color: rgba(255, 255, 255, 0.84);
          line-height: 1.7;
          font-size: 0.98rem;
        }

        .my-attendance-page .employee-name {
          margin-top: 16px;
          font-size: 1.18rem;
          font-weight: 900;
          color: #fff;
        }

        .my-attendance-page .hero-kpis {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
          margin-top: 20px;
        }

        .my-attendance-page .hero-kpi {
          border-radius: 20px;
          padding: 16px;
          background: rgba(255, 255, 255, 0.12);
          border: 1px solid rgba(255, 255, 255, 0.14);
          min-width: 0;
        }

        .my-attendance-page .hero-kpi .label {
          display: block;
          color: rgba(255, 255, 255, 0.78);
          font-size: 0.82rem;
          font-weight: 700;
          margin-bottom: 8px;
        }

        .my-attendance-page .hero-kpi .value {
          font-size: 1.5rem;
          font-weight: 900;
          color: #fff;
          line-height: 1;
        }

        .my-attendance-page .hero-side {
          padding: 24px;
          display: grid;
          gap: 14px;
          align-content: start;
        }

        .my-attendance-page .side-title {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 1rem;
          font-weight: 900;
          color: #0f172a;
        }

        .my-attendance-page .side-stat-list {
          display: grid;
          gap: 12px;
        }

        .my-attendance-page .side-stat {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          border-radius: 16px;
          padding: 14px 16px;
          background: #f8fafc;
          border: 1px solid #edf2f7;
          min-width: 0;
        }

        .my-attendance-page .side-stat span {
          color: #64748b;
          font-size: 0.9rem;
          font-weight: 700;
        }

        .my-attendance-page .side-stat strong {
          color: #0f172a;
          font-size: 1.02rem;
          font-weight: 900;
          text-align: right;
          word-break: break-word;
        }

        .my-attendance-page .control-card,
        .my-attendance-page .table-card {
          padding: 24px;
        }

        .my-attendance-page .card-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 14px;
          flex-wrap: wrap;
          margin-bottom: 18px;
        }

        .my-attendance-page .card-head h3 {
          margin: 0 0 6px 0;
          font-size: 1.2rem;
          font-weight: 900;
          color: #0f172a;
        }

        .my-attendance-page .card-head p {
          margin: 0;
          color: #64748b;
          font-size: 0.92rem;
        }

        .my-attendance-page .form-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .my-attendance-page .field {
          display: flex;
          flex-direction: column;
          gap: 8px;
          min-width: 0;
        }

        .my-attendance-page .field label {
          font-size: 0.88rem;
          font-weight: 800;
          color: #334155;
        }

        .my-attendance-page .field input {
          min-height: 50px;
          border-radius: 16px;
          border: 1px solid #dbe2ea;
          padding: 0 14px;
          background: #fff;
          color: #0f172a;
          font-size: 0.95rem;
          width: 100%;
        }

        .my-attendance-page .field input:focus {
          outline: none;
          border-color: #2563eb;
          box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.08);
        }

        .my-attendance-page .load-btn {
          min-height: 50px;
          border: none;
          border-radius: 16px;
          padding: 0 18px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-size: 0.96rem;
          font-weight: 900;
          cursor: pointer;
          background: linear-gradient(135deg, #2563eb, #1d4ed8);
          color: #fff;
          box-shadow: 0 12px 28px rgba(37, 99, 235, 0.22);
        }

        .my-attendance-page .load-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .my-attendance-page .alert {
          border-radius: 18px;
          padding: 14px 16px;
          font-weight: 800;
          font-size: 0.94rem;
          background: #fff1f2;
          color: #be123c;
          border: 1px solid #fecdd3;
        }

        .my-attendance-page .empty {
          text-align: center;
          padding: 40px 20px;
          border-radius: 20px;
          background: #f8fafc;
          border: 1px dashed #d9e2ea;
          color: #64748b;
          font-weight: 700;
        }

        .my-attendance-page .calendar-grid {
          display: grid;
          grid-template-columns: repeat(7, minmax(0, 1fr));
          gap: 12px;
        }

        .my-attendance-page .day-card {
          border-radius: 20px;
          border: 1px solid #e5e7eb;
          background: #fff;
          padding: 12px;
          min-height: 118px;
          display: grid;
          align-content: space-between;
          gap: 10px;
          box-shadow: 0 8px 20px rgba(15, 23, 42, 0.04);
        }

        .my-attendance-page .day-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }

        .my-attendance-page .day-label {
          font-size: 0.9rem;
          font-weight: 900;
          color: #0f172a;
        }

        .my-attendance-page .day-weekend {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 22px;
          padding: 0 8px;
          border-radius: 999px;
          background: #f1f5f9;
          color: #475569;
          font-size: 0.7rem;
          font-weight: 800;
        }

        .my-attendance-page .status-pill {
          min-height: 40px;
          min-width: 52px;
          padding: 0 12px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-weight: 900;
          font-size: 0.92rem;
          border: 1px solid transparent;
        }

        .my-attendance-page .tone-default {
          background: rgba(15, 23, 42, 0.05);
          color: #0f172a;
        }

        .my-attendance-page .tone-hours {
          background: #ecfdf3;
          color: #047857;
          border-color: #a7f3d0;
        }

        .my-attendance-page .tone-absent {
          background: #fff1f2;
          color: #be123c;
          border-color: #fecdd3;
        }

        .my-attendance-page .tone-weekend {
          background: #f8fafc;
          color: #475569;
          border-color: #e2e8f0;
        }

        .my-attendance-page .tone-single {
          background: #fff7ed;
          color: #c2410c;
          border-color: #fed7aa;
        }

        .my-attendance-page .tone-leave {
          background: #eff6ff;
          color: #1d4ed8;
          border-color: #bfdbfe;
        }

        .my-attendance-page .tone-permission {
          background: #fefce8;
          color: #a16207;
          border-color: #fde68a;
        }

        .my-attendance-page .tone-task {
          background: #f5f3ff;
          color: #6d28d9;
          border-color: #ddd6fe;
        }

        .my-attendance-page .day-note {
          font-size: 0.78rem;
          font-weight: 700;
          color: #64748b;
          line-height: 1.4;
        }

        .my-attendance-page .legend {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          margin-top: 16px;
        }

        .my-attendance-page .legend-item {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 10px;
          border-radius: 999px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          font-size: 0.82rem;
          font-weight: 800;
          color: #334155;
        }

        .my-attendance-page .legend-dot {
          width: 12px;
          height: 12px;
          border-radius: 999px;
          display: inline-block;
        }

        .my-attendance-page .dot-hours { background: #10b981; }
        .my-attendance-page .dot-absent { background: #e11d48; }
        .my-attendance-page .dot-weekend { background: #94a3b8; }
        .my-attendance-page .dot-leave { background: #3b82f6; }
        .my-attendance-page .dot-single { background: #f97316; }

        @media (max-width: 1200px) {
          .my-attendance-page .hero-shell {
            grid-template-columns: 1fr;
          }

          .my-attendance-page .hero-kpis {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .my-attendance-page .calendar-grid {
            grid-template-columns: repeat(5, minmax(0, 1fr));
          }
        }

        @media (max-width: 768px) {
          .my-attendance-page {
            gap: 14px;
          }

          .my-attendance-page .hero-main,
          .my-attendance-page .hero-side,
          .my-attendance-page .control-card,
          .my-attendance-page .table-card {
            border-radius: 20px;
            padding: 16px;
          }

          .my-attendance-page .hero-main h2 {
            font-size: 1.6rem;
          }

          .my-attendance-page .hero-kpis,
          .my-attendance-page .form-grid {
            grid-template-columns: 1fr;
          }

          .my-attendance-page .load-btn {
            width: 100%;
          }

          .my-attendance-page .calendar-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
          }

          .my-attendance-page .day-card {
            min-height: 112px;
            padding: 10px;
            border-radius: 18px;
          }

          .my-attendance-page .day-label {
            font-size: 0.84rem;
          }

          .my-attendance-page .status-pill {
            min-height: 36px;
            min-width: 48px;
            font-size: 0.86rem;
          }

          .my-attendance-page .day-note {
            font-size: 0.74rem;
          }

          .my-attendance-page .legend {
            gap: 8px;
          }

          .my-attendance-page .legend-item {
            font-size: 0.74rem;
            padding: 7px 9px;
          }
        }
      `}</style>

      <section className="hero-shell">
        <div className="hero-main">
          <div className="hero-badge">
            <CalendarDays size={14} />
            Personal Attendance Overview
          </div>

          <h2>My Attendance</h2>
          <p>
            Review your personal attendance, daily status, and attendance summary
            in a clean monthly calendar view.
          </p>

          <div className="employee-name">{row?.name || "Employee Attendance"}</div>

          <div className="hero-kpis">
            <div className="hero-kpi">
              <span className="label">Total Hours</span>
              <strong className="value">{row?.totalHours || 0}</strong>
            </div>
            <div className="hero-kpi">
              <span className="label">Absent</span>
              <strong className="value">{row?.absentCount || 0}</strong>
            </div>
            <div className="hero-kpi">
              <span className="label">Single Punch</span>
              <strong className="value">{row?.singlePunchCount || 0}</strong>
            </div>
            <div className="hero-kpi">
              <span className="label">Leaves</span>
              <strong className="value">
                {(row?.annualLeaveCount || 0) +
                  (row?.sickLeaveCount || 0) +
                  (row?.emergencyLeaveCount || 0)}
              </strong>
            </div>
          </div>
        </div>

        <div className="hero-side">
          <div className="side-title">
            <Clock3 size={16} />
            Monthly Snapshot
          </div>

          <div className="side-stat-list">
            <div className="side-stat">
              <span>Selected Month</span>
              <strong>{pageMonthTitle}</strong>
            </div>
            <div className="side-stat">
              <span>Days Loaded</span>
              <strong>{days.length}</strong>
            </div>
            <div className="side-stat">
              <span>Annual Leave</span>
              <strong>{row?.annualLeaveCount || 0}</strong>
            </div>
            <div className="side-stat">
              <span>Sick Leave</span>
              <strong>{row?.sickLeaveCount || 0}</strong>
            </div>
            <div className="side-stat">
              <span>Emergency Leave</span>
              <strong>{row?.emergencyLeaveCount || 0}</strong>
            </div>
            <div className="side-stat">
              <span>Permission / Task</span>
              <strong>{(row?.permissionCount || 0) + (row?.takleefCount || 0)}</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="control-card">
        <div className="card-head">
          <div>
            <h3>Attendance Filters</h3>
            <p>Select the month and year to load your attendance details.</p>
          </div>
        </div>

        <div className="form-grid">
          <div className="field">
            <label>Month</label>
            <input
              type="number"
              min="1"
              max="12"
              value={month}
              onChange={(e) => setMonth(Number(e.target.value) || today.getMonth() + 1)}
            />
          </div>

          <div className="field">
            <label>Year</label>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value) || today.getFullYear())}
            />
          </div>
        </div>

        <div style={{ marginTop: "16px" }}>
          <button className="load-btn" onClick={loadMyAttendance} disabled={loading}>
            {loading ? "Loading..." : "Load Attendance"}
          </button>
        </div>

        {error ? (
          <div className="alert" style={{ marginTop: "16px" }}>
            {error}
          </div>
        ) : null}
      </section>

      <section className="table-card">
        <div className="card-head">
          <div>
            <h3>Attendance Calendar</h3>
            <p>Your daily attendance in a mobile-friendly calendar layout.</p>
          </div>
        </div>

        {!loading && !row ? (
          <div className="empty">
            <FileText size={18} style={{ marginBottom: 8 }} />
            <div>No attendance data found for this month.</div>
          </div>
        ) : (
          <>
            <div className="calendar-grid">
              {calendarItems.map((item) => (
                <div key={item.key} className="day-card">
                  <div className="day-head">
                    <div className="day-label">{item.label}</div>
                    {item.weekend ? <span className="day-weekend">OFF</span> : null}
                  </div>

                  <div>
                    <span className={`status-pill tone-${item.tone}`}>
                      {item.value}
                    </span>
                  </div>

                  <div className="day-note">{item.note}</div>
                </div>
              ))}
            </div>

            <div className="legend">
              <span className="legend-item">
                <span className="legend-dot dot-hours" />
                Hours / Present
              </span>
              <span className="legend-item">
                <span className="legend-dot dot-absent" />
                Absent
              </span>
              <span className="legend-item">
                <span className="legend-dot dot-weekend" />
                OFF / Weekend
              </span>
              <span className="legend-item">
                <span className="legend-dot dot-leave" />
                Leave
              </span>
              <span className="legend-item">
                <span className="legend-dot dot-single" />
                Single Punch
              </span>
            </div>
          </>
        )}
      </section>

      <section className="control-card">
        <div className="card-head">
          <div>
            <h3>Attendance Summary</h3>
            <p>Quick summary of your current attendance counts.</p>
          </div>
        </div>

        <div className="hero-kpis" style={{ marginTop: 0 }}>
          <div className="hero-kpi" style={{ background: "#f8fafc", borderColor: "#e2e8f0" }}>
            <span className="label" style={{ color: "#64748b" }}>Absent</span>
            <strong className="value" style={{ color: "#0f172a" }}>{row?.absentCount || 0}</strong>
          </div>

          <div className="hero-kpi" style={{ background: "#f8fafc", borderColor: "#e2e8f0" }}>
            <span className="label" style={{ color: "#64748b" }}>Single Punch</span>
            <strong className="value" style={{ color: "#0f172a" }}>{row?.singlePunchCount || 0}</strong>
          </div>

          <div className="hero-kpi" style={{ background: "#f8fafc", borderColor: "#e2e8f0" }}>
            <span className="label" style={{ color: "#64748b" }}>Permission</span>
            <strong className="value" style={{ color: "#0f172a" }}>{row?.permissionCount || 0}</strong>
          </div>

          <div className="hero-kpi" style={{ background: "#f8fafc", borderColor: "#e2e8f0" }}>
            <span className="label" style={{ color: "#64748b" }}>Takleef</span>
            <strong className="value" style={{ color: "#0f172a" }}>{row?.takleefCount || 0}</strong>
          </div>
        </div>
      </section>
    </div>
  );
}
