import express from "express";
import bcrypt from "bcryptjs";
import { query } from "../data/index.js";
import { requireAuth } from "../middleware_auth.js";
import {
  listUsersRepo,
  getUserByIdRepo,
  unlockUserRepo,
  archiveUserRepo,
} from "../data/userEmployeeRepository.js";

const router = express.Router();

router.use(requireAuth);

function normalizeRoleCode(value) {
  const raw = String(value || "").trim().toLowerCase();

  if (["owner", "system owner", "system_owner"].includes(raw)) return "owner";
  if (["hr manager", "hr_manager"].includes(raw)) return "hr_manager";
  if (["hr"].includes(raw)) return "hr";
  if (["engineer"].includes(raw)) return "engineer";
  if (["supervisor"].includes(raw)) return "supervisor";
  if (["employee"].includes(raw)) return "employee";
  if (["cm"].includes(raw)) return "cm";
  if (["project manager", "project_manager"].includes(raw)) return "project_manager";

  return "employee";
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
    [
      normalized,
      normalized.replaceAll("_", " "),
    ]
  );

  return roleResult.rows[0]?.id || null;
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
      r.code AS "roleCode",
      r.name AS "role",
      u.project_id AS "projectId",
      u.package_id AS "packageId"
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

// جلب مستخدم واحد
router.get("/:id", async (req, res) => {
  try {
    const user = await getUserByIdRepo(req.params.id);

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

// تحديث بيانات مستخدم
router.put("/:id", async (req, res) => {
  try {
    const userId = req.params.id;

    const existingResult = await query(
      `
      SELECT id, role_id
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

    const roleCode = normalizeRoleCode(req.body.roleCode || req.body.role);
    const resolvedRoleId =
      req.body.roleId || (await resolveRoleIdByCode(roleCode)) || existingUser.role_id;

    let passwordHashSql = "";
    const params = [
      userId,
      req.body.name ?? null,
      req.body.username ?? null,
      req.body.email ?? null,
      req.body.gasId ?? null,
      req.body.jobTitle ?? null,
      req.body.status ?? null,
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
        job_title = COALESCE($6, job_title),
        status = COALESCE($7, status),
        nationality_type = COALESCE($8, nationality_type),
        role_id = COALESCE($9, role_id)
        ${passwordHashSql},
        updated_at = NOW()
      WHERE id = $1
      `,
      params
    );

    const freshUser = await readFreshUser(userId);

    return res.json({
      message: "User updated successfully",
      user: freshUser,
    });
  } catch (error) {
    console.error("Update user error:", error);
    return res.status(500).json({
      message: "Failed to update user",
      error: error.message,
    });
  }
});

// حفظ صلاحيات المستخدم
router.post("/:id/permissions", async (req, res) => {
  try {
    const userId = req.params.id;
    const permissions = Array.isArray(req.body.permissions)
      ? req.body.permissions
      : [];

    await query(`DELETE FROM user_permissions WHERE user_id = $1`, [userId]);

    for (const permissionCode of permissions) {
      await query(
        `
        INSERT INTO user_permissions (user_id, permission_code, is_allowed)
        VALUES ($1, $2, true)
        `,
        [userId, permissionCode]
      );
    }

    const freshUser = await readFreshUser(userId);

    return res.json({
      message: "Permissions saved successfully",
      user: {
        ...freshUser,
        permissions,
      },
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
