import { Router } from "express";
import { query } from "../data/index.js";
import {
  authenticateToken,
  enforceMaintenance,
  requireSystemOwner,
} from "../middleware_auth.js";
import {
  listLoginAttemptsRepo,
  listSecurityEventsRepo,
  listAuditLogsRepo,
  getSecurityCountsRepo,
  addAuditLogRepo,
  addSecurityEventRepo,
  listActiveSessionsRepo,
  revokeSecuritySessionRepo,
  listTwoFactorStatusRepo,
  listSecurityAlertsRepo,
  revokeAllUserSessionsRepo,
  getSecurityAnalyticsRepo,
} from "../data/securityRepository.js";
import {
  listUsersRepo,
  unlockUserRepo,
} from "../data/userEmployeeRepository.js";
import { ensureSecurityPolicyColumns, readSecurityPolicy } from "../utils/securityPolicy.js";

const router = Router();

router.use(authenticateToken, enforceMaintenance, requireSystemOwner);

function safeLimit(value, fallback = 40) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(100, Math.max(1, parsed));
}

router.get("/summary", async (_req, res) => {
  try {
    const counts = await getSecurityCountsRepo();
    return res.json(counts);
  } catch (error) {
    console.error("Security summary error:", error);
    return res.status(500).json({
      message: "Failed to load security summary",
      error: error.message,
    });
  }
});

router.get("/login-attempts", async (req, res) => {
  try {
    const limit = safeLimit(req.query.limit);
    const items = await listLoginAttemptsRepo(limit);
    return res.json({ items });
  } catch (error) {
    console.error("Login attempts error:", error);
    return res.status(500).json({
      message: "Failed to load login attempts",
      error: error.message,
    });
  }
});

router.get("/events", async (req, res) => {
  try {
    const limit = safeLimit(req.query.limit);
    const items = await listSecurityEventsRepo(limit);
    return res.json({ items });
  } catch (error) {
    console.error("Security events error:", error);
    return res.status(500).json({
      message: "Failed to load security events",
      error: error.message,
    });
  }
});

router.get("/audit-logs", async (req, res) => {
  try {
    const limit = safeLimit(req.query.limit);
    const items = await listAuditLogsRepo(limit);
    return res.json({ items });
  } catch (error) {
    console.error("Audit logs error:", error);
    return res.status(500).json({
      message: "Failed to load audit logs",
      error: error.message,
    });
  }
});

router.get("/locked-users", async (_req, res) => {
  try {
    const users = await listUsersRepo();

    const lockedUsers = users.filter(
      (user) =>
        user.status === "locked" ||
        user.isLocked === true ||
        (user.lockedUntil && new Date(user.lockedUntil) > new Date())
    );

    return res.json({ users: lockedUsers });
  } catch (error) {
    console.error("Locked users error:", error);
    return res.status(500).json({
      message: "Failed to load locked users",
      error: error.message,
    });
  }
});

router.get("/sessions", async (req, res) => {
  try {
    const items = await listActiveSessionsRepo(safeLimit(req.query.limit, 100));
    return res.json({ items: items.map((item) => ({
      ...item, isCurrent: item.id === req.user?.sessionId,
    })) });
  } catch (error) {
    console.error("Security sessions error:", error);
    return res.status(500).json({ message: "Failed to load active sessions", error: error.message });
  }
});

router.get("/analytics", async (req, res) => {
  try {
    const days = [7, 30, 90].includes(Number(req.query.days)) ? Number(req.query.days) : 30;
    return res.json(await getSecurityAnalyticsRepo(days));
  } catch (error) {
    console.error("Security analytics error:", error);
    return res.status(500).json({ message: "Failed to load security analytics", error: error.message });
  }
});

