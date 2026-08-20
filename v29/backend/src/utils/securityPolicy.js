import { query } from "../data/index.js";

let schemaReadyPromise;

export function ensureSecurityPolicyColumns() {
  if (schemaReadyPromise) return schemaReadyPromise;
  schemaReadyPromise = (async () => {
    await query(`CREATE TABLE IF NOT EXISTS system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    annual_default_balance NUMERIC(10,2) NOT NULL DEFAULT 30,
    sick_default_balance NUMERIC(10,2) NOT NULL DEFAULT 15,
    emergency_default_balance NUMERIC(10,2) NOT NULL DEFAULT 5,
    monthly_annual_accrual NUMERIC(10,2) NOT NULL DEFAULT 2.5,
    maintenance_mode BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`);
    await query(`ALTER TABLE system_settings
    ADD COLUMN IF NOT EXISTS security_max_failed_attempts INTEGER NOT NULL DEFAULT 5,
    ADD COLUMN IF NOT EXISTS security_lock_minutes INTEGER NOT NULL DEFAULT 15,
    ADD COLUMN IF NOT EXISTS security_inactivity_minutes INTEGER NOT NULL DEFAULT 15,
    ADD COLUMN IF NOT EXISTS security_session_hours INTEGER NOT NULL DEFAULT 12,
    ADD COLUMN IF NOT EXISTS security_password_min_length INTEGER NOT NULL DEFAULT 8,
    ADD COLUMN IF NOT EXISTS security_required_2fa_roles JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS updated_by TEXT`);
    await query(`INSERT INTO system_settings (updated_at)
      SELECT NOW() WHERE NOT EXISTS (SELECT 1 FROM system_settings)`);
  })().catch((error) => {
    schemaReadyPromise = null;
    throw error;
  });
  return schemaReadyPromise;
}

export async function readSecurityPolicy() {
  await ensureSecurityPolicyColumns();
  const { rows } = await query(`SELECT
    security_max_failed_attempts AS "maxFailedAttempts",
    security_lock_minutes AS "lockMinutes",
    security_inactivity_minutes AS "inactivityMinutes",
    security_session_hours AS "sessionHours",
    security_password_min_length AS "passwordMinLength",
    security_required_2fa_roles AS "requiredTwoFactorRoles"
    FROM system_settings ORDER BY updated_at DESC LIMIT 1`);
  const row = rows[0] || {};
  return {
    maxFailedAttempts: Number(row.maxFailedAttempts || 5),
    lockMinutes: Number(row.lockMinutes || 15),
    inactivityMinutes: Number(row.inactivityMinutes || 15),
    sessionHours: Number(row.sessionHours || 12),
    passwordMinLength: Number(row.passwordMinLength || 8),
    requiredTwoFactorRoles: Array.isArray(row.requiredTwoFactorRoles) ? row.requiredTwoFactorRoles : [],
  };
}

export function roleRequiresTwoFactor(policy, user) {
  const required = new Set((policy?.requiredTwoFactorRoles || []).map((value) =>
    String(value || "").trim().toLowerCase().replace(/\s+/g, "_")
  ));
  const candidates = [user?.role_code, user?.role_name]
    .map((value) => String(value || "").trim().toLowerCase().replace(/\s+/g, "_"));
  return candidates.some((value) => value && required.has(value));
}
