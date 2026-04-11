import { useEffect, useMemo, useState } from 'react';
import { apiFetch, API_BASE } from '../services/api';
import AttendanceCell from '../components/AttendanceCell';
import { useAuth } from '../context/AuthContext';

const ATTENDANCE_OPTIONS = [
  { value: "AL", label: "Annual Leave" },
  { value: "SL", label: "Sick Leave" },
  { value: "EL", label: "Emergency Leave" },
  { value: "UL", label: "Unpaid Leave" },
  { value: "HL", label: "Hajj Leave" },
  { value: "UM", label: "Umrah Leave" },
  { value: "H", label: "Official Holiday" },
  { value: "NH", label: "National Holiday" },
  { value: "W", label: "Weekend" },
  { value: "BT", label: "Business Trip" },
  { value: "TA", label: "Task Assignment" },
  { value: "SP", label: "Single Punch" },
  { value: "A", label: "Absent" }
];

function getAttendanceCellClass(value) {
  if (value === "A") return "bg-red-100 text-red-700";
  if (value === "SP") return "bg-orange-100 text-orange-700";
  if (["AL", "SL", "EL", "UL", "HL", "UM"].includes(value)) return "bg-blue-100 text-blue-700";
  if (["H", "NH", "W"].includes(value)) return "bg-gray-200 text-gray-700";
  if (!Number.isNaN(Number(value))) return "bg-green-50 text-green-700";
  return "";
}




const initialForm = {
  employeeId: '',
  employeeName: '',
  day: '',
  currentValue: '',
  newStatus: 'Present',
  hours: '',
  reason: '',
  attachmentName: ''
};

export default function AttendancePage() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [statusTypes, setStatusTypes] = useState([]);
  const [month, setMonth] = useState(4);
  const [year, setYear] = useState(2026);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(initialForm);

  const days = useMemo(() => new Date(year, month, 0).getDate(), [month, year]);
  const canDirectEdit = user?.role === 'System Owner' || user?.role === 'HR Manager';
  const isRequestFlow = user?.role === 'Engineer';

  async function loadData() {
    const [monthlyResponse, statusResponse] = await Promise.all([
      apiFetch(`/attendance/monthly?month=${month}&year=${year}`),
      apiFetch('/attendance/status-types')
    ]);
    setRows(monthlyResponse.rows);
    setStatusTypes(statusResponse.statusTypes);
  }

  useEffect(() => {
    loadData().catch((err) => setError(err.message));
  }, [month, year]);

  async function handleUpload(event) {
    event.preventDefault();
    if (!file) return;
    setLoading(true);
    setMessage('');
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('uploadedBy', user?.name || 'System Owner');
      const response = await apiFetch('/attendance/upload', { method: 'POST', body: formData });
      setMessage(`تم الاستيراد بنجاح. Imported: ${response.importedCount} | Unmatched: ${response.unmatchedCount}`);
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function exportExcel() {
    window.open(`${API_BASE}/attendance/export?month=${month}&year=${year}`, '_blank');
  }

  function openEditor(row, day) {
    const cell = row[String(day)];
    setForm({
      employeeId: row.employeeId,
      employeeName: row.name,
      day,
      currentValue: String(cell?.value ?? ''),
      newStatus: typeof cell?.value === 'number' ? 'Present' : String(cell?.value ?? 'Present'),
      hours: typeof cell?.value === 'number' ? String(cell.value) : '',
      reason: '',
      attachmentName: ''
    });
    setModalOpen(true);
  }

  async function submitEdit(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    const date = new Date(Date.UTC(year, month - 1, Number(form.day))).toISOString().slice(0, 10);

    try {
      if (canDirectEdit) {
        await apiFetch('/attendance/direct-update', {
          method: 'POST',
          body: JSON.stringify({
            employeeId: Number(form.employeeId),
            date,
            newStatus: form.newStatus,
            hours: form.hours,
            actorName: user?.name,
            note: form.reason
          })
        });
        setMessage('تم تعديل الحضور مباشرة');
      } else if (isRequestFlow) {
        const selectedStatus = statusTypes.find((item) => item.code === form.newStatus);
        if (selectedStatus?.requiresAttachment && !form.attachmentName) {
          throw new Error('هذا النوع يتطلب مرفقًا إجباريًا');
        }
        await apiFetch('/attendance/adjustments/request', {
          method: 'POST',
          body: JSON.stringify({
            employeeId: Number(form.employeeId),
            employeeName: form.employeeName,
            date,
            currentValue: form.currentValue,
            newStatus: form.newStatus,
            hours: form.hours,
            reason: form.reason,
            attachmentName: form.attachmentName,
            requestedById: user?.id,
            requestedByName: user?.name,
            approverUserId: null
          })
        });
        setMessage('تم إرسال طلب تعديل الحضور للموافقة');
      } else {
        throw new Error('هذا الحساب لا يملك صلاحية تعديل الحضور');
      }

      setModalOpen(false);
      setForm(initialForm);
      await loadData();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="page">
      <header className="card page-header">
        <div>
          <h1>Attendance</h1>
          <p>رفع ملف البصمة، معاينة الحضور الشهري، تعديل الخلية، وتصدير Excel.</p>
        </div>
        <div className="controls compact-controls">
          <input type="number" value={month} min="1" max="12" onChange={(e) => setMonth(Number(e.target.value))} />
          <input type="number" value={year} min="2024" max="2035" onChange={(e) => setYear(Number(e.target.value))} />
          <button onClick={exportExcel}>Export Excel</button>
        </div>
      </header>

      <section className="card">
        <form onSubmit={handleUpload} className="upload-row">
          <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          <button type="submit" disabled={loading}>{loading ? 'Uploading...' : 'Upload Attendance File'}</button>
        </form>
        {message ? <div className="alert success">{message}</div> : null}
        {error ? <div className="alert error">{error}</div> : null}
        <p className="muted small">التعديل المباشر لـ HR Manager و System Owner. أما Engineer فيرفع طلب تعديل للموافقة.</p>
      </section>

      <section className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>GAS ID</th>
              <th>Nationality</th>
              {Array.from({ length: days }, (_, i) => <th key={i + 1}>{i + 1}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.employeeId}>
                <td>{row.name}</td>
                <td>{row.gasId}</td>
                <td>{row.nationality}</td>
                {Array.from({ length: days }, (_, i) => (
                  <AttendanceCell key={i + 1} cell={row[String(i + 1)]} onClick={() => openEditor(row, i + 1)} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {modalOpen ? (
        <div className="modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>Edit Attendance Day</h3>
            <p className="muted small">{form.employeeName} — Day {form.day} — Current: {form.currentValue}</p>
            <form className="form-grid" onSubmit={submitEdit}>
              <label>
                New Status
                <select value={form.newStatus} onChange={(e) => setForm({ ...form, newStatus: e.target.value })}>
                  {statusTypes.map((status) => <option key={status.code} value={status.code}>{status.name}</option>)}
                </select>
              </label>
              <label>
                Hours
                <input value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} placeholder="مثال 8 أو 10.5" />
              </label>
              <label className="span-2">
                Reason
                <input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="سبب التعديل" />
              </label>
              <label className="span-2">
                Attachment name (required for some statuses)
                <input value={form.attachmentName} onChange={(e) => setForm({ ...form, attachmentName: e.target.value })} placeholder="medical.pdf" />
              </label>
              <div className="span-2 modal-actions">
                <button type="button" className="ghost" onClick={() => setModalOpen(false)}>Cancel</button>
                <button type="submit">{canDirectEdit ? 'Save Directly' : 'Send Request'}</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
