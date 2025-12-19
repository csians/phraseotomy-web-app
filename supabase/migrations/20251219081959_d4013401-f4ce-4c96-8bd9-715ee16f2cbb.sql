-- Add storage policies for audio_uploads bucket to allow authenticated uploads

-- Allow anyone to upload audio to the audio_uploads bucket
CREATE POLICY "Anyone can upload audio to audio_uploads"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'audio_uploads');

-- Allow anyone to read audio from the audio_uploads bucket (it's public)
CREATE POLICY "Anyone can read audio from audio_uploads"
ON storage.objects
FOR SELECT
USING (bucket_id = 'audio_uploads');

-- Allow anyone to update their uploaded audio
CREATE POLICY "Anyone can update audio in audio_uploads"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'audio_uploads');

-- Allow anyone to delete audio from audio_uploads
CREATE POLICY "Anyone can delete audio from audio_uploads"
ON storage.objects
FOR DELETE
USING (bucket_id = 'audio_uploads');