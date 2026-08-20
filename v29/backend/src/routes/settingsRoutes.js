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
  await query(`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS notification_sound BOOLEAN NOT NULL DEFAULT TRUE`);
  await query(`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS browser_notifications BOOLEAN NOT NULL DEFAULT TRUE`);
  await query(`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS notification_duration_seconds INTEGER NOT NULL DEFAULT 7`);
  await query(`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS leave_request_notifications BOOLEAN NOT NULL DEFAULT TRUE`);
  await query(`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS leave_review_notifications BOOLEAN NOT NULL DEFAULT TRUE`);

  await query(`CREATE TABLE IF NOT EXISTS leave_policies (
    code TEXT PRIMARY KEY, label TEXT NOT NULL, default_balance NUMERIC(10,2) NOT NULL,
    monthly_accrual NUMERIC(10,2) NOT NULL DEFAULT 0, max_days_per_request INTEGER NOT NULL DEFAULT 30,
    allow_negative BOOLEAN NOT NULL DEFAULT FALSE, exclude_weekends BOOLEAN NOT NULL DEFAULT TRUE,
    attachment_allowed BOOLEAN NOT NULL DEFAULT FALSE, attachment_required BOOLEAN NOT NULL DEFAULT FALSE,
    carry_over_max NUMERIC(10,2) NOT NULL DEFAULT 0, updated_by TEXT, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await query(`INSERT INTO leave_policies (code,label,default_balance,monthly_accrual,max_days_per_request,attachment_allowed)
    VALUES ('annual_leave','Annual Leave',30,2.5,30,TRUE),('sick_leave','Sick Leave',15,0,30,FALSE),
           ('emergency_leave','Emergency Leave',5,0,5,FALSE) ON CONFLICT (code) DO NOTHING`);

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
      notification_sound AS "notificationSound",
      browser_notifications AS "browserNotifications",
      notification_duration_seconds AS "notificationDurationSeconds",
      leave_request_notifications AS "leaveRequestNotifications",
      leave_review_notifications AS "leaveReviewNotifications",
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

router.get("/leave-policies", async (_req, res) => {
  try {
    await ensureSystemSettingsRow();
    const { rows } = await query(`SELECT code, label, default_balance AS "defaultBalance",
      monthly_accrual AS "monthlyAccrual", max_days_per_request AS "maxDaysPerRequest",
      allow_negative AS "allowNegative", exclude_weekends AS "excludeWeekends",
      attachment_allowed AS "attachmentAllowed", attachment_required AS "attachmentRequired",
      carry_over_max AS "carryOverMax", updated_by AS "updatedBy", updated_at AS "updatedAt"
      FROM leave_policies ORDER BY code`);
    return res.json({ policies: rows });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load leave policies" });
  }
});

router.post("/leave-policies", requirePermission("settings.manage"), async (req, res) => {
  try {
    await ensureSystemSettingsRow();
    const policies = Array.isArray(req.body.policies) ? req.body.policies : [];
    const allowedCodes = new Set(["annual_leave", "sick_leave", "emergency_leave"]);
    const actor = req.user?.name || req.user?.username || "System Manager";
    for (const policy of policies) {
      if (!allowedCodes.has(policy.code)) continue;
      const values = [policy.defaultBalance, policy.monthlyAccrual, policy.maxDaysPerRequest, policy.carryOverMax].map(Number);
      if (values.some((value) => !Number.isFinite(value) || value < 0 || value > 365)) {
        return res.status(400).json({ message: "Invalid leave policy values" });
      }
      if (policy.attachmentRequired && !policy.attachmentAllowed) {
        return res.status(400).json({ message: "A required attachment must also be allowed" });
      }
      await query(`UPDATE leave_policies SET default_balance=$2, monthly_accrual=$3,
        max_days_per_request=$4, allow_negative=$5, exclude_weekends=$6,
        attachment_allowed=$7, attachment_required=$8, carry_over_max=$9,
        updated_by=$10, updated_at=NOW() WHERE code=$1`,
        [policy.code, ...values.slice(0,3), Boolean(policy.allowNegative), Boolean(policy.excludeWeekends),
          Boolean(policy.attachmentAllowed), Boolean(policy.attachmentRequired), values[3], actor]);
    }
    await recordSettingsAudit("leave_policies_changed", actor, { policies });
    return res.json({ message: "Leave policies saved" });
  } catch (error) {
    console.error("Leave policies update error:", error);
    return res.status(500).json({ message: "Failed to save leave policies" });
  }
});

router.post("/notification-preferences", requirePermission("settings.manage"), async (req, res) => {
  try {
    await ensureSystemSettingsRow();
    const duration = Math.min(20, Math.max(3, Number(req.body.notificationDurationSeconds) || 7));
    const actor = req.user?.name || req.user?.username || "System Manager";
    await query(`UPDATE system_settings SET notification_sound=$1, browser_notifications=$2,
      notification_duration_seconds=$3, leave_request_notifications=$4,
      leave_review_notifications=$5, updated_by=$6, updated_at=NOW()
      WHERE id=(SELECT id FROM system_settings ORDER BY updated_at DESC LIMIT 1)`,
      [Boolean(req.body.notificationSound), Boolean(req.body.browserNotifications), duration,
       Boolean(req.body.leaveRequestNotifications), Boolean(req.body.leaveReviewNotifications), actor]);
    await recordSettingsAudit("notification_preferences_changed", actor, req.body);
    return res.json({ settings: await readSystemSettings() });
  } catch (error) {
    return res.status(500).json({ message: "Failed to save notification preferences" });
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
