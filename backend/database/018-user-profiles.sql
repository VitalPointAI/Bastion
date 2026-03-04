-- 018-user-profiles.sql
-- User profile data (display name, org email) linked to NEAR account.
-- Separate from anon_users (auth package) to avoid modifying package schema.

CREATE TABLE IF NOT EXISTS user_profiles (
  id SERIAL PRIMARY KEY,
  near_account_id TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  org_email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_near_account ON user_profiles (near_account_id);
