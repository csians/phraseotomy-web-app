-- Rename columns to match Shopify's current terminology
ALTER TABLE public.tenants 
  RENAME COLUMN shopify_api_key TO shopify_client_id;

ALTER TABLE public.tenants 
  RENAME COLUMN shopify_api_secret TO shopify_client_secret;

-- Add comment to clarify usage
COMMENT ON COLUMN public.tenants.shopify_client_id IS 'Shopify App Client ID from app credentials';
COMMENT ON COLUMN public.tenants.shopify_client_secret IS 'Shopify App Client Secret - used for HMAC verification of App Proxy requests';