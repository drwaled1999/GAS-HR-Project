import { requireAuth } from "../middleware_auth.js";

router.post("/:id/permissions", requireAuth, async (req, res) => {
  try {
    const userId = req.params.id;
    const permissions = req.body.permissions; 
    // مثال: ["attendance.view", "attendance.edit"]

    // حذف القديم
    await query(
      `DELETE FROM user_permissions WHERE user_id = $1`,
      [userId]
    );

    // إدخال الجديد
    for (const perm of permissions) {
      await query(
        `INSERT INTO user_permissions (user_id, permission_code, is_allowed)
         VALUES ($1, $2, true)`,
        [userId, perm]
      );
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to save permissions" });
  }
});
