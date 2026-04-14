import express from "express";
import jwt from "jsonwebtoken";
import { query } from "../data/index.js";

const router = express.Router();

function getJwtSecret() {
  return process.env.JWT_SECRET || "secret";
}

const PERMISSIONS = {
  DASHBOARD_VIEW: "dashboard.view",
  EMPLOYEES_VIEW: "employees.view",
  EMPLOYEES_EDIT: "employees.edit",
  PROJECTS_VIEW: "projects.view",
  PROJECTS_EDIT: "projects.edit",
  REQUESTS_VIEW: "requests.view",
  REQUESTS_CREATE: "requests.create",
  REQUESTS_APPROVE: "requests.approve",
  PAYROLL_VIEW: "payroll.view",
  REPORTS_VIEW: "reports.view",
  SETTINGS_VIEW: "settings.view",
  ATTENDANCE_VIEW: "attendance.view",
  ATTENDANCE_UPLOAD: "attendance.upload",
  ATTENDANCE_OVERRIDE: "attendance.override",
  ATTENDANCE_APPROVE: "attendance.approve",
  ATTENDANCE_EMPLOYEE_VIEW: "attendance.employee_view",
  USERS_VIEW: "users.view",
  USERS_EDIT: "users.edit",
  USERS_PERMISSIONS_EDIT: "users.permissions.edit",
};

const ROLE_TEMPLATES = {
  system_owner: Object.values(PERMISSIONS),

  hr_manager: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.EMPLOYEES_VIEW,
    PERMISSIONS.EMPLOYEES_EDIT,
    PERMISSIONS.PROJECTS_VIEW,
    PERMISSIONS.PROJECTS_EDIT,
    PERMISSIONS.REQUESTS_VIEW,
    PERMISSIONS.REQUESTS_CREATE,
    PERMISSIONS.REQUESTS_APPROVE,
    PERMISSIONS.PAYROLL_VIEW,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.SETTINGS_VIEW,
    PERMISSIONS.ATTENDANCE_VIEW,
    PERMISSIONS.ATTENDANCE_UPLOAD,
    PERMISSIONS.ATTENDANCE_OVERRIDE,
    PERMISSIONS.ATTENDANCE_APPROVE,
    PERMISSIONS.ATTENDANCE_EMPLOYEE_VIEW,
  ],

  employee: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.REQUESTS_VIEW,
    PERMISSIONS.REQUESTS_CREATE,
    PERMISSIONS.ATTENDANCE_EMPLOYEE_VIEW,
  ],
};

async function getUserCustomPermissions(userId) {
  try {
    const result = await query(
      `
      SELECT permission_code, is_allowed
      FROM user_permissions
      WHERE user_id = $1
      `,
      [userId]
    );

    return result.rows;
  } catch (error) {
    // لو الجدول غير موجود أو ما جهزته للحين، نمشي على صلاحيات الدور فقط
    console.warn("Custom permissions lookup skipped:", error.message);
    return [];
  }
}

async function buildUserPermissions(user) {
  const roleCode = user.role_code || "employee";

  if (roleCode === "system_owner") {
    return ROLE_TEMPLATES.system_owner;
  }

  const basePermissions = ROLE_TEMPLATES[roleCode] || [];
  const customPermissions = await getUserCustomPermissions(user.id);

  const finalPermissions = new Set(basePermissions);

  for (const row of customPermissions) {
    if (row.is_allowed) {
      finalPermissions.add(row.permission_code);
    } else {
      finalPermissions.delete(row.permission_code);
    }
  }

  return Array.from(finalPermissions);
}

function formatUserResponse(user, permissions) {
  return {
    id: user.id,
    username: user.username,
    fullName: user.full_name || "",
    role: user.role_code || "employee",
    roleName: user.role_name || "Employee",
    permissions,
  };
}

router.post("/login", async (req, res) => {
  try {
    const username = String(req.body?.username || "").trim();
    const password = String(req.body?.password || "").trim();

    if (!username || !password) {
      return res.status(400).json({
        message: "Username and password are required",
      });
    }

    const result = await query(
      `
      SELECT
        u.id,
        u.username,
        u.password_hash,
        u.full_name,
        u.is_active,
        r.code AS role_code,
        r.name AS role_name
      FROM users u
      LEFT JOIN roles r ON r.id = u.role_id
      WHERE u.username = $1
      LIMIT 1
      `,
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        message: "User not found",
      });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(403).json({
        message: "This account is inactive",
      });
    }

    const passwordCheck = await query(
      `SELECT crypt($1, $2) = $2 AS matched`,
      [password, user.password_hash]
    );

    const matched = passwordCheck.rows[0]?.matched === true;

    if (!matched) {
      return res.status(401).json({
        message: "Wrong password",
      });
    }

    const permissions = await buildUserPermissions(user);

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role_code || "employee",
        permissions,
      },
      getJwtSecret(),
      { expiresIn: "1d" }
    );

    return res.json({
      message: "Login successful",
      token,
      user: formatUserResponse(user, permissions),
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({
      message: "Login error",
      error: error.message,
    });
  }
});

router.get("/session", async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : "";

    if (!token) {
      return res.status(401).json({
        message: "No token provided",
      });
    }

    const decoded = jwt.verify(token, getJwtSecret());

    const result = await query(
      `
      SELECT
        u.id,
        u.username,
        u.full_name,
        u.is_active,
        r.code AS role_code,
        r.name AS role_name
      FROM users u
      LEFT JOIN roles r ON r.id = u.role_id
      WHERE u.id = $1
      LIMIT 1
      `,
      [decoded.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(403).json({
        message: "This account is inactive",
      });
    }

    const permissions = await buildUserPermissions(user);

    return res.json({
      user: formatUserResponse(user, permissions),
    });
  } catch (error) {
    console.error("Session error:", error);
    return res.status(401).json({
      message: "Invalid or expired token",
    });
  }
});

export default router;
