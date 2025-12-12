-- Add storage policies for element_images bucket to allow admin uploads
CREATE POLICY "Admins can upload element images"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'element_images' AND
  public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Admins can update element images"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'element_images' AND
  public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Admins can delete element images"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'element_images' AND
  public.has_role(auth.uid(), 'admin')
);