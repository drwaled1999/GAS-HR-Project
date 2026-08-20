import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useSettings } from "../context/SettingsContext";

const normalize = (value) => String(value || "").trim().toLowerCase();

export default function SettingsPage() {
  const { user } = useAuth();
  const { language, theme, setTheme, toggleLanguage } = useSettings();
  const ar = language === "ar";
  const tx = ar ? {
    center: "مركز التحكم بالبوابة", title: "إعدادات النظام",
    subtitle: "إدارة وضع الصيانة وأرصدة الإجازات الافتراضية وإعدادات العرض.",
    online: "النظام يعمل", maintenanceActive: "الصيانة مفعلة", maintenance: "وضع الصيانة",
    maintenanceDesc: "إيقاف دخول المستخدمين مؤقتًا أثناء التحديثات مع السماح للمالك والمستثنين.",
    enabled: "الصيانة مفعلة", disabled: "الصيانة متوقفة",
    enabledDesc: "يستطيع المالك والمستخدمون المستثنون فقط دخول النظام.",
    disabledDesc: "جميع المستخدمين المصرح لهم يستطيعون دخول النظام.",
    confirmOn: "هل أنت متأكد من تشغيل وضع الصيانة؟ سيتم منع المستخدمين العاديين من الدخول.",
    confirmOff: "هل تريد إيقاف وضع الصيانة وإعادة فتح النظام للمستخدمين؟",
    defaults: "الإعدادات الافتراضية للإجازات", defaultsDesc: "تطبق هذه القيم على سجلات الأرصدة الجديدة.",
    annual: "الإجازة السنوية", sick: "الإجازة المرضية", emergency: "الإجازة الطارئة",
    accrual: "الاستحقاق السنوي الشهري", accrualHint: "يضاف شهريًا إلى رصيد الإجازة السنوية.",
    save: "حفظ إعدادات الإجازات", saving: "جارٍ الحفظ...", saved: "تم حفظ إعدادات الإجازات بنجاح.",
    appearance: "المظهر واللغة", appearanceDesc: "يتم حفظ اختيارك على هذا الجهاز.",
    dark: "الوضع الداكن", light: "الوضع الفاتح", switchLanguage: "English",
    total: "إجمالي الرصيد الافتراضي", days: "يوم لكل موظف", current: "القيم الحالية",
    access: "صلاحية الوصول", currentUser: "المستخدم الحالي", role: "الدور",
    readOnly: "هذه الصفحة للعرض فقط. لا تملك صلاحية تعديل إعدادات النظام.",
    loading: "جارٍ تحميل الإعدادات...", wait: "يرجى الانتظار.", retry: "إعادة المحاولة",
    loadError: "تعذر تحميل الإعدادات", saveError: "تعذر حفظ الإعدادات",
  } : {
    center: "HR Portal Control Center", title: "System Settings",
    subtitle: "Manage maintenance mode, default leave balances and display preferences.",
    online: "System Online", maintenanceActive: "Maintenance Active", maintenance: "Maintenance Mode",
    maintenanceDesc: "Temporarily restrict portal access during updates while allowing owners and exempt users.",
    enabled: "Maintenance is enabled", disabled: "Maintenance is disabled",
    enabledDesc: "Only the owner and exempt users can access the system.",
    disabledDesc: "All authorized users can access the system normally.",
    confirmOn: "Enable maintenance mode? Regular users will be blocked from the portal.",
    confirmOff: "Disable maintenance mode and reopen the portal to users?",
    defaults: "Default Leave Settings", defaultsDesc: "These values apply to newly created leave balance records.",
    annual: "Annual Leave", sick: "Sick Leave", emergency: "Emergency Leave",
    accrual: "Monthly Annual Accrual", accrualHint: "Added to the employee annual balance each month.",
    save: "Save Leave Settings", saving: "Saving...", saved: "Leave settings saved successfully.",
    appearance: "Appearance & Language", appearanceDesc: "Your choice is saved on this device.",
    dark: "Dark Mode", light: "Light Mode", switchLanguage: "العربية",
    total: "Total Default Balance", days: "days per employee", current: "Current Defaults",
    access: "Access", currentUser: "Current User", role: "Role",
    readOnly: "This page is read-only. You do not have permission to modify system settings.",
    loading: "Loading settings...", wait: "Please wait.", retry: "Try again",
    loadError: "Failed to load settings", saveError: "Failed to save settings",
  };

  const [maintenance, setMaintenance] = useState(false);
  const [annual, setAnnual] = useState(30);
  const [sick, setSick] = useState(15);
  const [emergency, setEmergency] = useState(5);
  const [accrual, setAccrual] = useState(2.5);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingMaintenance, setSavingMaintenance] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const role = normalize(user?.role || user?.roleName || user?.roleCode);
  const permissions = useMemo(() => (Array.isArray(user?.permissions) ? user.permissions : [])
    .map((item) => normalize(typeof item === "string" ? item : item?.code)), [user]);
  const isOwner = ["system owner", "owner", "system_owner", "systemowner"].includes(role);
  const canManage = isOwner || ["hr manager", "hr_manager", "hr"].includes(role) ||
    permissions.includes("settings.manage") || permissions.includes("*");

  async function loadData() {
    setLoading(true); setError("");
    try {
      const response = await apiFetch("/settings");
      const settings = response?.settings || {};
      setMaintenance(Boolean(settings.maintenanceMode));
      setAnnual(Number(settings.annualDefaultBalance ?? 30));
      setSick(Number(settings.sickDefaultBalance ?? 15));
      setEmergency(Number(settings.emergencyDefaultBalance ?? 5));
      setAccrual(Number(settings.monthlyAnnualAccrual ?? 2.5));
    } catch (requestError) {
      setError(requestError?.message || tx.loadError);
    } finally { setLoading(false); }
  }

  useEffect(() => { loadData(); }, []);

  async function toggleMaintenance(enabled) {
    if (!isOwner || !window.confirm(enabled ? tx.confirmOn : tx.confirmOff)) return;
    setSavingMaintenance(true); setError(""); setMessage("");
    try {
      const response = await apiFetch("/settings/maintenance", {
        method: "POST", body: JSON.stringify({ enabled }),
      });
      setMaintenance(Boolean(response?.settings?.maintenanceMode));
      setMessage(enabled ? tx.enabled : tx.disabled);
    } catch (requestError) {
      setError(requestError?.message || tx.saveError);
    } finally { setSavingMaintenance(false); }
  }

  async function saveDefaults(event) {
    event.preventDefault();
    setSaving(true); setError(""); setMessage("");
    try {
      const values = [annual, sick, emergency, accrual].map(Number);
      if (values.some((value) => !Number.isFinite(value) || value < 0 || value > 365)) {
        throw new Error(ar ? "يجب أن تكون القيم بين 0 و365." : "Values must be between 0 and 365.");
      }
      const response = await apiFetch("/settings/leave-defaults", {
        method: "POST",
        body: JSON.stringify({ annualDefaultBalance: values[0], sickDefaultBalance: values[1],
          emergencyDefaultBalance: values[2], monthlyAnnualAccrual: values[3] }),
      });
      const settings = response?.settings || {};
      setAnnual(Number(settings.annualDefaultBalance ?? values[0]));
      setSick(Number(settings.sickDefaultBalance ?? values[1]));
      setEmergency(Number(settings.emergencyDefaultBalance ?? values[2]));
      setAccrual(Number(settings.monthlyAnnualAccrual ?? values[3]));
      setMessage(tx.saved);
    } catch (requestError) {
      setError(requestError?.message || tx.saveError);
    } finally { setSaving(false); }
  }

  const total = Number(annual || 0) + Number(sick || 0) + Number(emergency || 0);

  if (loading) return <main className="settings-v2"><div className="settings-v2__loading">
    <span className="settings-v2__spinner"/><div><strong>{tx.loading}</strong><p>{tx.wait}</p></div>
  </div><style>{css}</style></main>;

  return <main className="settings-v2" dir={ar ? "rtl" : "ltr"}>
    <header className="settings-v2__hero">
      <div><span className="settings-v2__badge">{tx.center}</span><h1>{tx.title}</h1><p>{tx.subtitle}</p></div>
      <span className={`settings-v2__status ${maintenance ? "is-danger" : "is-online"}`}>
        <i />{maintenance ? tx.maintenanceActive : tx.online}
      </span>
    </header>

    {!canManage && <div className="settings-v2__notice is-warning">{tx.readOnly}</div>}
    {message && <div className="settings-v2__notice is-success">{message}</div>}
    {error && <div className="settings-v2__notice is-error"><span>{error}</span><button onClick={loadData}>{tx.retry}</button></div>}

    <div className="settings-v2__layout">
      <section className="settings-v2__main">
        <article className="settings-v2__card">
          <div className="settings-v2__card-head"><div><h2>{tx.maintenance}</h2><p>{tx.maintenanceDesc}</p></div>
            <label className={`settings-v2__switch ${!isOwner ? "is-disabled" : ""}`}>
              <input type="checkbox" checked={maintenance} disabled={!isOwner || savingMaintenance}
                onChange={(event) => toggleMaintenance(event.target.checked)} aria-label={tx.maintenance}/><span><i /></span>
            </label>
          </div>
          <div className={`settings-v2__mode ${maintenance ? "is-on" : "is-off"}`}>
            <strong>{maintenance ? tx.enabled : tx.disabled}</strong><span>{maintenance ? tx.enabledDesc : tx.disabledDesc}</span>
          </div>
        </article>

        <article className="settings-v2__card"><div className="settings-v2__card-head"><div><h2>{tx.defaults}</h2><p>{tx.defaultsDesc}</p></div></div>
          <form className="settings-v2__form" onSubmit={saveDefaults}>
            {[[tx.annual, annual, setAnnual, 1], [tx.sick, sick, setSick, 1], [tx.emergency, emergency, setEmergency, 1],
              [tx.accrual, accrual, setAccrual, .5]].map(([label, value, setter, step]) =>
              <label key={label}><span>{label}</span><input type="number" min="0" max="365" step={step} value={value}
                disabled={!canManage} onChange={(event) => setter(event.target.value)} /></label>)}
            <small>{tx.accrualHint}</small>
            <button type="submit" disabled={!canManage || saving}>{saving ? tx.saving : tx.save}</button>
          </form>
        </article>

        <article className="settings-v2__card"><div className="settings-v2__card-head"><div><h2>{tx.appearance}</h2><p>{tx.appearanceDesc}</p></div></div>
          <div className="settings-v2__appearance">
            <button type="button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? `☀ ${tx.light}` : `☾ ${tx.dark}`}</button>
            <button type="button" onClick={toggleLanguage}>🌐 {tx.switchLanguage}</button>
          </div>
        </article>
      </section>

      <aside className="settings-v2__side">
        <article className="settings-v2__summary"><span>{tx.total}</span><strong>{total}</strong><small>{tx.days}</small></article>
        <article className="settings-v2__card"><h2>{tx.current}</h2><div className="settings-v2__list">
          {[[tx.annual, annual], [tx.sick, sick], [tx.emergency, emergency], [tx.accrual, accrual]].map(([label, value]) =>
            <div key={label}><span>{label}</span><strong>{value}</strong></div>)}
        </div></article>
        <article className="settings-v2__card"><h2>{tx.access}</h2><div className="settings-v2__list">
          <div><span>{tx.currentUser}</span><strong>{user?.fullName || user?.name || user?.username || "-"}</strong></div>
          <div><span>{tx.role}</span><strong>{user?.role || user?.roleName || user?.roleCode || "-"}</strong></div>
        </div></article>
      </aside>
    </div><style>{css}</style>
  </main>;
}

