import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { query } from "../data/index.js";

const router = express.Router();

router.post("/setup-admin", async (req, res) => {
  try {
    const existing = await query(
      `SELECT id FROM users WHERE username = 'owner' LIMIT 1`
    );

    if (existing.rows.length > 0) {
      return res.json({ message: "Admin already exists" });
    }

    const roleRes = await query(
      `SELECT id FROM roles WHERE code = 'owner' LIMIT 1`
    );

    if (!roleRes.rows[0]) {
      return res.status(500).json({ message: "Role 'owner' not found" });
    }

    const passwordHash = await bcrypt.hash("owner123", 10);

    await query(
      `INSERT INTO users (id, username, email, password_hash, full_name, role_id, is_active)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, TRUE)`,
      [
        "owner",
        "owner@example.com",
        passwordHash,
        "Waleed",
        roleRes.rows[0].id
      ]
    );

    return res.json({
      ok: true,
      message: "Admin created successfully",
      login: {
        username: "owner",
        password: "owner123"
      }
    });
  } catch (error) {
    console.error("Setup admin error:", error);
    return res.status(500).json({ message: "Failed to create admin" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body || {};

    if (!username || !password) {
      return res.status(400).json({ message: "Username and password are required." });
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

    const user = result.rows[0];

    if (!user || !user.is_active) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    const accessToken = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role_name || "Employee",
        roleCode: user.role_code || "employee",
        permissions: []
      },
      process.env.JWT_SECRET || "dev-secret",
      { expiresIn: "7d" }
    );

    return res.json({
      accessToken,
      user: {
        id: user.id,
        username: user.username,
        name: user.full_name,
        role: user.role_name || "Employee",
        roleCode: user.role_code || "employee",
        permissions: []
      }
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ message: "Login failed." });
  }
});

export default router;