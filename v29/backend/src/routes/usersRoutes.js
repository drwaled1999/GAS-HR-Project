import express from "express";
import bcrypt from "bcryptjs";
import { query } from "../data/index.js";

const router = express.Router();

// GET all users
router.get("/", async (_req, res) => {
  try {
    const result = await query(
      `
      SELECT
        u.id,
        u.username,
        u.email,
        u.full_name AS name,
        u.is_active,
        u.created_at,
        e.id AS employee_id,
        e.gas_id,
        e.full_name AS employee_name,
        e.nationality,
        e.project_name,
        e.package_name,
        e.job_title,
        e.status AS employee_status,
        r.code AS role_code,
        r.name AS role_name
      FROM users u
      LEFT JOIN employees e ON e.id = u.employee_id
      LEFT JOIN roles r ON r.id = u.role_id
      ORDER BY u.created_at DESC
      `
    );

    const users = result.rows.map((row) => ({
      id: row.id,
      username: row.username,
      email: row.email || "",
      name: row.name || "",
      role: row.role_name || "Employee",
      roleCode: row.role_code || "employee",
      gasId: row.gas_id || "",
      nationality: row.nationality || "",
      projectName: row.project_name || "",
      packageName: row.package_name || "",
      jobTitle: row.job_title || "",
      status: row.is_active ? "active" : "inactive",
      createdAt: row.created_at || null,
    }));

    return res.json({ users });
  } catch (error) {
    console.error("Get users error:", error);
    return res.status(500).json({ message: "Failed to load users." });
  }
});

// GET user by id
router.get("/:id", async (req, res) => {
  try {
    const result = await query(
      `
      SELECT
        u.id,
        u.username,
        u.email,
        u.full_name AS name,
        u.is_active,
        e.id AS employee_id,
        e.gas_id,
        e.full_name AS employee_name,
        e.nationality,
        e.project_name,
        e.package_name,
        e.job_title,
        e.status AS employee_status,
        r.code AS role_code,
        r.name AS role_name
      FROM users u
      LEFT JOIN employees e ON e.id = u.employee_id
      LEFT JOIN roles r ON r.id = u.role_id
      WHERE u.id = $1
      LIMIT 1
      `,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const row = result.rows[0];

    return res.json({
      id: row.id,
      username: row.username,
      email: row.email || "",
      name: row.name || "",
      role: row.role_name || "Employee",
      roleCode: row.role_code || "employee",
      gasId: row.gas_id || "",
      nationality: row.nationality || "",
      projectName: row.project_name || "",
      packageName: row.package_name || "",
      jobTitle: row.job_title || "",
      status: row.is_active ? "active" : "inactive",
    });
  } catch (error) {
    console.error("Get user by id error:", error);
    return res.status(500).json({ message: "Failed to load user." });
  }
});

// CREATE user
router.post("/", async (req, res) => {
  try {
    const {
      name,
      username,
      password,
      email,
      gasId,
      nationality,
      projectName,
      packageName,
      jobTitle,
      roleCode
    } = req.body || {};

    const fullName = String(name || "").trim();
    const resolvedUsername = String(username || "").trim();
    const resolvedPassword = String(password || "").trim();
    const resolvedGasId = String(gasId || "").trim();
    const resolvedRoleCode = String(roleCode || "employee").trim().toLowerCase();

    if (!fullName || !resolvedUsername || !resolvedPassword || !resolvedGasId) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    const existingUser = await query(
      `SELECT id FROM users WHERE username = $1 LIMIT 1`,
      [resolvedUsername]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ message: "Username already exists." });
    }

    let employeeId = null;

    const existingEmployee = await query(
      `SELECT id FROM employees WHERE gas_id = $1 LIMIT 1`,
      [resolvedGasId]
    );

    if (existingEmployee.rows.length > 0) {
      employeeId = existingEmployee.rows[0].id;

      await query(
        `
        UPDATE employees
        SET
          full_name = $1,
          nationality = $2,
          project_name = $3,
          package_name = $4,
          job_title = $5,
          updated_at = NOW()
        WHERE id = $6
        `,
        [
          fullName,
          nationality || null,
          projectName || null,
          packageName || null,
          jobTitle || null,
          employeeId
        ]
      );
    } else {
      const insertedEmployee = await query(
        `
        INSERT INTO employees
          (full_name, gas_id, nationality, project_name, package_name, job_title, status)
        VALUES ($1, $2, $3, $4, $5, $6, 'active')
        RETURNING id
        `,
        [
          fullName,
          resolvedGasId,
          nationality || null,
          projectName || null,
          packageName || null,
          jobTitle || null
        ]
      );

      employeeId = insertedEmployee.rows[0].id;
    }

    const roleResult = await query(
      `SELECT id FROM roles WHERE code = $1 LIMIT 1`,
      [resolvedRoleCode]
    );

    const passwordHash = await bcrypt.hash(resolvedPassword, 10);

    const insertedUser = await query(
      `
      INSERT INTO users
        (username, email, password_hash, full_name, role_id, employee_id, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, TRUE)
      RETURNING id
      `,
      [
        resolvedUsername,
        email || null,
        passwordHash,
        fullName,
        roleResult.rows[0]?.id || null,
        employeeId
      ]
    );

    return res.status(201).json({
      message: "User created successfully.",
      user: {
        id: insertedUser.rows[0].id,
        username: resolvedUsername,
        name: fullName,
        gasId: resolvedGasId
      }
    });
  } catch (error) {
    console.error("Create user error:", error);
    return res.status(500).json({ message: "Failed to create user." });
  }
});

