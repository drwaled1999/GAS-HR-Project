export function requirePermission(permission) {
  return (req, res, next) => {
    try {
      console.log("=== Permission Check ===");
      console.log("Requested permission:", permission);
      console.log("User:", req.user);
      console.log("User permissions:", req.user?.permissions);

      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      if (!req.user.permissions || !Array.isArray(req.user.permissions)) {
        return res.status(403).json({ message: "No permissions assigned" });
      }

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
