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
        r.name AS role_name
      FROM users u
      LEFT JOIN roles r ON r.id = u.role_id
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

    const displayName =
      user.full_name ||
      user.name ||
      user.username;

    const roleName =
      user.role_name ||
      "Employee";

    const permissions = Array.isArray(user.permissions)
      ? user.permissions
      : [];

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
  return res.status(200).json({
    ok: true,
    message: "Session endpoint working",
  });
});

export default router;
