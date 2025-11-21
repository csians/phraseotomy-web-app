-- Enable realtime for game_sessions table
ALTER TABLE public.game_sessions REPLICA IDENTITY FULL;

-- Enable realtime for game_players table
ALTER TABLE public.game_players REPLICA IDENTITY FULL;

-- Add tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_players;