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

    // Get tenant configuration using secure function (no secrets exposed)
    const { data: tenantData, error: tenantError } = await supabase
      .rpc('verify_tenant_for_proxy', { shop_domain_param: shop });

    if (tenantError) {
      console.error('Error fetching tenant:', tenantError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch tenant configuration' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!tenantData || tenantData.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Tenant not found for this shop' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tenant = tenantData[0];

    // Retrieve client secret separately for HMAC verification (uses service role key)
    const { data: secretData, error: secretError } = await supabase
      .from('tenants')
      .select('shopify_client_secret, shopify_client_id')
      .eq('shop_domain', shop)
      .single();

    if (secretError || !secretData) {
      console.error('Error fetching tenant credentials');
      return new Response(
        JSON.stringify({ error: 'Configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify HMAC signature using Shopify Client Secret
    const isValid = await verifyShopifyHmac(queryParams, secretData.shopify_client_secret);

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
          id: tenant.tenant_id,
          name: tenant.tenant_name,
          shop_domain: tenant.shop_domain,
          environment: tenant.environment,
          client_id: secretData.shopify_client_id,
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
