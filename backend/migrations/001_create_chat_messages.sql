-- Migration: Create chat_messages table for persistent AI chat history
-- Date: 2025-11-27
-- Purpose: Store short-term conversation memory per project/user

BEGIN;

-- Create chat_messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  user_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  phase TEXT CHECK (phase IN ('STRATEGY', 'EXECUTION', 'REFINEMENT')),
  images JSONB DEFAULT '[]'::jsonb,
  actions JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chat_messages_project_id_fkey
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  CONSTRAINT chat_messages_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create indexes for performance
-- Index for fetching last 50 messages per project
CREATE INDEX IF NOT EXISTS idx_chat_messages_project_created
  ON chat_messages(project_id, created_at DESC);

-- Index for user-based queries (RLS)
CREATE INDEX IF NOT EXISTS idx_chat_messages_user
  ON chat_messages(user_id);

-- Composite index for the most common query pattern
CREATE INDEX IF NOT EXISTS idx_chat_messages_project_user_created
  ON chat_messages(project_id, user_id, created_at DESC);

-- Enable Row-Level Security
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only read their own chat messages
CREATE POLICY "Users can read own chat messages"
  ON chat_messages FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policy: Users can only insert their own chat messages
CREATE POLICY "Users can insert own chat messages"
  ON chat_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can only update their own chat messages
CREATE POLICY "Users can update own chat messages"
  ON chat_messages FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policy: Users can only delete their own chat messages
CREATE POLICY "Users can delete own chat messages"
  ON chat_messages FOR DELETE
  USING (auth.uid() = user_id);

COMMIT;

-- To apply this migration:
-- 1. Copy this SQL
-- 2. Go to Supabase Dashboard → SQL Editor
-- 3. Paste and run this migration
-- 4. Verify table created: SELECT * FROM chat_messages LIMIT 1;
