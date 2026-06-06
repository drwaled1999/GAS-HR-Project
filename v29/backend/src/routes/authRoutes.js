import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { query } from "../data/index.js";

const router = Router();

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body || {};

    if (!username || !password) {
      return res.status(400).json({
        message: "Username and password are required",
      });
    }

    const userResult = await query(
      `
      SELECT
        u.id,
        u.username,
        u.email,
        u.password_hash,
        u.full_name,
        u.name,
        u.role_id,
        u.employee_id,
        u.is_active,
        u.gas_id,
        u.division,
        u.job_title,
        u.project_id,
        u.package_id,
        u.supervisor_id,
        u.access_scope,
        u.status,
        u.permissions,
        u.allow_during_maintenance,
        u.failed_attempts,
        u.is_locked,
        u.locked_until,
        u.must_change_password,
        u.last_login_at,
        u.last_login_ip,
        u.nationality_type,
        r.name AS role_name,
        p.name AS project_name,
        pk.name AS package_name,
        e.project_name AS employee_project_name,
        e.package_name AS employee_package_name
      FROM users u
      LEFT JOIN roles r ON r.id = u.role_id
      LEFT JOIN projects p ON p.id = u.project_id
      LEFT JOIN packages pk ON pk.id = u.package_id
      LEFT JOIN employees e ON e.id = u.employee_id
      WHERE u.username = $1
      LIMIT 1
      `,
      [String(username).trim()]
    );

    const user = userResult.rows[0];

    if (!user) {
      return res.status(401).json({
        message: "Invalid username or password",
      });
    }

    if (user.is_active === false) {
      return res.status(403).json({
        message: "User is inactive",
      });
    }

    if (!user.password_hash) {
      return res.status(500).json({
        message: "User password is not configured",
      });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);

    if (!isValid) {
      return res.status(401).json({
        message: "Invalid username or password",
      });
    }

    const displayName = user.full_name || user.name || user.username;
    const roleName = user.role_name || "Employee";
    const permissions = Array.isArray(user.permissions) ? user.permissions : [];

    const resolvedProjectName =
      user.project_name ||
      user.employee_project_name ||
      null;

    const resolvedPackageName =
      user.package_name ||
      user.employee_package_name ||
      null;

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        name: displayName,
        email: user.email || null,
        role: roleName,
        roleName,
        roleId: user.role_id || null,
        employeeId: user.employee_id || null,
        gasId: user.gas_id || null,
        division: user.division || null,
        jobTitle: user.job_title || null,
        projectId: user.project_id || null,
        packageId: user.package_id || null,
        projectName: resolvedProjectName,
        packageName: resolvedPackageName,
        supervisorId: user.supervisor_id || null,
        accessScope: user.access_scope || null,
        status: user.status || null,
        permissions,
        nationalityType: user.nationality_type || null,
      },
      process.env.JWT_SECRET || "dev-secret",
      { expiresIn: "12h" }
    );

    await query(
      `
      UPDATE users
      SET
        last_login_at = NOW(),
        last_login_ip = $2,
        failed_attempts = 0,
        updated_at = NOW()
      WHERE id = $1
      `,
      [user.id, req.ip || null]
    );

    return res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        name: displayName,
        email: user.email || null,
        role: roleName,
        roleName,
        roleId: user.role_id || null,
        employeeId: user.employee_id || null,
        gasId: user.gas_id || null,
        division: user.division || null,
        jobTitle: user.job_title || null,
        projectId: user.project_id || null,
        packageId: user.package_id || null,
        projectName: resolvedProjectName,
        packageName: resolvedPackageName,
        supervisorId: user.supervisor_id || null,
        accessScope: user.access_scope || null,
        status: user.status || null,
        permissions,
        nationalityType: user.nationality_type || null,
      },
    });
  } catch (error) {
    console.error("Login route error:", error);
    return res.status(500).json({
      message: "Login failed",
    });
  }
});

router.get("/session", async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";

    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    const token = authHeader.slice(7).trim();

    if (!token) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "dev-secret"
    );

    return res.status(200).json({
      user: {
        id: decoded.id,
        username: decoded.username,
        name: decoded.name || decoded.username || "",
        email: decoded.email || null,
        role: decoded.role || "Employee",
        roleName: decoded.roleName || decoded.role || "Employee",
        roleId: decoded.roleId || null,
        employeeId: decoded.employeeId || null,
        gasId: decoded.gasId || null,
        division: decoded.division || null,
        jobTitle: decoded.jobTitle || null,
        projectId: decoded.projectId || null,
        packageId: decoded.packageId || null,
        projectName: decoded.projectName || null,
        packageName: decoded.packageName || null,
        supervisorId: decoded.supervisorId || null,
        accessScope: decoded.accessScope || null,
        status: decoded.status || null,
        permissions: Array.isArray(decoded.permissions) ? decoded.permissions : [],
        nationalityType: decoded.nationalityType || null,
      },
    });
  } catch (error) {
    console.error("Session route error:", error);
    return res.status(401).json({
      message: "Invalid or expired token",
    });
  }
});
router.post("/fcm-token", async (req, res) => {
  try {
    const { userId, token } = req.body || {};

    if (!userId || !token) {
      return res.status(400).json({
        message: "userId and token are required",
      });
    }

    await query(
      `
      INSERT INTO user_fcm_tokens (user_id, token)
      VALUES ($1, $2)
      ON CONFLICT (user_id, token)
      DO NOTHING
      `,
      [userId, token]
    );

    return res.json({
      message: "FCM token saved",
    });
  } catch (error) {
    console.error("Save FCM token error:", error);
    return res.status(500).json({
      message: "Failed to save token",
    });
  }
});

export default router;
