import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../services/api';

function statusTone(cell) {
  const value = cell?.value;
  if (typeof value === 'number') return 'present';
  if (String(value).toLowerCase().includes('absent')) return 'absent';
  if (String(value).toLowerCase().includes('single')) return 'single';
  if (String(value).toLowerCase().includes('sick')) return 'leave-sick';
  if (String(value).toLowerCase().includes('annual')) return 'leave-annual';
  if (String(value).toLowerCase().includes('holiday')) return 'holiday';
  return 'neutral';
}

export default function EmployeeAttendancePage() {
  const [month, setMonth] = useState(4);
  const [year, setYear] = useState(2026);
  const [rows, setRows] = useState([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    apiFetch(`/attendance/monthly?month=${month}&year=${year}`)
      .then((response) => setRows(response.rows || []))
      .catch(() => setRows([]));
  }, [month, year]);

  const employeeRow = rows[0];
  const days = useMemo(() => new Date(year, month, 0).getDate(), [month, year]);
  const dailyItems = useMemo(() => {
    if (!employeeRow) return [];
    return Array.from({ length: days }, (_, index) => {
      const day = String(index + 1);
      return { day: index + 1, cell: employeeRow[day] || { value: 'Absent' } };
    });
  }, [employeeRow, days]);

  return (
    <div className="page mobile-page">
      <section className="card mobile-filter-card">
        <div className="controls compact-controls two-up">
          <label>
            Month
            <input type="number" value={month} min="1" max="12" onChange={(e) => setMonth(Number(e.target.value))} />
          </label>
          <label>
            Year
            <input type="number" value={year} min="2024" max="2035" onChange={(e) => setYear(Number(e.target.value))} />
          </label>
        </div>
      </section>

      <section className="attendance-mobile-list">
        {dailyItems.map(({ day, cell }) => (
          <article key={day} className={`attendance-mobile-card ${statusTone(cell)}`}>
            <div>
              <strong>Day {day}</strong>
              <p>{typeof cell.value === 'number' ? `${cell.value} Hours` : cell.value}</p>
            </div>
            {cell.isModified ? <span className="soft-badge">Edited</span> : null}
          </article>
        ))}
      </section>

      <section className="card mobile-list-card">
        <div className="page-header compact">
          <div>
            <h2>Monthly View</h2>
            <p>عرض جدول شهري مختصر عند الحاجة</p>
          </div>
          <button className="ghost" onClick={() => setExpanded((prev) => !prev)}>{expanded ? 'Hide' : 'Show'}</button>
        </div>
        {expanded ? (
          <div className="mini-month-grid">
            {dailyItems.map(({ day, cell }) => (
              <div key={day} className={`mini-day ${statusTone(cell)}`}>
                <span>{day}</span>
                <strong>{typeof cell.value === 'number' ? cell.value : String(cell.value).slice(0, 2)}</strong>
              </div>
            ))}
          </div>
        ) : <p className="muted">اضغط Show لعرض الشبكة الشهرية.</p>}
      </section>
    </div>
  );
}
