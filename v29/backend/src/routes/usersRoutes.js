import express from "express";
import bcrypt from "bcryptjs";
import { query } from "../data/index.js";
import { requireAuth } from "../middleware_auth.js";

const router = express.Router();

router.get("/", requireAuth, async (_req, res) => {
  try {
    const result = await query(
      `
      SELECT
        u.id,
        u.username,
        u.full_name AS name,
        u.is_active,
        e.gas_id,
        e.nationality,
        e.job_title,
        COALESCE(e.status, CASE WHEN u.is_active = true THEN 'active' ELSE 'inactive' END) AS status,
        e.project_name,
        e.package_name,
        r.name AS role,
        r.code AS role_code
      FROM users u
      LEFT JOIN employees e ON e.id = u.employee_id
      LEFT JOIN roles r ON r.id = u.role_id
      ORDER BY u.id DESC
      `
    );

    const users = result.rows.map((row) => ({
      id: row.id,
      username: row.username,
      name: row.name || "",
      gasId: row.gas_id || "",
      nationalityType: row.nationality || "",
      jobTitle: row.job_title || "",
      role: row.role || "Employee",
      roleCode: row.role_code || "employee",
      division: row.nationality === "SAUDI" ? "Saudi Division" : "General",
      projectName: row.project_name || "",
      packageName: row.package_name || "",
      status: row.status || "active"
    }));

    return res.json({ users });
  } catch (error) {
    console.error("Get users error:", error);
    return res.status(500).json({ message: "Failed to load users." });
  }
});

router.post("/", requireAuth, async (req, res) => {
  try {
    const {
      fullName,
      name,
      username,
      password,
      gasId,
      jobTitle,
      nationality,
      nationalityType,
      roleCode,
      roleId,
      status
    } = req.body || {};

    const resolvedFullName = fullName || name;
    const resolvedNationality = nationality || nationalityType || null;
    const resolvedRoleCode = roleCode || roleId || "employee";
    const resolvedStatus = status || "active";

    if (!resolvedFullName || !username || !password || !gasId) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    const userExists = await query(
      `SELECT id FROM users WHERE username = $1 LIMIT 1`,
      [username]
    );

    if (userExists.rows.length > 0) {
      return res.status(409).json({ message: "Username already exists." });
    }

    const employeeExists = await query(
      `SELECT id FROM employees WHERE gas_id = $1 LIMIT 1`,
      [gasId]
    );

    let employeeId = null;

    if (employeeExists.rows.length > 0) {
      employeeId = employeeExists.rows[0].id;

      await query(
        `
        UPDATE employees
        SET
          full_name = $1,
          nationality = $2,
          job_title = $3,
          status = $4
        WHERE id = $5
        `,
        [
          resolvedFullName,
          resolvedNationality,
          jobTitle || null,
          resolvedStatus,
          employeeId
        ]
      );
    } else {
      const employeeInsert = await query(
        `
        INSERT INTO employees
          (full_name, gas_id, nationality, job_title, status)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
        `,
        [
          resolvedFullName,
          gasId,
          resolvedNationality,
          jobTitle || null,
          resolvedStatus
        ]
      );

      employeeId = employeeInsert.rows[0].id;
    }

    const roleResult = await query(
      `SELECT id, name, code FROM roles WHERE code = $1 LIMIT 1`,
      [resolvedRoleCode]
    );

    const passwordHash = await bcrypt.hash(password, 10);

    const userInsert = await query(
      `
      INSERT INTO users
        (username, password_hash, full_name, role_id, employee_id, is_active)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, username, full_name, is_active
      `,
      [
        username,
        passwordHash,
        resolvedFullName,
        roleResult.rows[0]?.id || null,
        employeeId,
        String(resolvedStatus).toLowerCase() !== "inactive"
      ]
    );

    return res.json({
      ok: true,
      message: "User created successfully.",
      user: {
        id: userInsert.rows[0].id,
        username: userInsert.rows[0].username,
        name: userInsert.rows[0].full_name,
        gasId,
        nationalityType: resolvedNationality,
        jobTitle: jobTitle || "",
        role: roleResult.rows[0]?.name || "Employee",
        roleCode: roleResult.rows[0]?.code || "employee",
        division: resolvedNationality === "SAUDI" ? "Saudi Division" : "General",
        projectName: "",
        packageName: "",
        status: resolvedStatus
      }
    });
  } catch (error) {
    console.error("Create user error:", error);
    return res.status(500).json({ message: "Failed to create user." });
  }
});

export default router;