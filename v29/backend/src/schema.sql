CREATE TABLE IF NOT EXISTS attendance_import_rows (
  id UUID PRIMARY KEY,
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

CREATE INDEX IF NOT EXISTS idx_attendance_import_rows_batch
ON attendance_import_rows(import_batch_id);

CREATE INDEX IF NOT EXISTS idx_attendance_import_rows_userid
ON attendance_import_rows(user_id_value);

CREATE INDEX IF NOT EXISTS idx_attendance_import_rows_match
ON attendance_import_rows(matched_employee_id);


CREATE TABLE IF NOT EXISTS attendance_import_rows (
  id UUID PRIMARY KEY,
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

CREATE INDEX IF NOT EXISTS idx_attendance_import_rows_batch
ON attendance_import_rows(import_batch_id);

CREATE INDEX IF NOT EXISTS idx_attendance_import_rows_userid
ON attendance_import_rows(user_id_value);

CREATE INDEX IF NOT EXISTS idx_attendance_import_rows_match
ON attendance_import_rows(matched_employee_id);



