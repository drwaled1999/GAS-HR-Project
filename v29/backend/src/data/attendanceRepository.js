import { query } from "./index.js";

function mapRecordRow(row) {
  if (!row) return null;

  return {
    id: row.id,
    employeeId: row.employee_id ?? row.employee_code ?? null,
    date: row.date,
    hours: Number(row.hours || 0),
    status: row.status,
    source: row.source,
    uploadId: row.upload_id ?? null,
    isModified: Boolean(row.is_modified),
    note: row.note || "",
    requestId: row.request_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapUploadRow(row) {
  if (!row) return null;

  return {
    id: row.id,
    fileName: row.file_name,
    uploadedBy: row.uploaded_by,
    importedAt: row.imported_at,
    columns: row.columns || {},
  };
}

function mapAdjustmentRow(row) {
  if (!row) return null;

  return {
    id: row.id,
    employeeId: row.employee_id ?? row.employee_code ?? null,
    employeeName: row.employee_name,
    date: row.date,
    currentStatus: row.current_status,
    newStatus: row.new_status,
    hours: Number(row.hours || 0),
    reason: row.reason || "",
    approverUserId: row.approver_user_id ?? null,
    requestedById: row.requested_by_id ?? null,
    requestedByName: row.requested_by_name || "",
    status: row.status,
    reviewedBy: row.reviewed_by ?? null,
    reviewedByName: row.reviewed_by_name ?? null,
    reviewedAt: row.reviewed_at ?? null,
    rejectionReason: row.rejection_reason || "",
    createdAt: row.created_at,
  };
}

export async function listAttendanceRecordsRepo() {
  const { rows } = await query(
    `SELECT *
     FROM attendance_records
     ORDER BY date DESC, employee_code ASC`
  );

  return rows.map(mapRecordRow);
}

export async function upsertAttendanceRecordRepo(record) {
  const sql = `
    INSERT INTO attendance_records (
      employee_code,
      date,
      hours,
      status,
      source,
      upload_id,
      is_modified,
      note,
      request_id
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    ON CONFLICT (employee_code, date)
    DO UPDATE SET
      hours = EXCLUDED.hours,
      status = EXCLUDED.status,
      source = EXCLUDED.source,
      upload_id = EXCLUDED.upload_id,
      is_modified = EXCLUDED.is_modified,
      note = EXCLUDED.note,
      request_id = COALESCE(EXCLUDED.request_id, attendance_records.request_id),
      updated_at = NOW()
    RETURNING *
  `;

  const values = [
    record.employeeId,
    record.date,
    Number(record.hours || 0),
    record.status,
    record.source || "manual",
    record.uploadId || null,
    Boolean(record.isModified),
    record.note || "",
    record.requestId || null,
  ];

  const { rows } = await query(sql, values);
  return mapRecordRow(rows[0]);
}

export async function createAttendanceUploadRepo(upload) {
  const sql = `
    INSERT INTO attendance_uploads (
      file_name,
      uploaded_by,
      imported_at,
      columns
    )
    VALUES ($1,$2,NOW(),$3::jsonb)
    RETURNING *
  `;

  const values = [
    upload.fileName,
    upload.uploadedBy || "system",
    JSON.stringify(upload.columns || {}),
  ];

  const { rows } = await query(sql, values);
  return mapUploadRow(rows[0]);
}

export async function createAttendanceAdjustmentRepo(payload) {
  const sql = `
    INSERT INTO attendance_adjustments (
      employee_id,
      employee_name,
      date,
      current_status,
      new_status,
      hours,
      reason,
      approver_user_id,
      requested_by_id,
      requested_by_name,
      status,
      created_at
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending',NOW())
    RETURNING *
  `;

  const values = [
    payload.employeeId,
    payload.employeeName || null,
    payload.date,
    payload.currentStatus || null,
    payload.newStatus,
    Number(payload.hours || 0),
    payload.reason || "",
    payload.approverUserId || null,
    payload.requestedById || null,
    payload.requestedByName || null,
  ];

  const { rows } = await query(sql, values);
  return mapAdjustmentRow(rows[0]);
}

export async function listAttendanceAdjustmentsRepo() {
  const { rows } = await query(
    `SELECT *
     FROM attendance_adjustments
     ORDER BY created_at DESC, id DESC`
  );

  return rows.map(mapAdjustmentRow);
}

export async function getAttendanceAdjustmentByIdRepo(id) {
  const { rows } = await query(
    `SELECT *
     FROM attendance_adjustments
     WHERE id = $1
     LIMIT 1`,
    [id]
  );

  return mapAdjustmentRow(rows[0]);
}

export async function reviewAttendanceAdjustmentRepo(id, changes) {
  const sql = `
    UPDATE attendance_adjustments
    SET
      status = $2,
      reviewed_by = $3,
      reviewed_by_name = $4,
      reviewed_at = $5,
      rejection_reason = $6
    WHERE id = $1
    RETURNING *
  `;

  const values = [
    id,
    changes.status,
    changes.reviewedBy || null,
    changes.reviewedByName || null,
    changes.reviewedAt || new Date().toISOString(),
    changes.rejectionReason || "",
  ];

  const { rows } = await query(sql, values);
  return mapAdjustmentRow(rows[0]);
}

export async function getScopedAttendanceIssuesRepo({ month, year }) {
  const recordsRes = await query(
    `SELECT *
     FROM attendance_records
     WHERE EXTRACT(MONTH FROM date) = $1
       AND EXTRACT(YEAR FROM date) = $2
     ORDER BY date DESC, employee_code ASC`,
    [Number(month), Number(year)]
  );

  let projects = [];
  let packages = [];

  try {
    const projectsRes = await query(
      `SELECT id, name
       FROM projects
       ORDER BY name ASC`
    );
    projects = projectsRes.rows;
  } catch {
    projects = [];
  }

  try {
    const packagesRes = await query(
      `SELECT id, name
       FROM packages
       ORDER BY name ASC`
    );
    packages = packagesRes.rows;
  } catch {
    packages = [];
  }

  return {
    records: recordsRes.rows.map(mapRecordRow),
    month,
    year,
    projects,
    packages,
  };
}
