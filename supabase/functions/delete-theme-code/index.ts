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
    const { codeId, shopDomain } = await req.json();

    console.log('🗑️ Deleting theme code:', { codeId, shopDomain });

    if (!codeId || !shopDomain) {
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

    // First, revoke all customer theme codes associated with this code
    const { data: customerThemeCodesData, error: revokeError } = await supabaseAdmin
      .from('customer_theme_codes')
      .update({ status: 'revoked' })
      .eq('theme_code_id', codeId)
      .eq('tenant_id', tenant.id)
      .select();

    if (revokeError) {
      console.error('⚠️ Warning: Error revoking customer theme codes:', revokeError);
      // If revoking fails, try deleting customer theme codes instead
      const { error: deleteError } = await supabaseAdmin
        .from('customer_theme_codes')
        .delete()
        .eq('theme_code_id', codeId)
        .eq('tenant_id', tenant.id);
      
      if (deleteError) {
        console.error('⚠️ Warning: Could not delete customer theme codes either:', deleteError);
      } else {
        console.log('✅ Deleted customer theme codes for code:', codeId);
      }
    } else {
      console.log('✅ Revoked customer theme codes for code:', codeId, 'Count:', customerThemeCodesData?.length || 0);
    }

    // Delete the theme code
    const { error: deleteError } = await supabaseAdmin
      .from('theme_codes')
      .delete()
      .eq('id', codeId)
      .eq('tenant_id', tenant.id);

    if (deleteError) {
      console.error('❌ Error deleting theme code:', deleteError);
      return new Response(
        JSON.stringify({ success: false, error: deleteError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Theme code deleted successfully');

    return new Response(
      JSON.stringify({ success: true, message: 'Theme code deleted and customer access revoked' }),
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
