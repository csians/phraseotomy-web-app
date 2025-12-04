-- Add game mode and timer columns to game_sessions
ALTER TABLE public.game_sessions 
ADD COLUMN IF NOT EXISTS game_mode text NOT NULL DEFAULT 'live' CHECK (game_mode IN ('live', 'async')),
ADD COLUMN IF NOT EXISTS timer_preset text DEFAULT 'normal' CHECK (timer_preset IN ('quick', 'normal', 'extended', NULL)),
ADD COLUMN IF NOT EXISTS story_time_seconds integer DEFAULT 600,
ADD COLUMN IF NOT EXISTS guess_time_seconds integer DEFAULT 420;

-- Add comment for documentation
COMMENT ON COLUMN public.game_sessions.game_mode IS 'Game mode: live (timed) or async (no time limits)';
COMMENT ON COLUMN public.game_sessions.timer_preset IS 'Timer preset for live mode: quick (5/3 min), normal (10/7 min), extended (15/10 min)';
COMMENT ON COLUMN public.game_sessions.story_time_seconds IS 'Time allowed for storytelling in seconds';
COMMENT ON COLUMN public.game_sessions.guess_time_seconds IS 'Time allowed for guessing in seconds';