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

    console.log('🗑️ Deleting license code:', { codeId, shopDomain });

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

    // First, revoke all customer licenses associated with this code
    // Valid status values: 'active', 'expired', 'revoked'
    const { data: licensesData, error: revokeLicensesError } = await supabaseAdmin
      .from('customer_licenses')
      .update({ status: 'revoked' })
      .eq('license_code_id', codeId)
      .eq('tenant_id', tenant.id)
      .select();

    if (revokeLicensesError) {
      console.error('⚠️ Warning: Error revoking customer licenses:', revokeLicensesError);
      // If revoking fails, try deleting customer licenses instead
      console.log('Attempting to delete customer licenses instead...');
      const { error: deleteLicensesError } = await supabaseAdmin
        .from('customer_licenses')
        .delete()
        .eq('license_code_id', codeId)
        .eq('tenant_id', tenant.id);
      
      if (deleteLicensesError) {
        console.error('⚠️ Warning: Could not delete customer licenses either:', deleteLicensesError);
        // Continue anyway - user wants to delete the code, and CASCADE will handle it
      } else {
        console.log('✅ Deleted customer licenses for code:', codeId);
      }
    } else {
      console.log('✅ Revoked customer licenses for code:', codeId, 'Count:', licensesData?.length || 0);
    }

    // Delete the license code
    const { error: deleteError } = await supabaseAdmin
      .from('license_codes')
      .delete()
      .eq('id', codeId)
      .eq('tenant_id', tenant.id);

    if (deleteError) {
      console.error('❌ Error deleting code:', deleteError);
      return new Response(
        JSON.stringify({ success: false, error: deleteError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ License code deleted successfully');

    return new Response(
      JSON.stringify({ success: true, message: 'Code deleted and customer access revoked' }),
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