router.post("/sessions/:id/revoke", async (req, res) => {
  try {
    if (req.params.id === req.user?.sessionId) {
      return res.status(400).json({ message: "Use Logout to close your current session" });
    }
    const revoked = await revokeSecuritySessionRepo(req.params.id, req.user?.id);
    if (!revoked) return res.status(404).json({ message: "Active session not found" });
    const actor = req.user?.name || req.user?.username || "System Owner";
    await Promise.allSettled([
      addAuditLogRepo("security_session_revoked", actor, { sessionId: req.params.id, userId: revoked.user_id }),
      addSecurityEventRepo("session_revoked", revoked.user_id, { revokedBy: actor }, req.ip || "-"),
    ]);
    return res.json({ message: "Session revoked successfully" });
  } catch (error) {
    console.error("Revoke session error:", error);
    return res.status(500).json({ message: "Failed to revoke session", error: error.message });
  }
});

router.post("/sessions/user/:userId/revoke-all", async (req, res) => {
  try {
    const isSelf = req.params.userId === req.user?.id;
    const count = await revokeAllUserSessionsRepo(
      req.params.userId,
      req.user?.id,
      isSelf ? req.user?.sessionId : null
    );
    const actor = req.user?.name || req.user?.username || "System Owner";
    await Promise.allSettled([
      addAuditLogRepo("security_all_sessions_revoked", actor, { userId: req.params.userId, count }),
      addSecurityEventRepo("all_sessions_revoked", req.params.userId, { revokedBy: actor, count }, req.ip || "-"),
    ]);
    return res.json({ message: "User sessions revoked successfully", count });
  } catch (error) {
    console.error("Revoke all sessions error:", error);
    return res.status(500).json({ message: "Failed to revoke user sessions", error: error.message });
  }
});

router.get("/two-factor-status", async (req, res) => {
  try {
    return res.json({ items: await listTwoFactorStatusRepo(safeLimit(req.query.limit, 100)) });
  } catch (error) {
    console.error("Two-factor security status error:", error);
    return res.status(500).json({ message: "Failed to load two-factor status", error: error.message });
  }
});

router.get("/alerts", async (_req, res) => {
  try {
    return res.json({ items: await listSecurityAlertsRepo() });
  } catch (error) {
    console.error("Security alerts error:", error);
    return res.status(500).json({ message: "Failed to load security alerts", error: error.message });
  }
});

router.get("/policy", async (_req, res) => {
  try {
    await ensureSecurityPolicyColumns();
    const [policy, roles] = await Promise.all([
      readSecurityPolicy(),
      query(`SELECT code, name FROM roles ORDER BY name ASC`),
    ]);
    return res.json({ policy, roles: roles.rows });
  } catch (error) {
    console.error("Security policy load error:", error);
    return res.status(500).json({ message: "Failed to load security policy", error: error.message });
  }
});

router.post("/policy", async (req, res) => {
  try {
    await ensureSecurityPolicyColumns();
    const numbers = {
      maxFailedAttempts: Math.min(20, Math.max(3, Number(req.body.maxFailedAttempts) || 5)),
      lockMinutes: Math.min(1440, Math.max(1, Number(req.body.lockMinutes) || 15)),
      inactivityMinutes: Math.min(240, Math.max(5, Number(req.body.inactivityMinutes) || 15)),
      sessionHours: Math.min(168, Math.max(1, Number(req.body.sessionHours) || 12)),
      passwordMinLength: Math.min(32, Math.max(8, Number(req.body.passwordMinLength) || 8)),
    };
    const rolesResult = await query(`SELECT LOWER(code) AS code FROM roles`);
    const allowedRoles = new Set(rolesResult.rows.map((row) => row.code));
    const requiredRoles = [...new Set((Array.isArray(req.body.requiredTwoFactorRoles)
      ? req.body.requiredTwoFactorRoles : []).map((value) => String(value).trim().toLowerCase())
      .filter((value) => allowedRoles.has(value)))];
    const actor = req.user?.name || req.user?.username || "System Owner";
    await query(
      `UPDATE system_settings SET security_max_failed_attempts=$1,
       security_lock_minutes=$2, security_inactivity_minutes=$3,
       security_session_hours=$4, security_password_min_length=$5,
       security_required_2fa_roles=$6::jsonb, updated_by=$7, updated_at=NOW()
       WHERE id=(SELECT id FROM system_settings ORDER BY updated_at DESC LIMIT 1)`,
      [numbers.maxFailedAttempts, numbers.lockMinutes, numbers.inactivityMinutes,
       numbers.sessionHours, numbers.passwordMinLength, JSON.stringify(requiredRoles), actor]
    );
    await addAuditLogRepo("security_policy_changed", actor, { ...numbers, requiredTwoFactorRoles: requiredRoles });
    return res.json({ policy: await readSecurityPolicy() });
  } catch (error) {
    console.error("Security policy update error:", error);
    return res.status(500).json({ message: "Failed to save security policy", error: error.message });
  }
});

