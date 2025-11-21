-- Add selected_audio_id column to game_sessions table
ALTER TABLE game_sessions
ADD COLUMN selected_audio_id uuid REFERENCES customer_audio(id) ON DELETE SET NULL;

-- Add index for better query performance
CREATE INDEX idx_game_sessions_selected_audio ON game_sessions(selected_audio_id);