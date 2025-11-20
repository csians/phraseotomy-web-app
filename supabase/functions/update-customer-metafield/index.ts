/**
 * Supabase Edge Function: Update Customer Metafield
 * 
 * Adds or updates a license code in a customer's Shopify metafields
 * Requires admin authentication
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Update customer metafield in Shopify Admin API
 */
async function updateShopifyCustomerMetafield(
  customerId: string,
  code: string,
  shopDomain: string,
  accessToken: string
): Promise<void> {
  const shop = shopDomain.replace('.myshopify.com', '');
  
  // First, get existing metafields
  const getUrl = `https://${shop}.myshopify.com/admin/api/2024-01/customers/${customerId}/metafields.json`;
  
  const getResponse = await fetch(getUrl, {
    method: 'GET',
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json',
    },
  });

  console.log("getResponse", getResponse)

  if (!getResponse.ok) {
    throw new Error(`Failed to fetch customer metafields: ${getResponse.status}`);
  }

  const { metafields } = await getResponse.json();
  
  // Check if phraseotomy namespace exists
  const existingMetafield = metafields?.find(
    (mf: any) => mf.namespace === 'phraseotomy' && mf.key === 'license_codes'
  );

  let existingCodes: string[] = [];
  if (existingMetafield) {
    try {
      existingCodes = JSON.parse(existingMetafield.value);
    } catch (e) {
      existingCodes = [];
    }
  }

  // Add new code if it doesn't exist
  if (!existingCodes.includes(code)) {
    existingCodes.push(code);
  }

  // Update or create metafield
  const metafieldData = {
    metafield: {
      namespace: 'phraseotomy',
      key: 'license_codes',
      value: JSON.stringify(existingCodes),
      type: 'json',
    }
  };

  let updateUrl: string;
  let method: string;

  if (existingMetafield) {
    // Update existing metafield
    updateUrl = `https://${shop}.myshopify.com/admin/api/2024-01/customers/${customerId}/metafields/${existingMetafield.id}.json`;
    method = 'PUT';
  } else {
    // Create new metafield
    updateUrl = `https://${shop}.myshopify.com/admin/api/2024-01/customers/${customerId}/metafields.json`;
    method = 'POST';
  }

  const updateResponse = await fetch(updateUrl, {
    method,
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(metafieldData),
  });

  if (!updateResponse.ok) {
    const errorText = await updateResponse.text();
    console.error('Shopify API error:', errorText);
    throw new Error(`Failed to update customer metafield: ${updateResponse.status}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { customerId, customerEmail, code, shopDomain } = await req.json();

    if (!customerId || !code || !shopDomain) {
      return new Response(
        JSON.stringify({ error: 'customerId, code, and shopDomain are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify user is admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Get user from auth header
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Check if user is admin
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (roleError || !roleData) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Get tenant configuration
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

    // Verify the code exists and belongs to this tenant
    const { data: licenseCode, error: codeError } = await supabase
      .from('license_codes')
      .select('*')
      .eq('code', code)
      .eq('tenant_id', tenant.id)
      .maybeSingle();

    if (codeError || !licenseCode) {
      return new Response(
        JSON.stringify({ error: 'License code not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Update customer metafield in Shopify
    await updateShopifyCustomerMetafield(
      customerId,
      code,
      shopDomain,
      accessToken
    );

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Code ${code} assigned to customer ${customerEmail || customerId}` 
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in update-customer-metafield:', error);
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
