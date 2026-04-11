import { db, getProjectById, getPackageById } from './store.js';
import { getPool, shouldUsePostgres } from './database.js';

function syncAttendanceRecordIntoMemory(record) {
  const idx = db.attendanceRecords.findIndex((r) => r.id === Number(record.id));
  if (idx >= 0) db.attendanceRecords[idx] = { ...db.attendanceRecords[idx], ...record };
  else db.attendanceRecords.push({ ...record });
  return db.attendanceRecords.find((r) => r.id === Number(record.id));
}

function syncAttendanceUploadIntoMemory(upload) {
  const idx = db.attendanceUploads.findIndex((u) => u.id === Number(upload.id));
  if (idx >= 0) db.attendanceUploads[idx] = { ...db.attendanceUploads[idx], ...upload };
  else db.attendanceUploads.push({ ...upload });
  return db.attendanceUploads.find((u) => u.id === Number(upload.id));
}

function syncAttendanceAdjustmentIntoMemory(item) {
  const idx = db.attendanceAdjustments.findIndex((r) => r.id === Number(item.id));
  if (idx >= 0) db.attendanceAdjustments[idx] = { ...db.attendanceAdjustments[idx], ...item };
  else db.attendanceAdjustments.push({ ...item });
  return db.attendanceAdjustments.find((r) => r.id === Number(item.id));
}

