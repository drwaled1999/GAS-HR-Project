CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT,
  role TEXT DEFAULT 'employee',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY,
  full_name TEXT NOT NULL,
  gas_id TEXT UNIQUE,
  nationality TEXT,
  project_name TEXT,
  package_name TEXT,
  status TEXT DEFAULT 'active'
);