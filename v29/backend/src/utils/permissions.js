import { query } from "../data/index.js";

export function requirePermission(permissionCode) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const userId = req.user.id;

      const result = await query(
        `
        SELECT is_allowed 
        FROM user_permissions 
        WHERE user_id = $1 AND permission_code = $2
        `,
        [userId, permissionCode]
      );

      // إذا ما فيه صلاحية → مرفوض
      if (result.rows.length === 0) {
        return res.status(403).json({ message: "No permission" });
      }

      // إذا الصلاحية false → مرفوض
      if (!result.rows[0].is_allowed) {
        return res.status(403).json({ message: "Forbidden" });
      }

      next();
    } catch (error) {
      console.error("Permission error:", error);
      return res.status(500).json({ message: "Permission check failed" });
    }
  };
}
