/**
 * Supabase Edge Function: Get Customer Licenses
 *
 * Returns which license codes a customer has unlocked, their expire times,
 * and which licenses are currently active.
 *
 * Request body: { customerId: string, shopDomain: string }
 * Response: { customer_id, licenses: [{ code, packs_unlocked, packs_with_names, expires_at, is_active, activated_at }] }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Map of related shop domains (staging <-> production)
const RELATED_SHOP_DOMAINS: Record<string, string[]> = {
  'phraseotomy.com': ['phraseotomy.com', 'qxqtbf-21.myshopify.com'],
  'qxqtbf-21.myshopify.com': ['phraseotomy.com', 'qxqtbf-21.myshopify.com', 'phraseotomy.ourstagingserver.com'],
  'testing-cs-store.myshopify.com': ['testing-cs-store.myshopify.com'],
  'phraseotomy.ourstagingserver.com': ['testing-cs-store.myshopify.com'],
};

function getRelatedDomains(shopDomain: string): string[] {
  return RELATED_SHOP_DOMAINS[shopDomain] || [shopDomain];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { customerId, shopDomain } = await req.json();

    if (!customerId || !shopDomain) {
      return new Response(
        JSON.stringify({ error: 'Missing customerId or shopDomain' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const domainsToSearch = getRelatedDomains(shopDomain);
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Resolve linked customer IDs (staging/prod)
    const { data: customerRecord } = await supabase
      .from('customers')
      .select('customer_id, staging_customer_id, prod_customer_id')
      .or(`customer_id.eq.${customerId},staging_customer_id.eq.${customerId},prod_customer_id.eq.${customerId}`)
      .in('shop_domain', domainsToSearch)
      .limit(1)
      .single();

    const customerIdsToSearch = [customerId];
    if (customerRecord) {
      [customerRecord.customer_id, customerRecord.staging_customer_id, customerRecord.prod_customer_id]
        .filter(Boolean)
        .forEach((id) => {
          if (!customerIdsToSearch.includes(id)) customerIdsToSearch.push(id);
        });
    }

    const { data: licenses, error } = await supabase
      .from('customer_licenses')
      .select(`
        id,
        license_code_id,
        customer_id,
        status,
        activated_at,
        shop_domain,
        license_codes (
          code,
          packs_unlocked,
          expires_at,
          status
        )
      `)
      .in('customer_id', customerIdsToSearch)
      .in('shop_domain', domainsToSearch)
      .eq('status', 'active');

    if (error) {
      console.error('Error fetching customer licenses:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const now = new Date();
    const packIds = new Set<string>();
    (licenses || []).forEach((cl) => {
      const lc = Array.isArray(cl.license_codes) ? cl.license_codes[0] : cl.license_codes;
      (lc?.packs_unlocked ?? []).forEach((id: string) => packIds.add(id));
    });

    const packIdList = Array.from(packIds);
    const packNamesMap: Record<string, string> = {};
    if (packIdList.length > 0) {
      const { data: packs } = await supabase
        .from('packs')
        .select('id, name')
        .in('id', packIdList);
      (packs || []).forEach((p) => {
        packNamesMap[p.id] = p.name ?? p.id;
      });
    }

    const formatted = (licenses || []).map((cl) => {
      const lc = Array.isArray(cl.license_codes) ? cl.license_codes[0] : cl.license_codes;
      const expiresAt = lc?.expires_at ? new Date(lc.expires_at) : null;
      const isExpired = expiresAt ? expiresAt < now : false;
      const isActive = !isExpired && (lc?.status === 'active' || cl.status === 'active');
      const packIdsForLicense = lc?.packs_unlocked ?? [];
      const packs_with_names = packIdsForLicense.map((id: string) => ({
        id,
        name: packNamesMap[id] ?? id,
      }));

      return {
        code: lc?.code ?? null,
        packs_unlocked: packIdsForLicense,
        packs_with_names,
        expires_at: lc?.expires_at ?? null,
        is_active: isActive,
        activated_at: cl.activated_at ?? null,
        license_code_id: cl.license_code_id,
      };
    });

    return new Response(
      JSON.stringify({
        customer_id: customerId,
        licenses: formatted,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err) {
    console.error('Error in get-customer-licenses:', err);
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: msg }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
