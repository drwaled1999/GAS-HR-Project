import express from "express";
import bcrypt from "bcryptjs";
import { query } from "../data/index.js";
import { requireAuth } from "../middleware_auth.js";
import {
  listUsersRepo,
  unlockUserRepo,
  archiveUserRepo,
} from "../data/userEmployeeRepository.js";

const router = express.Router();

router.use(requireAuth);

function normalizeRoleCode(value) {
  const raw = String(value || "").trim().toLowerCase();

  if (["owner", "system owner", "system_owner"].includes(raw)) return "owner";
  if (["hr manager", "hr_manager"].includes(raw)) return "hr_manager";
  if (["hr admin", "hr_admin"].includes(raw)) return "hr_admin";
  if (["hr"].includes(raw)) return "hr";
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

function sanitizePermissions(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item || "").trim()).filter(Boolean))];
}

async function resolveRoleIdByCode(roleCode) {
  const normalized = normalizeRoleCode(roleCode);

  const roleResult = await query(
    `
    SELECT id, code, name
    FROM roles
    WHERE LOWER(code) = $1
       OR LOWER(name) = $2
    LIMIT 1
    `,
    [normalized, normalized.replaceAll("_", " ")]
  );

  return roleResult.rows[0]?.id || null;
}

async function ensureRoleExists(roleCode) {
  const normalized = normalizeRoleCode(roleCode);

  const existing = await query(
    `
    SELECT id, code, name
    FROM roles
    WHERE LOWER(code) = $1
       OR LOWER(name) = $2
    LIMIT 1
    `,
    [normalized, normalized.replaceAll("_", " ")]
  );

  if (existing.rows[0]?.id) {
    return existing.rows[0].id;
  }

  const roleNameMap = {
    owner: "System Owner",
    hr_manager: "HR Manager",
    hr_admin: "HR Admin",
    hr: "HR",
    engineer: "Engineer",
    supervisor: "Supervisor",
    employee: "Employee",
    cm: "CM",
    project_manager: "Project Manager",
  };

  const inserted = await query(
    `
    INSERT INTO roles (code, name)
    VALUES ($1, $2)
    RETURNING id
    `,
    [normalized, roleNameMap[normalized] || "Employee"]
  );

  return inserted.rows[0]?.id || null;
}

async function ensureUserPermissionsTableExists() {
  await query(`
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

async function savePermissionsForUser(userId, permissions = []) {
  const cleanPermissions = sanitizePermissions(permissions);

  await ensureUserPermissionsTableExists();

  await query(`DELETE FROM user_permissions WHERE user_id = $1`, [userId]);

  for (const permissionCode of cleanPermissions) {
    await query(
      `
      INSERT INTO user_permissions (user_id, permission_code, is_allowed)
      VALUES ($1, $2, true)
      ON CONFLICT (user_id, permission_code)
      DO UPDATE SET is_allowed = EXCLUDED.is_allowed
      `,
      [userId, permissionCode]
    );
  }

  return cleanPermissions;
}

async function ensureUniqueUserFields({ userId = null, username, email }) {
  if (username) {
    const usernameCheck = await query(
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
      throw new Error("Username already exists");
    }
  }

  if (email) {
    const emailCheck = await query(
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
      throw new Error("Email already exists");
    }
  }
}

async function canManageUsers(req) {
  const roleValues = [
    req.user?.role,
    req.user?.roleName,
    req.user?.roleCode,
  ]
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
    ].includes(role)
  );
}

async function ensureEmployeeRecord({
  fullName,
  gasId,
  jobTitle,
  nationalityType,
  projectId = null,
  packageId = null,
}) {
  const cleanGasId = String(gasId || "").trim();
  const cleanFullName = String(fullName || "").trim();

  if (!cleanGasId) {
    return null;
  }

  const existingByGasId = await query(
    `
    SELECT id, gas_id, full_name
    FROM employees
    WHERE gas_id = $1
    LIMIT 1
    `,
    [cleanGasId]
  );

  if (existingByGasId.rows[0]) {
    const employeeId = existingByGasId.rows[0].id;

    await query(
      `
      UPDATE employees
      SET
        full_name = COALESCE(NULLIF($2, ''), full_name),
        job_title = COALESCE($3, job_title),
        nationality = COALESCE($4, nationality),
        project_id = COALESCE($5, project_id),
        package_id = COALESCE($6, package_id)
      WHERE id = $1
      `,
      [
        employeeId,
        cleanFullName,
        jobTitle || null,
        nationalityType || null,
        projectId || null,
        packageId || null,
      ]
    );

    return employeeId;
  }

  const insertResult = await query(
    `
    INSERT INTO employees (
      gas_id,
      full_name,
      job_title,
      nationality,
      project_id,
      package_id,
      created_at,
      updated_at
    )
    VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW())
    RETURNING id
    `,
    [
      cleanGasId,
      cleanFullName || cleanGasId,
      jobTitle || null,
      nationalityType || null,
      projectId || null,
      packageId || null,
    ]
  );

  return insertResult.rows[0]?.id || null;
}

async function readFreshUser(userId) {
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
      u.project_id AS "projectId",
      u.package_id AS "packageId",
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
    WHERE u.id = $1
    LIMIT 1
    `,
    [userId]
  );

  return result.rows[0] || null;
}

