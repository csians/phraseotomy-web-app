-- Add whisp column to game_turns table to store the one-word hint
ALTER TABLE public.game_turns ADD COLUMN whisp TEXT;

-- Add index for faster queries
CREATE INDEX idx_game_turns_whisp ON public.game_turns(whisp) WHERE whisp IS NOT NULL;