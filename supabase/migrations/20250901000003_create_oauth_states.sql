-- Create oauth_states table for CSRF protection during OAuth flows
CREATE TABLE IF NOT EXISTS public.oauth_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    state TEXT NOT NULL UNIQUE,
    provider TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on state for fast lookups
CREATE INDEX IF NOT EXISTS oauth_states_state_idx ON public.oauth_states(state);

-- Create index on user_id for cleanup
CREATE INDEX IF NOT EXISTS oauth_states_user_id_idx ON public.oauth_states(user_id);

-- Create index on expires_at for cleanup
CREATE INDEX IF NOT EXISTS oauth_states_expires_at_idx ON public.oauth_states(expires_at);

-- Enable Row Level Security
ALTER TABLE public.oauth_states ENABLE ROW LEVEL SECURITY;

-- Create RLS policy - users can only access their own OAuth states
CREATE POLICY "Users can manage their own OAuth states" ON public.oauth_states
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Create function to clean up expired OAuth states
CREATE OR REPLACE FUNCTION cleanup_expired_oauth_states()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    DELETE FROM public.oauth_states 
    WHERE expires_at < NOW();
END;
$$;

-- Create trigger to automatically clean up expired states daily
-- Note: In production, this should be handled by a cron job or scheduled function
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Comment: Add cron job to clean up expired states (requires pg_cron extension)
-- SELECT cron.schedule('cleanup-oauth-states', '0 2 * * *', 'SELECT cleanup_expired_oauth_states();');