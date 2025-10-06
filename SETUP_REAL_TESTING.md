# 🚀 Real Testing Setup Guide

Follow these steps to connect your actual Gmail account and Claude AI for real data testing.

## Step 1: Supabase Database Setup

1. **Go to [supabase.com](https://supabase.com)** and create a free account
2. **Create a new project**:
   - Choose a name (e.g., "ai-email-assistant") 
   - Set a database password
   - Choose a region close to you
3. **Get your credentials** from Settings > API:
   - `Project URL` → Copy to `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → Copy to `NEXT_PUBLIC_SUPABASE_ANON_KEY` 
   - `service_role secret` key → Copy to `SUPABASE_SERVICE_ROLE_KEY`

4. **Set up the database schema** - Run this SQL in the Supabase SQL Editor:

```sql
-- Enable Row Level Security
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- Create emails table
CREATE TABLE emails (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    gmail_id TEXT NOT NULL,
    subject TEXT,
    sender_email TEXT NOT NULL,
    sender_name TEXT,
    received_at TIMESTAMP WITH TIME ZONE NOT NULL,
    classification JSONB,
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, gmail_id)
);

-- Create user preferences table
CREATE TABLE user_preferences (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) NOT NULL UNIQUE,
    email_classification_enabled BOOLEAN DEFAULT true,
    auto_unsubscribe_enabled BOOLEAN DEFAULT false,
    priority_categories JSONB DEFAULT '["work", "financial"]',
    working_hours JSONB DEFAULT '{"start": "09:00", "end": "17:00", "days": [1,2,3,4,5]}',
    notification_settings JSONB DEFAULT '{"urgentEmails": true, "upcomingEvents": true, "missedOpportunities": false}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create gmail tokens table
CREATE TABLE gmail_tokens (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) NOT NULL UNIQUE,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    scope TEXT NOT NULL,
    token_type TEXT DEFAULT 'Bearer',
    expiry_date TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create calendar events table
CREATE TABLE calendar_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    google_event_id TEXT NOT NULL,
    title TEXT NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    location TEXT,
    attendees_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, google_event_id)
);

-- Create classification feedback table
CREATE TABLE classification_feedback (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    email_id TEXT NOT NULL,
    original_classification JSONB NOT NULL,
    user_correction JSONB NOT NULL,
    feedback_type TEXT NOT NULL CHECK (feedback_type IN ('correction', 'confirmation', 'partial_correction')),
    user_comment TEXT,
    email_context JSONB NOT NULL,
    feedback_quality_score FLOAT DEFAULT 0.5,
    disagreement_magnitude FLOAT DEFAULT 0,
    improvement_suggestions JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create notification logs table
CREATE TABLE notification_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    check_type TEXT NOT NULL,
    notifications_count INTEGER DEFAULT 0,
    total_emails_checked INTEGER DEFAULT 0,
    check_parameters JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create meeting detections table
CREATE TABLE meeting_detections (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    total_emails_processed INTEGER NOT NULL,
    meetings_detected INTEGER NOT NULL,
    high_priority_meetings INTEGER DEFAULT 0,
    meeting_types JSONB DEFAULT '{}',
    detection_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user feedback stats table
CREATE TABLE user_feedback_stats (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) NOT NULL UNIQUE,
    total_feedback_count INTEGER DEFAULT 0,
    confirmation_count INTEGER DEFAULT 0,
    correction_count INTEGER DEFAULT 0,
    partial_correction_count INTEGER DEFAULT 0,
    average_quality_score FLOAT DEFAULT 0.5,
    last_feedback_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE gmail_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE classification_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_detections ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_feedback_stats ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies
CREATE POLICY "Users can manage their own emails" ON emails FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own preferences" ON user_preferences FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own gmail tokens" ON gmail_tokens FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own calendar events" ON calendar_events FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own feedback" ON classification_feedback FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own notification logs" ON notification_logs FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own meeting detections" ON meeting_detections FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own feedback stats" ON user_feedback_stats FOR ALL USING (auth.uid() = user_id);
```

## Step 2: Google OAuth Setup (Gmail + Calendar)

1. **Go to [Google Cloud Console](https://console.cloud.google.com/)**
2. **Create a new project** or select existing one
3. **Enable APIs**:
   - Go to "APIs & Services" > "Library"
   - Search and enable: "Gmail API"
   - Search and enable: "Google Calendar API"
4. **Create OAuth Credentials**:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth 2.0 Client IDs"
   - Application type: "Web application"
   - Name: "AI Email Assistant"
   - Authorized redirect URIs: `http://localhost:3000/api/gmail/callback`
5. **Copy credentials**:
   - `Client ID` → Copy to `GOOGLE_CLIENT_ID`
   - `Client secret` → Copy to `GOOGLE_CLIENT_SECRET`

## Step 3: Anthropic Claude API Setup

1. **Go to [Anthropic Console](https://console.anthropic.com/)**
2. **Create an account** or sign in
3. **Create an API Key**:
   - Go to "API Keys" section
   - Click "Create Key"
   - Name it "AI Email Assistant"
   - Copy the key → `ANTHROPIC_API_KEY`

## Step 4: Update Environment Variables

Edit `.env.local` with your actual values:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...

# Google OAuth Configuration
GOOGLE_CLIENT_ID=123456789-abcdefghijklmnop.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-abcdefghijklmnopqrstuvwxyz

# Anthropic Claude API Configuration
ANTHROPIC_API_KEY=sk-ant-api03-abcdefghijklmnopqrstuvwxyz...

# Next.js Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-random-secret-string-here
```

## Step 5: Test the Setup

1. **Restart the development server**:
   ```bash
   # Stop current server (Ctrl+C)
   npm run dev
   ```

2. **Open http://localhost:3000**

3. **Connect Gmail**:
   - Click "Connect Gmail" button
   - Authorize access to Gmail and Calendar
   - You should see emails loading automatically

4. **Test AI Classification**:
   - Click "Classify" on any email
   - See AI analysis with urgency, importance, category
   - Provide feedback to improve accuracy

5. **Test Smart Features**:
   - Try different filter presets (High Priority, Urgent Only, etc.)
   - Check urgent notifications at top
   - View calendar events and meeting detection

## 🎯 What You'll See With Real Data:

- **📧 Real emails** from your inbox with AI classification
- **📅 Actual calendar events** and meeting detection
- **🧠 Smart insights** based on your email patterns
- **⚡ Urgent notifications** for truly important emails
- **🔄 Learning system** that improves with your feedback

## 🚨 Security Notes:

- All tokens are encrypted and stored securely in Supabase
- Row Level Security ensures data isolation
- OAuth tokens auto-refresh when needed
- No email content is logged in development

## 🐛 Troubleshooting:

If you see errors:
1. Check all environment variables are set correctly
2. Ensure Google APIs are enabled
3. Verify OAuth redirect URI matches exactly
4. Check Supabase database schema was created successfully

Ready to test with your real inbox! 🚀