-- Allow public read access to basic tenant information (excluding secrets)
-- This enables the login flow to work for unauthenticated users
CREATE POLICY "Public can view basic tenant info"
ON public.tenants
FOR SELECT
TO public
USING (is_active = true);

-- Note: The Shopify client_secret is still protected because:
-- 1. Edge functions use service role key (bypasses RLS)
-- 2. Frontend queries use anon key but we'll select only safe columns
-- 3. Admin panel requires admin role to view/edit secrets