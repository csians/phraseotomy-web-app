import { createClient } from "https://esm.sh/@supabase/supabase-js@2.83.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      lobbyCode, 
      hostCustomerId, 
      hostCustomerName, 
      shopDomain, 
      tenantId, 
      packsUsed, 
      gameName, 
      themeId,
      gameMode,
      timerPreset,
      storyTimeSeconds,
      guessTimeSeconds,
    } = await req.json();

    // Validate required fields
    if (!lobbyCode || !hostCustomerId || !shopDomain || !tenantId || !packsUsed) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing required fields",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log("Creating game session:", {
      lobbyCode,
      hostCustomerId,
      shopDomain,
      tenantId,
      packsCount: packsUsed.length,
    });

    // Create Supabase client with service role (bypasses RLS)
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Note: License verification removed to allow all authenticated users to create game sessions
    // If you need to re-enable license checks in the future, uncomment the code below:
    /*
    const { data: licenses, error: licenseError } = await supabaseAdmin
      .from("customer_licenses")
      .select("*")
      .eq("customer_id", hostCustomerId)
      .eq("shop_domain", shopDomain)
      .eq("tenant_id", tenantId)
      .eq("status", "active");

    if (licenseError) {
      console.error("Error checking licenses:", licenseError);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Error verifying customer licenses",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!licenses || licenses.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "No active licenses found for customer",
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    */

    // Create game session
    const { data: session, error: sessionError } = await supabaseAdmin
      .from("game_sessions")
      .insert({
        lobby_code: lobbyCode,
        host_customer_id: hostCustomerId,
        host_customer_name: hostCustomerName || null,
        shop_domain: shopDomain,
        tenant_id: tenantId,
        packs_used: packsUsed,
        status: "waiting",
        game_name: gameName || null,
        selected_theme_id: themeId || null,
        game_mode: gameMode || "live",
        timer_preset: timerPreset || null,
        story_time_seconds: storyTimeSeconds || 600,
        guess_time_seconds: guessTimeSeconds || 420,
      })
      .select()
      .single();

    if (sessionError) {
      console.error("Error creating game session:", sessionError);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to create game session",
          details: sessionError.message,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log("✅ Game session created successfully:", session.id);

    // Add the host as the first player in game_players
    const { error: playerError } = await supabaseAdmin.from("game_players").insert({
      session_id: session.id,
      player_id: hostCustomerId,
      name: hostCustomerName || "Host",
      turn_order: 1,
    });

    if (playerError) {
      console.error("Error adding host to game_players:", playerError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        session,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unexpected error occurred",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
