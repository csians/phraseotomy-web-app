/**
 * Supabase Edge Function: Update Customer Name
 * 
 * Updates customer name in both Supabase and Shopify
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
    const { customer_id, customer_name, shop_domain } = await req.json();

    if (!customer_id || !customer_name || !shop_domain) {
      return new Response(
        JSON.stringify({ error: 'customer_id, customer_name, and shop_domain are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Parse name into first and last name
    const nameParts = customer_name.trim().split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ') || null;

    console.log('Updating customer name:', { customer_id, customer_name, firstName, lastName, shop_domain });

    // 1. Update in Supabase customers table
    const { data: existingCustomer, error: findError } = await supabase
      .from('customers')
      .select('id')
      .eq('customer_id', customer_id)
      .maybeSingle();

    if (findError) {
      console.error('Error finding customer:', findError);
      return new Response(
        JSON.stringify({ error: 'Failed to find customer record' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (existingCustomer) {
      // Update existing customer
      const { error: updateError } = await supabase
        .from('customers')
        .update({
          customer_name: customer_name,
          first_name: firstName,
          last_name: lastName,
        })
        .eq('id', existingCustomer.id);

      if (updateError) {
        console.error('Error updating customer in Supabase:', updateError);
        return new Response(
          JSON.stringify({ error: 'Failed to update customer in database' }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
      console.log('✅ Customer updated in Supabase');
    } else {
      console.log('⚠️ Customer not found in Supabase, skipping database update');
    }

    // 2. Update in Shopify
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('access_token, shop_domain')
      .eq('shop_domain', shop_domain)
      .eq('is_active', true)
      .maybeSingle();

    if (tenantError || !tenant) {
      console.error('Tenant not found:', tenantError);
      // Still return success since Supabase was updated
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Name saved (Shopify sync skipped - tenant not found)',
          shopify_updated: false 
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!tenant.access_token) {
      console.warn('No Shopify access token configured');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Name saved (Shopify sync skipped - no access token)',
          shopify_updated: false 
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Update customer in Shopify
    const shopifyDomain = tenant.shop_domain.includes('.myshopify.com') 
      ? tenant.shop_domain 
      : `${tenant.shop_domain.replace('.myshopify.com', '')}.myshopify.com`;
    
    // Handle custom domains - need to find the actual myshopify domain
    let actualShopifyDomain = shopifyDomain;
    if (!shopifyDomain.includes('.myshopify.com')) {
      // For custom domains like phraseotomy.com, we need to use the Shopify admin API
      // The tenant should have the actual myshopify.com domain stored
      console.log('Custom domain detected, using stored shop_domain for API calls');
    }

    const shopifyUrl = `https://${actualShopifyDomain}/admin/api/2024-01/customers/${customer_id}.json`;
    
    console.log('Updating Shopify customer:', shopifyUrl);

    try {
      const shopifyResponse = await fetch(shopifyUrl, {
        method: 'PUT',
        headers: {
          'X-Shopify-Access-Token': tenant.access_token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customer: {
            id: customer_id,
            first_name: firstName,
            last_name: lastName || '',
          },
        }),
      });

      if (!shopifyResponse.ok) {
        const errorText = await shopifyResponse.text();
        console.error('Shopify API error:', shopifyResponse.status, errorText);
        // Still return success since Supabase was updated
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Name saved (Shopify sync failed)',
            shopify_updated: false,
            shopify_error: errorText 
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      const shopifyData = await shopifyResponse.json();
      console.log('✅ Customer updated in Shopify:', shopifyData.customer?.id);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Name saved successfully',
          shopify_updated: true 
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    } catch (shopifyError) {
      console.error('Error calling Shopify API:', shopifyError);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Name saved (Shopify sync error)',
          shopify_updated: false 
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
  } catch (error) {
    console.error('Error in update-customer-name:', error);
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
