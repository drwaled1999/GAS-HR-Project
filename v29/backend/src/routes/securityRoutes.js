import { Router } from "express";
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
} from "../data/securityRepository.js";
import {
  listUsersRepo,
  unlockUserRepo,
} from "../data/userEmployeeRepository.js";

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
