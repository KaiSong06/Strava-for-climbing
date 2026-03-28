-- Migration 008: Supabase Auth
-- Replace custom email/password auth with Supabase Auth (phone + password, SMS OTP).
-- Supabase manages sessions, tokens, and verification — we no longer need these columns/tables.

-- Add phone column
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT UNIQUE;

-- Drop email-related columns
ALTER TABLE users DROP COLUMN IF EXISTS password_hash;
ALTER TABLE users DROP COLUMN IF EXISTS email;
ALTER TABLE users DROP COLUMN IF EXISTS email_verified;

-- Drop custom auth tables (Supabase manages sessions and tokens)
DROP TABLE IF EXISTS refresh_tokens;
DROP TABLE IF EXISTS email_verification_tokens;
DROP TABLE IF EXISTS password_reset_tokens;
