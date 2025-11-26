-- Drop existing policies that might be too restrictive
DROP POLICY IF EXISTS "Allow authenticated users to upload audio" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to read audio" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete audio" ON storage.objects;

-- Create new policies that allow public access for game audio uploads
-- This is needed because users are authenticated via custom customer_id, not Supabase auth

CREATE POLICY "Allow public to upload game audio"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (bucket_id = 'audio_uploads' AND (storage.foldername(name))[1] = 'turn_' OR name LIKE 'turn_%');

CREATE POLICY "Allow public to read game audio"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'audio_uploads');

CREATE POLICY "Allow public to delete game audio"
ON storage.objects
FOR DELETE
TO public
USING (bucket_id = 'audio_uploads' AND (storage.foldername(name))[1] = 'turn_' OR name LIKE 'turn_%');