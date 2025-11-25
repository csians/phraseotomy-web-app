-- Create storage policies for audio_uploads bucket to allow game turn recordings

-- Allow authenticated users to upload their own audio files
CREATE POLICY "Users can upload game audio"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'audio_uploads' AND
  auth.uid() IS NOT NULL
);

-- Allow users to view audio in their game sessions
CREATE POLICY "Users can view game audio"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'audio_uploads');

-- Allow users to delete their own audio files
CREATE POLICY "Users can delete their game audio"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'audio_uploads' AND
  auth.uid() IS NOT NULL
);