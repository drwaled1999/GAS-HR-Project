import express from "express";
import bcrypt from "bcryptjs";
import { pool, query } from "../data/index.js";
import { requireAuth } from "../middleware_auth.js";
import {
  unlockUserRepo,
} from "../data/userEmployeeRepository.js";
import { readSecurityPolicy } from "../utils/securityPolicy.js";

const router = express.Router();

router.use(requireAuth);

function normalizeRoleCode(value) {
  const raw = String(value || "").trim().toLowerCase();

  if (["owner", "system owner", "system_owner"].includes(raw)) return "owner";
  if (["hr manager", "hr_manager"].includes(raw)) return "hr_manager";
  if (["hr admin", "hr_admin"].includes(raw)) return "hr_admin";
  if (["hr"].includes(raw)) return "hr";
  if (["admin"].includes(raw)) return "admin";
  if (["admin assistant", "admin_assistant", "admin assist", "admin_assist"].includes(raw)) return "admin_assistant";
  if (["site admin", "site_admin", "site administrator", "site_administrator"].includes(raw)) return "site_admin";
  if (["engineer"].includes(raw)) return "engineer";
  if (["supervisor"].includes(raw)) return "supervisor";
  if (["employee"].includes(raw)) return "employee";
  if (["cm"].includes(raw)) return "cm";
  if (["project manager", "project_manager"].includes(raw)) return "project_manager";

  return "employee";
}

function normalizeStatus(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (["inactive", "disabled", "archived"].includes(raw)) return "inactive";
  return "active";
}

function passwordPolicyError(password, minLength) {
  if (String(password || "").length < minLength) return `Password must be at least ${minLength} characters`;
  if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    return "Password must include uppercase, lowercase, number and special character";
  }
  return null;
}

function sanitizePermissions(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item || "").trim()).filter(Boolean))];
}

async function ensureUserPermissionsTableExists(db = query) {
  await db(`
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";

    CREATE TABLE IF NOT EXISTS user_permissions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      permission_code TEXT NOT NULL,
      is_allowed BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, permission_code)
    );
  `);
}

async function resolveRoleIdByCode(roleCode, db = query) {
  const normalized = normalizeRoleCode(roleCode);

  const roleResult = await db(
    `
    SELECT id
    FROM roles
    WHERE LOWER(code) = $1
       OR LOWER(name) = $2
    LIMIT 1
    `,
    [normalized, normalized.replaceAll("_", " ")]
  );

  return roleResult.rows[0]?.id || null;
}

async function ensureRoleExists(roleCode, db = query) {
  const normalized = normalizeRoleCode(roleCode);

  const existing = await resolveRoleIdByCode(normalized, db);
  if (existing) return existing;

  const roleNameMap = {
    owner: "System Owner",
    hr_manager: "HR Manager",
    hr_admin: "HR Admin",
    hr: "HR",
    admin: "Admin",
    admin_assistant: "Admin Assistant",
    site_admin: "Site Admin",
    engineer: "Engineer",
    supervisor: "Supervisor",
    employee: "Employee",
    cm: "CM",
    project_manager: "Project Manager",
  };

  const inserted = await db(
    `
    INSERT INTO roles (code, name)
    VALUES ($1, $2)
    RETURNING id
    `,
    [normalized, roleNameMap[normalized] || "Employee"]
  );

  return inserted.rows[0]?.id || null;
}

async function savePermissionsForUser(userId, permissions = [], db = query) {
  const cleanPermissions = sanitizePermissions(permissions);

  await ensureUserPermissionsTableExists(db);

  await db(`DELETE FROM user_permissions WHERE user_id = $1`, [userId]);

  for (const permissionCode of cleanPermissions) {
    await db(
      `
      INSERT INTO user_permissions (user_id, permission_code, is_allowed)
      VALUES ($1, $2, true)
      ON CONFLICT (user_id, permission_code)
      DO UPDATE SET is_allowed = true
      `,
      [userId, permissionCode]
    );
  }

  return cleanPermissions;
}

