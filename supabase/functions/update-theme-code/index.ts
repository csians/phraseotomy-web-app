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
    const { codeId, status, shopDomain, expires_at, code, themes_unlocked, redeemed_by, redeemed_at, customerId } = await req.json();

    console.log('📝 Updating theme code:', { codeId, status, shopDomain, expires_at, code, themes_unlocked });

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

    // Get current code to check status and current code value
    const { data: currentCode, error: fetchError } = await supabaseAdmin
      .from('theme_codes')
      .select('status, expires_at, code')
      .eq('id', codeId)
      .eq('tenant_id', tenant.id)
      .single();

    if (fetchError || !currentCode) {
      return new Response(
        JSON.stringify({ success: false, error: 'Theme code not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prepare update data
    const updates: any = { status };
    // If assigning to a customer, set redeemed_by, redeemed_at, and assignment_type
    if (redeemed_by) {
      updates.redeemed_by = redeemed_by;
      updates.assignment_type = 'admin';
    }
    if (redeemed_at) {
      updates.redeemed_at = redeemed_at;
    }

    // Update code value if provided and different from current
    if (code !== undefined && code !== null && code.trim() !== '') {
      const normalizedCode = code.trim().toUpperCase();
      
      // Check if code is being changed
      if (normalizedCode !== currentCode.code) {
        // Check for uniqueness within tenant
        const { data: existingCode, error: checkError } = await supabaseAdmin
          .from('theme_codes')
          .select('id')
          .eq('tenant_id', tenant.id)
          .eq('code', normalizedCode)
          .neq('id', codeId)
          .maybeSingle();

        if (checkError) {
          console.error('❌ Error checking code uniqueness:', checkError);
          return new Response(
            JSON.stringify({ success: false, error: 'Error checking code uniqueness' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (existingCode) {
          return new Response(
            JSON.stringify({ success: false, error: `Code "${normalizedCode}" already exists for this shop` }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        updates.code = normalizedCode;
      }
    }

    // Update themes_unlocked if provided
    if (themes_unlocked !== undefined && Array.isArray(themes_unlocked)) {
      updates.themes_unlocked = themes_unlocked;
    }

    // If changing to unused, clear redemption data
    if (status === 'unused') {
      updates.redeemed_by = null;
      updates.redeemed_at = null;
      updates.assignment_type = null;
      // Only clear expiration if expires_at is not explicitly provided
      if (expires_at === undefined) {
        updates.expires_at = null;
      }
    }

    // Update expiration time if provided
    if (expires_at !== undefined) {
      updates.expires_at = expires_at;
    }

    // Validate expiration is in the future for non-expired codes
    if (updates.expires_at && status !== 'expired') {
      const expirationDate = new Date(updates.expires_at);
      const now = new Date();
      if (expirationDate <= now) {
        console.error('❌ Validation failed: expiration date is not in the future');
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Expiration time must be in the future',
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    console.log('📝 Update payload:', JSON.stringify(updates, null, 2));


    // Update the theme code
    const { data: updatedCode, error: updateError } = await supabaseAdmin
      .from('theme_codes')
      .update(updates)
      .eq('id', codeId)
      .eq('tenant_id', tenant.id)
      .select('*')
      .single();

    if (updateError) {
      console.error('❌ Error updating theme code:', updateError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: updateError.message,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If assigned to a customer and status is active, unlock themes for customer
    if (updates.redeemed_by && updates.status === 'active' && Array.isArray(updates.themes_unlocked) && req.json) {
      // You must pass customerId from the frontend for this to work
      const { customerId } = await req.json();
      if (customerId) {
        for (const themeId of updates.themes_unlocked) {
          await supabaseAdmin
            .from('customer_theme_codes')
            .upsert({
              customer_id: customerId,
              theme_id: themeId,
              code_id: updatedCode.id,
              shop_domain: shopDomain,
              status: 'active',
            }, { onConflict: ['customer_id', 'theme_id'] });
        }
      }
    }

    // Optionally, add customer_email and customer_lookup_status if available
    let responseCode = updatedCode;
    if (updates.redeemed_at && updates.redeemed_by) {
      responseCode = {
        ...updatedCode,
        customer_email: updates.redeemed_at,
        customer_lookup_status: 'found_in_database',
        assignment_type: updates.assignment_type || null,
      };
    }

    console.log('✅ Theme code updated successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Theme code updated successfully',
        code: responseCode
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
