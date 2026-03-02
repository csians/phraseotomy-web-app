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
      'phraseotomy.ourstagingserver.com': 'testing-cs-store.myshopify.com',
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
      const { data: packs } = await supabase
        .from('themes')
        .select('id, name')
        .in('id', unlockedThemeIds);
      const themeNames = (packs || []).map((p) => p.name);
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Theme code already redeemed',
          alreadyUnlocked: true,
          themesUnlocked: themeNames,
          themesUnlockedWithNames: (packs || []).map((p) => ({ id: p.id, name: p.name })),
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

    // Update theme_codes
    const { error: updateError } = await supabase
      .from('theme_codes')
      .update({
        status: 'active',
        redeemed_by: customerId,
        redeemed_at: new Date().toISOString(),
      })
      .eq('id', themeCode.id);

    if (updateError) {
      console.error('Error updating theme_codes:', updateError);
    }

    // Fetch theme names
    const { data: themes } = await supabase
      .from('themes')
      .select('id, name')
      .in('id', unlockedThemeIds);
    const themeNames = (themes || []).map((t) => t.name);
    const themesWithNames = (themes || []).map((t) => ({ id: t.id, name: t.name ?? t.id }));

    return new Response(
      JSON.stringify({
        success: true,
        message: `Code redeemed! Unlocked themes: ${themeNames.join(', ')}`,
        themesUnlocked: themeNames,
        themesUnlockedWithNames,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('redeem-theme-code error:', err);
    return new Response(
      JSON.stringify({ success: false, error: 'An unexpected error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
