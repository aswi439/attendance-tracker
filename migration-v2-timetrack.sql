-- WorkTrack Migration v2: Time Tracking, Shift Config & Wage Calculation
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- 1. Shift configuration table
CREATE TABLE IF NOT EXISTS shift_config (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  shift_start TEXT NOT NULL DEFAULT '09:00',
  shift_end TEXT NOT NULL DEFAULT '18:00',
  work_hours NUMERIC NOT NULL DEFAULT 8,
  lunch_hours NUMERIC NOT NULL DEFAULT 1,
  updated_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE shift_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_shift_config" ON shift_config FOR ALL USING (TRUE) WITH CHECK (TRUE);

INSERT INTO shift_config (shift_start, shift_end, work_hours, lunch_hours)
SELECT '09:00', '18:00', 8, 1
WHERE NOT EXISTS (SELECT 1 FROM shift_config LIMIT 1);

-- 2. Add time tracking columns to attendance
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS time_in TEXT;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS time_out TEXT;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS total_hours NUMERIC;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS lunch_hours NUMERIC DEFAULT 0;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS duty_hours NUMERIC;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS overtime_hours NUMERIC DEFAULT 0;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS daily_wage NUMERIC DEFAULT 0;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS overtime_wage NUMERIC DEFAULT 0;

-- 3. Add salary fields to workers
ALTER TABLE workers ADD COLUMN IF NOT EXISTS basic_salary NUMERIC DEFAULT 0;
ALTER TABLE workers ADD COLUMN IF NOT EXISTS allowance NUMERIC DEFAULT 0;
ALTER TABLE workers ADD COLUMN IF NOT EXISTS ot_rate NUMERIC DEFAULT 0;
ALTER TABLE workers ADD COLUMN IF NOT EXISTS designation TEXT;
