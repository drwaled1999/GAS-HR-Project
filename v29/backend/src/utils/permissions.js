import { query } from "../data/index.js";

function normalizeRole(value) {
  return String(value || "").trim().toLowerCase();
}

function isElevatedRole(req) {
  const roleValues = [
    req.user?.role,
    req.user?.roleName,
    req.user?.roleCode,
  ].map(normalizeRole);

  return roleValues.some((role) =>
    [
      "owner",
      "system owner",
      "system_owner",
      "hr manager",
      "hr_manager",
      "hr",
    ].includes(role)
  );
}

export function requirePermission(permissionCode) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      if (isElevatedRole(req)) {
        return next();
      }

      const userId = req.user.id;

      const result = await query(
        `
        SELECT is_allowed
        FROM user_permissions
        WHERE user_id = $1 AND permission_code = $2
        LIMIT 1
        `,
        [userId, permissionCode]
      );

      if (result.rows.length === 0) {
        return res.status(403).json({ message: "No permission" });
      }

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