router.post("/users/:id/lock", async (req, res) => {
  try {
    if (req.params.id === req.user?.id) return res.status(400).json({ message: "You cannot lock your own account" });
    const { rows } = await query(
      `UPDATE users SET status='locked', is_locked=TRUE, locked_until=NULL, updated_at=NOW()
       WHERE id=$1 RETURNING id, username`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ message: "User not found" });
    const count = await revokeAllUserSessionsRepo(req.params.id, req.user?.id);
    const actor = req.user?.name || req.user?.username || "System Owner";
    await Promise.allSettled([
      addAuditLogRepo("security_user_locked", actor, { userId: rows[0].id, username: rows[0].username, sessionsRevoked: count }),
      addSecurityEventRepo("account_locked_by_owner", rows[0].id, { lockedBy: actor }, req.ip || "-"),
    ]);
    return res.json({ message: "User locked successfully", user: rows[0] });
  } catch (error) {
    console.error("Manual user lock error:", error);
    return res.status(500).json({ message: "Failed to lock user", error: error.message });
  }
});

router.post("/users/:id/force-password-change", async (req, res) => {
  try {
    if (req.params.id === req.user?.id) return res.status(400).json({ message: "Use your profile to change your own password" });
    const { rows } = await query(
      `UPDATE users SET must_change_password=TRUE, updated_at=NOW()
       WHERE id=$1 RETURNING id, username`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ message: "User not found" });
    const count = await revokeAllUserSessionsRepo(req.params.id, req.user?.id);
    const actor = req.user?.name || req.user?.username || "System Owner";
    await Promise.allSettled([
      addAuditLogRepo("force_password_change_enabled", actor, { userId: rows[0].id, username: rows[0].username, sessionsRevoked: count }),
      addSecurityEventRepo("force_password_change", rows[0].id, { requiredBy: actor }, req.ip || "-"),
    ]);
    return res.json({ message: "Password change will be required at next sign-in", user: rows[0] });
  } catch (error) {
    console.error("Force password change error:", error);
    return res.status(500).json({ message: "Failed to require password change", error: error.message });
  }
});

router.post("/unlock/:id", async (req, res) => {
  try {
    const userId = req.params.id;
    const updated = await unlockUserRepo(userId);

    if (!updated) {
      return res.status(404).json({ message: "User not found" });
    }

    const actor = req.user?.name || req.user?.username || "System Owner";
    await Promise.allSettled([
      addAuditLogRepo("security_user_unlocked", actor, {
        userId: updated.id, username: updated.username,
      }),
      addSecurityEventRepo("user_unlocked", updated.id, {
        unlockedBy: actor, unlockedById: req.user?.id || null,
      }, req.ip || "-"),
    ]);

    return res.json({
      message: "User unlocked successfully",
      user: updated,
    });
  } catch (error) {
    console.error("Unlock user error:", error);
    return res.status(500).json({
      message: "Failed to unlock user",
      error: error.message,
    });
  }
});

export default router;
