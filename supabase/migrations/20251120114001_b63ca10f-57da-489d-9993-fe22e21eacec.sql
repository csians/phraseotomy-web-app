-- Create security definer function to check if user is in a game session
-- This prevents infinite recursion in RLS policies
CREATE OR REPLACE FUNCTION public.user_is_in_session(_user_id text, _session_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM game_players
    WHERE session_id = _session_id
      AND player_id = _user_id
  )
$$;

-- Drop the existing recursive policy
DROP POLICY IF EXISTS "Users can view players in their sessions" ON game_players;

-- Create new policy using the security definer function
CREATE POLICY "Users can view players in their sessions"
ON game_players
FOR SELECT
USING (
  public.user_is_in_session((auth.uid())::text, session_id)
);

-- Also update the game_rounds policy to use the same pattern
DROP POLICY IF EXISTS "Users can view rounds in their sessions" ON game_rounds;

CREATE POLICY "Users can view rounds in their sessions"
ON game_rounds
FOR SELECT
USING (
  public.user_is_in_session((auth.uid())::text, session_id)
);

-- Update game_audio policy
DROP POLICY IF EXISTS "Users can view audio in their sessions" ON game_audio;

CREATE POLICY "Users can view audio in their sessions"
ON game_audio
FOR SELECT
USING (
  public.user_is_in_session((auth.uid())::text, session_id)
);