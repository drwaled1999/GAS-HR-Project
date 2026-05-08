import { useEffect, useMemo, useState } from "react";
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
    code: "salary_certificate",
    label: "طلب تعريف بالراتب",
    requiresAttachment: false,
    requiresDateRange: false,
    requiresBankFields: false,
  },
  {
    code: "payslip_request",
    label: "طلب كشف راتب (Payslip)",
    requiresAttachment: false,
    requiresDateRange: false,
    requiresBankFields: false,
  },
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
  const startLabel = formatDisplayDate(start);
  const endLabel = formatDisplayDate(end);

  if (!start && !end) return "-";
  if (start && end && String(start) !== String(end)) {
    return `${startLabel} → ${endLabel}`;
  }
  return startLabel;
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

function buildFileUrl(requestId, attachmentPath = "") {
  if (isRemoteUrl(attachmentPath)) {
    return attachmentPath;
  }

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

function getGasId(item = {}) {
  return (
    item.employeeGasId ||
    item.gasId ||
    item.employee_gas_id ||
    item.gas_id ||
    "-"
  );
}

function EmployeeCell({ name, gasId }) {
  return (
    <div className="employee-cell-pro">
      <strong>{name || "-"}</strong>
      <span>GAS ID: {gasId || "-"}</span>
    </div>
  );
}

function DateCell({ startDate, endDate }) {
  return (
    <div className="date-cell-pro">
      <strong>From: {formatDisplayDate(startDate)}</strong>
      <span>To: {formatDisplayDate(endDate)}</span>
      <small>{formatDateRange(startDate, endDate)}</small>
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

  const [requestSearch, setRequestSearch] = useState("");
  const [requestStatusFilter, setRequestStatusFilter] = useState("all");
  const [sortConfig, setSortConfig] = useState({
    key: "createdAt",
    direction: "desc",
  });
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

  const selectedType = useMemo(() => {
    return safeTypes.find((type) => type.code === form.type);
  }, [safeTypes, form.type]);

  const pendingLeaveCount = safeLeaveRequests.filter(
    (item) => item.status === "pending"
  ).length;
  const approvedLeaveCount = safeLeaveRequests.filter(
    (item) => item.status === "approved"
  ).length;
  const rejectedLeaveCount = safeLeaveRequests.filter(
    (item) => item.status === "rejected"
  ).length;
  const pendingAttendanceCount = safeAttendanceAdjustments.filter(
    (item) => item.status === "pending"
  ).length;

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
        apiFetch(
          `/requests-center/list?username=${encodeURIComponent(user.username)}`
        ),
        apiFetch(
          `/requests-center/balances?username=${encodeURIComponent(
            user.username
          )}`
        ),
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
        listRes.status === "fulfilled" &&
        Array.isArray(listRes.value?.leaveRequests)
          ? listRes.value.leaveRequests
          : [];

      const nextAttendanceAdjustments =
        listRes.status === "fulfilled" &&
        Array.isArray(listRes.value?.attendanceAdjustments)
          ? listRes.value.attendanceAdjustments
          : [];

      const nextBalances =
        balancesRes.status === "fulfilled"
          ? {
              annual: Number(balancesRes.value?.balances?.annual ?? 30),
              annualUsed: Number(balancesRes.value?.balances?.annualUsed ?? 0),
              annualRemaining: Number(
                balancesRes.value?.balances?.annualRemaining ?? 30
              ),
              sick: Number(balancesRes.value?.balances?.sick ?? 15),
              sickUsed: Number(balancesRes.value?.balances?.sickUsed ?? 0),
              sickRemaining: Number(
                balancesRes.value?.balances?.sickRemaining ?? 15
              ),
              emergency: Number(balancesRes.value?.balances?.emergency ?? 5),
              emergencyUsed: Number(
                balancesRes.value?.balances?.emergencyUsed ?? 0
              ),
              emergencyRemaining: Number(
                balancesRes.value?.balances?.emergencyRemaining ?? 5
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
      setForm((prev) => ({
        ...prev,
        startDate: "",
        endDate: "",
      }));
    }
  }, [selectedType?.code]);

  function handleChange(event) {
    const { name, value, files } = event.target;
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
        throw new Error(
          "تعذر تحديد الموظف صاحب الطلب. تأكد أن الحساب مربوط بموظف أو GAS ID."
        );
      }

      if (
        selectedType?.requiresDateRange &&
        (!form.startDate || !form.endDate)
      ) {
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

      if (resolvedEmployeeId) {
        body.append("employeeId", String(resolvedEmployeeId));
      }

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

      const currentRequest = leaveRequests.find(
        (r) => String(r.id) === String(reviewTarget)
      );

      const reviewAttachmentRequiredTypes = [
        "payslip_request",
        "salary_certificate",
      ];
      const currentType = String(currentRequest?.type || "").toLowerCase();
      const requiresReviewAttachment =
        reviewAttachmentRequiredTypes.includes(currentType);

      if (
        reviewDecision === "approved" &&
        requiresReviewAttachment &&
        reviewAttachments.length === 0
      ) {
        throw new Error("لازم ترفع مرفق (PDF) قبل الموافقة");
      }

      const body = new FormData();
      body.append("decision", reviewDecision);

      if (reviewReason) {
        body.append("rejectionReason", reviewReason);
      }

      reviewAttachments.forEach((file) => {
        body.append("reviewAttachments", file);
      });

      await apiFetch(`/requests-center/leave/${reviewTarget}/review`, {
        method: "POST",
        body,
      });

      setMessage(
        reviewDecision === "approved"
          ? "تمت الموافقة على الطلب"
          : "تم رفض الطلب"
      );

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

  async function fetchAttachmentResponse(
    requestId,
    forceDownload = false,
    attachmentPath = ""
  ) {
    const token = getAuthToken();
    const isRemote = isRemoteUrl(attachmentPath);
    const baseUrl = buildFileUrl(requestId, attachmentPath);
    const url = forceDownload && !isRemote ? `${baseUrl}?download=1` : baseUrl;

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

  async function handlePreview(requestId, attachmentPath = "") {
    try {
      setFileBusyId(`preview-${requestId}`);
      setError("");

      const url = buildFileUrl(requestId, attachmentPath);

      if (!url) {
        throw new Error("No attachment URL");
      }

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

      const response = await fetchAttachmentResponse(
        requestId,
        true,
        attachmentPath
      );
      const blob = await response.blob();

      if (!blob || blob.size === 0) {
        throw new Error("Empty attachment");
      }

      const disposition = response.headers.get("content-disposition") || "";
      const headerFilename = extractFilename
