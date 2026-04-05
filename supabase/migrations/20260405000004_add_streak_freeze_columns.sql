-- Add streak freeze columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS streak_freeze_available boolean DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS streak_freeze_used_at timestamptz DEFAULT NULL;
