import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { formatSaudiIban, normalizeSaudiIban, saudiBanks } from "../../data/banks";

const salaryCertificateBanks = [
  "بنك الراجحي",
  "بنك الرياض",
  "البنك السعودي الفرنسي",
  "أخرى",
];

const fallbackTypes = [
  {
    code: "annual_leave",
    label: "إجازة سنوية",
    requiresDateRange: true,
    requiresAttachment: false,
    requiresBankFields: false,
  },
  {
    code: "sick_leave",
    label: "إجازة مرضية",
    requiresDateRange: true,
    requiresAttachment: true,
    requiresBankFields: false,
  },
  {
    code: "emergency_leave",
    label: "إجازة اضطرارية",
    requiresDateRange: true,
    requiresAttachment: false,
    requiresBankFields: false,
  },
  {
    code: "salary_transfer",
    label: "تحويل راتب",
    requiresDateRange: false,
    requiresAttachment: true,
    requiresBankFields: true,
  },
  {
    code: "salary_certificate",
    label: "طلب تعريف بالراتب",
    requiresDateRange: false,
    requiresAttachment: false,
    requiresBankFields: false,
  },
  {
    code: "payslip_request",
    label: "طلب كشف راتب (Payslip)",
    requiresDateRange: false,
    requiresAttachment: false,
    requiresBankFields: false,
  },
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
    salary_certificate: "📃",
    payslip_request: "📄",
  };
  return icons[code] || "📝";
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function resolveTypeMeta(types, requestType) {
  const list = safeArray(types);
  return (
    list.find((t) => t.code === requestType) ||
    list.find((t) => t.label === requestType) ||
    null
  );
}

function resolveTypeLabel(types, requestType) {
  const item = resolveTypeMeta(types, requestType);
  return item?.label || requestType || "-";
}

function formatDisplayDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString();
}

function calculateRequestedDays(startDate, endDate) {
  if (!startDate) return 0;

  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : new Date(startDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 0;
  }

  const startOnly = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const endOnly = new Date(end.getFullYear(), end.getMonth(), end.getDate());

  const diffMs = endOnly.getTime() - startOnly.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;

  return diffDays > 0 ? diffDays : 0;
}

function getRemainingBalanceByType(typeCode, balances) {
  if (typeCode === "annual_leave") return Number(balances?.annualRemaining ?? 0);
  if (typeCode === "sick_leave") return Number(balances?.sickRemaining ?? 0);
  if (typeCode === "emergency_leave") return Number(balances?.emergencyRemaining ?? 0);
  return null;
}

function getBalanceLabelByType(typeCode) {
  if (typeCode === "annual_leave") return "Annual Leave";
  if (typeCode === "sick_leave") return "Sick Leave";
  if (typeCode === "emergency_leave") return "Emergency Leave";
  return "";
}

function getAuthToken() {
  const possibleKeys = [
    "hr_portal_auth",
    "employee_portal_auth",
    "auth",
    "user_auth",
    "portal_auth",
    "token",
  ];

  for (const key of possibleKeys) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;

    if (key === "token") return raw;

    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed === "string" && parsed.trim()) return parsed;
      if (parsed?.token) return parsed.token;
      if (parsed?.accessToken) return parsed.accessToken;
      if (parsed?.authToken) return parsed.authToken;
      if (parsed?.jwt) return parsed.jwt;
    } catch {
      if (raw.trim()) return raw;
    }
  }

  return "";
}

function getApiBaseUrl() {
  const fromWindow = window?.__API_BASE_URL__;
  if (fromWindow) return String(fromWindow).replace(/\/+$/, "");

  const fromEnv = import.meta?.env?.VITE_API_BASE_URL;
  if (fromEnv) return String(fromEnv).replace(/\/+$/, "");

  return "https://gas-hr-project.onrender.com";
}

function isRemoteUrl(value = "") {
  const text = String(value || "").trim();
  return text.startsWith("http://") || text.startsWith("https://");
}

