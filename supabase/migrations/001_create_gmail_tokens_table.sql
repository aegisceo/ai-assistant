-- Migration: Create gmail_tokens table for storing user Gmail OAuth tokens
-- Description: Secure storage of Gmail authentication tokens with proper indexing and RLS

-- Create gmail_tokens table
CREATE TABLE gmail_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.modify',
  token_type TEXT NOT NULL DEFAULT 'Bearer',
  expiry_date TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  -- Ensure one token set per user
  CONSTRAINT unique_user_gmail_tokens UNIQUE (user_id)
);

-- Create indexes for performance
CREATE INDEX idx_gmail_tokens_user_id ON gmail_tokens(user_id);
CREATE INDEX idx_gmail_tokens_expiry_date ON gmail_tokens(expiry_date);

-- Enable Row Level Security
ALTER TABLE gmail_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own tokens
CREATE POLICY "Users can view their own Gmail tokens" ON gmail_tokens
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own Gmail tokens" ON gmail_tokens
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own Gmail tokens" ON gmail_tokens
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own Gmail tokens" ON gmail_tokens
  FOR DELETE USING (auth.uid() = user_id);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-update updated_at
CREATE TRIGGER update_gmail_tokens_updated_at
  BEFORE UPDATE ON gmail_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add helpful comments
COMMENT ON TABLE gmail_tokens IS 'Stores encrypted Gmail OAuth2 tokens for users';
COMMENT ON COLUMN gmail_tokens.access_token IS 'Gmail API access token - expires periodically';
COMMENT ON COLUMN gmail_tokens.refresh_token IS 'Gmail API refresh token - used to get new access tokens';
COMMENT ON COLUMN gmail_tokens.scope IS 'OAuth scopes granted for Gmail API access';
COMMENT ON COLUMN gmail_tokens.expiry_date IS 'When the access token expires';
COMMENT ON CONSTRAINT unique_user_gmail_tokens ON gmail_tokens IS 'Each user can have only one set of Gmail tokens';