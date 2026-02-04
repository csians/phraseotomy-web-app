/**
 * Supabase Edge Function: List Theme Codes
 * 
 * Lists all theme codes for a tenant using service role
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

    console.log('Loading theme codes for tenant:', tenant.id);

    // List all theme codes for the tenant
    const { data: codes, error: codesError } = await supabase
      .from('theme_codes')
      .select('*')
      .eq('tenant_id', tenant.id)
      .order('created_at', { ascending: false });

    if (codesError) {
      console.error('Error loading theme codes:', codesError);
      return new Response(
        JSON.stringify({ error: codesError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Get customer information for redeemed codes
    const redeemedCustomerIds = codes
      ?.filter(code => code.redeemed_by)
      .map(code => code.redeemed_by) || [];

    let customerMap: Record<string, { name: string; email: string }> = {};

    if (redeemedCustomerIds.length > 0) {
      // Check if redeemed_by contains emails (new format) or customer IDs (old format)
      const hasEmails = redeemedCustomerIds.some(id => id.includes('@'));
      
      if (hasEmails) {
        // New format: redeemed_by contains emails
        const { data: customers, error: customersError } = await supabase
          .from('customers')
          .select('customer_email, customer_name, first_name, last_name')
          .in('customer_email', redeemedCustomerIds.filter(id => id.includes('@')))
          .eq('tenant_id', tenant.id);

        if (!customersError && customers) {
          customerMap = customers.reduce((acc, customer) => {
            const fullName = `${customer.first_name || ''} ${customer.last_name || ''}`.trim();
            const displayName = customer.customer_name || 
                               fullName || 
                               customer.customer_email ||
                               'Unknown Customer';
            acc[customer.customer_email] = {
              name: displayName,
              email: customer.customer_email
            };
            return acc;
          }, {} as Record<string, { name: string; email: string }>);
        }
      } else {
        // Old format: redeemed_by contains customer IDs
        const { data: customers, error: customersError } = await supabase
          .from('customers')
          .select('customer_id, customer_email, customer_name, first_name, last_name')
          .in('customer_id', redeemedCustomerIds)
          .eq('tenant_id', tenant.id);

        if (!customersError && customers) {
          customerMap = customers.reduce((acc, customer) => {
            const fullName = `${customer.first_name || ''} ${customer.last_name || ''}`.trim();
            const displayName = customer.customer_name || 
                               fullName ||
                               customer.customer_email ||
                               `Customer ${customer.customer_id}`;
            acc[customer.customer_id] = {
              name: displayName,
              email: customer.customer_email || ''
            };
            return acc;
          }, {} as Record<string, { name: string; email: string }>);
        }
      }
    }

    // Enrich codes with customer information
    const enrichedCodes = codes?.map(code => {
      if (!code.redeemed_by) {
        return code; // No redemption data
      }

      if (customerMap[code.redeemed_by]) {
        // Found customer information
        return {
          ...code,
          redeemed_by: customerMap[code.redeemed_by].name,
          customer_email: customerMap[code.redeemed_by].email
        };
      } else {
        // No customer found - keep original value as fallback
        console.log(`⚠️  No customer found for redeemed_by: ${code.redeemed_by}`);
        return {
          ...code,
          redeemed_by: code.redeemed_by, // Keep original (could be email or customer ID)
          customer_email: code.redeemed_by.includes('@') ? code.redeemed_by : ''
        };
      }
    }) || [];

    console.log('✅ Theme codes loaded:', enrichedCodes.length);
    console.log('📊 Customer lookup stats:', {
      totalRedeemed: redeemedCustomerIds.length,
      customersFound: Object.keys(customerMap).length,
      customerMap: Object.keys(customerMap).length > 0 ? customerMap : 'No customers found'
    });

    return new Response(
      JSON.stringify({ success: true, codes: enrichedCodes }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in list-theme-codes:', error);
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
