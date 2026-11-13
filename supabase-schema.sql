-- WorkTrack — Supabase PostgreSQL schema
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- Workers table
CREATE TABLE IF NOT EXISTS workers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  department TEXT DEFAULT '',
  email TEXT,
  phone TEXT,
  daily_rate NUMERIC DEFAULT 0,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Attendance table
CREATE TABLE IF NOT EXISTS attendance (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  worker_id TEXT NOT NULL REFERENCES workers(id),
  date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'no_work')),
  leave_type TEXT,
  notes TEXT,
  recorded_by TEXT,
  recorded_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  is_late BOOLEAN DEFAULT FALSE,
  UNIQUE(worker_id, date)
);

-- Meta table (for seed tracking)
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- Holidays table
CREATE TABLE IF NOT EXISTS holidays (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'government' CHECK (type IN ('government', 'company')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Supervisors table
CREATE TABLE IF NOT EXISTS supervisors (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Shift configuration table
CREATE TABLE IF NOT EXISTS shift_config (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  shift_start TEXT NOT NULL DEFAULT '09:00',
  shift_end TEXT NOT NULL DEFAULT '18:00',
  work_hours NUMERIC NOT NULL DEFAULT 8,
  lunch_hours NUMERIC NOT NULL DEFAULT 1,
  updated_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default shift config
INSERT INTO shift_config (shift_start, shift_end, work_hours, lunch_hours)
SELECT '09:00', '18:00', 8, 1
WHERE NOT EXISTS (SELECT 1 FROM shift_config LIMIT 1);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_attendance_worker ON attendance(worker_id);

-- Enable Row Level Security (but allow all for service_role key)
ALTER TABLE workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta ENABLE ROW LEVEL SECURITY;
ALTER TABLE holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE supervisors ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_config ENABLE ROW LEVEL SECURITY;

-- Policies: allow full access via service_role key (used server-side)
CREATE POLICY "service_role_workers" ON workers FOR ALL USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "service_role_attendance" ON attendance FOR ALL USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "service_role_meta" ON meta FOR ALL USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "service_role_holidays" ON holidays FOR ALL USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "service_role_supervisors" ON supervisors FOR ALL USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "service_role_shift_config" ON shift_config FOR ALL USING (TRUE) WITH CHECK (TRUE);
