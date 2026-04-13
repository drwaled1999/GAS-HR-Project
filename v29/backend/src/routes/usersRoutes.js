import express from "express";
import bcrypt from "bcryptjs";
import { query } from "../data/index.js";
import { requireAuth } from "../middleware_auth.js";

const router = express.Router();

router.post("/", requireAuth, async (req, res) => {
  try {
    const {
      name: fullName,
      username,
      password,
      gasId,
      jobTitle,
      nationalityType: nationality,
      roleId: roleCode,
      status
    } = req.body || {};

    if (!fullName || !username || !password || !gasId) {
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
    } else {
      const employeeInsert = await query(
        `INSERT INTO employees
          (full_name, gas_id, nationality, job_title, status)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [
          fullName,
          gasId,
          nationality || null,
          jobTitle || null,
          status || "active"
        ]
      );

      employeeId = employeeInsert.rows[0].id;
    }

    const roleResult = await query(
      `SELECT id FROM roles WHERE code = $1 LIMIT 1`,
      [roleCode || "employee"]
    );

    const passwordHash = await bcrypt.hash(password, 10);

    await query(
      `INSERT INTO users
        (username, password_hash, full_name, role_id, employee_id, is_active)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        username,
        passwordHash,
        fullName,
        roleResult.rows[0]?.id || null,
        employeeId,
        String(status || "").toLowerCase() !== "inactive"
      ]
    );

    return res.json({ ok: true, message: "User created successfully." });
  } catch (error) {
    console.error("Create user error:", error);
    return res.status(500).json({ message: "Failed to create user." });
  }
});

export default router;
