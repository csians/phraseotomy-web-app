import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.83.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const APP_SECRET = Deno.env.get('APP_SIGNING_SECRET')!;

// Custom domains must resolve to *.myshopify.com for Admin API
const CUSTOM_DOMAIN_TO_MYSHOPIFY: Record<string, string> = {
  'phraseotomy.com': 'qxqtbf-21.myshopify.com',
  'phraseotomy.ourstagingserver.com': 'testing-cs-store.myshopify.com',
};

function getShopifyApiHost(shopDomain: string): string {
  const normalized = (shopDomain || '').trim().toLowerCase();
  if (normalized.endsWith('.myshopify.com')) return normalized;
  return CUSTOM_DOMAIN_TO_MYSHOPIFY[normalized] || normalized;
}

/**
 * Ensure customer has metafield custom.redemption_code = "True" in Shopify.
 * Only updates if the metafield is missing or value is not "True".
 */
async function ensureRedemptionCodeMetafield(
  customerId: string,
  apiHost: string,
  accessToken: string
): Promise<void> {
  const getUrl = `https://${apiHost}/admin/api/2024-01/customers/${customerId}/metafields.json`;
  const getRes = await fetch(getUrl, {
    method: 'GET',
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json',
    },
  });
  if (!getRes.ok) {
    console.warn('⚠️ Failed to fetch metafields for redemption_code check:', getRes.status);
    return;
  }
  const { metafields } = await getRes.json();
  const existing = metafields?.find((mf: any) => mf.namespace === 'custom' && mf.key === 'redemption_code');
  if (existing && existing.value === 'True') {
    return; // already set, do nothing
  }
  const body = {
    metafield: {
      namespace: 'custom',
      key: 'redemption_code',
      value: 'True',
      type: 'single_line_text_field',
    },
  };
  const url = existing
    ? `https://${apiHost}/admin/api/2024-01/customers/${customerId}/metafields/${existing.id}.json`
    : `https://${apiHost}/admin/api/2024-01/customers/${customerId}/metafields.json`;
  const method = existing ? 'PUT' : 'POST';
  const updateRes = await fetch(url, {
    method,
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!updateRes.ok) {
    const errText = await updateRes.text();
    console.warn('⚠️ Failed to set redemption_code metafield:', updateRes.status, errText);
    return;
  }
  console.log('✅ Set customer metafield custom.redemption_code = True');
}

/**
 * Verify a signed session token
 */
async function verifySessionToken(token: string): Promise<{
  customer_id: string;
  shop: string;
  exp: number;
} | null> {
  try {
    console.log('🔧 Starting token verification...');
    const [payloadB64, signature] = token.split('.');
    if (!payloadB64 || !signature) {
      console.error('❌ Token format invalid - missing payload or signature');
      return null;
    }

    // Verify signature
    const encoder = new TextEncoder();
    const keyData = encoder.encode(APP_SECRET);
    const msgData = encoder.encode(payloadB64);

    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const signatureBytes = Uint8Array.from(
      atob(signature.replace(/-/g, '+').replace(/_/g, '/') + '=='.slice(0, (4 - signature.length % 4) % 4)),
      c => c.charCodeAt(0)
    );

    const isValid = await crypto.subtle.verify('HMAC', key, signatureBytes, msgData);
    if (!isValid) {
      console.error('❌ Token signature verification failed');
      return null;
    }

    // Decode and validate payload
    const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/') + '=='.slice(0, (4 - payloadB64.length % 4) % 4)));

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      console.error('❌ Token has expired:', { exp: payload.exp, now });
      return null;
    }

    console.log('✅ Token verification successful');
    return payload;
  } catch (error) {
    console.error('❌ Token verification error:', error);
    return null;
  }
}