function duplicateAccountError(message, field) {
  const error = new Error(message);
  error.statusCode = 409;
  error.code = "DUPLICATE_ACCOUNT";
  error.field = field;
  return error;
}

async function ensureUniqueUserFields({
  userId = null,
  username,
  email,
  gasId = null,
  employeeId = null,
  db = query,
}) {
  if (username) {
    const usernameCheck = await db(
      `
      SELECT id
      FROM users
      WHERE LOWER(username) = LOWER($1)
        AND ($2::uuid IS NULL OR id <> $2::uuid)
      LIMIT 1
      `,
      [username, userId]
    );

    if (usernameCheck.rows.length > 0) {
      throw duplicateAccountError("Username already exists", "username");
    }
  }

  if (email) {
    const emailCheck = await db(
      `
      SELECT id
      FROM users
      WHERE LOWER(email) = LOWER($1)
        AND ($2::uuid IS NULL OR id <> $2::uuid)
      LIMIT 1
      `,
      [email, userId]
    );

    if (emailCheck.rows.length > 0) {
      throw duplicateAccountError("Email already exists", "email");
    }
  }

  if (gasId) {
    const gasIdCheck = await db(
      `
      SELECT id
      FROM users
      WHERE LOWER(TRIM(COALESCE(gas_id, ''))) = LOWER(TRIM($1))
        AND ($2::uuid IS NULL OR id <> $2::uuid)
      LIMIT 1
      `,
      [gasId, userId]
    );

    if (gasIdCheck.rows.length > 0) {
      throw duplicateAccountError("GAS ID is already linked to another account", "gasId");
    }
  }

  if (employeeId) {
    const employeeCheck = await db(
      `
      SELECT id
      FROM users
      WHERE employee_id::text = $1::text
        AND ($2::uuid IS NULL OR id <> $2::uuid)
      LIMIT 1
      `,
      [employeeId, userId]
    );

    if (employeeCheck.rows.length > 0) {
      throw duplicateAccountError("Employee is already linked to another account", "employeeId");
    }
  }
}

async function canManageUsers(req) {
  if (!req.user?.id) return false;

  const actorResult = await query(
    `SELECT COALESCE(r.code, r.name, 'employee') AS role_code
     FROM users u
     LEFT JOIN roles r ON r.id = u.role_id
     WHERE u.id = $1
       AND COALESCE(u.status, 'active') = 'active'
       AND COALESCE(u.is_active, true) = true
     LIMIT 1`,
    [req.user.id]
  );
  const liveRole = actorResult.rows[0]?.role_code;
  if (!liveRole) return false;

  req.user.roleCode = normalizeRoleCode(liveRole);

  const roleValues = [liveRole]
    .map((value) => String(value || "").trim().toLowerCase())
    .filter(Boolean);

  return roleValues.some((role) =>
    [
      "owner",
      "system owner",
      "system_owner",
      "hr manager",
      "hr_manager",
      "hr admin",
      "hr_admin",
      "hr",
      "admin",
      "admin assistant",
      "admin_assistant",
      "admin assist",
      "admin_assist",
      "site admin",
      "site_admin",
      "site administrator",
      "site_administrator",
    ].includes(role)
  );
}

const ROLE_LEVELS = {
  employee: 10,
  engineer: 20,
  supervisor: 30,
  cm: 40,
  project_manager: 40,
  admin_assistant: 50,
  site_admin: 60,
  hr: 70,
  admin: 80,
  hr_admin: 80,
  hr_manager: 90,
  owner: 100,
};

function currentRoleCode(req) {
  return normalizeRoleCode(req.user?.roleCode || req.user?.role || req.user?.roleName);
}

function isSystemOwner(req) {
  return currentRoleCode(req) === "owner";
}

async function requireUserManagement(req, res, next) {
  try {
    if (!(await canManageUsers(req))) {
      return res.status(403).json({ message: "User management permission required" });
    }
    return next();
  } catch (error) {
    console.error("User management authorization error:", error);
    return res.status(500).json({ message: "Failed to verify user management permission" });
  }
}

