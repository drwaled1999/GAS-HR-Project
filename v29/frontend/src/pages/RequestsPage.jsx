import { useEffect, useState } from "react";
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

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function badgeClass(status) {
  const s = String(status || "").toLowerCase();
  if (s === "approved") return "success";
  if (s === "rejected") return "danger";
  return "warning";
}

export default function RequestsPage() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
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

  const safeTypes = asArray(types);
  const safeEmployees = asArray(employees);
  const safeLeaveRequests = asArray(leaveRequests);
  const safeAttendanceAdjustments = asArray(attendanceAdjustments);

  const pendingLeaveCount = safeLeaveRequests.filter(
    (item) => item.status === "pending"
  ).length;

  const pendingAttendanceCount = safeAttendanceAdjustments.filter(
    (item) => item.status === "pending"
  ).length;

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
      setError("");
      setMessage("");

      await apiFetch("/requests-center/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: form.employeeId || null,
          employeeGasId: form.employeeGasId || null,
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
      setForm(initialForm);
      await loadPage();
    } catch (err) {
      console.error("Submit request error:", err);
      setError(err?.message || "Failed to submit request");
    }
  }

  const canReview = ["System Owner", "Project Manager", "CM", "HR Manager", "HR"].includes(
    user?.role
  );

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
            <label>
              Employee
              <select name="employeeId" value={form.employeeId} onChange={handleChange}>
                <option value="">اختر الموظف</option>
                {safeEmployees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name || employee.full_name || "Employee"} —{" "}
                    {employee.gasId || employee.gas_id || ""}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Or GAS ID
              <input
                name="employeeGasId"
                value={form.employeeGasId}
                onChange={handleChange}
                placeholder="مثال: 2036"
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

            <label className="span-2">
              Note
              <input
                name="note"
                value={form.note}
                onChange={handleChange}
                placeholder="سبب الطلب أو أي ملاحظة"
              />
            </label>

            <div className="span-2">
              <p className="muted small">
                ملاحظة: رفع المرفقات ظاهر في الواجهة لكن حفظ الملفات غير مربوط بعد في الباكند الحالي.
              </p>
            </div>

            <div className="span-2 modal-actions">
              <button type="submit">Submit Request</button>
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
                  <td>
                    {item.startDate || "-"}
                    {item.endDate && item.endDate !== item.startDate ? ` → ${item.endDate}` : ""}
                  </td>
                  <td>
                    <span className={`soft-badge ${badgeClass(item.status)}`}>
                      {item.status || "-"}
                    </span>
                  </td>
                  <td>
                    <span className="muted small">Not connected</span>
                  </td>
                  <td>{item.requestedByName || "-"}</td>
                  <td>
                    {canReview ? (
                      <span className="muted small">Review route not connected yet</span>
                    ) : (
                      <span className="muted small">No action</span>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="7">No requests yet.</td>
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
                  <td>{item.date || "-"}</td>
                  <td>{item.currentValue || "-"}</td>
                  <td>{item.newStatus || "-"}</td>
                  <td>{item.reason || "-"}</td>
                  <td>
                    <span className={`soft-badge ${badgeClass(item.status)}`}>
                      {item.status || "-"}
                    </span>
                  </td>
                  <td>{item.requestedByName || "-"}</td>
                  <td>
                    <span className="muted small">Review route not connected yet</span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="8">No attendance adjustment requests yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