// UPDATE user بالكامل
router.put("/:id", async (req, res) => {
  try {
    const userId = req.params.id;
    const {
      name,
      username,
      email,
      password,
      gasId,
      nationality,
      projectName,
      packageName,
      jobTitle,
      roleCode,
      status
    } = req.body || {};

    const existing = await query(
      `SELECT id, employee_id, username FROM users WHERE id = $1 LIMIT 1`,
      [userId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ message: "User not found." });
    }

    const employeeId = existing.rows[0].employee_id || null;
    const currentUsername = existing.rows[0].username;
    const resolvedUsername = String(username || currentUsername).trim();
    const isActive = String(status || "active").toLowerCase() !== "inactive";

    const duplicateUsername = await query(
      `SELECT id FROM users WHERE username = $1 AND id <> $2 LIMIT 1`,
      [resolvedUsername, userId]
    );

    if (duplicateUsername.rows.length > 0) {
      return res.status(409).json({ message: "Username already exists." });
    }

    let roleId = null;
    if (roleCode) {
      const roleResult = await query(
        `SELECT id FROM roles WHERE code = $1 LIMIT 1`,
        [String(roleCode).trim().toLowerCase()]
      );
      roleId = roleResult.rows[0]?.id || null;
    }

    let passwordHash = null;
    if (String(password || "").trim()) {
      passwordHash = await bcrypt.hash(String(password).trim(), 10);
    }

    await query(
      `
      UPDATE users
      SET
        username = $1,
        full_name = COALESCE($2, full_name),
        email = COALESCE($3, email),
        role_id = COALESCE($4, role_id),
        is_active = $5,
        password_hash = COALESCE($6, password_hash),
        updated_at = NOW()
      WHERE id = $7
      `,
      [
        resolvedUsername,
        name || null,
        email || null,
        roleId,
        isActive,
        passwordHash,
        userId
      ]
    );

    if (employeeId) {
      await query(
        `
        UPDATE employees
        SET
          full_name = COALESCE($1, full_name),
          gas_id = COALESCE($2, gas_id),
          nationality = COALESCE($3, nationality),
          project_name = COALESCE($4, project_name),
          package_name = COALESCE($5, package_name),
          job_title = COALESCE($6, job_title),
          status = $7,
          updated_at = NOW()
        WHERE id = $8
        `,
        [
          name || null,
          gasId || null,
          nationality || null,
          projectName || null,
          packageName || null,
          jobTitle || null,
          isActive ? "active" : "inactive",
          employeeId
        ]
      );
    }

    return res.json({ message: "User updated successfully." });
  } catch (error) {
    console.error("Update user error:", error);
    return res.status(500).json({ message: "Failed to update user." });
  }
});

// DELETE user
router.delete("/:id", async (req, res) => {
  try {
    const userId = req.params.id;

    const existing = await query(
      `SELECT id, employee_id FROM users WHERE id = $1 LIMIT 1`,
      [userId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ message: "User not found." });
    }

    await query(`DELETE FROM users WHERE id = $1`, [userId]);

    return res.json({ message: "User deleted successfully." });
  } catch (error) {
    console.error("Delete user error:", error);
    return res.status(500).json({ message: "Failed to delete user." });
  }
});

export default router;