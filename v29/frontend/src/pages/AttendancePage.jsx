import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { apiFetch, downloadFile } from '../services/api';
import AttendanceCell from '../components/AttendanceCell';
import { useAuth } from '../context/AuthContext';

const ATTENDANCE_OPTIONS = [
  { value: 'V', label: 'Annual Leave' },
  { value: 'SL', label: 'Sick Leave' },
  { value: 'EL', label: 'Emergency Leave' },
  { value: 'UL', label: 'Unpaid Leave' },
  { value: 'HL', label: 'Hajj Leave' },
  { value: 'UM', label: 'Umrah Leave' },
  { value: 'H', label: 'Official Holiday' },
  { value: 'NH', label: 'National Holiday' },
  { value: 'W', label: 'Weekend' },
  { value: 'BT', label: 'Business Trip' },
  { value: 'TA', label: 'Task Assignment' },
  { value: 'SP', label: 'Single Punch' },
  { value: 'A', label: 'Absent' }
];

const initialForm = {
  employeeId: '',
  employeeName: '',
  day: '',
  currentValue: '',
  newStatus: 'A',
  reason: ''
};

function buildMatrix(rows, month, year, searchTerm) {
  const byEmployee = new Map();
  const safeRows = Array.isArray(rows) ? rows : [];

  safeRows.forEach((row) => {
    const key = row.gas_id;

    if (!byEmployee.has(key)) {
      byEmployee.set(key, {
        employeeId: row.employee_id,
        employeeName: row.full_name,
        gasId: row.gas_id,
        nationality: row.nationality,
        projectName: row.project_name,
        packageName: row.package_name,
        days: {}
      });
    }

    const day = new Date(row.work_date).getDate();
    byEmployee.get(key).days[day] = row.status;
  });

  let employees = Array.from(byEmployee.values());

  if (searchTerm.trim()) {
    const q = searchTerm.toLowerCase();
    employees = employees.filter((emp) =>
      emp.employeeName?.toLowerCase().includes(q) ||
      emp.gasId?.toLowerCase().includes(q)
    );
  }

  const daysInMonth = new Date(Number(year), Number(month), 0).getDate();

  return {
    daysInMonth,
    employees
  };
}

