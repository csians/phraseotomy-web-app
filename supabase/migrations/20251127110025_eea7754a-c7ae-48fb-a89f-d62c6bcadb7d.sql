-- Add public SELECT policy for game_players to enable realtime subscriptions
-- This is safe since player names and scores are not sensitive data

CREATE POLICY "Anyone can view game players" 
ON public.game_players 
FOR SELECT 
USING (true);

-- Also add public SELECT policy for game_sessions to allow realtime
CREATE POLICY "Anyone can view active game sessions" 
ON public.game_sessions 
FOR SELECT 
USING (status IN ('waiting', 'active'));

-- Add public SELECT policy for game_turns to allow realtime
CREATE POLICY "Anyone can view game turns" 
ON public.game_turns 
FOR SELECT 
USING (true);