const css = `
.settings-v2{min-height:100%;padding:26px;color:#0f172a;background:radial-gradient(circle at top left,rgba(37,99,235,.14),transparent 32%),linear-gradient(135deg,#f8fafc,#eef4fa);animation:sv2-in .4s ease both}.settings-v2__hero{display:flex;justify-content:space-between;align-items:flex-start;gap:18px;flex-wrap:wrap;padding:28px;margin-bottom:20px;border-radius:26px;color:#fff;background:linear-gradient(135deg,#0f172a,#1d4ed8);box-shadow:0 22px 52px rgba(15,23,42,.18)}.settings-v2__badge{display:inline-flex;padding:7px 12px;margin-bottom:12px;border-radius:999px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.1);font-size:12px;font-weight:800}.settings-v2__hero h1{margin:0;font-size:clamp(27px,4vw,36px)}.settings-v2__hero p{max-width:680px;margin:9px 0 0;color:rgba(255,255,255,.75);line-height:1.65}.settings-v2__status{display:flex;align-items:center;gap:9px;padding:10px 14px;border-radius:999px;font-size:13px;font-weight:850}.settings-v2__status i{width:9px;height:9px;border-radius:50%;background:currentColor;box-shadow:0 0 0 4px rgba(255,255,255,.12)}.settings-v2__status.is-online{color:#dcfce7;background:rgba(34,197,94,.16);border:1px solid rgba(134,239,172,.35)}.settings-v2__status.is-danger{color:#fee2e2;background:rgba(239,68,68,.18);border:1px solid rgba(252,165,165,.35)}.settings-v2__layout{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(280px,.75fr);gap:20px;align-items:start}.settings-v2__main,.settings-v2__side{display:grid;gap:18px}.settings-v2__card,.settings-v2__summary{padding:21px;border-radius:22px;background:rgba(255,255,255,.9);border:1px solid rgba(148,163,184,.24);box-shadow:0 15px 38px rgba(15,23,42,.07);backdrop-filter:blur(12px)}.settings-v2__card h2{margin:0;font-size:19px}.settings-v2__card-head{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:17px}.settings-v2__card-head p{margin:6px 0 0;color:#64748b;line-height:1.55;font-size:14px}.settings-v2__switch{position:relative;width:62px;height:35px;flex:0 0 auto}.settings-v2__switch input{position:absolute;opacity:0;width:1px;height:1px}.settings-v2__switch>span{position:absolute;inset:0;border-radius:999px;background:#cbd5e1;cursor:pointer;transition:.25s}.settings-v2__switch>span i{position:absolute;width:27px;height:27px;top:4px;inset-inline-start:4px;border-radius:50%;background:#fff;box-shadow:0 5px 12px rgba(15,23,42,.25);transition:.25s}.settings-v2__switch input:checked+span{background:linear-gradient(135deg,#ef4444,#b91c1c)}.settings-v2__switch input:checked+span i{transform:translateX(27px)}[dir=rtl] .settings-v2__switch input:checked+span i{transform:translateX(-27px)}.settings-v2__switch input:focus-visible+span{outline:3px solid rgba(37,99,235,.3)}.settings-v2__switch.is-disabled{opacity:.5}.settings-v2__mode{display:grid;gap:4px;padding:15px;border-radius:16px;line-height:1.5}.settings-v2__mode span{font-size:14px}.settings-v2__mode.is-on{color:#991b1b;background:#fee2e2;border:1px solid #fecaca}.settings-v2__mode.is-off{color:#166534;background:#dcfce7;border:1px solid #bbf7d0}.settings-v2__form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.settings-v2__form label{display:grid;gap:7px;color:#334155;font-size:13px;font-weight:800}.settings-v2__form input,.settings-v2__appearance button{box-sizing:border-box;width:100%;padding:12px 13px;border-radius:12px;border:1px solid #cbd5e1;background:#fff;color:#0f172a;font:inherit}.settings-v2__form input:focus{outline:3px solid rgba(37,99,235,.15);border-color:#2563eb}.settings-v2__form small{grid-column:1/-1;color:#64748b}.settings-v2__form>button{grid-column:1/-1;padding:13px;border:0;border-radius:13px;color:#fff;background:linear-gradient(135deg,#0f172a,#2563eb);font-weight:850;cursor:pointer}.settings-v2__form>button:disabled{opacity:.5;cursor:not-allowed}.settings-v2__appearance{display:grid;grid-template-columns:1fr 1fr;gap:12px}.settings-v2__appearance button{cursor:pointer;font-weight:800;transition:.2s}.settings-v2__appearance button:hover{transform:translateY(-2px);border-color:#2563eb;color:#1d4ed8}.settings-v2__summary{display:grid;gap:3px;background:linear-gradient(135deg,#fff,#eff6ff)}.settings-v2__summary span{color:#64748b;font-size:13px;font-weight:800}.settings-v2__summary strong{color:#1d4ed8;font-size:46px}.settings-v2__summary small{color:#475569}.settings-v2__list{display:grid;gap:10px;margin-top:14px}.settings-v2__list div{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px;border-radius:13px;background:#f8fafc;border:1px solid #e2e8f0;color:#475569}.settings-v2__list strong{text-align:end;color:#0f172a}.settings-v2__notice{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:13px 15px;margin-bottom:14px;border-radius:14px;font-weight:750}.settings-v2__notice.is-warning{color:#9a3412;background:#fff7ed;border:1px solid #fed7aa}.settings-v2__notice.is-success{color:#166534;background:#dcfce7;border:1px solid #86efac}.settings-v2__notice.is-error{color:#991b1b;background:#fee2e2;border:1px solid #fecaca}.settings-v2__notice button{border:0;border-radius:9px;padding:8px 11px;color:#fff;background:#991b1b;cursor:pointer}.settings-v2__loading{display:flex;align-items:center;gap:14px;max-width:520px;margin:70px auto;padding:22px;border-radius:20px;background:#fff;box-shadow:0 15px 38px rgba(15,23,42,.08)}.settings-v2__loading p{margin:4px 0 0;color:#64748b}.settings-v2__spinner{width:30px;height:30px;border-radius:50%;border:4px solid #dbeafe;border-top-color:#2563eb;animation:sv2-spin .8s linear infinite}
html.dark .settings-v2{color:#e5e7eb;background:radial-gradient(circle at top left,rgba(37,99,235,.2),transparent 32%),#070d19}html.dark .settings-v2__card,html.dark .settings-v2__summary,html.dark .settings-v2__loading{background:rgba(15,23,42,.92);border-color:#334155;box-shadow:none}html.dark .settings-v2__card h2,html.dark .settings-v2__list strong,html.dark .settings-v2__loading strong{color:#f8fafc}html.dark .settings-v2__card-head p,html.dark .settings-v2__form small,html.dark .settings-v2__loading p{color:#94a3b8}html.dark .settings-v2__form label{color:#cbd5e1}html.dark .settings-v2__form input,html.dark .settings-v2__appearance button{background:#0b1220;border-color:#475569;color:#e5e7eb}html.dark .settings-v2__list div{background:#0b1220;border-color:#334155;color:#94a3b8}html.dark .settings-v2__summary{background:linear-gradient(135deg,#0f172a,#172554)}
@keyframes sv2-spin{to{transform:rotate(360deg)}}@keyframes sv2-in{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}@media(max-width:920px){.settings-v2__layout{grid-template-columns:1fr}.settings-v2__side{grid-template-columns:repeat(2,minmax(0,1fr))}.settings-v2__summary{grid-column:1/-1}}@media(max-width:600px){.settings-v2{padding:13px}.settings-v2__hero{padding:21px;border-radius:20px}.settings-v2__form,.settings-v2__appearance,.settings-v2__side{grid-template-columns:1fr}.settings-v2__summary{grid-column:auto}.settings-v2__card-head{align-items:flex-start}.settings-v2__list div{align-items:flex-start;flex-direction:column}.settings-v2__list strong{text-align:start}}@media(prefers-reduced-motion:reduce){.settings-v2{animation:none}.settings-v2__spinner{animation-duration:1.5s}}
`;
