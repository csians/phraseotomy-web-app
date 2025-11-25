-- Drop existing admin-only policies on packs table
DROP POLICY IF EXISTS "Admins can view all packs" ON public.packs;
DROP POLICY IF EXISTS "Admins can insert packs" ON public.packs;
DROP POLICY IF EXISTS "Admins can update packs" ON public.packs;
DROP POLICY IF EXISTS "Admins can delete packs" ON public.packs;

-- Create new tenant-scoped policies that work with Shopify authentication
-- Allow public read access to packs (needed for game selection)
CREATE POLICY "Anyone can view packs"
ON public.packs
FOR SELECT
USING (true);

-- For admin operations, we'll use edge functions with service role
-- This provides better security than relying on RLS for write operations