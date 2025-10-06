-- Create classification_progress table
-- Tracks batch email classification progress for real-time updates
CREATE TABLE IF NOT EXISTS classification_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    total_emails INTEGER NOT NULL DEFAULT 0,
    processed_emails INTEGER NOT NULL DEFAULT 0,
    successful_emails INTEGER NOT NULL DEFAULT 0,
    failed_emails INTEGER NOT NULL DEFAULT 0,
    current_email_index INTEGER NOT NULL DEFAULT 0,
    current_email_subject TEXT,
    started_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    estimated_time_remaining_ms BIGINT,
    average_processing_time_ms BIGINT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_classification_progress_user_id ON classification_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_classification_progress_session_id ON classification_progress(session_id);
CREATE INDEX IF NOT EXISTS idx_classification_progress_status ON classification_progress(status);
CREATE INDEX IF NOT EXISTS idx_classification_progress_updated_at ON classification_progress(updated_at DESC);

-- Create unique constraint on session_id and user_id as used in upsert
CREATE UNIQUE INDEX IF NOT EXISTS idx_classification_progress_session_user_unique ON classification_progress(session_id, user_id);

-- Enable Row Level Security
ALTER TABLE classification_progress ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own progress" ON classification_progress
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own progress" ON classification_progress
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own progress" ON classification_progress
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own progress" ON classification_progress
    FOR DELETE USING (auth.uid() = user_id);