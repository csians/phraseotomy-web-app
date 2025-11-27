-- Enable realtime for game_players table
ALTER TABLE public.game_players REPLICA IDENTITY FULL;

-- Add game_players to realtime publication (drop and re-add if exists)
DO $$
BEGIN
  -- Check if the table is already in the publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'game_players'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.game_players;
  END IF;
END $$;

-- Also enable realtime for game_sessions and game_turns if not already
ALTER TABLE public.game_sessions REPLICA IDENTITY FULL;
ALTER TABLE public.game_turns REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'game_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.game_sessions;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'game_turns'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.game_turns;
  END IF;
END $$;