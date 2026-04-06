-- Migration: Create credits system for user token usage tracking
-- Date: 2025-01-XX
-- Purpose: Track user credits and model pricing for token-based billing

BEGIN;

-- Create user_credits table to track user credit balance
CREATE TABLE IF NOT EXISTS user_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  credits DECIMAL(10, 2) NOT NULL DEFAULT 100.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT user_credits_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create credit_transactions table to track credit usage history
CREATE TABLE IF NOT EXISTS credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  model_name TEXT NOT NULL,
  tokens_used INTEGER NOT NULL,
  credits_deducted DECIMAL(10, 4) NOT NULL,
  price_per_token DECIMAL(20, 10) NOT NULL,
  credits_before DECIMAL(10, 2) NOT NULL,
  credits_after DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT credit_transactions_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create model_pricing table to store dynamic pricing per token
CREATE TABLE IF NOT EXISTS model_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id TEXT NOT NULL UNIQUE,
  model_name TEXT NOT NULL,
  price_per_token DECIMAL(20, 10) NOT NULL,
  provider TEXT NOT NULL, -- 'gemini', 'replicate', etc.
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default model pricing (approximate values - should be updated dynamically)
-- Gemini models (pricing per 1M tokens)
INSERT INTO model_pricing (model_id, model_name, price_per_token, provider) VALUES
  ('gemini-2.0-flash', 'Gemini 2.0 Flash', 0.000000075, 'gemini'), -- $0.075 per 1M tokens
  ('gemini-1.5-pro', 'Gemini 1.5 Pro', 0.00000125, 'gemini'), -- $1.25 per 1M tokens
  ('gemini-1.5-flash', 'Gemini 1.5 Flash', 0.000000075, 'gemini') -- $0.075 per 1M tokens
ON CONFLICT (model_id) DO NOTHING;

-- Replicate models (approximate pricing - these are per image/request, not per token)
-- We'll use estimated token equivalents for credit calculation
INSERT INTO model_pricing (model_id, model_name, price_per_token, provider) VALUES
  ('black-forest-labs/flux-1.1-pro-ultra', 'FLUX 1.1 Pro Ultra', 0.00011, 'replicate'), -- ~$0.11 per image (estimated 1000 tokens)
  ('black-forest-labs/flux-redux-dev', 'FLUX.1 Redux', 0.00015, 'replicate'), -- ~$0.15 per image
  ('black-forest-labs/flux-canny-pro', 'FLUX Canny Pro', 0.00006, 'replicate'), -- ~$0.06 per image
  ('bytedance/seedream-4', 'Seedream-4', 0.00003, 'replicate'), -- $0.03 per image
  ('reve/edit', 'Reve Edit', 0.00004, 'replicate'), -- ~$0.04 per image
  ('lucataco/moondream2', 'Moondream2 (Image Describer)', 0.00001, 'replicate'), -- ~$0.01 per request
  ('pixverse/pixverse-v4.5', 'Pixverse v4.5', 0.00050, 'replicate') -- ~$0.50 per video
ON CONFLICT (model_id) DO NOTHING;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_credits_user_id ON user_credits(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at ON credit_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_model_pricing_model_id ON model_pricing(model_id);

-- Enable Row-Level Security
ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_pricing ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_credits
CREATE POLICY "Users can read own credits"
  ON user_credits FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own credits"
  ON user_credits FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policies for credit_transactions
CREATE POLICY "Users can read own transactions"
  ON credit_transactions FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policies for model_pricing (read-only for all authenticated users)
CREATE POLICY "Authenticated users can read model pricing"
  ON model_pricing FOR SELECT
  USING (auth.role() = 'authenticated');

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to update updated_at on user_credits
CREATE TRIGGER update_user_credits_updated_at
  BEFORE UPDATE ON user_credits
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMIT;

