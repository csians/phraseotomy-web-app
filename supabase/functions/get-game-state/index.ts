import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sessionId, playerId } = await req.json();

    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: "Missing sessionId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // ================= SESSION =================
    const { data: session } = await supabase
      .from("game_sessions")
      .select("*")
      .eq("id", sessionId)
      .single();

    if (!session) {
      return new Response(
        JSON.stringify({ error: "Session not found" }),
        { status: 404, headers: corsHeaders }
      );
    }

    // ================= PLAYERS =================
    const { data: players } = await supabase
      .from("game_players")
      .select("*")
      .eq("session_id", sessionId)
      .order("turn_order");

    // ================= THEMES =================
    const { data: themes } = await supabase
      .from("themes")
      .select("*, pack:packs(id, name)");

    const baseThemeNames = ["At Home", "Lifestyle", "At Work", "Travel"];
    const baseThemeIds = new Set(
      (themes || [])
        .filter(t => baseThemeNames.includes(t.name))
        .map(t => t.id)
    );

    // ================= 🎯 FINAL THEME LOGIC =================

    let allowedThemeIds = new Set<string>();

    if (Array.isArray(session.themes_used) && session.themes_used.length > 0) {
      // ✅ BEST CASE
      allowedThemeIds = new Set(session.themes_used);
      console.log("✅ Using session themes:", session.themes_used);
    } else {
      console.log("⚠️ themes_used missing → using HOST themes");

      // 1️⃣ HOST THEME CODES
      const { data: hostCodes } = await supabase
        .from("theme_codes")
        .select("themes_unlocked")
        .eq("status", "active")
        .or(
          `redeemed_by.eq.${session.host_customer_id},redeemed_by.eq.Customer_${session.host_customer_id}`
        );

      hostCodes?.forEach(code => {
        (code.themes_unlocked || []).forEach((id: string) => {
          allowedThemeIds.add(id);
        });
      });

      // 2️⃣ HOST LICENSES (🔥 IMPORTANT FIX)
      const { data: hostLicenses } = await supabase
        .from("customer_licenses")
        .select(`
          license_code:license_codes(packs_unlocked)
        `)
        .eq("customer_id", session.host_customer_id)
        .eq("status", "active");

      const hostPackNames = new Set<string>();

      hostLicenses?.forEach((license: any) => {
        (license.license_code?.packs_unlocked || []).forEach((pack: string) => {
          hostPackNames.add(pack.toLowerCase());
        });
      });

      // 3️⃣ MAP PACKS → THEMES
      (themes || []).forEach(theme => {
        if (
          theme.pack?.name &&
          hostPackNames.has(theme.pack.name.toLowerCase())
        ) {
          allowedThemeIds.add(theme.id);
        }
      });

      // 4️⃣ ALWAYS ADD BASE THEMES
      baseThemeIds.forEach(id => allowedThemeIds.add(id));
    }

    // ================= FINAL THEMES =================
    const processedThemes = (themes || []).map(theme => ({
      ...theme,
      isCore: theme.is_core,
      isUnlocked: allowedThemeIds.has(theme.id),
      packName: theme.pack?.name || null,
    }));

    console.log("🎯 Final allowed themes:", Array.from(allowedThemeIds));

    // ================= CURRENT TURN =================
    const { data: turns } = await supabase
      .from("game_turns")
      .select(`*, theme:themes(*)`)
      .eq("session_id", sessionId)
      .eq("round_number", session.current_round)
      .eq("storyteller_id", session.current_storyteller_id)
      .order("created_at", { ascending: false })
      .limit(1);

    let currentTurn = turns?.[0] || null;

    if (currentTurn?.whisp && playerId !== currentTurn.storyteller_id) {
      currentTurn.whisp = `_ENC_${btoa(currentTurn.whisp)}`;
    }

    // ================= ICONS =================
    let selectedIcons: any[] = [];

    if (currentTurn?.selected_icon_ids?.length > 0) {
      const { data: elements } = await supabase
        .from("elements")
        .select("id, name, icon, image_url, color, theme_id")
        .in("id", currentTurn.selected_icon_ids);

      const map = new Map(elements?.map(e => [e.id, e]));

      selectedIcons = currentTurn.selected_icon_ids
        .map((id: string) => {
          const el = map.get(id);
          if (!el) return null;
          return {
            id: el.id,
            name: el.name,
            icon: el.icon,
            image_url: el.image_url,
            color: el.color,
            isFromCore: el.theme_id !== currentTurn.theme_id,
          };
        })
        .filter(Boolean);
    }

    // ================= THEME ELEMENTS =================
    let themeElements = null;

    if (currentTurn?.theme_id) {
      const { data: elements } = await supabase
        .from("elements")
        .select("*")
        .eq("theme_id", currentTurn.theme_id);

      themeElements = elements;
    }

    // ================= RESPONSE =================
    return new Response(
      JSON.stringify({
        session,
        players: players || [],
        themes: processedThemes,
        currentTurn,
        selectedIcons,
        themeElements,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("ERROR:", error);

    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});