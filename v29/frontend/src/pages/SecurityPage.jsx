import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Download, FileClock, LockKeyhole, RefreshCw, Search, ShieldCheck, Unlock, UserX } from "lucide-react";
import { apiFetch } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useSettings } from "../context/SettingsContext";

const normalize = (value) => String(value || "").trim().toLowerCase();
const safeArray = (value) => Array.isArray(value) ? value : [];
const csvCell = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;

export default function SecurityPage() {
  const { user } = useAuth();
  const { language } = useSettings();
  const ar = language === "ar";
  const role = normalize(user?.role || user?.roleName || user?.roleCode);
  const isOwner = ["owner", "system owner", "system_owner", "systemowner"].includes(role);
  const t = ar ? {
    badge:"مركز الحماية والمراقبة", title:"الأمن وسجل التدقيق", subtitle:"مراقبة الحسابات ومحاولات الدخول والأحداث والتغييرات الإدارية.",
    refresh:"تحديث", auto:"تحديث تلقائي", export:"تصدير CSV", locked:"الحسابات المقفلة", failed:"محاولات فاشلة",
    events:"الأحداث الأمنية", audits:"سجلات التدقيق", tokens:"الجلسات النشطة", attempts:"محاولات الدخول",
    audit:"سجل التدقيق", search:"البحث في السجلات...", all:"الكل", success:"ناجحة", failedOnly:"فاشلة",
    name:"الاسم", username:"اسم المستخدم", gas:"GAS ID", division:"القسم", count:"المحاولات", action:"الإجراء",
    unlock:"فك القفل", confirm:"هل أنت متأكد من فك قفل هذا الحساب؟", noData:"لا توجد بيانات", denied:"هذه الصفحة متاحة لـ System Owner فقط.",
    loading:"جارٍ تحميل بيانات الأمان...", ip:"عنوان IP", device:"الجهاز والمتصفح", type:"النوع", user:"المستخدم", details:"التفاصيل", time:"الوقت",
  } : {
    badge:"Security Control Center", title:"Security & Audit", subtitle:"Monitor accounts, login attempts, security events and administrative changes.",
    refresh:"Refresh", auto:"Auto refresh", export:"Export CSV", locked:"Locked Users", failed:"Failed Logins",
    events:"Security Events", audits:"Audit Logs", tokens:"Active Sessions", attempts:"Login Attempts",
    audit:"Audit Trail", search:"Search security records...", all:"All", success:"Successful", failedOnly:"Failed",
    name:"Name", username:"Username", gas:"GAS ID", division:"Division", count:"Attempts", action:"Action",
    unlock:"Unlock", confirm:"Are you sure you want to unlock this account?", noData:"No data found", denied:"This page is available to the System Owner only.",
    loading:"Loading security data...", ip:"IP Address", device:"Device / Browser", type:"Type", user:"User", details:"Details", time:"Time",
  };

  const [data, setData] = useState({ summary:{}, locked:[], attempts:[], events:[], audits:[] });
  const [loading, setLoading] = useState(isOwner);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("attempts");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [unlocking, setUnlocking] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  async function load(silent = false) {
    if (!isOwner) return;
    silent ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const [summary, locked, attempts, events, audits] = await Promise.all([
        apiFetch("/security/summary"), apiFetch("/security/locked-users"),
        apiFetch("/security/login-attempts?limit=60"), apiFetch("/security/events?limit=60"),
        apiFetch("/security/audit-logs?limit=60"),
      ]);
      setData({ summary: summary || {}, locked: safeArray(locked?.users), attempts: safeArray(attempts?.items),
        events: safeArray(events?.items), audits: safeArray(audits?.items) });
      setLastUpdated(new Date());
    } catch (requestError) { setError(requestError?.message || "Failed to load security data"); }
    finally { setLoading(false); setRefreshing(false); }
  }

  useEffect(() => { if (isOwner) load(); }, [isOwner]);
  useEffect(() => {
    if (!isOwner || !autoRefresh) return undefined;
    const timer = window.setInterval(() => load(true), 30000);
    return () => window.clearInterval(timer);
  }, [isOwner, autoRefresh]);

  async function unlockAccount(item) {
    if (!window.confirm(t.confirm)) return;
    setUnlocking(item.id); setError("");
    try { await apiFetch(`/security/unlock/${item.id}`, { method:"POST" }); await load(true); }
    catch (requestError) { setError(requestError?.message || "Failed to unlock user"); }
    finally { setUnlocking(""); }
  }

  const sourceRows = tab === "attempts" ? data.attempts : tab === "events" ? data.events : data.audits;
  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return sourceRows.filter((item) => {
      if (tab === "attempts" && status !== "all") {
        const itemStatus = normalize(item.status);
        if (status === "success" && !["success", "successful"].includes(itemStatus)) return false;
        if (status === "failed" && !["failed", "locked"].includes(itemStatus)) return false;
      }
      return !term || Object.values(item).some((value) => JSON.stringify(value ?? "").toLowerCase().includes(term));
    });
  }, [sourceRows, search, status, tab]);

  function exportCsv() {
    const headers = tab === "attempts" ? ["Username","Status","IP","User Agent","Time"]
      : tab === "events" ? ["Type","User","Username","IP","Details","Time"]
      : ["Action","Actor","Details","Time"];
    const rows = filteredRows.map((item) => tab === "attempts"
      ? [item.username,item.status,item.ipAddress,item.userAgent,item.createdAt]
      : tab === "events" ? [item.eventType,item.userName,item.username,item.ipAddress,JSON.stringify(item.details || {}),item.createdAt]
      : [item.action,item.actorName,JSON.stringify(item.details || {}),item.createdAt]);
    const content = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF", content], { type:"text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href=url; link.download=`security-${tab}-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
  }

  if (!isOwner) return <main className="security-v2" dir={ar ? "rtl" : "ltr"}><section className="security-v2__denied">
    <LockKeyhole size={48}/><h1>{t.title}</h1><p>{t.denied}</p></section><style>{css}</style></main>;
  if (loading) return <main className="security-v2"><section className="security-v2__loading"><span/><strong>{t.loading}</strong></section><style>{css}</style></main>;

  const stats = [
    [t.locked, data.locked.length, UserX, "red"], [t.failed, data.summary.failedLogins || 0, AlertTriangle, "amber"],
    [t.events, data.summary.securityEvents || 0, ShieldCheck, "blue"], [t.audits, data.summary.auditLogs || 0, FileClock, "violet"],
    [t.tokens, data.summary.refreshTokens || 0, LockKeyhole, "green"],
  ];

  return <main className="security-v2" dir={ar ? "rtl" : "ltr"}>
    <header className="security-v2__hero"><div><span>{t.badge}</span><h1>{t.title}</h1><p>{t.subtitle}</p></div>
      <div className="security-v2__hero-actions"><label><input type="checkbox" checked={autoRefresh} onChange={(event) => setAutoRefresh(event.target.checked)}/>{t.auto}</label>
        <button onClick={() => load(true)} disabled={refreshing}><RefreshCw size={17} className={refreshing ? "spin" : ""}/>{t.refresh}</button></div>
    </header>
    {error && <div className="security-v2__error">{error}</div>}
    <section className="security-v2__stats">{stats.map(([label,value,Icon,color]) => <article key={label} className={color}>
      <div><span>{label}</span><Icon size={20}/></div><strong>{value}</strong></article>)}</section>

    <section className="security-v2__card"><div className="security-v2__head"><div><h2>{t.locked}</h2><p>{data.locked.length} {t.locked}</p></div></div>
      <div className="security-v2__table-wrap"><table><thead><tr><th>{t.name}</th><th>{t.username}</th><th>{t.gas}</th><th>{t.division}</th><th>{t.count}</th><th>{t.action}</th></tr></thead>
        <tbody>{data.locked.length ? data.locked.map((item) => <tr key={item.id}><td>{item.name || item.fullName || "-"}</td><td>{item.username || "-"}</td>
          <td>{item.gasId || "-"}</td><td>{item.division || "-"}</td><td><b className="security-v2__attempts">{item.failedAttempts || 0}</b></td>
          <td><button className="security-v2__unlock" disabled={unlocking===item.id} onClick={() => unlockAccount(item)}><Unlock size={15}/>{t.unlock}</button></td></tr>)
          : <tr><td colSpan="6" className="security-v2__empty">{t.noData}</td></tr>}</tbody></table></div>
    </section>

    <section className="security-v2__card"><nav className="security-v2__tabs">
      {[["attempts",t.attempts],["events",t.events],["audits",t.audit]].map(([key,label]) => <button key={key} className={tab===key ? "active" : ""} onClick={() => setTab(key)}>{label}</button>)}
    </nav><div className="security-v2__toolbar"><label><Search size={17}/><input value={search} placeholder={t.search} onChange={(event) => setSearch(event.target.value)}/></label>
      {tab==="attempts" && <select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">{t.all}</option><option value="success">{t.success}</option><option value="failed">{t.failedOnly}</option></select>}
      <button onClick={exportCsv}><Download size={16}/>{t.export}</button></div>
      <div className="security-v2__feed">{filteredRows.length ? filteredRows.map((item,index) => <article key={item.id || index}>
        <i className={normalize(item.status)==="failed" || normalize(item.status)==="locked" ? "danger" : ""}/>
        <div><strong>{tab==="attempts" ? item.username : tab==="events" ? item.eventType : item.action}</strong>
          <span>{tab==="attempts" ? `${item.status || "-"} · ${t.ip}: ${item.ipAddress || "-"}`
            : tab==="events" ? `${t.user}: ${item.userName || item.username || item.userId || "-"} · ${t.ip}: ${item.ipAddress || "-"}`
            : item.actorName || "-"}</span>
          {tab==="attempts" && item.userAgent && <small>{t.device}: {item.userAgent}</small>}
          {tab!=="attempts" && item.details && Object.keys(item.details).length>0 && <small>{t.details}: {JSON.stringify(item.details)}</small>}
        </div><time>{new Date(item.createdAt).toLocaleString(ar ? "ar-SA" : "en-GB")}</time></article>)
        : <div className="security-v2__empty">{t.noData}</div>}</div>
    </section>
    {lastUpdated && <footer>{t.refresh}: {lastUpdated.toLocaleTimeString(ar ? "ar-SA" : "en-GB")}</footer>}
    <style>{css}</style>
  </main>;
}

const css = `
.security-v2{min-height:100%;padding:25px;color:#0f172a;background:radial-gradient(circle at top left,rgba(220,38,38,.1),transparent 30%),linear-gradient(135deg,#f8fafc,#eef2f7);animation:sec-in .4s ease both}.security-v2__hero{display:flex;justify-content:space-between;align-items:flex-start;gap:18px;flex-wrap:wrap;padding:27px;margin-bottom:20px;border-radius:25px;color:#fff;background:linear-gradient(135deg,#0f172a,#7f1d1d);box-shadow:0 22px 55px rgba(15,23,42,.2)}.security-v2__hero>div:first-child>span{display:inline-flex;padding:6px 11px;margin-bottom:11px;border:1px solid rgba(255,255,255,.2);border-radius:999px;background:rgba(255,255,255,.1);font-size:12px;font-weight:800}.security-v2__hero h1{margin:0;font-size:clamp(28px,4vw,37px)}.security-v2__hero p{margin:8px 0 0;color:#fecaca;line-height:1.6}.security-v2__hero-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.security-v2__hero-actions label,.security-v2__hero-actions button{display:flex;align-items:center;gap:7px;padding:10px 13px;border-radius:11px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.1);color:#fff;font-weight:750}.security-v2 button{cursor:pointer}.security-v2__stats{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:13px;margin-bottom:18px}.security-v2__stats article{padding:17px;border-radius:17px;background:#fff;border:1px solid #e2e8f0;box-shadow:0 10px 28px rgba(15,23,42,.06);transition:.2s}.security-v2__stats article:hover{transform:translateY(-3px)}.security-v2__stats article>div{display:flex;justify-content:space-between;gap:8px;color:#64748b;font-size:12px;font-weight:800}.security-v2__stats strong{display:block;margin-top:10px;font-size:30px}.security-v2__stats .red svg{color:#dc2626}.security-v2__stats .amber svg{color:#d97706}.security-v2__stats .blue svg{color:#2563eb}.security-v2__stats .violet svg{color:#7c3aed}.security-v2__stats .green svg{color:#16a34a}.security-v2__card{padding:20px;margin-bottom:18px;border-radius:20px;background:#fff;border:1px solid #e2e8f0;box-shadow:0 14px 35px rgba(15,23,42,.07)}.security-v2__head h2{margin:0}.security-v2__head p{margin:5px 0 14px;color:#64748b}.security-v2__table-wrap{overflow-x:auto}.security-v2 table{width:100%;min-width:720px;border-collapse:collapse}.security-v2 th,.security-v2 td{padding:11px;text-align:start;border-bottom:1px solid #e2e8f0}.security-v2 th{color:#64748b;font-size:11px;text-transform:uppercase}.security-v2__attempts{display:inline-flex;padding:5px 9px;border-radius:999px;color:#991b1b;background:#fee2e2}.security-v2__unlock,.security-v2__toolbar button{display:inline-flex;align-items:center;gap:6px;border:0;border-radius:9px;padding:9px 11px;color:#fff;background:#b91c1c;font-weight:750}.security-v2__tabs{display:flex;gap:7px;margin-bottom:14px;overflow-x:auto}.security-v2__tabs button{padding:9px 13px;border:0;border-radius:9px;background:#f1f5f9;color:#475569;font-weight:800;white-space:nowrap}.security-v2__tabs button.active{background:#0f172a;color:#fff}.security-v2__toolbar{display:flex;gap:9px;align-items:center;margin-bottom:14px}.security-v2__toolbar label{display:flex;align-items:center;gap:7px;flex:1;padding:0 11px;border:1px solid #cbd5e1;border-radius:10px}.security-v2__toolbar input,.security-v2__toolbar select{width:100%;padding:10px;border:0;background:transparent;color:inherit;outline:0}.security-v2__toolbar select{width:auto;border:1px solid #cbd5e1;border-radius:10px}.security-v2__feed{display:grid;gap:9px}.security-v2__feed article{display:grid;grid-template-columns:10px 1fr auto;gap:11px;padding:12px;border-radius:13px;background:#f8fafc;border:1px solid #e2e8f0}.security-v2__feed i{width:9px;height:9px;margin-top:5px;border-radius:50%;background:#22c55e;box-shadow:0 0 0 4px #dcfce7}.security-v2__feed i.danger{background:#ef4444;box-shadow:0 0 0 4px #fee2e2}.security-v2__feed article>div{display:grid;gap:3px;min-width:0}.security-v2__feed span,.security-v2__feed small{color:#64748b;overflow-wrap:anywhere}.security-v2__feed time{color:#64748b;font-size:12px;white-space:nowrap}.security-v2__empty{text-align:center;padding:25px;color:#64748b}.security-v2__error{padding:12px 14px;margin-bottom:15px;border-radius:12px;color:#991b1b;background:#fee2e2;border:1px solid #fecaca}.security-v2 footer{text-align:center;color:#64748b;font-size:12px}.security-v2__loading,.security-v2__denied{max-width:540px;margin:70px auto;padding:30px;text-align:center;border-radius:22px;background:#fff;box-shadow:0 15px 40px rgba(15,23,42,.1)}.security-v2__loading{display:flex;justify-content:center;align-items:center;gap:12px}.security-v2__loading span{width:28px;height:28px;border:4px solid #fecaca;border-top-color:#dc2626;border-radius:50%;animation:sec-spin .8s linear infinite}
html.dark .security-v2{color:#e5e7eb;background:radial-gradient(circle at top left,rgba(185,28,28,.18),transparent 30%),#070d19}html.dark .security-v2__card,html.dark .security-v2__stats article,html.dark .security-v2__loading,html.dark .security-v2__denied{background:#0f172a;border-color:#334155;box-shadow:none}html.dark .security-v2__feed article{background:#0b1220;border-color:#334155}html.dark .security-v2 th,html.dark .security-v2 td{border-color:#334155}html.dark .security-v2__tabs button{background:#1e293b;color:#cbd5e1}html.dark .security-v2__tabs button.active{background:#b91c1c;color:#fff}html.dark .security-v2__toolbar label,html.dark .security-v2__toolbar select{border-color:#475569;background:#0b1220;color:#fff}
@keyframes sec-spin{to{transform:rotate(360deg)}}@keyframes sec-in{from{opacity:0;transform:translateY(9px)}to{opacity:1;transform:none}}.spin{animation:sec-spin .8s linear infinite}@media(max-width:1050px){.security-v2__stats{grid-template-columns:repeat(3,1fr)}}@media(max-width:650px){.security-v2{padding:13px}.security-v2__hero{padding:20px}.security-v2__stats{grid-template-columns:repeat(2,1fr)}.security-v2__toolbar{align-items:stretch;flex-direction:column}.security-v2__toolbar select{width:100%}.security-v2__feed article{grid-template-columns:10px 1fr}.security-v2__feed time{grid-column:2}.security-v2__hero-actions{width:100%}.security-v2__hero-actions>*{flex:1;justify-content:center}}@media(prefers-reduced-motion:reduce){.security-v2{animation:none}}
`;
