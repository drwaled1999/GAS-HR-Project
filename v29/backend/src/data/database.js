await query(`
  ALTER TABLE attendance_import_rows
  ADD COLUMN IF NOT EXISTS import_batch_id INTEGER;
`);

await query(`
  ALTER TABLE attendance_import_rows
  ADD COLUMN IF NOT EXISTS employee_id UUID;
`);

await query(`
  ALTER TABLE attendance_import_rows
  ADD COLUMN IF NOT EXISTS employee_name TEXT;
`);

await query(`
  ALTER TABLE attendance_import_rows
  ADD COLUMN IF NOT EXISTS gas_id TEXT;
`);

await query(`
  ALTER TABLE attendance_import_rows
  ADD COLUMN IF NOT EXISTS work_date DATE;
`);

await query(`
  ALTER TABLE attendance_import_rows
  ADD COLUMN IF NOT EXISTS regular_value TEXT;
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
  ADD COLUMN IF NOT EXISTS raw_json JSONB;
`);