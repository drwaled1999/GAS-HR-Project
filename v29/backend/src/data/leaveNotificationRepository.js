import { addAuditLog, addSecurityEvent, db, getMonthKey } from './store.js';
import { upsertAttendanceRecordRepo } from './attendanceRepository.js';
import { getPool, shouldUsePostgres } from './database.js';
import { getScopedEmployeesForUserRepo } from './userEmployeeRepository.js';

function syncLeavePolicy(row) {
  const item = {
    code: row.code,
    label: row.label,
    defaultDays: Number(row.default_days || 0),
    requiresAttachment: Boolean(row.requires_attachment),
    deductFromBalance: Boolean(row.deduct_from_balance),
    active: Boolean(row.active),
    updatedAt: row.updated_at
  };
  const idx = db.leavePolicies.findIndex((x) => x.code === item.code);
  if (idx >= 0) db.leavePolicies[idx] = item; else db.leavePolicies.push(item);
  return item;
}

function syncLeaveBalance(row) {
  const item = {
    employeeId: Number(row.employee_id),
    annualLeaveTotal: Number(row.annual_leave_total || 30),
    annualLeaveUsed: Number(row.annual_leave_used || 0),
    emergencyLeaveTotal: Number(row.emergency_leave_total || 5),
    emergencyLeaveUsed: Number(row.emergency_leave_used || 0),
    sickLeaveTotal: Number(row.sick_leave_total || 15),
    sickLeaveUsed: Number(row.sick_leave_used || 0),
    updatedAt: row.updated_at
  };
  const idx = db.leaveBalances.findIndex((x) => x.employeeId === item.employeeId);
  if (idx >= 0) db.leaveBalances[idx] = item; else db.leaveBalances.push(item);
  return item;
}

function syncClosedMonth(row) {
  const item = {
    key: row.key,
    month: Number(row.month),
    year: Number(row.year),
    closed: Boolean(row.closed),
    closedAt: row.closed_at,
    closedById: row.closed_by_id == null ? null : Number(row.closed_by_id),
    closedByName: row.closed_by_name,
    reopenedAt: row.reopened_at,
    reopenedById: row.reopened_by_id == null ? null : Number(row.reopened_by_id),
    reopenedByName: row.reopened_by_name,
    note: row.note || ''
  };
  const idx = db.closedAttendanceMonths.findIndex((x) => x.key === item.key);
  if (idx >= 0) db.closedAttendanceMonths[idx] = item; else db.closedAttendanceMonths.unshift(item);
  return item;
}

