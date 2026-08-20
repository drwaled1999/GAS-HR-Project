import { useEffect, useMemo, useState } from "react";
import { API_BASE, apiFetch } from "../services/api";
import { useSettings } from "../context/SettingsContext";

function getToken() {
  return localStorage.getItem("token") || localStorage.getItem("authToken") ||
    localStorage.getItem("accessToken") || sessionStorage.getItem("token") ||
    sessionStorage.getItem("authToken") || sessionStorage.getItem("accessToken") || "";
}

function ReportCard({ label, value }) {
  return <article className="reports-page__card"><span>{label}</span><strong>{value ?? 0}</strong></article>;
}

function SimpleTable({ columns, rows, emptyLabel }) {
  return (
    <div className="reports-page__table-wrap">
      <table className="reports-page__table">
        <thead><tr>{columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr></thead>
        <tbody>
          {rows.length > 0 ? rows.map((row, index) => (
            <tr key={row.employeeId || `${row.name}-${index}`}>
              {columns.map((column) => <td key={column.key}>{row[column.key] ?? "-"}</td>)}
            </tr>
          )) : <tr><td colSpan={columns.length} className="reports-page__empty">{emptyLabel}</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

export default function ReportsPage() {
  const { language } = useSettings();
  const isArabic = language === "ar";
  const text = isArabic ? {
    title: "لوحة التقارير", subtitle: "ملخص الحضور والساعات والملاحظات", month: "الشهر",
    year: "السنة", date: "التاريخ", employees: "الموظفون", hours: "إجمالي الساعات",
    absent: "أيام الغياب", singlePunch: "البصمة الواحدة", leave: "أيام الإجازات", pending: "طلبات معلقة", exportTitle: "تصدير التقارير",
    monthly: "التقرير الشهري", daily: "التقرير اليومي", issues: "تقرير الملاحظات",
    topHours: "أعلى الساعات", topAbsence: "أعلى الغياب", name: "الاسم", overview: "نظرة عامة",
    dailyTab: "الحضور اليومي", issuesTab: "الملاحظات", requestsTab: "الطلبات",
    search: "البحث بالاسم أو الرقم...", gasId: "الرقم الوظيفي", status: "الحالة", project: "المشروع",
    hoursShort: "الساعات", source: "المصدر", requestedBy: "مقدم الطلب", reason: "السبب",
    noData: "لا توجد بيانات", loading: "جارٍ تحميل التقارير...", retry: "إعادة المحاولة",
    exportError: "تعذر تصدير التقرير",
  } : {
    title: "Reports Dashboard", subtitle: "Attendance, hours and issues summary", month: "Month",
    year: "Year", date: "Date", employees: "Employees", hours: "Total Hours",
    absent: "Absent Days", singlePunch: "Single Punch", leave: "Leave Days", pending: "Pending Requests", exportTitle: "Export Reports",
    monthly: "Monthly Report", daily: "Daily Report", issues: "Issues Report",
    topHours: "Top Hours", topAbsence: "Top Absence", name: "Name", overview: "Overview",
    dailyTab: "Daily Attendance", issuesTab: "Issues", requestsTab: "Requests",
    search: "Search by name or ID...", gasId: "GAS ID", status: "Status", project: "Project",
    hoursShort: "Hours", source: "Source", requestedBy: "Requested By", reason: "Reason",
    noData: "No data available", loading: "Loading reports...", retry: "Try again",
    exportError: "Unable to export the report",
  };

  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());
  const [date, setDate] = useState(today.toISOString().slice(0, 10));
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const [search, setSearch] = useState("");

  async function loadReports() {
    setLoading(true); setError("");
    try {
      setData(await apiFetch(`/reports/summary?month=${month}&year=${year}&date=${encodeURIComponent(date)}`));
    } catch (requestError) {
      setError(requestError.message || "Failed to load reports");
    } finally { setLoading(false); }
  }

  useEffect(() => { loadReports(); }, [month, year, date]);

  async function exportReport(type) {
    setExporting(type); setError("");
    try {
      const params = new URLSearchParams({ type, month: String(month), year: String(year), date });
      const response = await fetch(`${API_BASE}/reports/export?${params}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message || text.exportError);
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `report-${type}-${year}-${String(month).padStart(2, "0")}.xlsx`;
      document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(objectUrl);
    } catch (requestError) {
      setError(requestError.message || text.exportError);
    } finally { setExporting(""); }
  }

  const cards = useMemo(() => [
    { label: text.employees, value: data?.summary?.visibleEmployees },
    { label: text.hours, value: data?.summary?.monthlyHours },
    { label: text.absent, value: data?.summary?.absentDays },
    { label: text.singlePunch, value: data?.summary?.singlePunchCount },
    { label: text.leave, value: data?.summary?.leaveDays },
    { label: text.pending, value: data?.summary?.pendingRequests },
  ], [data, language]);
  const topHoursRows = useMemo(() =>
    [...(data?.monthlyRows || [])].sort((a, b) => Number(b.totalHours) - Number(a.totalHours)).slice(0, 10),
  [data]);
  const topAbsenceRows = useMemo(() =>
    [...(data?.monthlyRows || [])].sort((a, b) => Number(b.absentCount) - Number(a.absentCount)).slice(0, 10),
  [data]);
  const searchableRows = useMemo(() => {
    const source = activeTab === "daily" ? data?.dailyRows || []
      : activeTab === "issues" ? data?.issuesRows || []
      : activeTab === "requests" ? data?.requestsRows || [] : [];
    const term = search.trim().toLowerCase();
    return term ? source.filter((row) => Object.values(row).some((value) =>
      String(value ?? "").toLowerCase().includes(term))) : source;
  }, [activeTab, data, search]);
  const tabColumns = activeTab === "daily" ? [
    { key: "name", label: text.name }, { key: "gasId", label: text.gasId },
    { key: "project", label: text.project }, { key: "status", label: text.status },
    { key: "hours", label: text.hoursShort }, { key: "source", label: text.source },
  ] : activeTab === "issues" ? [
    { key: "name", label: text.name }, { key: "gasId", label: text.gasId },
    { key: "date", label: text.date }, { key: "status", label: text.status },
    { key: "project", label: text.project },
  ] : [
    { key: "employeeName", label: text.name }, { key: "gasId", label: text.gasId },
    { key: "date", label: text.date }, { key: "status", label: text.status },
    { key: "requestedByName", label: text.requestedBy }, { key: "reason", label: text.reason },
  ];

  return (
    <main className="reports-page" dir={isArabic ? "rtl" : "ltr"}>
      <header className="reports-page__header"><div><h1>{text.title}</h1><p>{text.subtitle}</p></div></header>
      <section className="reports-page__filters" aria-label={text.title}>
        <label><span>{text.month}</span><input type="number" min="1" max="12" value={month}
          onChange={(event) => setMonth(Math.min(12, Math.max(1, Number(event.target.value) || 1)))} /></label>
        <label><span>{text.year}</span><input type="number" min="2000" max="2100" value={year}
          onChange={(event) => setYear(Math.min(2100, Math.max(2000, Number(event.target.value) || 2000)))} /></label>
        <label><span>{text.date}</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
      </section>
      {error && <div className="reports-page__error" role="alert"><span>{error}</span><button type="button" onClick={loadReports}>{text.retry}</button></div>}
      {loading ? <div className="reports-page__loading"><span />{text.loading}</div> : <>
        <section className="reports-page__cards">{cards.map((card) => <ReportCard key={card.label} {...card} />)}</section>
        <section className="reports-page__export-panel"><h2>{text.exportTitle}</h2><div className="reports-page__export-actions">
          {[["monthly", text.monthly], ["daily", text.daily], ["issues", text.issues], ["requests", text.requestsTab]].map(([type, label]) => (
            <button key={type} type="button" disabled={Boolean(exporting)} onClick={() => exportReport(type)}>
              {exporting === type ? `${label}...` : label}
            </button>
          ))}
        </div></section>
        <section className="reports-page__data-panel">
          <nav className="reports-page__tabs">
            {[["overview", text.overview], ["daily", text.dailyTab], ["issues", text.issuesTab], ["requests", text.requestsTab]].map(([key, label]) =>
              <button key={key} type="button" className={activeTab === key ? "is-active" : ""}
                onClick={() => { setActiveTab(key); setSearch(""); }}>{label}</button>)}
          </nav>
          {activeTab === "overview" ? <section className="reports-page__tables">
            <article className="reports-page__panel"><h2>{text.topHours}</h2><SimpleTable
              columns={[{ key: "name", label: text.name }, { key: "totalHours", label: text.hours }]}
              rows={topHoursRows} emptyLabel={text.noData} /></article>
            <article className="reports-page__panel"><h2>{text.topAbsence}</h2><SimpleTable
              columns={[{ key: "name", label: text.name }, { key: "absentCount", label: text.absent }]}
              rows={topAbsenceRows} emptyLabel={text.noData} /></article>
          </section> : <article className="reports-page__panel reports-page__records">
            <div className="reports-page__search"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={text.search} /></div>
            <SimpleTable columns={tabColumns} rows={searchableRows} emptyLabel={text.noData} />
          </article>}
        </section>
      </>}
      <style>{`
        .reports-page{padding:24px;color:#172033;min-height:100%}.reports-page__header{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px}.reports-page__header h1{font-size:clamp(24px,3vw,34px);margin:0 0 6px;font-weight:800}.reports-page__header p{margin:0;color:#64748b}.reports-page__filters,.reports-page__export-panel,.reports-page__panel{background:#fff;border:1px solid #e2e8f0;border-radius:18px;box-shadow:0 8px 28px rgba(15,23,42,.06)}.reports-page__filters{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;padding:18px;margin-bottom:18px}.reports-page__filters label{display:grid;gap:7px;font-size:13px;font-weight:700;color:#475569}.reports-page__filters input{width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:10px;padding:11px 12px;background:#fff;color:#0f172a;font:inherit}.reports-page__filters input:focus{outline:3px solid rgba(37,99,235,.15);border-color:#2563eb}.reports-page__cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-bottom:18px}.reports-page__card{position:relative;overflow:hidden;padding:20px;border-radius:18px;color:#fff;background:linear-gradient(135deg,#172554,#2563eb);box-shadow:0 12px 30px rgba(37,99,235,.18)}.reports-page__card::after{content:"";position:absolute;width:90px;height:90px;border-radius:50%;background:rgba(255,255,255,.1);inset-inline-end:-25px;top:-30px}.reports-page__card span{display:block;font-size:13px;opacity:.82;margin-bottom:9px}.reports-page__card strong{font-size:28px;line-height:1}.reports-page__export-panel{padding:18px;margin-bottom:18px}.reports-page__export-panel h2,.reports-page__panel h2{font-size:18px;margin:0 0 14px}.reports-page__export-actions{display:flex;flex-wrap:wrap;gap:10px}.reports-page__export-actions button,.reports-page__error button{border:0;border-radius:10px;padding:11px 16px;background:#2563eb;color:#fff;font-weight:700;cursor:pointer}.reports-page__export-actions button:disabled{opacity:.6;cursor:wait}.reports-page__tables{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}.reports-page__panel{padding:18px;min-width:0}.reports-page__table-wrap{overflow-x:auto;border:1px solid #e2e8f0;border-radius:12px}.reports-page__table{width:100%;border-collapse:collapse;background:#fff}.reports-page__table th{background:#172554;color:#fff;text-align:start;padding:12px;white-space:nowrap}.reports-page__table td{padding:12px;border-bottom:1px solid #e2e8f0;color:#334155}.reports-page__table tbody tr:last-child td{border-bottom:0}.reports-page__table tbody tr:hover{background:#f8fafc}.reports-page__empty{text-align:center;color:#64748b!important;padding:28px!important}.reports-page__error{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;margin-bottom:18px;border-radius:12px;background:#fef2f2;color:#b91c1c;border:1px solid #fecaca}.reports-page__error button{background:#b91c1c;white-space:nowrap}.reports-page__loading{display:flex;align-items:center;justify-content:center;gap:10px;min-height:220px;color:#64748b}.reports-page__loading span{width:20px;height:20px;border:3px solid #cbd5e1;border-top-color:#2563eb;border-radius:50%;animation:reports-spin .8s linear infinite}@keyframes reports-spin{to{transform:rotate(360deg)}}html.dark .reports-page{color:#e5e7eb}html.dark .reports-page__header p,html.dark .reports-page__filters label{color:#94a3b8}html.dark .reports-page__filters,html.dark .reports-page__export-panel,html.dark .reports-page__panel{background:#111827;border-color:#334155;box-shadow:none}html.dark .reports-page__filters input,html.dark .reports-page__table{background:#0f172a;color:#e5e7eb;border-color:#475569}html.dark .reports-page__table-wrap,html.dark .reports-page__table td{border-color:#334155}html.dark .reports-page__table td{color:#cbd5e1}html.dark .reports-page__table tbody tr:hover{background:#1e293b}html.dark .reports-page__empty{color:#94a3b8!important}@media(max-width:900px){.reports-page__cards{grid-template-columns:repeat(2,minmax(0,1fr))}.reports-page__tables{grid-template-columns:1fr}}@media(max-width:600px){.reports-page{padding:14px}.reports-page__filters{grid-template-columns:1fr}.reports-page__cards{grid-template-columns:1fr 1fr;gap:10px}.reports-page__card{padding:16px}.reports-page__card strong{font-size:23px}.reports-page__export-actions{display:grid;grid-template-columns:1fr}.reports-page__export-actions button{width:100%}.reports-page__error{align-items:flex-start;flex-direction:column}}
        .reports-page{animation:reports-rise .45s ease both}
        .reports-page__cards{grid-template-columns:repeat(3,minmax(0,1fr))}
        .reports-page__card{animation:reports-card-in .45s ease both;transition:transform .2s ease,box-shadow .2s ease}
        .reports-page__card:hover{transform:translateY(-5px);box-shadow:0 18px 36px rgba(37,99,235,.28)}
        .reports-page__data-panel{display:grid;gap:14px}
        .reports-page__tabs{display:flex;gap:8px;padding:6px;background:#e9eff8;border-radius:14px;overflow-x:auto}
        .reports-page__tabs button{border:0;background:transparent;color:#475569;padding:10px 16px;border-radius:10px;font-weight:750;white-space:nowrap;cursor:pointer;transition:.2s ease}
        .reports-page__tabs button:hover{background:rgba(255,255,255,.65);color:#1d4ed8}
        .reports-page__tabs button.is-active{background:#fff;color:#1d4ed8;box-shadow:0 5px 14px rgba(15,23,42,.1)}
        .reports-page__records{animation:reports-rise .28s ease both}
        .reports-page__search{margin-bottom:14px}
        .reports-page__search input{width:min(100%,420px);box-sizing:border-box;border:1px solid #cbd5e1;border-radius:11px;padding:11px 14px;background:#fff;color:#0f172a;font:inherit}
        html.dark .reports-page__tabs{background:#0f172a}
        html.dark .reports-page__tabs button{color:#94a3b8}
        html.dark .reports-page__tabs button:hover{background:#1e293b;color:#bfdbfe}
        html.dark .reports-page__tabs button.is-active{background:#1e3a8a;color:#fff}
        html.dark .reports-page__search input{background:#0f172a;color:#e5e7eb;border-color:#475569}
        @keyframes reports-rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
        @keyframes reports-card-in{from{opacity:0;transform:translateY(15px) scale(.98)}to{opacity:1;transform:none}}
        @media(max-width:900px){.reports-page__cards{grid-template-columns:repeat(2,minmax(0,1fr))}}
        @media(prefers-reduced-motion:reduce){.reports-page,.reports-page__card,.reports-page__records{animation:none}.reports-page__card{transition:none}}
      `}</style>
    </main>
  );
}
