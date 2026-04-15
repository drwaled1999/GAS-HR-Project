import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../services/api';
import { useAuth } from '../context/AuthContext';

const initialForm = {
  employeeId: '',
  employeeGasId: '',
  type: 'annual_leave',
  startDate: '',
  endDate: '',
  note: '',
  attachment: null,
  currentBank: '',
  newBank: '',
  newIban: ''
};

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function buildFileUrl(path) {
  if (!path) return '#';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;

  const base =
    import.meta.env.VITE_API_BASE_URL || 'https://gas-hr-project-1.onrender.com';

  return `${base}${path}`;
}

function badgeClass(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'approved') return 'success';
  if (s === 'rejected') return 'danger';
  return 'warning';
}

export default function RequestsPage() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [types, setTypes] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [attendanceAdjustments, setAttendanceAdjustments] = useState([]);
  const [balances, setBalances] = useState({
    annual: 30,
    sick: 15,
    emergency: 5
  });

  const [form, setForm] = useState(initialForm);

  const safeTypes = asArray(types);
  const safeEmployees = asArray(employees);
  const safeLeaveRequests = asArray(leaveRequests);
  const safeAttendanceAdjustments = asArray(attendanceAdjustments);

  const selectedType = useMemo(() => {
    return safeTypes.find((item) => item.code === form.type) || null;
  }, [safeTypes, form.type]);

  const pendingLeaveCount = safeLeaveRequests.filter((item) => item.status === 'pending').length;
  const pendingAttendanceCount = safeAttendanceAdjustments.filter(
    (item) => item.status === 'pending'
  ).length;

  async function loadPage() {
    if (!user?.username) return;

    try {
      setLoading(true);
      setError('');

      const [typesRes, listRes, balancesRes] = await Promise.all([
        apiFetch('/requests-center/types'),
        apiFetch(`/requests-center/list?username=${encodeURIComponent(user.username)}`),
        apiFetch(`/requests-center/balances?username=${encodeURIComponent(user.username)}`)
      ]);

      const nextTypes = Array.isArray(typesRes?.types)
        ? typesRes.types
        : Array.isArray(typesRes)
          ? typesRes
          : [];

      const nextEmployees = Array.isArray(listRes?.employees)
        ? listRes.employees
        : Array.isArray(listRes)
          ? listRes
          : [];

      const nextLeaveRequests = Array.isArray(listRes?.leaveRequests)
        ? listRes.leaveRequests
        : [];

      const nextAttendanceAdjustments = Array.isArray(listRes?.attendanceAdjustments)
        ? listRes.attendanceAdjustments
        : [];

      setTypes(nextTypes);
      setEmployees(nextEmployees);
      setLeaveRequests(nextLeaveRequests);
      setAttendanceAdjustments(nextAttendanceAdjustments);
      setBalances({
        annual: Number(balancesRes?.balances?.annual ?? 30),
        sick: Number(balancesRes?.balances?.sick ?? 15),
        emergency: Number(balancesRes?.balances?.emergency ?? 5)
      });
    } catch (err) {
      console.error('Requests page load error:', err);
      setError(err?.message || 'Failed to load requests page');
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
      [name]: files ? files[0] : value
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    try {
      setError('');
      setMessage('');

      const body = new FormData();
      body.append('username', user.username);
      body.append('type', form.type);
      body.append('note', form.note || '');

      if (form.employeeId) body.append('employeeId', form.employeeId);
      if (form.employeeGasId) body.append('employeeGasId', form.employeeGasId);
      if (form.startDate) body.append('startDate', form.startDate);
      if (form.endDate) body.append('endDate', form.endDate);
      if (form.currentBank) body.append('currentBank', form.currentBank);
      if (form.newBank) body.append('newBank', form.newBank);
      if (form.newIban) body.append('newIban', form.newIban);
      if (form.attachment) body.append('attachment', form.attachment);

      await apiFetch('/requests-center/leave', {
        method: 'POST',
        body
      });

      setMessage('تم إرسال الطلب بنجاح');
      setForm(initialForm);
      await loadPage();
    } catch (err) {
      console.error('Submit request error:', err);
      setError(err?.message || 'Failed to submit request');
    }
  }

  async function reviewLeave(id, decision) {
    try {
      setError('');
      setMessage('');

      await apiFetch(`/requests-center/leave/${id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: user.username,
          decision,
          rejectionReason: decision === 'rejected' ? 'Rejected by reviewer' : ''
        })
      });

      setMessage(decision === 'approved' ? 'تمت الموافقة على الطلب' : 'تم رفض الطلب');
      await loadPage();
    } catch (err) {
      console.error('Review leave error:', err);
      setError(err?.message || 'Failed to review leave request');
    }
  }

  async function reviewAttendance(id, decision) {
    try {
      setError('');
      setMessage('');

      await apiFetch(`/attendance/adjustments/${id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision,
          reviewerId: user?.id,
          reviewerName: user?.name,
          rejectionReason: decision === 'rejected' ? 'Rejected by reviewer' : ''
        })
      });

      setMessage(
        decision === 'approved'
          ? 'تمت الموافقة على طلب تعديل الحضور'
          : 'تم رفض طلب تعديل الحضور'
      );
      await loadPage();
    } catch (err) {
      console.error('Review attendance error:', err);
      setError(err?.message || 'Failed to review attendance request');
    }
  }

  const canReview = ['System Owner', 'Project Manager', 'CM', 'HR Manager', 'HR'].includes(
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
                    {employee.name || employee.full_name || 'Employee'} — {employee.gasId || employee.gas_id || ''}
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
            {safeLeaveRequests.map((item) => (
              <tr key={`leave-${item.id}`}>
                <td>{item.employeeName || '-'}</td>
                <td>{item.type || '-'}</td>
                <td>
                  {item.startDate || '-'}
                  {item.endDate && item.endDate !== item.startDate ? ` → ${item.endDate}` : ''}
                </td>
                <td>
                  <span className={`soft-badge ${badgeClass(item.status)}`}>{item.status || '-'}</span>
                </td>
                <td>
                  {item.attachmentPath ? (
                    <a href={buildFileUrl(`/files/request/${item.id}`)} target="_blank" rel="noreferrer">
                      {item.attachmentName || 'Preview'}
                    </a>
                  ) : (
                    <span className="muted small">No attachment</span>
                  )}
                </td>
                <td>{item.requestedByName || '-'}</td>
                <td>
                  {canReview && item.status === 'pending' ? (
                    <div className="inline-actions wrap-actions">
                      <button type="button" onClick={() => reviewLeave(item.id, 'approved')}>
                        Approve
                      </button>
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => reviewLeave(item.id, 'rejected')}
                      >
                        Reject
                      </button>
                    </div>
                  ) : (
                    <span className="muted small">No action</span>
                  )}
                </td>
              </tr>
            ))}
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
            {safeAttendanceAdjustments.map((item) => (
              <tr key={`att-${item.id}`}>
                <td>{item.employeeName || item.employeeId || '-'}</td>
                <td>{item.date || '-'}</td>
                <td>{item.currentValue || '-'}</td>
                <td>{item.newStatus || '-'}</td>
                <td>{item.reason || '-'}</td>
                <td>
                  <span className={`soft-badge ${badgeClass(item.status)}`}>{item.status || '-'}</span>
                </td>
                <td>{item.requestedByName || '-'}</td>
                <td>
                  {canReview && item.status === 'pending' ? (
                    <div className="inline-actions wrap-actions">
                      <button type="button" onClick={() => reviewAttendance(item.id, 'approved')}>
                        Approve
                      </button>
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => reviewAttendance(item.id, 'rejected')}
                      >
                        Reject
                      </button>
                    </div>
                  ) : (
                    <span className="muted small">No action</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
