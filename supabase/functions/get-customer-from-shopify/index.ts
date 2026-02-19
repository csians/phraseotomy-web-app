/**
 * Supabase Edge Function: Get Customer From Shopify
 *
 * Fetches customer details from Shopify Admin API by customer ID and shop domain.
 * Does not read from Supabase – only from Shopify.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Custom domains must resolve to *.myshopify.com for Admin API
const CUSTOM_DOMAIN_TO_MYSHOPIFY: Record<string, string> = {
  'phraseotomy.com': 'qxqtbf-21.myshopify.com',
  'phraseotomy.ourstagingserver.com': 'testing-cs-store.myshopify.com',
};

function getShopifyApiHost(shopDomain: string): string {
  const normalized = (shopDomain || '').trim().toLowerCase();
  if (normalized.endsWith('.myshopify.com')) return normalized;
  return CUSTOM_DOMAIN_TO_MYSHOPIFY[normalized] || normalized;
}

export interface ShopifyCustomerDetails {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  name: string | null;
  phone: string | null;
  created_at: string | null;
  updated_at: string | null;
}

Deno.serve(async (req) => {
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

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const apiHost = getShopifyApiHost(shopDomain);

    // Tenant lookup: try given shopDomain first, then resolved *.myshopify.com host
    let { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, access_token, shop_domain')
      .eq('shop_domain', shopDomain)
      .eq('is_active', true)
      .maybeSingle();

    if ((tenantError || !tenant) && apiHost !== shopDomain) {
      const res = await supabase
        .from('tenants')
        .select('id, access_token, shop_domain')
        .eq('shop_domain', apiHost)
        .eq('is_active', true)
        .maybeSingle();
      tenant = res.data;
      tenantError = res.error;
    }

    if (tenantError || !tenant?.access_token) {
      return new Response(
        JSON.stringify({ error: 'Tenant not found or missing Shopify access token' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const url = `https://${apiHost}/admin/api/2024-01/customers/${customerId}.json`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Shopify-Access-Token': tenant.access_token,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('Shopify API error:', response.status, text);
      return new Response(
        JSON.stringify({
          error: `Shopify API error: ${response.status}`,
          details: response.status === 404 ? 'Customer not found' : text.slice(0, 200),
        }),
        {
          status: response.status === 404 ? 404 : 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const data = await response.json();
    const c = data.customer;

    if (!c) {
      return new Response(
        JSON.stringify({ error: 'Customer not found in Shopify response' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const customer: ShopifyCustomerDetails = {
      id: String(c.id),
      email: c.email || null,
      first_name: c.first_name || null,
      last_name: c.last_name || null,
      name:
        c.first_name && c.last_name
          ? `${c.first_name} ${c.last_name}`.trim()
          : c.first_name || c.last_name || null,
      phone: c.phone || null,
      created_at: c.created_at || null,
      updated_at: c.updated_at || null,
    };

    return new Response(
      JSON.stringify({ customer }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in get-customer-from-shopify:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
