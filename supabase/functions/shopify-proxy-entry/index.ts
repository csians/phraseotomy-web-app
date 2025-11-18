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

  console.log('Shopify Proxy Entry - Request received');
  console.log('Shop:', shop);
  console.log('Query params:', Object.fromEntries(queryParams.entries()));

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

    // Fetch tenant configuration
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('*')
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
        JSON.stringify({ error: `No active tenant found for shop: ${shop}`, verified: false }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Verify HMAC signature
    const isValidSignature = await verifyShopifyHmac(
      queryParams,
      tenant.shopify_client_secret
    );

    if (!isValidSignature) {
      console.log('Invalid HMAC signature for shop:', shop);
      return new Response(
        JSON.stringify({ error: 'HMAC signature verification failed', verified: false }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('HMAC verified successfully for tenant:', tenant.tenant_key);

    // Return HTML that loads the React app with embedded tenant data
    return new Response(
      generateAppHtml(tenant, shop),
      {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }
    );
  } catch (error) {
    console.error('Error in shopify-proxy-entry:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage, verified: false }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

/**
 * Generate HTML that loads the React app with embedded tenant configuration
 */
function generateAppHtml(tenant: any, shop: string): string {
  // Sanitize tenant data for embedding
  const tenantConfig = {
    id: tenant.id,
    name: tenant.name,
    tenant_key: tenant.tenant_key,
    shop_domain: tenant.shop_domain,
    environment: tenant.environment,
    verified: true,
  };

  // Use the Vercel deployment URL for assets
  const baseUrl = 'https://phraseotomy.ourstagingserver.com';

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
