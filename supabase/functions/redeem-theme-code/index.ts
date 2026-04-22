/**
 * Redeem Theme Code API
 *
 * Unlocks themes for a customer using a theme code.
 * No auth required - called from user flow with code, customerId, shopDomain.
 *
 * Request: { code: string, customerId: string, shopDomain: string }
 * Response: { success: boolean, message: string, themesUnlocked: string[], themesUnlockedWithNames: { id, name }[] }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RELATED_SHOP_DOMAINS: Record<string, string[]> = {
  'phraseotomy.com': ['phraseotomy.com', 'qxqtbf-21.myshopify.com'],
  'qxqtbf-21.myshopify.com': ['phraseotomy.com', 'qxqtbf-21.myshopify.com', 'phraseotomy-game.vercel.app'],
  'testing-cs-store.myshopify.com': ['testing-cs-store.myshopify.com'],
  'phraseotomy-game.vercel.app': ['testing-cs-store.myshopify.com'],
};

function getRelatedDomains(shopDomain: string): string[] {
  return RELATED_SHOP_DOMAINS[shopDomain.toLowerCase()] || [shopDomain];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { code, customerId, shopDomain } = await req.json();

    if (!code || !customerId || !shopDomain) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields (code, customerId, shopDomain)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const normalizedCode = code.toString().trim().toUpperCase();
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Resolve shop domain (custom domain -> myshopify)
    const shopDomainMap: Record<string, string> = {
      'phraseotomy.com': 'qxqtbf-21.myshopify.com',
      'phraseotomy-game.vercel.app': 'testing-cs-store.myshopify.com',
    };
    const effectiveShop = shopDomainMap[shopDomain.toLowerCase()] || shopDomain;

    let tenant = null;
    let tenantError = null;
    const { data: t1 } = await supabase
      .from('tenants')
      .select('id, shop_domain')
      .eq('shop_domain', shopDomain)
      .eq('is_active', true)
      .maybeSingle();
    if (t1) tenant = t1;
    else {
      const { data: t2, error: e2 } = await supabase
        .from('tenants')
        .select('id, shop_domain')
        .eq('shop_domain', effectiveShop)
        .eq('is_active', true)
        .maybeSingle();
      tenant = t2;
      tenantError = e2;
    }

    if (tenantError || !tenant) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid shop domain' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: themeCode, error: codeError } = await supabase
      .from('theme_codes')
      .select('*')
      .eq('code', normalizedCode)
      .eq('tenant_id', tenant.id)
      .in('status', ['unused', 'active'])
      .maybeSingle();

    if (codeError || !themeCode) {
      return new Response(
        JSON.stringify({ success: false, error: 'Theme code not found or inactive' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const unlockedThemeIds = themeCode.themes_unlocked || [];
    if (unlockedThemeIds.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Theme code is not configured for any themes' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if already redeemed by this customer
    const { data: existingCtc } = await supabase
      .from('customer_theme_codes')
      .select('id')
      .eq('customer_id', customerId)
      .eq('theme_code_id', themeCode.id)
      .eq('status', 'active')
      .maybeSingle();

    if (existingCtc) {
      // Extend expiry when customer re-redeems (30 days from now)
      const extendsExpiresAt = new Date();
      extendsExpiresAt.setDate(extendsExpiresAt.getDate() + 30);
      const { error: extendError } = await supabase
        .from('theme_codes')
        .update({ expires_at: extendsExpiresAt.toISOString() })
        .eq('id', themeCode.id);

      if (extendError) {
        console.error('Error extending theme code expiry:', extendError);
      }

      const { data: packs } = await supabase
        .from('themes')
        .select('id, name')
        .in('id', unlockedThemeIds);
      const themeNames = (packs || []).map((p) => p.name);
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Theme code already redeemed. Access extended.',
          alreadyUnlocked: true,
          themesUnlocked: themeNames,
          themesUnlockedWithNames: (packs || []).map((p) => ({ id: p.id, name: p.name })),
          expiresAt: extendsExpiresAt.toISOString(),
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Redeemed by someone else?
    if (themeCode.redeemed_at && themeCode.redeemed_by && themeCode.redeemed_by !== customerId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Theme code has already been redeemed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if all themes from this code are already active for this customer (via other theme codes)
    const domainsToSearch = getRelatedDomains(shopDomain);
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
        .forEach((id: string) => {
          if (!customerIdsToSearch.includes(id)) customerIdsToSearch.push(id);
        });
    }

    const { data: existingThemeCodes } = await supabase
      .from('customer_theme_codes')
      .select('theme_code_id, theme_codes (themes_unlocked, expires_at)')
      .in('customer_id', customerIdsToSearch)
      .in('shop_domain', domainsToSearch)
      .eq('status', 'active')
      .neq('theme_code_id', themeCode.id);

    const now = new Date();
    const alreadyActiveThemeIds = new Set<string>();
    (existingThemeCodes || []).forEach((ctc) => {
      const tc = Array.isArray(ctc.theme_codes) ? ctc.theme_codes[0] : ctc.theme_codes;
      if (!tc) return;
      const expiresAt = tc.expires_at ? new Date(tc.expires_at) : null;
      if (expiresAt && expiresAt < now) return;
      (tc.themes_unlocked ?? []).forEach((id: string) => alreadyActiveThemeIds.add(id));
    });

    const newThemeIds = unlockedThemeIds;
    const allAlreadyActive = newThemeIds.length > 0 && newThemeIds.every((id: string) => alreadyActiveThemeIds.has(id));
    if (allAlreadyActive) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'THEMES_ALREADY_ACTIVE',
          message: 'You already have access to all themes from this code.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create customer_theme_codes
    const { error: insertError } = await supabase
      .from('customer_theme_codes')
      .insert({
        customer_id: customerId,
        theme_code_id: themeCode.id,
        shop_domain: tenant.shop_domain,
        tenant_id: tenant.id,
        status: 'active',
      });

    if (insertError) {
      console.error('Error creating customer_theme_codes:', insertError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to redeem theme code' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Set expires_at to 30 days from now when redeeming
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    // Update theme_codes
    const { error: updateError } = await supabase
      .from('theme_codes')
      .update({
        status: 'active',
        redeemed_by: customerId,
        redeemed_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
      })
      .eq('id', themeCode.id);

    if (updateError) {
      console.error('Error updating theme_codes:', updateError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to update theme code' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch theme names (safely handle empty or invalid IDs)
    let themeNames: string[] = [];
    let themesWithNames: { id: string; name: string }[] = [];
    if (unlockedThemeIds.length > 0) {
      const { data: themes } = await supabase
        .from('themes')
        .select('id, name')
        .in('id', unlockedThemeIds);
      themeNames = (themes || []).map((t) => t.name ?? t.id);
      themesWithNames = (themes || []).map((t) => ({ id: t.id, name: t.name ?? t.id }));
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Code redeemed! Unlocked themes: ${themeNames.join(', ')}`,
        themesUnlocked: themeNames,
        themesUnlockedWithNames: themesWithNames,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error('redeem-theme-code error:', err);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'An unexpected error occurred',
        details: errMsg,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
