import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.83.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  customerId: string;
  shopDomain: string;
  userAgent?: string;
  ipAddress?: string;
}

// Generate a secure random token
function generateSecureToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { customerId, shopDomain, userAgent, ipAddress }: RequestBody = await req.json();

    if (!customerId || !shopDomain) {
      return new Response(
        JSON.stringify({ error: 'Missing customerId or shopDomain' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🔐 [TOKEN_GEN] Generating token for customer: ${customerId}`);

    // Get tenant_id for the shop
    const { data: tenantData, error: tenantError } = await supabase
      .from('tenants')
      .select('id')
      .eq('shop_domain', shopDomain)
      .eq('is_active', true)
      .single();

    if (tenantError || !tenantData) {
      console.error('❌ [TOKEN_GEN] Tenant not found:', tenantError);
      return new Response(
        JSON.stringify({ error: 'Invalid shop domain' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate new session token
    const sessionToken = generateSecureToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // Token valid for 30 days

    // Clean up expired sessions for this customer
    await supabase
      .from('customer_sessions')
      .delete()
      .eq('customer_id', customerId)
      .eq('shop_domain', shopDomain)
      .lt('expires_at', new Date().toISOString());

    // Create new session
    const { data: sessionData, error: sessionError } = await supabase
      .from('customer_sessions')
      .insert({
        customer_id: customerId,
        shop_domain: shopDomain,
        tenant_id: tenantData.id,
        session_token: sessionToken,
        expires_at: expiresAt.toISOString(),
        user_agent: userAgent,
        ip_address: ipAddress,
      })
      .select()
      .single();

    if (sessionError) {
      console.error('❌ [TOKEN_GEN] Failed to create session:', sessionError);
      return new Response(
        JSON.stringify({ error: 'Failed to create session' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✅ [TOKEN_GEN] Token generated successfully for customer: ${customerId}`);

    return new Response(
      JSON.stringify({
        token: sessionToken,
        expiresAt: expiresAt.toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ [TOKEN_GEN] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
