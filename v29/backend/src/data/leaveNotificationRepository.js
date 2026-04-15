import { addAuditLog, addSecurityEvent, getMonthKey } from "./store.js";
import { upsertAttendanceRecordRepo } from "./attendanceRepository.js";
import { query } from "./index.js";
import { getScopedEmployeesForUserRepo } from "./userEmployeeRepository.js";

function mapLeavePolicy(row) {
  if (!row) return null;

  return {
    code: row.code,
    label: row.label,
    defaultDays: Number(row.default_days || 0),
    requiresAttachment: Boolean(row.requires_attachment),
    deductFromBalance: Boolean(row.deduct_from_balance),
    active: Boolean(row.active),
    updatedAt: row.updated_at,
  };
}

function mapLeaveBalance(row) {
  if (!row) return null;

  return {
    employeeId: row.employee_id,
    annualLeaveTotal: Number(row.annual_leave_total || 30),
    annualLeaveUsed: Number(row.annual_leave_used || 0),
    emergencyLeaveTotal: Number(row.emergency_leave_total || 5),
    emergencyLeaveUsed: Number(row.emergency_leave_used || 0),
    sickLeaveTotal: Number(row.sick_leave_total || 15),
    sickLeaveUsed: Number(row.sick_leave_used || 0),
    updatedAt: row.updated_at,
  };
}

function mapClosedMonth(row) {
  if (!row) return null;

  return {
    key: row.key,
    month: Number(row.month),
    year: Number(row.year),
    closed: Boolean(row.closed),
    closedAt: row.closed_at,
    closedById: row.closed_by_id ?? null,
    closedByName: row.closed_by_name,
    reopenedAt: row.reopened_at,
    reopenedById: row.reopened_by_id ?? null,
    reopenedByName: row.reopened_by_name,
    note: row.note || "",
  };
}

