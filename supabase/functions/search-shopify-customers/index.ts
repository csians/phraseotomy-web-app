/**
 * Supabase Edge Function: Search Shopify Customers
 * 
 * Searches for customers in Shopify by email or name
 * Returns customer ID, email, first name, last name
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface ShopifyCustomer {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
}

async function searchShopifyCustomers(
  query: string,
  shopDomain: string,
  accessToken: string
): Promise<ShopifyCustomer[]> {
  const shop = shopDomain.replace('.myshopify.com', '');
  
  // Search by email or name using Shopify Admin API
  const url = `https://${shop}.myshopify.com/admin/api/2024-01/customers/search.json?query=${encodeURIComponent(query)}&limit=20`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Shopify API error:', errorText);
      throw new Error(`Shopify API error: ${response.status}`);
    }

    const data = await response.json();
    
    return (data.customers || []).map((customer: any) => ({
      id: customer.id?.toString() || '',
      email: customer.email || '',
      first_name: customer.first_name || null,
      last_name: customer.last_name || null,
    }));
  } catch (error) {
    console.error('Error searching customers:', error);
    throw error;
  }
}

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, shop_domain } = await req.json();

    if (!query || !shop_domain) {
      return new Response(
        JSON.stringify({ error: 'query and shop_domain are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Initialize Supabase client with service role
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get tenant configuration
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('access_token')
      .eq('shop_domain', shop_domain)
      .eq('is_active', true)
      .maybeSingle();

    if (tenantError || !tenant) {
      console.error('Tenant not found:', tenantError);
      return new Response(
        JSON.stringify({ error: 'Tenant not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const accessToken = tenant.access_token;

    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: 'Shopify access token not configured' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('Searching customers:', { query, shop_domain });

    // Search customers
    const customers = await searchShopifyCustomers(query, shop_domain, accessToken);

    console.log('✅ Found customers:', customers.length);

    return new Response(
      JSON.stringify({ success: true, customers }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in search-shopify-customers:', error);
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
