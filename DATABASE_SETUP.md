# Database Setup Instructions

## Supabase Database Schema

This document outlines the database setup required for the AI Assistant application.

### Prerequisites

1. Supabase CLI installed: `npm install -g supabase`
2. Supabase project created
3. Environment variables configured in `.env.local`

### Migration Files

The following migration files are included:

#### `001_create_gmail_tokens_table.sql`
- Creates `gmail_tokens` table for secure OAuth token storage
- Implements Row Level Security (RLS) policies
- Adds proper indexing for performance
- Includes auto-updating timestamps

### Running Migrations

#### Option 1: Manual SQL Execution
1. Open Supabase Dashboard → SQL Editor
2. Copy and paste the migration SQL
3. Execute the query

#### Option 2: Supabase CLI (Recommended)
```bash
# Initialize Supabase in your project
supabase init

# Link to your remote project
supabase link --project-ref your-project-ref

# Run migrations
supabase db push
```

### Database Schema Overview

```sql
-- Core tables from README.md
emails (
  id, user_id, gmail_id, subject, sender_email, sender_name,
  received_at, classification, processed_at, created_at, updated_at
)

user_preferences (
  id, user_id, email_classification_enabled, auto_unsubscribe_enabled,
  priority_categories, working_hours, notification_settings,
  created_at, updated_at
)

-- New table for Gmail integration
gmail_tokens (
  id, user_id, access_token, refresh_token, scope, token_type,
  expiry_date, created_at, updated_at
)
```

### Security Features

- **Row Level Security (RLS)**: All tables have RLS enabled
- **User Isolation**: Users can only access their own data
- **Secure Token Storage**: OAuth tokens are properly isolated per user
- **Audit Trail**: All tables include created_at/updated_at timestamps

### Verification

After running migrations, verify the setup:

```sql
-- Check if tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('emails', 'user_preferences', 'gmail_tokens');

-- Verify RLS is enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('emails', 'user_preferences', 'gmail_tokens');
```

### Next Steps

1. Run the migration to create `gmail_tokens` table
2. Test the Gmail OAuth integration
3. Add email processing and classification features