-- Migration: Add multi-account support for Gmail
-- Description: Allow users to connect multiple Gmail accounts

-- First, backup existing data and update the schema
-- Add account_label to distinguish between accounts
ALTER TABLE gmail_tokens ADD COLUMN account_label TEXT;
ALTER TABLE gmail_tokens ADD COLUMN account_email TEXT;
ALTER TABLE gmail_tokens ADD COLUMN is_primary BOOLEAN DEFAULT FALSE;

-- Drop the unique constraint on user_id since users can have multiple accounts now
ALTER TABLE gmail_tokens DROP CONSTRAINT unique_user_gmail_tokens;

-- Add new constraint: unique combination of user_id and account_email
ALTER TABLE gmail_tokens ADD CONSTRAINT unique_user_account_email UNIQUE (user_id, account_email);

-- Add index for account_email lookups
CREATE INDEX idx_gmail_tokens_account_email ON gmail_tokens(account_email);
CREATE INDEX idx_gmail_tokens_user_id_primary ON gmail_tokens(user_id, is_primary);

-- Update existing records to be primary accounts
UPDATE gmail_tokens SET is_primary = TRUE WHERE account_label IS NULL;
UPDATE gmail_tokens SET account_label = 'Primary Account' WHERE account_label IS NULL;

-- Add comments for new columns
COMMENT ON COLUMN gmail_tokens.account_label IS 'User-friendly label for this Gmail account (e.g., "Work", "Personal")';
COMMENT ON COLUMN gmail_tokens.account_email IS 'Email address of the connected Gmail account';
COMMENT ON COLUMN gmail_tokens.is_primary IS 'Whether this is the users primary Gmail account';

-- Update RLS policies to work with multiple accounts
-- (The existing policies will continue to work as they filter by user_id)

-- Create a function to ensure only one primary account per user
CREATE OR REPLACE FUNCTION ensure_single_primary_account()
RETURNS TRIGGER AS $$
BEGIN
  -- If setting an account as primary, unset all other primary accounts for this user
  IF NEW.is_primary = TRUE THEN
    UPDATE gmail_tokens 
    SET is_primary = FALSE 
    WHERE user_id = NEW.user_id 
    AND id != COALESCE(NEW.id, gen_random_uuid());
  END IF;
  
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to enforce single primary account
CREATE TRIGGER enforce_single_primary_account
  BEFORE INSERT OR UPDATE ON gmail_tokens
  FOR EACH ROW
  EXECUTE FUNCTION ensure_single_primary_account();