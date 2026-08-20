import jwt from "jsonwebtoken";
import { query } from "./data/index.js";

function extractToken(req) {
  const authHeader = req.headers.authorization || "";

  if (authHeader.startsWith("Bearer ")) {
    const bearerToken = authHeader.slice(7).trim();
    if (bearerToken) return bearerToken;
  }

  const queryToken = String(req.query?.token || "").trim();
  if (queryToken) {
    return queryToken;
  }

  return null;
}

function normalizeString(value, fallback = null) {
  const text = String(value ?? "").trim();
  return text || fallback;
}

export async function requireAuth(req, res, next) {
  try {
    const token = extractToken(req);

    if (!token) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "dev-secret"
    );

    if (decoded.sessionId) {
      const session = await query(
        `UPDATE security_sessions SET last_seen_at = NOW()
         WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL AND expires_at > NOW()
         RETURNING id`,
        [decoded.sessionId, decoded.id]
      );
      if (!session.rows[0]) {
        return res.status(401).json({ message: "Session has expired or was revoked" });
      }
    }

    if (decoded.securityActionOnly) {
      const allowed = decoded.securityActionOnly === "password_change"
        ? req.originalUrl.startsWith("/auth/change-required-password")
        : ["/auth/2fa/status", "/auth/2fa/setup", "/auth/2fa/enable"]
            .some((path) => req.originalUrl.startsWith(path));
      if (!allowed) {
        return res.status(403).json({
          message: "Complete the required security setup before accessing the portal",
          securityActionRequired: decoded.securityActionOnly,
        });
      }
    }

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

    req.user = {
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

      permissions: Array.isArray(decoded.permissions)
        ? decoded.permissions
        : [],
      allowDuringMaintenance: Boolean(decoded.allowDuringMaintenance),
      sessionId: decoded.sessionId || null,
      securityActionOnly: decoded.securityActionOnly || null,
      securityPolicy: decoded.securityPolicy || null,
      twoFactorEnabled: Boolean(decoded.twoFactorEnabled),
    };

    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

export const authenticateToken = requireAuth;

export async function enforceMaintenance(req, res, next) {
  try {
    const result = await query(
      `SELECT maintenance_mode,
              COALESCE(to_jsonb(system_settings)->>'maintenance_message', '') AS maintenance_message,
              (to_jsonb(system_settings)->>'maintenance_start_at')::timestamptz AS maintenance_start_at,
              (to_jsonb(system_settings)->>'maintenance_end_at')::timestamptz AS maintenance_end_at,
              COALESCE((SELECT allow_during_maintenance FROM users WHERE id = $1), FALSE)
                AS user_maintenance_access
       FROM system_settings ORDER BY updated_at DESC LIMIT 1`,
      [req.user?.id || null]
    );
    const settings = result.rows[0] || {};
    const now = Date.now();
    const scheduled = settings.maintenance_start_at && settings.maintenance_end_at &&
      now >= new Date(settings.maintenance_start_at).getTime() &&
      now <= new Date(settings.maintenance_end_at).getTime();
    if (!Boolean(settings.maintenance_mode) && !scheduled) return next();

    const roles = [req.user?.role, req.user?.roleName, req.user?.roleCode]
      .map((value) => String(value || "").trim().toLowerCase());
    const isOwner = roles.some((role) =>
      ["owner", "system owner", "system_owner", "systemowner"].includes(role)
    );
    if (isOwner || settings.user_maintenance_access || req.user?.allowDuringMaintenance) return next();

    return res.status(503).json({
      message: settings.maintenance_message || "The system is currently under maintenance. Please try again later.",
      maintenanceMode: true,
      maintenanceEndAt: settings.maintenance_end_at || null,
    });
  } catch (error) {
    // Fail open if the settings table is not ready, so database setup cannot lock the portal.
    if (error?.code === "42P01") return next();
    console.error("Maintenance check error:", error);
    return next();
  }
}

export function requireSystemOwner(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const roleName = String(req.user.roleName || req.user.role || "")
      .trim()
      .toLowerCase();

    const roleCode = String(req.user.roleCode || "")
      .trim()
      .toLowerCase();

    const isSystemOwner =
      roleName === "system owner" ||
      roleName === "system_owner" ||
      roleName === "owner" ||
      roleCode === "system owner" ||
      roleCode === "system_owner" ||
      roleCode === "owner";

    if (!isSystemOwner) {
      return res.status(403).json({ message: "System Owner access required" });
    }

    next();
  } catch (error) {
    console.error("requireSystemOwner error:", error);
    return res.status(500).json({ message: "Authorization check failed" });
  }
}
