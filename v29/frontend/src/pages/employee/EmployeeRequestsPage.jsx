import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { formatSaudiIban, normalizeSaudiIban, saudiBanks } from "../../data/banks";
import {
  AlertCircle,
  BadgeCheck,
  Banknote,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  CreditCard,
  Download,
  Eye,
  FileCheck2,
  FileText,
  Filter,
  Landmark,
  Loader2,
  Paperclip,
  PlusCircle,
  Send,
  ShieldCheck,
  Stethoscope,
  Umbrella,
  UserRound,
  XCircle,
} from "lucide-react";

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

function TypeIcon({ code, size = 22 }) {
  const props = { size };
  if (code === "annual_leave") return <Umbrella {...props} />;
  if (code === "sick_leave") return <Stethoscope {...props} />;
  if (code === "emergency_leave") return <AlertCircle {...props} />;
  if (code === "salary_transfer") return <Landmark {...props} />;
  if (code === "salary_certificate") return <FileCheck2 {...props} />;
  if (code === "payslip_request") return <FileText {...props} />;
  return <FileText {...props} />;
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
            sickRemaining: Number(balancesResponse.value?.balances?.sickRemaining ?? 15),
            emergency: Number(balancesResponse.value?.balances?.emergency ?? 5),
            emergencyUsed: Number(balancesResponse.value?.balances?.emergencyUsed ?? 0),
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
        selectedType?.requiresDateRange === false ? "" : prev.startDate || today,
      endDate:
        selectedType?.requiresDateRange === false
          ? ""
          : prev.endDate || prev.startDate || today,
      salaryCertificateBank:
        selectedType?.code === "salary_certificate" ? prev.salaryCertificateBank : "",
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
        String(request.employeeGasId || request.gasId || "") === String(user?.gasId || "");

      const byEmployeeId =
        String(request.employeeId || "") === String(user?.employeeId || "");

      return byUsername || byGasId || byEmployeeId;
    });
  }, [requests, user?.username, user?.gasId, user?.employeeId]);

  const filteredRequests = useMemo(() => {
    if (filter === "all") return myRequests;
    return myRequests.filter((request) => request.status === filter);
  }, [myRequests, filter]);

  const pendingCount = useMemo(
    () => myRequests.filter((request) => request.status === "pending").length,
    [myRequests]
  );

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
    <>
      <style>{`
        .emp-requests-page {
          min-height: 100vh;
          padding: clamp(14px, 3vw, 30px);
          padding-bottom: 190px;
          background:
            radial-gradient(circle at top left, rgba(37,99,235,.13), transparent 32%),
            radial-gradient(circle at top right, rgba(14,165,233,.12), transparent 28%),
            linear-gradient(180deg, #f8fafc 0%, #eef2ff 45%, #f8fafc 100%);
          box-sizing: border-box;
          font-family: Inter, Segoe UI, Arial, sans-serif;
        }

        .emp-requests-container {
          width: 100%;
          max-width: 1240px;
          margin: 0 auto;
        }

        .requests-hero {
          position: relative;
          overflow: hidden;
          border-radius: 34px;
          padding: clamp(22px, 4vw, 42px);
          color: #fff;
          background: linear-gradient(135deg, #020617 0%, #0f172a 42%, #1d4ed8 100%);
          box-shadow: 0 30px 80px rgba(15,23,42,.28);
        }

        .requests-hero::before {
          content: "";
          position: absolute;
          width: 360px;
          height: 360px;
          right: -120px;
          top: -130px;
          border-radius: 999px;
          background: rgba(59,130,246,.45);
          filter: blur(12px);
        }

        .requests-hero::after {
          content: "";
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(255,255,255,.07) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,.07) 1px, transparent 1px);
          background-size: 34px 34px;
          opacity: .34;
        }

        .hero-inner {
          position: relative;
          z-index: 2;
        }

        .hero-title-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 22px;
          flex-wrap: wrap;
        }

        .hero-kicker {
          width: fit-content;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 9px 13px;
          border-radius: 999px;
          background: rgba(255,255,255,.12);
          border: 1px solid rgba(255,255,255,.18);
          color: rgba(255,255,255,.82);
          font-size: 13px;
          font-weight: 900;
          backdrop-filter: blur(12px);
        }

        .hero-title {
          margin: 16px 0 10px;
          font-size: clamp(31px, 5vw, 56px);
          line-height: 1.04;
          font-weight: 950;
          letter-spacing: -1.4px;
        }

        .hero-subtitle {
          max-width: 720px;
          margin: 0;
          color: rgba(255,255,255,.76);
          line-height: 1.8;
          font-size: 15px;
          font-weight: 600;
        }

        .hero-employee-card {
          min-width: 260px;
          padding: 16px;
          border-radius: 24px;
          background: rgba(255,255,255,.12);
          border: 1px solid rgba(255,255,255,.18);
          backdrop-filter: blur(14px);
          display: flex;
          align-items: center;
          gap: 13px;
        }

        .hero-employee-avatar {
          width: 54px;
          height: 54px;
          border-radius: 18px;
          background: linear-gradient(135deg, #fff, #dbeafe);
          color: #1d4ed8;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .hero-employee-card span {
          display: block;
          font-size: 12px;
          color: rgba(255,255,255,.65);
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: .5px;
        }

        .hero-employee-card strong {
          display: block;
          margin-top: 4px;
          font-size: 16px;
          color: #fff;
          font-weight: 950;
          word-break: break-word;
        }

        .request-hero-stats {
          margin-top: 30px;
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
        }

        .request-stat-card {
          display: flex;
          align-items: center;
          gap: 13px;
          padding: 16px;
          border-radius: 22px;
          background: rgba(255,255,255,.12);
          border: 1px solid rgba(255,255,255,.16);
          backdrop-filter: blur(14px);
          min-width: 0;
        }

        .request-stat-icon {
          width: 46px;
          height: 46px;
          border-radius: 16px;
          background: rgba(255,255,255,.16);
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .request-stat-card span {
          display: block;
          font-size: 11px;
          color: rgba(255,255,255,.64);
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .6px;
        }

        .request-stat-card strong {
          display: block;
          margin-top: 4px;
          color: #fff;
          font-size: 22px;
          font-weight: 950;
          word-break: break-word;
        }

        .premium-tabs {
          margin-top: 20px;
          padding: 8px;
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
          border-radius: 22px;
          background: rgba(255,255,255,.72);
          border: 1px solid rgba(226,232,240,.9);
          box-shadow: 0 20px 50px rgba(15,23,42,.08);
        }

        .premium-tab {
          border: none;
          min-height: 54px;
          border-radius: 17px;
          background: transparent;
          color: #64748b;
          font-weight: 950;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          transition: .2s ease;
        }

        .premium-tab.active {
          background: #0f172a;
          color: #fff;
          box-shadow: 0 14px 30px rgba(15,23,42,.18);
        }

        .premium-alert {
          margin-top: 16px;
          border-radius: 20px;
          padding: 14px 16px;
          display: flex;
          align-items: center;
          gap: 10px;
          font-weight: 900;
          box-shadow: 0 14px 30px rgba(15,23,42,.06);
        }

        .premium-alert.success {
          background: #ecfdf3;
          border: 1px solid #a7f3d0;
          color: #047857;
        }

        .premium-alert.error {
          background: #fff1f2;
          border: 1px solid #fecdd3;
          color: #be123c;
        }

        .requests-layout {
          margin-top: 20px;
          display: grid;
          grid-template-columns: minmax(0, .85fr) minmax(0, 1.25fr);
          gap: 20px;
          align-items: start;
        }

        .premium-panel {
          background: rgba(255,255,255,.94);
          border: 1px solid rgba(226,232,240,.9);
          border-radius: 30px;
          padding: 22px;
          box-shadow: 0 22px 55px rgba(15,23,42,.08);
        }

        .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          margin-bottom: 18px;
        }

        .panel-kicker {
          margin: 0;
          color: #2563eb;
          font-size: 12px;
          font-weight: 950;
          text-transform: uppercase;
          letter-spacing: .7px;
        }

        .panel-title {
          margin: 5px 0 0;
          color: #0f172a;
          font-size: 22px;
          font-weight: 950;
          letter-spacing: -.4px;
        }

        .panel-subtitle {
          margin: 7px 0 0;
          color: #64748b;
          line-height: 1.7;
          font-size: 14px;
        }

        .panel-icon {
          width: 52px;
          height: 52px;
          border-radius: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #eff6ff;
          color: #1d4ed8;
          flex-shrink: 0;
        }

        .quick-type-grid-premium {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 13px;
        }

        .quick-type-premium {
          border: 1px solid #e2e8f0;
          border-radius: 24px;
          padding: 16px;
          background: #fff;
          text-align: left;
          cursor: pointer;
          transition: .2s ease;
          box-shadow: 0 12px 26px rgba(15,23,42,.05);
        }

        .quick-type-premium:hover {
          transform: translateY(-2px);
          border-color: #bfdbfe;
          box-shadow: 0 18px 40px rgba(37,99,235,.11);
        }

        .quick-type-premium.active {
          background: linear-gradient(135deg, #0f172a 0%, #1d4ed8 100%);
          color: #fff;
          border-color: transparent;
          box-shadow: 0 20px 45px rgba(29,78,216,.24);
        }

        .quick-type-icon-box {
          width: 46px;
          height: 46px;
          border-radius: 17px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #eff6ff;
          color: #1d4ed8;
          margin-bottom: 13px;
        }

        .quick-type-premium.active .quick-type-icon-box {
          background: rgba(255,255,255,.16);
          color: #fff;
        }

        .quick-type-premium strong {
          display: block;
          color: #0f172a;
          font-size: 15px;
          font-weight: 950;
          line-height: 1.4;
        }

        .quick-type-premium.active strong {
          color: #fff;
        }

        .quick-type-premium small {
          display: block;
          margin-top: 7px;
          color: #64748b;
          font-weight: 800;
          line-height: 1.5;
        }

        .quick-type-premium.active small {
          color: rgba(255,255,255,.72);
        }

        .premium-form {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 15px;
        }

        .premium-field {
          display: grid;
          gap: 8px;
          color: #0f172a;
          font-size: 13px;
          font-weight: 950;
        }

        .premium-field.span-2 {
          grid-column: span 2;
        }

        .premium-field input,
        .premium-field select,
        .premium-field textarea {
          width: 100%;
          border: 1px solid #dbe3ef;
          background: #f8fafc;
          color: #0f172a;
          border-radius: 17px;
          padding: 13px 14px;
          font-size: 14px;
          outline: none;
          box-sizing: border-box;
          transition: .2s ease;
          font-family: inherit;
        }

        .premium-field textarea {
          resize: vertical;
          min-height: 100px;
        }

        .premium-field input:focus,
        .premium-field select:focus,
        .premium-field textarea:focus {
          border-color: #2563eb;
          background: #fff;
          box-shadow: 0 0 0 4px rgba(37,99,235,.1);
        }

        .balance-check-premium {
          grid-column: span 2;
          border-radius: 24px;
          border: 1px solid #dbeafe;
          background: linear-gradient(135deg, #eff6ff 0%, #ffffff 100%);
          padding: 16px;
        }

        .balance-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 13px;
        }

        .balance-top h4 {
          margin: 0;
          color: #0f172a;
          font-size: 16px;
          font-weight: 950;
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          min-height: 34px;
          padding: 0 12px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 950;
          border: 1px solid transparent;
        }

        .status-badge.success {
          background: #ecfdf3;
          color: #047857;
          border-color: #a7f3d0;
        }

        .status-badge.warning {
          background: #fffbeb;
          color: #b45309;
          border-color: #fde68a;
        }

        .status-badge.danger {
          background: #fff1f2;
          color: #be123c;
          border-color: #fecdd3;
        }

        .balance-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }

        .balance-item {
          border-radius: 17px;
          background: rgba(255,255,255,.85);
          border: 1px solid #dbeafe;
          padding: 13px;
          text-align: center;
        }

        .balance-item small {
          display: block;
          color: #64748b;
          font-size: 11px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .4px;
          margin-bottom: 6px;
        }

        .balance-item strong {
          color: #0f172a;
          font-size: 20px;
          font-weight: 950;
        }

        .balance-alert {
          margin-top: 12px;
          border-radius: 16px;
          padding: 12px 14px;
          font-weight: 900;
          line-height: 1.6;
          font-size: 13px;
        }

        .balance-alert.ok {
          background: #ecfdf3;
          color: #047857;
          border: 1px solid #a7f3d0;
        }

        .balance-alert.bad {
          background: #fff1f2;
          color: #be123c;
          border: 1px solid #fecdd3;
        }

        .salary-box-premium {
          grid-column: span 2;
          border-radius: 24px;
          padding: 16px;
          border: 1px solid #dbeafe;
          background: linear-gradient(135deg, #eff6ff, #ffffff);
          display: grid;
          gap: 14px;
        }

        .salary-box-premium h4 {
          margin: 0;
          color: #0f172a;
          font-size: 16px;
          font-weight: 950;
        }

        .salary-box-premium p {
          margin: 6px 0 0;
          color: #64748b;
          line-height: 1.7;
          font-size: 13px;
        }

        .upload-premium {
          grid-column: span 2;
          border-radius: 24px;
          padding: 18px;
          border: 1px dashed #93c5fd;
          background: linear-gradient(135deg, #eff6ff, #ffffff);
          display: grid;
          gap: 10px;
        }

        .upload-title {
          display: flex;
          align-items: center;
          gap: 9px;
          color: #0f172a;
          font-size: 14px;
          font-weight: 950;
        }

        .upload-premium input {
          background: #fff;
          border-style: solid;
        }

        .upload-hint {
          color: #64748b;
          line-height: 1.6;
          font-size: 13px;
          font-weight: 700;
        }

        .file-chip-premium {
          width: fit-content;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          min-height: 36px;
          padding: 0 12px;
          border-radius: 999px;
          background: #dbeafe;
          color: #1d4ed8;
          font-size: 13px;
          font-weight: 950;
        }

        .submit-row-premium {
          grid-column: span 2;
          display: flex;
          justify-content: flex-end;
        }

        .submit-button-premium {
          min-height: 56px;
          min-width: 210px;
          border: none;
          border-radius: 19px;
          background: linear-gradient(135deg, #0f172a 0%, #1d4ed8 100%);
          color: #fff;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          font-size: 15px;
          font-weight: 950;
          cursor: pointer;
          box-shadow: 0 18px 36px rgba(29,78,216,.22);
        }

        .submit-button-premium:disabled {
          cursor: not-allowed;
          opacity: .6;
          box-shadow: none;
        }

        .history-panel {
          margin-top: 20px;
        }

        .history-toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 14px;
          flex-wrap: wrap;
          margin-bottom: 18px;
        }

        .filter-chips {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .chip-filter {
          min-height: 40px;
          padding: 0 14px;
          border-radius: 999px;
          border: 1px solid #dbe3ef;
          background: #fff;
          color: #64748b;
          font-weight: 950;
          cursor: pointer;
        }

        .chip-filter.active {
          background: #0f172a;
          color: #fff;
          border-color: #0f172a;
        }

        .request-list-premium {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: 15px;
        }

        .request-card-premium {
          position: relative;
          overflow: hidden;
          border-radius: 26px;
          background: #fff;
          border: 1px solid #e2e8f0;
          padding: 18px;
          box-shadow: 0 18px 42px rgba(15,23,42,.07);
        }

        .request-card-premium::before {
          content: "";
          position: absolute;
          inset: 0 0 auto 0;
          height: 5px;
          background: linear-gradient(90deg, #1d4ed8, #38bdf8);
        }

        .request-card-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
        }

        .request-title-group {
          display: flex;
          gap: 12px;
          align-items: flex-start;
          min-width: 0;
        }

        .request-type-icon {
          width: 48px;
          height: 48px;
          border-radius: 17px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #eff6ff;
          color: #1d4ed8;
          flex-shrink: 0;
        }

        .request-title-group strong {
          display: block;
          color: #0f172a;
          font-size: 16px;
          font-weight: 950;
          line-height: 1.45;
        }

        .request-title-group p {
          margin: 5px 0 0;
          color: #64748b;
          font-size: 13px;
          font-weight: 800;
        }

        .request-detail-grid-premium {
          margin-top: 14px;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .request-detail-grid-premium .span-2 {
          grid-column: span 2;
        }

        .request-detail-item {
          background: #f8fafc;
          border: 1px solid #edf2f7;
          border-radius: 16px;
          padding: 12px;
        }

        .request-detail-item span {
          display: block;
          color: #64748b;
          font-size: 11px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .4px;
          margin-bottom: 6px;
        }

        .request-detail-item strong {
          color: #0f172a;
          font-size: 14px;
          font-weight: 950;
          word-break: break-word;
        }

        .request-note-premium {
          margin-top: 12px;
          background: #f8fafc;
          border: 1px solid #edf2f7;
          border-radius: 16px;
          padding: 12px 14px;
          color: #334155;
          line-height: 1.7;
          white-space: pre-line;
          font-size: 13px;
          font-weight: 700;
        }

        .request-actions-premium {
          margin-top: 14px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .attachment-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .attachment-button {
          min-height: 38px;
          padding: 0 13px;
          border-radius: 13px;
          background: #eef4ff;
          color: #1d4ed8;
          border: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          font-size: 12px;
          font-weight: 950;
          cursor: pointer;
        }

        .attachment-button:disabled {
          opacity: .6;
          cursor: not-allowed;
        }

        .reviewer-text {
          color: #64748b;
          font-size: 12px;
          font-weight: 800;
        }

        .empty-state-premium {
          border: 1px dashed #cbd5e1;
          background: #f8fafc;
          border-radius: 24px;
          padding: 34px 18px;
          text-align: center;
          color: #64748b;
          font-weight: 850;
          line-height: 1.7;
        }

        @media (max-width: 980px) {
          .request-hero-stats {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .requests-layout {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 640px) {
          .emp-requests-page {
            padding: 14px;
            padding-bottom: 190px;
          }

          .requests-hero {
            border-radius: 28px;
            padding: 22px;
          }

          .hero-title-row {
            gap: 18px;
          }

          .hero-title {
            font-size: 34px;
            letter-spacing: -.8px;
          }

          .hero-subtitle {
            font-size: 14px;
          }

          .hero-employee-card {
            width: 100%;
            min-width: 0;
          }

          .request-hero-stats {
            grid-template-columns: 1fr;
          }

          .premium-tabs {
            grid-template-columns: 1fr;
          }

          .premium-panel {
            border-radius: 24px;
            padding: 18px;
          }

          .panel-title {
            font-size: 20px;
          }

          .quick-type-grid-premium {
            grid-template-columns: 1fr;
          }

          .premium-form {
            grid-template-columns: 1fr;
          }

          .premium-field.span-2,
          .balance-check-premium,
          .salary-box-premium,
          .upload-premium,
          .submit-row-premium {
            grid-column: span 1;
          }

          .balance-grid,
          .request-detail-grid-premium {
            grid-template-columns: 1fr;
          }

          .request-detail-grid-premium .span-2 {
            grid-column: span 1;
          }

          .submit-row-premium {
            position: sticky;
            bottom: 86px;
            z-index: 20;
          }

          .submit-button-premium {
            width: 100%;
            min-width: 0;
          }

          .request-list-premium {
            grid-template-columns: 1fr;
          }

          .request-card-head {
            flex-direction: column;
          }

          .status-badge {
            width: fit-content;
          }
        }
      `}</style>

      <div className="emp-requests-page">
        <div className="emp-requests-container">
          <section className="requests-hero">
            <div className="hero-inner">
              <div className="hero-title-row">
                <div>
                  <div className="hero-kicker">
                    <ShieldCheck size={15} />
                    Employee Self Service
                  </div>
                  <h1 className="hero-title">Requests Center</h1>
                  <p className="hero-subtitle">
                    قدّم طلبات الإجازة، تحويل الراتب، تعريف الراتب، وكشف الراتب من مكان واحد
                    مع متابعة حالة كل طلب والمرفقات.
                  </p>
                </div>

                <div className="hero-employee-card">
                  <div className="hero-employee-avatar">
                    <UserRound size={25} />
                  </div>
                  <div>
                    <span>Employee GAS ID</span>
                    <strong>{user?.gasId || form.employeeGasId || "-"}</strong>
                  </div>
                </div>
              </div>

              <div className="request-hero-stats">
                <div className="request-stat-card">
                  <div className="request-stat-icon">
                    <Umbrella size={21} />
                  </div>
                  <div>
                    <span>Annual Remaining</span>
                    <strong>{balances.annualRemaining}</strong>
                  </div>
                </div>

                <div className="request-stat-card">
                  <div className="request-stat-icon">
                    <Stethoscope size={21} />
                  </div>
                  <div>
                    <span>Sick Remaining</span>
                    <strong>{balances.sickRemaining}</strong>
                  </div>
                </div>

                <div className="request-stat-card">
                  <div className="request-stat-icon">
                    <AlertCircle size={21} />
                  </div>
                  <div>
                    <span>Emergency Remaining</span>
                    <strong>{balances.emergencyRemaining}</strong>
                  </div>
                </div>

                <div className="request-stat-card">
                  <div className="request-stat-icon">
                    <Clock3 size={21} />
                  </div>
                  <div>
                    <span>Pending Requests</span>
                    <strong>{pendingCount}</strong>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <div className="premium-tabs">
            <button
              type="button"
              className={`premium-tab ${tab === "new" ? "active" : ""}`}
              onClick={() => setTab("new")}
            >
              <PlusCircle size={18} />
              New Request
            </button>

            <button
              type="button"
              className={`premium-tab ${tab === "history" ? "active" : ""}`}
              onClick={() => setTab("history")}
            >
              <FileText size={18} />
              My Requests
            </button>
          </div>

          {message ? (
            <div className="premium-alert success">
              <CheckCircle2 size={18} />
              {message}
            </div>
          ) : null}

          {error ? (
            <div className="premium-alert error">
              <XCircle size={18} />
              {error}
            </div>
          ) : null}

          {tab === "new" ? (
            <section className="requests-layout">
              <aside className="premium-panel">
                <div className="panel-header">
                  <div>
                    <p className="panel-kicker">Quick Types</p>
                    <h2 className="panel-title">Select Request</h2>
                    <p className="panel-subtitle">
                      اختر نوع الطلب وسيتم تجهيز الحقول المطلوبة تلقائيًا.
                    </p>
                  </div>
                  <div className="panel-icon">
                    <FileText size={22} />
                  </div>
                </div>

                <div className="quick-type-grid-premium">
                  {quickTypes.map((type) => (
                    <button
                      type="button"
                      key={type.code}
                      className={`quick-type-premium ${
                        form.type === type.code ? "active" : ""
                      }`}
                      onClick={() => updateField("type", type.code)}
                    >
                      <div className="quick-type-icon-box">
                        <TypeIcon code={type.code} size={22} />
                      </div>
                      <strong>{type.label}</strong>
                      <small>
                        {type.requiresAttachment
                          ? "Attachment required"
                          : type.requiresDateRange
                          ? "Date range required"
                          : "Simple request"}
                      </small>
                    </button>
                  ))}
                </div>
              </aside>

              <section className="premium-panel">
                <div className="panel-header">
                  <div>
                    <p className="panel-kicker">Request Details</p>
                    <h2 className="panel-title">Complete Your Request</h2>
                    <p className="panel-subtitle">
                      عبّئ البيانات المطلوبة ثم اضغط إرسال الطلب.
                    </p>
                  </div>
                  <div className="panel-icon">
                    <Send size={22} />
                  </div>
                </div>

                <form className="premium-form" onSubmit={handleSubmit}>
                  <label className="premium-field span-2">
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
                      <label className="premium-field">
                        Start Date
                        <input
                          type="date"
                          value={form.startDate}
                          onChange={(e) => updateField("startDate", e.target.value)}
                        />
                      </label>

                      <label className="premium-field">
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
                    <div className="balance-check-premium">
                      <div className="balance-top">
                        <h4>{selectedBalanceLabel || "Leave Balance Check"}</h4>

                        {requestedDays > 0 ? (
                          <span
                            className={`status-badge ${
                              insufficientBalance ? "danger" : "success"
                            }`}
                          >
                            {insufficientBalance ? (
                              <XCircle size={14} />
                            ) : (
                              <CheckCircle2 size={14} />
                            )}
                            {insufficientBalance ? "Insufficient Balance" : "Balance OK"}
                          </span>
                        ) : null}
                      </div>

                      <div className="balance-grid">
                        <div className="balance-item">
                          <small>Requested</small>
                          <strong>{requestedDays || 0}</strong>
                        </div>
                        <div className="balance-item">
                          <small>Before</small>
                          <strong>{remainingForSelectedType ?? "-"}</strong>
                        </div>
                        <div className="balance-item">
                          <small>After</small>
                          <strong>
                            {remainingForSelectedType !== null
                              ? Math.max(
                                  (remainingForSelectedType || 0) - (requestedDays || 0),
                                  0
                                )
                              : "-"}
                          </strong>
                        </div>
                      </div>

                      {requestedDays > 0 ? (
                        <div
                          className={`balance-alert ${
                            insufficientBalance ? "bad" : "ok"
                          }`}
                        >
                          {insufficientBalance
                            ? `رصيدك غير كافي. المتبقي: ${remainingForSelectedType} يوم، المطلوب: ${requestedDays} يوم`
                            : `سيتم خصم ${requestedDays} يوم من ${selectedBalanceLabel}. المتبقي بعد الاعتماد: ${Math.max(
                                (remainingForSelectedType || 0) - (requestedDays || 0),
                                0
                              )} يوم`}
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {selectedType?.requiresBankFields ? (
                    <>
                      <label className="premium-field span-2">
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

                      <label className="premium-field span-2">
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

                      <label className="premium-field span-2">
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
                    <div className="salary-box-premium">
                      <div>
                        <h4>جهة تعريف الراتب</h4>
                        <p>اختر البنك المطلوب، أو اختر أخرى واكتب اسم الجهة.</p>
                      </div>

                      <label className="premium-field">
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
                        <label className="premium-field">
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

                  <label className="premium-field span-2">
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

                  <label className="upload-premium">
                    <span className="upload-title">
                      <Paperclip size={18} />
                      Attachment{" "}
                      {selectedType?.requiresAttachment ? "(required)" : "(optional)"}
                    </span>

                    <input
                      type="file"
                      onChange={(e) => setAttachment(e.target.files?.[0] || null)}
                    />

                    <span className="upload-hint">
                      يمكنك رفع صورة أو PDF. وفي تحويل الراتب أو الإجازة المرضية أرفق
                      المستند المناسب.
                    </span>

                    {attachment ? (
                      <strong className="file-chip-premium">
                        <Paperclip size={15} />
                        {attachment.name}
                      </strong>
                    ) : null}
                  </label>

                  <div className="submit-row-premium">
                    <button
                      type="submit"
                      className="submit-button-premium"
                      disabled={submitting || insufficientBalance}
                    >
                      {submitting ? (
                        <>
                          <Loader2 size={18} />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Send size={18} />
                          Submit Request
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </section>
            </section>
          ) : (
            <section className="premium-panel history-panel">
              <div className="history-toolbar">
                <div>
                  <p className="panel-kicker">History</p>
                  <h2 className="panel-title">My Requests</h2>
                  <p className="panel-subtitle">
                    تابع حالة كل طلب مع المرفقات والتفاصيل.
                  </p>
                </div>

                <div className="filter-chips">
                  <span className="status-badge">
                    <Filter size={14} />
                    Filter
                  </span>

                  {["all", "pending", "approved", "rejected"].map((item) => (
                    <button
                      key={item}
                      type="button"
                      className={`chip-filter ${filter === item ? "active" : ""}`}
                      onClick={() => setFilter(item)}
                    >
                      {item === "all" ? "All" : prettyStatus(item)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="request-list-premium">
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
                    <article key={request.id} className="request-card-premium">
                      <div className="request-card-head">
                        <div className="request-title-group">
                          <div className="request-type-icon">
                            <TypeIcon code={requestTypeCode} size={22} />
                          </div>

                          <div>
                            <strong>{requestTypeLabel}</strong>
                            <p>
                              <CalendarDays size={13} />{" "}
                              {formatDisplayDate(request.startDate || request.start_date)}{" "}
                              {(request.endDate || request.end_date) &&
                              String(request.endDate || request.end_date) !==
                                String(request.startDate || request.start_date)
                                ? `→ ${formatDisplayDate(
                                    request.endDate || request.end_date
                                  )}`
                                : ""}
                            </p>
                          </div>
                        </div>

                        <span className={`status-badge ${statusClass(request.status)}`}>
                          {request.status === "approved" ? <CheckCircle2 size={14} /> : null}
                          {request.status === "rejected" ? <XCircle size={14} /> : null}
                          {request.status === "pending" ? <Clock3 size={14} /> : null}
                          {prettyStatus(request.status)}
                        </span>
                      </div>

                      {request.newBank ? (
                        <div className="request-detail-grid-premium">
                          <div className="request-detail-item">
                            <span>From</span>
                            <strong>{request.currentBank || "-"}</strong>
                          </div>
                          <div className="request-detail-item">
                            <span>To</span>
                            <strong>{request.newBank}</strong>
                          </div>
                          <div className="request-detail-item span-2">
                            <span>IBAN</span>
                            <strong>{formatSaudiIban(request.newIban || "")}</strong>
                          </div>
                        </div>
                      ) : null}

                      {request.note ? (
                        <p className="request-note-premium">{request.note}</p>
                      ) : null}

                      {request.status === "rejected" && request.rejectionReason ? (
                        <p className="request-note-premium">
                          <strong>Reason:</strong> {request.rejectionReason}
                        </p>
                      ) : null}

                      <div className="request-actions-premium">
                        {hasOriginalAttachment || hasReviewAttachment ? (
                          <div className="attachment-actions">
                            {hasOriginalAttachment ? (
                              <>
                                <button
                                  type="button"
                                  className="attachment-button"
                                  onClick={() =>
                                    handlePreview(
                                      request.id,
                                      "request",
                                      request.attachmentPath
                                    )
                                  }
                                  disabled={fileBusyId === `preview-request-${request.id}`}
                                >
                                  <Eye size={14} />
                                  {fileBusyId === `preview-request-${request.id}`
                                    ? "..."
                                    : "View"}
                                </button>

                                <button
                                  type="button"
                                  className="attachment-button"
                                  onClick={() =>
                                    handleDownload(
                                      request.id,
                                      request.attachmentName ||
                                        `attachment-${request.id}`,
                                      "request",
                                      request.attachmentPath
                                    )
                                  }
                                  disabled={
                                    fileBusyId ===
                                    `download-request-${request.id}-${
                                      request.attachmentName ||
                                      `attachment-${request.id}`
                                    }`
                                  }
                                >
                                  <Download size={14} />
                                  {fileBusyId ===
                                  `download-request-${request.id}-${
                                    request.attachmentName ||
                                    `attachment-${request.id}`
                                  }`
                                    ? "..."
                                    : "Download"}
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
                                        className="attachment-button"
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
                                        <Download size={14} />
                                        {fileBusyId ===
                                        `download-review-${request.id}-${fileName}`
                                          ? "..."
                                          : `Reviewed ${index + 1}`}
                                      </button>
                                    );
                                  })
                                ) : (
                                  <button
                                    type="button"
                                    className="attachment-button"
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
                                      `download-review-${request.id}-${
                                        request.reviewAttachmentName ||
                                        `review-file-${request.id}`
                                      }`
                                    }
                                  >
                                    <Download size={14} />
                                    {fileBusyId ===
                                    `download-review-${request.id}-${
                                      request.reviewAttachmentName ||
                                      `review-file-${request.id}`
                                    }`
                                      ? "..."
                                      : "Reviewed File"}
                                  </button>
                                )}
                              </>
                            ) : null}
                          </div>
                        ) : (
                          <span className="reviewer-text">No attachment</span>
                        )}

                        {request.reviewerName ? (
                          <span className="reviewer-text">
                            Reviewed by: {request.reviewerName}
                          </span>
                        ) : null}
                      </div>
                    </article>
                  );
                })}

                {!filteredRequests.length ? (
                  <div className="empty-state-premium">
                    لا توجد طلبات في هذه الحالة.
                  </div>
                ) : null}
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
