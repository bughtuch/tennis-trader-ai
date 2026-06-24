-- Migration 001: Add missing subscription and trading columns to profiles
-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
--
-- Context: The codebase expects 19 columns on profiles.
-- The live DB has: id, email, full_name, company, plan, created_at, updated_at
-- This migration adds the 12 missing columns without touching existing data.
--
-- Safe to run multiple times (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).

-- Subscription columns (required for access gating)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'inactive';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_tier TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- Betfair connection columns (required for live trading)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS betfair_connected BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS betfair_session_token TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS betfair_connected_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS betfair_username TEXT;

-- Trading preference columns (required for settings page)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS default_stake NUMERIC DEFAULT 25;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS max_exposure NUMERIC DEFAULT 500;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stop_loss NUMERIC DEFAULT 50;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS auto_green_up_target NUMERIC DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS daily_loss_limit NUMERIC DEFAULT 100;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS max_single_trade NUMERIC DEFAULT 100;

-- AI and safety columns (required for settings page)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ai_guardian_enabled BOOLEAN DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ai_signals_enabled BOOLEAN DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS streak_protection_enabled BOOLEAN DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS streak_threshold INTEGER DEFAULT 3;

-- Risk management columns (required for settings persistence)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS session_time_limit TEXT DEFAULT '4hr';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS warning_percent INTEGER DEFAULT 75;

-- Verify: list all columns after migration
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'profiles'
ORDER BY ordinal_position;
