import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

/**
 * Verify Shopify HMAC signature for app proxy requests
 */
async function verifyShopifyHmac(queryParams, clientSecret) {
  const signature = queryParams.get('signature');
  if (!signature) {
    return false;
  }

  // Create a copy without the signature
  const paramsWithoutSignature = new URLSearchParams(queryParams);
  paramsWithoutSignature.delete('signature');

  // Sort and format parameters as Shopify expects
  const sortedParams = Array.from(paramsWithoutSignature.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('');

  // Generate HMAC
  const encoder = new TextEncoder();
  const keyData = encoder.encode(clientSecret);
  const messageData = encoder.encode(sortedParams);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  const calculatedSignature = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return signature === calculatedSignature;
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const queryParams = url.searchParams;
  const shop = queryParams.get('shop');

  console.log('Proxy request received:', { 
    shop, 
    hasSignature: !!queryParams.get('signature'), 
    hasCustomer: !!queryParams.get('logged_in_customer_id'),
    hasToken: !!queryParams.get('r'),
    hasRedirectTo: !!queryParams.get('redirect_to')
  });

  // CORS headers for browser requests
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // If no shop parameter, return error
  if (!shop) {
    return new Response(
      JSON.stringify({ error: 'No shop parameter', verified: false }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  try {
    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch tenant configuration (excluding secrets)
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, name, tenant_key, shop_domain, environment, is_active')
      .eq('shop_domain', shop)
      .eq('is_active', true)
      .maybeSingle();

    if (tenantError) {
      console.error('Error fetching tenant:', tenantError);
      return new Response(
        JSON.stringify({ error: tenantError.message, verified: false }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!tenant) {
      console.log('Tenant not found for shop:', shop);
      return new Response(
        generateErrorHtml(
          'Tenant Not Found',
          `No active tenant found for shop: ${shop}. Please ensure the tenant is configured in Supabase with shop_domain matching exactly.`
        ),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'text/html' },
        }
      );
    }

    // Check if we have a token parameter (from app-login redirect)
    const returnToken = queryParams.get('r') || null;
    let isTokenValid = false;
    
    if (returnToken) {
      // Verify token if present
      try {
        const APP_SECRET = Deno.env.get('APP_SIGNING_SECRET');
        if (APP_SECRET) {
          const [payloadB64, sig] = returnToken.split('.');
          if (payloadB64 && sig) {
            const encoder = new TextEncoder();
            const keyData = encoder.encode(APP_SECRET);
            const msgData = encoder.encode(payloadB64);
            
            const key = await crypto.subtle.importKey(
              'raw',
              keyData,
              { name: 'HMAC', hash: 'SHA-256' },
              false,
              ['sign']
            );
            
            const expectedSig = await crypto.subtle.sign('HMAC', key, msgData);
            const expectedSigB64 = btoa(String.fromCharCode(...new Uint8Array(expectedSig)))
              .replace(/\+/g, '-')
              .replace(/\//g, '_')
              .replace(/=/g, '');

            if (sig === expectedSigB64) {
              const payloadStr = atob(
                payloadB64
                  .replace(/-/g, '+')
                  .replace(/_/g, '/')
              );
              const payload = JSON.parse(payloadStr);
              
              // Check expiration and shop match
              if (payload.exp && Math.floor(Date.now() / 1000) <= payload.exp && payload.shop === shop) {
                isTokenValid = true;
                console.log('Token verified successfully for shop:', shop);
              }
            }
          }
        }
      } catch (error) {
        console.error('Error verifying token:', error);
      }
    }
    
    // If token is not valid, verify HMAC signature (standard Shopify proxy flow)
    if (!isTokenValid) {
      const { data: secretData, error: secretError } = await supabase
        .from('tenants')
        .select('shopify_client_secret')
        .eq('shop_domain', shop)
        .single();

      if (secretError || !secretData) {
        console.error('Error fetching tenant credentials');
        return new Response(
          generateErrorHtml('Configuration Error', 'Unable to verify request authenticity.'),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'text/html' },
          }
        );
      }

      // Verify HMAC signature
      const isValidSignature = await verifyShopifyHmac(
        queryParams,
        secretData.shopify_client_secret
      );

      if (!isValidSignature) {
        console.log('Invalid HMAC signature for shop:', shop);
        return new Response(
          generateErrorHtml(
            'Authentication Failed',
            'HMAC signature verification failed. Please check your Shopify Client Secret in the tenant configuration.'
          ),
          {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'text/html' },
          }
        );
      }

      console.log('HMAC verified successfully for tenant:', tenant.tenant_key);
    }

    // Extract customer data from Shopify proxy parameters or query parameters
    let customerId = queryParams.get('logged_in_customer_id') || queryParams.get('customer_id') || null;
    let customerEmail = queryParams.get('customer_email') || null;
    let customerFirstName = queryParams.get('customer_first_name') || null;
    let customerLastName = queryParams.get('customer_last_name') || null;
    
    let customerImageUrl = null;
    
    // If we have customer ID (from proxy params or query params), fetch full customer data from Shopify Admin API
    if (customerId) {
      try {
        const { data: secretData } = await supabase
          .from('tenants')
          .select('shopify_admin_access_token, shopify_client_secret')
          .eq('shop_domain', shop)
          .single();
        
        const accessToken = secretData?.shopify_admin_access_token || secretData?.shopify_client_secret;
        
        if (accessToken) {
          const shopName = shop.replace('.myshopify.com', '');
          const customerUrl = `https://${shopName}.myshopify.com/admin/api/2024-01/customers/${customerId}.json`;
          
          const customerResponse = await fetch(customerUrl, {
            method: 'GET',
            headers: {
              'X-Shopify-Access-Token': accessToken,
              'Content-Type': 'application/json',
            },
          });
          
          if (customerResponse.ok) {
            const customerDataFromShopify = await customerResponse.json();
            const shopifyCustomer = customerDataFromShopify.customer;
            
            // Use data from Shopify API (more complete than query params)
            customerEmail = shopifyCustomer?.email || customerEmail;
            customerFirstName = shopifyCustomer?.first_name || customerFirstName;
            customerLastName = shopifyCustomer?.last_name || customerLastName;
            customerImageUrl = shopifyCustomer?.image_url || null;
            
            console.log('✅ Fetched full customer data from Shopify Admin API');
          } else {
            console.warn('⚠️ Could not fetch customer data from Shopify Admin API, using query parameters');
          }
        }
      } catch (error) {
        console.error('Error fetching customer data from Shopify:', error);
        // Continue with query parameter data if available
      }
    }
    
    const customerData = customerId ? {
      id: customerId,
      email: customerEmail,
      firstName: customerFirstName,
      lastName: customerLastName,
      name: [customerFirstName, customerLastName].filter(Boolean).join(' ') || customerEmail || null,
      imageUrl: customerImageUrl
    } : null;

    console.log('Customer data:', customerData ? `Logged in: ${customerId}` : 'Not logged in');
    if (returnToken) {
      console.log('Return token present in request');
    }

    // Check if we should redirect back to app domain instead of loading the app here
    const redirectTo = queryParams.get('redirect_to');
    
    // Debug logging
    console.log('=== REDIRECT CHECK ===');
    console.log('redirectTo:', redirectTo);
    console.log('customerData:', !!customerData);
    console.log('customerId:', customerId);
    console.log('Will redirect?', !!(redirectTo && (customerData || customerId)));
    
    // Redirect if we have redirect_to parameter AND (customer data OR customer_id from URL)
    // This ensures redirect works even if customer data fetch fails
    if (redirectTo && (customerData || customerId)) {
      // Redirect back to app domain with customer data in URL parameters
      console.log('Redirecting back to app domain:', redirectTo);
      console.log('Has customer data:', !!customerData);
      console.log('Has customer ID:', !!customerId);
      
      try {
        const redirectUrl = new URL(redirectTo);
        
        // Use customer data if available, otherwise use customer_id from URL
        if (customerData) {
          redirectUrl.searchParams.set('customer_id', customerData.id);
          if (customerData.email) redirectUrl.searchParams.set('customer_email', customerData.email);
          if (customerData.firstName) redirectUrl.searchParams.set('customer_first_name', customerData.firstName);
          if (customerData.lastName) redirectUrl.searchParams.set('customer_last_name', customerData.lastName);
          if (customerData.imageUrl) redirectUrl.searchParams.set('customer_image_url', customerData.imageUrl);
        } else if (customerId) {
          // Fallback: use customer_id from URL if customer data fetch failed
          redirectUrl.searchParams.set('customer_id', customerId);
          if (customerEmail) redirectUrl.searchParams.set('customer_email', customerEmail);
          if (customerFirstName) redirectUrl.searchParams.set('customer_first_name', customerFirstName);
          if (customerLastName) redirectUrl.searchParams.set('customer_last_name', customerLastName);
        }
        
        redirectUrl.searchParams.set('logged_in', 'true');
        
        // Check if redirect is to localhost (HTTP) or production (HTTPS)
        const isLocalhost = redirectUrl.hostname === 'localhost' || redirectUrl.hostname === '127.0.0.1';
        const cookieSecure = isLocalhost ? '' : '; Secure';
        
        // Also set cookie for the redirect domain
        const headers = new Headers({
          'Location': redirectUrl.toString(),
          'Content-Type': 'text/html',
          ...corsHeaders, // Add CORS headers for cross-origin redirect
        });
        
        // Set customer data in cookie if available (will be set on the redirect domain)
        if (customerData) {
          // For localhost, we can't use Secure flag (requires HTTPS)
          headers.append('Set-Cookie', `phraseotomy_customer=${encodeURIComponent(JSON.stringify(customerData))}; Path=/; HttpOnly; SameSite=Lax; Max-Age=3600${cookieSecure}`);
        }
        
        console.log('Redirect URL:', redirectUrl.toString());
        console.log('Customer data being passed:', customerData ? { id: customerData.id, email: customerData.email } : { id: customerId });
        
        return new Response(
          `<!DOCTYPE html>
<html>
<head>
  <meta http-equiv="refresh" content="0; url=${redirectUrl.toString()}" />
  <title>Redirecting...</title>
</head>
<body>
  <p>Redirecting to app...</p>
  <script>
    console.log('Redirecting to:', ${JSON.stringify(redirectUrl.toString())});
    window.location.href = ${JSON.stringify(redirectUrl.toString())};
  </script>
</body>
</html>`,
          {
            status: 302,
            headers,
          }
        );
      } catch (urlError) {
        console.error('Error creating redirect URL:', urlError);
        // Fall through to normal app loading if redirect URL is invalid
      }
    } else {
      // Log why redirect didn't happen
      console.log('=== NO REDIRECT - REASON ===');
      console.log('redirectTo exists?', !!redirectTo);
      console.log('customerData exists?', !!customerData);
      console.log('customerId exists?', !!customerId);
      if (!redirectTo) {
        console.log('❌ No redirect_to parameter found');
      } else if (!customerData && !customerId) {
        console.log('❌ No customer data or customer_id found');
      }
    }

    // Return HTML that loads the React app with embedded tenant data
    const headers = new Headers({
      'Content-Type': 'text/html',
    });

    // Set customer data in cookie if available
    if (customerData) {
      headers.append('Set-Cookie', `phraseotomy_customer=${encodeURIComponent(JSON.stringify(customerData))}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=3600`);
    }

    // Pass token and customer data to app
    return new Response(
      generateAppHtml(tenant, shop, customerData),
      {
        status: 200,
        headers,
      }
    );
  } catch (error) {
    console.error('Error in shopify-proxy-entry:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      generateErrorHtml(
        'Server Error',
        `An error occurred: ${errorMessage}. Please check the Edge Function logs in Supabase.`
      ),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'text/html' },
      }
    );
  }
});

