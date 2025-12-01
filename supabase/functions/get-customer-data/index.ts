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
    const { sessionToken, customerToken, customerId, shopDomain } = await req.json();

    // Support both old sessionToken and new customerToken
    // Priority: customerToken > sessionToken > direct customerId+shopDomain
    let validatedCustomerId: string | null = null;
    let validatedShopDomain: string | null = null;

    // Try new customer token first
    if (customerToken) {
      console.log('🔍 [AUTH] Using customer token for authentication');
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const { data: validationResult, error: validationError } = await supabase.functions.invoke(
        'validate-customer-token',
        { body: { token: customerToken } }
      );

      if (!validationError && validationResult?.valid) {
        validatedCustomerId = validationResult.customerId;
        validatedShopDomain = validationResult.shopDomain;
        console.log('✅ [AUTH] Customer token valid');
      } else {
        console.log('❌ [AUTH] Customer token invalid');
      }
    }

    // Fall back to session token
    if (!validatedCustomerId && sessionToken) {
      console.log('🔍 [AUTH] Using session token for authentication');
      const payload = await verifySessionToken(sessionToken);
      if (payload) {
        validatedCustomerId = payload.customer_id;
        validatedShopDomain = payload.shop;
        console.log('✅ [AUTH] Session token valid');
      } else {
        console.log('❌ [AUTH] Session token invalid');
      }
    }

    // Direct customerId/shopDomain (least secure, for backward compatibility)
    if (!validatedCustomerId && customerId && shopDomain) {
      console.log('⚠️ [AUTH] Using direct customerId/shopDomain (not recommended)');
      validatedCustomerId = customerId;
      validatedShopDomain = shopDomain;
    }

    // Require authentication
    if (!validatedCustomerId || !validatedShopDomain) {
      return new Response(
        JSON.stringify({ error: 'Invalid or missing authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ [AUTH] Authenticated:', { customerId: validatedCustomerId, shopDomain: validatedShopDomain });


    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch tenant to get tenant_id and access token
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, access_token, shop_domain')
      .eq('shop_domain', validatedShopDomain)
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
        const shopifyUrl = `https://${validatedShopDomain}/admin/api/2024-01/customers/${validatedCustomerId}.json`;
        console.log('🔍 Fetching customer from Shopify:', { shopifyUrl, customerId: validatedCustomerId, shopDomain: validatedShopDomain });
        
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
          
          const customer = shopifyData.customer;
          
            // Auto-enable disabled customer accounts
            if (customer?.state === "disabled") {
              console.log("🔧 [AUTO_ENABLE] Customer account is disabled, attempting to enable...");
              try {
                const inviteUrl = `https://${validatedShopDomain}/admin/api/2024-01/customers/${validatedCustomerId}/send_invite.json`;
              const inviteResponse = await fetch(inviteUrl, {
                method: "POST",
                headers: {
                  "X-Shopify-Access-Token": tenant.access_token,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  customer_invite: {
                    to: customer.email,
                    from: null,
                    subject: "Activate your account",
                    custom_message: "Welcome! Please activate your account to access Phraseotomy.",
                  },
                }),
              });

              if (inviteResponse.ok) {
                console.log("✅ [AUTO_ENABLE] Account activation email sent successfully");
              } else {
                const errorText = await inviteResponse.text();
                console.warn("⚠️ [AUTO_ENABLE] Failed to send activation email:", errorText);
              }
            } catch (enableError) {
              console.error("❌ [AUTO_ENABLE] Error enabling customer account:", enableError);
            }
          }
          
          customerDetails = {
            id: validatedCustomerId,
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
      console.warn('⚠️ No access_token found for tenant:', validatedShopDomain);
    }

    // Fallback if Shopify API call failed
    if (!customerDetails) {
      customerDetails = {
        id: validatedCustomerId,
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
      .eq('customer_id', validatedCustomerId)
      .eq('shop_domain', validatedShopDomain)
      .eq('status', 'active');
    
    // Transform the data to include packs_unlocked at the license level
    const transformedLicenses = licenses?.map((license: any) => ({
      ...license,
      code: license.license_codes?.code,
      packs_unlocked: license.license_codes?.packs_unlocked || [],
      expires_at: license.license_codes?.expires_at || license.expires_at,
    })) || [];

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
      .eq('host_customer_id', validatedCustomerId)
      .eq('shop_domain', validatedShopDomain)
      .order('created_at', { ascending: false })
      .limit(10);

    if (sessionsError) {
      console.error('Error fetching sessions:', sessionsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch sessions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
