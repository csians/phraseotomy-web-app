-- Add duration_seconds and mime_type to game_audio table
ALTER TABLE game_audio
ADD COLUMN duration_seconds DECIMAL(10, 2),
ADD COLUMN mime_type TEXT;

-- Add comment for clarity
COMMENT ON COLUMN game_audio.duration_seconds IS 'Duration of audio recording in seconds';
COMMENT ON COLUMN game_audio.mime_type IS 'MIME type of the audio file (e.g., audio/webm, audio/mp3)';