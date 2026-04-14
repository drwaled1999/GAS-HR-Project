import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { query } from "../data/index.js";

const router = express.Router();

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    const userRes = await query(
      "SELECT * FROM users WHERE username = $1",
      [username]
    );

    if (userRes.rows.length === 0) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const user = userRes.rows[0];

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // 🔥 جلب الصلاحيات من DB
    const permissionsRes = await query(
      `
      SELECT permission_code 
      FROM user_permissions 
      WHERE user_id = $1 AND is_allowed = true
      `,
      [user.id]
    );

    const permissions = permissionsRes.rows.map(
      (p) => p.permission_code
    );

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role_id,
        permissions,
      },
      process.env.JWT_SECRET || "dev-secret",
      { expiresIn: "7d" }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        permissions,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Login failed" });
  }
});

export default router;
