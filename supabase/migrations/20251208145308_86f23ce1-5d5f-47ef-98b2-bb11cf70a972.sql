-- Create storage bucket for element/whisp images
INSERT INTO storage.buckets (id, name, public)
VALUES ('element_images', 'element_images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to element images
CREATE POLICY "Anyone can view element images"
ON storage.objects FOR SELECT
USING (bucket_id = 'element_images');

-- Allow authenticated users to upload element images
CREATE POLICY "Authenticated users can upload element images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'element_images' AND auth.role() = 'authenticated');

-- Allow authenticated users to delete element images
CREATE POLICY "Authenticated users can delete element images"
ON storage.objects FOR DELETE
USING (bucket_id = 'element_images' AND auth.role() = 'authenticated');

-- Add image_url column to elements table if not exists
ALTER TABLE public.elements
ADD COLUMN IF NOT EXISTS image_url text;