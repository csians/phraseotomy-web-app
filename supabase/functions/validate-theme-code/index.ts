import { createClient } from "https://esm.sh/@supabase/supabase-js@2.83.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

// ---------- THEME CODE HANDLER ----------

async function handleThemeCode(
  supabaseAdmin: any,
  normalizedCode: string,
  customerId: string,
  shopDomain: string,
  tenant: { id: string },
  themeId?: string,
): Promise<Response> {
  if (!themeId) {
    return new Response(
      JSON.stringify({ success: false, error: "Missing themeId for theme code" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // 1) Find theme_code row for this tenant & code
  const { data: codeCheck, error: codeError } = await supabaseAdmin
    .from("theme_codes")
    .select("*")
    .eq("code", normalizedCode)
    .eq("tenant_id", tenant.id)
    // allow both unused and active (adjust if you only use one status)
    .in("status", ["unused", "active"])
    .maybeSingle();

  console.log("🔍 [validate-code] theme_codes basic check:", {
    found: !!codeCheck,
    error: codeError,
    code: codeCheck?.code,
    status: codeCheck?.status,
    tenantMatch: codeCheck?.tenant_id === tenant.id,
  });

  if (codeError || !codeCheck) {
    return new Response(
      JSON.stringify({ success: false, error: "Theme code not found or inactive" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // 2) Get themes from the themes_unlocked column
  const unlockedThemeIds = codeCheck.themes_unlocked || [];

  console.log("🔍 [validate-code] themes_unlocked from code:", {
    unlockedThemeIds,
    hasThemes: unlockedThemeIds.length > 0,
  });

  if (!unlockedThemeIds || unlockedThemeIds.length === 0) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "Theme code is not configured for any themes",
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const normalizedThemeId = themeId.trim().toLowerCase();
  const normalizedUnlockedIds = unlockedThemeIds.map((id) => id.trim().toLowerCase());

  const unlocksRequestedTheme = normalizedUnlockedIds.includes(normalizedThemeId);

  console.log("🔍 [validate-code] theme ID comparison:", {
    requestedThemeId: normalizedThemeId,
    unlockedThemeIds: normalizedUnlockedIds,
    matchFound: unlocksRequestedTheme,
  });

  if (!unlocksRequestedTheme) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "Theme code does not unlock this theme",
        debug: {
          requestedTheme: themeId,
          availableThemes: unlockedThemeIds,
        },
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // 3) Already redeemed checks (for validation only - don't prevent already redeemed codes from being validated)
  const { data: existingRedemption } = await supabaseAdmin
    .from("customer_theme_codes")
    .select("*")
    .eq("customer_id", customerId)
    .eq("theme_code_id", codeCheck.id)
    .maybeSingle();

  if (existingRedemption) {
    return new Response(
      JSON.stringify({
        success: true,
        message: "Theme already unlocked for this customer",
        alreadyUnlocked: true,
        unlockedThemes: ["Theme"],
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // For validation, we don't redeem - we just confirm the code is valid
  console.log("✅ Theme code validated successfully (validate-code)");

  return new Response(
    JSON.stringify({
      success: true,
      message: "Theme code is valid and ready to redeem",
      unlockedThemes: ["Theme"],
      codeId: codeCheck.id,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

// ---------- LICENSE CODE HANDLER ----------

async function handleLicenseCode(
  supabaseAdmin: any,
  normalizedCode: string,
  customerId: string,
  customerEmail: string,
  customerName: string,
  shopDomain: string,
  tenant: { id: string; access_token: string },
): Promise<Response> {
  // 1) Find license_code
  const { data: licenseCode, error: codeError } = await supabaseAdmin
    .from("license_codes")
    .select("*")
    .eq("code", normalizedCode)
    .eq("tenant_id", tenant.id)
    .maybeSingle();

  if (codeError || !licenseCode) {
    console.error("❌ License code not found:", codeError);
    return new Response(
      JSON.stringify({ success: false, error: "License code not found" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // 2) Update Shopify metafield
  const metafieldData = {
    metafield: {
      namespace: "phraseotomy",
      key: "license_codes",
      value: JSON.stringify([normalizedCode]),
      type: "json",
    },
  };

  const shopifyResponse = await fetch(
    `https://${shopDomain}/admin/api/2024-01/customers/${customerId}/metafields.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": tenant.access_token,
      },
      body: JSON.stringify(metafieldData),
    },
  );

  if (!shopifyResponse.ok) {
    const errorText = await shopifyResponse.text();
    console.error("❌ Shopify API error:", errorText);
    return new Response(
      JSON.stringify({
        success: false,
        error: "Failed to update Shopify metafields",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  console.log("✅ Shopify metafield updated");

  // 3) Create customer_licenses if not exists
  const { data: existingLicense } = await supabaseAdmin
    .from("customer_licenses")
    .select("*")
    .eq("customer_id", customerId)
    .eq("license_code_id", licenseCode.id)
    .maybeSingle();

  if (!existingLicense) {
    const { error: licenseError } = await supabaseAdmin
      .from("customer_licenses")
      .insert({
        customer_id: customerId,
        customer_email: customerEmail,
        customer_name: customerName,
        license_code_id: licenseCode.id,
        shop_domain: shopDomain,
        tenant_id: tenant.id,
        status: "active",
        activated_at: new Date().toISOString(),
      });

    if (licenseError) {
      console.error("❌ Error creating customer_licenses:", licenseError);
      // continue: Shopify metafield is already updated
    } else {
      console.log("✅ Customer license created");
    }
  } else {
    console.log("ℹ️ Customer already has this license");
  }

  // 4) Update license_codes row
  const { error: updateError } = await supabaseAdmin
    .from("license_codes")
    .update({
      status: "a", // keep your existing status if that's what DB uses
      redeemed_by: customerId,
      redeemed_at: new Date().toISOString(),
    })
    .eq("id", licenseCode.id);

  if (updateError) {
    console.error("❌ Error updating license_codes:", updateError);
    // non-fatal
  } else {
    console.log("✅ License code marked as redeemed");
  }

  return new Response(
    JSON.stringify({
      success: true,
      message: `Code ${normalizedCode} successfully assigned to customer`,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

// ---------- ENTRYPOINT ----------

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ success: false, error: "Method not allowed" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json();
    const {
      customerId,
      customerEmail,
      customerName,
      code,
      shopDomain,
      themeId,
    } = body;

    // Force codeType to theme for this function
    const codeType = "theme";

    console.log("🎯 validate-code request:", {
      customerId,
      customerEmail,
      code,
      shopDomain,
      codeType,
      themeId,
    });

    if (!customerId || !code || !shopDomain || !themeId) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields (customerId, code, shopDomain, themeId)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const normalizedCode = code.toUpperCase().trim();

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Tenant lookup (adjust is_active to your real column)
    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from("tenants")
      .select("id, access_token")
      .eq("shop_domain", shopDomain)
      .eq("is_active", true)
      .maybeSingle();

    if (tenantError || !tenant) {
      console.error("❌ Tenant not found:", tenantError);
      return new Response(
        JSON.stringify({ success: false, error: "Invalid shop domain" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (codeType === "theme") {
      return await handleThemeCode(
        supabaseAdmin,
        normalizedCode,
        customerId,
        shopDomain,
        tenant,
        themeId,
      );
    } else {
      return await handleLicenseCode(
        supabaseAdmin,
        normalizedCode,
        customerId,
        customerEmail,
        customerName,
        shopDomain,
        tenant,
      );
    }
  } catch (error) {
    console.error("❌ Unexpected error in validate-code:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
