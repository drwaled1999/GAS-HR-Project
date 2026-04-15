import { Router } from "express";
import {
  authenticateToken,
  enforceMaintenance,
  requireSystemOwner,
} from "../middleware_auth.js";
import { addAuditLog, db } from "../data/store.js";

const router = Router();

router.use(authenticateToken, enforceMaintenance);

router.get("/", (_req, res) => {
  try {
    return res.json({
      settings: db.settings || {},
      auditLogs: Array.isArray(db.auditLogs) ? db.auditLogs.slice(0, 25) : [],
    });
  } catch (error) {
    console.error("Settings load error:", error);
    return res.status(500).json({
      message: "Failed to load settings",
      error: error.message,
    });
  }
});

router.post("/maintenance", requireSystemOwner, (req, res) => {
  try {
    if (!db.settings) {
      db.settings = {};
    }

    db.settings.maintenanceMode = Boolean(req.body.enabled);

    addAuditLog(
      "maintenance_mode_changed",
      req.user?.name || req.user?.username || "System Owner",
      {
        enabled: db.settings.maintenanceMode,
      }
    );

    return res.json({
      settings: db.settings,
    });
  } catch (error) {
    console.error("Maintenance mode update error:", error);
    return res.status(500).json({
      message: "Failed to update maintenance mode",
      error: error.message,
    });
  }
});

export default router;