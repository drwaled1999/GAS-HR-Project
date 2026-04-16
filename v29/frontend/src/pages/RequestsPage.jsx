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
    sick: 15,
    emergency: 5,
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
              sick: Number(balancesRes.value?.balances?.sick ?? 15),
              emergency: Number(balancesRes.value?.balances?.emergency ?? 5),
            }
          : {
              annual: 30,
              sick: 15,
              emergency: 5,
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

  async function reviewLeave(id, decision) {
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

  async function fetchAttachmentBlob(requestId) {
    const token = getAuthToken();

    const response = await fetch(`/files/request/${requestId}`, {
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

    return response.blob();
  }

  async function handlePreview(requestId) {
    try {
      setFileBusyId(`preview-${requestId}`);
      const blob = await fetchAttachmentBlob(requestId);
      const url = window.URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => window.URL.revokeObjectURL(url), 60000);
    } catch (err) {
      console.error("Preview error:", err);
      setError("تعذر فتح المرفق. تأكد من تسجيل الدخول وصلاحية الملف.");
    } finally {
      setFileBusyId("");
    }
  }

  async function handleDownload(requestId, attachmentName) {
    try {
      setFileBusyId(`download-${requestId}`);
      const blob = await fetchAttachmentBlob(requestId);
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = attachmentName || `attachment-${requestId}`;
      document.body.appendChild(a);
      a.click();
      a.remove();

      setTimeout(() => window.URL.revokeObjectURL(url), 60000);
    } catch (err) {
      console.error("Download error:", err);
      setError("تعذر تحميل المرفق. تأكد من تسجيل الدخول وصلاحية الملف.");
    } finally {
      setFileBusyId("");
    }
  }

  const canReview = canManageOthers;

  if (loading) {
    return (
      <div className="page">
        <div className="card">
          <h2>Loading...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="page requests-pro-page">
      <style>{`
        .requests-pro-page .page-header {
          margin-bottom: 20px;
        }

        .requests-pro-page .page-header h1 {
          font-size: 2.4rem;
          font-weight: 800;
          letter-spacing: -0.02em;
          color: #0f172a;
          margin-bottom: 8px;
        }

        .requests-pro-page .page-header p {
          color: #64748b;
          font-size: 1rem;
          margin: 0;
        }

        .requests-pro-page .card {
          border-radius: 22px;
          border: 1px solid #e5e7eb;
          background: #ffffff;
          box-shadow: 0 12px 30px rgba(15, 23, 42, 0.05);
        }

        .requests-pro-page .form-grid label {
          display: flex;
          flex-direction: column;
          gap: 8px;
          font-weight: 600;
          color: #1e293b;
        }

        .requests-pro-page .form-grid input,
        .requests-pro-page .form-grid select {
          border: 1px solid #dbe2ea;
          border-radius: 14px;
          padding: 13px 14px;
          min-height: 48px;
          font-size: 0.95rem;
          background: #fff;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }

        .requests-pro-page .form-grid input:focus,
        .requests-pro-page .form-grid select:focus {
          outline: none;
          border-color: #2563eb;
          box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.1);
        }

        .requests-pro-page .modal-actions button,
        .requests-pro-page .inline-actions button,
        .requests-pro-page .file-btn {
          border: none;
          border-radius: 14px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .requests-pro-page .modal-actions button {
          min-height: 48px;
          padding: 0 20px;
          background: linear-gradient(135deg, #2563eb, #1d4ed8);
          color: #fff;
          box-shadow: 0 10px 20px rgba(37, 99, 235, 0.18);
        }

        .requests-pro-page .modal-actions button:hover,
        .requests-pro-page .inline-actions button:hover,
        .requests-pro-page .file-btn:hover {
          transform: translateY(-1px);
        }

        .requests-pro-page .inline-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .requests-pro-page .inline-actions button {
          min-height: 38px;
          padding: 0 14px;
          background: #eef4ff;
          color: #1d4ed8;
        }

        .requests-pro-page .inline-actions button.ghost {
          background: #fff1f2;
          color: #be123c;
        }

        .requests-pro-page .stats-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 16px;
        }

        .requests-pro-page .stat-tile {
          border-radius: 18px;
          padding: 18px;
          border: 1px solid #e5e7eb;
          background: #f8fafc;
        }

        .requests-pro-page .stat-tile .label {
          display: block;
          color: #64748b;
          font-size: 0.92rem;
          margin-bottom: 10px;
        }

        .requests-pro-page .stat-tile .value {
          font-size: 2rem;
          font-weight: 800;
          line-height: 1;
        }

        .requests-pro-page .stat-tile.info .value {
          color: #2563eb;
        }

        .requests-pro-page .stat-tile.warning .value {
          color: #b45309;
        }

        .requests-pro-page .balance-box {
          margin-top: 14px;
          border-radius: 18px;
          padding: 18px 20px;
          background: linear-gradient(180deg, #ffffff, #f8fafc);
          border: 1px solid #e5e7eb;
        }

        .requests-pro-page .balance-box h3 {
          margin: 0 0 12px 0;
          font-size: 1.05rem;
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
          padding: 10px 12px;
          border-radius: 12px;
          background: #ffffff;
          border: 1px solid #eef2f7;
        }

        .requests-pro-page .balance-row span {
          color: #475569;
        }

        .requests-pro-page .balance-row strong {
          color: #0f172a;
          font-size: 1rem;
        }

        .requests-pro-page .table-wrap {
          margin-top: 18px;
          padding: 22px 22px 18px 22px;
        }

        .requests-pro-page .table-wrap h2 {
          margin-bottom: 14px;
          font-size: 1.9rem;
          font-weight: 800;
          letter-spacing: -0.02em;
          color: #0f172a;
        }

        .requests-pro-page table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0 10px;
        }

        .requests-pro-page thead th {
          text-align: left;
          font-size: 0.9rem;
          font-weight: 700;
          color: #64748b;
          padding: 0 14px 10px 14px;
        }

        .requests-pro-page tbody tr {
          background: #f8fafc;
          transition: background 0.2s ease, transform 0.2s ease;
        }

        .requests-pro-page tbody tr:hover {
          background: #f1f5f9;
        }

        .requests-pro-page tbody td {
          padding: 16px 14px;
          vertical-align: middle;
          border-top: 1px solid #e9eef5;
          border-bottom: 1px solid #e9eef5;
          color: #0f172a;
        }

        .requests-pro-page tbody td:first-child {
          border-left: 1px solid #e9eef5;
          border-top-left-radius: 16px;
          border-bottom-left-radius: 16px;
          font-weight: 700;
        }

        .requests-pro-page tbody td:last-child {
          border-right: 1px solid #e9eef5;
          border-top-right-radius: 16px;
          border-bottom-right-radius: 16px;
        }

        .requests-pro-page .soft-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 7px 12px;
          border-radius: 999px;
          font-size: 0.78rem;
          font-weight: 800;
          text-transform: capitalize;
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

        .requests-pro-page .muted.small {
          color: #64748b;
          font-size: 0.88rem;
        }

        .requests-pro-page .file-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .requests-pro-page .file-btn {
          min-height: 34px;
          padding: 0 12px;
          font-size: 0.82rem;
          font-weight: 700;
        }

        .requests-pro-page .file-btn.preview {
          background: #e0f2fe;
          color: #0369a1;
        }

        .requests-pro-page .file-btn.download {
          background: #e0e7ff;
          color: #4338ca;
        }

        .requests-pro-page .empty-state {
          text-align: center;
          padding: 34px 18px;
          color: #64748b;
        }

        .requests-pro-page .empty-state p {
          margin: 0 0 6px 0;
          font-weight: 700;
          color: #334155;
          font-size: 1rem;
        }

        .requests-pro-page .empty-state span {
          font-size: 0.9rem;
          color: #64748b;
        }

        .requests-pro-page .alert.success,
        .requests-pro-page .alert.error {
          border-radius: 16px;
          padding: 14px 16px;
          margin-bottom: 16px;
          font-weight: 700;
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
          .requests-pro-page table {
            min-width: 980px;
          }

          .requests-pro-page .table-wrap {
            overflow-x: auto;
          }
        }

        @media (max-width: 768px) {
          .requests-pro-page .stats-grid {
            grid-template-columns: 1fr;
          }

          .requests-pro-page .page-header h1 {
            font-size: 2rem;
          }

          .requests-pro-page .table-wrap h2 {
            font-size: 1.5rem;
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
                <strong>{balances.annual}</strong>
              </div>
              <div className="balance-row">
                <span>Sick</span>
                <strong>{balances.sick}</strong>
              </div>
              <div className="balance-row">
                <span>Emergency</span>
                <strong>{balances.emergency}</strong>
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="card table-wrap compact-table">
        <h2>Leave / Task Requests</h2>

        <table>
          <thead>
            <tr>
              <th>Employee</th>
              <th>Type</th>
              <th>Dates</th>
              <th>Status</th>
              <th>Attachment</th>
              <th>Requested By</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {safeLeaveRequests.length ? (
              safeLeaveRequests.map((item) => (
                <tr key={`leave-${item.id}`}>
                  <td>{item.employeeName || "-"}</td>
                  <td>{item.type || "-"}</td>
                  <td>{formatDateRange(item.startDate, item.endDate)}</td>
                  <td>
                    <span className={`soft-badge ${badgeClass(item.status)}`}>
                      {item.status || "-"}
                    </span>
                  </td>
                  <td>
                    {item.attachmentPath ? (
                      <div className="file-actions">
                        <button
                          type="button"
                          className="file-btn preview"
                          onClick={() => handlePreview(item.id)}
                          disabled={fileBusyId === `preview-${item.id}`}
                        >
                          {fileBusyId === `preview-${item.id}` ? "..." : "Preview"}
                        </button>

                        <button
                          type="button"
                          className="file-btn download"
                          onClick={() =>
                            handleDownload(item.id, item.attachmentName || item.attachment_name)
                          }
                          disabled={fileBusyId === `download-${item.id}`}
                        >
                          {fileBusyId === `download-${item.id}` ? "..." : "Download"}
                        </button>
                      </div>
                    ) : (
                      <span className="muted small">No attachment</span>
                    )}
                  </td>
                  <td>{item.requestedByName || item.requestedBy || "-"}</td>
                  <td>
                    {canReview && item.status === "pending" ? (
                      <div className="inline-actions wrap-actions">
                        <button
                          type="button"
                          onClick={() => reviewLeave(item.id, "approved")}
                          disabled={reviewingId === String(item.id)}
                        >
                          {reviewingId === String(item.id) ? "..." : "Approve"}
                        </button>
                        <button
                          type="button"
                          className="ghost"
                          onClick={() => reviewLeave(item.id, "rejected")}
                          disabled={reviewingId === String(item.id)}
                        >
                          {reviewingId === String(item.id) ? "..." : "Reject"}
                        </button>
                      </div>
                    ) : item.status === "rejected" && item.rejectionReason ? (
                      <span className="muted small">{item.rejectionReason}</span>
                    ) : (
                      <span className="muted small">No action</span>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="7">
                  <div className="empty-state">
                    <p>No requests yet</p>
                    <span>طلبات الإجازات والمهام ستظهر هنا عند إنشائها</span>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="card table-wrap compact-table">
        <h2>Attendance Adjustment Requests</h2>

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
            {safeAttendanceAdjustments.length ? (
              safeAttendanceAdjustments.map((item) => (
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
                  <td>{item.requestedByName || item.requestedBy || "-"}</td>
                  <td>
                    <span className="muted small">No action</span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="8">
                  <div className="empty-state">
                    <p>No attendance adjustment requests yet</p>
                    <span>Attendance adjustment requests will appear here once submitted</span>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
