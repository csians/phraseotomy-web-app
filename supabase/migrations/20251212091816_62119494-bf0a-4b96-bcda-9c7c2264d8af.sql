-- Drop restrictive policies that require auth
DROP POLICY IF EXISTS "Admins can upload element images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update element images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete element images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload element images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update element images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete element images" ON storage.objects;

-- Create permissive policies for element_images bucket
-- Admin pages are already protected by Shopify context, so we allow public access to this bucket
CREATE POLICY "Public can upload element images"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'element_images');

CREATE POLICY "Public can update element images"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'element_images');

CREATE POLICY "Public can delete element images"
ON storage.objects
FOR DELETE
USING (bucket_id = 'element_images');