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
        employee_id UUID REFERENCES employees(id),
        work_date DATE NOT NULL,
        status TEXT,
        hours NUMERIC DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
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
        employee_name TEXT,
        gas_id TEXT,
        work_date DATE,
        regular_value TEXT,
        regular_hours NUMERIC DEFAULT 0,
        derived_status TEXT DEFAULT 'A',
        raw_json JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // ترقية الجداول القديمة لو كانت موجودة قبل
    await query(`
      ALTER TABLE attendance_import_rows
      ADD COLUMN IF NOT EXISTS batch_id INTEGER;
    `);

    await query(`
      ALTER TABLE attendance_import_rows
      ADD COLUMN IF NOT EXISTS employee_id UUID NULL;
    `);

    await query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM information_schema.table_constraints
          WHERE constraint_name = 'fk_attendance_import_rows_batch'
        ) THEN
          ALTER TABLE attendance_import_rows
          ADD CONSTRAINT fk_attendance_import_rows_batch
          FOREIGN KEY (batch_id)
          REFERENCES attendance_import_batches(id)
          ON DELETE CASCADE;
        END IF;
      END $$;
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
      CREATE INDEX IF NOT EXISTS idx_attendance_import_rows_batch_id
      ON attendance_import_rows(batch_id);
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