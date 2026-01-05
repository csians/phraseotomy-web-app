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

    // Get session with current state
    const { data: session, error: sessionError } = await supabase
      .from("game_sessions")
      .select("*")
      .eq("id", sessionId)
      .single();

    if (sessionError || !session) {
      return new Response(
        JSON.stringify({ error: "Session not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get all players with scores
    const { data: players, error: playersError } = await supabase
      .from("game_players")
      .select("*")
      .eq("session_id", sessionId)
      .order("turn_order");

    if (playersError) {
      console.error("Error fetching players:", playersError);
    }

    // Get packs_used from session (the pack selected when game was created)
    const packsUsed = session.packs_used || [];
    console.log("Session packs_used:", packsUsed);

    // Get all themes with pack info
    const { data: themes, error: themesError } = await supabase
      .from("themes")
      .select("*, pack:packs(id, name)");

    if (themesError) {
      console.error("Error fetching themes:", themesError);
    }

    // Get theme_packs junction table to find themes linked to packs_used
    const { data: themePacks, error: themePacksError } = await supabase
      .from("theme_packs")
      .select("theme_id, pack_id")
      .in("pack_id", packsUsed);

    if (themePacksError) {
      console.error("Error fetching theme_packs:", themePacksError);
    }

    // Create a set of theme IDs that are linked to packs_used
    const themeIdsInPacksUsed = new Set(
      (themePacks || []).map(tp => tp.theme_id)
    );

    // Filter themes: show core themes OR themes linked to packs_used
    const availableThemes = (themes || []).filter(theme => {
      // Always include core themes
      if (theme.is_core) return true;
      
      // Include themes directly linked to packs_used via pack_id
      if (theme.pack_id && packsUsed.includes(theme.pack_id)) return true;
      
      // Include themes linked via theme_packs junction table
      if (themeIdsInPacksUsed.has(theme.id)) return true;
      
      return false;
    });

    console.log(`Filtered ${availableThemes.length} themes from ${themes?.length || 0} total themes based on packs_used:`, packsUsed);

    // Process themes to add unlock status (all filtered themes are unlocked for this game)
    const processedThemes = availableThemes.map(theme => ({
      ...theme,
      isCore: theme.is_core,
      isUnlocked: true, // All filtered themes are available for this game
      packName: theme.pack?.name || null,
    }));

    // Get current turn if exists - get the LATEST one for this round/storyteller
    console.log("Fetching turn for session:", sessionId, "round:", session.current_round, "storyteller:", session.current_storyteller_id);
    
    const { data: turns, error: turnError } = await supabase
      .from("game_turns")
      .select(`
        *,
        theme:themes(*)
      `)
      .eq("session_id", sessionId)
      .eq("round_number", session.current_round)
      .eq("storyteller_id", session.current_storyteller_id)
      .order("created_at", { ascending: false })
      .limit(1);

    if (turnError) {
      console.error("Error fetching turn:", turnError);
    }
    
    // Get the latest turn (first in descending order)
    let currentTurn = turns && turns.length > 0 ? turns[0] : null;
    
    console.log("Current turn found:", currentTurn ? currentTurn.id : "null", "turn_mode:", currentTurn?.turn_mode);

    // SECURITY: Encrypt whisp for non-storyteller players so it's not readable in inspect
    // Only storyteller should see the real whisp value
    if (currentTurn && currentTurn.whisp) {
      const isStoryteller = playerId === currentTurn.storyteller_id;
      
      if (!isStoryteller) {
        // For non-storytellers: encrypt/obfuscate the whisp
        // Use base64 encoding to make it not immediately readable
        const encoded = btoa(currentTurn.whisp);
        currentTurn = { ...currentTurn, whisp: `_ENC_${encoded}` };
      }
      // For storyteller: keep whisp as-is (no encryption needed)
    }

    // If there's a current turn with selected_icon_ids, get the icon details
    let selectedIcons: any[] = [];
    if (currentTurn?.selected_icon_ids && currentTurn.selected_icon_ids.length > 0) {
      const { data: elements, error: elementsError } = await supabase
        .from("elements")
        .select("id, name, icon, image_url, color, theme_id")
        .in("id", currentTurn.selected_icon_ids);

      if (!elementsError && elements) {
        // Get core theme IDs to determine isFromCore
        const { data: coreThemes } = await supabase
          .from("themes")
          .select("id")
          .eq("is_core", true);

        const coreThemeIds = new Set((coreThemes || []).map(t => t.id));

        // Create a map for quick lookup
        const elementMap = new Map(elements.map(e => [e.id, e]));
        
        // Preserve the order from selected_icon_ids array (which is the reordered order)
        selectedIcons = currentTurn.selected_icon_ids.map((id: string) => {
          const element = elementMap.get(id);
          if (!element) return null;
          return {
            id: element.id,
            name: element.name,
            icon: element.icon,
            image_url: element.image_url,
            color: element.color,
            isFromCore: element.theme_id !== currentTurn.theme_id,
          };
        }).filter(Boolean);
      }
    }

    // Get all elements for the selected theme (for guessing)
    let themeElements = null;
    if (currentTurn?.theme_id) {
      const { data: elements, error: elementsError } = await supabase
        .from("elements")
        .select("*")
        .eq("theme_id", currentTurn.theme_id);

      if (!elementsError) {
        themeElements = elements;
      }
    }

    return new Response(
      JSON.stringify({
        session,
        players: players || [],
        themes: processedThemes,
        currentTurn,
        selectedIcons,
        themeElements,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in get-game-state:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
