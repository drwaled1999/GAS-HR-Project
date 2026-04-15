import { query } from "./index.js";

function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function mapUserRow(row) {
  if (!row) return null;

  return {
    id: row.id,
    username: row.username,
    passwordHash: row.password_hash,
    name: row.name,
    gasId: row.gas_id,
    nationalityType: row.nationality_type,
    nationality: row.nationality_type,
    division: row.division,
    jobTitle: row.job_title,
    roleId: row.role_id,
    roleName: row.role_name || null,
    roleCode: row.role_code || null,
    projectId: row.project_id,
    packageId: row.package_id,
    supervisorId: row.supervisor_id,
    accessScope: row.access_scope,
    status: row.status,
    permissions: parseJsonArray(row.permissions),
    allowDuringMaintenance: Boolean(row.allow_during_maintenance),
    failedAttempts: Number(row.failed_attempts || 0),
    isLocked: Boolean(row.is_locked),
    lockedUntil: row.locked_until,
    mustChangePassword: Boolean(row.must_change_password),
    lastLoginAt: row.last_login_at,
    lastLoginIp: row.last_login_ip,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapEmployeeRow(row) {
  if (!row) return null;

  return {
    id: row.id,
    gasId: row.gas_id,
    name: row.name,
    nationality: row.nationality,
    projectId: row.project_id,
    packageId: row.package_id,
    userId: row.user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const USER_SELECT_SQL = `
  SELECT
    u.*,
    r.name AS role_name,
    r.code AS role_code
  FROM users u
  LEFT JOIN roles r ON r.id = u.role_id
`;

export async function listUsersRepo() {
  const { rows } = await query(
    `${USER_SELECT_SQL}
     ORDER BY u.created_at DESC NULLS LAST, u.username ASC`
  );

  return rows.map(mapUserRow);
}

export async function listEmployeesRepo() {
  const { rows } = await query(
    `SELECT *
     FROM employees
     ORDER BY created_at DESC NULLS LAST, name ASC`
  );

  return rows.map(mapEmployeeRow);
}

export async function getUserByIdRepo(userId) {
  const { rows } = await query(
    `${USER_SELECT_SQL}
     WHERE u.id = $1
     LIMIT 1`,
    [userId]
  );

  return mapUserRow(rows[0]);
}

export async function getUserByUsernameRepo(username) {
  const { rows } = await query(
    `${USER_SELECT_SQL}
     WHERE u.username = $1
     LIMIT 1`,
    [username]
  );

  return mapUserRow(rows[0]);
}

export async function getEmployeeByGasIdRepo(gasId) {
  const { rows } = await query(
    `SELECT *
     FROM employees
     WHERE gas_id = $1
     LIMIT 1`,
    [String(gasId)]
  );

  return mapEmployeeRow(rows[0]);
}

export async function getScopedEmployeesForUserRepo(user) {
  const all = await listEmployeesRepo();
  if (!user) return [];

  const roleName = String(user.roleName || "").toLowerCase();
  const roleCode = String(user.roleCode || "").toLowerCase();

  const isSystemOwner =
    roleName === "system owner" ||
    roleCode === "system_owner" ||
    roleCode === "system owner";

  if (isSystemOwner) {
    return all;
  }

  let employees = [...all];

  if (user.division === "Saudi Division") {
    employees = employees.filter((e) => e.nationality === "SAUDI");
  } else if (user.division === "Non-Saudi Division") {
    employees = employees.filter((e) => e.nationality !== "SAUDI");
  }

  if (user.accessScope === "Package Only") {
    employees = employees.filter(
      (e) =>
        String(e.projectId) === String(user.projectId) &&
        String(e.packageId) === String(user.packageId)
    );
  } else if (user.accessScope === "Project Only") {
    employees = employees.filter(
      (e) => String(e.projectId) === String(user.projectId)
    );
  }

  return employees;
}

export async function getScopedUsersForUserRepo(user) {
  const all = await listUsersRepo();
  if (!user) return [];

  const roleName = String(user.roleName || "").toLowerCase();
  const roleCode = String(user.roleCode || "").toLowerCase();

  const isSystemOwner =
    roleName === "system owner" ||
    roleCode === "system_owner" ||
    roleCode === "system owner";

  if (isSystemOwner) {
    return all;
  }

  let users = [...all];

  if (user.division === "Saudi Division") {
    users = users.filter((u) => u.division === "Saudi Division");
  } else if (user.division === "Non-Saudi Division") {
    users = users.filter((u) => u.division === "Non-Saudi Division");
  }

  if (user.accessScope === "Package Only") {
    users = users.filter(
      (u) =>
        String(u.projectId) === String(user.projectId) &&
        String(u.packageId) === String(user.packageId)
    );
  } else if (user.accessScope === "Project Only") {
    users = users.filter(
      (u) => String(u.projectId) === String(user.projectId)
    );
  }

  return users;
}

export async function createUserRepo(payload) {
  const sql = `
    INSERT INTO users (
      username,
      password_hash,
      name,
      gas_id,
      nationality_type,
      division,
      job_title,
      role_id,
      project_id,
      package_id,
      supervisor_id,
      access_scope,
      status,
      permissions,
      allow_during_maintenance,
      failed_attempts,
      is_locked,
      locked_until,
      must_change_password,
      last_login_at,
      last_login_ip,
      created_at,
      updated_at
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15,$16,$17,$18,$19,$20,$21,NOW(),NOW()
    )
    RETURNING *
  `;

  const values = [
    payload.username,
    payload.passwordHash,
    payload.name,
    payload.gasId ? String(payload.gasId) : null,
    payload.nationalityType || null,
    payload.division || null,
    payload.jobTitle || null,
    payload.roleId || null,
    payload.projectId || null,
    payload.packageId || null,
    payload.supervisorId || null,
    payload.accessScope || null,
    payload.status || "active",
    JSON.stringify(payload.permissions || []),
    Boolean(payload.allowDuringMaintenance),
    0,
    false,
    null,
    Boolean(payload.forcePasswordChange),
    null,
    null,
  ];

  const { rows } = await query(sql, values);
  return getUserByIdRepo(rows[0].id);
}

export async function updateUserRepo(userId, payload) {
  const current = await getUserByIdRepo(userId);
  if (!current) return null;

  const merged = {
    ...current,
    ...payload,
    permissions:
      payload.permissions !== undefined
        ? payload.permissions
        : current.permissions || [],
    passwordHash: payload.passwordHash || current.passwordHash,
    allowDuringMaintenance:
      payload.allowDuringMaintenance !== undefined
        ? Boolean(payload.allowDuringMaintenance)
        : current.allowDuringMaintenance,
    mustChangePassword:
      payload.forcePasswordChange !== undefined
        ? Boolean(payload.forcePasswordChange)
        : current.mustChangePassword,
    failedAttempts:
      payload.failedAttempts !== undefined
        ? Number(payload.failedAttempts)
        : current.failedAttempts,
    isLocked:
      payload.isLocked !== undefined
        ? Boolean(payload.isLocked)
        : current.isLocked,
    status: payload.status || current.status,
    lockedUntil:
      payload.lockedUntil !== undefined ? payload.lockedUntil : current.lockedUntil,
    lastLoginAt:
      payload.lastLoginAt !== undefined ? payload.lastLoginAt : current.lastLoginAt,
    lastLoginIp:
      payload.lastLoginIp !== undefined ? payload.lastLoginIp : current.lastLoginIp,
  };

  const sql = `
    UPDATE users SET
      username = $1,
      password_hash = $2,
      name = $3,
      gas_id = $4,
      nationality_type = $5,
      division = $6,
      job_title = $7,
      role_id = $8,
      project_id = $9,
      package_id = $10,
      supervisor_id = $11,
      access_scope = $12,
      status = $13,
      permissions = $14::jsonb,
      allow_during_maintenance = $15,
      failed_attempts = $16,
      is_locked = $17,
      locked_until = $18,
      must_change_password = $19,
      last_login_at = $20,
      last_login_ip = $21,
      updated_at = NOW()
    WHERE id = $22
    RETURNING *
  `;

  const values = [
    merged.username,
    merged.passwordHash,
    merged.name,
    merged.gasId ? String(merged.gasId) : null,
    merged.nationalityType || null,
    merged.division || null,
    merged.jobTitle || null,
    merged.roleId || null,
    merged.projectId || null,
    merged.packageId || null,
    merged.supervisorId || null,
    merged.accessScope || null,
    merged.status,
    JSON.stringify(merged.permissions || []),
    Boolean(merged.allowDuringMaintenance),
    Number(merged.failedAttempts || 0),
    Boolean(merged.isLocked),
    merged.lockedUntil || null,
    Boolean(merged.mustChangePassword),
    merged.lastLoginAt || null,
    merged.lastLoginIp || null,
    userId,
  ];

  const { rows } = await query(sql, values);
  return getUserByIdRepo(rows[0].id);
}

export async function unlockUserRepo(userId) {
  return updateUserRepo(userId, {
    status: "active",
    isLocked: false,
    failedAttempts: 0,
    lockedUntil: null,
  });
}

export async function archiveUserRepo(userId) {
  return updateUserRepo(userId, {
    status: "archived",
    isLocked: false,
    failedAttempts: 0,
  });
}

export async function resetUserPasswordRepo(userId, passwordHash) {
  return updateUserRepo(userId, {
    passwordHash,
    forcePasswordChange: true,
  });
}

export async function transferUserRepo(userId, payload) {
  return updateUserRepo(userId, {
    projectId: payload.projectId ?? null,
    packageId: payload.packageId ?? null,
    division: payload.division ?? null,
    accessScope: payload.accessScope ?? null,
  });
}

export async function recordFailedLoginRepo(user, ipAddress) {
  if (!user) return null;

  const failedAttempts = Number(user.failedAttempts || 0) + 1;
  const shouldLock = failedAttempts >= 5;

  return updateUserRepo(user.id, {
    failedAttempts,
    status: shouldLock ? "locked" : user.status,
    isLocked: shouldLock || user.isLocked,
    lockedUntil: shouldLock
      ? new Date(Date.now() + 15 * 60 * 1000).toISOString()
      : null,
    lastLoginIp: ipAddress || null,
  });
}

export async function recordSuccessfulLoginRepo(user, ipAddress) {
  if (!user) return null;

  return updateUserRepo(user.id, {
    failedAttempts: 0,
    status: "active",
    isLocked: false,
    lockedUntil: null,
    lastLoginAt: new Date().toISOString(),
    lastLoginIp: ipAddress || null,
  });
}