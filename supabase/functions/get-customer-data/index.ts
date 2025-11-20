import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.83.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const APP_SECRET = Deno.env.get('APP_SIGNING_SECRET')!;

/**
 * Verify a signed session token
 */
async function verifySessionToken(token: string): Promise<{
  customer_id: string;
  shop: string;
  exp: number;
} | null> {
  try {
    const [payloadB64, signature] = token.split('.');
    if (!payloadB64 || !signature) return null;

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
    if (!isValid) return null;

    // Decode and validate payload
    const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/') + '=='.slice(0, (4 - payloadB64.length % 4) % 4)));

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) return null;

    return payload;
  } catch (error) {
    console.error('Token verification error:', error);
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

    // Validate session token
    if (!sessionToken) {
      return new Response(
        JSON.stringify({ error: 'Missing session token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const payload = await verifySessionToken(sessionToken);
    if (!payload) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired session token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    // Fetch customer details from Shopify Admin API
    let customerDetails = null;
    if (tenant.access_token) {
      try {
        const shopifyResponse = await fetch(
          `https://${shopDomain}/admin/api/2024-01/customers/${customerId}.json`,
          {
            headers: {
              'X-Shopify-Access-Token': tenant.access_token,
              'Content-Type': 'application/json',
            },
          }
        );

        if (shopifyResponse.ok) {
          const shopifyData = await shopifyResponse.json();
          customerDetails = {
            id: customerId,
            email: shopifyData.customer?.email || null,
            name: shopifyData.customer?.first_name && shopifyData.customer?.last_name 
              ? `${shopifyData.customer.first_name} ${shopifyData.customer.last_name}`
              : shopifyData.customer?.first_name || shopifyData.customer?.last_name || null,
            first_name: shopifyData.customer?.first_name || null,
            last_name: shopifyData.customer?.last_name || null,
          };
          console.log('✅ Customer details fetched from Shopify:', customerDetails);
        } else {
          console.warn('⚠️ Failed to fetch customer from Shopify:', shopifyResponse.status, await shopifyResponse.text());
        }
      } catch (error) {
        console.error('Error fetching customer from Shopify:', error);
      }
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

    // Fetch customer licenses for this customer and shop
    const { data: licenses, error: licensesError } = await supabase
      .from('customer_licenses')
      .select('*')
      .eq('customer_id', customerId)
      .eq('shop_domain', shopDomain)
      .eq('status', 'active');

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

    return new Response(
      JSON.stringify({
        customer: customerDetails,
        licenses: licenses || [],
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