/**
 * Generate HTML that loads the React app with embedded tenant configuration
 */
function generateAppHtml(tenant, shop, customer = null) {
  // Sanitize tenant data for embedding
  const tenantConfig = {
    id: tenant.id,
    name: tenant.name,
    tenant_key: tenant.tenant_key,
    shop_domain: tenant.shop_domain,
    environment: tenant.environment,
    verified: true,
  };

  // Get the app deployment URL from environment variable
  // This should be your Vercel/Netlify deployment URL where the React app is hosted
  // Format: https://your-app.vercel.app or https://your-app.netlify.app
  const baseUrl = Deno.env.get('APP_DEPLOYMENT_URL') || 'https://phraseotomy-web-app.vercel.app';

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Phraseotomy - ${tenant.name}</title>
    <script>
      // Embed tenant configuration for the React app
      window.__PHRASEOTOMY_CONFIG__ = ${JSON.stringify(tenantConfig)};
      window.__PHRASEOTOMY_SHOP__ = ${JSON.stringify(shop)};
      window.__PHRASEOTOMY_CUSTOMER__ = ${JSON.stringify(customer)};
    </script>
    <script type="module" crossorigin src="${baseUrl}/assets/index.js"></script>
    <link rel="stylesheet" crossorigin href="${baseUrl}/assets/index.css">
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;
}

/**
 * Generate error HTML page
 */
function generateErrorHtml(title, message) {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Error - Phraseotomy</title>
    <style>
      body {
        font-family: system-ui, -apple-system, sans-serif;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        margin: 0;
        background: #0a0a0a;
        color: #fbbf24;
      }
      .error-container {
        text-align: center;
        padding: 2rem;
        max-width: 500px;
      }
      h1 {
        font-size: 3rem;
        margin: 0 0 1rem 0;
      }
      p {
        font-size: 1.125rem;
        margin: 0.5rem 0;
      }
      .message {
        background: rgba(251, 191, 36, 0.1);
        border: 1px solid rgba(251, 191, 36, 0.3);
        border-radius: 0.5rem;
        padding: 1rem;
        margin-top: 1.5rem;
      }
    </style>
  </head>
  <body>
    <div class="error-container">
      <h1>⚠️</h1>
      <h2>${title}</h2>
      <div class="message">
        <p>${message}</p>
      </div>
    </div>
  </body>
</html>`;
}

