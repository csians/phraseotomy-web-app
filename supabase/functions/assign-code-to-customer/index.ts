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
    const { customerId, customerEmail, customerName, code, shopDomain } = await req.json();

    console.log('🎯 Assigning code to customer:', { customerId, code, shopDomain });

    if (!customerId || !code || !shopDomain) {
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
      .select('id, access_token')
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
      .single();

    if (codeError || !licenseCode) {
      console.error('❌ License code not found:', codeError);
      return new Response(
        JSON.stringify({ success: false, error: 'License code not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update Shopify customer metafield
    const metafieldData = {
      metafield: {
        namespace: 'phraseotomy',
        key: 'license_codes',
        value: JSON.stringify([normalizedCode]),
        type: 'json',
      },
    };

    const shopifyResponse = await fetch(
      `https://${shopDomain}/admin/api/2024-01/customers/${customerId}/metafields.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': tenant.access_token,
        },
        body: JSON.stringify(metafieldData),
      }
    );

    if (!shopifyResponse.ok) {
      const errorText = await shopifyResponse.text();
      console.error('❌ Shopify API error:', errorText);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to update Shopify metafields' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Shopify metafield updated');

    // Check if customer already has this license
    const { data: existingLicense } = await supabaseAdmin
      .from('customer_licenses')
      .select('*')
      .eq('customer_id', customerId)
      .eq('license_code_id', licenseCode.id)
      .maybeSingle();

    if (!existingLicense) {
      // Create customer license record
      const { error: licenseError } = await supabaseAdmin
        .from('customer_licenses')
        .insert({
          customer_id: customerId,
          customer_email: customerEmail,
          customer_name: customerName,
          license_code_id: licenseCode.id,
          shop_domain: shopDomain,
          tenant_id: tenant.id,
          status: 'active',
          activated_at: new Date().toISOString(),
        });

      if (licenseError) {
        console.error('❌ Error creating customer license:', licenseError);
        // Continue anyway - metafield was updated
      } else {
        console.log('✅ Customer license created');
      }
    } else {
      console.log('ℹ️ Customer already has this license');
    }

    // Update license code
    const { error: updateError } = await supabaseAdmin
      .from('license_codes')
      .update({
        status: 'active',
        redeemed_by: customerId,
        redeemed_at: new Date().toISOString(),
      })
      .eq('id', licenseCode.id);

    if (updateError) {
      console.error('❌ Error updating license code:', updateError);
      // Continue anyway - other updates succeeded
    } else {
      console.log('✅ License code marked as redeemed');
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Code ${normalizedCode} successfully assigned to customer`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
