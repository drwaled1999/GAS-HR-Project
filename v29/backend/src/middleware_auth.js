import jwt from "jsonwebtoken";

function extractToken(req) {
  const authHeader = req.headers.authorization || "";

  if (authHeader.startsWith("Bearer ")) {
    const bearerToken = authHeader.slice(7).trim();
    if (bearerToken) return bearerToken;
  }

  const queryToken = String(req.query?.token || "").trim();
  if (queryToken) return queryToken;

  return null;
}

function normalizeString(value, fallback = null) {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function buildUserFromDecoded(decoded) {
  const username = normalizeString(decoded.username, "");
  const name =
    normalizeString(decoded.name) ||
    normalizeString(decoded.full_name) ||
    username ||
    "";

  const role =
    normalizeString(decoded.role) ||
    normalizeString(decoded.roleCode) ||
    "employee";

  const roleCode =
    normalizeString(decoded.roleCode) ||
    normalizeString(decoded.role) ||
    "employee";

  const roleName =
    normalizeString(decoded.roleName) ||
    normalizeString(decoded.role) ||
    "Employee";

  const gasId =
    normalizeString(decoded.gasId) ||
    normalizeString(decoded.gas_id) ||
    null;

  const projectName =
    normalizeString(decoded.projectName) ||
    normalizeString(decoded.project_name) ||
    normalizeString(decoded.project) ||
    null;

  const packageName =
    normalizeString(decoded.packageName) ||
    normalizeString(decoded.package_name) ||
    normalizeString(decoded.package) ||
    null;

  const nationality =
    normalizeString(decoded.nationality) ||
    normalizeString(decoded.nationalityType) ||
    null;

  return {
    id: decoded.id,
    username,
    name,
    full_name: name,
    email: decoded.email || null,

    role,
    roleCode,
    roleName,
    roleId: decoded.roleId || null,

    employeeId: decoded.employeeId || decoded.employee_id || null,

    gasId,
    gas_id: gasId,

    projectId: decoded.projectId || decoded.project_id || null,
    packageId: decoded.packageId || decoded.package_id || null,

    projectName,
    project_name: projectName,
    project: projectName,

    packageName,
    package_name: packageName,
    package: packageName,

    supervisorId: decoded.supervisorId || decoded.supervisor_id || null,
    division: decoded.division || null,
    accessScope: decoded.accessScope || decoded.access_scope || null,
    jobTitle: decoded.jobTitle || decoded.job_title || null,
    status: decoded.status || null,

    nationality,
    nationalityType: nationality,

    permissions: Array.isArray(decoded.permissions) ? decoded.permissions : [],
  };
}

export function requireAuth(req, res, next) {
  try {
    const token = extractToken(req);

    if (!token) {
      return res.status(401).json({
        message: "Unauthorized",
        code: "NO_TOKEN",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || "dev-secret");

    req.user = buildUserFromDecoded(decoded);
    next();
  } catch (error) {
    if (error?.name === "TokenExpiredError") {
      return res.status(401).json({
        message: "Session expired",
        code: "TOKEN_EXPIRED",
        expiredAt: error.expiredAt,
      });
    }

    console.error("Auth middleware error:", error?.message || error);

    return res.status(401).json({
      message: "Invalid token",
      code: "INVALID_TOKEN",
    });
  }
}

export const authenticateToken = requireAuth;

export function enforceMaintenance(_req, _res, next) {
  next();
}

export function requireSystemOwner(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Unauthorized",
        code: "NO_USER",
      });
    }

    const roleName = String(req.user.roleName || req.user.role || "")
      .trim()
      .toLowerCase();

    const roleCode = String(req.user.roleCode || "")
      .trim()
      .toLowerCase();

    const isSystemOwner =
      roleName === "system owner" ||
      roleCode === "system owner" ||
      roleCode === "system_owner" ||
      roleCode === "owner";

    if (!isSystemOwner) {
      return res.status(403).json({
        message: "System Owner access required",
        code: "SYSTEM_OWNER_REQUIRED",
      });
    }

    next();
  } catch (error) {
    console.error("requireSystemOwner error:", error);
    return res.status(500).json({
      message: "Authorization check failed",
      code: "AUTH_CHECK_FAILED",
    });
  }
}
