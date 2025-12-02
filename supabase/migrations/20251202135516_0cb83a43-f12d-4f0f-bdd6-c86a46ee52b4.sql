-- Add game_name column to game_sessions table
ALTER TABLE public.game_sessions 
ADD COLUMN game_name text;