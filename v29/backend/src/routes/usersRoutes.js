import express from "express";
import { query } from "../data/index.js";
import { requireAuth } from "../middleware_auth.js";

const router = express.Router();

router.post("/:id/permissions", requireAuth, async (req, res) => {
  try {
    const userId = req.params.id;
    const permissions = Array.isArray(req.body.permissions)
      ? req.body.permissions
      : [];

    await query(
      `DELETE FROM user_permissions WHERE user_id = $1`,
      [userId]
    );

    for (const permissionCode of permissions) {
      await query(
        `
        INSERT INTO user_permissions (user_id, permission_code, is_allowed)
        VALUES ($1, $2, true)
        `,
        [userId, permissionCode]
      );
    }

    return res.json({
      message: "Permissions saved successfully",
    });
  } catch (error) {
    console.error("Save permissions error:", error);
    return res.status(500).json({
      message: "Failed to save permissions",
      error: error.message,
    });
  }
});

export default router;