function mapLeaveRequest(row) {
  if (!row) return null;

  return {
    id: row.id,
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    employeeGasId: row.employee_gas_id,
    projectId: row.project_id ?? null,
    packageId: row.package_id ?? null,
    type: row.type,
    startDate: String(row.start_date).slice(0, 10),
    endDate: String(row.end_date).slice(0, 10),
    note: row.note || "",
    category: row.category || "leave",
    currentBank: row.current_bank || "",
    newBank: row.new_bank || "",
    newIban: row.new_iban || "",
    attachmentName: row.attachment_name || null,
    attachmentPath: row.attachment_path || null,
    requestedById: row.requested_by_id,
    requestedByName: row.requested_by_name || "",
    approverUserId: row.approver_user_id ?? null,
    status: row.status || "pending",
    reviewerId: row.reviewer_id ?? null,
    reviewerName: row.reviewer_name || null,
    rejectionReason: row.rejection_reason || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapNotification(row) {
  if (!row) return null;

  return {
    id: row.id,
    userId: row.user_id,
    message: row.message,
    type: row.type || "general",
    path: row.path || "/",
    meta: row.metadata || {},
    isRead: Boolean(row.is_read),
    createdAt: row.created_at,
    readAt: row.read_at || null,
  };
}

export async function listLeavePoliciesRepo() {
  const { rows } = await query(
    `SELECT *
     FROM leave_policies
     ORDER BY code`
  );

  return rows.map(mapLeavePolicy);
}

export async function updateLeavePolicyRepo(code, payload, actorName = "System Owner") {
  const current = (await listLeavePoliciesRepo()).find((x) => x.code === code);
  if (!current) return null;

  const values = {
    label: payload.label ?? current.label,
    defaultDays:
      payload.defaultDays !== undefined
        ? Number(payload.defaultDays)
        : current.defaultDays,
    requiresAttachment:
      payload.requiresAttachment !== undefined
        ? Boolean(payload.requiresAttachment)
        : current.requiresAttachment,
    deductFromBalance:
      payload.deductFromBalance !== undefined
        ? Boolean(payload.deductFromBalance)
        : current.deductFromBalance,
    active:
      payload.active !== undefined
        ? Boolean(payload.active)
        : current.active,
  };

  const { rows } = await query(
    `UPDATE leave_policies
     SET
       label = $1,
       default_days = $2,
       requires_attachment = $3,
       deduct_from_balance = $4,
       active = $5,
       updated_at = NOW()
     WHERE code = $6
     RETURNING *`,
    [
      values.label,
      values.defaultDays,
      values.requiresAttachment,
      values.deductFromBalance,
      values.active,
      code,
    ]
  );

  const item = mapLeavePolicy(rows[0]);
  addAuditLog("LEAVE_POLICY_UPDATED", actorName, { code, policy: item });
  return item;
}

export async function getLeaveBalanceForEmployeeRepo(employeeId) {
  const { rows } = await query(
    `SELECT *
     FROM leave_balances
     WHERE employee_id = $1
     LIMIT 1`,
    [employeeId]
  );

  if (rows[0]) return mapLeaveBalance(rows[0]);

  const inserted = await query(
    `INSERT INTO leave_balances (employee_id)
     VALUES ($1)
     RETURNING *`,
    [employeeId]
  );

  return mapLeaveBalance(inserted.rows[0]);
}

export async function listScopedLeaveBalancesRepo(user) {
  const employees = await getScopedEmployeesForUserRepo(user);
  const ids = employees.map((e) => e.id).filter(Boolean);

  if (!ids.length) return [];

  const { rows } = await query(
    `SELECT *
     FROM leave_balances
     WHERE employee_id = ANY($1::uuid[])
     ORDER BY employee_id`,
    [ids]
  );

  const balances = rows.map(mapLeaveBalance);
  const byId = new Map(balances.map((b) => [String(b.employeeId), b]));
  const filled = [];

  for (const id of ids) {
    const existing = byId.get(String(id));
    const item = existing || (await getLeaveBalanceForEmployeeRepo(id));

    filled.push({
      ...item,
      annualLeaveRemaining: Math.max(
        0,
        Number(item.annualLeaveTotal || 0) - Number(item.annualLeaveUsed || 0)
      ),
      emergencyLeaveRemaining: Math.max(
        0,
        Number(item.emergencyLeaveTotal || 0) - Number(item.emergencyLeaveUsed || 0)
      ),
      sickLeaveRemaining: Math.max(
        0,
        Number(item.sickLeaveTotal || 0) - Number(item.sickLeaveUsed || 0)
      ),
    });
  }

  return filled;
}

export async function updateLeaveBalanceRepo(employeeId, payload, actorName = "System Owner") {
  const current = await getLeaveBalanceForEmployeeRepo(employeeId);

  const merged = {
    annualLeaveTotal:
      payload.annualLeaveTotal !== undefined
        ? Number(payload.annualLeaveTotal)
        : current.annualLeaveTotal,
    annualLeaveUsed:
      payload.annualLeaveUsed !== undefined
        ? Number(payload.annualLeaveUsed)
        : current.annualLeaveUsed,
    emergencyLeaveTotal:
      payload.emergencyLeaveTotal !== undefined
        ? Number(payload.emergencyLeaveTotal)
        : current.emergencyLeaveTotal,
    emergencyLeaveUsed:
      payload.emergencyLeaveUsed !== undefined
        ? Number(payload.emergencyLeaveUsed)
        : current.emergencyLeaveUsed,
    sickLeaveTotal:
      payload.sickLeaveTotal !== undefined
        ? Number(payload.sickLeaveTotal)
        : current.sickLeaveTotal,
    sickLeaveUsed:
      payload.sickLeaveUsed !== undefined
        ? Number(payload.sickLeaveUsed)
        : current.sickLeaveUsed,
  };

  const { rows } = await query(
    `UPDATE leave_balances
     SET
       annual_leave_total = $1,
       annual_leave_used = $2,
       emergency_leave_total = $3,
       emergency_leave_used = $4,
       sick_leave_total = $5,
       sick_leave_used = $6,
       updated_at = NOW()
     WHERE employee_id = $7
     RETURNING *`,
    [
      merged.annualLeaveTotal,
      merged.annualLeaveUsed,
      merged.emergencyLeaveTotal,
      merged.emergencyLeaveUsed,
      merged.sickLeaveTotal,
      merged.sickLeaveUsed,
      employeeId,
    ]
  );

  const item = mapLeaveBalance(rows[0]);
  addAuditLog("LEAVE_BALANCE_UPDATED", actorName, {
    employeeId,
    balance: item,
  });

  return item;
}

export async function applyLeaveBalanceUsageRepo(leaveRequest, actorName = "System") {
  const start = new Date(leaveRequest.startDate);
  const end = new Date(leaveRequest.endDate);
  const days = Math.max(1, Math.floor((end - start) / 86400000) + 1);

  const current = await getLeaveBalanceForEmployeeRepo(leaveRequest.employeeId);
  const patch = {};

  if (leaveRequest.type === "Annual Leave") {
    patch.annualLeaveUsed = Number(current.annualLeaveUsed || 0) + days;
  }
  if (leaveRequest.type === "Emergency Leave") {
    patch.emergencyLeaveUsed = Number(current.emergencyLeaveUsed || 0) + days;
  }
  if (leaveRequest.type === "Sick Leave") {
    patch.sickLeaveUsed = Number(current.sickLeaveUsed || 0) + days;
  }

  const updated = await updateLeaveBalanceRepo(
    leaveRequest.employeeId,
    patch,
    actorName
  );

  addAuditLog("LEAVE_BALANCE_APPLIED", actorName, {
    employeeId: leaveRequest.employeeId,
    type: leaveRequest.type,
    days,
  });

  return updated;
}

export async function listClosedAttendanceMonthsRepo() {
  const { rows } = await query(
    `SELECT *
     FROM closed_attendance_months
     ORDER BY year DESC, month DESC`
  );

  return rows.map(mapClosedMonth);
}

export async function isAttendanceMonthClosedRepo(month, year) {
  const key = getMonthKey(month, year);

  const { rows } = await query(
    `SELECT closed
     FROM closed_attendance_months
     WHERE key = $1
     LIMIT 1`,
    [key]
  );

  return Boolean(rows[0]?.closed);
}

export async function closeAttendanceMonthRepo(month, year, actorId, actorName, note = "") {
  const key = getMonthKey(month, year);

  const { rows } = await query(
    `INSERT INTO closed_attendance_months (
       key,
       month,
       year,
       closed,
       closed_at,
       closed_by_id,
       closed_by_name,
       note
     )
     VALUES ($1,$2,$3,TRUE,NOW(),$4,$5,$6)
     ON CONFLICT (key)
     DO UPDATE SET
       closed = TRUE,
       closed_at = NOW(),
       closed_by_id = $4,
       closed_by_name = $5,
       note = $6
     RETURNING *`,
    [key, Number(month), Number(year), actorId || null, actorName, note]
  );

  const item = mapClosedMonth(rows[0]);
  addAuditLog("ATTENDANCE_MONTH_CLOSED", actorName, {
    month: Number(month),
    year: Number(year),
    note,
  });

  return item;
}

export async function reopenAttendanceMonthRepo(month, year, actorId, actorName) {
  const key = getMonthKey(month, year);

  const { rows } = await query(
    `INSERT INTO closed_attendance_months (
       key,
       month,
       year,
       closed,
       reopened_at,
       reopened_by_id,
       reopened_by_name
     )
     VALUES ($1,$2,$3,FALSE,NOW(),$4,$5)
     ON CONFLICT (key)
     DO UPDATE SET
       closed = FALSE,
       reopened_at = NOW(),
       reopened_by_id = $4,
       reopened_by_name = $5
     RETURNING *`,
    [key, Number(month), Number(year), actorId || null, actorName]
  );

  const item = mapClosedMonth(rows[0]);
  addAuditLog("ATTENDANCE_MONTH_REOPENED", actorName, {
    month: Number(month),
    year: Number(year),
  });

  return item;
}

export async function createLeaveRequestRepo(payload, actorName = "System") {
  const { rows } = await query(
    `INSERT INTO leave_requests (
       employee_id,
       employee_name,
       employee_gas_id,
       project_id,
       package_id,
       type,
       start_date,
       end_date,
       note,
       category,
       current_bank,
       new_bank,
       new_iban,
       attachment_name,
       attachment_path,
       requested_by_id,
       requested_by_name,
       approver_user_id,
       status,
       rejection_reason,
       created_at,
       updated_at
     )
     VALUES (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,'pending','',NOW(),NOW()
     )
     RETURNING *`,
    [
      payload.employeeId,
      payload.employeeName,
      payload.employeeGasId,
      payload.projectId || null,
      payload.packageId || null,
      payload.type,
      payload.startDate,
      payload.endDate,
      payload.note || "",
      payload.category || "leave",
      payload.currentBank || "",
      payload.newBank || "",
      payload.newIban || "",
      payload.attachmentName || null,
      payload.attachmentPath || null,
      payload.requestedById,
      payload.requestedByName || actorName,
      payload.approverUserId || null,
    ]
  );

  const item = mapLeaveRequest(rows[0]);
  addAuditLog("CREATE_LEAVE_REQUEST", actorName, {
    requestId: item.id,
    employeeId: item.employeeId,
    type: item.type,
  });

  return item;
}

async function applyApprovedLeaveToAttendanceRepo(leaveRequest, actorName = "System") {
  const typeToStatus = {
    "Annual Leave": "Annual Leave",
    "Sick Leave": "Sick Leave",
    "Emergency Leave": "Emergency Leave",
    "Hajj Leave": "Hajj",
    "Umrah Leave": "Umrah",
    "Business Trip": "Business Trip",
    "Task Assignment": "Training",
  };

  const attendanceStatus = typeToStatus[leaveRequest.type];
  if (!attendanceStatus) return [];

  const start = new Date(leaveRequest.startDate);
  const end = new Date(leaveRequest.endDate);
  const updated = [];
  const cursor = new Date(start);

  while (cursor <= end) {
    const date = cursor.toISOString().slice(0, 10);

    const record = await upsertAttendanceRecordRepo({
      employeeId: leaveRequest.employeeId,
      date,
      hours: 0,
      status: attendanceStatus,
      source: "request-approved",
      isModified: true,
      note: `${leaveRequest.type} approved request #${leaveRequest.id}`,
      requestId: leaveRequest.id,
    });

    updated.push(record);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  addAuditLog("APPLY_APPROVED_LEAVE_TO_ATTENDANCE", actorName, {
    requestId: leaveRequest.id,
    employeeId: leaveRequest.employeeId,
    type: leaveRequest.type,
    affectedDays: updated.length,
  });

  return updated;
}

export async function reviewLeaveRequestRepo(requestId, payload, actorName = "System") {
  const { rows } = await query(
    `UPDATE leave_requests
     SET
       status = $1,
       reviewer_id = $2,
       reviewer_name = $3,
       rejection_reason = $4,
       updated_at = NOW()
     WHERE id = $5
     RETURNING *`,
    [
      payload.decision,
      payload.reviewerId || null,
      payload.reviewerName || actorName,
      payload.rejectionReason || "",
      requestId,
    ]
  );

  const item = mapLeaveRequest(rows[0]);
  if (!item) return null;

  addAuditLog("REVIEW_LEAVE_REQUEST", actorName, {
    requestId: item.id,
    decision: item.status,
  });

  if (item.status === "approved") {
    await applyApprovedLeaveToAttendanceRepo(item, actorName);
    await applyLeaveBalanceUsageRepo(item, actorName);
  }

  return item;
}

export async function listScopedLeaveRequestsRepo(user) {
  const employees = await getScopedEmployeesForUserRepo(user);
  const employeeIds = new Set(employees.map((e) => String(e.id)));

  let rows = (
    await query(
      `SELECT *
       FROM leave_requests
       ORDER BY created_at DESC`
    )
  ).rows;

  const roleName = String(user?.roleName || "").toLowerCase();
  const jobTitle = String(user?.jobTitle || "");

  const isSystemOwner =
    roleName === "system owner" || String(user?.roleId) === "1";

  if (!isSystemOwner) {
    rows = rows.filter((r) => employeeIds.has(String(r.employee_id)));

    if (["Engineer", "Supervisor", "Employee"].includes(jobTitle)) {
      rows = rows.filter(
        (r) =>
          String(r.requested_by_id) === String(user.id) ||
          String(r.approver_user_id) === String(user.id)
      );
    }

    if (["Project Manager", "CM", "HR Manager", "HR"].includes(jobTitle)) {
      rows = rows.filter(
        (r) =>
          String(r.approver_user_id) === String(user.id) ||
          employeeIds.has(String(r.employee_id))
      );
    }
  }

  return rows.map(mapLeaveRequest);
}

export async function createNotificationRepo(
  userId,
  message,
  type = "general",
  path = "/",
  meta = {}
) {
  const { rows } = await query(
    `INSERT INTO notifications (
       user_id,
       message,
       type,
       path,
       metadata,
       is_read,
       created_at
     )
     VALUES ($1,$2,$3,$4,$5::jsonb,FALSE,NOW())
     RETURNING *`,
    [userId, message, type, path, JSON.stringify(meta || {})]
  );

  return mapNotification(rows[0]);
}

export async function listNotificationsForUserRepo(userId) {
  const { rows } = await query(
    `SELECT *
     FROM notifications
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 200`,
    [userId]
  );

  return rows.map(mapNotification);
}

export async function getUnreadNotificationsCountRepo(userId) {
  const { rows } = await query(
    `SELECT COUNT(*)::int AS count
     FROM notifications
     WHERE user_id = $1
       AND is_read = FALSE`,
    [userId]
  );

  return Number(rows[0]?.count || 0);
}

export async function markNotificationReadRepo(notificationId, userId) {
  const { rows } = await query(
    `UPDATE notifications
     SET
       is_read = TRUE,
       read_at = NOW()
     WHERE id = $1
       AND user_id = $2
     RETURNING *`,
    [notificationId, userId]
  );

  return rows[0] ? mapNotification(rows[0]) : null;
}

export async function markAllNotificationsReadRepo(userId) {
  const { rowCount } = await query(
    `UPDATE notifications
     SET
       is_read = TRUE,
       read_at = NOW()
     WHERE user_id = $1
       AND is_read = FALSE`,
    [userId]
  );

  return rowCount || 0;
}