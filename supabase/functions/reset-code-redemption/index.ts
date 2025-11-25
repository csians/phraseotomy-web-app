/**
 * Supabase Edge Function: Reset Code Redemption
 * 
 * Resets a license code by removing customer assignment
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
    const { code_id, shop_domain } = await req.json();

    if (!code_id || !shop_domain) {
      return new Response(
        JSON.stringify({ error: 'code_id and shop_domain are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get tenant
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, access_token')
      .eq('shop_domain', shop_domain)
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

    // Get code info
    const { data: code, error: codeError } = await supabase
      .from('license_codes')
      .select('*')
      .eq('id', code_id)
      .eq('tenant_id', tenant.id)
      .maybeSingle();

    if (codeError || !code) {
      return new Response(
        JSON.stringify({ error: 'Code not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Delete customer licenses associated with this code
    const { error: deleteLicenseError } = await supabase
      .from('customer_licenses')
      .delete()
      .eq('license_code_id', code_id);

    if (deleteLicenseError) {
      console.error('Error deleting customer licenses:', deleteLicenseError);
    }

    // Reset the code
    const { error: updateError } = await supabase
      .from('license_codes')
      .update({
        status: 'unused',
        redeemed_by: null,
        redeemed_at: null,
      })
      .eq('id', code_id);

    if (updateError) {
      console.error('Error resetting code:', updateError);
      return new Response(
        JSON.stringify({ error: updateError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // If code was redeemed, remove from customer metafield
    if (code.redeemed_by && tenant.access_token) {
      try {
        const metafieldResponse = await fetch(
          `https://${shop_domain}/admin/api/2024-01/customers/${code.redeemed_by}/metafields.json`,
          {
            headers: {
              'X-Shopify-Access-Token': tenant.access_token,
              'Content-Type': 'application/json',
            },
          }
        );

        if (metafieldResponse.ok) {
          const { metafields } = await metafieldResponse.json();
          const licenseMetafield = metafields?.find(
            (m: any) => m.namespace === 'phraseotomy' && m.key === 'license_codes'
          );

          if (licenseMetafield) {
            const existingCodes = JSON.parse(licenseMetafield.value || '[]');
            const updatedCodes = existingCodes.filter((c: string) => c !== code.code);

            await fetch(
              `https://${shop_domain}/admin/api/2024-01/customers/${code.redeemed_by}/metafields/${licenseMetafield.id}.json`,
              {
                method: 'PUT',
                headers: {
                  'X-Shopify-Access-Token': tenant.access_token,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  metafield: {
                    id: licenseMetafield.id,
                    value: JSON.stringify(updatedCodes),
                  },
                }),
              }
            );
          }
        }
      } catch (error) {
        console.error('Error updating Shopify metafield:', error);
      }
    }

    console.log(`✅ Code ${code.code} reset successfully`);

    return new Response(
      JSON.stringify({ success: true, message: 'Code reset successfully' }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in reset-code-redemption:', error);
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
