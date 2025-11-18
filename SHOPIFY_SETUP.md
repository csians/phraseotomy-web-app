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
   - **Proxy URL**: `https://phraseotomy-web-app.vercel.app/play`
   
   ⚠️ **IMPORTANT**: Replace `phraseotomy-web-app.vercel.app` with your **actual Vercel deployment URL**
   
4. Save the configuration

This will allow users to access your app at:
- Staging: `https://testing-cs-store.myshopify.com/apps/phraseotomy`
- Production: `https://phraseotomy.com/apps/phraseotomy`
- The Shopify proxy will forward requests to your Vercel deployment and append query parameters like `?shop=testing-cs-store.myshopify.com`

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

### White Page / App Not Loading

If you see a blank/white page when visiting `https://testing-cs-store.myshopify.com/apps/phraseotomy`:

1. **Check App Proxy URL**:
   - In Shopify Partner Dashboard → Your App → Configuration → App proxy
   - Verify the **Proxy URL** points to your deployed Vercel app (e.g., `https://phraseotomy-web-app.vercel.app/play`)
   - **Not**: Edge function URL, localhost, or placeholder domain
   
2. **Verify Vercel Deployment**:
   - Visit your Vercel deployment directly: `https://phraseotomy-web-app.vercel.app/play?shop=testing-cs-store.myshopify.com`
   - This should load the app and show tenant information
   - If this doesn't work, your app isn't deployed correctly
   
3. **Check Browser Console**:
   - Open Developer Tools (F12 or right-click → Inspect)
   - Go to the Console tab
   - Look for JavaScript errors (red messages)
   - Go to Network tab and check if files are loading (200 status codes)

4. **Verify Tenant Data**:
   - Check Supabase → Table Editor → tenants table
   - Ensure `shop_domain` is exactly `testing-cs-store.myshopify.com`
   - Ensure `is_active` is `true`

### "No shop parameter detected"

This means the shop parameter isn't being passed:
- Double-check your App Proxy configuration in Shopify
- Make sure you're accessing via: `https://your-store.myshopify.com/apps/phraseotomy` (not the direct Vercel URL)

### "Unknown tenant for this shop domain"

This means the tenant record doesn't exist or doesn't match:
- Verify you've run the SQL INSERT from Step 3
- Check that `shop_domain` matches exactly (case-sensitive)
- In Supabase, query: `SELECT * FROM tenants WHERE shop_domain = 'testing-cs-store.myshopify.com'`

### Environment Variable Issues

Your Vercel deployment needs these variables (should be set automatically):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`

## References

- [Shopify App Proxy Documentation](https://shopify.dev/docs/apps/build/online-store/app-proxies)
- [Authenticate App Proxies](https://shopify.dev/docs/apps/build/online-store/app-proxies/authenticate-app-proxies)
