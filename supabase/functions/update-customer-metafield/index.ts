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
  accessToken: string,
  type: 'license' | 'theme' = 'license'
): Promise<void> {
  const metafieldKey = type === 'theme' ? 'theme_codes' : 'license_codes';

  const getUrl = `https://${shopDomain}/admin/api/2024-01/customers/${customerId}/metafields.json`;

  const getResponse = await fetch(getUrl, {
    method: 'GET',
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json',
    },
  });

  if (!getResponse.ok) {
    throw new Error(`Failed to fetch customer metafields: ${getResponse.status}`);
  }

  const { metafields } = await getResponse.json();

  const existingMetafield = metafields?.find(
    (mf: any) => mf.namespace === 'phraseotomy' && mf.key === metafieldKey
  );

  let existingCodes: string[] = [];

  if (existingMetafield) {
    try {
      existingCodes = JSON.parse(existingMetafield.value);
    } catch {
      existingCodes = [];
    }
  }

  if (!existingCodes.includes(code)) {
    existingCodes.push(code);
  }

  const metafieldData = {
    metafield: {
      namespace: 'phraseotomy',
      key: metafieldKey,
      value: JSON.stringify(existingCodes),
      type: 'json',
    }
  };

  let updateUrl: string;
  let method: string;

  if (existingMetafield) {
    updateUrl = `https://${shopDomain}/admin/api/2024-01/customers/${customerId}/metafields/${existingMetafield.id}.json`;
    method = 'PUT';
  } else {
    updateUrl = `https://${shopDomain}/admin/api/2024-01/customers/${customerId}/metafields.json`;
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
    const { customerId, customerEmail, code, shopDomain, type = 'license' } = await req.json();

    if (!customerId || !code || !shopDomain) {
      return new Response(
        JSON.stringify({ error: 'customerId, code, and shopDomain are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log('📝 Assigning code to customer:', { customerId, code, shopDomain, type });

    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('*')
      .eq('shop_domain', shopDomain)
      .eq('is_active', true)
      .maybeSingle();

    if (tenantError || !tenant) {
      return new Response(
        JSON.stringify({ error: 'Tenant not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const accessToken = tenant.access_token;

    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: 'Shopify access token not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const codeTable = type === 'theme' ? 'theme_codes' : 'license_codes';

    const { data: codeData, error: codeError } = await supabase
      .from(codeTable)
      .select('*')
      .eq('code', code)
      .eq('tenant_id', tenant.id)
      .maybeSingle();

    if (codeError || !codeData) {
      return new Response(
        JSON.stringify({ error: `${type === 'theme' ? 'Theme' : 'License'} code not found` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1️⃣ Update Shopify metafield
    await updateShopifyCustomerMetafield(
      customerId,
      code,
      shopDomain,
      accessToken,
      type
    );

    // 2️⃣ 🔥 UPDATE DATABASE (THIS WAS MISSING)
    if (type === 'theme') {
      await supabase
        .from('theme_codes')
        .update({
          status: 'active',
          redeemed_by: customerId, // Must match customers.customer_id
          redeemed_at: new Date().toISOString()
        })
        .eq('code', code)
        .eq('tenant_id', tenant.id);
    }

    console.log('✅ Code assigned successfully:', { customerId, code, type });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Code ${code} assigned to customer ${customerEmail || customerId}`
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in update-customer-metafield:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});