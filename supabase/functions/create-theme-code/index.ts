/**
 * Supabase Edge Function: Create Theme Code
 * 
 * Creates theme codes with admin privileges using service role
 * Used by Shopify admin interface to bypass RLS
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
    const { code, themes_unlocked, shop_domain } = await req.json();

    if (!code || !shop_domain) {
      return new Response(
        JSON.stringify({ error: 'code and shop_domain are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Initialize Supabase client with service role
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get tenant ID from shop domain
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id')
      .eq('shop_domain', shop_domain)
      .eq('is_active', true)
      .maybeSingle();

    if (tenantError || !tenant) {
      console.error('Tenant not found:', tenantError);
      return new Response(
        JSON.stringify({ error: 'Tenant not found for shop domain' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const normalizedCode = code.trim().toUpperCase();

    // Check if code already exists
    const { data: existingCode } = await supabase
      .from('theme_codes')
      .select('id')
      .eq('tenant_id', tenant.id)
      .eq('code', normalizedCode)
      .maybeSingle();

    if (existingCode) {
      return new Response(
        JSON.stringify({ error: `Theme code "${normalizedCode}" already exists for this shop` }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('Creating theme code:', { code: normalizedCode, tenant_id: tenant.id, themes_unlocked });

    // Insert theme code using service role (bypasses RLS)
    const { data: newCode, error: insertError } = await supabase
      .from('theme_codes')
      .insert({
        tenant_id: tenant.id,
        code: normalizedCode,
        themes_unlocked: themes_unlocked || [],
        status: 'unused',
        expires_at: null,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating theme code:', insertError);
      return new Response(
        JSON.stringify({ error: insertError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('✅ Theme code created successfully:', newCode.id);

    return new Response(
      JSON.stringify({ success: true, code: newCode }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in create-theme-code:', error);
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
