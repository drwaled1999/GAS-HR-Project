import jwt from "jsonwebtoken";

function extractToken(req) {
  const authHeader = req.headers.authorization || "";

  if (!authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.slice(7).trim();
  return token || null;
}

export function requireAuth(req, res, next) {
  try {
    const token = extractToken(req);

    if (!token) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "dev-secret"
    );

    req.user = {
      id: decoded.id,
      username: decoded.username,
      name: decoded.name || decoded.username || "",
      email: decoded.email || null,
      role: decoded.role || "employee",
      roleCode: decoded.roleCode || decoded.role || "employee",
      roleName: decoded.roleName || decoded.role || "Employee",
      roleId: decoded.roleId || null,
      employeeId: decoded.employeeId || null,
      gasId: decoded.gasId || null,
      projectId: decoded.projectId || null,
      packageId: decoded.packageId || null,
      supervisorId: decoded.supervisorId || null,
      division: decoded.division || null,
      accessScope: decoded.accessScope || null,
      jobTitle: decoded.jobTitle || null,
      status: decoded.status || null,
      nationalityType: decoded.nationalityType || null,
      permissions: Array.isArray(decoded.permissions) ? decoded.permissions : [],
    };

    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

export const authenticateToken = requireAuth;

export function enforceMaintenance(_req, _res, next) {
  next();
}

export function requireSystemOwner(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const roleName = String(req.user.roleName || req.user.role || "").toLowerCase();
    const roleCode = String(req.user.roleCode || "").toLowerCase();

    const isSystemOwner =
      roleName === "system owner" ||
      roleCode === "system owner" ||
      roleCode === "system_owner";

    if (!isSystemOwner) {
      return res.status(403).json({ message: "System Owner access required" });
    }

    next();
  } catch (error) {
    console.error("requireSystemOwner error:", error);
    return res.status(500).json({ message: "Authorization check failed" });
  }
}
