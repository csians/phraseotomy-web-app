-- Add turn_mode column to game_sessions to persist mode selection at session level
ALTER TABLE public.game_sessions 
ADD COLUMN IF NOT EXISTS turn_mode text DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.game_sessions.turn_mode IS 'Session-level turn mode: audio or elements. When set, skips per-turn mode selection.';
