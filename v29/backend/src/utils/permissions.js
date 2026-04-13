export function requirePermission(permission) {
  return (req, res, next) => {
    try {
      // تحقق من وجود المستخدم
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // تحقق من وجود الصلاحيات
      if (!req.user.permissions || !Array.isArray(req.user.permissions)) {
        return res.status(403).json({ message: "No permissions assigned" });
      }

      // تحقق من الصلاحية
      if (!req.user.permissions.includes(permission)) {
        return res.status(403).json({ message: "Forbidden" });
      }

      next();
    } catch (error) {
      console.error("Permission error:", error);
      return res.status(500).json({ message: "Permission check failed" });
    }
  };
}