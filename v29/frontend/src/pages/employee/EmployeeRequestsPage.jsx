import { useEffect, useMemo, useState } from "react";
import { apiFetch, getProtectedFileUrl } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { saudiBanks } from "../../data/banks";

const fallbackTypes = [
  {
    code: "annual_leave",
    label: "إجازة سنوية",
    requiresAttachment: false,
    requiresDateRange: true,
    requiresBankFields: false,
  },
  {
    code: "sick_leave",
    label: "إجازة مرضية",
    requiresAttachment: true,
    requiresDateRange: true,
    requiresBankFields: false,
  },
  {
    code: "emergency_leave",
    label: "إجازة اضطرارية",
    requiresAttachment: false,
    requiresDateRange: true,
    requiresBankFields: false,
  },
  {
    code: "salary_transfer",
    label: "تحويل راتب",
    requiresAttachment: true,
    requiresDateRange: false,
    requiresBankFields: true,
  },
  {
    code: "payslip_request",
    label: "طلب تعريف بالراتب / Payslip",
    requiresAttachment: false,
    requiresDateRange: false,
    requiresBankFields: false,
  },
];

const statusLabels = {
  all: "All",
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function calculateRequestedDays(startDate, endDate) {
  if (!startDate) return 0;

  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : new Date(startDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;

  const startOnly = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const endOnly = new Date(end.getFullYear(), end.getMonth(), end.getDate());

  const diffMs = endOnly.getTime() - startOnly.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;

  return diffDays > 0 ? diffDays : 0;
}

function normalizeSaudiIban(value) {
  return String(value || "")
    .replace(/\s+/g, "")
    .toUpperCase();
}

function getRemainingBalanceByType(type, balances) {
  switch (String(type || "").trim().toLowerCase()) {
    case "annual_leave":
      return Number(balances?.annualRemaining ?? 0);
    case "sick_leave":
      return Number(balances?.sickRemaining ?? 0);
    case "emergency_leave":
      return Number(balances?.emergencyRemaining ?? 0);
    default:
      return null;
  }
}

function getBalanceLabelByType(type) {
  switch (String(type || "").trim().toLowerCase()) {
    case "annual_leave":
      return "Annual Leave";
    case "sick_leave":
      return "Sick Leave";
    case "emergency_leave":
      return "Emergency Leave";
    default:
      return "";
  }
}

function formatSaudiIban(value) {
  const iban = normalizeSaudiIban(value);
  return iban.replace(/(.{4})/g, "$1 ").trim();
}

function statusPillClass(status) {
  switch (String(status || "").toLowerCase()) {
    case "approved":
      return "success";
    case "rejected":
      return "danger";
    default:
      return "warning";
  }
}

export default function EmployeeRequestsPage() {
  const { user } = useAuth();
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [types, setTypes] = useState(fallbackTypes);
  const [requests, setRequests] = useState([]);
  const [balances, setBalances] = useState({
    annual: 30,
    annualUsed: 0,
    annualRemaining: 30,
    sick: 15,
    sickUsed: 0,
    sickRemaining: 15,
    emergency: 5,
    emergencyUsed: 0,
    emergencyRemaining: 5,
  });
  const [filter, setFilter] = useState("all");
  const [tab, setTab] = useState("new");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [attachment, setAttachment] = useState(null);
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

  const selectedType = useMemo(() => {
    return (
      types.find((type) => String(type.code) === String(form.type)) ||
      fallbackTypes.find((type) => String(type.code) === String(form.type)) ||
      fallbackTypes[0]
    );
  }, [types, form.type]);

  const safeTypes = useMemo(() => {
    return safeArray(types).length ? safeArray(types) : fallbackTypes;
  }, [types]);

  const topTypes = useMemo(() => safeTypes.slice(0, 5), [safeTypes]);

  const requestedDays = useMemo(() => {
    if (selectedType?.requiresDateRange === false) return 0;
    return calculateRequestedDays(form.startDate, form.endDate);
  }, [selectedType?.requiresDateRange, form.startDate, form.endDate]);

  const remainingForSelectedType = useMemo(() => {
    return getRemainingBalanceByType(form.type, balances);
  }, [form.type, balances]);

  const selectedBalanceLabel = useMemo(() => {
    return getBalanceLabelByType(form.type);
  }, [form.type]);

  const insufficientBalance = useMemo(() => {
    if (selectedType?.requiresDateRange === false) return false;
    if (remainingForSelectedType === null) return false;
    if (!requestedDays) return false;
    return requestedDays > remainingForSelectedType;
  }, [selectedType?.requiresDateRange, remainingForSelectedType, requestedDays]);

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
        ? {
            annual: Number(balancesResponse.value?.balances?.annual ?? 30),
            annualUsed: Number(balancesResponse.value?.balances?.annualUsed ?? 0),
            annualRemaining: Number(
              balancesResponse.value?.balances?.annualRemaining ?? 30
            ),
            sick: Number(balancesResponse.value?.balances?.sick ?? 15),
            sickUsed: Number(balancesResponse.value?.balances?.sickUsed ?? 0),
            sickRemaining: Number(
              balancesResponse.value?.balances?.sickRemaining ?? 15
            ),
            emergency: Number(balancesResponse.value?.balances?.emergency ?? 5),
            emergencyUsed: Number(
              balancesResponse.value?.balances?.emergencyUsed ?? 0
            ),
            emergencyRemaining: Number(
              balancesResponse.value?.balances?.emergencyRemaining ?? 5
            ),
          }
        : {
            annual: 30,
            annualUsed: 0,
            annualRemaining: 30,
            sick: 15,
            sickUsed: 0,
            sickRemaining: 15,
            emergency: 5,
            emergencyUsed: 0,
            emergencyRemaining: 5,
          };

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
      startDate:
        selectedType?.requiresDateRange === false
          ? ""
          : prev.startDate || today,
      endDate:
        selectedType?.requiresDateRange === false
          ? ""
          : prev.endDate || prev.startDate || today,
    }));
    setAttachment(null);
  }, [selectedType?.code, user?.gasId, today]);

  const myRequests = useMemo(() => {
    return requests.filter((request) => {
      const byUsername =
        String(request.requestedBy || request.requestedByName || "").toLowerCase() ===
        String(user?.username || "").toLowerCase();

      const byGasId =
        String(request.employeeGasId || request.gasId || "") ===
        String(user?.gasId || "");

      const byEmployeeId =
        String(request.employeeId || "") ===
        String(user?.employeeId || "");

      return byUsername || byGasId || byEmployeeId;
    });
  }, [requests, user?.username, user?.gasId, user?.employeeId]);

  const filteredRequests = useMemo(() => {
    if (filter === "all") return myRequests;
    return myRequests.filter((request) => request.status === filter);
  }, [myRequests, filter]);

  function updateField(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
    setMessage("");
    setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!selectedType) {
      setError("اختر نوع الطلب");
      return;
    }

    if (!user?.gasId && !user?.employeeId && !form.employeeGasId) {
      setError("الحساب غير مربوط بموظف أو GAS ID");
      return;
    }

    if (selectedType.requiresDateRange && (!form.startDate || !form.endDate)) {
      setError("الرجاء إدخال تاريخ البداية والنهاية");
      return;
    }

    if (selectedType.requiresDateRange && requestedDays <= 0) {
      setError("عدد الأيام غير صحيح");
      return;
    }

    if (insufficientBalance) {
      setError(
        `رصيدك غير كافي في ${selectedBalanceLabel}. المتبقي: ${remainingForSelectedType} يوم، المطلوب: ${requestedDays} يوم`
      );
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

    if (selectedType.requiresAttachment && !attachment) {
      setError("المرفق مطلوب لهذا النوع من الطلبات");
      return;
    }

    setSubmitting(true);

    try {
      const body = new FormData();

      if (user?.employeeId) {
        body.append("employeeId", String(user.employeeId));
      }

      body.append("employeeGasId", String(form.employeeGasId || user?.gasId || ""));
      body.append("requestedBy", user?.username || "system");
      body.append("type", form.type);
      body.append("note", form.note || "");

      if (selectedType.requiresDateRange !== false) {
        body.append("startDate", form.startDate || "");
        body.append("endDate", form.endDate || "");
      }

      if (selectedType.requiresBankFields) {
        body.append("currentBank", form.currentBank);
        body.append("newBank", form.newBank);
        body.append("newIban", normalizeSaudiIban(form.newIban));
      }

      if (attachment) {
        body.append("attachment", attachment);
      }

      await apiFetch("/requests-center/leave", {
        method: "POST",
        body,
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
      <style>{`
        .leave-balance-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
          gap: 14px;
          margin-top: 18px;
        }

        .leave-balance-card {
          border-radius: 22px;
          padding: 18px;
          border: 1px solid #e8edf4;
          background: linear-gradient(180deg, #ffffff, #f8fafc);
          box-shadow: 0 10px 24px rgba(15, 23, 42, 0.05);
        }

        .leave-balance-card.annual {
          background: linear-gradient(135deg, #eff6ff, #ffffff);
        }

        .leave-balance-card.sick {
          background: linear-gradient(135deg, #f0fdf4, #ffffff);
        }

        .leave-balance-card.emergency {
          background: linear-gradient(135deg, #fff7ed, #ffffff);
        }

        .leave-balance-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 16px;
        }

        .leave-balance-label {
          display: block;
          font-size: 0.88rem;
          font-weight: 700;
          color: #64748b;
          margin-bottom: 6px;
        }

        .leave-balance-top h3 {
          margin: 0;
          font-size: 2rem;
          line-height: 1;
          font-weight: 900;
          color: #0f172a;
        }

        .leave-balance-icon {
          width: 46px;
          height: 46px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.9);
          font-size: 1.25rem;
          box-shadow: inset 0 0 0 1px #eef2f7;
        }

        .leave-balance-meta {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
        }

        .leave-balance-meta div {
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.92);
          border: 1px solid #eef2f7;
          padding: 10px;
          text-align: center;
        }

        .leave-balance-meta small {
          display: block;
          font-size: 0.72rem;
          color: #64748b;
          font-weight: 700;
          margin-bottom: 6px;
        }

        .leave-balance-meta strong {
          font-size: 1rem;
          color: #0f172a;
          font-weight: 900;
        }

        .balance-check-card {
          margin-top: 16px;
          border-radius: 20px;
          border: 1px solid #e8edf4;
          background: #ffffff;
          padding: 16px;
        }

        .balance-check-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 14px;
        }

        .balance-check-top strong {
          font-size: 1rem;
          color: #0f172a;
        }

        .balance-check-tag {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 8px 12px;
          border-radius: 999px;
          font-size: 0.82rem;
          font-weight: 800;
          background: #eff6ff;
          color: #1d4ed8;
        }

        .balance-check-stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          gap: 12px;
        }

        .balance-check-stats div {
          border-radius: 14px;
          background: #f8fafc;
          border: 1px solid #eef2f7;
          padding: 12px;
        }

        .balance-check-stats small {
          display: block;
          font-size: 0.72rem;
          color: #64748b;
          font-weight: 700;
          margin-bottom: 6px;
        }

        .balance-check-stats strong {
          font-size: 1rem;
          color: #0f172a;
          font-weight: 900;
        }

        .employee-requests-shell {
          display: grid;
          gap: 18px;
        }

        .employee-requests-tabs {
          display: inline-flex;
          gap: 10px;
          background: #ffffff;
          border: 1px solid #e8edf4;
          padding: 8px;
          border-radius: 999px;
          box-shadow: 0 10px 24px rgba(15, 23, 42, 0.04);
        }

        .employee-requests-tabs button {
          border: none;
          background: transparent;
          color: #475569;
          padding: 10px 16px;
          border-radius: 999px;
          font-weight: 800;
          cursor: pointer;
        }

        .employee-requests-tabs button.active {
          background: #eff6ff;
          color: #1d4ed8;
        }

        .employee-request-form {
          display: grid;
          gap: 16px;
        }

        .employee-request-form-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 14px;
        }

        .employee-request-form label {
          display: grid;
          gap: 8px;
          font-weight: 800;
          color: #0f172a;
        }

        .employee-request-form input,
        .employee-request-form textarea,
        .employee-request-form select {
          width: 100%;
          border: 1px solid #d8e0ea;
          border-radius: 16px;
          padding: 13px 14px;
          font-size: 0.95rem;
          background: #ffffff;
          outline: none;
          box-sizing: border-box;
        }

        .employee-request-form textarea {
          resize: vertical;
          min-height: 110px;
        }

        .employee-request-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          flex-wrap: wrap;
        }

        .employee-request-actions button {
          border: none;
          border-radius: 16px;
          padding: 13px 18px;
          font-weight: 900;
          cursor: pointer;
        }

        .employee-request-actions button.primary {
          background: #2563eb;
          color: #ffffff;
        }

        .employee-request-actions button.secondary {
          background: #e2e8f0;
          color: #0f172a;
        }

        .employee-request-actions button:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }

        .type-pill-row {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .type-pill {
          border: 1px solid #dbe3ee;
          background: #ffffff;
          color: #334155;
          border-radius: 999px;
          padding: 10px 14px;
          font-weight: 800;
          cursor: pointer;
        }

        .type-pill.active {
          background: #eff6ff;
          color: #1d4ed8;
          border-color: #bfdbfe;
        }

        .soft-warning {
          border-radius: 18px;
          border: 1px solid #fed7aa;
          background: #fff7ed;
          color: #9a3412;
          padding: 14px 16px;
          font-weight: 700;
        }

        .soft-info {
          border-radius: 18px;
          border: 1px solid #bfdbfe;
          background: #eff6ff;
          color: #1d4ed8;
          padding: 14px 16px;
          font-weight: 700;
        }

        .soft-error {
          border-radius: 18px;
          border: 1px solid #fecaca;
          background: #fef2f2;
          color: #b91c1c;
          padding: 14px 16px;
          font-weight: 700;
        }

        .soft-success {
          border-radius: 18px;
          border: 1px solid #bbf7d0;
          background: #ecfdf5;
          color: #047857;
          padding: 14px 16px;
          font-weight: 700;
        }

        .history-filter-row {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          margin-bottom: 14px;
        }

        .history-filter-row button {
          border: 1px solid #dbe3ee;
          background: #ffffff;
          color: #334155;
          border-radius: 999px;
          padding: 10px 14px;
          font-weight: 800;
          cursor: pointer;
        }

        .history-filter-row button.active {
          background: #eff6ff;
          color: #1d4ed8;
          border-color: #bfdbfe;
        }

        .request-history-grid {
          display: grid;
          gap: 14px;
        }

        .request-history-card {
          border: 1px solid #e8edf4;
          border-radius: 22px;
          padding: 18px;
          background: #ffffff;
          box-shadow: 0 10px 24px rgba(15, 23, 42, 0.04);
        }

        .request-history-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 14px;
          flex-wrap: wrap;
          margin-bottom: 12px;
        }

        .request-history-head h3 {
          margin: 0;
          font-size: 1rem;
          color: #0f172a;
        }

        .request-history-meta {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
          gap: 12px;
          margin-bottom: 12px;
        }

        .request-history-meta div {
          border-radius: 16px;
          background: #f8fafc;
          border: 1px solid #eef2f7;
          padding: 12px;
        }

        .request-history-meta small {
          display: block;
          font-size: 0.72rem;
          color: #64748b;
          font-weight: 700;
          margin-bottom: 6px;
        }

        .request-history-meta strong {
          color: #0f172a;
          font-weight: 900;
        }

        .request-note {
          margin: 12px 0 0;
          border-radius: 16px;
          background: #f8fafc;
          border: 1px solid #eef2f7;
          padding: 13px 14px;
          color: #334155;
          line-height: 1.7;
        }

        .request-card-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          align-items: center;
          margin-top: 14px;
        }

        .ghost-link {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 14px;
          padding: 10px 14px;
          text-decoration: none;
          font-weight: 900;
          background: #eff6ff;
          color: #1d4ed8;
        }

        .muted {
          color: #64748b;
        }

        .small {
          font-size: 0.86rem;
        }

        @media (max-width: 640px) {
          .leave-balance-meta {
            grid-template-columns: 1fr;
          }

          .balance-check-stats {
            grid-template-columns: 1fr;
          }

          .employee-request-actions {
            justify-content: stretch;
          }

          .employee-request-actions button {
            width: 100%;
          }
        }
      `}</style>

      <div className="employee-requests-shell">
        <div className="employee-requests-tabs">
          <button
            type="button"
            className={tab === "new" ? "active" : ""}
            onClick={() => setTab("new")}
          >
            New Request
          </button>
          <button
            type="button"
            className={tab === "history" ? "active" : ""}
            onClick={() => setTab("history")}
          >
            Request History
          </button>
        </div>

        <section className="card">
          <h2 style={{ marginBottom: 6 }}>Leave Balance</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            View your balances and make sure your selected request does not exceed the remaining days.
          </p>

          <div className="leave-balance-grid">
            <article className="leave-balance-card annual">
              <div className="leave-balance-top">
                <div>
                  <span className="leave-balance-label">Annual Leave</span>
                  <h3>{balances.annualRemaining}</h3>
                </div>
                <span className="leave-balance-icon">🏖️</span>
              </div>

              <div className="leave-balance-meta">
                <div>
                  <small>Total</small>
                  <strong>{balances.annual}</strong>
                </div>
                <div>
                  <small>Used</small>
                  <strong>{balances.annualUsed}</strong>
                </div>
                <div>
                  <small>Remaining</small>
                  <strong>{balances.annualRemaining}</strong>
                </div>
              </div>
            </article>

            <article className="leave-balance-card sick">
              <div className="leave-balance-top">
                <div>
                  <span className="leave-balance-label">Sick Leave</span>
                  <h3>{balances.sickRemaining}</h3>
                </div>
                <span className="leave-balance-icon">🩺</span>
              </div>

              <div className="leave-balance-meta">
                <div>
                  <small>Total</small>
                  <strong>{balances.sick}</strong>
                </div>
                <div>
                  <small>Used</small>
                  <strong>{balances.sickUsed}</strong>
                </div>
                <div>
                  <small>Remaining</small>
                  <strong>{balances.sickRemaining}</strong>
                </div>
              </div>
            </article>

            <article className="leave-balance-card emergency">
              <div className="leave-balance-top">
                <div>
                  <span className="leave-balance-label">Emergency Leave</span>
                  <h3>{balances.emergencyRemaining}</h3>
                </div>
                <span className="leave-balance-icon">⚡</span>
              </div>

              <div className="leave-balance-meta">
                <div>
                  <small>Total</small>
                  <strong>{balances.emergency}</strong>
                </div>
                <div>
                  <small>Used</small>
                  <strong>{balances.emergencyUsed}</strong>
                </div>
                <div>
                  <small>Remaining</small>
                  <strong>{balances.emergencyRemaining}</strong>
                </div>
              </div>
            </article>
          </div>

          <div className="balance-check-card">
            <div className="balance-check-top">
              <strong>Selected Request Check</strong>
              <span className="balance-check-tag">
                {selectedBalanceLabel || "No balance check required"}
              </span>
            </div>

            <div className="balance-check-stats">
              <div>
                <small>Requested Days</small>
                <strong>{requestedDays || 0}</strong>
              </div>
              <div>
                <small>Remaining</small>
                <strong>
                  {remainingForSelectedType === null ? "-" : remainingForSelectedType}
                </strong>
              </div>
              <div>
                <small>Status</small>
                <strong>{insufficientBalance ? "Insufficient" : "OK"}</strong>
              </div>
            </div>
          </div>
        </section>

        {tab === "new" ? (
          <section className="card">
            <div style={{ marginBottom: 16 }}>
              <h2 style={{ marginBottom: 6 }}>New Request</h2>
              <p className="muted" style={{ marginTop: 0 }}>
                Submit leave, salary transfer, or payslip requests.
              </p>
            </div>

            {message ? <div className="soft-success">{message}</div> : null}
            {error ? <div className="soft-error">{error}</div> : null}

            <div className="type-pill-row" style={{ marginBottom: 16 }}>
              {topTypes.map((type) => (
                <button
                  key={type.code}
                  type="button"
                  className={`type-pill ${form.type === type.code ? "active" : ""}`}
                  onClick={() => updateField("type", type.code)}
                >
                  {type.label}
                </button>
              ))}
            </div>

            {insufficientBalance ? (
              <div className="soft-warning">
                رصيدك الحالي في {selectedBalanceLabel} غير كافٍ. المتبقي:{" "}
                {remainingForSelectedType} يوم، المطلوب: {requestedDays} يوم.
              </div>
            ) : selectedBalanceLabel ? (
              <div className="soft-info">
                المتبقي لديك في {selectedBalanceLabel}: {remainingForSelectedType} يوم.
              </div>
            ) : null}

            <form className="employee-request-form" onSubmit={handleSubmit}>
              <div className="employee-request-form-grid">
                <label>
                  GAS ID
                  <input
                    type="text"
                    value={form.employeeGasId}
                    onChange={(event) => updateField("employeeGasId", event.target.value)}
                    placeholder="GAS ID"
                  />
                </label>

                <label>
                  Request Type
                  <select
                    value={form.type}
                    onChange={(event) => updateField("type", event.target.value)}
                  >
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
                      <input
                        type="date"
                        value={form.startDate}
                        onChange={(event) => updateField("startDate", event.target.value)}
                      />
                    </label>

                    <label>
                      End Date
                      <input
                        type="date"
                        value={form.endDate}
                        onChange={(event) => updateField("endDate", event.target.value)}
                      />
                    </label>
                  </>
                ) : null}

                {selectedType?.requiresBankFields ? (
                  <>
                    <label>
                      Current Bank
                      <select
                        value={form.currentBank}
                        onChange={(event) => updateField("currentBank", event.target.value)}
                      >
                        <option value="">Select current bank</option>
                        {saudiBanks.map((bank) => (
                          <option key={`current-${bank}`} value={bank}>
                            {bank}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      New Bank
                      <select
                        value={form.newBank}
                        onChange={(event) => updateField("newBank", event.target.value)}
                      >
                        <option value="">Select new bank</option>
                        {saudiBanks.map((bank) => (
                          <option key={`new-${bank}`} value={bank}>
                            {bank}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label style={{ gridColumn: "1 / -1" }}>
                      New IBAN
                      <input
                        type="text"
                        value={form.newIban}
                        onChange={(event) => updateField("newIban", event.target.value)}
                        placeholder="SAxxxxxxxxxxxxxxxxxxxxxx"
                      />
                    </label>
                  </>
                ) : null}

                <label style={{ gridColumn: "1 / -1" }}>
                  Note
                  <textarea
                    value={form.note}
                    onChange={(event) => updateField("note", event.target.value)}
                    placeholder="Write note..."
                  />
                </label>

                <label style={{ gridColumn: "1 / -1" }}>
                  Attachment {selectedType?.requiresAttachment ? "*" : ""}
                  <input
                    type="file"
                    onChange={(event) => setAttachment(event.target.files?.[0] || null)}
                  />
                </label>
              </div>

              <div className="employee-request-actions">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
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
                    setError("");
                    setMessage("");
                  }}
                >
                  Reset
                </button>

                <button
                  type="submit"
                  className="primary"
                  disabled={submitting || insufficientBalance}
                >
                  {submitting ? "Submitting..." : "Submit Request"}
                </button>
              </div>
            </form>
          </section>
        ) : (
          <section className="card">
            <div style={{ marginBottom: 14 }}>
              <h2 style={{ marginBottom: 6 }}>Request History</h2>
              <p className="muted" style={{ marginTop: 0 }}>
                View all your previous requests and attachments.
              </p>
            </div>

            <div className="history-filter-row">
              {Object.entries(statusLabels).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={filter === key ? "active" : ""}
                  onClick={() => setFilter(key)}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="request-history-grid">
              {filteredRequests.map((request) => {
                const totalRequestedDays =
                  request.startDate && request.endDate
                    ? calculateRequestedDays(request.startDate, request.endDate)
                    : 0;

                return (
                  <article key={request.id} className="request-history-card">
                    <div className="request-history-head">
                      <div>
                        <h3>
                          {safeTypes.find((type) => type.code === request.type)?.label ||
                            request.type ||
                            "Request"}
                        </h3>
                        <p className="muted small" style={{ margin: "8px 0 0" }}>
                          {request.createdAt
                            ? new Date(request.createdAt).toLocaleString()
                            : "No timestamp"}
                        </p>
                      </div>

                      <span className={`soft-badge ${statusPillClass(request.status)}`}>
                        {request.status || "pending"}
                      </span>
                    </div>

                    <div className="request-history-meta">
                      <div>
                        <small>Dates</small>
                        <strong>
                          {request.startDate && request.endDate
                            ? `${request.startDate} → ${request.endDate}`
                            : request.startDate || "-"}
                        </strong>
                      </div>

                      <div>
                        <small>Requested Days</small>
                        <strong>{totalRequestedDays || "-"}</strong>
                      </div>

                      <div>
                        <small>GAS ID</small>
                        <strong>{request.employeeGasId || user?.gasId || "-"}</strong>
                      </div>
                    </div>

                    {request.type === "salary_transfer" ? (
                      <div className="request-history-meta">
                        <div>
                          <small>Current Bank</small>
                          <strong>{request.currentBank || "-"}</strong>
                        </div>
                        <div>
                          <small>New Bank</small>
                          <strong>{request.newBank || "-"}</strong>
                        </div>
                        <div>
                          <small>New IBAN</small>
                          <strong>{formatSaudiIban(request.newIban || "")}</strong>
                        </div>
                      </div>
                    ) : null}

                    {request.note ? (
                      <p className="request-note">{request.note}</p>
                    ) : null}

                    {request.status === "rejected" && request.rejectionReason ? (
                      <p className="request-note">
                        <strong>Reason:</strong> {request.rejectionReason}
                      </p>
                    ) : null}

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

                      {(request.reviewAttachmentPath || request.review_attachment_path) ? (
                        <a
                          className="ghost-link"
                          href={getProtectedFileUrl(`/files/request/${request.id}?kind=review`)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Download Reply Attachment
                        </a>
                      ) : null}

                      {request.reviewerName ? (
                        <span className="muted small">
                          Reviewed by: {request.reviewerName}
                        </span>
                      ) : null}
                    </div>
                  </article>
                );
              })}

              {!filteredRequests.length ? (
                <p className="muted">لا توجد طلبات في هذه الحالة.</p>
              ) : null}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
