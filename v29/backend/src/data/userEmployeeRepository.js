import { db, addAuditLog, addSecurityEvent, getRoleById } from './store.js';
import {query} form "./index.js";

function syncUserIntoMemory(user) {
  const idx = db.users.findIndex((u) => u.id === Number(user.id));
  if (idx >= 0) db.users[idx] = { ...db.users[idx], ...user };
  else db.users.push({ ...user });
  return db.users.find((u) => u.id === Number(user.id));
}

function syncEmployeeIntoMemory(employee) {
  const idx = db.employees.findIndex((e) => e.id === Number(employee.id));
  if (idx >= 0) db.employees[idx] = { ...db.employees[idx], ...employee };
  else db.employees.push({ ...employee });
  return db.employees.find((e) => e.id === Number(employee.id));
}

function mapUserRow(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    username: row.username,
    passwordHash: row.password_hash,
    name: row.name,
    gasId: row.gas_id,
    nationalityType: row.nationality_type,
    division: row.division,
    jobTitle: row.job_title,
    roleId: Number(row.role_id),
    roleName: getRoleById(Number(row.role_id))?.name,
    projectId: row.project_id == null ? null : Number(row.project_id),
    packageId: row.package_id == null ? null : Number(row.package_id),
    supervisorId: row.supervisor_id == null ? null : Number(row.supervisor_id),
    accessScope: row.access_scope,
    status: row.status,
    permissions: Array.isArray(row.permissions) ? row.permissions : [],
    allowDuringMaintenance: Boolean(row.allow_during_maintenance),
    failedAttempts: Number(row.failed_attempts || 0),
    isLocked: Boolean(row.is_locked),
    lockedUntil: row.locked_until,
    mustChangePassword: Boolean(row.must_change_password),
    lastLoginAt: row.last_login_at,
    lastLoginIp: row.last_login_ip,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapEmployeeRow(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    gasId: row.gas_id,
    name: row.name,
    nationality: row.nationality,
    projectId: row.project_id == null ? null : Number(row.project_id),
    packageId: row.package_id == null ? null : Number(row.package_id),
    userId: row.user_id == null ? null : Number(row.user_id),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function listUsersRepo() {
  if (!shouldUsePostgres()) return db.users;
  const { rows } = await getPool().query('SELECT * FROM users ORDER BY id');
  const users = rows.map(mapUserRow);
  users.forEach(syncUserIntoMemory);
  return users;
}

export async function listEmployeesRepo() {
  if (!shouldUsePostgres()) return db.employees;
  const { rows } = await getPool().query('SELECT * FROM employees ORDER BY id');
  const employees = rows.map(mapEmployeeRow);
  employees.forEach(syncEmployeeIntoMemory);
  return employees;
}

export async function getUserByIdRepo(userId) {
  if (!shouldUsePostgres()) return db.users.find((u) => u.id === Number(userId));
  const { rows } = await getPool().query('SELECT * FROM users WHERE id = $1 LIMIT 1', [Number(userId)]);
  const user = mapUserRow(rows[0]);
  if (user) syncUserIntoMemory(user);
  return user;
}

export async function getUserByUsernameRepo(username) {
  if (!shouldUsePostgres()) return db.users.find((u) => u.username === username);
  const { rows } = await getPool().query('SELECT * FROM users WHERE username = $1 LIMIT 1', [username]);
  const user = mapUserRow(rows[0]);
  if (user) syncUserIntoMemory(user);
  return user;
}

export async function getEmployeeByGasIdRepo(gasId) {
  if (!shouldUsePostgres()) return db.employees.find((e) => String(e.gasId) === String(gasId));
  const { rows } = await getPool().query('SELECT * FROM employees WHERE gas_id = $1 LIMIT 1', [String(gasId)]);
  const employee = mapEmployeeRow(rows[0]);
  if (employee) syncEmployeeIntoMemory(employee);
  return employee;
}

export async function getScopedEmployeesForUserRepo(user) {
  const all = await listEmployeesRepo();
  if (!user) return [];
  if (user.roleId === 1) return all;
  let employees = [...all];
  if (user.division === 'Saudi Division') employees = employees.filter((e) => e.nationality === 'SAUDI');
  else if (user.division === 'Non-Saudi Division') employees = employees.filter((e) => e.nationality !== 'SAUDI');
  if (user.accessScope === 'Package Only') employees = employees.filter((e) => e.projectId === user.projectId && e.packageId === user.packageId);
  else if (user.accessScope === 'Project Only') employees = employees.filter((e) => e.projectId === user.projectId);
  return employees;
}

export async function getScopedUsersForUserRepo(user) {
  const all = await listUsersRepo();
  if (!user) return [];
  if (user.roleId === 1) return all;
  let users = all.filter((u) => u.id !== 1);
  if (user.division === 'Saudi Division') users = users.filter((u) => u.division === 'Saudi Division');
  else if (user.division === 'Non-Saudi Division') users = users.filter((u) => u.division === 'Non-Saudi Division');
  if (user.accessScope === 'Package Only') users = users.filter((u) => u.projectId === user.projectId && u.packageId === user.packageId);
  else if (user.accessScope === 'Project Only') users = users.filter((u) => u.projectId === user.projectId);
  return users;
}

export async function createUserRepo(payload, actorName = 'System') {
  if (!shouldUsePostgres()) {
    const { createUser } = await import('./store.js');
    return createUser(payload, actorName);
  }
  const q = `INSERT INTO users (
    username, password_hash, name, gas_id, nationality_type, division, job_title, role_id,
    project_id, package_id, supervisor_id, access_scope, status, permissions,
    allow_during_maintenance, failed_attempts, is_locked, locked_until, must_change_password,
    last_login_at, last_login_ip, created_at, updated_at
  ) VALUES (
    $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15,$16,$17,$18,$19,$20,$21,NOW(),NOW()
  ) RETURNING *`;
  const values = [
    payload.username, payload.passwordHash, payload.name, String(payload.gasId), payload.nationalityType || null,
    payload.division, payload.jobTitle, Number(payload.roleId), payload.projectId ? Number(payload.projectId) : null,
    payload.packageId ? Number(payload.packageId) : null, payload.supervisorId ? Number(payload.supervisorId) : null,
    payload.accessScope, payload.status || 'active', JSON.stringify(payload.permissions || []), Boolean(payload.allowDuringMaintenance), 0, false, null,
    Boolean(payload.forcePasswordChange), null, null
  ];
  const { rows } = await getPool().query(q, values);
  const user = mapUserRow(rows[0]);
  syncUserIntoMemory(user);
  addAuditLog('user_created', actorName, { userId: user.id, name: user.name, gasId: user.gasId });
  return user;
}

export async function updateUserRepo(userId, payload, actorName = 'System') {
  if (!shouldUsePostgres()) {
    const { updateUser } = await import('./store.js');
    return updateUser(userId, payload, actorName);
  }
  const current = await getUserByIdRepo(userId);
  if (!current) return null;
  const merged = {
    ...current,
    ...payload,
    roleId: payload.roleId ? Number(payload.roleId) : current.roleId,
    projectId: payload.projectId === null ? null : (payload.projectId ? Number(payload.projectId) : current.projectId),
    packageId: payload.packageId === null ? null : (payload.packageId ? Number(payload.packageId) : current.packageId),
    supervisorId: payload.supervisorId === null ? null : (payload.supervisorId ? Number(payload.supervisorId) : current.supervisorId),
    allowDuringMaintenance: payload.allowDuringMaintenance !== undefined ? Boolean(payload.allowDuringMaintenance) : current.allowDuringMaintenance,
    mustChangePassword: payload.forcePasswordChange !== undefined ? Boolean(payload.forcePasswordChange) : current.mustChangePassword,
    permissions: payload.permissions || current.permissions || [],
    passwordHash: payload.passwordHash || current.passwordHash,
    status: payload.status || current.status
  };
  const q = `UPDATE users SET
    username=$1, password_hash=$2, name=$3, gas_id=$4, nationality_type=$5, division=$6, job_title=$7, role_id=$8,
    project_id=$9, package_id=$10, supervisor_id=$11, access_scope=$12, status=$13, permissions=$14::jsonb,
    allow_during_maintenance=$15, must_change_password=$16, failed_attempts=$17, is_locked=$18,
    locked_until=$19, last_login_at=$20, last_login_ip=$21, updated_at=NOW()
    WHERE id=$22 RETURNING *`;
  const values = [merged.username, merged.passwordHash, merged.name, String(merged.gasId), merged.nationalityType || null,
    merged.division, merged.jobTitle, Number(merged.roleId), merged.projectId, merged.packageId, merged.supervisorId,
    merged.accessScope, merged.status, JSON.stringify(merged.permissions), Boolean(merged.allowDuringMaintenance), Boolean(merged.mustChangePassword),
    Number(merged.failedAttempts || 0), Boolean(merged.isLocked || merged.status === 'locked'), merged.lockedUntil || null,
    merged.lastLoginAt || null, merged.lastLoginIp || null, Number(userId)];
  const { rows } = await getPool().query(q, values);
  const user = mapUserRow(rows[0]);
  syncUserIntoMemory(user);
  addAuditLog('user_updated', actorName, { userId: user.id, name: user.name, gasId: user.gasId });
  if (payload.passwordHash) addSecurityEvent('password_reset', user.id, { by: actorName });
  if (user.status === 'locked') addSecurityEvent('account_locked_by_admin', user.id, { by: actorName });
  return user;
}

export async function unlockUserRepo(userId, actorName = 'System Owner') {
  return updateUserRepo(userId, { status: 'active', isLocked: false, failedAttempts: 0, lockedUntil: null }, actorName);
}

export async function archiveUserRepo(userId, actorName = 'System') {
  const user = await updateUserRepo(userId, { status: 'archived', isLocked: false, failedAttempts: 0 }, actorName);
  if (user) addSecurityEvent('account_archived', user.id, { by: actorName });
  return user;
}

export async function resetUserPasswordRepo(userId, passwordHash, actorName = 'System Owner') {
  const user = await updateUserRepo(userId, { passwordHash, forcePasswordChange: true }, actorName);
  if (user) addSecurityEvent('password_reset', user.id, { by: actorName });
  return user;
}

export async function transferUserRepo(userId, payload, actorName = 'System') {
  return updateUserRepo(userId, { projectId: payload.projectId, packageId: payload.packageId, division: payload.division, accessScope: payload.accessScope }, actorName);
}

export async function recordFailedLoginRepo(user, ipAddress) {
  if (!user) return null;
  const failedAttempts = Number(user.failedAttempts || 0) + 1;
  const shouldLock = failedAttempts >= 5;
  return updateUserRepo(user.id, { failedAttempts, status: shouldLock ? 'locked' : user.status, isLocked: shouldLock || user.isLocked }, 'System');
}

export async function recordSuccessfulLoginRepo(user, ipAddress) {
  return updateUserRepo(user.id, { failedAttempts: 0, status: 'active', isLocked: false, lastLoginAt: new Date().toISOString(), lastLoginIp: ipAddress }, 'System');
}