function syncLeaveRequest(row) {
  const item = {
    id: Number(row.id),
    employeeId: Number(row.employee_id),
    employeeName: row.employee_name,
    employeeGasId: row.employee_gas_id,
    projectId: row.project_id == null ? null : Number(row.project_id),
    packageId: row.package_id == null ? null : Number(row.package_id),
    type: row.type,
    startDate: String(row.start_date).slice(0,10),
    endDate: String(row.end_date).slice(0,10),
    note: row.note || '',
    category: row.category || 'leave',
    currentBank: row.current_bank || '',
    newBank: row.new_bank || '',
    newIban: row.new_iban || '',
    attachmentName: row.attachment_name || null,
    attachmentPath: row.attachment_path || null,
    requestedById: Number(row.requested_by_id),
    requestedByName: row.requested_by_name || '',
    approverUserId: row.approver_user_id == null ? null : Number(row.approver_user_id),
    status: row.status || 'pending',
    reviewerId: row.reviewer_id == null ? null : Number(row.reviewer_id),
    reviewerName: row.reviewer_name || null,
    rejectionReason: row.rejection_reason || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
  const idx = db.leaveRequests.findIndex((x) => x.id === item.id);
  if (idx >= 0) db.leaveRequests[idx] = item; else db.leaveRequests.unshift(item);
  return item;
}

function syncNotification(row) {
  const item = {
    id: Number(row.id),
    userId: Number(row.user_id),
    message: row.message,
    type: row.type || 'general',
    path: row.path || '/',
    meta: row.metadata || {},
    isRead: Boolean(row.is_read),
    createdAt: row.created_at,
    readAt: row.read_at || null
  };
  const idx = db.notifications.findIndex((x) => x.id === item.id);
  if (idx >= 0) db.notifications[idx] = item; else db.notifications.unshift(item);
  return item;
}

export async function listLeavePoliciesRepo() {
  if (!shouldUsePostgres()) return [...db.leavePolicies];
  const { rows } = await getPool().query('SELECT * FROM leave_policies ORDER BY code');
  return rows.map(syncLeavePolicy);
}

export async function updateLeavePolicyRepo(code, payload, actorName='System Owner') {
  if (!shouldUsePostgres()) {
    const { updateLeavePolicy } = await import('./store.js');
    return updateLeavePolicy(code, payload, actorName);
  }
  const current = (await listLeavePoliciesRepo()).find((x) => x.code === code);
  if (!current) return null;
  const values = {
    label: payload.label ?? current.label,
    defaultDays: payload.defaultDays !== undefined ? Number(payload.defaultDays) : current.defaultDays,
    requiresAttachment: payload.requiresAttachment !== undefined ? Boolean(payload.requiresAttachment) : current.requiresAttachment,
    deductFromBalance: payload.deductFromBalance !== undefined ? Boolean(payload.deductFromBalance) : current.deductFromBalance,
    active: payload.active !== undefined ? Boolean(payload.active) : current.active
  };
  const { rows } = await getPool().query('UPDATE leave_policies SET label=$1, default_days=$2, requires_attachment=$3, deduct_from_balance=$4, active=$5, updated_at=NOW() WHERE code=$6 RETURNING *', [values.label, values.defaultDays, values.requiresAttachment, values.deductFromBalance, values.active, code]);
  const item = syncLeavePolicy(rows[0]);
  addAuditLog('LEAVE_POLICY_UPDATED', actorName, { code, policy: item });
  return item;
}

export async function getLeaveBalanceForEmployeeRepo(employeeId) {
  if (!shouldUsePostgres()) {
    const { getLeaveBalanceForEmployee } = await import('./store.js');
    return getLeaveBalanceForEmployee(employeeId);
  }
  const { rows } = await getPool().query('SELECT * FROM leave_balances WHERE employee_id=$1 LIMIT 1', [Number(employeeId)]);
  if (rows[0]) return syncLeaveBalance(rows[0]);
  const inserted = await getPool().query('INSERT INTO leave_balances (employee_id) VALUES ($1) RETURNING *', [Number(employeeId)]);
  return syncLeaveBalance(inserted.rows[0]);
}

export async function listScopedLeaveBalancesRepo(user) {
  if (!shouldUsePostgres()) {
    const { listScopedLeaveBalances } = await import('./store.js');
    return listScopedLeaveBalances(user);
  }
  const employees = await getScopedEmployeesForUserRepo(user);
  const ids = employees.map((e) => Number(e.id));
  if (!ids.length) return [];
  const { rows } = await getPool().query('SELECT * FROM leave_balances WHERE employee_id = ANY($1::int[]) ORDER BY employee_id', [ids]);
  const balances = rows.map(syncLeaveBalance);
  const byId = new Map(balances.map((b)=>[b.employeeId,b]));
  const filled = [];
  for (const id of ids) {
    const item = byId.get(id) || await getLeaveBalanceForEmployeeRepo(id);
    filled.push({
      ...item,
      annualLeaveRemaining: Math.max(0, Number(item.annualLeaveTotal||0)-Number(item.annualLeaveUsed||0)),
      emergencyLeaveRemaining: Math.max(0, Number(item.emergencyLeaveTotal||0)-Number(item.emergencyLeaveUsed||0)),
      sickLeaveRemaining: Math.max(0, Number(item.sickLeaveTotal||0)-Number(item.sickLeaveUsed||0)),
    });
  }
  return filled;
}

export async function updateLeaveBalanceRepo(employeeId, payload, actorName='System Owner') {
  if (!shouldUsePostgres()) {
    const { updateLeaveBalance } = await import('./store.js');
    return updateLeaveBalance(employeeId, payload, actorName);
  }
  const current = await getLeaveBalanceForEmployeeRepo(employeeId);
  const merged = {
    annualLeaveTotal: payload.annualLeaveTotal !== undefined ? Number(payload.annualLeaveTotal) : current.annualLeaveTotal,
    annualLeaveUsed: payload.annualLeaveUsed !== undefined ? Number(payload.annualLeaveUsed) : current.annualLeaveUsed,
    emergencyLeaveTotal: payload.emergencyLeaveTotal !== undefined ? Number(payload.emergencyLeaveTotal) : current.emergencyLeaveTotal,
    emergencyLeaveUsed: payload.emergencyLeaveUsed !== undefined ? Number(payload.emergencyLeaveUsed) : current.emergencyLeaveUsed,
    sickLeaveTotal: payload.sickLeaveTotal !== undefined ? Number(payload.sickLeaveTotal) : current.sickLeaveTotal,
    sickLeaveUsed: payload.sickLeaveUsed !== undefined ? Number(payload.sickLeaveUsed) : current.sickLeaveUsed,
  };
  const { rows } = await getPool().query('UPDATE leave_balances SET annual_leave_total=$1, annual_leave_used=$2, emergency_leave_total=$3, emergency_leave_used=$4, sick_leave_total=$5, sick_leave_used=$6, updated_at=NOW() WHERE employee_id=$7 RETURNING *', [merged.annualLeaveTotal, merged.annualLeaveUsed, merged.emergencyLeaveTotal, merged.emergencyLeaveUsed, merged.sickLeaveTotal, merged.sickLeaveUsed, Number(employeeId)]);
  const item = syncLeaveBalance(rows[0]);
  addAuditLog('LEAVE_BALANCE_UPDATED', actorName, { employeeId: Number(employeeId), balance: item });
  return item;
}

export async function applyLeaveBalanceUsageRepo(leaveRequest, actorName='System') {
  if (!shouldUsePostgres()) {
    const { applyLeaveBalanceUsage } = await import('./store.js');
    return applyLeaveBalanceUsage(leaveRequest, actorName);
  }
  const start = new Date(leaveRequest.startDate);
  const end = new Date(leaveRequest.endDate);
  const days = Math.max(1, Math.floor((end - start) / 86400000) + 1);
  const current = await getLeaveBalanceForEmployeeRepo(leaveRequest.employeeId);
  const patch = {};
  if (leaveRequest.type === 'Annual Leave') patch.annualLeaveUsed = Number(current.annualLeaveUsed||0)+days;
  if (leaveRequest.type === 'Emergency Leave') patch.emergencyLeaveUsed = Number(current.emergencyLeaveUsed||0)+days;
  if (leaveRequest.type === 'Sick Leave') patch.sickLeaveUsed = Number(current.sickLeaveUsed||0)+days;
  const updated = await updateLeaveBalanceRepo(leaveRequest.employeeId, patch, actorName);
  addAuditLog('LEAVE_BALANCE_APPLIED', actorName, { employeeId: leaveRequest.employeeId, type: leaveRequest.type, days });
  return updated;
}

export async function listClosedAttendanceMonthsRepo() {
  if (!shouldUsePostgres()) {
    const { listClosedAttendanceMonths } = await import('./store.js');
    return listClosedAttendanceMonths();
  }
  const { rows } = await getPool().query('SELECT * FROM closed_attendance_months ORDER BY year DESC, month DESC');
  return rows.map(syncClosedMonth);
}

export async function isAttendanceMonthClosedRepo(month, year) {
  if (!shouldUsePostgres()) {
    const { isAttendanceMonthClosed } = await import('./store.js');
    return isAttendanceMonthClosed(month, year);
  }
  const key = getMonthKey(month, year);
  const { rows } = await getPool().query('SELECT closed FROM closed_attendance_months WHERE key=$1 LIMIT 1', [key]);
  return Boolean(rows[0]?.closed);
}

export async function closeAttendanceMonthRepo(month, year, actorId, actorName, note='') {
  if (!shouldUsePostgres()) {
    const { closeAttendanceMonth } = await import('./store.js');
    return closeAttendanceMonth(month, year, actorId, actorName, note);
  }
  const key = getMonthKey(month, year);
  const { rows } = await getPool().query(`INSERT INTO closed_attendance_months (key,month,year,closed,closed_at,closed_by_id,closed_by_name,note)
    VALUES ($1,$2,$3,TRUE,NOW(),$4,$5,$6)
    ON CONFLICT (key) DO UPDATE SET closed=TRUE, closed_at=NOW(), closed_by_id=$4, closed_by_name=$5, note=$6
    RETURNING *`, [key, Number(month), Number(year), actorId ? Number(actorId) : null, actorName, note]);
  const item = syncClosedMonth(rows[0]);
  addAuditLog('ATTENDANCE_MONTH_CLOSED', actorName, { month:Number(month), year:Number(year), note });
  return item;
}

export async function reopenAttendanceMonthRepo(month, year, actorId, actorName) {
  if (!shouldUsePostgres()) {
    const { reopenAttendanceMonth } = await import('./store.js');
    return reopenAttendanceMonth(month, year, actorId, actorName);
  }
  const key = getMonthKey(month, year);
  const { rows } = await getPool().query(`INSERT INTO closed_attendance_months (key,month,year,closed,reopened_at,reopened_by_id,reopened_by_name)
    VALUES ($1,$2,$3,FALSE,NOW(),$4,$5)
    ON CONFLICT (key) DO UPDATE SET closed=FALSE, reopened_at=NOW(), reopened_by_id=$4, reopened_by_name=$5
    RETURNING *`, [key, Number(month), Number(year), actorId ? Number(actorId) : null, actorName]);
  const item = syncClosedMonth(rows[0]);
  addAuditLog('ATTENDANCE_MONTH_REOPENED', actorName, { month:Number(month), year:Number(year) });
  return item;
}

export async function createLeaveRequestRepo(payload, actorName='System') {
  if (!shouldUsePostgres()) {
    const { createLeaveRequest } = await import('./store.js');
    return createLeaveRequest(payload, actorName);
  }
  const { rows } = await getPool().query(`INSERT INTO leave_requests (employee_id,employee_name,employee_gas_id,project_id,package_id,type,start_date,end_date,note,category,current_bank,new_bank,new_iban,attachment_name,attachment_path,requested_by_id,requested_by_name,approver_user_id,status,rejection_reason,created_at,updated_at)
  VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,'pending','',NOW(),NOW()) RETURNING *`, [Number(payload.employeeId), payload.employeeName, payload.employeeGasId, payload.projectId||null, payload.packageId||null, payload.type, payload.startDate, payload.endDate, payload.note||'', payload.category||'leave', payload.currentBank||'', payload.newBank||'', payload.newIban||'', payload.attachmentName||null, payload.attachmentPath||null, Number(payload.requestedById), payload.requestedByName||actorName, payload.approverUserId||null]);
  const item = syncLeaveRequest(rows[0]);
  addAuditLog('CREATE_LEAVE_REQUEST', actorName, { requestId: item.id, employeeId: item.employeeId, type: item.type });
  return item;
}


async function applyApprovedLeaveToAttendanceRepo(leaveRequest, actorName='System') {
  const typeToStatus = {
    'Annual Leave': 'Annual Leave',
    'Sick Leave': 'Sick Leave',
    'Emergency Leave': 'Emergency Leave',
    'Hajj Leave': 'Hajj',
    'Umrah Leave': 'Umrah',
    'Business Trip': 'Business Trip',
    'Task Assignment': 'Training'
  };
  const attendanceStatus = typeToStatus[leaveRequest.type];
  if (!attendanceStatus) return [];
  const start = new Date(leaveRequest.startDate);
  const end = new Date(leaveRequest.endDate);
  const updated = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    const date = cursor.toISOString().slice(0,10);
    const record = await upsertAttendanceRecordRepo({
      employeeId: Number(leaveRequest.employeeId),
      date,
      hours: 0,
      status: attendanceStatus,
      source: 'request-approved',
      isModified: true,
      note: `${leaveRequest.type} approved request #${leaveRequest.id}`,
      requestId: leaveRequest.id
    });
    updated.push(record);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  addAuditLog('APPLY_APPROVED_LEAVE_TO_ATTENDANCE', actorName, { requestId: leaveRequest.id, employeeId: leaveRequest.employeeId, type: leaveRequest.type, affectedDays: updated.length });
  return updated;
}

export async function reviewLeaveRequestRepo(requestId, payload, actorName='System') {
  if (!shouldUsePostgres()) {
    const { reviewLeaveRequest } = await import('./store.js');
    return reviewLeaveRequest(requestId, payload, actorName);
  }
  const { rows } = await getPool().query('UPDATE leave_requests SET status=$1, reviewer_id=$2, reviewer_name=$3, rejection_reason=$4, updated_at=NOW() WHERE id=$5 RETURNING *', [payload.decision, Number(payload.reviewerId), payload.reviewerName || actorName, payload.rejectionReason || '', Number(requestId)]);
  const item = syncLeaveRequest(rows[0]);
  if (!item) return null;
  addAuditLog('REVIEW_LEAVE_REQUEST', actorName, { requestId: item.id, decision: item.status });
  if (item.status === 'approved') {
    await applyApprovedLeaveToAttendanceRepo(item, actorName);
    await applyLeaveBalanceUsageRepo(item, actorName);
  }
  return item;
}

export async function listScopedLeaveRequestsRepo(user) {
  if (!shouldUsePostgres()) {
    const { listScopedLeaveRequests } = await import('./store.js');
    return listScopedLeaveRequests(user);
  }
  const employees = await getScopedEmployeesForUserRepo(user);
  const employeeIds = new Set(employees.map((e) => Number(e.id)));
  let rows;
  if (user.roleId === 1) {
    rows = (await getPool().query('SELECT * FROM leave_requests ORDER BY created_at DESC')).rows;
  } else {
    rows = (await getPool().query('SELECT * FROM leave_requests ORDER BY created_at DESC')).rows.filter((r) => employeeIds.has(Number(r.employee_id)));
    if (['Engineer', 'Supervisor', 'Employee'].includes(user.jobTitle)) rows = rows.filter((r) => Number(r.requested_by_id) === Number(user.id) || Number(r.approver_user_id) === Number(user.id));
    if (['Project Manager', 'CM', 'HR Manager', 'HR'].includes(user.jobTitle)) rows = rows.filter((r) => Number(r.approver_user_id) === Number(user.id) || employeeIds.has(Number(r.employee_id)));
  }
  return rows.map(syncLeaveRequest);
}

export async function createNotificationRepo(userId, message, type='general', path='/', meta={}) {
  if (!shouldUsePostgres()) {
    const { createNotification } = await import('./store.js');
    return createNotification(userId, message, type, path, meta);
  }
  const { rows } = await getPool().query('INSERT INTO notifications (user_id,message,type,path,metadata,is_read,created_at) VALUES ($1,$2,$3,$4,$5::jsonb,FALSE,NOW()) RETURNING *', [Number(userId), message, type, path, JSON.stringify(meta || {})]);
  return syncNotification(rows[0]);
}

export async function listNotificationsForUserRepo(userId) {
  if (!shouldUsePostgres()) {
    const { listNotificationsForUser } = await import('./store.js');
    return listNotificationsForUser(userId);
  }
  const { rows } = await getPool().query('SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 200', [Number(userId)]);
  return rows.map(syncNotification);
}

export async function getUnreadNotificationsCountRepo(userId) {
  if (!shouldUsePostgres()) {
    const { getUnreadNotificationsCount } = await import('./store.js');
    return getUnreadNotificationsCount(userId);
  }
  const { rows } = await getPool().query('SELECT COUNT(*)::int AS count FROM notifications WHERE user_id=$1 AND is_read=FALSE', [Number(userId)]);
  return Number(rows[0]?.count || 0);
}

export async function markNotificationReadRepo(notificationId, userId) {
  if (!shouldUsePostgres()) {
    const { markNotificationRead } = await import('./store.js');
    return markNotificationRead(notificationId, userId);
  }
  const { rows } = await getPool().query('UPDATE notifications SET is_read=TRUE, read_at=NOW() WHERE id=$1 AND user_id=$2 RETURNING *', [Number(notificationId), Number(userId)]);
  return rows[0] ? syncNotification(rows[0]) : null;
}

export async function markAllNotificationsReadRepo(userId) {
  if (!shouldUsePostgres()) {
    const { markAllNotificationsRead } = await import('./store.js');
    return markAllNotificationsRead(userId);
  }
  const { rowCount } = await getPool().query('UPDATE notifications SET is_read=TRUE, read_at=NOW() WHERE user_id=$1 AND is_read=FALSE', [Number(userId)]);
  return rowCount || 0;
}
