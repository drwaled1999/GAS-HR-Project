import { query } from "./index.js";

export async function initDatabase() {
  await query(`
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS roles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role_id UUID REFERENCES roles(id) ON DELETE SET NULL,
      employee_id UUID NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS projects (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT UNIQUE NOT NULL,
      code TEXT UNIQUE,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS packages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      code TEXT,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE(project_id, name)
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS employees (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      full_name TEXT NOT NULL,
      gas_id TEXT UNIQUE NOT NULL,
      biometric_user_id TEXT,
      nationality TEXT,
      project_name TEXT,
      package_name TEXT,
      job_title TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_users_employee'
      ) THEN
        ALTER TABLE users
        ADD CONSTRAINT fk_users_employee
        FOREIGN KEY (employee_id)
        REFERENCES employees(id)
        ON DELETE SET NULL;
      END IF;
    END $$;
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS attendance_import_rows (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      import_batch_id UUID NOT NULL,
      user_id_value TEXT NOT NULL,
      employee_name TEXT,
      work_date DATE NOT NULL,
      regular_hours NUMERIC(10,2) NOT NULL DEFAULT 0,
      status TEXT NOT NULL,
      matched_employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
      is_approved BOOLEAN NOT NULL DEFAULT FALSE,
      approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
      approved_at TIMESTAMP NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS attendance_records (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      work_date DATE NOT NULL,
      hours NUMERIC(10,2) NOT NULL DEFAULT 0,
      status TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'manual',
      note TEXT,
      modified_by UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE(employee_id, work_date)
    );
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_attendance_import_rows_batch
    ON attendance_import_rows(import_batch_id);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_attendance_import_rows_userid
    ON attendance_import_rows(user_id_value);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_attendance_records_employee_date
    ON attendance_records(employee_id, work_date);
  `);

  await seedCoreData();
}

async function seedCoreData() {
  const roles = [
    ["owner", "System Owner"],
    ["hr_manager", "HR Manager"],
    ["hr", "HR"],
    ["engineer", "Engineer"],
    ["project_manager", "Project Manager"],
    ["cm", "CM"],
    ["employee", "Employee"]
  ];

  for (const [code, name] of roles) {
    await query(
      `
      INSERT INTO roles (code, name)
      VALUES ($1, $2)
      ON CONFLICT (code) DO NOTHING
      `,
      [code, name]
    );
  }
}