async function roleCodeFromId(roleId, db = query) {
  if (!roleId) return null;
  const result = await db(`SELECT code, name FROM roles WHERE id = $1 LIMIT 1`, [roleId]);
  const role = result.rows[0];
  return role ? normalizeRoleCode(role.code || role.name) : null;
}

async function resolveRequestedRole(req, fallbackRoleId = null, db = query) {
  const hasRoleInput =
    req.body.roleCode !== undefined ||
    req.body.role !== undefined ||
    req.body.roleId !== undefined;

  if (!hasRoleInput) {
    if (fallbackRoleId) return fallbackRoleId;
    return (await resolveRoleIdByCode("employee", db)) || (await ensureRoleExists("employee", db));
  }

  let requestedRole = req.body.roleId
    ? await roleCodeFromId(req.body.roleId, db)
    : normalizeRoleCode(req.body.roleCode || req.body.role);

  if (!requestedRole) {
    const error = new Error("Invalid role");
    error.statusCode = 400;
    throw error;
  }

  const actorRole = currentRoleCode(req);
  const actorLevel = ROLE_LEVELS[actorRole] || 0;
  const requestedLevel = ROLE_LEVELS[requestedRole] || 0;

  if (actorRole !== "owner" && (requestedRole === "owner" || requestedLevel > actorLevel)) {
    const error = new Error("You are not authorized to assign this role");
    error.statusCode = 403;
    error.code = "ROLE_ESCALATION_BLOCKED";
    throw error;
  }

  return (await resolveRoleIdByCode(requestedRole, db)) || (await ensureRoleExists(requestedRole, db));
}

async function requireUnprotectedTarget(req, { allowSelf = true, blockOwner = false } = {}) {
  const target = await query(
    `SELECT u.id, LOWER(COALESCE(r.code, r.name, 'employee')) AS role_code
     FROM users u
     LEFT JOIN roles r ON r.id = u.role_id
     WHERE u.id = $1
     LIMIT 1`,
    [req.params.id]
  );
  const user = target.rows[0];
  if (!user) return null;

  if (!allowSelf && String(user.id) === String(req.user?.id)) {
    const error = new Error("You cannot delete your own account");
    error.statusCode = 403;
    error.code = "SELF_DELETE_BLOCKED";
    throw error;
  }

  const targetIsOwner = normalizeRoleCode(user.role_code) === "owner";
  if (targetIsOwner && blockOwner) {
    const error = new Error("System Owner accounts cannot be deleted");
    error.statusCode = 403;
    error.code = "SYSTEM_OWNER_DELETE_BLOCKED";
    throw error;
  }

  if (targetIsOwner && !isSystemOwner(req)) {
    const error = new Error("Only the System Owner can modify a System Owner account");
    error.statusCode = 403;
    error.code = "SYSTEM_OWNER_PROTECTED";
    throw error;
  }

  return user;
}

router.use(requireUserManagement);

