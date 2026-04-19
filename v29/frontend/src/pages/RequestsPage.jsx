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
  { code: "annual_leave", label: "إجازة سنوية", requiresAttachment: false, requiresDateRange: true, requiresBankFields: false },
  { code: "sick_leave", label: "إجازة مرضية", requiresAttachment: true, requiresDateRange: true, requiresBankFields: false },
  { code: "emergency_leave", label: "إجازة اضطرارية", requiresAttachment: false, requiresDateRange: true, requiresBankFields: false },
  { code: "salary_transfer", label: "تحويل راتب", requiresAttachment: true, requiresDateRange: false, requiresBankFields: true },
  { code: "payslip_request", label: "طلب تعريف بالراتب / Payslip", requiresAttachment: false, requiresDateRange: false, requiresBankFields: false },
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

function buildFileUrl(requestId) {
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

  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewTarget, setReviewTarget] = useState(null);
  const [reviewDecision, setReviewDecision] = useState("");
  const [reviewReason, setReviewReason] = useState("");
  const [reviewAttachment, setReviewAttachment] = useState(null);

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

  const selectedType = useMemo(
    () => safeTypes.find((type) => type.code === form.type),
    [safeTypes, form.type]
  );

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
      setForm((prev) => ({
        ...initialForm,
        employeeId: isRegularEmployee ? user?.employeeId || "" : "",
        employeeGasId: isRegularEmployee ? user?.gasId || "" : "",
      }));

      await loadPage();
    } catch (err) {
      console.error("Submit request error:", err);
      setError(err?.message || "Failed to submit request");
    } finally {
      setSubmitting(false);
    }
  }

  function openReviewModal(item, decision) {
    if (decision === "approved" && item.type === "payslip_request") {
      setReviewTarget(item);
      setReviewDecision(decision);
      setReviewReason("");
      setReviewAttachment(null);
      setReviewModalOpen(true);
      return;
    }

    if (decision === "rejected") {
      const rejectionReason =
        window.prompt("اكتب سبب الرفض", "Rejected by reviewer") || "";

      if (!rejectionReason.trim()) {
        setError("سبب الرفض مطلوب");
        return;
      }

      submitLeaveReview(item.id, decision, rejectionReason, null);
      return;
    }

    submitLeaveReview(item.id, decision, "", null);
  }

  async function submitLeaveReview(id, decision, rejectionReason = "", attachmentFile = null) {
    try {
      setReviewingId(String(id));
      setError("");
      setMessage("");

      const body = new FormData();
      body.append("decision", decision);

      if (rejectionReason) {
        body.append("rejectionReason", rejectionReason);
      }

      if (attachmentFile) {
        body.append("attachment", attachmentFile);
      }

      await apiFetch(`/requests-center/leave/${id}/review`, {
        method: "POST",
        body,
      });

      setMessage(
        decision === "approved"
          ? "تمت الموافقة على الطلب"
          : "تم رفض الطلب"
      );

      setReviewModalOpen(false);
      setReviewTarget(null);
      setReviewDecision("");
      setReviewReason("");
      setReviewAttachment(null);

      await loadPage();
    } catch (err) {
      console.error("Review leave error:", err);
      setError(err?.message || "Failed to review request");
    } finally {
      setReviewingId("");
    }
  }

  async function handleModalApproveSubmit(event) {
    event.preventDefault();

    if (!reviewTarget) return;

    if (reviewTarget.type === "payslip_request" && !reviewAttachment) {
      setError("لازم ترفع المرفق قبل الموافقة على طلب تعريف الراتب");
      return;
    }

    await submitLeaveReview(
      reviewTarget.id,
      reviewDecision || "approved",
      reviewReason || "",
      reviewAttachment
    );
  }

  async function fetchAttachmentResponse(requestId, forceDownload = false) {
    const token = getAuthToken();
    const url = `${buildFileUrl(requestId)}${forceDownload ? "?download=1" : ""}`;

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
      throw new Error(text || "Failed to load attachment");
    }

    return response;
  }

  async function handlePreview(requestId) {
    try {
      setFileBusyId(`preview-${requestId}`);
      setError("");

      const response = await fetchAttachmentResponse(requestId);
      const blob = await response.blob();
      const contentType = response.headers.get("content-type") || blob.type || "";

      if (!blob || blob.size === 0) {
        throw new Error("Empty attachment");
      }

      const allowedPreviewTypes = [
        "application/pdf",
        "image/png",
        "image/jpeg",
        "image/jpg",
        "image/webp",
        "text/plain",
      ];

      if (!allowedPreviewTypes.some((t) => contentType.includes(t))) {
        throw new Error("هذا النوع من الملفات لا يدعم المعاينة المباشرة. استخدم التحميل.");
      }

      const previewBlob = new Blob([blob], {
        type: contentType || "application/octet-stream",
      });

      const url = window.URL.createObjectURL(previewBlob);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => window.URL.revokeObjectURL(url), 60000);
    } catch (err) {
      console.error("Preview error:", err);
      setError("تعذر فتح المرفق كمعاينة. استخدم Download أو تحقق من صيغة الملف.");
    } finally {
      setFileBusyId("");
    }
  }

  async function handleDownload(requestId, attachmentName) {
    try {
      setFileBusyId(`download-${requestId}`);
      setError("");

      const response = await fetchAttachmentResponse(requestId, true);
      const blob = await response.blob();

      if (!blob || blob.size === 0) {
        throw new Error("Empty attachment");
      }

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

  const canReview = canManageOthers;

  if (loading) {
    return (
      <div className="page-stack requests-pro-page">
        <div className="pro-card loading-card">
          <h2>Loading...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="page-stack requests-pro-page">
      <style>{`
        .requests-pro-page {
          display: grid;
          gap: 20px;
          width: 100%;
        }

        .requests-pro-page .pro-card,
        .requests-pro-page .hero-main,
        .requests-pro-page .hero-side {
          border-radius: 28px;
          border: 1px solid rgba(226, 232, 240, 0.95);
          background: rgba(255, 255, 255, 0.96);
          box-shadow: 0 16px 40px rgba(15, 23, 42, 0.06);
          backdrop-filter: blur(10px);
        }

        .requests-pro-page .loading-card {
          padding: 34px;
        }

        .requests-pro-page .hero-shell {
          display: grid;
          grid-template-columns: minmax(0, 1.55fr) minmax(320px, 0.95fr);
          gap: 18px;
        }

        .requests-pro-page .hero-main {
          padding: 28px;
          background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%);
          color: #fff;
          border: none;
        }

        .requests-pro-page .hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border-radius: 999px;
          padding: 8px 14px;
          font-size: 0.82rem;
          font-weight: 800;
          background: rgba(255, 255, 255, 0.14);
          color: #fff;
          margin-bottom: 14px;
        }

        .requests-pro-page .hero-main h1 {
          margin: 0 0 10px 0;
          font-size: 2.35rem;
          font-weight: 900;
          letter-spacing: -0.03em;
          color: #fff;
        }

        .requests-pro-page .hero-main p {
          margin: 0;
          max-width: 760px;
          color: rgba(255, 255, 255, 0.84);
          line-height: 1.7;
          font-size: 0.98rem;
        }

        .requests-pro-page .hero-kpis {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
          margin-top: 20px;
        }

        .requests-pro-page .hero-kpi {
          border-radius: 20px;
          padding: 16px;
          background: rgba(255, 255, 255, 0.12);
          border: 1px solid rgba(255, 255, 255, 0.14);
          min-width: 0;
        }

        .requests-pro-page .hero-kpi .label {
          display: block;
          color: rgba(255, 255, 255, 0.78);
          font-size: 0.82rem;
          font-weight: 700;
          margin-bottom: 8px;
        }

        .requests-pro-page .hero-kpi .value {
          font-size: 1.6rem;
          font-weight: 900;
          color: #fff;
          line-height: 1;
        }

        .requests-pro-page .hero-side {
          padding: 24px;
          display: grid;
          gap: 12px;
          align-content: start;
        }

        .requests-pro-page .side-title {
          font-size: 1rem;
          font-weight: 900;
          color: #0f172a;
        }

        .requests-pro-page .side-stat {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          border-radius: 16px;
          padding: 14px 16px;
          background: #f8fafc;
          border: 1px solid #edf2f7;
        }

        .requests-pro-page .side-stat span {
          color: #64748b;
          font-size: 0.9rem;
          font-weight: 700;
        }

        .requests-pro-page .side-stat strong {
          color: #0f172a;
          font-size: 1rem;
          font-weight: 900;
          text-align: right;
          word-break: break-word;
        }

        .requests-pro-page .alert-pro {
          border-radius: 18px;
          padding: 14px 16px;
          font-weight: 800;
          font-size: 0.94rem;
        }

        .requests-pro-page .alert-pro.success {
          background: #ecfdf3;
          color: #047857;
          border: 1px solid #a7f3d0;
        }

        .requests-pro-page .alert-pro.error {
          background: #fff1f2;
          color: #be123c;
          border: 1px solid #fecdd3;
        }

        .requests-pro-page .grid-two {
          display: grid;
          grid-template-columns: 1.2fr 0.9fr;
          gap: 20px;
        }

        .requests-pro-page .section-card {
          padding: 24px;
          min-width: 0;
        }

        .requests-pro-page .section-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          flex-wrap: wrap;