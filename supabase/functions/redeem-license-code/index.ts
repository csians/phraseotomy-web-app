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
    const { code, customerId, shopDomain } = await req.json();

    console.log('🎟️ Redeeming code:', { code, customerId, shopDomain });

    if (!code || !customerId || !shopDomain) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const normalizedCode = code.toUpperCase().trim();

    // Create service role client (bypasses RLS)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Look up tenant
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

    // Find the license code
    const { data: licenseCode, error: codeError } = await supabaseAdmin
      .from('license_codes')
      .select('*')
      .eq('code', normalizedCode)
      .eq('tenant_id', tenant.id)
      .maybeSingle();

    if (codeError) {
      console.error('❌ Error fetching license code:', codeError);
      return new Response(
        JSON.stringify({ success: false, error: 'Error checking code' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!licenseCode) {
      return new Response(
        JSON.stringify({ success: false, error: 'CODE_NOT_FOUND', message: 'Invalid code. Please check and try again.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if code is already used
    if (licenseCode.status !== 'unused') {
      return new Response(
        JSON.stringify({ success: false, error: 'CODE_USED', message: 'This code has already been used.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Double-check that code hasn't been redeemed
    if (licenseCode.redeemed_by) {
      return new Response(
        JSON.stringify({ success: false, error: 'CODE_USED', message: 'This code has already been redeemed by another customer.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if code is expired
    if (licenseCode.expires_at) {
      const expiresAt = new Date(licenseCode.expires_at);
      if (expiresAt < new Date()) {
        return new Response(
          JSON.stringify({ success: false, error: 'CODE_EXPIRED', message: 'This code has expired.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Check if customer already redeemed this code
    const { data: existingLicense } = await supabaseAdmin
      .from('customer_licenses')
      .select('*')
      .eq('customer_id', customerId)
      .eq('license_code_id', licenseCode.id)
      .eq('shop_domain', shopDomain)
      .maybeSingle();

    if (existingLicense) {
      return new Response(
        JSON.stringify({ success: false, error: 'ALREADY_REDEEMED', message: 'You have already redeemed this code.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create customer license record
    const { error: licenseError } = await supabaseAdmin
      .from('customer_licenses')
      .insert({
        customer_id: customerId,
        license_code_id: licenseCode.id,
        shop_domain: shopDomain,
        tenant_id: tenant.id,
        status: 'active',
        activated_at: new Date().toISOString(),
      });

    if (licenseError) {
      console.error('❌ Error creating customer license:', licenseError);
      return new Response(
        JSON.stringify({ success: false, error: 'REDEMPTION_ERROR', message: 'Error redeeming code. Please try again.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update license code status to active (redeemed) and mark as redeemed
    const { error: updateError } = await supabaseAdmin
      .from('license_codes')
      .update({
        status: 'active',
        redeemed_by: customerId,
        redeemed_at: new Date().toISOString(),
      })
      .eq('id', licenseCode.id)
      .is('redeemed_by', null); // Extra safety: only update if not already redeemed

    if (updateError) {
      console.error('❌ Error updating license code:', updateError);
      // Don't fail the redemption, but log the error
    }

    console.log('✅ Code redeemed successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Code redeemed! Unlocked packs: ${licenseCode.packs_unlocked.join(', ')}`,
        packsUnlocked: licenseCode.packs_unlocked || []
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'UNEXPECTED_ERROR', message: 'An unexpected error occurred. Please try again.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