export default function AttendancePage() {
  const { user } = useAuth();

  const isAdmin =
    user?.role === 'System Owner' ||
    user?.role === 'HR Manager' ||
    user?.role === 'HR' ||
    user?.role === 'Engineer' ||
    user?.role === 'Project Manager' ||
    user?.role === 'CM' ||
    user?.permissions?.includes('view_attendance');

  if (!isAdmin) {
    return <Navigate to="/employee/attendance" replace />;
  }

  const [rows, setRows] = useState([]);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [importInfo, setImportInfo] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [form, setForm] = useState(initialForm);
  const [showModal, setShowModal] = useState(false);

  async function loadAttendance() {
    setLoading(true);
    setMessage('');
    try {
      const data = await apiFetch(`/attendance/monthly?month=${month}&year=${year}`);
      if (Array.isArray(data)) {
        setRows(data);
      } else if (Array.isArray(data.rows)) {
        setRows(data.rows);
      } else {
        setRows([]);
      }
    } catch (err) {
      setMessage(err.message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAttendance();
  }, [month, year]);

  async function handleUpload(e) {
    e.preventDefault();

    if (!file) {
      setMessage('Please choose a fingerprint file first.');
      return;
    }

    try {
      setLoading(true);
      setMessage('');

      const formData = new FormData();
      formData.append('file', file);

      const result = await apiFetch('/attendance/upload', {
        method: 'POST',
        body: formData
      });

      setImportInfo(result);
      setMessage(`Imported successfully. Processed: ${result.processedCount || 0}`);
      setFile(null);

      await loadAttendance();
    } catch (err) {
      setImportInfo(null);
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleExportAttendance() {
    try {
      await downloadFile(
        `/attendance/export?month=${month}&year=${year}`,
        `attendance-sheet-${month}-${year}.xlsx`
      );
    } catch (err) {
      setMessage(err.message);
    }
  }

  function openEditModal(employee, day, value) {
    const workDate = new Date(Number(year), Number(month) - 1, day)
      .toISOString()
      .slice(0, 10);

    setForm({
      employeeId: employee.employeeId,
      employeeName: employee.employeeName,
      day: workDate,
      currentValue: value || 'A',
      newStatus: value || 'A',
      reason: ''
    });

    setShowModal(true);
  }

  async function handleManualAttendanceSave() {
    try {
      const value = form.newStatus;

      await apiFetch('/attendance/adjust', {
        method: 'POST',
        body: JSON.stringify({
          employeeId: form.employeeId,
          workDate: form.day,
          status: value,
          hours: !Number.isNaN(Number(value)) ? Number(value) : 0,
          note: form.reason || ''
        })
      });

      setMessage('Attendance updated successfully.');
      setShowModal(false);
      setForm(initialForm);
      await loadAttendance();
    } catch (err) {
      setMessage(err.message);
    }
  }

  const matrix = useMemo(
    () => buildMatrix(rows, month, year, searchTerm),
    [rows, month, year, searchTerm]
  );

  return (
    <div className="space-y-6 p-6">
      <div className="rounded-3xl border bg-white p-6 shadow-sm dark:bg-gray-900 dark:text-white">
        <h1 className="text-4xl font-bold tracking-tight">Attendance</h1>
        <p className="mt-3 max-w-4xl text-lg text-slate-500 dark:text-slate-400">
          Upload biometric CSV and generate a monthly Oracle-style attendance sheet with totals,
          absence and single punch highlighting.
        </p>
      </div>

      <div className="rounded-3xl border bg-white p-6 shadow-sm dark:bg-gray-900 dark:text-white">
        <h2 className="text-3xl font-bold">Biometric Import</h2>
        <p className="mt-2 text-lg text-slate-500 dark:text-slate-400">
          Upload the raw CSV exported from your attendance device.
        </p>

        <div className="mt-6">
          <label className="mb-2 block text-lg font-semibold">Filter Employee</label>
          <input
            type="text"
            placeholder="Search employee name"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-2xl border px-5 py-4 text-xl dark:bg-gray-800"
          />
        </div>

        <form onSubmit={handleUpload} className="mt-8">
          <div className="flex flex-wrap items-center gap-4">
            <label className="inline-flex cursor-pointer items-center rounded-2xl border px-5 py-4 text-2xl font-semibold">
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="hidden"
              />
              Upload CSV
            </label>

            <span className="text-xl text-slate-500">{file?.name || 'No file selected'}</span>
          </div>

          <div className="mt-5">
            <button
              type="submit"
              className="rounded-2xl bg-blue-600 px-6 py-4 text-xl font-semibold text-white hover:bg-blue-700"
            >
              Upload
            </button>
          </div>
        </form>

        {message && (
          <div className="mt-5 rounded-2xl border bg-blue-50 px-5 py-4 text-lg text-blue-700 dark:bg-blue-900/30 dark:text-blue-200">
            {message}
          </div>
        )}

        {importInfo?.autoCreatedEmployees?.length > 0 && (
          <div className="mt-5 rounded-2xl border bg-orange-50 px-5 py-4 text-base text-orange-800 dark:bg-orange-900/20 dark:text-orange-200">
            Auto-created employees from uploaded file:
            <div className="mt-2">
              {importInfo.autoCreatedEmployees.slice(0, 10).map((emp, idx) => (
                <div key={`${emp.gas_id}-${idx}`}>
                  {emp.employee_name} — {emp.gas_id}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="rounded-3xl border bg-white p-6 shadow-sm dark:bg-gray-900 dark:text-white">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold">
              {new Date(Number(year), Number(month) - 1).toLocaleString('en', { month: 'long' })} Attendance
            </h2>
            <p className="mt-2 text-lg text-slate-500 dark:text-slate-400">
              Generated monthly attendance sheet ready for HR review and Excel download.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Month</label>
              <input
                type="number"
                min="1"
                max="12"
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="w-28 rounded-xl border px-3 py-2 dark:bg-gray-800"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Year</label>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="w-32 rounded-xl border px-3 py-2 dark:bg-gray-800"
              />
            </div>

            <button
              onClick={handleExportAttendance}
              className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700"
            >
              Export Excel
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-10 text-center text-gray-500">Loading attendance...</div>
        ) : (
          <div className="overflow-auto rounded-2xl border">
            <table className="min-w-full border-collapse text-sm">
              <thead className="bg-gray-100 dark:bg-gray-800">
                <tr>
                  <th className="sticky left-0 z-20 min-w-[280px] border bg-gray-100 px-4 py-4 text-left text-xl font-bold dark:bg-gray-800">
                    Employee
                  </th>
                  {Array.from({ length: matrix.daysInMonth }).map((_, idx) => {
                    const day = idx + 1;
                    const date = new Date(Number(year), Number(month) - 1, day);
                    const label = `${day}-${date.toLocaleString('en', { month: 'short' })}`;
                    const weekend = date.getDay() === 5 || date.getDay() === 6;

                    return (
                      <th
                        key={day}
                        className={`border px-4 py-4 text-center text-xl font-bold ${
                          weekend ? 'bg-blue-200 text-slate-900' : ''
                        }`}
                      >
                        {label}
                      </th>
                    );
                  })}
                </tr>
              </thead>

              <tbody>
                {matrix.employees.length === 0 ? (
                  <tr>
                    <td colSpan={1 + matrix.daysInMonth} className="px-4 py-8 text-center text-gray-500">
                      No attendance records found for this month.
                    </td>
                  </tr>
                ) : (
                  matrix.employees.map((employee) => (
                    <tr key={employee.gasId}>
                      <td className="sticky left-0 z-10 border bg-white px-4 py-4 text-xl font-bold leading-8 dark:bg-gray-900">
                        <div>{employee.employeeName}</div>
                      </td>

                      {Array.from({ length: matrix.daysInMonth }).map((_, idx) => {
                        const day = idx + 1;
                        const value = employee.days[day] || 'A';

                        return (
                          <td key={`${employee.gasId}-${day}`} className="border p-0 text-center">
                            <AttendanceCell
                              value={value}
                              onClick={() => openEditModal(employee, day, value)}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl dark:bg-gray-900 dark:text-white">
            <h2 className="mb-4 text-2xl font-bold">Edit Attendance</h2>

            <div className="mb-3 grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">Employee</label>
                <input
                  value={form.employeeName}
                  readOnly
                  className="w-full rounded-lg border px-3 py-2 dark:bg-gray-800"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Date</label>
                <input
                  value={form.day}
                  readOnly
                  className="w-full rounded-lg border px-3 py-2 dark:bg-gray-800"
                />
              </div>
            </div>

            <div className="mb-3">
              <label className="mb-1 block text-sm font-medium">Current Value</label>
              <input
                value={form.currentValue}
                readOnly
                className="w-full rounded-lg border px-3 py-2 dark:bg-gray-800"
              />
            </div>

            <div className="mb-3">
              <label className="mb-1 block text-sm font-medium">Select Status</label>
              <select
                value={ATTENDANCE_OPTIONS.some((x) => x.value === form.newStatus) ? form.newStatus : ''}
                onChange={(e) => setForm({ ...form, newStatus: e.target.value })}
                className="w-full rounded-lg border px-3 py-2 dark:bg-gray-800"
              >
                <option value="">Select option</option>
                {ATTENDANCE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label} ({opt.value})
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-3">
              <label className="mb-1 block text-sm font-medium">Or Enter Hours Manually</label>
              <input
                type="text"
                placeholder="Example: 8 or 5.5"
                value={form.newStatus}
                onChange={(e) => setForm({ ...form, newStatus: e.target.value })}
                className="w-full rounded-lg border px-3 py-2 dark:bg-gray-800"
              />
            </div>

            <div className="mb-4">
              <label className="mb-1 block text-sm font-medium">Reason / Note</label>
              <textarea
                rows="3"
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                className="w-full rounded-lg border px-3 py-2 dark:bg-gray-800"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowModal(false);
                  setForm(initialForm);
                }}
                className="rounded-lg border px-4 py-2"
              >
                Cancel
              </button>
              <button
                onClick={handleManualAttendanceSave}
                className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
