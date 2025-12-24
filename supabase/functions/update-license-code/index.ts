import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.83.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { codeId, status, shopDomain, expires_at } = await req.json();

    console.log('📝 Updating license code:', { codeId, status, shopDomain, expires_at });

    if (!codeId || !status || !shopDomain) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create service role client (bypasses RLS)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify tenant
    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .select('id')
      .eq('shop_domain', shopDomain)
      .eq('is_active', true)
      .single();

    if (tenantError || !tenant) {
      console.error('❌ Tenant not found:', tenantError);
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid shop domain' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get current code to check status
    const { data: currentCode, error: fetchError } = await supabaseAdmin
      .from('license_codes')
      .select('status, expires_at')
      .eq('id', codeId)
      .eq('tenant_id', tenant.id)
      .single();

    if (fetchError || !currentCode) {
      return new Response(
        JSON.stringify({ success: false, error: 'Code not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prepare update data
    const updates: any = { status };

    // If changing to unused, clear redemption data
    if (status === 'unused') {
      updates.redeemed_by = null;
      updates.redeemed_at = null;
      // Only clear expiration if expires_at is not explicitly provided
      if (expires_at === undefined) {
        updates.expires_at = null; // Clear expiration when unused (if not provided)
      }
    }

    // Update expiration time if provided (explicitly set, even if null)
    if (expires_at !== undefined) { // Check for undefined to allow null to be passed
      updates.expires_at = expires_at; // expires_at will be null or ISO string
    }

    // Validate expiration is in the future for non-expired codes
    if (updates.expires_at && status !== 'expired') {
      const expirationDate = new Date(updates.expires_at);
      const now = new Date();
      if (expirationDate <= now) {
        console.error('❌ Validation failed: expiration date is not in the future', {
          expirationDate: expirationDate.toISOString(),
          now: now.toISOString(),
          expires_at: updates.expires_at
        });
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Expiration time must be in the future',
            details: `Expiration: ${expirationDate.toISOString()}, Now: ${now.toISOString()}`
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    console.log('📝 Update payload:', JSON.stringify(updates, null, 2));

    // Update the license code
    console.log('📝 Executing update with:', {
      codeId,
      tenantId: tenant.id,
      updates: JSON.stringify(updates, null, 2)
    });

    const { data: updatedCode, error: updateError } = await supabaseAdmin
      .from('license_codes')
      .update(updates)
      .eq('id', codeId)
      .eq('tenant_id', tenant.id)
      .select('id, code, status, expires_at')
      .single();

    if (updateError) {
      console.error('❌ Error updating code:', updateError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: updateError.message,
          details: JSON.stringify(updateError)
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ License code updated successfully:', {
      id: updatedCode?.id,
      code: updatedCode?.code,
      status: updatedCode?.status,
      expires_at: updatedCode?.expires_at
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Code updated successfully',
        code: updatedCode
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
