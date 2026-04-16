import { query } from "./index.js";

function mapRecordRow(row) {
  return {
    id: row.id,
    employeeId: row.employee_code ?? row.employee_id,
    date: row.date,
    hours: Number(row.hours || 0),
    status: row.status,
    createdAt: row.created_at,
  };
}

// ✅ جلب الحضور (FIX work_date -> date)
export async function listAttendanceRecordsRepo() {
  const { rows } = await query(`
    SELECT *
    FROM attendance_records
    ORDER BY date DESC
  `);

  return rows.map(mapRecordRow);
}

// ✅ فلترة بالشهر
export async function getScopedAttendanceIssuesRepo({ month, year }) {
  const { rows } = await query(
    `
    SELECT *
    FROM attendance_records
    WHERE EXTRACT(MONTH FROM date) = $1
      AND EXTRACT(YEAR FROM date) = $2
    `,
    [month, year]
  );

  return {
    records: rows.map(mapRecordRow),
    month,
    year,
  };
}
