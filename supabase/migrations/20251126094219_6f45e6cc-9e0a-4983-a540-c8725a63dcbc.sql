-- Drop the existing SELECT policy for game_turns
DROP POLICY IF EXISTS "Players can view turns in their session" ON game_turns;

-- Create new SELECT policy that includes both players and hosts
CREATE POLICY "Players and hosts can view turns in their session"
ON game_turns
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM game_players
    WHERE game_players.session_id = game_turns.session_id
  )
  OR
  EXISTS (
    SELECT 1 FROM game_sessions
    WHERE game_sessions.id = game_turns.session_id
    AND game_sessions.host_customer_id = auth.uid()::text
  )
);