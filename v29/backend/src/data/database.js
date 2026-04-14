import { query } from "./index.js";

export async function initDatabase() {
  await query(`
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";
  `);

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
}
