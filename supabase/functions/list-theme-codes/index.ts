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
    // Get unique redeemed customer IDs
    const redeemedCustomerIds = [
      ...new Set(
        codes
          ?.filter(code => code.redeemed_by)
          .map(code => code.redeemed_by)
      )
    ];

    let customerMap: Record<string, { name: string; email: string }> = {};

    if (redeemedCustomerIds.length > 0) {
      const { data: customers, error: customersError } = await supabase
        .from('customers')
        .select('customer_id, customer_email, customer_name, first_name, last_name')
        .eq('tenant_id', tenant.id)
        .in('customer_id', redeemedCustomerIds);   // 🔥 important

      if (!customersError && customers) {
        customers.forEach(customer => {
          const fullName = `${customer.first_name || ''} ${customer.last_name || ''}`.trim();

          const displayName =
            customer.customer_name ||
            fullName ||
            customer.customer_email?.split('@')[0] ||
            `Customer ${customer.customer_id}`;

          customerMap[customer.customer_id] = {
            name: displayName,
            email: customer.customer_email || ''
          };
        });
      }
    }

    // Enrich codes with customer information
    // Theme codes use their own expires_at (set when redeeming, extended on re-redeem).
    // Do NOT override with license expiry - theme codes have independent expiry.
    const enrichedCodes = codes?.map(code => {
      const codeWithInheritedExpiry = {
        ...code,
        // Use theme_codes.expires_at - it is set/updated by redeem-theme-code
        expires_at: code.expires_at ?? null,
      };
      if (!code.redeemed_by) {
        // No redemption data - check if there's a redeemed_at timestamp with missing redeemed_by
        if (code.redeemed_at) {
          return {
            ...codeWithInheritedExpiry,
            redeemed_by: 'Unknown Customer (missing data)',
            customer_email: '',
            customer_lookup_status: 'missing_redeemed_by_data'
          };
        }
        return codeWithInheritedExpiry; // Truly unredeemed code
      }

      if (customerMap[code.redeemed_by]) {
        // Found customer information
        return {
          ...codeWithInheritedExpiry,
          redeemed_by: customerMap[code.redeemed_by].name,
          customer_email: customerMap[code.redeemed_by].email,
          customer_lookup_status: 'found_in_database'
        };
      } else {
        // No customer found - provide meaningful fallback
        const isEmail = code.redeemed_by && code.redeemed_by.includes('@');
        let fallbackName;
        let fallbackEmail = '';

        if (isEmail) {
          // If it's an email, extract username part for display name
          fallbackName = code.redeemed_by.split('@')[0];
          fallbackEmail = code.redeemed_by;
        } else if (code.redeemed_by && code.redeemed_by.startsWith('Customer_')) {
          // If it's our fallback format, clean it up
          fallbackName = code.redeemed_by.replace('Customer_', 'Customer ');
        } else if (code.redeemed_by) {
          // Assume it's a username or customer name
          fallbackName = code.redeemed_by;
        } else {
          fallbackName = 'Unknown Customer';
        }

        return {
          ...codeWithInheritedExpiry,
          redeemed_by: fallbackName,
          customer_email: fallbackEmail,
          customer_lookup_status: 'not_found_in_database'
        };
      }
    }) || [];

    console.log('✅ Theme codes loaded:', enrichedCodes.length);
    console.log('📊 Customer lookup stats:', {
      totalRedeemed: redeemedCustomerIds.length,
      customersInDatabase: Object.keys(customerMap).length,
      redeemedByValues: codes?.filter(c => c.redeemed_by).map(c => c.redeemed_by) || [],
      customerMapKeys: Object.keys(customerMap).slice(0, 5), // Show first 5 keys for debugging
      notFoundCount: enrichedCodes.filter(c => c.customer_lookup_status === 'not_found_in_database').length
    });

    // Log specific examples for debugging
    const redeemedCodes = enrichedCodes.filter(c => c.redeemed_by);
    if (redeemedCodes.length > 0) {
      console.log('📋 Sample redeemed codes with customer names:',
        redeemedCodes.slice(0, 3).map(c => ({
          code: c.code,
          redeemed_by: c.redeemed_by,
          customer_email: c.customer_email,
          lookup_status: c.customer_lookup_status
        }))
      );
    }

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