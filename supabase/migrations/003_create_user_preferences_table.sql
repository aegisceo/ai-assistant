-- Create user_preferences table
-- Stores user settings and preferences for email classification
CREATE TABLE IF NOT EXISTS user_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    email_classification_enabled BOOLEAN NOT NULL DEFAULT true,
    auto_unsubscribe_enabled BOOLEAN NOT NULL DEFAULT false,
    priority_categories JSONB NOT NULL DEFAULT '["work", "financial", "opportunity"]'::jsonb,
    working_hours JSONB NOT NULL DEFAULT '{"start": "09:00", "end": "17:00", "days": [1, 2, 3, 4, 5]}'::jsonb,
    notification_settings JSONB NOT NULL DEFAULT '{"urgent_emails": true, "upcoming_events": true, "missed_opportunities": true}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create unique index on user_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);

-- Enable Row Level Security
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own preferences" ON user_preferences
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own preferences" ON user_preferences
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own preferences" ON user_preferences
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own preferences" ON user_preferences
    FOR DELETE USING (auth.uid() = user_id);