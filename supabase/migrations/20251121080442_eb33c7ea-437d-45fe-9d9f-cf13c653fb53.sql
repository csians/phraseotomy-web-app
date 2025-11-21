-- Make the audio_uploads bucket public so audio files can be played
UPDATE storage.buckets 
SET public = true 
WHERE id = 'audio_uploads';