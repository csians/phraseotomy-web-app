-- Add turn_mode column to game_turns table
ALTER TABLE public.game_turns 
ADD COLUMN turn_mode text NOT NULL DEFAULT 'audio';

-- Add comment for clarity
COMMENT ON COLUMN public.game_turns.turn_mode IS 'Mode for this turn: audio (record story) or elements (arrange elements)';