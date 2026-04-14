import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { query } from "../data/index.js";

const router = express.Router();

// تسجيل الدخول
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    const result = await query(
      "SELECT * FROM users WHERE username = $1",
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: "User not found" });
    }

    const user = result.rows[0];

    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(401).json({ message: "Wrong password" });
    }

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role_id: user.role_id,
      },
      process.env.JWT_SECRET || "secret",
      { expiresIn: "1d" }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role_id: user.role_id,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Login error" });
  }
});

export default router;