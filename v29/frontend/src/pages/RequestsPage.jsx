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
  { code: "annual_leave", label: "إجازة سنوية" },
  { code: "sick_leave", label: "إجازة مرضية" },
  { code: "emergency_leave", label: "إجازة اضطرارية" },
  { code: "salary_transfer", label: "تحويل راتب" },
  { code: "task_request", label: "تكليف / مهمة" },
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

export default function RequestsPage() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
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

  const pendingLeaveCount = safeLeaveRequests.filter((item) => item.status === "pending").length;
  const pendingAttendanceCount = safeAttendanceAdjustments.filter((item) => item.status === "pending").length;

  const resolvedEmployeeId = useMemo(() => {
    if (form.employeeId) return form.employeeId;
    return user?.employeeId || user?.id || "";
  }, [form.employeeId, user?.employeeId, user?.id]);

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
          employeeId: prev.employeeId || user?.employeeId || user?.id || "",
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

      if (!resolvedEmployeeId) {
        throw new Error("تعذر تحديد الموظف صاحب الطلب");
      }

      await apiFetch("/requests-center/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: resolvedEmployeeId,
          type: form.type,
          note: form.note || "",
          startDate: form.startDate || null,
          endDate: form.endDate || null,
          currentBank: form.currentBank || null,
          newBank: form.newBank || null,
          newIban: form.newIban || null,
          requestedBy: user?.username || "system",
        }),
      });

      setMessage("تم إرسال الطلب بنجاح");

      setForm((prev) => ({
        ...initialForm,
        employeeId: isRegularEmployee ? user?.employeeId || user?.id || "" : "",
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
    <div className="page">
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

            <label>
              Start Date
              <input type="date" name="startDate" value={form.startDate} onChange={handleChange} />
            </label>

            <label>
              End Date
              <input type="date" name="endDate" value={form.endDate} onChange={handleChange} />
            </label>

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

            <label>
              Attachment
              <input type="file" name="attachment" onChange={handleChange} />
            </label>

            <div className="span-2">
              <p className="muted small">
                رفع المرفقات متوقف مؤقتًا حتى يتم ربط backend لاستقبال الملفات.
              </p>
            </div>

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

          <div className="mobile-stat-grid">
            <article className="card mobile-stat info">
              <span>Pending Leave / Task</span>
              <strong>{pendingLeaveCount}</strong>
            </article>
            <article className="card mobile-stat warning">
              <span>Pending Attendance</span>
              <strong>{pendingAttendanceCount}</strong>
            </article>
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <h3>Balances</h3>
            <p>Annual: {balances.annual}</p>
            <p>Sick: {balances.sick}</p>
            <p>Emergency: {balances.emergency}</p>
          </div>
        </section>
      </div>
    </div>
  );
}
