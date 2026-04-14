import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { query } from "../data/index.js";

const router = express.Router();

function getJwtSecret() {
  return process.env.JWT_SECRET || "secret";
}

// POST /auth/login
router.post("/login", async (req, res) => {
  try {
    const username = String(req.body?.username || "").trim();
    const password = String(req.body?.password || "").trim();

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

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        message: "User not found",
      });
    }

    const user = userResult.rows[0];

    if (!user.is_active) {
      return res.status(403).json({
        message: "This account is inactive",
      });
    }

    const passwordOk = await bcrypt.compare(password, user.password_hash);

    if (!passwordOk) {
      return res.status(401).json({
        message: "Wrong password",
      });
    }

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role_code || "employee",
      },
      getJwtSecret(),
      { expiresIn: "1d" }
    );

    return res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.full_name || "",
        role: user.role_code || "employee",
        roleName: user.role_name || "Employee",
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({
      message: "Login error",
    });
  }
});

// GET /auth/session
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

    const userResult = await query(
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

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const user = userResult.rows[0];

    if (!user.is_active) {
      return res.status(403).json({
        message: "This account is inactive",
      });
    }

    return res.json({
      user: {
        id: user.id,
        username: user.username,
        fullName: user.full_name || "",
        role: user.role_code || "employee",
        roleName: user.role_name || "Employee",
      },
    });
  } catch (error) {
    console.error("Session error:", error);
    return res.status(401).json({
      message: "Invalid or expired token",
    });
  }
});

export default router;