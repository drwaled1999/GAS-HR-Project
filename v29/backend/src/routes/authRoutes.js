import bcrypt from "bcrypt";
import { query } from "../data/index.js";

// 🔥 إنشاء ادمن أول مرة
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