async function ensureEmployeeRecord({
  employeeId = null,
  fullName,
  gasId,
  jobTitle,
  nationalityType,
  projectName = null,
  packageName = null,
  packageId = null,
  db = query,
}) {
  const cleanEmployeeId = String(employeeId || "").trim() || null;
  const cleanGasId = String(gasId || "").trim();
  const cleanFullName = String(fullName || "").trim();
  const cleanProjectName = String(projectName || "").trim() || null;
  const cleanPackageName = String(packageName || "").trim() || null;

  if (!cleanGasId && !cleanEmployeeId) return null;

  if (cleanGasId) {
    const existingByGasId = await db(
      `
      SELECT id
      FROM employees
      WHERE gas_id = $1
      LIMIT 1
      `,
      [cleanGasId]
    );

    if (existingByGasId.rows[0]) {
      const foundEmployeeId = existingByGasId.rows[0].id;

      await db(
        `
        UPDATE employees
        SET
          full_name = COALESCE(NULLIF($2, ''), full_name),
          job_title = COALESCE($3, job_title),
          nationality = COALESCE($4, nationality),
          project_name = COALESCE($5, project_name),
          package_name = COALESCE($6, package_name),
          package_id = COALESCE($7, package_id),
          updated_at = NOW()
        WHERE id = $1
        `,
        [
          foundEmployeeId,
          cleanFullName,
          jobTitle || null,
          nationalityType || null,
          cleanProjectName,
          cleanPackageName,
          packageId || null,
        ]
      );

      return foundEmployeeId;
    }
  }

  if (cleanEmployeeId) {
    const existingById = await db(
      `
      SELECT id
      FROM employees
      WHERE id = $1
      LIMIT 1
      `,
      [cleanEmployeeId]
    );

    if (existingById.rows[0]) {
      await db(
        `
        UPDATE employees
        SET
          gas_id = COALESCE(NULLIF($2, ''), gas_id),
          full_name = COALESCE(NULLIF($3, ''), full_name),
          job_title = COALESCE($4, job_title),
          nationality = COALESCE($5, nationality),
          project_name = COALESCE($6, project_name),
          package_name = COALESCE($7, package_name),
          package_id = COALESCE($8, package_id),
          updated_at = NOW()
        WHERE id = $1
        `,
        [
          cleanEmployeeId,
          cleanGasId,
          cleanFullName,
          jobTitle || null,
          nationalityType || null,
          cleanProjectName,
          cleanPackageName,
          packageId || null,
        ]
      );

      return cleanEmployeeId;
    }
  }

  if (!cleanGasId) return null;

  const insertResult = await db(
    `
    INSERT INTO employees (
      gas_id,
      full_name,
      job_title,
      nationality,
      project_name,
      package_name,
      package_id,
      created_at,
      updated_at
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW())
    RETURNING id
    `,
    [
      cleanGasId,
      cleanFullName || cleanGasId,
      jobTitle || null,
      nationalityType || null,
      cleanProjectName,
      cleanPackageName,
      packageId || null,
    ]
  );

  return insertResult.rows[0]?.id || null;
}

async function readFreshUser(userId) {
  await ensureUserPermissionsTableExists();

  const result = await query(
    `
    SELECT
      u.id,
      u.username,
      u.email,
      COALESCE(u.full_name, u.name) AS name,
      u.gas_id AS "gasId",
      u.job_title AS "jobTitle",
      u.status,
      u.nationality_type AS "nationalityType",
      u.employee_id AS "employeeId",
      r.id AS "roleId",
      r.code AS "roleCode",
      r.name AS "role",
      e.project_name AS "projectName",
      e.package_name AS "packageName",
      e.package_id AS "packageId",
      COALESCE(
        (
          SELECT json_agg(up.permission_code ORDER BY up.permission_code)
          FROM user_permissions up
          WHERE up.user_id = u.id
            AND up.is_allowed = true
        ),
        '[]'::json
      ) AS permissions
    FROM users u
    LEFT JOIN roles r ON r.id = u.role_id
    LEFT JOIN employees e ON e.id = u.employee_id
    WHERE u.id = $1
    LIMIT 1
    `,
    [userId]
  );

  return result.rows[0] || null;
}

router.get("/", async (_req, res) => {
  try {
    await ensureUserPermissionsTableExists();

    const result = await query(`
      SELECT
        u.id,
        u.username,
        u.email,
        COALESCE(u.full_name, u.name) AS name,
        u.gas_id AS "gasId",
        u.job_title AS "jobTitle",
        u.status,
        u.nationality_type AS "nationalityType",
        u.employee_id AS "employeeId",
        r.id AS "roleId",
        r.code AS "roleCode",
        r.name AS "role",
        e.project_name AS "projectName",
        e.package_name AS "packageName",
        e.package_id AS "packageId",
        COALESCE(
          (
            SELECT json_agg(up.permission_code ORDER BY up.permission_code)
            FROM user_permissions up
            WHERE up.user_id = u.id
              AND up.is_allowed = true
          ),
          '[]'::json
        ) AS permissions
      FROM users u
      LEFT JOIN roles r ON r.id = u.role_id
      LEFT JOIN employees e ON e.id = u.employee_id
      ORDER BY COALESCE(u.full_name, u.name, u.username) ASC
    `);

    return res.json({
      users: result.rows,
      employees: result.rows,
    });
  } catch (error) {
    console.error("List users error:", error);
    return res.status(500).json({
      message: "Failed to load users",
      error: error.message,
    });
  }
});

