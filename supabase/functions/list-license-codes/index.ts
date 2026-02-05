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

    // List all license codes for the tenant, including previous_code_id
    const { data: allCodes, error: codesError } = await supabase
      .from('license_codes')
      .select('*, previous_code_id') // Select previous_code_id
      .eq('tenant_id', tenant.id)
      .order('created_at', { ascending: false });

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

    // Filter out license codes that contain "Base" pack (auto-generated codes)
    const codes = allCodes?.filter(code => {
      if (!code.packs_unlocked || !Array.isArray(code.packs_unlocked)) {
        return true; // Keep codes with no packs_unlocked
      }
      // Exclude codes that only contain "Base" pack
      return !(code.packs_unlocked.length === 1 && code.packs_unlocked.includes('Base'));
    }) || [];

    // Get customer emails for redeemed codes
    const redeemedCustomerIds = codes
      ?.filter(code => code.redeemed_by)
      .map(code => code.redeemed_by) || [];

    let customerEmails: Record<string, string> = {};

    if (redeemedCustomerIds.length > 0) {
      const { data: customers, error: customersError } = await supabase
        .from('customers')
        .select('customer_id, customer_email, customer_name')
        .in('customer_id', redeemedCustomerIds);

      if (!customersError && customers) {
        customerEmails = customers.reduce((acc, customer) => {
          acc[customer.customer_id] = customer.customer_email || customer.customer_name || customer.customer_id;
          return acc;
        }, {} as Record<string, string>);
      }
    }

    // Fetch previous codes' details if previous_code_id exists
    const previousCodeIds = codes
      ?.filter(code => code.previous_code_id)
      .map(code => code.previous_code_id) || [];

    let previousCodesMap: Record<string, string> = {};
    if (previousCodeIds.length > 0) {
      const { data: prevCodesData, error: prevCodesError } = await supabase
        .from('license_codes')
        .select('id, code')
        .in('id', previousCodeIds);

      if (!prevCodesError && prevCodesData) {
        previousCodesMap = prevCodesData.reduce((acc, pc) => {
          acc[pc.id] = pc.code;
          return acc;
        }, {} as Record<string, string>);
      }
    }
    
    // Format the response to include customer_email and previous_code details
    const formattedCodes = codes?.map(code => ({
      ...code,
      customer_email: code.redeemed_by ? customerEmails[code.redeemed_by] || null : null,
      customer_name: code.redeemed_by ? customerEmails[code.redeemed_by] || null : null,
      previous_code: code.previous_code_id ? previousCodesMap[code.previous_code_id] || null : null,
      previous_code_id_display: code.previous_code_id ? `${code.previous_code_id.substring(0, 8)}...` : null,
    }));

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
