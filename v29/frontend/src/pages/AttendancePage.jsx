import { useEffect, useMemo, useState } from 'react';
import { apiFetch, downloadFile } from '../services/api';
import AttendanceCell from '../components/AttendanceCell';

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

function buildMatrix(rows, month, year) {
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

  const daysInMonth = new Date(Number(year), Number(month), 0).getDate();

  return {
    daysInMonth,
    employees: Array.from(byEmployee.values())
  };
}

export default function AttendancePage() {
  const [rows, setRows] = useState([]);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [unmatchedRows, setUnmatchedRows] = useState([]);
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

      setMessage(
        `Imported successfully. Processed: ${result.processedCount || 0}, Unmatched: ${result.unmatchedCount || 0}`
      );
      setUnmatchedRows(result.unmatchedRows || []);
      setFile(null);

      await loadAttendance();
    } catch (err) {
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

  const matrix = useMemo(() => buildMatrix(rows, month, year), [rows, month, year]);

  return (
    <div className="space-y-6 p-4">
      <div className="rounded-xl border bg-white p-4 shadow-sm dark:bg-gray-900 dark:text-white">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Attendance Sheet</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Regular Hours = number, empty = A, single punch = SP
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleExportAttendance}
              className="rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700"
            >
              Export Excel
            </button>
          </div>
        </div>

        <div className="mb-4 grid gap-3 md:grid-cols-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Month</label>
            <input
              type="number"
              min="1"
              max="12"
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="w-full rounded-lg border px-3 py-2 dark:bg-gray-800"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Year</label>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-full rounded-lg border px-3 py-2 dark:bg-gray-800"
            />
          </div>

          <form onSubmit={handleUpload} className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium">Fingerprint File</label>
            <div className="flex gap-2">
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="w-full rounded-lg border px-3 py-2 dark:bg-gray-800"
              />
              <button
                type="submit"
                className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
              >
                Upload
              </button>
            </div>
          </form>
        </div>

        {message && (
          <div className="mb-4 rounded-lg border bg-blue-50 px-4 py-3 text-sm text-blue-700 dark:bg-blue-900/30 dark:text-blue-200">
            {message}
          </div>
        )}

        {unmatchedRows.length > 0 && (
          <div className="mb-6 rounded-xl border border-orange-200 bg-orange-50 p-4 dark:bg-orange-900/20">
            <h2 className="mb-3 text-lg font-semibold text-orange-700 dark:text-orange-300">
              Unmatched Fingerprint Records
            </h2>

            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left">
                    <th className="px-2 py-2">Employee Name</th>
                    <th className="px-2 py-2">GAS ID</th>
                    <th className="px-2 py-2">Date</th>
                    <th className="px-2 py-2">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {unmatchedRows.map((item, idx) => (
                    <tr key={`${item.gas_id}-${item.work_date}-${idx}`} className="border-t">
                      <td className="px-2 py-2">{item.employee_name || '-'}</td>
                      <td className="px-2 py-2">{item.gas_id}</td>
                      <td className="px-2 py-2">{item.work_date}</td>
                      <td className="px-2 py-2">{item.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {loading ? (
          <div className="py-8 text-center text-gray-500">Loading attendance...</div>
        ) : (
          <div className="overflow-auto">
            <table className="min-w-full border-separate border-spacing-1 text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-white px-3 py-2 text-left dark:bg-gray-900">
                    Name
                  </th>
                  <th className="bg-white px-3 py-2 text-left dark:bg-gray-900">GAS ID</th>
                  <th className="bg-white px-3 py-2 text-left dark:bg-gray-900">Nationality</th>
                  {Array.from({ length: matrix.daysInMonth }).map((_, idx) => (
                    <th
                      key={idx + 1}
                      className="bg-white px-2 py-2 text-center dark:bg-gray-900"
                    >
                      {idx + 1}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {matrix.employees.map((employee) => (
                  <tr key={employee.gasId}>
                    <td className="sticky left-0 z-10 bg-white px-3 py-2 font-medium dark:bg-gray-900">
                      {employee.employeeName}
                    </td>
                    <td className="bg-white px-3 py-2 dark:bg-gray-900">{employee.gasId}</td>
                    <td className="bg-white px-3 py-2 dark:bg-gray-900">{employee.nationality}</td>

                    {Array.from({ length: matrix.daysInMonth }).map((_, idx) => {
                      const day = idx + 1;
                      const value = employee.days[day] || 'A';

                      return (
                        <td key={`${employee.gasId}-${day}`} className="px-1 py-1">
                          <AttendanceCell
                            value={value}
                            onClick={() => openEditModal(employee, day, value)}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl dark:bg-gray-900 dark:text-white">
            <h2 className="mb-4 text-xl font-bold">Edit Attendance</h2>

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