import { useEffect, useMemo, useState } from 'react';
import { API_BASE, apiFetch } from '../services/api';
import { useAuth } from '../context/AuthContext';

function ReportCard({ label, value, hint }) {
  return (
    <article className="stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{hint}</small>
    </article>
  );
}

function SimpleTable({ columns, rows, emptyText = 'لا توجد بيانات.' }) {
  return (
    <div className="table-wrap compact-table">
      <table>
        <thead>
          <tr>
            {columns.map((column) => <th key={column.key}>{column.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.length ? rows.map((row, index) => (
            <tr key={row.id || row.employeeId || `${index}-${row.date || ''}`}>
              {columns.map((column) => <td key={column.key}>{String(row[column.key] ?? '-')}</td>)}
            </tr>
          )) : (
            <tr>
              <td colSpan={columns.length} className="muted center-cell">{emptyText}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function ReportsPage() {
  const { user } = useAuth();
  const [month, setMonth] = useState(4);
  const [year, setYear] = useState(2026);
  const [date, setDate] = useState('2026-04-10');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  async function loadReports() {
    if (!user?.username) return;
    try {
      const response = await apiFetch(`/reports/summary?username=${user.username}&month=${month}&year=${year}&date=${date}`);
      setData(response);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    loadReports();
  }, [user?.username, month, year, date]);

  function exportReport(type) {
    window.open(`${API_BASE}/reports/export?username=${user.username}&type=${type}&month=${month}&year=${year}&date=${date}`, '_blank');
  }

  const cards = useMemo(() => {
    if (!data?.summary) return [];
    return [
      { label: 'Visible Employees', value: data.summary.visibleEmployees, hint: 'الموظفون داخل نطاقك' },
      { label: 'Monthly Hours', value: data.summary.monthlyHours, hint: 'إجمالي ساعات الشهر' },
      { label: 'Absent Days', value: data.summary.absentDays, hint: 'إجمالي الغياب' },
      { label: 'Single Punch', value: data.summary.singlePunchCount, hint: 'السجلات الناقصة' },
      { label: 'Leave Days', value: data.summary.leaveDays, hint: 'أيام الإجازات والحالات' },
      { label: 'Pending Requests', value: data.summary.pendingRequests, hint: 'الطلبات المعلقة' }
    ];
  }, [data]);

  return (
    <div className="page dashboard-page">
      <div className="page-header">
        <div>
          <h1>Reports</h1>
          <p>تقارير يومية وشهرية وملخصات الغياب وطلبات تعديل الحضور مع تصدير Excel.</p>
        </div>
        <div className="controls compact-controls">
          <input type="number" value={month} min="1" max="12" onChange={(e) => setMonth(Number(e.target.value))} />
          <input type="number" value={year} min="2024" max="2035" onChange={(e) => setYear(Number(e.target.value))} />
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>

      {error ? <div className="alert error">{error}</div> : null}

      <section className="stat-grid">
        {cards.map((item) => <ReportCard key={item.label} {...item} />)}
      </section>

      <section className="card">
        <div className="page-header compact">
          <div>
            <h2>Quick Export</h2>
            <p>تصدير سريع حسب نوع التقرير.</p>
          </div>
          <div className="inline-actions wrap-actions">
            <button onClick={() => exportReport('monthly')}>Export Monthly</button>
            <button onClick={() => exportReport('daily')}>Export Daily</button>
            <button onClick={() => exportReport('issues')}>Export Issues</button>
            <button onClick={() => exportReport('requests')}>Export Requests</button>
          </div>
        </div>
      </section>

      <section className="grid-two dashboard-main">
        <section className="card dashboard-section">
          <div className="page-header compact">
            <div>
              <h2>Monthly Summary</h2>
              <p>ملخص شهري لكل موظف داخل نطاقك.</p>
            </div>
          </div>
          <SimpleTable
            columns={[
              { key: 'name', label: 'Name' },
              { key: 'gasId', label: 'GAS ID' },
              { key: 'project', label: 'Project' },
              { key: 'package', label: 'Package' },
              { key: 'totalHours', label: 'Hours' },
              { key: 'absentCount', label: 'Absent' },
              { key: 'singlePunchCount', label: 'Single Punch' }
            ]}
            rows={data?.monthlyRows || []}
          />
        </section>

        <section className="card dashboard-section">
          <div className="page-header compact">
            <div>
              <h2>Daily Report</h2>
              <p>حالة كل موظف في اليوم المحدد.</p>
            </div>
          </div>
          <SimpleTable
            columns={[
              { key: 'name', label: 'Name' },
              { key: 'gasId', label: 'GAS ID' },
              { key: 'status', label: 'Status' },
              { key: 'hours', label: 'Hours' },
              { key: 'source', label: 'Source' }
            ]}
            rows={data?.dailyRows || []}
          />
        </section>
      </section>

      <section className="grid-two dashboard-main">
        <section className="card dashboard-section">
          <div className="page-header compact">
            <div>
              <h2>Attendance Issues</h2>
              <p>Absent و Single Punch لنفس الشهر.</p>
            </div>
          </div>
          <SimpleTable
            columns={[
              { key: 'name', label: 'Name' },
              { key: 'date', label: 'Date' },
              { key: 'status', label: 'Status' },
              { key: 'project', label: 'Project' },
              { key: 'package', label: 'Package' }
            ]}
            rows={data?.issuesRows || []}
          />
        </section>

        <section className="card dashboard-section">
          <div className="page-header compact">
            <div>
              <h2>Adjustment Requests</h2>
              <p>طلبات تعديل الحضور ضمن نطاقك.</p>
            </div>
          </div>
          <SimpleTable
            columns={[
              { key: 'employeeName', label: 'Employee' },
              { key: 'date', label: 'Date' },
              { key: 'currentValue', label: 'Current' },
              { key: 'requestedValue', label: 'Requested' },
              { key: 'status', label: 'Status' }
            ]}
            rows={data?.requestsRows || []}
          />
        </section>
      </section>
    </div>
  );
}
