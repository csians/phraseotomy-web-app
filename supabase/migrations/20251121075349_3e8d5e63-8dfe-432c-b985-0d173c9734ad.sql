-- Drop the old constraint
ALTER TABLE game_sessions DROP CONSTRAINT IF EXISTS game_sessions_status_check;

-- Add the new constraint with 'active' included
ALTER TABLE game_sessions ADD CONSTRAINT game_sessions_status_check 
CHECK (status = ANY (ARRAY['waiting'::text, 'active'::text, 'in_progress'::text, 'completed'::text, 'cancelled'::text]));