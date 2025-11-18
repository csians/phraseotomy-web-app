-- Allow public read access to active tenants by shop domain
-- This is needed for the Shopify App Proxy to fetch tenant configuration
CREATE POLICY "Public can view active tenants by shop domain"
ON public.tenants
FOR SELECT
USING (is_active = true);