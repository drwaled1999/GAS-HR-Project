import { useEffect, useMemo, useState } from "react";
import { apiFetch, getProtectedFileUrl } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { formatSaudiIban, normalizeSaudiIban, saudiBanks } from "../../data/banks";

const today = "2026-04-10";

const fallbackTypes = [
  { code: "annual_leave", label: "إجازة سنوية", requiresDateRange: true, requiresAttachment: false, requiresBankFields: false },
  { code: "sick_leave", label: "إجازة مرضية", requiresDateRange: true, requiresAttachment: true, requiresBankFields: false },
  { code: "emergency_leave", label: "إجازة اضطرارية", requiresDateRange: true, requiresAttachment: false, requiresBankFields: false },
  { code: "salary_transfer", label: "تحويل راتب", requiresDateRange: false, requiresAttachment: true, requiresBankFields: true },
];

function prettyStatus(status) {
  const map = {
    pending: "Pending",
    approved: "Approved",
    rejected: "Rejected",
  };
  return map[status] || status;
}

function statusClass(status) {
  if (status === "approved") return "success";
  if (status === "rejected") return "danger";
  return "warning";
}

function typeIcon(code) {
  const icons = {
    annual_leave: "🌴",
    sick_leave: "🩺",
    emergency_leave: "⚠️",
    salary_transfer: "🏦",
  };
  return icons[code] || "📝";
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

export default function EmployeeRequestsPage() {
  const { user } = useAuth();

  const [types, setTypes] = useState([]);
  const [balances, setBalances] = useState([]);
  const [requests, setRequests] = useState([]);
  const [tab, setTab] = useState("new");
  const [filter, setFilter] = useState("all");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [attachment, setAttachment] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    employeeGasId: user?.gasId || "",
    type: "annual_leave",
    startDate: today,
    endDate: today,
    note: "",
    currentBank: "",
    newBank: "",
    newIban: "",
  });

  const safeTypes = safeArray(types).length ? safeArray(types) : fallbackTypes;

  const selectedType = useMemo(
    () => safeTypes.find((item) => item.code === form.type),
    [safeTypes, form.type]
  );

  const quickTypes = useMemo(() => safeTypes.slice(0, 4), [safeTypes]);

  async function load() {
    const username = user?.username ? encodeURIComponent(user.username) : "";

    const [typesResponse, listResponse, balancesResponse] = await Promise.allSettled([
      apiFetch("/requests-center/types"),
      apiFetch(`/requests-center/list?username=${username}`),
      apiFetch(`/requests-center/balances?username=${username}`),
    ]);

    const nextTypes =
      typesResponse.status === "fulfilled"
        ? safeArray(typesResponse.value?.types)
        : fallbackTypes;

    const nextRequests =
      listResponse.status === "fulfilled"
        ? safeArray(listResponse.value?.leaveRequests)
        : [];

    const nextBalances =
      balancesResponse.status === "fulfilled"
        ? safeArray(balancesResponse.value?.balances)
        : [];

    setTypes(nextTypes);
    setRequests(nextRequests);
    setBalances(nextBalances);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message || "Failed to load requests"));
  }, [user?.username]);

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      employeeGasId: user?.gasId || prev.employeeGasId,
      startDate: selectedType?.requiresDateRange === false ? "" : prev.startDate || today,
      endDate: selectedType?.requiresDateRange === false ? "" : prev.endDate || today,
    }));
    setAttachment(null);
  }, [selectedType?.code, user?.gasId]);

  const myRequests = useMemo(() => {
    return requests.filter((request) => {
      const byUsername =
        String(request.requestedBy || request.requestedByName || "").toLowerCase() ===
        String(user?.username || "").toLowerCase();

      const byGasId =
        String(request.employeeGasId || request.gasId || "") === String(user?.gasId || "");

      const byEmployeeId =
        String(request.employeeId || "") === String(user?.employeeId || user?.id || "");

      return byUsername || byGasId || byEmployeeId;
    });
  }, [requests, user?.username, user?.gasId, user?.employeeId, user?.id]);

  const filteredRequests = useMemo(() => {
    if (filter === "all") return myRequests;
    return myRequests.filter((request) => request.status === filter);
  }, [myRequests, filter]);

  function updateField(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!selectedType) {
      setError("اختر نوع الطلب");
      return;
    }

    if (!user?.employeeId && !user?.id) {
      setError("لا يوجد employeeId مربوط بالحساب");
      return;
    }

    if (selectedType.requiresBankFields) {
      const iban = normalizeSaudiIban(form.newIban);
      if (!form.currentBank || !form.newBank || !iban) {
        setError("أكمل بيانات تحويل الراتب");
        return;
      }
      if (!/^SA[0-9A-Z]{22}$/.test(iban)) {
        setError("أدخل آيبان سعودي صحيح يبدأ بـ SA");
        return;
      }
    }

    if (selectedType.requiresAttachment && attachment) {
      // الواجهة تسمح بالاختيار لكن السيرفر الحالي لا يدعم multipart
      setError("رفع المرفقات غير مفعل بعد في السيرفر الحالي");
      return;
    }

    setSubmitting(true);

    try {
      await apiFetch("/requests-center/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: String(user?.employeeId || user?.id || ""),
          type: form.type,
          note: form.note || "",
          startDate: selectedType.requiresDateRange === false ? null : form.startDate || null,
          endDate: selectedType.requiresDateRange === false ? null : form.endDate || null,
          currentBank: form.currentBank || null,
          newBank: form.newBank || null,
          newIban: selectedType.requiresBankFields ? normalizeSaudiIban(form.newIban) : null,
          requestedBy: user?.username || "system",
        }),
      });

      setMessage("تم إرسال الطلب بنجاح");
      setTab("history");
      setForm({
        employeeGasId: user?.gasId || "",
        type: "annual_leave",
        startDate: today,
        endDate: today,
        note: "",
        currentBank: "",
        newBank: "",
        newIban: "",
      });
      setAttachment(null);
      await load();
    } catch (err) {
      console.error("Employee request submit error:", err);
      setError(err.message || "Failed to submit request");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page mobile-page">
      <section className="card mobile-list-card request-hero-card">
        <div className="page-header compact">
          <div>
            <h2>Requests Center</h2>
            <p>قدّم إجازة أو تحويل راتب بخطوات بسيطة.</p>
          </div>
          <span className="soft-badge">GAS ID: {user?.gasId || form.employeeGasId || "-"}</span>
        </div>

        <div className="mobile-tab-row">
          <button type="button" className={`tab-pill ${tab === "new" ? "active" : ""}`} onClick={() => setTab("new")}>
            New Request
          </button>
          <button type="button" className={`tab-pill ${tab === "history" ? "active" : ""}`} onClick={() => setTab("history")}>
            My Requests
          </button>
        </div>
      </section>

      {message ? <div className="alert success">{message}</div> : null}
      {error ? <div className="alert error">{error}</div> : null}

      {tab === "new" ? (
        <>
          <section className="card mobile-list-card">
            <div className="page-header compact">
              <div>
                <h2>Quick Types</h2>
                <p>اختر النوع بسرعة لبدء الطلب.</p>
              </div>
            </div>

            <div className="quick-type-grid">
              {quickTypes.map((type) => (
                <button
                  type="button"
                  key={type.code}
                  className={`quick-type-card ${form.type === type.code ? "active" : ""}`}
                  onClick={() => updateField("type", type.code)}
                >
                  <span className="quick-type-icon">{typeIcon(type.code)}</span>
                  <strong>{type.label}</strong>
                </button>
              ))}
            </div>
          </section>

          <section className="card mobile-list-card">
            <div className="page-header compact">
              <div>
                <h2>Request Details</h2>
                <p>أكمل التفاصيل ثم أرسل الطلب.</p>
              </div>
            </div>

            <form className="form-grid mobile-form request-form-enhanced" onSubmit={handleSubmit}>
              <label className="span-2">
                Request Type
                <select value={form.type} onChange={(e) => updateField("type", e.target.value)}>
                  {safeTypes.map((type) => (
                    <option key={type.code} value={type.code}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </label>

              {selectedType?.requiresDateRange !== false ? (
                <>
                  <label>
                    Start Date
                    <input type="date" value={form.startDate} onChange={(e) => updateField("startDate", e.target.value)} />
                  </label>
                  <label>
                    End Date
                    <input type="date" value={form.endDate} onChange={(e) => updateField("endDate", e.target.value)} />
                  </label>
                </>
              ) : null}

              {selectedType?.requiresBankFields ? (
                <>
                  <label className="span-2">
                    Current Bank
                    <select value={form.currentBank} onChange={(e) => updateField("currentBank", e.target.value)}>
                      <option value="">Select current bank</option>
                      {saudiBanks.map((bank) => (
                        <option key={bank} value={bank}>
                          {bank}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="span-2">
                    New Bank
                    <select value={form.newBank} onChange={(e) => updateField("newBank", e.target.value)}>
                      <option value="">Select new bank</option>
                      {saudiBanks.map((bank) => (
                        <option key={bank} value={bank}>
                          {bank}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="span-2">
                    New IBAN
                    <input
                      value={form.newIban}
                      onChange={(e) => updateField("newIban", formatSaudiIban(e.target.value))}
                      placeholder="SA00 0000 0000 0000 0000 0000"
                    />
                  </label>
                </>
              ) : null}

              <label className="span-2">
                Note
                <textarea
                  rows="3"
                  value={form.note}
                  onChange={(e) => updateField("note", e.target.value)}
                  placeholder="اكتب ملاحظة مختصرة"
                />
              </label>

              <label className="span-2 upload-card">
                <span>Attachment (disabled for now)</span>
                <input type="file" onChange={(e) => setAttachment(e.target.files?.[0] || null)} />
              </label>

              <div className="span-2 mobile-submit-row sticky-submit-row">
                <button type="submit" disabled={submitting}>
                  {submitting ? "Sending..." : "Submit Request"}
                </button>
              </div>
            </form>
          </section>
        </>
      ) : (
        <>
          <section className="card mobile-filter-card">
            <div className="mobile-chip-row">
              {["all", "pending", "approved", "rejected"].map((item) => (
                <button
                  key={item}
                  type="button"
                  className={`chip-button ${filter === item ? "active" : ""}`}
                  onClick={() => setFilter(item)}
                >
                  {item === "all" ? "All" : prettyStatus(item)}
                </button>
              ))}
            </div>
          </section>

          <section className="card mobile-list-card">
            <div className="page-header compact">
              <div>
                <h2>My Requests</h2>
                <p>تابع حالة كل طلب.</p>
              </div>
              <span className="soft-badge">{filteredRequests.length} requests</span>
            </div>

            <div className="mobile-request-list enhanced-request-list">
              {filteredRequests.map((request) => (
                <article key={request.id} className="request-mobile-card request-mobile-card-v2">
                  <div className="request-card-top">
                    <div>
                      <div className="request-title-row">
                        <span className="quick-type-icon">
                          {typeIcon(safeTypes.find((t) => t.label === request.type || t.code === request.type)?.code)}
                        </span>
                        <strong>{request.type}</strong>
                      </div>
                      <p>
                        {request.startDate || "-"}{" "}
                        {request.endDate && request.endDate !== request.startDate ? `→ ${request.endDate}` : ""}
                      </p>
                    </div>
                    <span className={`soft-badge ${statusClass(request.status)}`}>
                      {prettyStatus(request.status)}
                    </span>
                  </div>

                  {request.note ? <p className="request-note">{request.note}</p> : null}

                  <div className="request-card-actions">
                    {request.attachmentPath ? (
                      <a
                        className="ghost-link"
                        href={getProtectedFileUrl(`/files/request/${request.id}`)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        View Attachment
                      </a>
                    ) : (
                      <span className="muted small">No attachment</span>
                    )}
                  </div>
                </article>
              ))}

              {!filteredRequests.length ? <p className="muted">لا توجد طلبات في هذه الحالة.</p> : null}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