function mapRecordRow(row) {
  return {
    id: Number(row.id),
    employeeId: Number(row.employee_id),
    date: row.date,
    hours: Number(row.hours || 0),
    status: row.status,
    source: row.source,
    uploadId: row.upload_id == null ? null : Number(row.upload_id),
    isModified: Boolean(row.is_modified),
    note: row.note || '',
    requestId: row.request_id == null ? null : Number(row.request_id),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapUploadRow(row) {
  return {
    id: Number(row.id),
    fileName: row.file_name,
    uploadedBy: row.uploaded_by,
    importedAt: row.imported_at,
    columns: row.columns || {}
  };
}

function mapAdjustmentRow(row) {
  return {
    id: Number(row.id),
    employeeId: Number(row.employee_id),
    employeeName: row.employee_name,
    date: row.date,
    currentStatus: row.current_status,
    newStatus: row.new_status,
    hours: Number(row.hours || 0),
    reason: row.reason || '',
    approverUserId: row.approver_user_id == null ? null : Number(row.approver_user_id),
    requestedById: row.requested_by_id == null ? null : Number(row.requested_by_id),
    requestedByName: row.requested_by_name || '',
    status: row.status,
    reviewedBy: row.reviewed_by,
    reviewedByName: row.reviewed_by_name,
    reviewedAt: row.reviewed_at,
    rejectionReason: row.rejection_reason || '',
    createdAt: row.created_at
  };
}

export async function listAttendanceRecordsRepo() {
  if (!shouldUsePostgres()) return db.attendanceRecords;
  const { rows } = await getPool().query('SELECT * FROM attendance_records ORDER BY id');
  const items = rows.map(mapRecordRow);
  items.forEach(syncAttendanceRecordIntoMemory);
  return items;
}

export async function upsertAttendanceRecordRepo(record) {
  if (!shouldUsePostgres()) {
    const existing = db.attendanceRecords.find((r) => r.employeeId === record.employeeId && r.date === record.date);
    if (existing) {
      Object.assign(existing, record, { updatedAt: new Date().toISOString() });
      return existing;
    }
    const newRecord = { id: db.attendanceRecords.length + 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...record };
    db.attendanceRecords.push(newRecord);
    return newRecord;
  }
  const query = `INSERT INTO attendance_records (employee_id, date, hours, status, source, upload_id, is_modified, note, request_id)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
                 ON CONFLICT (employee_id, date)
                 DO UPDATE SET hours = EXCLUDED.hours, status = EXCLUDED.status, source = EXCLUDED.source,
                               upload_id = EXCLUDED.upload_id, is_modified = EXCLUDED.is_modified,
                               note = EXCLUDED.note, request_id = COALESCE(EXCLUDED.request_id, attendance_records.request_id),
                               updated_at = NOW()
                 RETURNING *`;
  const values = [Number(record.employeeId), record.date, Number(record.hours || 0), record.status, record.source || 'manual', record.uploadId || null, Boolean(record.isModified), record.note || '', record.requestId || null];
  const { rows } = await getPool().query(query, values);
  return syncAttendanceRecordIntoMemory(mapRecordRow(rows[0]));
}

export async function createAttendanceUploadRepo(upload) {
  if (!shouldUsePostgres()) {
    const item = { id: db.attendanceUploads.length + 1, importedAt: new Date().toISOString(), ...upload };
    db.attendanceUploads.push(item);
    return item;
  }
  const { rows } = await getPool().query(
    `INSERT INTO attendance_uploads (file_name, uploaded_by, imported_at, columns)
     VALUES ($1,$2,NOW(),$3::jsonb) RETURNING *`,
    [upload.fileName, upload.uploadedBy || 'system', JSON.stringify(upload.columns || {})]
  );
  return syncAttendanceUploadIntoMemory(mapUploadRow(rows[0]));
}

export async function createAttendanceAdjustmentRepo(payload) {
  if (!shouldUsePostgres()) {
    const item = { id: db.attendanceAdjustments.length + 1, createdAt: new Date().toISOString(), status: 'pending', ...payload };
    db.attendanceAdjustments.push(item);
    return item;
  }
  const { rows } = await getPool().query(
    `INSERT INTO attendance_adjustments
      (employee_id, employee_name, date, current_status, new_status, hours, reason, approver_user_id, requested_by_id, requested_by_name, status, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending',NOW()) RETURNING *`,
    [payload.employeeId, payload.employeeName || null, payload.date, payload.currentStatus || null, payload.newStatus, Number(payload.hours || 0), payload.reason || '', payload.approverUserId || null, payload.requestedById || null, payload.requestedByName || null]
  );
  return syncAttendanceAdjustmentIntoMemory(mapAdjustmentRow(rows[0]));
}

export async function listAttendanceAdjustmentsRepo() {
  if (!shouldUsePostgres()) return db.attendanceAdjustments.slice().sort((a, b) => b.id - a.id);
  const { rows } = await getPool().query('SELECT * FROM attendance_adjustments ORDER BY id DESC');
  const items = rows.map(mapAdjustmentRow);
  items.forEach(syncAttendanceAdjustmentIntoMemory);
  return items;
}

export async function getAttendanceAdjustmentByIdRepo(id) {
  if (!shouldUsePostgres()) return db.attendanceAdjustments.find((item) => item.id === Number(id));
  const { rows } = await getPool().query('SELECT * FROM attendance_adjustments WHERE id = $1 LIMIT 1', [Number(id)]);
  if (!rows[0]) return null;
  return syncAttendanceAdjustmentIntoMemory(mapAdjustmentRow(rows[0]));
}

export async function reviewAttendanceAdjustmentRepo(id, changes) {
  if (!shouldUsePostgres()) {
    const item = db.attendanceAdjustments.find((r) => r.id === Number(id));
    if (!item) return null;
    Object.assign(item, changes);
    return item;
  }
  const { rows } = await getPool().query(
    `UPDATE attendance_adjustments
       SET status = $2, reviewed_by = $3, reviewed_by_name = $4, reviewed_at = $5, rejection_reason = $6
     WHERE id = $1 RETURNING *`,
    [Number(id), changes.status, changes.reviewedBy || null, changes.reviewedByName || null, changes.reviewedAt || new Date().toISOString(), changes.rejectionReason || '']
  );
  if (!rows[0]) return null;
  return syncAttendanceAdjustmentIntoMemory(mapAdjustmentRow(rows[0]));
}

export async function getScopedAttendanceIssuesRepo({ month, year }) {
  const records = await listAttendanceRecordsRepo();
  return { records, month, year, projects: db.projects.map((p) => ({ id: p.id, name: p.name })), packages: db.packages.map((p) => ({ id: p.id, name: p.name })) };
}
