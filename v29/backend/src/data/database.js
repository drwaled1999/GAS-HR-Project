import { query } from "./index.js";

export async function initDatabase() {
  try {
    console.log("Initializing database...");

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
      CREATE TABLE IF NOT EXISTS employees (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        full_name TEXT NOT NULL,
        gas_id TEXT UNIQUE,
        nationality TEXT,
        project_name TEXT,
        package_name TEXT,
        job_title TEXT,
        status TEXT DEFAULT 'active',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE,
        password_hash TEXT NOT NULL,
        full_name TEXT NOT NULL,
        role_id UUID REFERENCES roles(id),
        employee_id UUID REFERENCES employees(id),
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS attendance_records (
        id SERIAL PRIMARY KEY,
        employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
        work_date DATE NOT NULL,
        status TEXT NOT NULL DEFAULT 'A',
        hours NUMERIC DEFAULT 0,
        source_batch_id INTEGER NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(employee_id, work_date)
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS attendance_import_batches (
        id SERIAL PRIMARY KEY,
        file_name TEXT,
        uploaded_by TEXT,
        month_int INT,
        year_int INT,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW(),
        approved_at TIMESTAMP NULL,
        approved_by TEXT NULL
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS attendance_import_rows (
        id SERIAL PRIMARY KEY,
        import_batch_id INTEGER REFERENCES attendance_import_batches(id) ON DELETE CASCADE,
        employee_id UUID NULL REFERENCES employees(id) ON DELETE SET NULL,
        gas_id TEXT,
        employee_name TEXT,
        work_date DATE,
        regular_hours NUMERIC DEFAULT 0,
        derived_status TEXT DEFAULT 'A',
        status_override TEXT NULL,
        notes TEXT NULL,
        raw_json JSONB NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await query(`
      ALTER TABLE attendance_import_rows
      ADD COLUMN IF NOT EXISTS import_batch_id INTEGER;
    `);

    await query(`
      ALTER TABLE attendance_import_rows
      ADD COLUMN IF NOT EXISTS employee_id UUID NULL;
    `);

    await query(`
      ALTER TABLE attendance_import_rows
      ADD COLUMN IF NOT EXISTS gas_id TEXT;
    `);

    await query(`
      ALTER TABLE attendance_import_rows
      ADD COLUMN IF NOT EXISTS employee_name TEXT;
    `);

    await query(`
      ALTER TABLE attendance_import_rows
      ADD COLUMN IF NOT EXISTS work_date DATE;
    `);

    await query(`
      ALTER TABLE attendance_import_rows
      ADD COLUMN IF NOT EXISTS regular_hours NUMERIC DEFAULT 0;
    `);

    await query(`
      ALTER TABLE attendance_import_rows
      ADD COLUMN IF NOT EXISTS derived_status TEXT DEFAULT 'A';
    `);

    await query(`
      ALTER TABLE attendance_import_rows
      ADD COLUMN IF NOT EXISTS status_override TEXT NULL;
    `);

    await query(`
      ALTER TABLE attendance_import_rows
      ADD COLUMN IF NOT EXISTS notes TEXT NULL;
    `);

    await query(`
      ALTER TABLE attendance_import_rows
      ADD COLUMN IF NOT EXISTS raw_json JSONB NULL;
    `);

    await query(`
      ALTER TABLE attendance_records
      ADD COLUMN IF NOT EXISTS source_batch_id INTEGER NULL;
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS idx_attendance_import_rows_batch
      ON attendance_import_rows(import_batch_id);
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS idx_attendance_import_rows_gas_id
      ON attendance_import_rows(gas_id);
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS idx_attendance_import_rows_work_date
      ON attendance_import_rows(work_date);
    `);

    await query(`
      INSERT INTO roles (code, name)
      VALUES
        ('owner', 'System Owner'),
        ('hr_manager', 'HR Manager'),
        ('hr', 'HR'),
        ('engineer', 'Engineer'),
        ('supervisor', 'Supervisor'),
        ('employee', 'Employee'),
        ('cm', 'CM'),
        ('project_manager', 'Project Manager')
      ON CONFLICT (code) DO NOTHING;
    `);

    console.log("Database initialized successfully");
  } catch (error) {
    console.error("Database init error:", error);
  }
}