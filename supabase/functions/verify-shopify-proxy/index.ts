import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.83.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Verifies Shopify App Proxy HMAC signature
 * Uses the Client Secret from Shopify App Credentials
 * @see https://shopify.dev/docs/apps/build/online-store/app-proxies/authenticate-app-proxies
 */
async function verifyShopifyHmac(
  queryParams: URLSearchParams,
  clientSecret: string
): Promise<boolean> {
  const signature = queryParams.get('signature');
  if (!signature) return false;

  // Build query string without signature
  const params = new URLSearchParams();
  for (const [key, value] of queryParams.entries()) {
    if (key !== 'signature') {
      params.append(key, value);
    }
  }
  
  // Sort parameters alphabetically
  const sortedParams = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('');

  // Create HMAC using Client Secret
  const encoder = new TextEncoder();
  const keyData = encoder.encode(clientSecret);
  const msgData = encoder.encode(sortedParams);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
  const hashArray = Array.from(new Uint8Array(signatureBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  return hashHex === signature;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const queryParams = url.searchParams;
    const shop = queryParams.get('shop');

    if (!shop) {
      return new Response(
        JSON.stringify({ error: 'Missing shop parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get tenant configuration
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('*')
      .eq('shop_domain', shop)
      .eq('is_active', true)
      .maybeSingle();

    if (tenantError) {
      console.error('Error fetching tenant:', tenantError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch tenant configuration' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!tenant) {
      return new Response(
        JSON.stringify({ error: 'Tenant not found for this shop' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify HMAC signature using Shopify Client Secret
    const isValid = await verifyShopifyHmac(queryParams, tenant.shopify_client_secret);

    if (!isValid) {
      return new Response(
        JSON.stringify({ error: 'Invalid signature' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Return tenant configuration (without sensitive data)
    return new Response(
      JSON.stringify({
        success: true,
        tenant: {
          id: tenant.id,
          name: tenant.name,
          shop_domain: tenant.shop_domain,
          environment: tenant.environment,
          tenant_key: tenant.tenant_key,
          client_id: tenant.shopify_client_id,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in verify-shopify-proxy:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
