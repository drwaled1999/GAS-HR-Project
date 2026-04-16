import { Router } from "express";
import {
  authenticateToken,
  enforceMaintenance,
  requireSystemOwner,
} from "../middleware_auth.js";
import { addAuditLog } from "../data/store.js";
import { query } from "../data/index.js";

const router = Router();

router.use(authenticateToken, enforceMaintenance);

async function ensureSystemSettingsRow() {
  await query(`
    CREATE TABLE IF NOT EXISTS system_settings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      annual_default_balance INTEGER NOT NULL DEFAULT 30,
      sick_default_balance INTEGER NOT NULL DEFAULT 15,
      emergency_default_balance INTEGER NOT NULL DEFAULT 5,
      maintenance_mode BOOLEAN NOT NULL DEFAULT FALSE,
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  const existing = await query(`
    SELECT id
    FROM system_settings
    LIMIT 1
  `);

  if (!existing.rows[0]) {
    await query(`
      INSERT INTO system_settings (
        annual_default_balance,
        sick_default_balance,
        emergency_default_balance,
        maintenance_mode,
        updated_at
      )
      VALUES (30, 15, 5, FALSE, NOW())
    `);
  }
}

async function readSystemSettings() {
  await ensureSystemSettingsRow();

  const result = await query(`
    SELECT
      id,
      annual_default_balance AS "annualDefaultBalance",
      sick_default_balance AS "sickDefaultBalance",
      emergency_default_balance AS "emergencyDefaultBalance",
      maintenance_mode AS "maintenanceMode",
      updated_at AS "updatedAt"
    FROM system_settings
    ORDER BY updated_at DESC
    LIMIT 1
  `);

  return result.rows[0];
}

router.get("/", async (_req, res) => {
  try {
    const settings = await readSystemSettings();

    return res.json({
      settings,
      auditLogs: [],
    });
  } catch (error) {
    console.error("Settings load error:", error);
    return res.status(500).json({
      message: "Failed to load settings",
      error: error.message,
    });
  }
});

router.post("/maintenance", requireSystemOwner, async (req, res) => {
  try {
    await ensureSystemSettingsRow();

    const enabled = Boolean(req.body.enabled);

    await query(
      `
      UPDATE system_settings
      SET
        maintenance_mode = $1,
        updated_at = NOW()
      `,
      [enabled]
    );

    addAuditLog?.(
      "maintenance_mode_changed",
      req.user?.name || req.user?.username || "System Owner",
      { enabled }
    );

    const settings = await readSystemSettings();
    return res.json({ settings });
  } catch (error) {
    console.error("Maintenance mode update error:", error);
    return res.status(500).json({
      message: "Failed to update maintenance mode",
      error: error.message,
    });
  }
});

router.post("/leave-defaults", requireSystemOwner, async (req, res) => {
  try {
    await ensureSystemSettingsRow();

    const annual = Number(req.body.annualDefaultBalance ?? 30);
    const sick = Number(req.body.sickDefaultBalance ?? 15);
    const emergency = Number(req.body.emergencyDefaultBalance ?? 5);

    if ([annual, sick, emergency].some((n) => Number.isNaN(n) || n < 0)) {
      return res.status(400).json({
        message: "Invalid leave balance values",
      });
    }

    await query(
      `
      UPDATE system_settings
      SET
        annual_default_balance = $1,
        sick_default_balance = $2,
        emergency_default_balance = $3,
        updated_at = NOW()
      `,
      [annual, sick, emergency]
    );

    addAuditLog?.(
      "leave_defaults_changed",
      req.user?.name || req.user?.username || "System Owner",
      { annual, sick, emergency }
    );

    const settings = await readSystemSettings();
    return res.json({ settings });
  } catch (error) {
    console.error("Leave defaults update error:", error);
    return res.status(500).json({
      message: "Failed to update leave defaults",
      error: error.message,
    });
  }
});

export default router;
