import { useEffect, useMemo, useState } from "react";
import {
  FileText,
  UploadCloud,
  CheckCircle2,
  XCircle,
  Clock3,
  Search,
  User,
  BadgeCheck,
  WalletCards,
  CalendarDays,
  Download,
  RotateCcw,
  ClipboardList,
  ShieldCheck,
} from "lucide-react";
import { apiFetch } from "../services/api";
import { useAuth } from "../context/AuthContext";

const initialForm = {
  employeeId: "",
  employeeGasId: "",
  type: "annual_leave",
  startDate: "",
  endDate: "",
  note: "",
  attachment: null,
  currentBank: "",
  newBank: "",
  newIban: "",
};

const fallbackTypes = [
  { code: "annual_leave", label: "إجازة سنوية", requiresAttachment: false, requiresDateRange: true, requiresBankFields: false },
  { code: "sick_leave", label: "إجازة مرضية", requiresAttachment: true, requiresDateRange: true, requiresBankFields: false },
  { code: "emergency_leave", label: "إجازة اضطرارية", requiresAttachment: false, requiresDateRange: true, requiresBankFields: false },
  { code: "salary_transfer", label: "تحويل راتب", requiresAttachment: true, requiresDateRange: false, requiresBankFields: true },
  { code: "salary_certificate", label: "طلب تعريف بالراتب", requiresAttachment: false, requiresDateRange: false, requiresBankFields: false },
  { code: "payslip_request", label: "طلب كشف راتب (Payslip)", requiresAttachment: false, requiresDateRange: false, requiresBankFields: false },
];

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function badgeClass(status) {
  const s = String(status || "").toLowerCase();
  if (s === "approved") return "success";
  if (s === "rejected") return "danger";
  return "warning";
}

function normalizeRole(value) {
  return String(value || "").trim().toLowerCase();
}

function formatDisplayDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString();
}

function formatDateRange(start, end) {
  if (!start && !end) return "-";
  const startLabel = formatDisplayDate(start);
  const endLabel = formatDisplayDate(end);
  if (start && end && String(start) !== String(end)) return `${startLabel} → ${endLabel}`;
  return startLabel;
}

function getRequestDays(start, end) {
  if (!start || !end) return "";
  const s = new Date(start);
  const e = new Date(end);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return "";
  const diff = Math.floor((e - s) / (1000 * 60 * 60 * 24)) + 1;
  return diff > 0 ? `${diff} day${diff > 1 ? "s" : ""}` : "";
}

function getAuthToken() {
  const possibleKeys = ["hr_portal_auth", "employee_portal_auth", "auth", "user_auth", "portal_auth", "token"];

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

function buildFileUrl(requestId, attachmentPath = "") {
  if (isRemoteUrl(attachmentPath)) return attachmentPath;
  const base = getApiBaseUrl();
  return `${base}/files/request/${requestId}`;
}

function extractFilenameFromDisposition(disposition) {
  if (!disposition) return "";
  const utfMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utfMatch?.[1]) return decodeURIComponent(utfMatch[1]);
  const normalMatch = disposition.match(/filename="?([^"]+)"?/i);
  return normalMatch?.[1] || "";
}

function requestTypeLabel(typeCode, types) {
  const found = (types || []).find((t) => t.code === typeCode);
  return found?.label || typeCode || "-";
}

function getEmployeeGasId(item = {}) {
  return item.employeeGasId || item.gasId || item.employee_gas_id || item.gas_id || "-";
}

function RequestPersonCell({ name, gasId }) {
  return (
    <div className="rq-person-cell">
      <strong>{name || "-"}</strong>
      <span>GAS ID: {gasId || "-"}</span>
    </div>
  );
}