function buildFileUrl(requestId, kind = "request", filePath = "") {
  if (isRemoteUrl(filePath)) {
    return filePath;
  }

  const base = getApiBaseUrl();
  if (kind === "review") {
    return `${base}/files/request/${requestId}/review`;
  }
  return `${base}/files/request/${requestId}`;
}

function extractFilenameFromDisposition(disposition) {
  if (!disposition) return "";
  const utfMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utfMatch?.[1]) return decodeURIComponent(utfMatch[1]);
  const normalMatch = disposition.match(/filename="?([^"]+)"?/i);
  return normalMatch?.[1] || "";
}

export default function EmployeeRequestsPage() {
  const { user } = useAuth();

  const today = useMemo(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  const [types, setTypes] = useState([]);
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
  const [requests, setRequests] = useState([]);
  const [tab, setTab] = useState("new");
  const [filter, setFilter] = useState("all");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [attachment, setAttachment] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [fileBusyId, setFileBusyId] = useState("");

  const [form, setForm] = useState({
    employeeGasId: user?.gasId || "",
    type: "annual_leave",
    startDate: today,
    endDate: today,
    note: "",
    currentBank: "",
    newBank: "",
    newIban: "",
    salaryCertificateBank: "",
    salaryCertificateOtherBank: "",
  });

  const safeTypes = safeArray(types).length ? safeArray(types) : fallbackTypes;

  const selectedType = useMemo(
    () => safeTypes.find((item) => item.code === form.type),
    [safeTypes, form.type]
  );

  const quickTypes = useMemo(() => safeTypes.slice(0, 6), [safeTypes]);

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
      salaryCertificateBank:
        selectedType?.code === "salary_certificate"
          ? prev.salaryCertificateBank
          : "",
      salaryCertificateOtherBank:
        selectedType?.code === "salary_certificate"
          ? prev.salaryCertificateOtherBank
          : "",
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

    if (form.type === "salary_certificate") {
      if (!form.salaryCertificateBank) {
        setError("اختر الجهة المطلوبة لتعريف الراتب");
        return;
      }

      if (
        form.salaryCertificateBank === "أخرى" &&
        !form.salaryCertificateOtherBank.trim()
      ) {
        setError("اكتب اسم الجهة المطلوبة لتعريف الراتب");
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

      if (form.type === "salary_certificate") {
        const certificateTarget =
          form.salaryCertificateBank === "أخرى"
            ? form.salaryCertificateOtherBank.trim()
            : form.salaryCertificateBank;

        body.append("salaryCertificateTarget", certificateTarget);
        body.append(
          "note",
          `جهة تعريف الراتب: ${certificateTarget}${
            form.note ? `\nملاحظة الموظف: ${form.note}` : ""
          }`
        );
      } else {
        body.append("note", form.note || "");
      }

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
        salaryCertificateBank: "",
        salaryCertificateOtherBank: "",
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

  async function fetchAttachmentResponse(
    requestId,
    kind = "request",
    download = false,
    filePath = ""
  ) {
    const token = getAuthToken();
    const isRemote = isRemoteUrl(filePath);
    const baseUrl = buildFileUrl(requestId, kind, filePath);
    const url = download && !isRemote ? `${baseUrl}?download=1` : baseUrl;

    const response = await fetch(url, {
      method: "GET",
      headers:
        token && !isRemote
          ? {
              Authorization: `Bearer ${token}`,
            }
          : {},
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(text || "Failed to load attachment");
    }

    return response;
  }

  async function handlePreview(requestId, kind = "request", filePath = "") {
    try {
      setFileBusyId(`preview-${kind}-${requestId}`);
      setError("");

      const url = buildFileUrl(requestId, kind, filePath);

      if (!url) {
        throw new Error("No attachment URL");
      }

      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      console.error("Employee preview error:", err);
      setError(err?.message || "تعذر فتح المرفق كمعاينة");
    } finally {
      setFileBusyId("");
    }
  }

  async function handleDownload(requestId, fileName, kind = "request", filePath = "") {
    try {
      setFileBusyId(`download-${kind}-${requestId}-${fileName || ""}`);
      setError("");

      const response = await fetchAttachmentResponse(requestId, kind, true, filePath);
      const blob = await response.blob();

      if (!blob || blob.size === 0) {
        throw new Error("Empty attachment");
      }

      const disposition = response.headers.get("content-disposition") || "";
      const headerFilename = extractFilenameFromDisposition(disposition);
      const finalName = fileName || headerFilename || `attachment-${requestId}`;

      const fileUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = fileUrl;
      a.download = finalName;
      document.body.appendChild(a);
      a.click();
      a.remove();

      setTimeout(() => window.URL.revokeObjectURL(fileUrl), 60000);
    } catch (err) {
      console.error("Employee download error:", err);
      setError(err?.message || "تعذر تحميل المرفق");
    } finally {
      setFileBusyId("");
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

        .balance-check-top h4 {
          margin: 0;
          font-size: 1rem;
          color: #0f172a;
          font-weight: 900;
        }

        .balance-check-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }

        .balance-check-item {
          border-radius: 14px;
          background: #f8fafc;
          border: 1px solid #edf2f7;
          padding: 12px;
          text-align: center;
        }

        .balance-check-item small {
          display: block;
          color: #64748b;
          font-size: 0.72rem;
          font-weight: 700;
          margin-bottom: 6px;
        }

        .balance-check-item strong {
          color: #0f172a;
          font-size: 1rem;
          font-weight: 900;
        }

        .balance-check-alert {
          margin-top: 12px;
          border-radius: 14px;
          padding: 12px 14px;
          font-weight: 800;
          font-size: 0.92rem;
        }

        .balance-check-alert.ok {
          background: #ecfdf3;
          color: #047857;
          border: 1px solid #a7f3d0;
        }

        .balance-check-alert.bad {
          background: #fff1f2;
          color: #be123c;
          border: 1px solid #fecdd3;
        }

        .salary-certificate-box {
          grid-column: span 2;
          border-radius: 22px;
          padding: 16px;
          border: 1px solid #dbeafe;
          background: linear-gradient(135deg, #eff6ff, #ffffff);
          display: grid;
          gap: 14px;
        }

        .salary-certificate-box h4 {
          margin: 0;
          color: #0f172a;
          font-size: 1rem;
          font-weight: 900;
        }

        .salary-certificate-box p {
          margin: 0;
          color: #64748b;
          font-size: 0.88rem;
          line-height: 1.6;
        }

        .request-title-row {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 6px;
        }

        .request-detail-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          margin-top: 12px;
        }

        .request-detail-grid .span-2 {
          grid-column: span 2;
        }

        .request-detail-grid div {
          background: #f8fafc;
          border: 1px solid #edf2f7;
          border-radius: 14px;
          padding: 12px;
        }

        .request-detail-grid span {
          display: block;
          color: #64748b;
          font-size: 0.78rem;
          font-weight: 700;
          margin-bottom: 6px;
        }

        .request-detail-grid strong {
          color: #0f172a;
          font-size: 0.95rem;
          font-weight: 900;
          word-break: break-word;
        }

        .request-note {
          margin-top: 12px;
          background: #f8fafc;
          border: 1px solid #edf2f7;
          border-radius: 14px;
          padding: 12px 14px;
          color: #334155;
          line-height: 1.6;
          white-space: pre-line;
        }

        .request-card-actions {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          margin-top: 14px;
        }

        .ghost-link {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 38px;
          padding: 0 14px;
          border-radius: 12px;
          background: #eef4ff;
          color: #1d4ed8;
          text-decoration: none;
          font-weight: 800;
          border: none;
          cursor: pointer;
        }

        .file-chip {
          display: inline-flex;
          align-items: center;
          min-height: 32px;
          padding: 0 12px;
          border-radius: 999px;
          background: #eff6ff;
          color: #1d4ed8;
          font-size: 0.82rem;
          font-weight: 800;
          margin-top: 10px;
          width: fit-content;
        }

        @media (max-width: 640px) {
          .leave-balance-meta,
          .balance-check-grid,
          .request-detail-grid {
            grid-template-columns: 1fr;
          }

          .request-detail-grid .span-2,
          .salary-certificate-box {
            grid-column: span 1;
          }
        }
      `}</style>

      <section className="card mobile-list-card request-hero-card">
        <div className="page-header compact">
          <div>
            <h2>Requests Center</h2>
            <p>قدّم إجازة أو سكليف أو تحويل راتب أو طلب تعريف بالراتب أو كشف راتب.</p>
          </div>
          <span className="soft-badge">
            GAS ID: {user?.gasId || form.employeeGasId || "-"}
          </span>
        </div>

        <div className="leave-balance-grid">
          <article className="leave-balance-card annual">
            <div className="leave-balance-top">
              <div>
                <span className="leave-balance-label">Annual Leave</span>
                <h3>{balances.annualRemaining}</h3>
              </div>
              <span className="leave-balance-icon">🌴</span>
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
              <span className="leave-balance-icon">⚠️</span>
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

        <div className="mobile-tab-row">
          <button
            type="button"
            className={`tab-pill ${tab === "new" ? "active" : ""}`}
            onClick={() => setTab("new")}
          >
            New Request
          </button>
          <button
            type="button"
            className={`tab-pill ${tab === "history" ? "active" : ""}`}
            onClick={() => setTab("history")}
          >
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
                  <small>
                    {type.requiresAttachment ? "Attachment required" : "Simple request"}
                  </small>
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
              {selectedType ? (
                <span
                  className={`soft-badge ${
                    selectedType.requiresAttachment ? "warning" : ""
                  }`}
                >
                  {selectedType.label}
                </span>
              ) : null}
            </div>

            <form
              className="form-grid mobile-form request-form-enhanced"
              onSubmit={handleSubmit}
            >
              <label className="span-2">
                Request Type
                <select
                  value={form.type}
                  onChange={(e) => updateField("type", e.target.value)}
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
                      onChange={(e) => updateField("startDate", e.target.value)}
                    />
                  </label>
                  <label>
                    End Date
                    <input
                      type="date"
                      value={form.endDate}
                      onChange={(e) => updateField("endDate", e.target.value)}
                    />
                  </label>
                </>
              ) : null}

              {selectedType?.requiresDateRange !== false ? (
                <div className="span-2 balance-check-card">
                  <div className="balance-check-top">
                    <h4>{selectedBalanceLabel || "Leave Balance Check"}</h4>
                    {requestedDays > 0 ? (
                      <span
                        className={`soft-badge ${
                          insufficientBalance ? "danger" : "success"
                        }`}
                      >
                        {insufficientBalance ? "Insufficient Balance" : "Balance OK"}
                      </span>
                    ) : null}
                  </div>

                  <div className="balance-check-grid">
                    <div className="balance-check-item">
                      <small>Requested Days</small>
                      <strong>{requestedDays || 0}</strong>
                    </div>
                    <div className="balance-check-item">
                      <small>Remaining Before Request</small>
                      <strong>{remainingForSelectedType ?? "-"}</strong>
                    </div>
                    <div className="balance-check-item">
                      <small>Remaining After Request</small>
                      <strong>
                        {remainingForSelectedType !== null
                          ? Math.max((remainingForSelectedType || 0) - (requestedDays || 0), 0)
                          : "-"}
                      </strong>
                    </div>
                  </div>

                  {requestedDays > 0 ? (
                    <div
                      className={`balance-check-alert ${
                        insufficientBalance ? "bad" : "ok"
                      }`}
                    >
                      {insufficientBalance
                        ? `رصيدك غير كافي. المتبقي: ${remainingForSelectedType} يوم، المطلوب: ${requestedDays} يوم`
                        : `سيتم خصم ${requestedDays} يوم من ${selectedBalanceLabel}. المتبقي بعد الاعتماد: ${Math.max((remainingForSelectedType || 0) - (requestedDays || 0), 0)} يوم`}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {selectedType?.requiresBankFields ? (
                <>
                  <label className="span-2">
                    Current Bank
                    <select
                      value={form.currentBank}
                      onChange={(e) => updateField("currentBank", e.target.value)}
                    >
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
                    <select
                      value={form.newBank}
                      onChange={(e) => updateField("newBank", e.target.value)}
                    >
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
                      onChange={(e) =>
                        updateField("newIban", formatSaudiIban(e.target.value))
                      }
                      placeholder="SA00 0000 0000 0000 0000 0000"
                    />
                  </label>
                </>
              ) : null}

              {form.type === "salary_certificate" ? (
                <div className="salary-certificate-box">
                  <div>
                    <h4>جهة تعريف الراتب</h4>
                    <p>اختر البنك المطلوب، أو اختر أخرى واكتب اسم الجهة.</p>
                  </div>

                  <label>
                    Bank / Entity
                    <select
                      value={form.salaryCertificateBank}
                      onChange={(e) => {
                        updateField("salaryCertificateBank", e.target.value);
                        if (e.target.value !== "أخرى") {
                          updateField("salaryCertificateOtherBank", "");
                        }
                      }}
                    >
                      <option value="">اختر الجهة</option>
                      {salaryCertificateBanks.map((bank) => (
                        <option key={bank} value={bank}>
                          {bank}
                        </option>
                      ))}
                    </select>
                  </label>

                  {form.salaryCertificateBank === "أخرى" ? (
                    <label>
                      Other Entity
                      <input
                        value={form.salaryCertificateOtherBank}
                        onChange={(e) =>
                          updateField("salaryCertificateOtherBank", e.target.value)
                        }
                        placeholder="مثال: بنك الإنماء، سفارة، جهة حكومية..."
                      />
                    </label>
                  ) : null}
                </div>
              ) : null}

              <label className="span-2">
                Note
                <textarea
                  rows="3"
                  value={form.note}
                  onChange={(e) => updateField("note", e.target.value)}
                  placeholder={
                    form.type === "salary_certificate"
                      ? "اكتب ملاحظتك للمراجع، مثل: أرجو إصدار التعريف باللغة الإنجليزية"
                      : selectedType?.requiresBankFields
                      ? "مثال: تحويل الراتب من البنك الحالي للبنك الجديد"
                      : "اكتب ملاحظة مختصرة"
                  }
                />
              </label>

              <label className="span-2 upload-card">
                <span>
                  Attachment {selectedType?.requiresAttachment ? "(required)" : "(optional)"}
                </span>
                <input
                  type="file"
                  onChange={(e) => setAttachment(e.target.files?.[0] || null)}
                />
                <small className="muted">
                  يمكنك رفع صورة أو PDF. وفي تحويل الراتب أو الإجازة المرضية أرفق المستند المناسب.
                </small>
                {attachment ? <strong className="file-chip">{attachment.name}</strong> : null}
              </label>

              <div className="span-2 mobile-submit-row sticky-submit-row">
                <button type="submit" disabled={submitting || insufficientBalance}>
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
                <p>تابع حالة كل طلب مع المرفقات والتفاصيل.</p>
              </div>
              <span className="soft-badge">{filteredRequests.length} requests</span>
            </div>

            <div className="mobile-request-list enhanced-request-list">
              {filteredRequests.map((request) => {
                const requestTypeMeta = resolveTypeMeta(safeTypes, request.type);
                const requestTypeCode = requestTypeMeta?.code || request.type;
                const requestTypeLabel = resolveTypeLabel(safeTypes, request.type);

                const hasOriginalAttachment = !!request.attachmentPath;

                const reviewFiles = Array.isArray(request.reviewAttachments)
                  ? request.reviewAttachments
                  : [];

                const hasReviewAttachment =
                  reviewFiles.length > 0 || !!request.reviewAttachmentPath;

                return (
                  <article
                    key={request.id}
                    className="request-mobile-card request-mobile-card-v2"
                  >
                    <div className="request-card-top">
                      <div>
                        <div className="request-title-row">
                          <span className="quick-type-icon">
                            {typeIcon(requestTypeCode)}
                          </span>
                          <strong>{requestTypeLabel}</strong>
                        </div>
                        <p>
                          {formatDisplayDate(request.startDate || request.start_date)}{" "}
                          {(request.endDate || request.end_date) &&
                          String(request.endDate || request.end_date) !==
                            String(request.startDate || request.start_date)
                            ? `→ ${formatDisplayDate(request.endDate || request.end_date)}`
                            : ""}
                        </p>
                      </div>
                      <span className={`soft-badge ${statusClass(request.status)}`}>
                        {prettyStatus(request.status)}
                      </span>
                    </div>

                    {request.newBank ? (
                      <div className="request-detail-grid">
                        <div>
                          <span>From</span>
                          <strong>{request.currentBank || "-"}</strong>
                        </div>
                        <div>
                          <span>To</span>
                          <strong>{request.newBank}</strong>
                        </div>
                        <div className="span-2">
                          <span>IBAN</span>
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
                      {hasOriginalAttachment || hasReviewAttachment ? (
                        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                          {hasOriginalAttachment ? (
                            <>
                              <button
                                type="button"
                                className="ghost-link"
                                onClick={() =>
                                  handlePreview(request.id, "request", request.attachmentPath)
                                }
                                disabled={fileBusyId === `preview-request-${request.id}`}
                              >
                                {fileBusyId === `preview-request-${request.id}`
                                  ? "..."
                                  : "View Attachment"}
                              </button>

                              <button
                                type="button"
                                className="ghost-link"
                                onClick={() =>
                                  handleDownload(
                                    request.id,
                                    request.attachmentName || `attachment-${request.id}`,
                                    "request",
                                    request.attachmentPath
                                  )
                                }
                                disabled={
                                  fileBusyId ===
                                  `download-request-${request.id}-${request.attachmentName || `attachment-${request.id}`}`
                                }
                              >
                                {fileBusyId ===
                                `download-request-${request.id}-${request.attachmentName || `attachment-${request.id}`}`
                                  ? "..."
                                  : "Download Attachment"}
                              </button>
                            </>
                          ) : null}

                          {hasReviewAttachment ? (
                            <>
                              {reviewFiles.length ? (
                                reviewFiles.map((file, index) => {
                                  const fileName =
                                    file?.name || `review-file-${index + 1}`;
                                  const filePath = file?.path || "";

                                  return (
                                    <button
                                      key={`${filePath || fileName}-${index}`}
                                      type="button"
                                      className="ghost-link"
                                      onClick={() =>
                                        handleDownload(
                                          request.id,
                                          fileName,
                                          "review",
                                          filePath
                                        )
                                      }
                                      disabled={
                                        fileBusyId ===
                                        `download-review-${request.id}-${fileName}`
                                      }
                                    >
                                      {fileBusyId ===
                                      `download-review-${request.id}-${fileName}`
                                        ? "..."
                                        : `Download Reviewed File ${index + 1}`}
                                    </button>
                                  );
                                })
                              ) : (
                                <button
                                  type="button"
                                  className="ghost-link"
                                  onClick={() =>
                                    handleDownload(
                                      request.id,
                                      request.reviewAttachmentName ||
                                        `review-file-${request.id}`,
                                      "review",
                                      request.reviewAttachmentPath
                                    )
                                  }
                                  disabled={
                                    fileBusyId ===
                                    `download-review-${request.id}-${request.reviewAttachmentName || `review-file-${request.id}`}`
                                  }
                                >
                                  {fileBusyId ===
                                  `download-review-${request.id}-${request.reviewAttachmentName || `review-file-${request.id}`}`
                                    ? "..."
                                    : "Download Reviewed File"}
                                </button>
                              )}
                            </>
                          ) : null}
                        </div>
                      ) : (
                        <span className="muted small">No attachment</span>
                      )}

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
        </>
      )}
    </div>
  );
}
