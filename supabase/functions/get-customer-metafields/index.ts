/**
 * Supabase Edge Function: Get Customer Metafields
 * 
 * Fetches customer metafields from Shopify Admin API
 * Requires Shopify Admin API access token
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface CustomerMetafield {
  id: string;
  namespace: string;
  key: string;
  value: string;
  type: string;
}

/**
 * Fetch customer metafields from Shopify Admin API
 */
async function fetchShopifyCustomerMetafields(
  customerId: string,
  shopDomain: string,
  accessToken: string
): Promise<CustomerMetafield[]> {
  const shop = shopDomain.replace('.myshopify.com', '');
  const url = `https://${shop}.myshopify.com/admin/api/2024-01/customers/${customerId}/metafields.json`;

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
    return (data.metafields || []).map((mf: any) => ({
      id: mf.id?.toString() || '',
      namespace: mf.namespace || '',
      key: mf.key || '',
      value: mf.value || '',
      type: mf.type || '',
    }));
  } catch (error) {
    console.error('Error fetching customer metafields:', error);
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
    const { customerId, shopDomain } = await req.json();

    if (!customerId || !shopDomain) {
      return new Response(
        JSON.stringify({ error: 'customerId and shopDomain are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get tenant configuration to access Shopify credentials
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('*')
      .eq('shop_domain', shopDomain)
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

    // Use the access_token from tenant configuration
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

    // Fetch metafields from Shopify
    const metafields = await fetchShopifyCustomerMetafields(
      customerId,
      shopDomain,
      accessToken
    );

    return new Response(
      JSON.stringify({ metafields }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in get-customer-metafields:', error);
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

