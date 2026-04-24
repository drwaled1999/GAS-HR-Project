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

function ReportCard({ label, value, hint, tone = "blue" }) {
  return (
    <article className={`report-stat-card ${tone}`}>
      <span>{label}</span>
      <strong>{value ?? 0}</strong>
      <small>{hint}</small>
    </article>
  );
}

function StatusPill({ value }) {
  const status = String(value || "").toLowerCase();

  let cls = "neutral";
  if (status === "present" || status === "approved") cls = "success";
  if (status === "absent" || status === "rejected") cls = "danger";
  if (status === "single punch" || status === "pending") cls = "warning";

  return <span className={`report-pill ${cls}`}>{value || "-"}</span>;
}

function SimpleTable({ columns, rows, emptyText = "لا توجد بيانات." }) {
  return (
    <div className="report-table-wrap">
      <table className="report-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>{column.label}</th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.length ? (
            rows.map((row, index) => (
              <tr key={row.id || row.employeeId || `${index}-${row.date || ""}`}>
                {columns.map((column) => {
                  const value = row[column.key];

                  if (column.status) {
                    return (
                      <td key={column.key}>
                        <StatusPill value={value} />
                      </td>
                    );
                  }

                  return (
                    <td key={column.key}>
                      <span className="report-cell-text">
                        {String(value ?? "-")}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={columns.length} className="report-empty-cell">
                {emptyText}
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
  const [exportingType, setExportingType] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadReports() {
    if (!user?.username) return;

    try {
      setLoading(true);
      setError("");

      const response = await apiFetch(
        `/reports/summary?username=${encodeURIComponent(
          user.username
        )}&month=${month}&year=${year}&date=${date}`
      );

      setData(response);
    } catch (err) {
      console.error("Reports load error:", err);
      setError(err?.message || "Failed to load reports");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReports();
  }, [user?.username, month, year, date]);

  async function exportReport(type) {
    try {
      setExportingType(type);
      setError("");

      const token = getToken();

      const url = `${API_BASE}/reports/export?username=${encodeURIComponent(
        user?.username || ""
      )}&type=${encodeURIComponent(type)}&month=${month}&year=${year}&date=${encodeURIComponent(
        date
      )}`;

      const response = await fetch(url, {
        method: "GET",
        headers: token
          ? {
              Authorization: `Bearer ${token}`,
            }
          : {},
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(text || "Failed to export report");
      }

      const blob = await response.blob();

      if (!blob || blob.size === 0) {
        throw new Error("Export file is empty");
      }

      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");

      a.href = downloadUrl;
      a.download = `report-${type}-${year}-${month}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();

      setTimeout(() => window.URL.revokeObjectURL(downloadUrl), 60000);
    } catch (err) {
      console.error("Export report error:", err);
      setError(err?.message || "فشل تصدير التقرير");
    } finally {
      setExportingType("");
    }
  }

  const cards = useMemo(() => {
    if (!data?.summary) return [];

    return [
      {
        label: "Visible Employees",
        value: data.summary.visibleEmployees,
        hint: "الموظفون داخل نطاقك",
        tone: "blue",
      },
      {
        label: "Monthly Hours",
        value: data.summary.monthlyHours,
        hint: "إجمالي ساعات الشهر",
        tone: "green",
      },
      {
        label: "Absent Days",
        value: data.summary.absentDays,
        hint: "إجمالي الغياب",
        tone: "red",
      },
      {
        label: "Single Punch",
        value: data.summary.singlePunchCount,
        hint: "السجلات الناقصة",
        tone: "orange",
      },
      {
        label: "Leave Days",
        value: data.summary.leaveDays,
        hint: "أيام الإجازات والحالات",
        tone: "purple",
      },
      {
        label: "Pending Requests",
        value: data.summary.pendingRequests,
        hint: "الطلبات المعلقة",
        tone: "yellow",
      },
    ];
  }, [data]);

  const topHoursRows = useMemo(() => {
    const rows = Array.isArray(data?.monthlyRows) ? data.monthlyRows : [];
    return [...rows]
      .sort((a, b) => Number(b.totalHours || 0) - Number(a.totalHours || 0))
      .slice(0, 8);
  }, [data]);

  const topAbsenceRows = useMemo(() => {
    const rows = Array.isArray(data?.monthlyRows) ? data.monthlyRows : [];
    return [...rows]
      .sort((a, b) => Number(b.absentCount || 0) - Number(a.absentCount || 0))
      .slice(0, 8);
  }, [data]);

  return (
    <div className="page report-page">
      <style>{`
        .report-page {
          display: grid;
          gap: 22px;
          width: 100%;
        }

        .report-hero {
          display: grid;
          grid-template-columns: minmax(0, 1.4fr) minmax(320px, 0.8fr);
          gap: 18px;
        }

        .report-hero-main {
          border-radius: 30px;
          padding: 30px;
          background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%);
          color: #ffffff;
          box-shadow: 0 18px 45px rgba(15, 23, 42, 0.12);
        }

        .report-hero-main h1 {
          margin: 0 0 10px 0;
          font-size: 2.35rem;
          font-weight: 950;
          letter-spacing: -0.04em;
          color: #ffffff;
        }

        .report-hero-main p {
          margin: 0;
          color: rgba(255, 255, 255, 0.82);
          line-height: 1.7;
          max-width: 760px;
        }

        .report-hero-badge {
          display: inline-flex;
          align-items: center;
          width: fit-content;
          padding: 8px 14px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.14);
          color: #ffffff;
          font-weight: 900;
          font-size: 0.82rem;
          margin-bottom: 14px;
        }

        .report-hero-side,
        .report-card {
          border-radius: 28px;
          border: 1px solid #e9eef5;
          background: rgba(255, 255, 255, 0.96);
          box-shadow: 0 16px 40px rgba(15, 23, 42, 0.06);
        }

        .report-hero-side {
          padding: 24px;
          display: grid;
          gap: 14px;
          align-content: start;
        }

        .report-side-title {
          font-size: 1rem;
          font-weight: 950;
          color: #0f172a;
        }

        .report-filter-grid {
          display: grid;
          gap: 12px;
        }

        .report-field {
          display: grid;
          gap: 8px;
        }

        .report-field span {
          color: #64748b;
          font-size: 0.82rem;
          font-weight: 800;
        }

        .report-field input,
        .report-field select {
          min-height: 48px;
          border: 1px solid #dbe2ea;
          border-radius: 16px;
          padding: 0 14px;
          color: #0f172a;
          background: #ffffff;
          font-weight: 800;
          outline: none;
        }

        .report-field input:focus,
        .report-field select:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.08);
        }

        .report-alert {
          border-radius: 18px;
          padding: 14px 16px;
          background: #fff1f2;
          color: #be123c;
          border: 1px solid #fecdd3;
          font-weight: 850;
        }

        .report-stat-grid {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 14px;
        }

        .report-stat-card {
          border-radius: 24px;
          padding: 20px;
          background: #ffffff;
          border: 1px solid #e9eef5;
          box-shadow: 0 12px 30px rgba(15, 23, 42, 0.05);
          min-width: 0;
        }

        .report-stat-card span {
          display: block;
          color: #64748b;
          font-size: 0.82rem;
          font-weight: 850;
          margin-bottom: 12px;
        }

        .report-stat-card strong {
          display: block;
          color: #0f172a;
          font-size: 1.9rem;
          line-height: 1;
          font-weight: 950;
          margin-bottom: 10px;
        }

        .report-stat-card small {
          color: #64748b;
          font-weight: 750;
          line-height: 1.4;
        }

        .report-stat-card.blue strong { color: #2563eb; }
        .report-stat-card.green strong { color: #047857; }
        .report-stat-card.red strong { color: #be123c; }
        .report-stat-card.orange strong { color: #c2410c; }
        .report-stat-card.purple strong { color: #7c3aed; }
        .report-stat-card.yellow strong { color: #a16207; }

        .report-card {
          padding: 24px;
          min-width: 0;
          overflow: hidden;
        }

        .report-card-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 14px;
          flex-wrap: wrap;
          margin-bottom: 18px;
        }

        .report-card-head h2 {
          margin: 0 0 6px 0;
          color: #0f172a;
          font-size: 1.25rem;
          font-weight: 950;
        }

        .report-card-head p {
          margin: 0;
          color: #64748b;
          font-size: 0.92rem;
          line-height: 1.6;
        }

        .report-export-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .report-export-actions button {
          min-height: 42px;
          border: none;
          border-radius: 14px;
          padding: 0 14px;
          background: #eef4ff;
          color: #1d4ed8;
          font-weight: 900;
          cursor: pointer;
        }

        .report-export-actions button:hover {
          transform: translateY(-1px);
        }

        .report-export-actions button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .report-grid-two {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 18px;
        }

        .report-table-wrap {
          width: 100%;
          overflow-x: auto;
          padding-bottom: 4px;
        }

        .report-table {
          width: 100%;
          min-width: 780px;
          border-collapse: separate;
          border-spacing: 0 10px;
          table-layout: fixed;
        }

        .report-table th {
          color: #64748b;
          text-align: left;
          padding: 0 12px 8px 12px;
          font-size: 0.82rem;
          font-weight: 950;
          white-space: nowrap;
        }

        .report-table td {
          background: #f8fafc;
          color: #0f172a;
          padding: 14px 12px;
          border-top: 1px solid #e9eef5;
          border-bottom: 1px solid #e9eef5;
          font-weight: 750;
          vertical-align: middle;
        }

        .report-table td:first-child {
          border-left: 1px solid #e9eef5;
          border-top-left-radius: 16px;
          border-bottom-left-radius: 16px;
        }

        .report-table td:last-child {
          border-right: 1px solid #e9eef5;
          border-top-right-radius: 16px;
          border-bottom-right-radius: 16px;
        }

        .report-cell-text {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .report-empty-cell {
          text-align: center;
          color: #64748b !important;
          font-weight: 850 !important;
          padding: 24px !important;
        }

        .report-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: fit-content;
          min-height: 30px;
          padding: 0 11px;
          border-radius: 999px;
          font-size: 0.76rem;
          font-weight: 950;
          white-space: nowrap;
        }

        .report-pill.success {
          background: #dcfce7;
          color: #166534;
        }

        .report-pill.warning {
          background: #ffedd5;
          color: #9a3412;
        }

        .report-pill.danger {
          background: #fee2e2;
          color: #991b1b;
        }

        .report-pill.neutral {
          background: #e2e8f0;
          color: #334155;
        }

        @media (max-width: 1300px) {
          .report-stat-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .report-hero,
          .report-grid-two {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 720px) {
          .report-stat-grid {
            grid-template-columns: 1fr;
          }

          .report-hero-main h1 {
            font-size: 1.85rem;
          }

          .report-card {
            padding: 18px;
          }
        }
      `}</style>

      <section className="report-hero">
        <div className="report-hero-main">
          <div className="report-hero-badge">Reports Control Center</div>
          <h1>Reports Dashboard</h1>
          <p>
            تقارير شهرية ويومية، تحليل الغياب والساعات، ومتابعة مشاكل الحضور مع تصدير Excel آمن بالتوكن.
          </p>
        </div>

        <aside className="report-hero-side">
          <div className="report-side-title">Filters</div>

          <div className="report-filter-grid">
            <label className="report-field">
              <span>Month</span>
              <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
                {Array.from({ length: 12 }, (_, index) => (
                  <option key={index + 1} value={index + 1}>
                    {index + 1}
                  </option>
                ))}
              </select>
            </label>

            <label className="report-field">
              <span>Year</span>
              <input
                type="number"
                value={year}
                min="2024"
                max="2035"
                onChange={(e) => setYear(Number(e.target.value) || new Date().getFullYear())}
              />
            </label>

            <label className="report-field">
              <span>Daily Date</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
          </div>
        </aside>
      </section>

      {error ? <div className="report-alert">{error}</div> : null}

      <section className="report-stat-grid">
        {cards.map((item) => (
          <ReportCard key={item.label} {...item} />
        ))}
      </section>

      <section className="report-card">
        <div className="report-card-head">
          <div>
            <h2>Quick Export</h2>
            <p>تصدير سريع حسب نوع التقرير، مع إرسال التوكن بدون الرجوع لتسجيل الدخول.</p>
          </div>

          <div className="report-export-actions">
            <button disabled={!!exportingType} onClick={() => exportReport("monthly")}>
              {exportingType === "monthly" ? "Exporting..." : "Export Monthly"}
            </button>
            <button disabled={!!exportingType} onClick={() => exportReport("daily")}>
              {exportingType === "daily" ? "Exporting..." : "Export Daily"}
            </button>
            <button disabled={!!exportingType} onClick={() => exportReport("issues")}>
              {exportingType === "issues" ? "Exporting..." : "Export Issues"}
            </button>
            <button disabled={!!exportingType} onClick={() => exportReport("requests")}>
              {exportingType === "requests" ? "Exporting..." : "Export Requests"}
            </button>
          </div>
        </div>
      </section>

      <section className="report-grid-two">
        <section className="report-card">
          <div className="report-card-head">
            <div>
              <h2>Top Hours</h2>
              <p>أعلى الموظفين في عدد الساعات للشهر المختار.</p>
            </div>
          </div>

          <SimpleTable
            columns={[
              { key: "name", label: "Name" },
              { key: "gasId", label: "GAS ID" },
              { key: "project", label: "Project" },
              { key: "totalHours", label: "Hours" },
            ]}
            rows={topHoursRows}
          />
        </section>

        <section className="report-card">
          <div className="report-card-head">
            <div>
              <h2>Top Absence</h2>
              <p>أعلى الموظفين في الغياب حسب البيانات المستوردة.</p>
            </div>
          </div>

          <SimpleTable
            columns={[
              { key: "name", label: "Name" },
              { key: "gasId", label: "GAS ID" },
              { key: "project", label: "Project" },
              { key: "absentCount", label: "Absent" },
            ]}
            rows={topAbsenceRows}
          />
        </section>
      </section>

      <section className="report-grid-two">
        <section className="report-card">
          <div className="report-card-head">
            <div>
              <h2>Monthly Summary</h2>
              <p>ملخص شهري لكل موظف داخل نطاقك.</p>
            </div>
          </div>

          <SimpleTable
            columns={[
              { key: "name", label: "Name" },
              { key: "gasId", label: "GAS ID" },
              { key: "project", label: "Project" },
              { key: "package", label: "Package" },
              { key: "totalHours", label: "Hours" },
              { key: "absentCount", label: "Absent" },
              { key: "singlePunchCount", label: "Single Punch" },
            ]}
            rows={data?.monthlyRows || []}
          />
        </section>

        <section className="report-card">
          <div className="report-card-head">
            <div>
              <h2>Daily Report</h2>
              <p>حالة كل موظف في اليوم المحدد.</p>
            </div>
          </div>

          <SimpleTable
            columns={[
              { key: "name", label: "Name" },
              { key: "gasId", label: "GAS ID" },
              { key: "status", label: "Status", status: true },
              { key: "hours", label: "Hours" },
              { key: "source", label: "Source" },
            ]}
            rows={data?.dailyRows || []}
          />
        </section>
      </section>

      <section className="report-grid-two">
        <section className="report-card">
          <div className="report-card-head">
            <div>
              <h2>Attendance Issues</h2>
              <p>Absent و Single Punch لنفس الشهر.</p>
            </div>
          </div>

          <SimpleTable
            columns={[
              { key: "name", label: "Name" },
              { key: "date", label: "Date" },
              { key: "status", label: "Status", status: true },
              { key: "project", label: "Project" },
              { key: "package", label: "Package" },
            ]}
            rows={data?.issuesRows || []}
          />
        </section>

        <section className="report-card">
          <div className="report-card-head">
            <div>
              <h2>Adjustment Requests</h2>
              <p>طلبات تعديل الحضور ضمن نطاقك.</p>
            </div>
          </div>

          <SimpleTable
            columns={[
              { key: "employeeName", label: "Employee" },
              { key: "date", label: "Date" },
              { key: "currentValue", label: "Current" },
              { key: "requestedValue", label: "Requested" },
              { key: "status", label: "Status", status: true },
            ]}
            rows={data?.requestsRows || []}
          />
        </section>
      </section>
    </div>
  );
}
