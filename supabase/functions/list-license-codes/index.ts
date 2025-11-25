/**
 * Supabase Edge Function: List License Codes
 * 
 * Lists all license codes for a tenant using service role
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
    const { shop_domain } = await req.json();

    if (!shop_domain) {
      return new Response(
        JSON.stringify({ error: 'shop_domain is required' }),
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

    console.log('Loading license codes for tenant:', tenant.id);

    // List license codes with customer name from customer_licenses (left join to include unused codes)
    const { data: codes, error: codesError } = await supabase
      .from('license_codes')
      .select(`
        *,
        customer_licenses(customer_name, customer_email)
      `)
      .eq('tenant_id', tenant.id)
      .order('created_at', { ascending: false });
    
    // Format the response to include customer_name at the top level
    const formattedCodes = codes?.map(code => ({
      ...code,
      customer_name: code.customer_licenses?.[0]?.customer_name || null,
      customer_email: code.customer_licenses?.[0]?.customer_email || null,
    }));

    if (codesError) {
      console.error('Error loading license codes:', codesError);
      return new Response(
        JSON.stringify({ error: codesError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('✅ License codes loaded:', formattedCodes?.length || 0);

    return new Response(
      JSON.stringify({ success: true, codes: formattedCodes || [] }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in list-license-codes:', error);
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
