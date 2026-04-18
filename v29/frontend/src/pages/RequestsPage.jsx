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

function buildFileUrl(requestId, kind = "request") {
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

  async function reviewLeave(id, decision, item) {
    try {
      setReviewingId(String(id));
      setError("");
      setMessage("");

      const rejectionReason =
        decision === "rejected"
          ? window.prompt("اكتب سبب الرفض", "Rejected by reviewer") || ""
          : "";

      if (decision === "rejected" && !rejectionReason.trim()) {
        throw new Error("سبب الرفض مطلوب");
      }

      const isPayslipRequest =
        String(item?.type || "").trim().toLowerCase() === "payslip_request";

      if (decision === "approved" && isPayslipRequest) {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".pdf,.png,.jpg,.jpeg,.webp,.txt,.csv,.xls,.xlsx";
        input.click();

        const selectedFile = await new Promise((resolve) => {
          input.onchange = () => resolve(input.files?.[0] || null);
        });

        if (!selectedFile) {
          throw new Error("لا يمكن الموافقة على طلب الباي سليب بدون مرفق");
        }

        const body = new FormData();
        body.append("decision", decision);
        body.append("rejectionReason", "");
        body.append("reviewAttachment", selectedFile);

        await apiFetch(`/requests-center/leave/${id}/review`, {
          method: "POST",
          body,
        });
      } else {
        await apiFetch(`/requests-center/leave/${id}/review`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: {
            decision,
            rejectionReason,
          },
        });
      }

      setMessage(
        decision === "approved"
          ? "تمت الموافقة على الطلب"
          : "تم رفض الطلب"
      );

      await loadPage();
    } catch (err) {
      console.error("Review leave error:", err);
      setError(err?.message || "Failed to review request");
    } finally {
      setReviewingId("");
    }
  }

  async function fetchAttachmentResponse(requestId, kind = "request", download = false) {
    const token = getAuthToken();
    const baseUrl = buildFileUrl(requestId, kind);
    const url = download ? `${baseUrl}?download=1` : baseUrl;

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

  async function handlePreview(requestId, kind = "request") {
    try {
      setFileBusyId(`preview-${kind}-${requestId}`);
      setError("");

      const response = await fetchAttachmentResponse(requestId, kind, false);
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
      setError(err?.message || "تعذر فتح المرفق كمعاينة. استخدم Download أو تحقق من صيغة الملف.");
    } finally {
      setFileBusyId("");
    }
  }

  async function handleDownload(requestId, attachmentName, kind = "request") {
    try {
      setFileBusyId(`download-${kind}-${requestId}`);
      setError("");

      const response = await fetchAttachmentResponse(requestId, kind, true);
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
      setError(err?.message || "تعذر تحميل المرفق. الملف قد يكون غير صالح أو غير مسموح.");
    } finally {
      setFileBusyId("");
    }
  }

  const canReview = canManageOthers;

  if (loading) {
    return (
      <div className="page requests-pro-page">
        <div className="card loading-card">
          <h2>Loading...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="page requests-pro-page">
      <style>{`
        .requests-pro-page {
          background: linear-gradient(180deg, #f5f7fb 0%, #edf2f8 100%);
        }

        .requests-pro-page .page-header {
          margin-bottom: 24px;
        }

        .requests-pro-page .page-header h1 {
          margin: 0 0 8px 0;
          font-size: 2.9rem;
          font-weight: 900;
          color: #0f172a;
          letter-spacing: -0.035em;
        }

        .requests-pro-page .page-header p {
          margin: 0;
          color: #64748b;
          font-size: 1rem;
        }

        .requests-pro-page .card {
          border-radius: 28px;
          border: 1px solid rgba(226, 232, 240, 0.95);
          background: rgba(255, 255, 255, 0.96);
          box-shadow: 0 18px 45px rgba(15, 23, 42, 0.06);
          backdrop-filter: blur(8px);
        }

        .requests-pro-page .loading-card {
          padding: 40px;
        }

        .requests-pro-page .grid-two {
          display: grid;
          grid-template-columns: 1.2fr 0.9fr;
          gap: 20px;
        }

        .requests-pro-page .grid-two > .card {
          padding: 26px;
        }

        .requests-pro-page h2 {
          margin: 0 0 18px 0;
          font-size: 2rem;
          font-weight: 900;
          color: #0f172a;
          letter-spacing: -0.03em;
        }

        .requests-pro-page h3 {
          margin: 0 0 14px 0;
          font-size: 1.08rem;
          color: #0f172a;
        }

        .requests-pro-page .form-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
        }

        .requests-pro-page .form-grid .span-2 {
          grid-column: span 2;
        }

        .requests-pro-page .form-grid label {
          display: flex;
          flex-direction: column;
          gap: 8px;
          font-weight: 800;
          color: #1e293b;
          font-size: 0.95rem;
        }

        .requests-pro-page .form-grid input,
        .requests-pro-page .form-grid select {
          border: 1px solid #dbe2ea;
          border-radius: 18px;
          padding: 14px 15px;
          min-height: 52px;
          font-size: 0.96rem;
          background: #ffffff;
          color: #0f172a;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }

        .requests-pro-page .form-grid input:focus,
        .requests-pro-page .form-grid select:focus {
          outline: none;
          border-color: #2563eb;
          box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.1);
        }

        .requests-pro-page .modal-actions {
          display: flex;
          justify-content: flex-end;
        }

        .requests-pro-page .modal-actions button {
          min-height: 52px;
          padding: 0 22px;
          border: none;
          border-radius: 18px;
          background: linear-gradient(135deg, #2563eb, #1d4ed8);
          color: #fff;
          font-weight: 900;
          cursor: pointer;
          box-shadow: 0 12px 26px rgba(37, 99, 235, 0.22);
          transition: transform 0.2s ease, opacity 0.2s ease;
        }

        .requests-pro-page .modal-actions button:hover {
          transform: translateY(-1px);
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

        .requests-pro-page .balance-box {
          margin-top: 12px;
          border-radius: 22px;
          padding: 20px;
          background: linear-gradient(180deg, #ffffff, #f8fafc);
          border: 1px solid #e8edf4;
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

        .requests-pro-page .section-card {
          margin-top: 22px;
          padding: 26px;
        }

        .requests-pro-page .section-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 18px;
        }

        .requests-pro-page .section-card-header .subtext {
          color: #64748b;
          font-size: 0.94rem;
          font-weight: 600;
        }

        .requests-pro-page .requests-list {
          display: grid;
          gap: 16px;
        }

        .requests-pro-page .request-row {
          display: grid;
          grid-template-columns:
            minmax(220px, 1.4fr)
            minmax(140px, 0.95fr)
            minmax(140px, 1fr)
            minmax(120px, 0.8fr)
            minmax(150px, 1fr)
            minmax(170px, 1.05fr)
            minmax(170px, auto);
          gap: 16px;
          align-items: center;
          padding: 18px 18px;
          border: 1px solid #e9eef5;
          border-radius: 22px;
          background: #f8fafc;
          transition: background 0.2s ease;
        }

        .requests-pro-page .request-row:hover {
          background: #f1f5f9;
        }

        .requests-pro-page .request-head {
          display: grid;
          grid-template-columns:
            minmax(220px, 1.4fr)
            minmax(140px, 0.95fr)
            minmax(140px, 1fr)
            minmax(120px, 0.8fr)
            minmax(150px, 1fr)
            minmax(170px, 1.05fr)
            minmax(170px, auto);
          gap: 16px;
          padding: 0 8px 8px 8px;
          color: #64748b;
          font-size: 0.88rem;
          font-weight: 900;
        }

        .requests-pro-page .cell-title,
        .requests-pro-page .cell-main,
        .requests-pro-page .cell-muted {
          white-space: normal;
          word-break: break-word;
          overflow-wrap: anywhere;
        }

        .requests-pro-page .cell-title {
          font-weight: 900;
          color: #0f172a;
          font-size: 0.98rem;
          line-height: 1.45;
        }

        .requests-pro-page .cell-main {
          color: #0f172a;
          font-weight: 800;
          line-height: 1.45;
        }

        .requests-pro-page .cell-muted {
          color: #64748b;
          font-size: 0.9rem;
          font-weight: 600;
          line-height: 1.45;
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
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .requests-pro-page .file-btn,
        .requests-pro-page .inline-actions button {
          min-height: 38px;
          padding: 0 13px;
          border: none;
          border-radius: 14px;
          font-size: 0.84rem;
          font-weight: 900;
          cursor: pointer;
          transition: transform 0.2s ease, opacity 0.2s ease;
        }

        .requests-pro-page .file-btn:hover,
        .requests-pro-page .inline-actions button:hover {
          transform: translateY(-1px);
        }

        .requests-pro-page .file-btn.preview {
          background: #e0f2fe;
          color: #0369a1;
        }

        .requests-pro-page .file-btn.download {
          background: #e0e7ff;
          color: #4338ca;
        }

        .requests-pro-page .file-btn.review-file {
          background: #dcfce7;
          color: #166534;
        }

        .requests-pro-page .inline-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          justify-content: flex-start;
        }

        .requests-pro-page .inline-actions button {
          background: #eef4ff;
          color: #1d4ed8;
        }

        .requests-pro-page .inline-actions button.ghost {
          background: #fff1f2;
          color: #be123c;
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

        .requests-pro-page .alert.success,
        .requests-pro-page .alert.error {
          border-radius: 18px;
          padding: 14px 16px;
          margin-bottom: 16px;
          font-weight: 800;
        }

        .requests-pro-page .alert.success {
          background: #ecfdf3;
          color: #047857;
          border: 1px solid #a7f3d0;
        }

        .requests-pro-page .alert.error {
          background: #fff1f2;
          color: #be123c;
          border: 1px solid #fecdd3;
        }

        @media (max-width: 1100px) {
          .requests-pro-page .grid-two {
            grid-template-columns: 1fr;
          }

          .requests-pro-page .request-head {
            display: none;
          }

          .requests-pro-page .request-row {
            grid-template-columns: 1fr;
            gap: 12px;
          }
        }

        @media (max-width: 768px) {
          .requests-pro-page .page-header h1 {
            font-size: 2.1rem;
          }

          .requests-pro-page .stats-grid {
            grid-template-columns: 1fr;
          }

          .requests-pro-page .form-grid {
            grid-template-columns: 1fr;
          }

          .requests-pro-page .form-grid .span-2 {
            grid-column: span 1;
          }

          .requests-pro-page .balance-row {
            flex-direction: column;
            align-items: flex-start;
          }

          .requests-pro-page .balance-row strong {
            text-align: left;
          }
        }
      `}</style>

      <div className="page-header">
        <div>
          <h1>Request Center</h1>
          <p>إجازات، سكاليف، مهام عمل، وتحويلات رواتب.</p>
        </div>
      </div>

      {message ? <div className="alert success">{message}</div> : null}
      {error ? <div className="alert error">{error}</div> : null}

      <div className="grid-two">
        <section className="card">
          <h2>Create Request</h2>

          <form className="form-grid" onSubmit={handleSubmit}>
            {canManageOthers ? (
              <label>
                Employee
                <select name="employeeId" value={form.employeeId} onChange={handleChange}>
                  <option value="">اختر الموظف</option>
                  {safeEmployees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.name || employee.full_name || "Employee"} — {employee.gasId || employee.gas_id || ""}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label>
                Employee
                <input
                  value={`${user?.name || user?.username || "Employee"}${resolvedGasId ? ` — ${resolvedGasId}` : ""}`}
                  readOnly
                />
              </label>
            )}

            <label>
              GAS ID
              <input
                name="employeeGasId"
                value={resolvedGasId}
                onChange={handleChange}
                placeholder="مثال: 2036"
                readOnly={isRegularEmployee}
              />
            </label>

            <label>
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
              <>
                <label>
                  Start Date
                  <input type="date" name="startDate" value={form.startDate} onChange={handleChange} />
                </label>

                <label>
                  End Date
                  <input type="date" name="endDate" value={form.endDate} onChange={handleChange} />
                </label>
              </>
            ) : null}

            {selectedType?.requiresBankFields ? (
              <>
                <label>
                  Current Bank
                  <input
                    name="currentBank"
                    value={form.currentBank}
                    onChange={handleChange}
                    placeholder="البنك الحالي"
                  />
                </label>

                <label>
                  New Bank
                  <input
                    name="newBank"
                    value={form.newBank}
                    onChange={handleChange}
                    placeholder="البنك الجديد"
                  />
                </label>

                <label className="span-2">
                  New IBAN
                  <input
                    name="newIban"
                    value={form.newIban}
                    onChange={handleChange}
                    placeholder="SA00 0000 0000 0000 0000 0000"
                  />
                </label>
              </>
            ) : null}

            <label>
              Attachment
              <input type="file" name="attachment" onChange={handleChange} />
            </label>

            <label className="span-2">
              Note
              <input
                name="note"
                value={form.note}
                onChange={handleChange}
                placeholder="سبب الطلب أو أي ملاحظة"
              />
            </label>

            <div className="span-2 modal-actions">
              <button type="submit" disabled={submitting}>
                {submitting ? "Submitting..." : "Submit Request"}
              </button>
            </div>
          </form>
        </section>

        <section className="card">
          <h2>Queue Snapshot</h2>

          <div className="stats-grid">
            <article className="stat-tile info">
              <span className="label">Pending Leave / Task</span>
              <strong className="value">{pendingLeaveCount}</strong>
            </article>

            <article className="stat-tile warning">
              <span className="label">Pending Attendance</span>
              <strong className="value">{pendingAttendanceCount}</strong>
            </article>
          </div>

          <div className="balance-box">
            <h3>Balances</h3>

            <div className="balance-list">
              <div className="balance-row">
                <span>Annual</span>
                <strong>
                  Total: {balances.annual} | Used: {balances.annualUsed} | Remaining: {balances.annualRemaining}
                </strong>
              </div>

              <div className="balance-row">
                <span>Sick</span>
                <strong>
                  Total: {balances.sick} | Used: {balances.sickUsed} | Remaining: {balances.sickRemaining}
                </strong>
              </div>

              <div className="balance-row">
                <span>Emergency</span>
                <strong>
                  Total: {balances.emergency} | Used: {balances.emergencyUsed} | Remaining: {balances.emergencyRemaining}
                </strong>
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="card section-card">
        <div className="section-card-header">
          <div>
            <h2>Leave / Task Requests</h2>
            <div className="subtext">Track submitted requests, statuses, and attachments.</div>
          </div>
        </div>

        {safeLeaveRequests.length ? (
          <>
            <div className="request-head">
              <div>Employee</div>
              <div>Type</div>
              <div>Dates</div>
              <div>Status</div>
              <div>Attachment</div>
              <div>Requested By</div>
              <div>Action</div>
            </div>

            <div className="requests-list">
              {safeLeaveRequests.map((item) => {
                const hasOriginalAttachment = !!item.attachmentPath;
                const hasReviewAttachment = !!item.reviewAttachmentPath;
                const isPayslipRequest =
                  String(item.type || "").trim().toLowerCase() === "payslip_request";

                return (
                  <div className="request-row" key={`leave-${item.id}`}>
                    <div>
                      <div className="cell-title">{item.employeeName || "-"}</div>
                    </div>

                    <div>
                      <div className="cell-main">{requestTypeLabel(item.type, safeTypes)}</div>
                    </div>

                    <div>
                      <div className="cell-main">{formatDateRange(item.startDate, item.endDate)}</div>
                    </div>

                    <div>
                      <span className={`soft-badge ${badgeClass(item.status)}`}>
                        {item.status || "-"}
                      </span>
                    </div>

                    <div>
                      {hasOriginalAttachment || hasReviewAttachment ? (
                        <div className="file-actions">
                          {hasOriginalAttachment ? (
                            <>
                              <button
                                type="button"
                                className="file-btn preview"
                                onClick={() => handlePreview(item.id, "request")}
                                disabled={fileBusyId === `preview-request-${item.id}`}
                              >
                                {fileBusyId === `preview-request-${item.id}` ? "..." : "Preview"}
                              </button>

                              <button
                                type="button"
                                className="file-btn download"
                                onClick={() =>
                                  handleDownload(
                                    item.id,
                                    item.attachmentName || item.attachment_name,
                                    "request"
                                  )
                                }
                                disabled={fileBusyId === `download-request-${item.id}`}
                              >
                                {fileBusyId === `download-request-${item.id}` ? "..." : "Download"}
                              </button>
                            </>
                          ) : null}

                          {hasReviewAttachment ? (
                            <>
                              <button
                                type="button"
                                className="file-btn review-file"
                                onClick={() => handlePreview(item.id, "review")}
                                disabled={fileBusyId === `preview-review-${item.id}`}
                              >
                                {fileBusyId === `preview-review-${item.id}` ? "..." : "Payslip Preview"}
                              </button>

                              <button
                                type="button"
                                className="file-btn download"
                                onClick={() =>
                                  handleDownload(
                                    item.id,
                                    item.reviewAttachmentName || `payslip-${item.id}`,
                                    "review"
                                  )
                                }
                                disabled={fileBusyId === `download-review-${item.id}`}
                              >
                                {fileBusyId === `download-review-${item.id}` ? "..." : "Payslip Download"}
                              </button>
                            </>
                          ) : null}
                        </div>
                      ) : (
                        <span className="cell-muted">No attachment</span>
                      )}
                    </div>

                    <div>
                      <div className="cell-main">{item.requestedByName || item.requestedBy || "-"}</div>
                    </div>

                    <div>
                      {canReview && item.status === "pending" ? (
                        <div className="inline-actions">
                          <button
                            type="button"
                            onClick={() => reviewLeave(item.id, "approved", item)}
                            disabled={reviewingId === String(item.id)}
                            title={
                              isPayslipRequest
                                ? "سيُطلب منك رفع مرفق payslip قبل الموافقة"
                                : ""
                            }
                          >
                            {reviewingId === String(item.id) ? "..." : "Approve"}
                          </button>
                          <button
                            type="button"
                            className="ghost"
                            onClick={() => reviewLeave(item.id, "rejected", item)}
                            disabled={reviewingId === String(item.id)}
                          >
                            {reviewingId === String(item.id) ? "..." : "Reject"}
                          </button>
                        </div>
                      ) : item.status === "rejected" && item.rejectionReason ? (
                        <span className="cell-muted">{item.rejectionReason}</span>
                      ) : (
                        <span className="cell-muted">
                          {item.status === "approved" && hasReviewAttachment
                            ? "Approved with payslip"
                            : "No action"}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="empty-state">
            <p>No requests yet</p>
            <span>طلبات الإجازات والمهام ستظهر هنا عند إنشائها</span>
          </div>
        )}
      </section>

      <section className="card section-card">
        <div className="section-card-header">
          <div>
            <h2>Attendance Adjustment Requests</h2>
            <div className="subtext">Submitted attendance corrections and status updates.</div>
          </div>
        </div>

        {safeAttendanceAdjustments.length ? (
          <>
            <div
              className="request-head"
              style={{ gridTemplateColumns: "1.1fr 0.8fr 0.8fr 0.9fr 1.2fr 0.8fr 1fr 0.8fr" }}
            >
              <div>Employee</div>
              <div>Date</div>
              <div>Current</div>
              <div>Requested</div>
              <div>Reason</div>
              <div>Status</div>
              <div>Requested By</div>
              <div>Action</div>
            </div>

            <div className="requests-list">
              {safeAttendanceAdjustments.map((item) => (
                <div
                  className="request-row"
                  key={`att-${item.id}`}
                  style={{ gridTemplateColumns: "1.1fr 0.8fr 0.8fr 0.9fr 1.2fr 0.8fr 1fr 0.8fr" }}
                >
                  <div>
                    <div className="cell-title">{item.employeeName || item.employeeId || "-"}</div>
                  </div>
                  <div>
                    <div className="cell-main">{formatDisplayDate(item.date)}</div>
                  </div>
                  <div>
                    <div className="cell-main">{item.currentValue || "-"}</div>
                  </div>
                  <div>
                    <div className="cell-main">{item.newStatus || "-"}</div>
                  </div>
                  <div>
                    <div className="cell-muted">{item.reason || "-"}</div>
                  </div>
                  <div>
                    <span className={`soft-badge ${badgeClass(item.status)}`}>
                      {item.status || "-"}
                    </span>
                  </div>
                  <div>
                    <div className="cell-main">{item.requestedByName || item.requestedBy || "-"}</div>
                  </div>
                  <div>
                    <span className="cell-muted">No action</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="empty-state">
            <p>No attendance adjustment requests yet</p>
            <span>Attendance adjustment requests will appear here once submitted</span>
          </div>
        )}
      </section>
    </div>
  );
}