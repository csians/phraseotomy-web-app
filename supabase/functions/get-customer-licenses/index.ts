/**
 * Supabase Edge Function: Get Customer Licenses
 *
 * Returns which license codes a customer has unlocked (packs) and which theme
 * codes they have redeemed (themes), with expire times and active status.
 *
 * Request body: { customerId: string, shopDomain: string }
 * Response: {
 *   customer_id,
 *   licenses: [{ code, packs_unlocked, packs_with_names, expires_at, is_active, activated_at }],
 *   theme_codes: [{ code, themes_unlocked, themes_with_names, expires_at, redeemed_at, is_active }]
 * }
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
  'qxqtbf-21.myshopify.com': ['phraseotomy.com', 'qxqtbf-21.myshopify.com', 'phraseotomy-game.vercel.app'],
  'testing-cs-store.myshopify.com': ['testing-cs-store.myshopify.com'],
  'phraseotomy-game.vercel.app': ['testing-cs-store.myshopify.com'],
};

function getRelatedDomains(shopDomain: string): string[] {
  return RELATED_SHOP_DOMAINS[shopDomain] || [shopDomain];
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(s: string): boolean {
  return UUID_REGEX.test(s);
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
        tenant_id,
        license_codes (
          code,
          packs_unlocked,
          expires_at,
          status,
          tenant_id
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
      const uuidList = packIdList.filter(isUuid);
      const nameList = packIdList.filter((id) => !isUuid(id));

      if (uuidList.length > 0) {
        const { data: packsById } = await supabase
          .from('packs')
          .select('id, name')
          .in('id', uuidList);
        (packsById || []).forEach((p) => {
          packNamesMap[p.id] = p.name ?? p.id;
        });
      }

      if (nameList.length > 0) {
        const tenantId = (licenses || [])[0]?.tenant_id;
        if (tenantId) {
          const { data: packsByName } = await supabase
            .from('packs')
            .select('id, name')
            .eq('tenant_id', tenantId)
            .in('name', nameList);
          (packsByName || []).forEach((p) => {
            packNamesMap[p.id] = p.name ?? p.id;
            packNamesMap[p.name] = p.name;
          });
        }
        nameList.forEach((name) => {
          if (!(name in packNamesMap)) packNamesMap[name] = name;
        });
      }
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

    // Filter licenses: only include entries that add packs not already active from another license
    const seenPackIds = new Set<string>();
    const filteredLicenses: typeof formatted = [];
    for (const lic of formatted.sort((a, b) => new Date(a.activated_at || 0).getTime() - new Date(b.activated_at || 0).getTime())) {
      const newPackIds = (lic.packs_unlocked ?? []).filter((id: string) => !seenPackIds.has(id));
      if (newPackIds.length === 0) continue;
      newPackIds.forEach((id: string) => seenPackIds.add(id));
      filteredLicenses.push({
        ...lic,
        packs_unlocked: newPackIds,
        packs_with_names: lic.packs_with_names.filter((p) => newPackIds.includes(p.id)),
      });
    }

    // Fetch theme codes redeemed by this customer
    const { data: customerThemeCodes, error: themeCodesError } = await supabase
      .from('customer_theme_codes')
      .select(`
        theme_code_id,
        activated_at,
        theme_codes (
          code,
          themes_unlocked,
          expires_at,
          redeemed_at
        )
      `)
      .in('customer_id', customerIdsToSearch)
      .in('shop_domain', domainsToSearch)
      .eq('status', 'active');

    if (themeCodesError) {
      console.error('Error fetching customer theme codes:', themeCodesError);
      return new Response(
        JSON.stringify({ error: themeCodesError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const themeIds = new Set<string>();
    (customerThemeCodes || []).forEach((ctc) => {
      const tc = Array.isArray(ctc.theme_codes) ? ctc.theme_codes[0] : ctc.theme_codes;
      (tc?.themes_unlocked ?? []).forEach((id: string) => themeIds.add(id));
    });

    const themeNamesMap: Record<string, string> = {};
    const themeIdList = Array.from(themeIds);
    if (themeIdList.length > 0) {
      const { data: themes } = await supabase
        .from('themes')
        .select('id, name')
        .in('id', themeIdList);
      (themes || []).forEach((t) => {
        themeNamesMap[t.id] = t.name ?? t.id;
      });
    }

    const formattedThemeCodes = (customerThemeCodes || []).map((ctc) => {
      const tc = Array.isArray(ctc.theme_codes) ? ctc.theme_codes[0] : ctc.theme_codes;
      const expiresAt = tc?.expires_at ? new Date(tc.expires_at) : null;
      const isExpired = expiresAt ? expiresAt < now : false;
      const isActive = !isExpired;
      const themeIdsForCode = tc?.themes_unlocked ?? [];
      const themes_with_names = themeIdsForCode.map((id: string) => ({
        id,
        name: themeNamesMap[id] ?? id,
      }));
      const themes_unlocked = themes_with_names.map((t) => t.name);

      return {
        code: tc?.code ?? null,
        themes_unlocked,
        themes_with_names,
        expires_at: tc?.expires_at ?? null,
        redeemed_at: tc?.redeemed_at ?? ctc.activated_at ?? null,
        is_active: isActive,
      };
    });

    // Filter theme_codes: only include entries that add themes not already active from another code
    const seenThemeIds = new Set<string>();
    const filteredThemeCodes: { code: string | null; themes_unlocked: string[]; themes_with_names: { id: string; name: string }[]; expires_at: string | null; redeemed_at: string | null; is_active: boolean }[] = [];
    for (const tc of formattedThemeCodes.sort(
      (a, b) => new Date(a.redeemed_at || 0).getTime() - new Date(b.redeemed_at || 0).getTime()
    )) {
      const tcThemeIds = tc.themes_with_names.map((t) => t.id);
      const newThemeIds = tcThemeIds.filter((id) => !seenThemeIds.has(id));
      if (newThemeIds.length === 0) continue;
      newThemeIds.forEach((id) => seenThemeIds.add(id));
      filteredThemeCodes.push({
        code: tc.code,
        themes_unlocked: tc.themes_with_names.filter((t) => newThemeIds.includes(t.id)).map((t) => t.name),
        themes_with_names: tc.themes_with_names.filter((t) => newThemeIds.includes(t.id)),
        expires_at: tc.expires_at,
        redeemed_at: tc.redeemed_at,
        is_active: tc.is_active,
      });
    }

    return new Response(
      JSON.stringify({
        customer_id: customerId,
        licenses: filteredLicenses,
        theme_codes: filteredThemeCodes,
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
