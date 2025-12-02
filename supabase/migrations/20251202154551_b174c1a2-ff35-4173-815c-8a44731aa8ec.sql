-- Enable REPLICA IDENTITY FULL on game_players for realtime DELETE events
ALTER TABLE public.game_players REPLICA IDENTITY FULL;