// جلب كل المستخدمين
router.get("/", async (_req, res) => {
  try {
    const users = await listUsersRepo();

    return res.json({
      users,
      employees: users,
    });
  } catch (error) {
    console.error("List users error:", error);
    return res.status(500).json({
      message: "Failed to load users",
      error: error.message,
    });
  }
});

// جلب مستخدم واحد كامل
router.get("/:id", async (req, res) => {
  try {
    const user = await readFreshUser(req.params.id);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
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

// إنشاء مستخدم جديد + إنشاء/ربط employee تلقائيًا
router.post("/", async (req, res) => {
  try {
    const allowed = await canManageUsers(req);
    if (!allowed) {
      return res.status(403).json({
        message: "You do not have permission to create users",
      });
    }

    const name = String(req.body.name || "").trim();
    const username = String(req.body.username || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "").trim();
    const gasId = String(req.body.gasId || "").trim() || null;
    const jobTitle = String(req.body.jobTitle || "").trim() || null;
    const nationalityType =
      String(req.body.nationality || req.body.nationalityType || "").trim() || "Saudi";
    const status = normalizeStatus(req.body.status);
    const roleCode = normalizeRoleCode(req.body.roleCode || req.body.role);
    const permissions = sanitizePermissions(req.body.permissions);

    if (!name) {
      return res.status(400).json({ message: "Full name is required" });
    }

    if (!username) {
      return res.status(400).json({ message: "Username is required" });
    }

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    if (!password) {
      return res.status(400).json({ message: "Password is required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    await ensureUniqueUserFields({ username, email });

    const roleId = (await resolveRoleIdByCode(roleCode)) || (await ensureRoleExists(roleCode));
    const passwordHash = await bcrypt.hash(password, 10);

    const employeeId = await ensureEmployeeRecord({
      fullName: name,
      gasId,
      jobTitle,
      nationalityType,
      projectId: req.body.projectId || null,
      packageId: req.body.packageId || null,
    });

    const insertResult = await query(
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

    const userId = insertResult.rows[0]?.id;

    if (permissions.length > 0) {
      await savePermissionsForUser(userId, permissions);
    }

    const freshUser = await readFreshUser(userId);

    return res.status(201).json({
      message: "User created successfully",
      user: freshUser,
    });
  } catch (error) {
    console.error("Create user error:", error);
    return res.status(500).json({
      message: error.message || "Failed to create user",
      error: error.message,
    });
  }
});

// تحديث بيانات مستخدم + مزامنة employee تلقائيًا
router.put("/:id", async (req, res) => {
  try {
    const userId = req.params.id;

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
      return res.status(404).json({
        message: "User not found",
      });
    }

    const username = req.body.username ? String(req.body.username).trim() : null;
    const email = req.body.email ? String(req.body.email).trim().toLowerCase() : null;
    const gasId =
      req.body.gasId !== undefined
        ? String(req.body.gasId || "").trim() || null
        : existingUser.gas_id || null;

    await ensureUniqueUserFields({
      userId,
      username,
      email,
    });

    const roleCode = normalizeRoleCode(req.body.roleCode || req.body.role);
    const resolvedRoleId =
      req.body.roleId || (await resolveRoleIdByCode(roleCode)) || existingUser.role_id;

    const employeeId =
      (await ensureEmployeeRecord({
        fullName: req.body.name ?? null,
        gasId,
        jobTitle: req.body.jobTitle ?? null,
        nationalityType: req.body.nationality ?? req.body.nationalityType ?? null,
        projectId: req.body.projectId || null,
        packageId: req.body.packageId || null,
      })) || existingUser.employee_id || null;

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
      const passwordHash = await bcrypt.hash(String(req.body.password), 10);
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
    return res.status(500).json({
      message: error.message || "Failed to update user",
      error: error.message,
    });
  }
});

// حفظ صلاحيات المستخدم
router.post("/:id/permissions", async (req, res) => {
  try {
    const userId = req.params.id;
    const permissions = sanitizePermissions(req.body.permissions);

    const existingUser = await readFreshUser(userId);
    if (!existingUser) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    await savePermissionsForUser(userId, permissions);

    const freshUser = await readFreshUser(userId);

    return res.json({
      message: "Permissions saved successfully",
      user: freshUser,
    });
  } catch (error) {
    console.error("Save permissions error:", error);
    return res.status(500).json({
      message: "Failed to save permissions",
      error: error.message,
    });
  }
});

// فك قفل مستخدم
router.post("/:id/unlock", async (req, res) => {
  try {
    const updated = await unlockUserRepo(req.params.id);

    if (!updated) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    return res.json({
      message: "User unlocked successfully",
      user: updated,
    });
  } catch (error) {
    console.error("Unlock user error:", error);
    return res.status(500).json({
      message: "Failed to unlock user",
      error: error.message,
    });
  }
});

// أرشفة مستخدم
router.delete("/:id", async (req, res) => {
  try {
    const updated = await archiveUserRepo(req.params.id);

    if (!updated) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    return res.json({
      message: "User archived successfully",
      user: updated,
    });
  } catch (error) {
    console.error("Archive user error:", error);
    return res.status(500).json({
      message: "Failed to archive user",
      error: error.message,
    });
  }
});

export default router;