/* ✅ NEW: Get employees/users by selected project */
router.get("/by-project/:projectId", async (req, res) => {
  try {
    const { projectId } = req.params;

    const projectResult = await query(
      `
      SELECT id, name
      FROM projects
      WHERE id::text = $1::text
         OR LOWER(TRIM(name)) = LOWER(TRIM($1::text))
      LIMIT 1
      `,
      [projectId]
    );

    const project = projectResult.rows[0];
    const projectName = project?.name || projectId;

    const result = await query(
      `
      SELECT
        u.id,
        u.username,
        u.email,
        COALESCE(u.full_name, u.name, e.full_name, u.username) AS full_name,
        COALESCE(u.full_name, u.name, e.full_name, u.username) AS name,
        COALESCE(u.gas_id, e.gas_id) AS gas_id,
        COALESCE(u.job_title, e.job_title) AS job_title,
        COALESCE(u.nationality_type, e.nationality) AS nationality,
        COALESCE(u.status, 'active') AS status,
        u.employee_id AS employee_id,
        e.project_name AS project_name,
        e.package_name AS package_name,
        e.package_id AS package_id,
        e.created_at AS created_at,
        CASE
          WHEN LENGTH(COALESCE(u.gas_id, e.gas_id, '')::text) > 7 THEN 'Rental'
          ELSE 'GAS'
        END AS employee_type
      FROM users u
      LEFT JOIN employees e ON e.id = u.employee_id
      WHERE COALESCE(u.status, 'active') <> 'archived'
        AND LOWER(TRIM(e.project_name)) = LOWER(TRIM($1::text))
      ORDER BY COALESCE(u.full_name, u.name, e.full_name, u.username) ASC
      `,
      [projectName]
    );

    return res.json({
      total: result.rowCount,
      employees: result.rows,
      project: project || { name: projectName },
    });
  } catch (error) {
    console.error("GET /users/by-project/:projectId error:", error);
    return res.status(500).json({
      message: "Failed to load project employees",
      error: error.message,
    });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const user = await readFreshUser(req.params.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json({ user });
  } catch (error) {
    console.error("Get user error:", error);
    return res.status(500).json({
      message: "Failed to load user",
      error: error.message,
    });
  }
});

router.post("/", async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const username = String(req.body.username || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "").trim();
    const gasId = String(req.body.gasId || "").trim() || null;
    const employeeIdFromBody = String(req.body.employeeId || "").trim() || null;
    const jobTitle = String(req.body.jobTitle || "").trim() || null;
    const nationalityType =
      String(req.body.nationality || req.body.nationalityType || "").trim() || "Saudi";
    const status = normalizeStatus(req.body.status);
    const permissions = sanitizePermissions(req.body.permissions);
    const projectName = String(req.body.projectName || req.body.project || "").trim() || null;
    const packageName = String(req.body.packageName || "").trim() || null;
    const packageId = req.body.packageId || null;

    if (!name) return res.status(400).json({ message: "Full name is required" });
    if (!username) return res.status(400).json({ message: "Username is required" });
    if (!email) return res.status(400).json({ message: "Email is required" });
    if (!password) return res.status(400).json({ message: "Password is required" });
    const passwordPolicy = await readSecurityPolicy();
    const passwordError = passwordPolicyError(password, passwordPolicy.passwordMinLength);
    if (passwordError) return res.status(400).json({ message: passwordError });

    const passwordHash = await bcrypt.hash(password, 10);
    const client = await pool.connect();
    let userId;

    try {
      await client.query("BEGIN");
      const db = (text, params = []) => client.query(text, params);

      await ensureUniqueUserFields({
        username,
        email,
        gasId,
        employeeId: employeeIdFromBody,
        db,
      });

      const roleId = await resolveRequestedRole(req, null, db);

      const employeeId = await ensureEmployeeRecord({
        employeeId: employeeIdFromBody,
        fullName: name,
        gasId,
        jobTitle,
        nationalityType,
        projectName,
        packageName,
        packageId,
        db,
      });

      const insertResult = await db(
        `
        INSERT INTO users (
        full_name,
        name,
        username,
        email,
        password_hash,
        gas_id,
        employee_id,
        job_title,
        status,
        nationality_type,
        role_id,
        is_active,
        created_at,
        updated_at
        )
        VALUES (
        $1, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        CASE WHEN $8 = 'active' THEN true ELSE false END,
        NOW(),
        NOW()
        )
        RETURNING id
        `,
        [
          name,
          username,
          email,
          passwordHash,
          gasId,
          employeeId,
          jobTitle,
          status,
          nationalityType,
          roleId,
        ]
      );

      userId = insertResult.rows[0]?.id;
      await savePermissionsForUser(userId, permissions, db);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    const freshUser = await readFreshUser(userId);

    return res.status(201).json({
      message: "User created successfully",
      user: freshUser,
    });
  } catch (error) {
    console.error("Create user error:", error);
    return res.status(error.statusCode || 500).json({
      message: error.message || "Failed to create user",
      code: error.code,
      field: error.field,
      error: error.message,
    });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const userId = req.params.id;
    await requireUnprotectedTarget(req);

    const existingResult = await query(
      `
      SELECT id, role_id, employee_id, gas_id
      FROM users
      WHERE id = $1
      LIMIT 1
      `,
      [userId]
    );

    const existingUser = existingResult.rows[0];

    if (!existingUser) {
      return res.status(404).json({ message: "User not found" });
    }

    const username =
      req.body.username !== undefined
        ? String(req.body.username || "").trim() || null
        : null;

    const email =
      req.body.email !== undefined
        ? String(req.body.email || "").trim().toLowerCase() || null
        : null;

    const employeeIdFromBody =
      req.body.employeeId !== undefined
        ? String(req.body.employeeId || "").trim() || null
        : existingUser.employee_id || null;

    const gasId =
      req.body.gasId !== undefined
        ? String(req.body.gasId || "").trim() || null
        : existingUser.gas_id || null;

    const projectName =
      req.body.projectName !== undefined || req.body.project !== undefined
        ? String(req.body.projectName || req.body.project || "").trim() || null
        : null;

    const packageName =
      req.body.packageName !== undefined
        ? String(req.body.packageName || "").trim() || null
        : null;

    await ensureUniqueUserFields({
      userId,
      username,
      email,
      gasId,
      employeeId: employeeIdFromBody,
    });

    const resolvedRoleId = await resolveRequestedRole(req, existingUser.role_id);

    const employeeId =
      (await ensureEmployeeRecord({
        employeeId: employeeIdFromBody,
        fullName: req.body.name ?? null,
        gasId,
        jobTitle: req.body.jobTitle ?? null,
        nationalityType: req.body.nationality ?? req.body.nationalityType ?? null,
        projectName,
        packageName,
        packageId: req.body.packageId || null,
      })) ||
      existingUser.employee_id ||
      null;

    let passwordHashSql = "";

    const params = [
      userId,
      req.body.name ?? null,
      username,
      email,
      gasId,
      employeeId,
      req.body.jobTitle ?? null,
      req.body.status ? normalizeStatus(req.body.status) : null,
      req.body.nationality ?? req.body.nationalityType ?? null,
      resolvedRoleId,
    ];

    if (req.body.password && String(req.body.password).trim()) {
      const rawPassword = String(req.body.password);
      const passwordPolicy = await readSecurityPolicy();
      const passwordError = passwordPolicyError(rawPassword, passwordPolicy.passwordMinLength);
      if (passwordError) return res.status(400).json({ message: passwordError });
      const passwordHash = await bcrypt.hash(rawPassword, 10);
      params.push(passwordHash);
      passwordHashSql = `, password_hash = $${params.length}`;
    }

    await query(
      `
      UPDATE users
      SET
        full_name = COALESCE($2, full_name),
        name = COALESCE($2, name),
        username = COALESCE($3, username),
        email = COALESCE($4, email),
        gas_id = COALESCE($5, gas_id),
        employee_id = COALESCE($6, employee_id),
        job_title = COALESCE($7, job_title),
        status = COALESCE($8, status),
        nationality_type = COALESCE($9, nationality_type),
        role_id = COALESCE($10, role_id),
        is_active = CASE
          WHEN COALESCE($8, status) = 'active' THEN true
          WHEN COALESCE($8, status) = 'inactive' THEN false
          ELSE is_active
        END
        ${passwordHashSql},
        updated_at = NOW()
      WHERE id = $1
      `,
      params
    );

    if (Array.isArray(req.body.permissions)) {
      await savePermissionsForUser(userId, req.body.permissions);
    }

    const freshUser = await readFreshUser(userId);

    return res.json({
      message: "User updated successfully",
      user: freshUser,
    });
  } catch (error) {
    console.error("Update user error:", error);
    return res.status(error.statusCode || 500).json({
      message: error.message || "Failed to update user",
      code: error.code,
      field: error.field,
      error: error.message,
    });
  }
});

