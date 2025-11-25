-- Create function to increment player score
CREATE OR REPLACE FUNCTION public.increment_player_score(p_player_id TEXT, p_points INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE game_players
  SET score = score + p_points
  WHERE player_id = p_player_id;
END;
$$;