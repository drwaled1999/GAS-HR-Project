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
    setReviewAttachment(null);
    setReviewModalOpen(true);
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
        !reviewAttachment
      ) {
        throw new Error("لازم ترفع مرفق (PDF) قبل الموافقة");
      }

      const body = new FormData();
      body.append("decision", reviewDecision);

      if (reviewReason) {
        body.append("rejectionReason", reviewReason);
      }

      if (reviewAttachment) {
        body.append("reviewAttachment", reviewAttachment);
      }

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
      setReviewAttachment(null);

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

      const response = await fetchAttachmentResponse(requestId, true, attachmentPath);
      const blob = await response.blob();

      if (!blob || blob.size === 0) {
        throw new Error("Empty attachment");
      }

      const disposition = response.headers.get("content-disposition") || "";
      const headerFilename = extractFilenameFromDisposition(disposition);
      const finalName =
        attachmentName || headerFilename || `attachment-${requestId}`;

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
          margin-bottom: 18px;
        }

        .requests-pro-page .section-head h2 {
          margin: 0 0 6px 0;
          font-size: 1.25rem;
          font-weight: 900;
          color: #0f172a;
        }

        .requests-pro-page .section-head p {
          margin: 0;
          color: #64748b;
          font-size: 0.93rem;
        }

        .requests-pro-page .form-grid-pro {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
        }

        .requests-pro-page .field-pro {
          display: flex;
          flex-direction: column;
          gap: 8px;
          color: #344054;
          font-weight: 700;
        }

        .requests-pro-page .field-pro.full {
          grid-column: span 2;
        }

        .requests-pro-page .field-pro input,
        .requests-pro-page .field-pro select {
          min-height: 50px;
          width: 100%;
          border-radius: 16px;
          border: 1px solid #dbe2ea;
          padding: 0 14px;
          background: #fff;
          color: #0f172a;
          font-size: 0.95rem;
          box-sizing: border-box;
        }

        .requests-pro-page .field-pro input[type="file"] {
          padding: 10px 14px;
          min-height: 54px;
        }

        .requests-pro-page .field-pro input:focus,
        .requests-pro-page .field-pro select:focus {
          outline: none;
          border-color: #2563eb;
          box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.08);
        }

        .requests-pro-page .form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          flex-wrap: wrap;
          grid-column: span 2;
        }

        .requests-pro-page .btn-primary-strong,
        .requests-pro-page .btn-soft,
        .requests-pro-page .btn-danger,
        .requests-pro-page .mini-btn {
          min-height: 46px;
          border: none;
          border-radius: 16px;
          padding: 0 16px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-size: 0.9rem;
          font-weight: 900;
          cursor: pointer;
          transition: transform 0.18s ease, opacity 0.2s ease;
        }

        .requests-pro-page .btn-primary-strong:hover,
        .requests-pro-page .btn-soft:hover,
        .requests-pro-page .btn-danger:hover,
        .requests-pro-page .mini-btn:hover {
          transform: translateY(-1px);
        }

        .requests-pro-page .btn-primary-strong {
          background: linear-gradient(135deg, #2563eb, #1d4ed8);
          color: #fff;
          box-shadow: 0 12px 28px rgba(37, 99, 235, 0.22);
        }

        .requests-pro-page .btn-soft {
          background: #eef4ff;
          color: #1d4ed8;
        }

        .requests-pro-page .btn-danger {
          background: #d92d20;
          color: #fff;
        }

        .requests-pro-page .stats-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 16px;
        }

        .requests-pro-page .stat-tile {
          border-radius: 22px;
          padding: 20px;
          border: 1px solid #e8edf4;
          background: linear-gradient(180deg, #ffffff, #f8fafc);
        }

        .requests-pro-page .stat-tile .label {
          display: block;
          color: #64748b;
          font-size: 0.9rem;
          margin-bottom: 12px;
          font-weight: 700;
        }

        .requests-pro-page .stat-tile .value {
          font-size: 2rem;
          font-weight: 900;
          line-height: 1;
        }

        .requests-pro-page .stat-tile.info .value {
          color: #2563eb;
        }

        .requests-pro-page .stat-tile.warning .value {
          color: #b45309;
        }

        .requests-pro-page .stat-tile.success .value {
          color: #047857;
        }

        .requests-pro-page .stat-tile.danger .value {
          color: #be123c;
        }

        .requests-pro-page .balance-box {
          margin-top: 12px;
          border-radius: 22px;
          padding: 20px;
          background: linear-gradient(180deg, #ffffff, #f8fafc);
          border: 1px solid #e8edf4;
        }

        .requests-pro-page .balance-box h3 {
          margin: 0 0 14px 0;
          font-size: 1rem;
          font-weight: 900;
          color: #0f172a;
        }

        .requests-pro-page .balance-list {
          display: grid;
          gap: 10px;
        }

        .requests-pro-page .balance-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 14px;
          padding: 12px 14px;
          border-radius: 14px;
          background: #ffffff;
          border: 1px solid #edf2f7;
        }

        .requests-pro-page .balance-row span {
          color: #475569;
          font-weight: 700;
          min-width: 90px;
        }

        .requests-pro-page .balance-row strong {
          color: #0f172a;
          font-size: 0.95rem;
          font-weight: 900;
          text-align: right;
        }

        .requests-pro-page .table-card {
          padding: 24px;
          overflow: hidden;
        }

        .requests-pro-page .table-scroll {
          width: 100%;
          overflow-x: auto;
          overflow-y: hidden;
          margin-top: 16px;
          padding-bottom: 6px;
        }

        .requests-pro-page table {
          width: 100%;
          min-width: 1480px;
          border-collapse: separate;
          border-spacing: 0 12px;
          table-layout: fixed;
        }

        .requests-pro-page thead th {
          text-align: left;
          font-size: 0.84rem;
          color: #64748b;
          font-weight: 900;
          padding: 0 14px 10px 14px;
          white-space: nowrap;
        }

        .requests-pro-page tbody tr {
          background: transparent;
        }

        .requests-pro-page tbody td {
          padding: 18px 14px;
          color: #0f172a;
          font-weight: 800;
          border-top: 1px solid #e9eef5;
          border-bottom: 1px solid #e9eef5;
          vertical-align: middle;
          background: #ffffff;
          word-break: normal;
          overflow-wrap: normal;
        }

        .requests-pro-page tbody tr:hover td {
          background: #fbfdff;
          box-shadow: 0 10px 26px rgba(15, 23, 42, 0.035);
        }

        .requests-pro-page tbody td:first-child {
          border-left: 1px solid #e9eef5;
          border-top-left-radius: 18px;
          border-bottom-left-radius: 18px;
        }

        .requests-pro-page tbody td:last-child {
          border-right: 1px solid #e9eef5;
          border-top-right-radius: 18px;
          border-bottom-right-radius: 18px;
        }

        .requests-pro-page .col-employee { width: 250px; }
        .requests-pro-page .col-type { width: 270px; }
        .requests-pro-page .col-dates { width: 140px; }
        .requests-pro-page .col-status { width: 130px; }
        .requests-pro-page .col-attachment { width: 280px; }
        .requests-pro-page .col-requestedby { width: 250px; }
        .requests-pro-page .col-action { width: 160px; }

        .requests-pro-page .cell-truncate {
          display: block;
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .requests-pro-page .soft-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: fit-content;
          padding: 8px 13px;
          border-radius: 999px;
          font-size: 0.78rem;
          font-weight: 900;
          white-space: nowrap;
        }

        .requests-pro-page .soft-badge.success {
          background: #dcfce7;
          color: #166534;
        }

        .requests-pro-page .soft-badge.warning {
          background: #fef3c7;
          color: #92400e;
        }

        .requests-pro-page .soft-badge.danger {
          background: #fee2e2;
          color: #991b1b;
        }

        .requests-pro-page .file-actions {
          display: grid;
          gap: 10px;
          max-width: 230px;
        }

        .requests-pro-page .row-actions {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 8px;
        }

        .requests-pro-page .attachment-cell {
          min-width: 260px;
        }

        .requests-pro-page .download-pro-btn {
          width: 100%;
          min-height: 54px;
          border: 1px solid #dbeafe;
          border-radius: 18px;
          background: linear-gradient(135deg, #eff6ff, #ffffff);
          color: #1d4ed8;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 14px;
          cursor: pointer;
          box-shadow: 0 10px 24px rgba(37, 99, 235, 0.08);
          transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
          text-align: left;
        }

        .requests-pro-page .download-pro-btn:hover {
          transform: translateY(-2px);
          border-color: #93c5fd;
          box-shadow: 0 16px 32px rgba(37, 99, 235, 0.14);
        }

        .requests-pro-page .download-pro-btn:disabled {
          opacity: 0.65;
          cursor: not-allowed;
          transform: none;
        }

        .requests-pro-page .download-pro-btn .download-icon {
          width: 34px;
          height: 34px;
          border-radius: 12px;
          background: #2563eb;
          color: #fff;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          font-weight: 900;
          font-size: 1rem;
        }

        .requests-pro-page .download-pro-btn.review .download-icon {
          background: #0891b2;
        }

        .requests-pro-page .download-pro-btn .download-text {
          display: grid;
          gap: 3px;
          min-width: 0;
        }

        .requests-pro-page .download-pro-btn strong {
          font-size: 0.84rem;
          font-weight: 900;
          line-height: 1;
          color: #1e3a8a;
        }

        .requests-pro-page .download-pro-btn small {
          display: block;
          color: #64748b;
          font-size: 0.74rem;
          font-weight: 800;
          line-height: 1.1;
        }

        .requests-pro-page .no-file-pill {
          display: inline-flex;
          align-items: center;
          min-height: 36px;
          padding: 0 14px;
          border-radius: 999px;
          background: #f8fafc;
          color: #94a3b8;
          font-size: 0.82rem;
          font-weight: 900;
          border: 1px solid #e2e8f0;
          white-space: nowrap;
        }

        .requests-pro-page .mini-btn {
          min-height: 36px;
          min-width: 104px;
          padding: 0 12px;
          border-radius: 12px;
          font-size: 0.82rem;
          font-weight: 900;
          white-space: nowrap;
        }

        .requests-pro-page .mini-btn.approve {
          background: #eefdf3;
          color: #047857;
        }

        .requests-pro-page .mini-btn.reject {
          background: #fff1f2;
          color: #be123c;
        }

        .requests-pro-page .muted-text {
          color: #64748b;
          font-weight: 700;
          line-height: 1.5;
        }

        .requests-pro-page .empty-state {
          text-align: center;
          padding: 44px 20px;
          border-radius: 22px;
          background: #f8fafc;
          border: 1px dashed #d9e2ea;
        }

        .requests-pro-page .empty-state p {
          margin: 0 0 6px 0;
          font-weight: 900;
          color: #334155;
          font-size: 1rem;
        }

        .requests-pro-page .empty-state span {
          font-size: 0.9rem;
          color: #64748b;
          font-weight: 600;
        }

        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.45);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          padding: 20px;
        }

        .review-modal-box {
          width: 100%;
          max-width: 520px;
          background: #ffffff;
          border-radius: 24px;
          padding: 24px;
          box-shadow: 0 20px 60px rgba(15, 23, 42, 0.25);
          border: 1px solid #e5e7eb;
        }

        .review-modal-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 18px;
        }

        .review-modal-head h3 {
          margin: 0 0 6px 0;
          font-size: 1.35rem;
          font-weight: 900;
          color: #0f172a;
        }

        .review-modal-head p {
          margin: 0;
          color: #64748b;
          line-height: 1.6;
          font-size: 0.92rem;
        }

        .modal-close-btn {
          border: none;
          background: #f8fafc;
          color: #334155;
          width: 38px;
          height: 38px;
          border-radius: 12px;
          cursor: pointer;
          font-size: 1rem;
          font-weight: 900;
        }

        .review-modal-body {
          display: grid;
          gap: 16px;
        }

        .review-upload-box {
          position: relative;
          border: 1.5px dashed #bfdbfe;
          border-radius: 18px;
          background: linear-gradient(180deg, #f8fbff, #ffffff);
          padding: 18px;
          cursor: pointer;
          overflow: hidden;
        }

        .review-upload-box input[type="file"] {
          position: absolute;
          inset: 0;
          opacity: 0;
          cursor: pointer;
        }

        .review-upload-content {
          display: grid;
          gap: 6px;
        }

        .review-upload-content strong {
          color: #1d4ed8;
          font-size: 0.98rem;
          font-weight: 900;
        }

        .review-upload-content span {
          color: #64748b;
          font-size: 0.9rem;
          line-height: 1.6;
        }

        .review-file-preview {
          display: grid;
          gap: 6px;
          border-radius: 16px;
          background: #f8fafc;
          border: 1px solid #e5e7eb;
          padding: 14px 16px;
        }

        .review-file-preview span {
          color: #64748b;
          font-size: 0.8rem;
          font-weight: 800;
        }

        .review-file-preview strong {
          color: #0f172a;
          font-size: 0.95rem;
          font-weight: 900;
          word-break: break-word;
        }

        .review-file-preview small {
          color: #475467;
          font-size: 0.82rem;
          font-weight: 700;
        }

        .review-modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          flex-wrap: wrap;
          margin-top: 20px;
        }

        @media (max-width: 1200px) {
          .requests-pro-page .hero-shell,
          .requests-pro-page .grid-two {
            grid-template-columns: 1fr;
          }

          .requests-pro-page .hero-kpis {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 768px) {
          .requests-pro-page .hero-main h1 {
            font-size: 2rem;
          }

          .requests-pro-page .hero-kpis,
          .requests-pro-page .stats-grid,
          .requests-pro-page .form-grid-pro {
            grid-template-columns: 1fr;
          }

          .requests-pro-page .field-pro.full,
          .requests-pro-page .form-actions {
            grid-column: span 1;
          }

          .requests-pro-page .balance-row {
            flex-direction: column;
            align-items: flex-start;
          }

          .requests-pro-page .balance-row strong {
            text-align: left;
          }

          .requests-pro-page table {
            min-width: 1120px;
          }

          .requests-pro-page .table-card {
            padding: 18px;
          }

          .review-modal-box {
            padding: 18px;
            border-radius: 20px;
          }

          .review-modal-actions {
            flex-direction: column;
          }

          .review-modal-actions .btn-soft,
          .review-modal-actions .btn-primary-strong {
            width: 100%;
          }
        }
      `}</style>

      <section className="hero-shell">
        <div className="hero-main">
          <div className="hero-badge">Requests Control Center</div>
          <h1>Request Center</h1>
          <p>
            Create leave, salary transfer, salary certificate, and payslip requests,
            review incoming submissions, and track employee request activity from one place.
          </p>

          <div className="hero-kpis">
            <div className="hero-kpi">
              <span className="label">Total Requests</span>
              <strong className="value">{safeLeaveRequests.length}</strong>
            </div>
            <div className="hero-kpi">
              <span className="label">Pending</span>
              <strong className="value">{pendingLeaveCount}</strong>
            </div>
            <div className="hero-kpi">
              <span className="label">Approved</span>
              <strong className="value">{approvedLeaveCount}</strong>
            </div>
            <div className="hero-kpi">
              <span className="label">Rejected</span>
              <strong className="value">{rejectedLeaveCount}</strong>
            </div>
          </div>
        </div>

        <div className="hero-side">
          <div className="side-title">Current Snapshot</div>

          <div className="side-stat">
            <span>Request Type</span>
            <strong>{requestTypeLabel(form.type, safeTypes)}</strong>
          </div>

          <div className="side-stat">
            <span>Employee</span>
            <strong>
              {isRegularEmployee
                ? user?.name || user?.username || "-"
                : resolvedEmployeeId || "-"}
            </strong>
          </div>

          <div className="side-stat">
            <span>Pending Leave</span>
            <strong>{pendingLeaveCount}</strong>
          </div>

          <div className="side-stat">
            <span>Pending Attendance</span>
            <strong>{pendingAttendanceCount}</strong>
          </div>
        </div>
      </section>

      {message ? <div className="alert-pro success">{message}</div> : null}
      {error ? <div className="alert-pro error">{error}</div> : null}

      <section className="grid-two">
        <div className="pro-card section-card">
          <div className="section-head">
            <div>
              <h2>Create Request</h2>
              <p>أنشئ طلب جديد للموظف أو لنفسك حسب الصلاحية.</p>
            </div>
          </div>

          <form className="form-grid-pro" onSubmit={handleSubmit}>
            {canManageOthers ? (
              <label className="field-pro">
                Employee
                <select
                  name="employeeId"
                  value={form.employeeId}
                  onChange={handleChange}
                >
                  <option value="">اختر الموظف</option>
                  {safeEmployees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.name || employee.full_name || "Employee"} —{" "}
                      {employee.gasId || employee.gas_id || ""}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label className="field-pro">
                Employee
                <input
                  value={`${user?.name || user?.username || "Employee"}${
                    resolvedGasId ? ` — ${resolvedGasId}` : ""
                  }`}
                  readOnly
                />
              </label>
            )}

            <label className="field-pro">
              GAS ID
              <input
                name="employeeGasId"
                value={resolvedGasId}
                onChange={handleChange}
                placeholder="مثال: 2036"
                readOnly={isRegularEmployee}
              />
            </label>

            <label className="field-pro">
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
              <label className="field-pro">
                Start Date
                <input
                  type="date"
                  name="startDate"
                  value={form.startDate}
                  onChange={handleChange}
                />
              </label>
            ) : null}

            {selectedType?.requiresDateRange !== false ? (
              <label className="field-pro">
                End Date
                <input
                  type="date"
                  name="endDate"
                  value={form.endDate}
                  onChange={handleChange}
                />
              </label>
            ) : null}

            {selectedType?.requiresBankFields ? (
              <label className="field-pro">
                Current Bank
                <input
                  name="currentBank"
                  value={form.currentBank}
                  onChange={handleChange}
                  placeholder="البنك الحالي"
                />
              </label>
            ) : null}

            {selectedType?.requiresBankFields ? (
              <label className="field-pro">
                New Bank
                <input
                  name="newBank"
                  value={form.newBank}
                  onChange={handleChange}
                  placeholder="البنك الجديد"
                />
              </label>
            ) : null}

            {selectedType?.requiresBankFields ? (
              <label className="field-pro full">
                New IBAN
                <input
                  name="newIban"
                  value={form.newIban}
                  onChange={handleChange}
                  placeholder="SA00 0000 0000 0000 0000 0000"
                />
              </label>
            ) : null}

            <label className="field-pro">
              Attachment
              <input type="file" name="attachment" onChange={handleChange} />
            </label>

            <label className="field-pro full">
              Note
              <input
                name="note"
                value={form.note}
                onChange={handleChange}
                placeholder="سبب الطلب أو أي ملاحظة"
              />
            </label>

            <div className="form-actions">
              <button
                type="submit"
                disabled={submitting}
                className="btn-primary-strong"
              >
                {submitting ? "Submitting..." : "Submit Request"}
              </button>
            </div>
          </form>
        </div>

        <div className="pro-card section-card">
          <div className="section-head">
            <div>
              <h2>Queue Snapshot</h2>
              <p>ملخص سريع لحالة الطلبات والأرصدة الحالية.</p>
            </div>
          </div>

          <div className="stats-grid">
            <article className="stat-tile info">
              <span className="label">Pending Leave / Task</span>
              <strong className="value">{pendingLeaveCount}</strong>
            </article>

            <article className="stat-tile warning">
              <span className="label">Pending Attendance</span>
              <strong className="value">{pendingAttendanceCount}</strong>
            </article>

            <article className="stat-tile success">
              <span className="label">Approved</span>
              <strong className="value">{approvedLeaveCount}</strong>
            </article>

            <article className="stat-tile danger">
              <span className="label">Rejected</span>
              <strong className="value">{rejectedLeaveCount}</strong>
            </article>
          </div>

          <div className="balance-box">
            <h3>Balances</h3>

            <div className="balance-list">
              <div className="balance-row">
                <span>Annual</span>
                <strong>
                  Total: {balances.annual} | Used: {balances.annualUsed} |
                  Remaining: {balances.annualRemaining}
                </strong>
              </div>

              <div className="balance-row">
                <span>Sick</span>
                <strong>
                  Total: {balances.sick} | Used: {balances.sickUsed} |
                  Remaining: {balances.sickRemaining}
                </strong>
              </div>

              <div className="balance-row">
                <span>Emergency</span>
                <strong>
                  Total: {balances.emergency} | Used: {balances.emergencyUsed} |
                  Remaining: {balances.emergencyRemaining}
                </strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="pro-card table-card">
        <div className="section-head">
          <div>
            <h2>Leave / Task Requests</h2>
            <p>Track submitted requests, statuses, and attachments.</p>
          </div>
        </div>

        {safeLeaveRequests.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th className="col-employee">Employee</th>
                  <th className="col-type">Type</th>
                  <th className="col-dates">Dates</th>
                  <th className="col-status">Status</th>
                  <th className="col-attachment">Attachment</th>
                  <th className="col-requestedby">Requested By</th>
                  <th className="col-action">Action</th>
                </tr>
              </thead>
              <tbody>
                {safeLeaveRequests.map((item) => (
                  <tr key={`leave-${item.id}`}>
                    <td>
                      <span className="cell-truncate">{item.employeeName || "-"}</span>
                    </td>
                    <td>
                      <span className="cell-truncate">
                        {requestTypeLabel(item.type, safeTypes)}
                      </span>
                    </td>
                    <td>{formatDateRange(item.startDate, item.endDate)}</td>
                    <td>
                      <span className={`soft-badge ${badgeClass(item.status)}`}>
                        {item.status || "-"}
                      </span>
                    </td>
                    <td className="attachment-cell">
                      {item.attachmentPath || item.reviewAttachmentPath ? (
                        <div className="file-actions">
                          {item.attachmentPath ? (
                            <button
                              type="button"
                              className="download-pro-btn"
                              onClick={() =>
                                handleDownload(
                                  item.id,
                                  item.attachmentName ||
                                    item.attachment_name ||
                                    `request-${item.id}.pdf`,
                                  item.attachmentPath
                                )
                              }
                              disabled={fileBusyId === `download-${item.id}`}
                            >
                              <span className="download-icon">↓</span>
                              <span className="download-text">
                                <strong>
                                  {fileBusyId === `download-${item.id}`
                                    ? "Loading..."
                                    : "Download"}
                                </strong>
                                <small>Employee file</small>
                              </span>
                            </button>
                          ) : null}

                          {item.reviewAttachmentPath ? (
                            <button
                              type="button"
                              className="download-pro-btn review"
                              onClick={() =>
                                handleDownload(
                                  item.id,
                                  item.reviewAttachmentName ||
                                    item.review_attachment_name ||
                                    `review-${item.id}.pdf`,
                                  item.reviewAttachmentPath
                                )
                              }
                              disabled={fileBusyId === `download-${item.id}`}
                            >
                              <span className="download-icon">↓</span>
                              <span className="download-text">
                                <strong>
                                  {fileBusyId === `download-${item.id}`
                                    ? "Loading..."
                                    : "Download"}
                                </strong>
                                <small>Reviewed file</small>
                              </span>
                            </button>
                          ) : null}
                        </div>
                      ) : (
                        <span className="no-file-pill">No attachment</span>
                      )}
                    </td>
                    <td>
                      <span className="cell-truncate">
                        {item.requestedByName || item.requestedBy || "-"}
                      </span>
                    </td>
                    <td>
                      {canReview && item.status === "pending" ? (
                        <div className="row-actions">
                          <button
                            type="button"
                            className="mini-btn approve"
                            onClick={() => reviewLeave(item.id, "approved")}
                            disabled={reviewingId === String(item.id)}
                          >
                            {reviewingId === String(item.id)
                              ? "..."
                              : "Approve"}
                          </button>
                          <button
                            type="button"
                            className="mini-btn reject"
                            onClick={() => reviewLeave(item.id, "rejected")}
                            disabled={reviewingId === String(item.id)}
                          >
                            {reviewingId === String(item.id) ? "..." : "Reject"}
                          </button>
                        </div>
                      ) : item.status === "rejected" && item.rejectionReason ? (
                        <span className="muted-text">
                          {item.rejectionReason}
                        </span>
                      ) : (
                        <span className="muted-text">No action</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <p>No requests yet</p>
            <span>طلبات الإجازات والمهام ستظهر هنا عند إنشائها</span>
          </div>
        )}
      </section>

      <section className="pro-card table-card">
        <div className="section-head">
          <div>
            <h2>Attendance Adjustment Requests</h2>
            <p>Submitted attendance corrections and status updates.</p>
          </div>
        </div>

        {safeAttendanceAdjustments.length ? (
          <div className="table-scroll">
            <table>
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
                    <td>{item.employeeName || item.employeeId || "-"}</td>
                    <td>{formatDisplayDate(item.date)}</td>
                    <td>{item.currentValue || "-"}</td>
                    <td>{item.newStatus || "-"}</td>
                    <td>{item.reason || "-"}</td>
                    <td>
                      <span className={`soft-badge ${badgeClass(item.status)}`}>
                        {item.status || "-"}
                      </span>
                    </td>
                    <td>
                      <span className="cell-truncate">
                        {item.requestedByName || item.requestedBy || "-"}
                      </span>
                    </td>
                    <td>
                      <span className="muted-text">No action</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <p>No attendance adjustment requests yet</p>
            <span>
              Attendance adjustment requests will appear here once submitted
            </span>
          </div>
        )}
      </section>

      {reviewModalOpen && (
        <div className="modal-overlay">
          <div className="modal-box review-modal-box">
            <div className="review-modal-head">
              <div>
                <h3>Approve Request</h3>
                <p>ارفع ملف المراجع ثم اعتمد الطلب.</p>
              </div>

              <button
                type="button"
                className="modal-close-btn"
                onClick={() => {
                  setReviewModalOpen(false);
                  setReviewTarget(null);
                  setReviewDecision("");
                  setReviewReason("");
                  setReviewAttachment(null);
                }}
              >
                ✕
              </button>
            </div>

            <div className="review-modal-body">
              <label className="field-pro">
                <span>Reviewer Note</span>
                <input
                  value={reviewReason}
                  onChange={(e) => setReviewReason(e.target.value)}
                  placeholder="اكتب ملاحظة من المراجع..."
                />
              </label>

              <label className="review-upload-box">
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.webp"
                  onChange={(e) =>
                    setReviewAttachment(e.target.files?.[0] || null)
                  }
                />
                <div className="review-upload-content">
                  <strong>رفع مرفق المراجع</strong>
                  <span>
                    {reviewAttachment
                      ? reviewAttachment.name
                      : "اختر ملف PDF أو صورة للموافقة"}
                  </span>
                </div>
              </label>

              {reviewAttachment ? (
                <div className="review-file-preview">
                  <span>Selected File</span>
                  <strong>{reviewAttachment.name}</strong>
                  <small>
                    {(reviewAttachment.size / 1024 / 1024).toFixed(2)} MB
                  </small>
                </div>
              ) : null}
            </div>

            <div className="review-modal-actions">
              <button
                type="button"
                className="btn-soft"
                onClick={() => {
                  setReviewModalOpen(false);
                  setReviewTarget(null);
                  setReviewDecision("");
                  setReviewReason("");
                  setReviewAttachment(null);
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                className="btn-primary-strong"
                onClick={submitLeaveReview}
                disabled={reviewingId === String(reviewTarget)}
              >
                {reviewingId === String(reviewTarget)
                  ? "Submitting..."
                  : "Approve Now"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
