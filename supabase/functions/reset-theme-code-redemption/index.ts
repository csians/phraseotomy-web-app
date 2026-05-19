/**
 * Supabase Edge Function: Reset Theme Code Redemption
 * 
 * Resets a theme code by removing customer assignment
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { code_id, shop_domain } = await req.json();

    if (!code_id || !shop_domain) {
      return new Response(
        JSON.stringify({ error: 'code_id and shop_domain are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get tenant
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, access_token')
      .eq('shop_domain', shop_domain)
      .eq('is_active', true)
      .maybeSingle();

    if (tenantError || !tenant) {
      return new Response(
        JSON.stringify({ error: 'Tenant not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Get code info
    const { data: code, error: codeError } = await supabase
      .from('theme_codes')
      .select('*')
      .eq('id', code_id)
      .eq('tenant_id', tenant.id)
      .maybeSingle();

    if (codeError || !code) {
      return new Response(
        JSON.stringify({ error: 'Theme code not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Delete customer theme codes associated with this code
    const { error: deleteError } = await supabase
      .from('customer_theme_codes')
      .delete()
      .eq('theme_code_id', code_id);

    if (deleteError) {
      console.error('Error deleting customer theme codes:', deleteError);
    }

    // Reset the code
    const { error: updateError } = await supabase
      .from('theme_codes')
      .update({
        status: 'unused',
        redeemed_by: null,
        redeemed_at: null,
      })
      .eq('id', code_id);

    if (updateError) {
      console.error('Error resetting theme code:', updateError);
      return new Response(
        JSON.stringify({ error: updateError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`✅ Theme code ${code.code} reset successfully`);

    return new Response(
      JSON.stringify({ success: true, message: 'Theme code reset successfully' }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in reset-theme-code-redemption:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
