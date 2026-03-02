import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.83.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RELATED_SHOP_DOMAINS: Record<string, string[]> = {
  'phraseotomy.com': ['phraseotomy.com', 'qxqtbf-21.myshopify.com'],
  'qxqtbf-21.myshopify.com': ['phraseotomy.com', 'qxqtbf-21.myshopify.com', 'phraseotomy.ourstagingserver.com'],
  'testing-cs-store.myshopify.com': ['testing-cs-store.myshopify.com'],
  'phraseotomy.ourstagingserver.com': ['testing-cs-store.myshopify.com'],
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

    console.log('🎟️ Redeeming code:', { code, customerId, shopDomain });

    if (!code || !customerId || !shopDomain) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const normalizedCode = code.toUpperCase().trim();

    // Create service role client (bypasses RLS)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Look up tenant
    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .select('id')
      .eq('shop_domain', shopDomain)
      .eq('is_active', true)
      .single();

    if (tenantError || !tenant) {
      console.error('❌ Tenant not found:', tenantError);
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid shop domain' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find the license code - IMPORTANT: Only get unused codes
    // This ensures we get the active unused code, not expired ones with the same code value
    const { data: licenseCode, error: codeError } = await supabaseAdmin
      .from('license_codes')
      .select('*')
      .eq('code', normalizedCode)
      .eq('tenant_id', tenant.id)
      .eq('status', 'unused') // Only get unused codes
      .maybeSingle();

    if (codeError) {
      console.error('❌ Error fetching license code:', codeError);
      return new Response(
        JSON.stringify({ success: false, error: 'Error checking code' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!licenseCode) {
      // Check if code exists but is not unused (might be expired or active)
      const { data: existingCode } = await supabaseAdmin
        .from('license_codes')
        .select('status')
        .eq('code', normalizedCode)
        .eq('tenant_id', tenant.id)
        .limit(1)
        .maybeSingle();
      
      if (existingCode) {
        if (existingCode.status === 'expired') {
          return new Response(
            JSON.stringify({ success: false, error: 'CODE_EXPIRED', message: 'This code has expired.' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } else if (existingCode.status === 'active') {
          return new Response(
            JSON.stringify({ success: false, error: 'CODE_USED', message: 'This code has already been used.' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
      
      return new Response(
        JSON.stringify({ success: false, error: 'CODE_NOT_FOUND', message: 'Invalid code. Please check and try again.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Double-check that code hasn't been redeemed
    if (licenseCode.redeemed_by) {
      return new Response(
        JSON.stringify({ success: false, error: 'CODE_USED', message: 'This code has already been redeemed by another customer.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if code is expired
    if (licenseCode.expires_at) {
      const expiresAt = new Date(licenseCode.expires_at);
      if (expiresAt < new Date()) {
        return new Response(
          JSON.stringify({ success: false, error: 'CODE_EXPIRED', message: 'This code has expired.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Check if customer already redeemed this code
    const { data: existingLicense } = await supabaseAdmin
      .from('customer_licenses')
      .select('*')
      .eq('customer_id', customerId)
      .eq('license_code_id', licenseCode.id)
      .eq('shop_domain', shopDomain)
      .maybeSingle();

    if (existingLicense) {
      return new Response(
        JSON.stringify({ success: false, error: 'ALREADY_REDEEMED', message: 'You have already redeemed this code.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if all packs from this code are already active for this customer
    const domainsToSearch = getRelatedDomains(shopDomain);
    const { data: customerRecord } = await supabaseAdmin
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

    const { data: existingLicenses } = await supabaseAdmin
      .from('customer_licenses')
      .select('license_code_id, license_codes (packs_unlocked, expires_at)')
      .in('customer_id', customerIdsToSearch)
      .in('shop_domain', domainsToSearch)
      .eq('status', 'active');

    const now = new Date();
    const alreadyActivePackIds = new Set<string>();
    (existingLicenses || []).forEach((cl) => {
      const lc = Array.isArray(cl.license_codes) ? cl.license_codes[0] : cl.license_codes;
      if (!lc) return;
      const expiresAt = lc.expires_at ? new Date(lc.expires_at) : null;
      if (expiresAt && expiresAt < now) return; // skip expired
      (lc.packs_unlocked ?? []).forEach((id: string) => alreadyActivePackIds.add(id));
    });

    const newPackIds = licenseCode.packs_unlocked || [];
    const allAlreadyActive = newPackIds.length > 0 && newPackIds.every((id: string) => alreadyActivePackIds.has(id));
    if (allAlreadyActive) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'PACKS_ALREADY_ACTIVE',
          message: 'You already have access to all packs from this code.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create customer license record
    const { error: licenseError } = await supabaseAdmin
      .from('customer_licenses')
      .insert({
        customer_id: customerId,
        license_code_id: licenseCode.id,
        shop_domain: shopDomain,
        tenant_id: tenant.id,
        status: 'active',
        activated_at: new Date().toISOString(),
      });

    if (licenseError) {
      console.error('❌ Error creating customer license:', licenseError);
      return new Response(
        JSON.stringify({ success: false, error: 'REDEMPTION_ERROR', message: 'Error redeeming code. Please try again.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate expiration time: 30 days from now
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    // Update license code status to active (redeemed) and mark as redeemed
    const { error: updateError } = await supabaseAdmin
      .from('license_codes')
      .update({
        status: 'active',
        redeemed_by: customerId,
        redeemed_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(), // Added expiration
      })
      .eq('id', licenseCode.id);

    if (updateError) {
      console.error('❌ Error updating license code:', updateError);
      // Roll back the customer license if we can't update the code
      await supabaseAdmin
        .from('customer_licenses')
        .delete()
        .eq('customer_id', customerId)
        .eq('license_code_id', licenseCode.id);
      
      return new Response(
        JSON.stringify({ success: false, error: 'REDEMPTION_ERROR', message: 'Error completing redemption. Please try again.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Code redeemed successfully');

    // Fetch pack names for response
    const packIds = licenseCode.packs_unlocked || [];
    const packNamesMap: Record<string, string> = {};
    if (packIds.length > 0) {
      const { data: packs } = await supabaseAdmin
        .from('packs')
        .select('id, name')
        .in('id', packIds);
      (packs || []).forEach((p) => {
        packNamesMap[p.id] = p.name ?? p.id;
      });
    }
    const packNames = packIds.map((id: string) => packNamesMap[id] ?? id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Code redeemed! Unlocked packs: ${packNames.join(', ')}`,
        packsUnlocked: packNames,
        packsUnlockedIds: packIds
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'UNEXPECTED_ERROR', message: 'An unexpected error occurred. Please try again.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
