import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.83.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  token: string;
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

    const { token }: RequestBody = await req.json();

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Missing token' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🔍 [TOKEN_VAL] Validating token`);

    // Find session by token
    const { data: sessionData, error: sessionError } = await supabase
      .from('customer_sessions')
      .select('*')
      .eq('session_token', token)
      .single();

    if (sessionError || !sessionData) {
      console.log('❌ [TOKEN_VAL] Invalid or expired token');
      return new Response(
        JSON.stringify({ valid: false, error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if token is expired
    const now = new Date();
    const expiresAt = new Date(sessionData.expires_at);

    if (now > expiresAt) {
      console.log('❌ [TOKEN_VAL] Token expired');
      
      // Delete expired session
      await supabase
        .from('customer_sessions')
        .delete()
        .eq('id', sessionData.id);

      return new Response(
        JSON.stringify({ valid: false, error: 'Token expired' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update last_used_at
    await supabase
      .from('customer_sessions')
      .update({ last_used_at: now.toISOString() })
      .eq('id', sessionData.id);

    console.log(`✅ [TOKEN_VAL] Token valid for customer: ${sessionData.customer_id}`);

    return new Response(
      JSON.stringify({
        valid: true,
        customerId: sessionData.customer_id,
        shopDomain: sessionData.shop_domain,
        tenantId: sessionData.tenant_id,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ [TOKEN_VAL] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
