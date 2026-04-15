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
} from "../data/securityRepository.js";
import {
  listUsersRepo,
  unlockUserRepo,
} from "../data/userEmployeeRepository.js";

const router = Router();

router.use(authenticateToken, enforceMaintenance);

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
    const limit = Number(req.query.limit || 20);
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
    const limit = Number(req.query.limit || 20);
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
    const limit = Number(req.query.limit || 20);
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

router.post("/unlock/:id", requireSystemOwner, async (req, res) => {
  try {
    const userId = req.params.id;
    const updated = await unlockUserRepo(userId);

    if (!updated) {
      return res.status(404).json({ message: "User not found" });
    }

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