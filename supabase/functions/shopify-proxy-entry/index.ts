import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

/**
 * Verify Shopify HMAC signature for app proxy requests
 */
async function verifyShopifyHmac(
  queryParams: URLSearchParams,
  clientSecret: string
): Promise<boolean> {
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
    hasCustomer: !!queryParams.get('logged_in_customer_id') 
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

    // Fetch client secret separately for HMAC verification
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

    // Extract customer data from Shopify proxy parameters
    const customerId = queryParams.get('logged_in_customer_id') || null;
    const customerEmail = queryParams.get('customer_email') || null;
    const customerFirstName = queryParams.get('customer_first_name') || null;
    const customerLastName = queryParams.get('customer_last_name') || null;
    
    // Extract token from URL if present (from app-login redirect)
    const returnToken = queryParams.get('r') || null;
    
    const customerData = customerId ? {
      id: customerId,
      email: customerEmail,
      firstName: customerFirstName,
      lastName: customerLastName,
      name: [customerFirstName, customerLastName].filter(Boolean).join(' ') || null
    } : null;

    console.log('Customer data:', customerData ? `Logged in: ${customerId}` : 'Not logged in');
    if (returnToken) {
      console.log('Return token present in request');
    }

    // Generate nonce for CSP
    const nonce = crypto.randomUUID();
    
    // Return HTML that breaks out of Shopify's sandbox and redirects to full app
    const headers = new Headers({
      'Content-Type': 'text/html; charset=utf-8',
    });

    // Pass token and customer data to app
    return new Response(
      generateAppHtml(tenant, shop, customerData, nonce),
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
 * Generate HTML that redirects to the full app, breaking out of Shopify's sandbox
 * Shopify App Proxy wraps responses in restrictive sandboxed iframes, so we redirect instead
 */
function generateAppHtml(tenant: any, shop: string, customer: any = null, nonce: string): string {
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
  const baseUrl = Deno.env.get('APP_DEPLOYMENT_URL') || 'https://phraseo-shop-connect.lovable.app';

  // Encode configuration as URL parameters
  const configParams = new URLSearchParams({
    config: JSON.stringify(tenantConfig),
    shop: shop,
    customer: customer ? JSON.stringify(customer) : ''
  });

  const appUrl = `${baseUrl}/play/host?${configParams.toString()}`;

  // Return HTML that breaks out of sandbox and redirects
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Loading Phraseotomy...</title>
  <style nonce="${nonce}">
    body {
      margin: 0;
      padding: 20px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f9fafb;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }
    .loader {
      text-align: center;
    }
    .spinner {
      border: 3px solid #f3f4f6;
      border-top: 3px solid #3b82f6;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      animation: spin 1s linear infinite;
      margin: 0 auto 16px;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    .message {
      color: #6b7280;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="loader">
    <div class="spinner"></div>
    <div class="message">Redirecting to Phraseotomy...</div>
  </div>
  <script nonce="${nonce}">
    // Break out of iframe sandbox by redirecting top window
    (function() {
      try {
        // Try to redirect the top window
        if (window.top) {
          window.top.location.href = "${appUrl}";
        } else {
          window.location.href = "${appUrl}";
        }
      } catch (e) {
        // Fallback if top access is blocked
        window.location.href = "${appUrl}";
      }
    })();
  </script>
</body>
</html>`;
}

/**
 * Generate error HTML page
 */
function generateErrorHtml(title: string, message: string): string {
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
