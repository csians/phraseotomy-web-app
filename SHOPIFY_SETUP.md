# Shopify App Proxy Setup Guide

This guide explains how to set up your Shopify app with the Phraseotomy application.

## Prerequisites

1. A Shopify Partner account
2. A Shopify app created in your Partner Dashboard
3. Access to your Supabase project

## Step 1: Get Your Shopify Credentials

1. Go to your [Shopify Partner Dashboard](https://partners.shopify.com/)
2. Navigate to **Apps** and select your app
3. Click on **Configuration** in the left sidebar
4. Scroll down to **Client credentials** section
5. Copy the following values:
   - **Client ID**: Used for app identification
   - **Client secret**: Used for HMAC verification (click "Show" to reveal)

## Step 2: Configure Shopify App Proxy

1. In your app configuration, scroll to **App proxy** section
2. Click **Set up** (or **Configure** if already set up)
3. Enter the following settings:
   - **Subpath prefix**: `apps`
   - **Subpath**: `phraseotomy`
   - **Proxy URL**: `https://phraseotomy.ourstagingserver.com/play`
4. Save the configuration

This will allow users to access your app at:
- Production: `https://[shop-domain]/apps/phraseotomy`
- The Shopify proxy will forward requests to your Vercel deployment

## Step 3: Add Tenant Configuration to Supabase

Run this SQL in your [Supabase SQL Editor](https://supabase.com/dashboard/project/egrwijzbxxhkhrrelsgi/sql/new):

### Production Tenant

```sql
INSERT INTO tenants (
  name, 
  shop_domain, 
  tenant_key, 
  environment, 
  shopify_client_id, 
  shopify_client_secret
)
VALUES (
  'Phraseotomy Production',
  'phraseotomy.com',  -- Your actual production shop domain
  'prod',
  'production',
  'YOUR_PRODUCTION_CLIENT_ID',  -- From Shopify Partner Dashboard
  'YOUR_PRODUCTION_CLIENT_SECRET'  -- From Shopify Partner Dashboard
);
```

### Staging Tenant

```sql
INSERT INTO tenants (
  name, 
  shop_domain, 
  tenant_key, 
  environment, 
  shopify_client_id, 
  shopify_client_secret
)
VALUES (
  'Phraseotomy Staging',
  'testing-cs-store.myshopify.com',  -- Your development store domain
  'staging',
  'staging',
  'YOUR_STAGING_CLIENT_ID',  -- From Shopify Partner Dashboard
  'YOUR_STAGING_CLIENT_SECRET'  -- From Shopify Partner Dashboard
);
```

## Step 4: Test the Integration

### Testing with Development Store

1. Install your app on your development store
2. Navigate to: `https://testing-cs-store.myshopify.com/apps/phraseotomy`
3. You should see the Phraseotomy app load with the staging configuration

### Testing with Production Store

1. Install your app on your production store
2. Navigate to: `https://phraseotomy.com/apps/phraseotomy`
3. You should see the Phraseotomy app load with the production configuration

## How It Works

1. **Shopify App Proxy**: When a customer visits `/apps/phraseotomy` on any Shopify store with your app installed, Shopify forwards the request to your proxy URL
2. **HMAC Verification**: Your app verifies the request came from Shopify using HMAC signature with the Client Secret
3. **Tenant Loading**: The app looks up the tenant configuration in Supabase based on the `shop` parameter
4. **Environment-Specific Config**: Different stores can have different configurations (staging vs production)

## Security Notes

- The **Client Secret** is sensitive and used for HMAC verification
- HMAC signature ensures requests actually come from Shopify
- Each tenant stores its own Client ID and Client Secret
- RLS policies ensure tenant data is only accessible when properly authenticated

## Troubleshooting

### "Invalid signature" error
- Verify the Client Secret is correct in your tenants table
- Check that the shop domain matches exactly

### "Tenant not found" error
- Verify the shop domain in your tenants table matches the shop parameter
- Check that `is_active` is set to `true` for the tenant

### App proxy not loading
- Verify the proxy URL in Shopify matches your Vercel deployment URL
- Check that your Vercel deployment has the correct environment variables:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_PUBLISHABLE_KEY`
  - `VITE_SUPABASE_PROJECT_ID`

## References

- [Shopify App Proxy Documentation](https://shopify.dev/docs/apps/build/online-store/app-proxies)
- [Authenticate App Proxies](https://shopify.dev/docs/apps/build/online-store/app-proxies/authenticate-app-proxies)