router.post("/:id/permissions", async (req, res) => {
  try {
    const userId = req.params.id;
    const permissions = sanitizePermissions(req.body.permissions);
    await requireUnprotectedTarget(req);

    const existingUser = await readFreshUser(userId);

    if (!existingUser) {
      return res.status(404).json({ message: "User not found" });
    }

    await savePermissionsForUser(userId, permissions);

    const freshUser = await readFreshUser(userId);

    return res.json({
      message: "Permissions saved successfully",
      user: freshUser,
    });
  } catch (error) {
    console.error("Save permissions error:", error);
    return res.status(error.statusCode || 500).json({
      message: error.message || "Failed to save permissions",
      code: error.code,
      error: error.message,
    });
  }
});

router.post("/:id/unlock", async (req, res) => {
  try {
    await requireUnprotectedTarget(req);
    const updated = await unlockUserRepo(req.params.id);

    if (!updated) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json({
      message: "User unlocked successfully",
      user: updated,
    });
  } catch (error) {
    console.error("Unlock user error:", error);
    return res.status(error.statusCode || 500).json({
      message: error.message || "Failed to unlock user",
      code: error.code,
      error: error.message,
    });
  }
});

router.post("/:id/restore", async (req, res) => {
  try {
    await requireUnprotectedTarget(req);

    const restored = await query(
      `UPDATE users
       SET status = 'active', is_active = true, updated_at = NOW()
       WHERE id = $1 AND COALESCE(status, 'active') = 'archived'
       RETURNING id`,
      [req.params.id]
    );

    if (!restored.rows[0]) {
      return res.status(404).json({ message: "Archived user not found" });
    }

    return res.json({
      message: "User restored successfully",
      user: await readFreshUser(req.params.id),
    });
  } catch (error) {
    console.error("Restore user error:", error);
    return res.status(error.statusCode || 500).json({
      message: error.message || "Failed to restore user",
      code: error.code,
      error: error.message,
    });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await requireUnprotectedTarget(req, { allowSelf: false, blockOwner: true });
    const client = await pool.connect();
    let archivedUserId;

    try {
      await client.query("BEGIN");
      const archived = await client.query(
        `UPDATE users
         SET status = 'archived', is_active = false, is_locked = false,
             failed_attempts = 0, locked_until = NULL, updated_at = NOW()
         WHERE id = $1
         RETURNING id`,
        [req.params.id]
      );
      archivedUserId = archived.rows[0]?.id;

      if (archivedUserId) {
        await client.query(
          `UPDATE security_sessions
           SET revoked_at = NOW(), revoked_by = $2
           WHERE user_id = $1 AND revoked_at IS NULL`,
          [archivedUserId, req.user.id]
        );
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    if (!archivedUserId) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json({
      message: "User archived successfully",
      user: await readFreshUser(archivedUserId),
    });
  } catch (error) {
    console.error("Archive user error:", error);
    return res.status(error.statusCode || 500).json({
      message: error.message || "Failed to archive user",
      code: error.code,
      error: error.message,
    });
  }
});

export default router;
