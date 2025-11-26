-- Create RLS policies for audio_uploads storage bucket

-- Allow authenticated users to upload audio files
CREATE POLICY "Players can upload turn audio"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'audio_uploads'
  AND (storage.foldername(name))[1] LIKE 'turn_%'
);

-- Allow authenticated users to view audio files
CREATE POLICY "Players can view turn audio"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'audio_uploads'
);

-- Allow authenticated users to delete their own audio files
CREATE POLICY "Players can delete turn audio"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'audio_uploads'
  AND (storage.foldername(name))[1] LIKE 'turn_%'
);