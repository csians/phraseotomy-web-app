import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Fisher-Yates shuffle
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sessionId, turnId, selectedThemeId, turnMode } = await req.json();

    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: "Missing sessionId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Default to 'audio' mode if not specified
    const mode = turnMode || 'audio';
    console.log("Turn mode:", mode);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get session details
    const { data: session, error: sessionError } = await supabase
      .from("game_sessions")
      .select("current_round, current_storyteller_id, selected_theme_id")
      .eq("id", sessionId)
      .single();

    if (sessionError || !session) {
      return new Response(
        JSON.stringify({ error: "Session not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use provided theme or fallback to session theme
    const themeId = selectedThemeId || session.selected_theme_id;
    
    if (!themeId) {
      return new Response(
        JSON.stringify({ error: "No theme selected for this session" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the theme details
    const { data: theme, error: themeError } = await supabase
      .from("themes")
      .select("id, name, is_core")
      .eq("id", themeId)
      .single();

    if (themeError || !theme) {
      return new Response(
        JSON.stringify({ error: "Theme not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get elements from the selected theme (for the 3 theme icons)
    const { data: themeElements, error: themeElementsError } = await supabase
      .from("elements")
      .select("id, name, icon")
      .eq("theme_id", themeId);

    if (themeElementsError) {
      console.error("Error fetching theme elements:", themeElementsError);
    }

    // Get core elements (from all is_core=true themes) for the 2 core icons
    const { data: coreThemes, error: coreThemesError } = await supabase
      .from("themes")
      .select("id")
      .eq("is_core", true);

    if (coreThemesError) {
      console.error("Error fetching core themes:", coreThemesError);
    }

    let coreElements: any[] = [];
    if (coreThemes && coreThemes.length > 0) {
      const coreThemeIds = coreThemes.map(t => t.id);
      const { data: elements, error: elementsError } = await supabase
        .from("elements")
        .select("id, name, icon, theme_id")
        .in("theme_id", coreThemeIds);

      if (!elementsError && elements) {
        // Exclude elements from the currently selected theme to avoid duplicates
        coreElements = elements.filter(e => e.theme_id !== themeId);
      }
    }

    // Select 3 random elements from theme and 2 from core set
    const selectedThemeElements = shuffleArray(themeElements || []).slice(0, 3);
    const selectedCoreElements = shuffleArray(coreElements).slice(0, 2);

    // Combine and get the IDs in order (theme first, then core)
    const selectedIconIds = [
      ...selectedThemeElements.map(e => e.id),
      ...selectedCoreElements.map(e => e.id),
    ];

    // Initial order: 0, 1, 2, 3, 4
    const iconOrder = [0, 1, 2, 3, 4];

    console.log("Selected icons:", selectedIconIds);
    console.log("Theme elements:", selectedThemeElements.map(e => e.name));
    console.log("Core elements:", selectedCoreElements.map(e => e.name));

    // Pick a random element from the theme as the whisp
    console.log("Selecting whisp from theme elements:", theme.name);
    
    // Get all elements for this theme to pick a random one as whisp
    const { data: allThemeElements, error: allElementsError } = await supabase
      .from("elements")
      .select("id, name")
      .eq("theme_id", themeId);

    if (allElementsError || !allThemeElements || allThemeElements.length === 0) {
      console.error("No elements found for theme:", themeId);
      return new Response(
        JSON.stringify({ error: "No elements found for this theme" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Pick a random element as the whisp
    const randomIndex = Math.floor(Math.random() * allThemeElements.length);
    const whispElement = allThemeElements[randomIndex];
    const generatedWhisp = whispElement.name;
    console.log("Selected whisp from database:", generatedWhisp);

    // Check if turn exists for this round, if not create it
    let turn;
    if (turnId) {
      // Update existing turn with whisp, selected icons, and turn mode
      const { data: updatedTurn, error: updateError } = await supabase
        .from("game_turns")
        .update({ 
          whisp: generatedWhisp,
          theme_id: themeId,
          selected_icon_ids: selectedIconIds,
          icon_order: iconOrder,
          turn_mode: mode,
        })
        .eq("id", turnId)
        .select()
        .single();

      if (updateError) {
        console.error("Error updating turn:", updateError);
        return new Response(
          JSON.stringify({ error: updateError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      turn = updatedTurn;
    } else {
      // Create new turn record with whisp, selected icons, and turn mode
      const { data: newTurn, error: turnError } = await supabase
        .from("game_turns")
        .insert({
          session_id: sessionId,
          round_number: session.current_round,
          storyteller_id: session.current_storyteller_id,
          theme_id: themeId,
          whisp: generatedWhisp,
          selected_icon_ids: selectedIconIds,
          icon_order: iconOrder,
          turn_mode: mode,
        })
        .select()
        .single();

      if (turnError) {
        console.error("Error creating turn:", turnError);
        return new Response(
          JSON.stringify({ error: turnError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      turn = newTurn;
    }

    // If a new theme was selected, update the session
    if (selectedThemeId && selectedThemeId !== session.selected_theme_id) {
      await supabase
        .from("game_sessions")
        .update({ selected_theme_id: selectedThemeId })
        .eq("id", sessionId);
    }

    // Prepare icon data for response
    const selectedIcons = [
      ...selectedThemeElements.map(e => ({ ...e, isFromCore: false })),
      ...selectedCoreElements.map(e => ({ ...e, isFromCore: true })),
    ];

    return new Response(
      JSON.stringify({ 
        turn,
        whisp: generatedWhisp,
        theme: theme,
        selectedIcons,
        selectedIconIds,
        iconOrder,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in start-turn:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
