import { query } from "./index.js";

export async function initDatabase() {
  await query(`
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS user_fcm_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL,
      token TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, token)
    );
  `);

  await query(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS two_factor_secret TEXT,
      ADD COLUMN IF NOT EXISTS two_factor_recovery_codes JSONB NOT NULL DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS two_factor_enabled_at TIMESTAMP;
  `);

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
    ALTER TABLE system_settings
      ADD COLUMN IF NOT EXISTS security_max_failed_attempts INTEGER NOT NULL DEFAULT 5,
      ADD COLUMN IF NOT EXISTS security_lock_minutes INTEGER NOT NULL DEFAULT 15,
      ADD COLUMN IF NOT EXISTS security_inactivity_minutes INTEGER NOT NULL DEFAULT 15,
      ADD COLUMN IF NOT EXISTS security_session_hours INTEGER NOT NULL DEFAULT 12,
      ADD COLUMN IF NOT EXISTS security_password_min_length INTEGER NOT NULL DEFAULT 8,
      ADD COLUMN IF NOT EXISTS security_required_2fa_roles JSONB NOT NULL DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS updated_by TEXT;
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS security_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      ip_address TEXT,
      user_agent TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL,
      revoked_at TIMESTAMPTZ,
      revoked_by UUID REFERENCES users(id) ON DELETE SET NULL
    );
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_security_sessions_active
      ON security_sessions (user_id, expires_at DESC)
      WHERE revoked_at IS NULL;
  `);

  // =========================
  // attendance_import_batches
  // =========================
  await query(`
    CREATE TABLE IF NOT EXISTS attendance_import_batches (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      file_name TEXT NOT NULL,
      month_int INTEGER,
      year_int INTEGER,
      status TEXT NOT NULL DEFAULT 'draft',
      approved_by TEXT,
      approved_at TIMESTAMP,
      visible_to_employees BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  // ===================
  // attendance_records
  // ===================
  await query(`
    CREATE TABLE IF NOT EXISTS attendance_records (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      import_batch_id UUID NOT NULL REFERENCES attendance_import_batches(id) ON DELETE CASCADE,
      employee_code TEXT,
      employee_name TEXT NOT NULL,
      work_date DATE NOT NULL,
      check_in TEXT,
      check_out TEXT,
      regular_hours NUMERIC(10,2) DEFAULT 0,
      exception_text TEXT,
      leave_text TEXT,
      override_type TEXT,
      override_note TEXT,
      updated_by TEXT,
      updated_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  // =========================
  // batch manual employees
  // =========================
  await query(`
    CREATE TABLE IF NOT EXISTS attendance_sheet_manual_employees (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      import_batch_id UUID NOT NULL REFERENCES attendance_import_batches(id) ON DELETE CASCADE,
      employee_id UUID,
      employee_code TEXT,
      employee_name TEXT NOT NULL,
      nationality TEXT,
      project_name TEXT,
      package_name TEXT,
      job_title TEXT,
      created_by TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE(import_batch_id, employee_code, employee_name)
    );
  `);

  // =========================
  // batch exclusions
  // =========================
  await query(`
    CREATE TABLE IF NOT EXISTS attendance_sheet_exclusions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      import_batch_id UUID NOT NULL REFERENCES attendance_import_batches(id) ON DELETE CASCADE,
      employee_id UUID,
      employee_code TEXT,
      employee_name TEXT NOT NULL,
      reason TEXT,
      excluded_by TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE(import_batch_id, employee_code, employee_name)
    );
  `);

  // ==========================================
  // persistent manual employees
  // يبقون لنفس الشهر والشهور الجاية
  // ==========================================
  await query(`
    CREATE TABLE IF NOT EXISTS attendance_persistent_manual_employees (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      employee_id UUID,
      employee_code TEXT,
      employee_name TEXT NOT NULL,
      nationality TEXT,
      project_name TEXT,
      package_name TEXT,
      job_title TEXT,
      created_by TEXT,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE(employee_code, employee_name)
    );
  `);

  // =========================
  // Safe migrations if needed
  // =========================
  await query(`
    ALTER TABLE attendance_import_batches
    ADD COLUMN IF NOT EXISTS file_name TEXT;
  `);

  await query(`
    ALTER TABLE attendance_import_batches
    ADD COLUMN IF NOT EXISTS month_int INTEGER;
  `);

  await query(`
    ALTER TABLE attendance_import_batches
    ADD COLUMN IF NOT EXISTS year_int INTEGER;
  `);

  await query(`
    ALTER TABLE attendance_import_batches
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft';
  `);

  await query(`
    ALTER TABLE attendance_import_batches
    ADD COLUMN IF NOT EXISTS approved_by TEXT;
  `);

  await query(`
    ALTER TABLE attendance_import_batches
    ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;
  `);

  await query(`
    ALTER TABLE attendance_import_batches
    ADD COLUMN IF NOT EXISTS visible_to_employees BOOLEAN NOT NULL DEFAULT false;
  `);

  await query(`
    ALTER TABLE attendance_import_batches
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW();
  `);

  await query(`
    ALTER TABLE attendance_records
    ADD COLUMN IF NOT EXISTS import_batch_id UUID;
  `);

  await query(`
    ALTER TABLE attendance_records
    ADD COLUMN IF NOT EXISTS employee_code TEXT;
  `);

  await query(`
    ALTER TABLE attendance_records
    ADD COLUMN IF NOT EXISTS employee_name TEXT;
  `);

  await query(`
    ALTER TABLE attendance_records
    ADD COLUMN IF NOT EXISTS work_date DATE;
  `);

  await query(`
    ALTER TABLE attendance_records
    ADD COLUMN IF NOT EXISTS check_in TEXT;
  `);

  await query(`
    ALTER TABLE attendance_records
    ADD COLUMN IF NOT EXISTS check_out TEXT;
  `);

  await query(`
    ALTER TABLE attendance_records
    ADD COLUMN IF NOT EXISTS regular_hours NUMERIC(10,2) DEFAULT 0;
  `);

  await query(`
    ALTER TABLE attendance_records
    ADD COLUMN IF NOT EXISTS exception_text TEXT;
  `);

  await query(`
    ALTER TABLE attendance_records
    ADD COLUMN IF NOT EXISTS leave_text TEXT;
  `);

  await query(`
    ALTER TABLE attendance_records
    ADD COLUMN IF NOT EXISTS override_type TEXT;
  `);

  await query(`
    ALTER TABLE attendance_records
    ADD COLUMN IF NOT EXISTS override_note TEXT;
  `);

  await query(`
    ALTER TABLE attendance_records
    ADD COLUMN IF NOT EXISTS updated_by TEXT;
  `);

  await query(`
    ALTER TABLE attendance_records
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;
  `);

  await query(`
    ALTER TABLE attendance_records
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW();
  `);

  await query(`
    ALTER TABLE attendance_sheet_manual_employees
    ADD COLUMN IF NOT EXISTS employee_id UUID;
  `);

  await query(`
    ALTER TABLE attendance_sheet_manual_employees
    ADD COLUMN IF NOT EXISTS employee_code TEXT;
  `);

  await query(`
    ALTER TABLE attendance_sheet_manual_employees
    ADD COLUMN IF NOT EXISTS employee_name TEXT;
  `);

  await query(`
    ALTER TABLE attendance_sheet_manual_employees
    ADD COLUMN IF NOT EXISTS nationality TEXT;
  `);

  await query(`
    ALTER TABLE attendance_sheet_manual_employees
    ADD COLUMN IF NOT EXISTS project_name TEXT;
  `);

  await query(`
    ALTER TABLE attendance_sheet_manual_employees
    ADD COLUMN IF NOT EXISTS package_name TEXT;
  `);

  await query(`
    ALTER TABLE attendance_sheet_manual_employees
    ADD COLUMN IF NOT EXISTS job_title TEXT;
  `);

  await query(`
    ALTER TABLE attendance_sheet_manual_employees
    ADD COLUMN IF NOT EXISTS created_by TEXT;
  `);

  await query(`
    ALTER TABLE attendance_sheet_manual_employees
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW();
  `);

  await query(`
    ALTER TABLE attendance_sheet_exclusions
    ADD COLUMN IF NOT EXISTS employee_id UUID;
  `);

  await query(`
    ALTER TABLE attendance_sheet_exclusions
    ADD COLUMN IF NOT EXISTS employee_code TEXT;
  `);

  await query(`
    ALTER TABLE attendance_sheet_exclusions
    ADD COLUMN IF NOT EXISTS employee_name TEXT;
  `);

  await query(`
    ALTER TABLE attendance_sheet_exclusions
    ADD COLUMN IF NOT EXISTS reason TEXT;
  `);

  await query(`
    ALTER TABLE attendance_sheet_exclusions
    ADD COLUMN IF NOT EXISTS excluded_by TEXT;
  `);

  await query(`
    ALTER TABLE attendance_sheet_exclusions
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW();
  `);

  await query(`
    ALTER TABLE attendance_persistent_manual_employees
    ADD COLUMN IF NOT EXISTS employee_id UUID;
  `);

  await query(`
    ALTER TABLE attendance_persistent_manual_employees
    ADD COLUMN IF NOT EXISTS employee_code TEXT;
  `);

  await query(`
    ALTER TABLE attendance_persistent_manual_employees
    ADD COLUMN IF NOT EXISTS employee_name TEXT;
  `);

  await query(`
    ALTER TABLE attendance_persistent_manual_employees
    ADD COLUMN IF NOT EXISTS nationality TEXT;
  `);

  await query(`
    ALTER TABLE attendance_persistent_manual_employees
    ADD COLUMN IF NOT EXISTS project_name TEXT;
  `);

  await query(`
    ALTER TABLE attendance_persistent_manual_employees
    ADD COLUMN IF NOT EXISTS package_name TEXT;
  `);

  await query(`
    ALTER TABLE attendance_persistent_manual_employees
    ADD COLUMN IF NOT EXISTS job_title TEXT;
  `);

  await query(`
    ALTER TABLE attendance_persistent_manual_employees
    ADD COLUMN IF NOT EXISTS created_by TEXT;
  `);

  await query(`
    ALTER TABLE attendance_persistent_manual_employees
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
  `);

  await query(`
    ALTER TABLE attendance_persistent_manual_employees
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW();
  `);

  await query(`
    ALTER TABLE attendance_persistent_manual_employees
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW();
  `);

  // =========
  // Indexes
  // =========
  await query(`
    CREATE INDEX IF NOT EXISTS idx_attendance_batches_month_year
    ON attendance_import_batches (month_int, year_int);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_attendance_records_batch
    ON attendance_records (import_batch_id);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_attendance_records_employee_code
    ON attendance_records (employee_code);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_attendance_records_employee_name
    ON attendance_records (employee_name);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_attendance_records_work_date
    ON attendance_records (work_date);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_attendance_sheet_manual_batch
    ON attendance_sheet_manual_employees (import_batch_id);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_attendance_sheet_manual_code
    ON attendance_sheet_manual_employees (employee_code);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_attendance_sheet_exclusions_batch
    ON attendance_sheet_exclusions (import_batch_id);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_attendance_sheet_exclusions_code
    ON attendance_sheet_exclusions (employee_code);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_attendance_persistent_manual_code
    ON attendance_persistent_manual_employees (employee_code);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_attendance_persistent_manual_active
    ON attendance_persistent_manual_employees (is_active);
  `);
}