/**
 * Edge function to fetch customer data (licenses, sessions) with proper authorization
 * Requires a valid session token for authentication
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { sessionToken } = await req.json();
    console.log('🔑 Received request with token:', sessionToken ? 'Present' : 'Missing');

    // Validate session token
    if (!sessionToken) {
      console.error('❌ No session token provided');
      return new Response(
        JSON.stringify({ error: 'Missing session token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🔍 Verifying session token...');
    const payload = await verifySessionToken(sessionToken);
    if (!payload) {
      console.error('❌ Session token verification failed');
      return new Response(
        JSON.stringify({ error: 'Invalid or expired session token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Session token verified successfully:', payload);

    // Extract validated customer ID and shop domain from token
    const { customer_id: customerId, shop: shopDomain } = payload;


    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch tenant to get tenant_id and access token
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, access_token, shop_domain')
      .eq('shop_domain', shopDomain)
      .eq('is_active', true)
      .single();

    if (tenantError || !tenant) {
      return new Response(
        JSON.stringify({ error: 'Tenant not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiHost = getShopifyApiHost(shopDomain);

    // Fetch customer details from Shopify Admin API
    let customerDetails = null;
    if (tenant.access_token) {
      try {
        const shopifyUrl = `https://${apiHost}/admin/api/2024-01/customers/${customerId}.json`;
        console.log('🔍 Fetching customer from Shopify:', { shopifyUrl, customerId, shopDomain });
        
        const shopifyResponse = await fetch(shopifyUrl, {
          headers: {
            'X-Shopify-Access-Token': tenant.access_token,
            'Content-Type': 'application/json',
          },
        });

        console.log('📡 Shopify response status:', shopifyResponse.status);
        
        const responseText = await shopifyResponse.text();
        console.log('📦 Shopify raw response:', responseText.substring(0, 500));

        if (shopifyResponse.ok) {
          const shopifyData = JSON.parse(responseText);
          console.log('✅ Shopify customer data:', JSON.stringify(shopifyData.customer, null, 2));
          
          customerDetails = {
            id: customerId,
            email: shopifyData.customer?.email || null,
            name: shopifyData.customer?.first_name && shopifyData.customer?.last_name 
              ? `${shopifyData.customer.first_name} ${shopifyData.customer.last_name}`
              : shopifyData.customer?.first_name || shopifyData.customer?.last_name || null,
            first_name: shopifyData.customer?.first_name || null,
            last_name: shopifyData.customer?.last_name || null,
          };
          console.log('✅ Extracted customer details:', customerDetails);
        } else {
          console.warn('⚠️ Failed to fetch customer from Shopify:', shopifyResponse.status, responseText);
        }
      } catch (error) {
        console.error('❌ Error fetching customer from Shopify:', error);
      }
    } else {
      console.warn('⚠️ No access_token found for tenant:', shopDomain);
    }

    // Fallback if Shopify API call failed
    if (!customerDetails) {
      customerDetails = {
        id: customerId,
        email: null,
        name: null,
        first_name: null,
        last_name: null,
      };
    }

    // Fetch customer licenses for this customer and shop with license code details
    const { data: licenses, error: licensesError } = await supabase
      .from('customer_licenses')
      .select(`
        *,
        license_codes!inner (
          code,
          packs_unlocked,
          expires_at
        )
      `)
      .eq('customer_id', customerId)
      .eq('shop_domain', shopDomain)
      .eq('status', 'active');
    
    // Transform the data to include packs_unlocked at the license level
    let transformedLicenses = licenses?.map((license: any) => ({
      ...license,
      code: license.license_codes?.code,
      packs_unlocked: license.license_codes?.packs_unlocked || [],
      expires_at: license.license_codes?.expires_at || license.expires_at,
    })) || [];

    // Check if customer has any packs.
    // Previously, a "Base" pack was auto-assigned here when the customer had no packs.
    // This behavior has been disabled so that customers with no licenses simply see no packs.
    console.log(`📦 Customer has ${transformedLicenses.length} licenses`);

    if (licensesError) {
      console.error('Error fetching licenses:', licensesError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch licenses' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch game sessions for this customer
    const { data: sessions, error: sessionsError } = await supabase
      .from('game_sessions')
      .select('*')
      .eq('host_customer_id', customerId)
      .eq('shop_domain', shopDomain)
      .order('created_at', { ascending: false })
      .limit(10);

    if (sessionsError) {
      console.error('Error fetching sessions:', sessionsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch sessions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If customer has any active license (redeemed), ensure Shopify metafield custom.redemption_code = "True"
    if (transformedLicenses.length > 0 && tenant.access_token) {
      try {
        await ensureRedemptionCodeMetafield(customerId, apiHost, tenant.access_token);
      } catch (e) {
        console.warn('⚠️ Could not ensure redemption_code metafield:', e);
      }
    }

    console.log('✅ Customer details fetched from Shopify:', customerDetails);
    console.log('✅ Customer licenses:', transformedLicenses);

    return new Response(
      JSON.stringify({
        customer: customerDetails,
        licenses: transformedLicenses,
        sessions: sessions || [],
        tenantId: tenant.id,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in get-customer-data:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
