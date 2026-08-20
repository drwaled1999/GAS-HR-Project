import { Router } from "express";
import {
  authenticateToken,
  enforceMaintenance,
  requireSystemOwner,
} from "../middleware_auth.js";
import { query } from "../data/index.js";
import { requirePermission } from "../utils/permissions.js";
import { addAuditLogRepo, listAuditLogsRepo } from "../data/securityRepository.js";

const router = Router();

async function recordSettingsAudit(action, actor, details) {
  try {
    await addAuditLogRepo(action, actor, details);
  } catch (error) {
    console.error("Settings audit write error:", error);
  }
}

router.use(authenticateToken, enforceMaintenance);

async function ensureSystemSettingsRow() {
  await query(`
    CREATE TABLE IF NOT EXISTS system_settings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      annual_default_balance NUMERIC(10,2) NOT NULL DEFAULT 30,
      sick_default_balance NUMERIC(10,2) NOT NULL DEFAULT 15,
      emergency_default_balance NUMERIC(10,2) NOT NULL DEFAULT 5,
      monthly_annual_accrual NUMERIC(10,2) NOT NULL DEFAULT 2.5,
      maintenance_mode BOOLEAN NOT NULL DEFAULT FALSE,
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await query(`ALTER TABLE system_settings ALTER COLUMN annual_default_balance TYPE NUMERIC(10,2) USING annual_default_balance::numeric`);
  await query(`ALTER TABLE system_settings ALTER COLUMN sick_default_balance TYPE NUMERIC(10,2) USING sick_default_balance::numeric`);
  await query(`ALTER TABLE system_settings ALTER COLUMN emergency_default_balance TYPE NUMERIC(10,2) USING emergency_default_balance::numeric`);
  await query(`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS monthly_annual_accrual NUMERIC(10,2) NOT NULL DEFAULT 2.5`);
  await query(`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS maintenance_message TEXT NOT NULL DEFAULT ''`);
  await query(`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS maintenance_start_at TIMESTAMPTZ`);
  await query(`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS maintenance_end_at TIMESTAMPTZ`);
  await query(`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS updated_by TEXT`);

  const existing = await query(`SELECT id FROM system_settings LIMIT 1`);

  if (!existing.rows[0]) {
    await query(`
      INSERT INTO system_settings (
        annual_default_balance,
        sick_default_balance,
        emergency_default_balance,
        monthly_annual_accrual,
        maintenance_mode,
        updated_at
      )
      VALUES (30, 15, 5, 2.5, FALSE, NOW())
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
      monthly_annual_accrual AS "monthlyAnnualAccrual",
      maintenance_mode AS "maintenanceMode",
      maintenance_message AS "maintenanceMessage",
      maintenance_start_at AS "maintenanceStartAt",
      maintenance_end_at AS "maintenanceEndAt",
      updated_by AS "updatedBy",
      (maintenance_mode OR (
        maintenance_start_at IS NOT NULL AND maintenance_end_at IS NOT NULL AND
        NOW() BETWEEN maintenance_start_at AND maintenance_end_at
      )) AS "maintenanceEffective",
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
    return res.json({ settings });
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
      SET maintenance_mode = $1, updated_by = $2, updated_at = NOW()
      WHERE id = (SELECT id FROM system_settings ORDER BY updated_at DESC LIMIT 1)
      `,
      [enabled, req.user?.name || req.user?.username || "System Owner"]
    );

    await recordSettingsAudit(
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

router.post("/maintenance-config", requireSystemOwner, async (req, res) => {
  try {
    await ensureSystemSettingsRow();
    const message = String(req.body.maintenanceMessage || "").trim().slice(0, 500);
    const startAt = req.body.maintenanceStartAt ? new Date(req.body.maintenanceStartAt) : null;
    const endAt = req.body.maintenanceEndAt ? new Date(req.body.maintenanceEndAt) : null;
    if ((startAt && Number.isNaN(startAt.getTime())) || (endAt && Number.isNaN(endAt.getTime()))) {
      return res.status(400).json({ message: "Invalid maintenance schedule" });
    }
    if ((startAt && !endAt) || (!startAt && endAt) || (startAt && endAt && endAt <= startAt)) {
      return res.status(400).json({ message: "Maintenance end time must be after the start time" });
    }
    const actor = req.user?.name || req.user?.username || "System Owner";
    await query(
      `UPDATE system_settings SET maintenance_message = $1,
       maintenance_start_at = $2, maintenance_end_at = $3,
       updated_by = $4, updated_at = NOW()
       WHERE id = (SELECT id FROM system_settings ORDER BY updated_at DESC LIMIT 1)`,
      [message, startAt?.toISOString() || null, endAt?.toISOString() || null, actor]
    );
    await recordSettingsAudit("maintenance_configuration_changed", actor, {
      maintenanceMessage: message, maintenanceStartAt: startAt?.toISOString() || null,
      maintenanceEndAt: endAt?.toISOString() || null,
    });
    return res.json({ settings: await readSystemSettings() });
  } catch (error) {
    console.error("Maintenance configuration error:", error);
    return res.status(500).json({ message: "Failed to save maintenance configuration" });
  }
});

router.get("/maintenance-users", requireSystemOwner, async (_req, res) => {
  try {
    const { rows } = await query(
      `SELECT u.id, u.username, COALESCE(u.full_name, u.name, u.username) AS name,
              COALESCE(r.name, 'Employee') AS role,
              COALESCE(u.allow_during_maintenance, FALSE) AS "allowDuringMaintenance"
       FROM users u LEFT JOIN roles r ON r.id = u.role_id
       WHERE COALESCE(u.is_active, TRUE) = TRUE
       ORDER BY COALESCE(u.full_name, u.name, u.username) ASC`
    );
    return res.json({ users: rows });
  } catch (error) {
    console.error("Maintenance users load error:", error);
    return res.status(500).json({ message: "Failed to load maintenance users" });
  }
});

router.post("/maintenance-users/:userId", requireSystemOwner, async (req, res) => {
  try {
    const allowed = Boolean(req.body.allowed);
    const { rows } = await query(
      `UPDATE users SET allow_during_maintenance = $2, updated_at = NOW()
       WHERE id = $1 RETURNING id, username,
       COALESCE(full_name, name, username) AS name,
       allow_during_maintenance AS "allowDuringMaintenance"`,
      [req.params.userId, allowed]
    );
    if (!rows[0]) return res.status(404).json({ message: "User not found" });
    const actor = req.user?.name || req.user?.username || "System Owner";
    await recordSettingsAudit("maintenance_access_changed", actor, {
      userId: rows[0].id, username: rows[0].username, allowed,
    });
    return res.json({ user: rows[0] });
  } catch (error) {
    console.error("Maintenance access update error:", error);
    return res.status(500).json({ message: "Failed to update maintenance access" });
  }
});

router.get("/audit", requireSystemOwner, async (_req, res) => {
  try {
    const logs = await listAuditLogsRepo(40);
    return res.json({ logs: logs.filter((log) =>
      String(log.action || "").includes("maintenance") || String(log.action || "").includes("leave_defaults")) });
  } catch (error) {
    console.error("Settings audit load error:", error);
    return res.status(500).json({ message: "Failed to load settings history" });
  }
});

router.post("/leave-defaults", requirePermission("settings.manage"), async (req, res) => {
  try {
    await ensureSystemSettingsRow();

    const annual = Number(req.body.annualDefaultBalance ?? 30);
    const sick = Number(req.body.sickDefaultBalance ?? 15);
    const emergency = Number(req.body.emergencyDefaultBalance ?? 5);
    const current = await readSystemSettings();
    const monthlyAnnualAccrual = Number(
      req.body.monthlyAnnualAccrual ?? current?.monthlyAnnualAccrual ?? 2.5
    );

    if ([annual, sick, emergency, monthlyAnnualAccrual].some(
      (n) => !Number.isFinite(n) || n < 0 || n > 365
    )) {
      return res.status(400).json({ message: "Invalid leave balance values" });
    }

    await query(
      `
      UPDATE system_settings
      SET
        annual_default_balance = $1,
        sick_default_balance = $2,
        emergency_default_balance = $3,
        monthly_annual_accrual = $4,
        updated_by = $5,
        updated_at = NOW()
      WHERE id = (SELECT id FROM system_settings ORDER BY updated_at DESC LIMIT 1)
      `,
      [annual, sick, emergency, monthlyAnnualAccrual,
        req.user?.name || req.user?.username || "System Manager"]
    );

    await recordSettingsAudit(
      "leave_defaults_changed",
      req.user?.name || req.user?.username || "System Owner",
      { annual, sick, emergency, monthlyAnnualAccrual }
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
