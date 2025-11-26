-- Enable real-time for game tables to ensure all players see updates instantly

-- Set replica identity to FULL for complete row data during updates
ALTER TABLE game_sessions REPLICA IDENTITY FULL;
ALTER TABLE game_turns REPLICA IDENTITY FULL;
ALTER TABLE game_players REPLICA IDENTITY FULL;
ALTER TABLE game_guesses REPLICA IDENTITY FULL;

-- Add tables to realtime publication if not already added
DO $$
BEGIN
  -- Add game_sessions
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'game_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE game_sessions;
  END IF;

  -- Add game_turns
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'game_turns'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE game_turns;
  END IF;

  -- Add game_players
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'game_players'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE game_players;
  END IF;

  -- Add game_guesses
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'game_guesses'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE game_guesses;
  END IF;
END $$;