export default function RequestsPage() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [reviewingId, setReviewingId] = useState("");
  const [fileBusyId, setFileBusyId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [types, setTypes] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [attendanceAdjustments, setAttendanceAdjustments] = useState([]);
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

  const [form, setForm] = useState(initialForm);
  const [activeTab, setActiveTab] = useState("create");

  const [requestSearch, setRequestSearch] = useState("");
  const [requestStatusFilter, setRequestStatusFilter] = useState("all");
  const [sortConfig, setSortConfig] = useState({ key: "createdAt", direction: "desc" });
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewTarget, setReviewTarget] = useState(null);
  const [reviewDecision, setReviewDecision] = useState("");
  const [reviewReason, setReviewReason] = useState("");
  const [reviewAttachments, setReviewAttachments] = useState([]);

  const safeTypes = asArray(types).length ? asArray(types) : fallbackTypes;
  const safeEmployees = asArray(employees);
  const safeLeaveRequests = asArray(leaveRequests);
  const safeAttendanceAdjustments = asArray(attendanceAdjustments);

  const role = normalizeRole(user?.role || user?.roleName || user?.roleCode);
  const canManageOthers = [
    "system owner",
    "hr manager",
    "hr",
    "cm",
    "project manager",
    "owner",
    "hr_manager",
    "project_manager",
  ].includes(role);

  const isRegularEmployee = !canManageOthers;
  const canReview = canManageOthers;

  const selectedType = useMemo(() => safeTypes.find((type) => type.code === form.type), [safeTypes, form.type]);

  const pendingLeaveCount = safeLeaveRequests.filter((item) => item.status === "pending").length;
  const approvedLeaveCount = safeLeaveRequests.filter((item) => item.status === "approved").length;
  const rejectedLeaveCount = safeLeaveRequests.filter((item) => item.status === "rejected").length;
  const pendingAttendanceCount = safeAttendanceAdjustments.filter((item) => item.status === "pending").length;

  const resolvedEmployeeId = useMemo(() => {
    if (form.employeeId) return form.employeeId;
    return user?.employeeId || "";
  }, [form.employeeId, user?.employeeId]);

  const resolvedGasId = useMemo(() => {
    if (form.employeeGasId) return form.employeeGasId;
    return user?.gasId || "";
  }, [form.employeeGasId, user?.gasId]);

  async function loadPage() {
    if (!user?.username) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const [typesRes, listRes, balancesRes] = await Promise.allSettled([
        apiFetch("/requests-center/types"),
        apiFetch(`/requests-center/list?username=${encodeURIComponent(user.username)}`),
        apiFetch(`/requests-center/balances?username=${encodeURIComponent(user.username)}`),
      ]);

      const nextTypes =
        typesRes.status === "fulfilled"
          ? Array.isArray(typesRes.value?.types)
            ? typesRes.value.types
            : Array.isArray(typesRes.value)
            ? typesRes.value
            : []
          : [];

      const nextEmployees =
        listRes.status === "fulfilled"
          ? Array.isArray(listRes.value?.employees)
            ? listRes.value.employees
            : Array.isArray(listRes.value)
            ? listRes.value
            : []
          : [];

      const nextLeaveRequests =
        listRes.status === "fulfilled" && Array.isArray(listRes.value?.leaveRequests)
          ? listRes.value.leaveRequests
          : [];

      const nextAttendanceAdjustments =
        listRes.status === "fulfilled" && Array.isArray(listRes.value?.attendanceAdjustments)
          ? listRes.value.attendanceAdjustments
          : [];

      const nextBalances =
        balancesRes.status === "fulfilled"
          ? {
              annual: Number(balancesRes.value?.balances?.annual ?? 30),
              annualUsed: Number(balancesRes.value?.balances?.annualUsed ?? 0),
              annualRemaining: Number(balancesRes.value?.balances?.annualRemaining ?? 30),
              sick: Number(balancesRes.value?.balances?.sick ?? 15),
              sickUsed: Number(balancesRes.value?.balances?.sickUsed ?? 0),
              sickRemaining: Number(balancesRes.value?.balances?.sickRemaining ?? 15),
              emergency: Number(balancesRes.value?.balances?.emergency ?? 5),
              emergencyUsed: Number(balancesRes.value?.balances?.emergencyUsed ?? 0),
              emergencyRemaining: Number(balancesRes.value?.balances?.emergencyRemaining ?? 5),
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
      setEmployees(nextEmployees);
      setLeaveRequests(nextLeaveRequests);
      setAttendanceAdjustments(nextAttendanceAdjustments);
      setBalances(nextBalances);

      if (isRegularEmployee) {
        setForm((prev) => ({
          ...prev,
          employeeId: prev.employeeId || user?.employeeId || "",
          employeeGasId: prev.employeeGasId || user?.gasId || "",
        }));
      }
    } catch (err) {
      console.error("Requests page load error:", err);
      setError(err?.message || "Failed to load requests page");
      setTypes([]);
      setEmployees([]);
      setLeaveRequests([]);
      setAttendanceAdjustments([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPage();
  }, [user?.username]);

  useEffect(() => {
    if (selectedType?.requiresDateRange === false) {
      setForm((prev) => ({ ...prev, startDate: "", endDate: "" }));
    }
  }, [selectedType?.code]);

  function handleChange(event) {
    const { name, value, files } = event.target;

    if (name === "employeeId") {
      const selected = safeEmployees.find((employee) => String(employee.id) === String(value));
      setForm((prev) => ({
        ...prev,
        employeeId: value,
        employeeGasId: selected?.gasId || selected?.gas_id || selected?.employeeGasId || "",
      }));
      return;
    }

    setForm((prev) => ({
      ...prev,
      [name]: files ? files[0] : value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    try {
      setSubmitting(true);
      setError("");
      setMessage("");

      if (!resolvedEmployeeId && !resolvedGasId) {
        throw new Error("تعذر تحديد الموظف صاحب الطلب. تأكد أن الحساب مربوط بموظف أو GAS ID.");
      }

      if (selectedType?.requiresDateRange && (!form.startDate || !form.endDate)) {
        throw new Error("الرجاء إدخال تاريخ البداية والنهاية");
      }

      if (selectedType?.requiresBankFields) {
        if (!form.currentBank || !form.newBank || !form.newIban) {
          throw new Error("الرجاء إكمال بيانات تحويل الراتب");
        }
      }

      if (selectedType?.requiresAttachment && !form.attachment) {
        throw new Error("المرفق مطلوب لهذا النوع من الطلبات");
      }

      const body = new FormData();

      if (resolvedEmployeeId) body.append("employeeId", String(resolvedEmployeeId));

      body.append("employeeGasId", String(resolvedGasId || ""));
      body.append("type", form.type);
      body.append("note", form.note || "");
      body.append("requestedBy", user?.username || "system");

      if (form.startDate) body.append("startDate", form.startDate);
      if (form.endDate) body.append("endDate", form.endDate);
      if (form.currentBank) body.append("currentBank", form.currentBank);
      if (form.newBank) body.append("newBank", form.newBank);
      if (form.newIban) body.append("newIban", form.newIban);
      if (form.attachment) body.append("attachment", form.attachment);

      await apiFetch("/requests-center/leave", {
        method: "POST",
        body,
      });

      setMessage("تم إرسال الطلب بنجاح");
      setForm({
        ...initialForm,
        employeeId: isRegularEmployee ? user?.employeeId || "" : "",
        employeeGasId: isRegularEmployee ? user?.gasId || "" : "",
      });

      await loadPage();
    } catch (err) {
      console.error("Submit request error:", err);
      setError(err?.message || "Failed to submit request");
    } finally {
      setSubmitting(false);
    }
  }

  function reviewLeave(id, decision) {
    setReviewTarget(id);
    setReviewDecision(decision);
    setReviewReason("");
    setReviewAttachments([]);
    setReviewModalOpen(true);
  }

  function handleReviewAttachmentsChange(event) {
    const files = Array.from(event.target.files || []);

    if (files.length > 3) {
      setError("مسموح رفع 3 ملفات فقط للمراجع");
      event.target.value = "";
      setReviewAttachments([]);
      return;
    }

    setError("");
    setReviewAttachments(files);
  }

  async function submitLeaveReview() {
    try {
      setReviewingId(String(reviewTarget));
      setError("");
      setMessage("");

      if (reviewDecision === "rejected" && !reviewReason.trim()) {
        throw new Error("سبب الرفض مطلوب");
      }

      const currentRequest = leaveRequests.find((r) => String(r.id) === String(reviewTarget));
      const reviewAttachmentRequiredTypes = ["payslip_request", "salary_certificate"];
      const currentType = String(currentRequest?.type || "").toLowerCase();
      const requiresReviewAttachment = reviewAttachmentRequiredTypes.includes(currentType);

      if (reviewDecision === "approved" && requiresReviewAttachment && reviewAttachments.length === 0) {
        throw new Error("لازم ترفع مرفق (PDF) قبل الموافقة");
      }

      const body = new FormData();
      body.append("decision", reviewDecision);

      if (reviewReason) body.append("rejectionReason", reviewReason);

      reviewAttachments.forEach((file) => {
        body.append("reviewAttachments", file);
      });

      await apiFetch(`/requests-center/leave/${reviewTarget}/review`, {
        method: "POST",
        body,
      });

      setMessage(reviewDecision === "approved" ? "تمت الموافقة على الطلب" : "تم رفض الطلب");

      setReviewModalOpen(false);
      setReviewTarget(null);
      setReviewDecision("");
      setReviewReason("");
      setReviewAttachments([]);

      await loadPage();
    } catch (err) {
      console.error("Review leave error:", err);
      setError(err?.message || "Failed to review request");
    } finally {
      setReviewingId("");
    }
  }

  async function fetchAttachmentResponse(requestId, forceDownload = false, attachmentPath = "") {
    const token = getAuthToken();
    const isRemote = isRemoteUrl(attachmentPath);
    const baseUrl = buildFileUrl(requestId, attachmentPath);
    const url = forceDownload && !isRemote ? `${baseUrl}?download=1` : baseUrl;

    const response = await fetch(url, {
      method: "GET",
      headers: token && !isRemote ? { Authorization: `Bearer ${token}` } : {},
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(text || "Failed to load attachment");
    }

    return response;
  }

  async function handlePreview(requestId, attachmentPath = "") {
    try {
      setFileBusyId(`preview-${requestId}`);
      setError("");

      const url = buildFileUrl(requestId, attachmentPath);

      if (!url) throw new Error("No attachment URL");

      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      console.error("Preview error:", err);
      setError("تعذر فتح المرفق كمعاينة. استخدم Download أو تحقق من رابط الملف.");
    } finally {
      setFileBusyId("");
    }
  }

  async function handleDownload(requestId, attachmentName, attachmentPath = "") {
    try {
      setFileBusyId(`download-${requestId}`);
      setError("");

      const response = await fetchAttachmentResponse(requestId, true, attachmentPath);
      const blob = await response.blob();

      if (!blob || blob.size === 0) throw new Error("Empty attachment");

      const disposition = response.headers.get("content-disposition") || "";
      const headerFilename = extractFilenameFromDisposition(disposition);
      const finalName = attachmentName || headerFilename || `attachment-${requestId}`;

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = finalName;
      document.body.appendChild(a);
      a.click();
      a.remove();

      setTimeout(() => window.URL.revokeObjectURL(url), 60000);
    } catch (err) {
      console.error("Download error:", err);
      setError("تعذر تحميل المرفق. الملف قد يكون غير صالح أو غير مسموح.");
    } finally {
      setFileBusyId("");
    }
  }

  const filteredLeaveRequests = useMemo(() => {
    const keyword = requestSearch.trim().toLowerCase();
    let list = [...safeLeaveRequests];

    if (requestStatusFilter !== "all") {
      list = list.filter((item) => String(item.status || "").toLowerCase() === requestStatusFilter);
    }

    if (keyword) {
      list = list.filter((item) => {
        const searchable = [
          item.employeeName,
          item.employeeGasId,
          item.gasId,
          item.employee_gas_id,
          item.type,
          requestTypeLabel(item.type, safeTypes),
          item.status,
          item.requestedByName,
          item.requestedBy,
          item.startDate,
          item.endDate,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchable.includes(keyword);
      });
    }

    list.sort((a, b) => {
      const key = sortConfig.key;
      const direction = sortConfig.direction === "asc" ? 1 : -1;

      const aValue =
        key === "employeeName"
          ? String(a.employeeName || "")
          : key === "status"
          ? String(a.status || "")
          : key === "type"
          ? String(requestTypeLabel(a.type, safeTypes) || "")
          : new Date(a.createdAt || a.startDate || 0).getTime();

      const bValue =
        key === "employeeName"
          ? String(b.employeeName || "")
          : key === "status"
          ? String(b.status || "")
          : key === "type"
          ? String(requestTypeLabel(b.type, safeTypes) || "")
          : new Date(b.createdAt || b.startDate || 0).getTime();

      if (aValue > bValue) return direction;
      if (aValue < bValue) return -direction;
      return 0;
    });

    return list;
  }, [safeLeaveRequests, requestSearch, requestStatusFilter, sortConfig, safeTypes]);

  const totalPages = Math.max(1, Math.ceil(filteredLeaveRequests.length / pageSize));

  const paginatedLeaveRequests = filteredLeaveRequests.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function handleSort(key) {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
    setCurrentPage(1);
  }

  function resetRequestFilters() {
    setRequestSearch("");
    setRequestStatusFilter("all");
    setCurrentPage(1);
  }

  function closeReviewModal() {
    setReviewModalOpen(false);
    setReviewTarget(null);
    setReviewDecision("");
    setReviewReason("");
    setReviewAttachments([]);
  }

  if (loading) {
    return (
      <div className="requests-ultra-page">
        <style>{requestsUltraStyles}</style>
        <div className="rq-loading-card">
          <div className="rq-loader" />
          <h2>Loading Requests Center</h2>
          <p>Preparing requests, balances and approvals...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="requests-ultra-page">
      <style>{requestsUltraStyles}</style>

      <section className="rq-command-hero">
        <div className="rq-hero-main">
          <div className="rq-hero-badge">
            <ShieldCheck size={15} />
            Requests Ultra Command Center
          </div>

          <h1>Requests Center</h1>

          <p>
            Create and manage leave, salary transfer, salary certificate and payslip requests with clear
            GAS ID tracking, dates, attachments and approval workflows.
          </p>
        </div>

        <div className="rq-hero-side">
          <div className="rq-side-icon">
            <ClipboardList size={26} />
          </div>

          <div className="rq-side-row">
            <span>Current User</span>
            <strong>{user?.name || user?.username || "-"}</strong>
          </div>

          <div className="rq-side-row">
            <span>GAS ID</span>
            <strong>{resolvedGasId || "-"}</strong>
          </div>

          <div className="rq-side-row">
            <span>Role</span>
            <strong>{user?.role || user?.roleName || "-"}</strong>
          </div>
        </div>
      </section>

      {message ? <div className="rq-alert success">{message}</div> : null}
      {error ? <div className="rq-alert error">{error}</div> : null}

      <section className="rq-kpi-grid">
        <article className="rq-kpi-card blue">
          <div>
            <span>Total Requests</span>
            <strong>{safeLeaveRequests.length}</strong>
            <p>All submitted requests</p>
          </div>
          <FileText size={28} />
        </article>

        <article className="rq-kpi-card warning">
          <div>
            <span>Pending</span>
            <strong>{pendingLeaveCount}</strong>
            <p>Waiting for review</p>
          </div>
          <Clock3 size={28} />
        </article>

        <article className="rq-kpi-card success">
          <div>
            <span>Approved</span>
            <strong>{approvedLeaveCount}</strong>
            <p>Completed approvals</p>
          </div>
          <CheckCircle2 size={28} />
        </article>

        <article className="rq-kpi-card danger">
          <div>
            <span>Rejected</span>
            <strong>{rejectedLeaveCount}</strong>
            <p>Rejected submissions</p>
          </div>
          <XCircle size={28} />
        </article>

        <article className="rq-kpi-card dark">
          <div>
            <span>Attendance</span>
            <strong>{pendingAttendanceCount}</strong>
            <p>Pending corrections</p>
          </div>
          <CalendarDays size={28} />
        </article>
      </section>

      <section className="rq-tabs">
        <button type="button" className={activeTab === "create" ? "active" : ""} onClick={() => setActiveTab("create")}>
          <UploadCloud size={15} />
          Create Request
        </button>

        <button type="button" className={activeTab === "queue" ? "active" : ""} onClick={() => setActiveTab("queue")}>
          <ClipboardList size={15} />
          Requests Queue
        </button>

        <button type="button" className={activeTab === "adjustments" ? "active" : ""} onClick={() => setActiveTab("adjustments")}>
          <CalendarDays size={15} />
          Attendance Adjustments
        </button>

        <button type="button" className={activeTab === "balances" ? "active" : ""} onClick={() => setActiveTab("balances")}>
          <WalletCards size={15} />
          Balances
        </button>
      </section>

      {activeTab === "create" && (
        <section className="rq-grid-two">
          <div className="rq-card">
            <div className="rq-card-head">
              <div>
                <h2>Create Request</h2>
                <p>أنشئ طلب جديد مع إظهار GAS ID والتواريخ بشكل واضح.</p>
              </div>
            </div>

            <form className="rq-form-grid" onSubmit={handleSubmit}>
              {canManageOthers ? (
                <label className="rq-field">
                  Employee
                  <select name="employeeId" value={form.employeeId} onChange={handleChange}>
                    <option value="">اختر الموظف</option>
                    {safeEmployees.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.name || employee.full_name || "Employee"} — GAS ID:{" "}
                        {employee.gasId || employee.gas_id || employee.employeeGasId || "-"}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <label className="rq-field">
                  Employee
                  <input
                    value={`${user?.name || user?.username || "Employee"}${
                      resolvedGasId ? ` — GAS ID: ${resolvedGasId}` : ""
                    }`}
                    readOnly
                  />
                </label>
              )}

              <label className="rq-field">
                GAS ID
                <input
                  name="employeeGasId"
                  value={resolvedGasId}
                  onChange={handleChange}
                  placeholder="مثال: 2036"
                  readOnly={isRegularEmployee}
                />
              </label>

              <label className="rq-field">
                Request Type
                <select name="type" value={form.type} onChange={handleChange}>
                  {safeTypes.map((type) => (
                    <option key={type.code} value={type.code}>
                      {type.label || type.name || type.code}
                    </option>
                  ))}
                </select>
              </label>

              {selectedType?.requiresDateRange !== false ? (
                <label className="rq-field">
                  Start Date
                  <input type="date" name="startDate" value={form.startDate} onChange={handleChange} />
                </label>
              ) : null}

              {selectedType?.requiresDateRange !== false ? (
                <label className="rq-field">
                  End Date
                  <input type="date" name="endDate" value={form.endDate} onChange={handleChange} />
                </label>
              ) : null}

              {selectedType?.requiresBankFields ? (
                <>
                  <label className="rq-field">
                    Current Bank
                    <input name="currentBank" value={form.currentBank} onChange={handleChange} placeholder="البنك الحالي" />
                  </label>

                  <label className="rq-field">
                    New Bank
                    <input name="newBank" value={form.newBank} onChange={handleChange} placeholder="البنك الجديد" />
                  </label>

                  <label className="rq-field full">
                    New IBAN
                    <input name="newIban" value={form.newIban} onChange={handleChange} placeholder="SA00 0000 0000 0000 0000 0000" />
                  </label>
                </>
              ) : null}

              <label className="rq-field">
                Attachment
                <input type="file" name="attachment" onChange={handleChange} />
              </label>

              <label className="rq-field full">
                Note
                <input name="note" value={form.note} onChange={handleChange} placeholder="سبب الطلب أو أي ملاحظة" />
              </label>

              <div className="rq-form-actions">
                <button type="submit" disabled={submitting} className="rq-btn primary">
                  {submitting ? "Submitting..." : "Submit Request"}
                </button>
              </div>
            </form>
          </div>

          <div className="rq-card">
            <div className="rq-card-head">
              <div>
                <h2>Request Preview</h2>
                <p>ملخص الطلب الحالي قبل الإرسال.</p>
              </div>
            </div>

            <div className="rq-preview-list">
              <div>
                <span>Employee</span>
                <strong>{isRegularEmployee ? user?.name || user?.username || "-" : resolvedEmployeeId || "-"}</strong>
              </div>

              <div>
                <span>GAS ID</span>
                <strong>{resolvedGasId || "-"}</strong>
              </div>

              <div>
                <span>Type</span>
                <strong>{requestTypeLabel(form.type, safeTypes)}</strong>
              </div>

              <div>
                <span>Date Range</span>
                <strong>{formatDateRange(form.startDate, form.endDate)}</strong>
                {getRequestDays(form.startDate, form.endDate) ? <small>{getRequestDays(form.startDate, form.endDate)}</small> : null}
              </div>

              <div>
                <span>Attachment Required</span>
                <strong>{selectedType?.requiresAttachment ? "Yes" : "No"}</strong>
              </div>
            </div>
          </div>
        </section>
      )}

      {activeTab === "balances" && (
        <section className="rq-card">
          <div className="rq-card-head">
            <div>
              <h2>Leave Balances</h2>
              <p>الأرصدة الحالية للموظف حسب النظام.</p>
            </div>
          </div>

          <div className="rq-balance-grid">
            <article>
              <span>Annual Leave</span>
              <strong>{balances.annualRemaining}</strong>
              <p>Total {balances.annual} · Used {balances.annualUsed}</p>
            </article>

            <article>
              <span>Sick Leave</span>
              <strong>{balances.sickRemaining}</strong>
              <p>Total {balances.sick} · Used {balances.sickUsed}</p>
            </article>

            <article>
              <span>Emergency Leave</span>
              <strong>{balances.emergencyRemaining}</strong>
              <p>Total {balances.emergency} · Used {balances.emergencyUsed}</p>
            </article>
          </div>
        </section>
      )}

      {activeTab === "queue" && (
        <section className="rq-card">
          <div className="rq-card-head">
            <div>
              <h2>Requests Queue</h2>
              <p>كل الطلبات مع إظهار GAS ID والتواريخ والمرفقات.</p>
            </div>

            <button type="button" className="rq-btn soft" onClick={loadPage}>
              <RotateCcw size={15} />
              Refresh
            </button>
          </div>

          {filteredLeaveRequests.length ? (
            <>
              <div className="rq-toolbar">
                <div className="rq-search">
                  <Search size={16} />
                  <input
                    value={requestSearch}
                    onChange={(e) => {
                      setRequestSearch(e.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="Search by employee, GAS ID, type, date, status..."
                  />
                </div>

                <div className="rq-filter-row">
                  {["all", "pending", "approved", "rejected"].map((status) => (
                    <button
                      key={status}
                      type="button"
                      className={`rq-chip ${requestStatusFilter === status ? "active" : ""}`}
                      onClick={() => {
                        setRequestStatusFilter(status);
                        setCurrentPage(1);
                      }}
                    >
                      {status === "all" ? "All" : status}
                    </button>
                  ))}

                  <button type="button" className="rq-chip reset" onClick={resetRequestFilters}>
                    Reset
                  </button>
                </div>
              </div>

              <div className="rq-table-scroll">
                <table className="rq-table">
                  <thead>
                    <tr>
                      <th className="col-employee">
                        <button type="button" className="rq-sort" onClick={() => handleSort("employeeName")}>Employee</button>
                      </th>
                      <th className="col-type">
                        <button type="button" className="rq-sort" onClick={() => handleSort("type")}>Type</button>
                      </th>
                      <th className="col-dates">
                        <button type="button" className="rq-sort" onClick={() => handleSort("createdAt")}>Dates</button>
                      </th>
                      <th className="col-status">
                        <button type="button" className="rq-sort" onClick={() => handleSort("status")}>Status</button>
                      </th>
                      <th className="col-attachment">Attachment</th>
                      <th className="col-requestedby">Requested By</th>
                      <th className="col-action">Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {paginatedLeaveRequests.map((item) => {
                      const reviewFiles = Array.isArray(item.reviewAttachments) ? item.reviewAttachments : [];
                      const hasReviewAttachments = reviewFiles.length > 0 || !!item.reviewAttachmentPath;

                      return (
                        <tr key={`leave-${item.id}`}>
                          <td>
                            <RequestPersonCell name={item.employeeName} gasId={getEmployeeGasId(item)} />
                          </td>

                          <td>
                            <span className="rq-type-pill">{requestTypeLabel(item.type, safeTypes)}</span>
                          </td>

                          <td>
                            <div className="rq-date-cell">
                              <strong>{formatDisplayDate(item.startDate)}</strong>
                              <span>To: {formatDisplayDate(item.endDate)}</span>
                              {getRequestDays(item.startDate, item.endDate) ? <small>{getRequestDays(item.startDate, item.endDate)}</small> : null}
                            </div>
                          </td>

                          <td>
                            <span className={`rq-status ${badgeClass(item.status)}`}>
                              {item.status || "-"}
                            </span>
                          </td>

                          <td>
                            {item.attachmentPath || hasReviewAttachments ? (
                              <div className="rq-file-actions">
                                {item.attachmentPath ? (
                                  <button
                                    type="button"
                                    className="rq-file-btn"
                                    onClick={() =>
                                      handleDownload(
                                        item.id,
                                        item.attachmentName || item.attachment_name || `request-${item.id}.pdf`,
                                        item.attachmentPath
                                      )
                                    }
                                    disabled={fileBusyId === `download-${item.id}`}
                                  >
                                    <Download size={15} />
                                    {fileBusyId === `download-${item.id}` ? "Loading..." : "Employee File"}
                                  </button>
                                ) : null}

                                {hasReviewAttachments ? (
                                  reviewFiles.length ? (
                                    reviewFiles.map((file, index) => {
                                      const fileName = file?.name || `review-file-${index + 1}`;
                                      const filePath = file?.path || "";

                                      return (
                                        <button
                                          key={`${filePath || fileName}-${index}`}
                                          type="button"
                                          className="rq-file-btn review"
                                          onClick={() => handleDownload(item.id, fileName, filePath)}
                                          disabled={fileBusyId === `download-${item.id}`}
                                        >
                                          <Download size={15} />
                                          Review File {index + 1}
                                        </button>
                                      );
                                    })
                                  ) : (
                                    <button
                                      type="button"
                                      className="rq-file-btn review"
                                      onClick={() =>
                                        handleDownload(
                                          item.id,
                                          item.reviewAttachmentName || item.review_attachment_name || `review-${item.id}.pdf`,
                                          item.reviewAttachmentPath
                                        )
                                      }
                                      disabled={fileBusyId === `download-${item.id}`}
                                    >
                                      <Download size={15} />
                                      Review File
                                    </button>
                                  )
                                ) : null}
                              </div>
                            ) : (
                              <span className="rq-no-file">No attachment</span>
                            )}
                          </td>

                          <td>
                            <RequestPersonCell name={item.requestedByName || item.requestedBy} gasId={getEmployeeGasId(item)} />
                          </td>

                          <td>
                            {canReview && item.status === "pending" ? (
                              <div className="rq-row-actions">
                                <button type="button" className="rq-mini approve" onClick={() => reviewLeave(item.id, "approved")} disabled={reviewingId === String(item.id)}>
                                  Approve
                                </button>

                                <button type="button" className="rq-mini reject" onClick={() => reviewLeave(item.id, "rejected")} disabled={reviewingId === String(item.id)}>
                                  Reject
                                </button>
                              </div>
                            ) : item.status === "rejected" && item.rejectionReason ? (
                              <span className="rq-muted">{item.rejectionReason}</span>
                            ) : (
                              <span className="rq-muted">No action</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="rq-pagination">
                <span>Showing {paginatedLeaveRequests.length} of {filteredLeaveRequests.length}</span>

                <div>
                  <button type="button" disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}>
                    Previous
                  </button>

                  <strong>Page {currentPage} / {totalPages}</strong>

                  <button type="button" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}>
                    Next
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="rq-empty">
              <strong>No requests yet</strong>
              <span>طلبات الإجازات والمهام ستظهر هنا عند إنشائها</span>
            </div>
          )}
        </section>
      )}

      {activeTab === "adjustments" && (
        <section className="rq-card">
          <div className="rq-card-head">
            <div>
              <h2>Attendance Adjustment Requests</h2>
              <p>طلبات تعديل الحضور مع إظهار تاريخ التعديل و GAS ID.</p>
            </div>
          </div>

          {safeAttendanceAdjustments.length ? (
            <div className="rq-table-scroll">
              <table className="rq-table adjustments">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Date</th>
                    <th>Current</th>
                    <th>Requested</th>
                    <th>Reason</th>
                    <th>Status</th>
                    <th>Requested By</th>
                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {safeAttendanceAdjustments.map((item) => (
                    <tr key={`att-${item.id}`}>
                      <td>
                        <RequestPersonCell name={item.employeeName || item.employeeId} gasId={getEmployeeGasId(item)} />
                      </td>
                      <td>
                        <div className="rq-date-cell">
                          <strong>{formatDisplayDate(item.date)}</strong>
                        </div>
                      </td>
                      <td>{item.currentValue || "-"}</td>
                      <td>{item.newStatus || "-"}</td>
                      <td>{item.reason || "-"}</td>
                      <td>
                        <span className={`rq-status ${badgeClass(item.status)}`}>
                          {item.status || "-"}
                        </span>
                      </td>
                      <td>
                        <RequestPersonCell name={item.requestedByName || item.requestedBy} gasId={getEmployeeGasId(item)} />
                      </td>
                      <td>
                        <span className="rq-muted">No action</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rq-empty">
              <strong>No attendance adjustment requests yet</strong>
              <span>Attendance adjustment requests will appear here once submitted.</span>
            </div>
          )}
        </section>
      )}

      {reviewModalOpen && (
        <div className="rq-modal-overlay">
          <div className="rq-review-modal">
            <div className="rq-modal-head">
              <div>
                <h3>{reviewDecision === "approved" ? "Approve Request" : "Reject Request"}</h3>
                <p>ارفع مرفقات المراجع أو اكتب سبب الرفض حسب القرار.</p>
              </div>

              <button type="button" onClick={closeReviewModal}>✕</button>
            </div>

            <div className="rq-modal-body">
              <label className="rq-field full">
                Reviewer Note
                <input
                  value={reviewReason}
                  onChange={(e) => setReviewReason(e.target.value)}
                  placeholder={reviewDecision === "rejected" ? "سبب الرفض مطلوب..." : "اكتب ملاحظة من المراجع..."}
                />
              </label>

              <label className="rq-upload-zone">
                <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" multiple onChange={handleReviewAttachmentsChange} />
                <UploadCloud size={24} />
                <strong>رفع مرفق المراجع</strong>
                <span>{reviewAttachments.length ? `${reviewAttachments.length} ملف مرفوع` : "اختر حتى 3 ملفات فقط"}</span>
              </label>

              {reviewAttachments.length ? (
                <div className="rq-review-files">
                  {reviewAttachments.map((file, index) => (
                    <div key={`${file.name}-${index}`}>
                      <strong>{index + 1}. {file.name}</strong>
                      <span>{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="rq-modal-actions">
              <button type="button" className="rq-btn soft" onClick={closeReviewModal}>
                Cancel
              </button>

              <button type="button" className={reviewDecision === "approved" ? "rq-btn primary" : "rq-btn danger"} onClick={submitLeaveReview} disabled={reviewingId === String(reviewTarget)}>
                {reviewingId === String(reviewTarget) ? "Submitting..." : reviewDecision === "approved" ? "Approve Now" : "Reject Now"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const requestsUltraStyles = `
.requests-ultra-page{
  width:100%;
  max-width:100%;
  min-width:0;
  overflow-x:hidden;
  display:grid;
  gap:20px;
  color:#0f172a;
}

.requests-ultra-page *{
  box-sizing:border-box;
}

.rq-loading-card{
  min-height:360px;
  border-radius:32px;
  display:grid;
  place-items:center;
  text-align:center;
  padding:34px;
  background:#fff;
  border:1px solid #e8eef7;
  box-shadow:0 16px 42px rgba(15,23,42,.06);
}

.rq-loader{
  width:54px;
  height:54px;
  border-radius:999px;
  border:5px solid #dbeafe;
  border-top-color:#2563eb;
  animation:rqSpin 1s linear infinite;
}

@keyframes rqSpin{to{transform:rotate(360deg)}}

.rq-loading-card h2{
  margin:18px 0 4px;
  font-weight:950;
}

.rq-loading-card p{
  margin:0;
  color:#64748b;
  font-weight:800;
}

.rq-command-hero{
  position:relative;
  overflow:hidden;
  border-radius:36px;
  padding:30px;
  display:grid;
  grid-template-columns:minmax(0,1.45fr) minmax(320px,.85fr);
  gap:20px;
  color:#fff;
  background:
    radial-gradient(circle at 12% 15%,rgba(56,189,248,.28),transparent 30%),
    radial-gradient(circle at 92% 5%,rgba(37,99,235,.42),transparent 34%),
    linear-gradient(135deg,#020617 0%,#0f172a 52%,#1e3a8a 120%);
  box-shadow:0 26px 70px rgba(15,23,42,.18);
}

.rq-command-hero::before{
  content:"";
  position:absolute;
  inset:0;
  background-image:
    linear-gradient(rgba(255,255,255,.055) 1px,transparent 1px),
    linear-gradient(90deg,rgba(255,255,255,.055) 1px,transparent 1px);
  background-size:48px 48px;
  opacity:.5;
}

.rq-hero-main,
.rq-hero-side{
  position:relative;
  z-index:2;
}

.rq-hero-badge{
  width:fit-content;
  display:inline-flex;
  align-items:center;
  gap:8px;
  min-height:36px;
  border-radius:999px;
  padding:0 14px;
  background:rgba(255,255,255,.12);
  border:1px solid rgba(255,255,255,.16);
  color:#dbeafe;
  font-size:.82rem;
  font-weight:950;
}

.rq-hero-main h1{
  margin:18px 0 0;
  font-size:clamp(2.2rem,4vw,4rem);
  line-height:1;
  letter-spacing:-.06em;
  color:#fff;
  font-weight:950;
}

.rq-hero-main p{
  max-width:780px;
  margin:16px 0 0;
  color:rgba(255,255,255,.78);
  font-size:1rem;
  line-height:1.75;
  font-weight:750;
}

.rq-hero-side{
  border-radius:30px;
  padding:22px;
  background:rgba(255,255,255,.11);
  border:1px solid rgba(255,255,255,.16);
  backdrop-filter:blur(18px);
  display:grid;
  gap:12px;
}

.rq-side-icon{
  width:54px;
  height:54px;
  border-radius:20px;
  display:grid;
  place-items:center;
  background:linear-gradient(135deg,#38bdf8,#2563eb);
}

.rq-side-row{
  display:flex;
  justify-content:space-between;
  gap:12px;
  border-radius:17px;
  padding:12px;
  background:rgba(255,255,255,.09);
}

.rq-side-row span{
  color:rgba(255,255,255,.65);
  font-size:.78rem;
  font-weight:850;
}

.rq-side-row strong{
  color:#fff;
  font-size:.9rem;
  font-weight:950;
  text-align:right;
  word-break:break-word;
}

.rq-alert{
  border-radius:18px;
  padding:14px 16px;
  font-weight:900;
  font-size:.92rem;
}

.rq-alert.success{
  background:#ecfdf3;
  color:#047857;
  border:1px solid #a7f3d0;
}

.rq-alert.error{
  background:#fff1f2;
  color:#be123c;
  border:1px solid #fecdd3;
}

.rq-kpi-grid{
  display:grid;
  grid-template-columns:repeat(5,minmax(0,1fr));
  gap:16px;
}

.rq-kpi-card{
  position:relative;
  overflow:hidden;
  min-height:145px;
  border-radius:30px;
  padding:22px;
  display:flex;
  justify-content:space-between;
  gap:14px;
  background:#fff;
  border:1px solid #e8eef7;
  box-shadow:0 18px 45px rgba(15,23,42,.07);
}

.rq-kpi-card::after{
  content:"";
  position:absolute;
  width:130px;
  height:130px;
  right:-48px;
  top:-48px;
  border-radius:999px;
  background:rgba(37,99,235,.09);
}

.rq-kpi-card.warning::after{background:rgba(245,158,11,.12)}
.rq-kpi-card.success::after{background:rgba(34,197,94,.10)}
.rq-kpi-card.danger::after{background:rgba(239,68,68,.10)}
.rq-kpi-card.dark::after{background:rgba(15,23,42,.10)}

.rq-kpi-card span{
  color:#64748b;
  font-size:.83rem;
  font-weight:900;
}

.rq-kpi-card strong{
  display:block;
  margin-top:10px;
  color:#0f172a;
  font-size:2.25rem;
  line-height:1;
  font-weight:950;
  letter-spacing:-.05em;
}

.rq-kpi-card p{
  margin:12px 0 0;
  color:#94a3b8;
  font-size:.78rem;
  font-weight:800;
}

.rq-kpi-card svg{
  position:relative;
  z-index:2;
  color:#2563eb;
}

.rq-kpi-card.warning svg{color:#d97706}
.rq-kpi-card.success svg{color:#16a34a}
.rq-kpi-card.danger svg{color:#dc2626}
.rq-kpi-card.dark svg{color:#0f172a}

.rq-tabs{
  display:flex;
  gap:12px;
  flex-wrap:wrap;
}

.rq-tabs button{
  min-height:46px;
  border:none;
  border-radius:16px;
  padding:0 16px;
  display:flex;
  align-items:center;
  gap:8px;
  background:#f8fafc;
  color:#334155;
  cursor:pointer;
  font-weight:900;
}

.rq-tabs button.active{
  background:#0f172a;
  color:#fff;
}

.rq-grid-two{
  display:grid;
  grid-template-columns:minmax(0,1.25fr) minmax(340px,.75fr);
  gap:20px;
}

.rq-card{
  border-radius:32px;
  padding:24px;
  background:#fff;
  border:1px solid #e8eef7;
  box-shadow:0 16px 42px rgba(15,23,42,.055);
  width:100%;
  max-width:100%;
  min-width:0;
  overflow:hidden;
}

.rq-card-head{
  display:flex;
  justify-content:space-between;
  gap:14px;
  align-items:flex-start;
  flex-wrap:wrap;
  margin-bottom:18px;
}

.rq-card-head h2{
  margin:0;
  font-size:1.3rem;
  font-weight:950;
}

.rq-card-head p{
  margin:6px 0 0;
  color:#64748b;
  font-weight:800;
}

.rq-form-grid{
  display:grid;
  grid-template-columns:repeat(2,minmax(0,1fr));
  gap:14px;
}

.rq-field{
  display:grid;
  gap:8px;
  min-width:0;
  color:#334155;
  font-size:.86rem;
  font-weight:900;
}

.rq-field.full{
  grid-column:span 2;
}

.rq-field input,
.rq-field select{
  width:100%;
  min-width:0;
  min-height:50px;
  border-radius:16px;
  border:1px solid #dbe2ea;
  padding:0 14px;
  background:#fff;
  color:#0f172a;
  font-size:.94rem;
}

.rq-field input[type="file"]{
  padding:12px 14px;
}

.rq-field input:focus,
.rq-field select:focus{
  outline:none;
  border-color:#2563eb;
  box-shadow:0 0 0 4px rgba(37,99,235,.08);
}

.rq-form-actions{
  grid-column:span 2;
  display:flex;
  justify-content:flex-end;
}

.rq-btn{
  min-height:46px;
  border:none;
  border-radius:16px;
  padding:0 16px;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  gap:8px;
  cursor:pointer;
  font-weight:950;
  font-size:.88rem;
}

.rq-btn:disabled{
  opacity:.55;
  cursor:not-allowed;
}

.rq-btn.primary{
  color:#fff;
  background:linear-gradient(135deg,#2563eb,#1d4ed8);
  box-shadow:0 14px 28px rgba(37,99,235,.22);
}

.rq-btn.soft{
  background:#eef4ff;
  color:#1d4ed8;
}

.rq-btn.danger{
  background:#dc2626;
  color:#fff;
}

.rq-preview-list{
  display:grid;
  gap:12px;
}

.rq-preview-list div{
  border-radius:18px;
  padding:15px;
  background:#f8fafc;
  border:1px solid #e8eef7;
}

.rq-preview-list span{
  display:block;
  color:#64748b;
  font-size:.8rem;
  font-weight:900;
  margin-bottom:7px;
}

.rq-preview-list strong{
  display:block;
  color:#0f172a;
  font-weight:950;
}

.rq-preview-list small{
  display:block;
  margin-top:5px;
  color:#2563eb;
  font-weight:900;
}

.rq-balance-grid{
  display:grid;
  grid-template-columns:repeat(3,minmax(0,1fr));
  gap:16px;
}

.rq-balance-grid article{
  border-radius:24px;
  padding:22px;
  background:linear-gradient(180deg,#fff,#f8fafc);
  border:1px solid #e8eef7;
}

.rq-balance-grid span{
  color:#64748b;
  font-size:.86rem;
  font-weight:900;
}

.rq-balance-grid strong{
  display:block;
  margin-top:12px;
  font-size:2.4rem;
  line-height:1;
  font-weight:950;
  color:#1d4ed8;
}

.rq-balance-grid p{
  margin:12px 0 0;
  color:#64748b;
  font-weight:800;
}

.rq-toolbar{
  display:flex;
  justify-content:space-between;
  gap:14px;
  flex-wrap:wrap;
  margin-bottom:16px;
}

.rq-search{
  position:relative;
  flex:1;
  min-width:260px;
}

.rq-search svg{
  position:absolute;
  left:14px;
  top:50%;
  transform:translateY(-50%);
  color:#64748b;
}

.rq-search input{
  width:100%;
  min-height:48px;
  border-radius:16px;
  border:1px solid #dbe2ea;
  padding:0 14px 0 42px;
  font-weight:800;
}

.rq-filter-row{
  display:flex;
  gap:8px;
  flex-wrap:wrap;
}

.rq-chip{
  min-height:42px;
  border:1px solid #dbe2ea;
  border-radius:999px;
  padding:0 14px;
  background:#fff;
  color:#475569;
  font-weight:900;
  cursor:pointer;
}

.rq-chip.active{
  background:#1d4ed8;
  color:#fff;
  border-color:#1d4ed8;
}

.rq-chip.reset{
  background:#f8fafc;
}

.rq-table-scroll{
  width:100%;
  max-width:100%;
  min-width:0;
  overflow-x:auto;
  overflow-y:auto;
  border-radius:24px;
  border:1px solid #e8eef7;
  background:#fff;
  -webkit-overflow-scrolling:touch;
}

.rq-table{
  width:max-content;
  min-width:1480px;
  max-width:none;
  border-collapse:separate;
  border-spacing:0;
}

.rq-table.adjustments{
  min-width:1250px;
}

.rq-table thead th{
  position:sticky;
  top:0;
  z-index:2;
  text-align:left;
  font-size:.82rem;
  color:#64748b;
  font-weight:950;
  padding:14px;
  background:#f8fafc;
  border-bottom:1px solid #e8eef7;
  white-space:nowrap;
}

.rq-table tbody td{
  padding:16px 14px;
  border-bottom:1px solid #eef2f7;
  color:#0f172a;
  font-weight:800;
  background:#fff;
  vertical-align:middle;
}

.rq-table tbody tr:hover td{
  background:#fbfdff;
}

.col-employee{width:250px}
.col-type{width:250px}
.col-dates{width:220px}
.col-status{width:140px}
.col-attachment{width:260px}
.col-requestedby{width:240px}
.col-action{width:160px}

.rq-sort{
  border:none;
  background:transparent;
  color:#64748b;
  font:inherit;
  font-weight:950;
  cursor:pointer;
  padding:0;
}

.rq-person-cell{
  display:grid;
  gap:5px;
  min-width:0;
}

.rq-person-cell strong{
  color:#0f172a;
  font-size:.92rem;
  font-weight:950;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
}

.rq-person-cell span{
  width:fit-content;
  min-height:24px;
  border-radius:999px;
  padding:0 8px;
  display:inline-flex;
  align-items:center;
  background:#eff6ff;
  color:#1d4ed8;
  font-size:.72rem;
  font-weight:950;
}

.rq-type-pill{
  max-width:220px;
  min-height:32px;
  border-radius:999px;
  padding:0 11px;
  display:inline-flex;
  align-items:center;
  background:#f8fafc;
  border:1px solid #e2e8f0;
  color:#334155;
  font-weight:950;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}

.rq-date-cell{
  display:grid;
  gap:4px;
}

.rq-date-cell strong{
  color:#0f172a;
  font-size:.9rem;
  font-weight:950;
}

.rq-date-cell span{
  color:#64748b;
  font-size:.78rem;
  font-weight:850;
}

.rq-date-cell small{
  width:fit-content;
  border-radius:999px;
  padding:4px 8px;
  background:#ecfdf3;
  color:#047857;
  font-size:.7rem;
  font-weight:950;
}

.rq-status{
  min-height:32px;
  border-radius:999px;
  padding:0 11px;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  font-size:.76rem;
  font-weight:950;
}

.rq-status.success{
  background:#dcfce7;
  color:#166534;
}

.rq-status.warning{
  background:#fef3c7;
  color:#92400e;
}

.rq-status.danger{
  background:#fee2e2;
  color:#991b1b;
}

.rq-file-actions{
  display:grid;
  gap:8px;
}

.rq-file-btn{
  min-height:38px;
  border-radius:13px;
  border:1px solid #dbeafe;
  background:#eff6ff;
  color:#1d4ed8;
  display:inline-flex;
  align-items:center;
  gap:8px;
  padding:0 12px;
  cursor:pointer;
  font-weight:950;
}

.rq-file-btn.review{
  background:#ecfeff;
  color:#0e7490;
  border-color:#a5f3fc;
}

.rq-no-file{
  min-height:32px;
  border-radius:999px;
  padding:0 11px;
  display:inline-flex;
  align-items:center;
  background:#f8fafc;
  color:#94a3b8;
  border:1px solid #e2e8f0;
  font-size:.76rem;
  font-weight:950;
}

.rq-row-actions{
  display:grid;
  gap:8px;
  justify-items:start;
}

.rq-mini{
  min-height:34px;
  min-width:100px;
  border:none;
  border-radius:12px;
  padding:0 12px;
  cursor:pointer;
  font-size:.8rem;
  font-weight:950;
}

.rq-mini.approve{
  background:#ecfdf3;
  color:#047857;
}

.rq-mini.reject{
  background:#fff1f2;
  color:#be123c;
}

.rq-muted{
  color:#64748b;
  font-weight:850;
  line-height:1.5;
}

.rq-pagination{
  display:flex;
  justify-content:space-between;
  align-items:center;
  gap:12px;
  flex-wrap:wrap;
  margin-top:16px;
  padding:14px 16px;
  border-radius:18px;
  background:#f8fafc;
  border:1px solid #e8edf4;
}

.rq-pagination span,
.rq-pagination strong{
  color:#334155;
  font-weight:900;
}

.rq-pagination div{
  display:flex;
  align-items:center;
  gap:10px;
}

.rq-pagination button{
  min-height:38px;
  border:none;
  border-radius:12px;
  padding:0 14px;
  background:#eef4ff;
  color:#1d4ed8;
  font-weight:900;
  cursor:pointer;
}

.rq-pagination button:disabled{
  opacity:.5;
  cursor:not-allowed;
}

.rq-empty{
  border-radius:22px;
  padding:42px 20px;
  text-align:center;
  background:#f8fafc;
  border:1px dashed #cbd5e1;
  display:grid;
  gap:7px;
}

.rq-empty strong{
  color:#334155;
  font-weight:950;
}

.rq-empty span{
  color:#64748b;
  font-weight:800;
}

.rq-modal-overlay{
  position:fixed;
  inset:0;
  z-index:9999;
  background:rgba(15,23,42,.52);
  display:grid;
  place-items:center;
  padding:20px;
}

.rq-review-modal{
  width:100%;
  max-width:560px;
  border-radius:28px;
  padding:24px;
  background:#fff;
  border:1px solid #e5e7eb;
  box-shadow:0 24px 80px rgba(15,23,42,.28);
}

.rq-modal-head{
  display:flex;
  justify-content:space-between;
  gap:14px;
  align-items:flex-start;
  margin-bottom:18px;
}

.rq-modal-head h3{
  margin:0 0 6px;
  font-size:1.35rem;
  font-weight:950;
}

.rq-modal-head p{
  margin:0;
  color:#64748b;
  font-weight:800;
}

.rq-modal-head button{
  width:38px;
  height:38px;
  border:none;
  border-radius:12px;
  background:#f8fafc;
  color:#334155;
  cursor:pointer;
  font-weight:950;
}

.rq-modal-body{
  display:grid;
  gap:14px;
}

.rq-upload-zone{
  position:relative;
  border:1.5px dashed #bfdbfe;
  border-radius:20px;
  background:linear-gradient(180deg,#f8fbff,#fff);
  padding:22px;
  display:grid;
  place-items:center;
  text-align:center;
  gap:7px;
  cursor:pointer;
  overflow:hidden;
}

.rq-upload-zone input{
  position:absolute;
  inset:0;
  opacity:0;
  cursor:pointer;
}

.rq-upload-zone svg{
  color:#2563eb;
}

.rq-upload-zone strong{
  color:#1d4ed8;
  font-weight:950;
}

.rq-upload-zone span{
  color:#64748b;
  font-weight:800;
}

.rq-review-files{
  display:grid;
  gap:8px;
}

.rq-review-files div{
  border-radius:16px;
  padding:12px 14px;
  background:#f8fafc;
  border:1px solid #e5e7eb;
}

.rq-review-files strong{
  display:block;
  color:#0f172a;
  font-weight:950;
  word-break:break-word;
}

.rq-review-files span{
  color:#64748b;
  font-size:.8rem;
  font-weight:800;
}

.rq-modal-actions{
  margin-top:20px;
  display:flex;
  justify-content:flex-end;
  gap:10px;
  flex-wrap:wrap;
}

html.dark .requests-ultra-page .rq-card,
html.dark .requests-ultra-page .rq-kpi-card,
html.dark .requests-ultra-page .rq-loading-card{
  background:#111a2d;
  border-color:#24324d;
}

html.dark .requests-ultra-page h1,
html.dark .requests-ultra-page h2,
html.dark .requests-ultra-page h3,
html.dark .requests-ultra-page .rq-kpi-card strong,
html.dark .requests-ultra-page .rq-person-cell strong,
html.dark .requests-ultra-page .rq-date-cell strong{
  color:#e5eefc;
}

html.dark .requests-ultra-page p,
html.dark .requests-ultra-page span,
html.dark .requests-ultra-page label{
  color:#9fb0cf;
}

html.dark .requests-ultra-page input,
html.dark .requests-ultra-page select,
html.dark .requests-ultra-page .rq-table-scroll,
html.dark .requests-ultra-page .rq-table tbody td{
  background:#0f1728;
  border-color:#24324d;
  color:#e5eefc;
}

html.dark .requests-ultra-page .rq-table thead th,
html.dark .requests-ultra-page .rq-preview-list div,
html.dark .requests-ultra-page .rq-balance-grid article,
html.dark .requests-ultra-page .rq-empty,
html.dark .requests-ultra-page .rq-pagination{
  background:#0f1728;
  border-color:#24324d;
}

@media(max-width:1280px){
  .rq-command-hero,
  .rq-grid-two{
    grid-template-columns:1fr;
  }

  .rq-kpi-grid{
    grid-template-columns:repeat(2,minmax(0,1fr));
  }

  .rq-balance-grid{
    grid-template-columns:1fr;
  }
}

@media(max-width:768px){
  .rq-command-hero{
    border-radius:26px;
    padding:22px;
  }

  .rq-hero-main h1{
    font-size:2.1rem;
  }

  .rq-hero-side{
    display:none;
  }

  .rq-kpi-grid,
  .rq-form-grid{
    grid-template-columns:1fr;
  }

  .rq-field.full,
  .rq-form-actions{
    grid-column:span 1;
  }

  .rq-card{
    border-radius:24px;
    padding:18px;
  }

  .rq-table{
    min-width:1150px;
  }

  .rq-table.adjustments{
    min-width:1050px;
  }

  .rq-pagination{
    align-items:flex-start;
  }

  .rq-pagination div{
    flex-wrap:wrap;
  }

  .rq-modal-actions{
    flex-direction:column;
  }

  .rq-modal-actions .rq-btn{
    width:100%;
  }
}
`;
