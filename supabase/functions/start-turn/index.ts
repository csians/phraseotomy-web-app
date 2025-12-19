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
    const { sessionId, turnId, selectedThemeId } = await req.json();

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

    // Get ALL visual elements from the selected theme (storyteller will choose 3)
    const { data: themeElements, error: themeElementsError } = await supabase
      .from("elements")
      .select("id, name, icon, image_url, color")
      .eq("theme_id", themeId)
      .eq("is_whisp", false);

    if (themeElementsError) {
      console.error("Error fetching theme elements:", themeElementsError);
    }

    // Get core elements (from all is_core=true themes) - we'll pick 2 random ones
    const { data: coreThemes, error: coreThemesError } = await supabase
      .from("themes")
      .select("id")
      .eq("is_core", true);

    if (coreThemesError) {
      console.error("Error fetching core themes:", coreThemesError);
    }

    let allCoreElements: any[] = [];
    if (coreThemes && coreThemes.length > 0) {
      const coreThemeIds = coreThemes.map(t => t.id);
      const { data: elements, error: elementsError } = await supabase
        .from("elements")
        .select("id, name, icon, image_url, color, theme_id")
        .in("theme_id", coreThemeIds)
        .eq("is_whisp", false);

      if (!elementsError && elements) {
        // Exclude elements from the currently selected theme to avoid duplicates
        allCoreElements = elements.filter(e => e.theme_id !== themeId);
      }
    }

    // Randomly select exactly 2 core elements
    const shuffledCoreElements = shuffleArray(allCoreElements);
    const selectedCoreElements = shuffledCoreElements.slice(0, 2);

    console.log("Theme elements available:", themeElements?.length || 0);
    console.log("Core elements selected (random 2):", selectedCoreElements.map(e => e.name));

    // Pick a random whisp element from the theme
    console.log("Selecting whisp from theme elements:", theme.name);
    
    const { data: whispElements, error: whispError } = await supabase
      .from("elements")
      .select("id, name")
      .eq("theme_id", themeId)
      .eq("is_whisp", true);

    if (whispError || !whispElements || whispElements.length === 0) {
      console.error("No whisp elements found for theme:", themeId);
      return new Response(
        JSON.stringify({ error: "No whisp elements found for this theme" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Pick a random whisp element
    const randomIndex = Math.floor(Math.random() * whispElements.length);
    const whispElement = whispElements[randomIndex];
    const generatedWhisp = whispElement.name;
    console.log("Selected whisp from database:", generatedWhisp);

    // Check if turn exists for this round and storyteller
    let turn;
    
    const { data: existingTurns, error: existingError } = await supabase
      .from("game_turns")
      .select("*")
      .eq("session_id", sessionId)
      .eq("round_number", session.current_round)
      .eq("storyteller_id", session.current_storyteller_id)
      .order("created_at", { ascending: false })
      .limit(1);
    
    if (existingError) {
      console.error("Error checking existing turns:", existingError);
    }
    
    const existingTurn = existingTurns && existingTurns.length > 0 ? existingTurns[0] : null;

    // Core element IDs (the 2 random ones that are auto-selected)
    const coreElementIds = selectedCoreElements.map(e => e.id);
    
    if (existingTurn) {
      console.log("Updating existing turn:", existingTurn.id);
      const { data: updatedTurn, error: updateError } = await supabase
        .from("game_turns")
        .update({ 
          whisp: generatedWhisp,
          theme_id: themeId,
          // Store only the core element IDs initially - storyteller will add their 3 selections
          selected_icon_ids: coreElementIds,
          icon_order: [0, 1], // Initial order for the 2 core elements
        })
        .eq("id", existingTurn.id)
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
    } else if (turnId) {
      console.log("Updating specified turn:", turnId);
      const { data: updatedTurn, error: updateError } = await supabase
        .from("game_turns")
        .update({ 
          whisp: generatedWhisp,
          theme_id: themeId,
          selected_icon_ids: coreElementIds,
          icon_order: [0, 1],
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
      console.log("Creating new turn for round:", session.current_round);
      const { data: newTurn, error: turnError } = await supabase
        .from("game_turns")
        .insert({
          session_id: sessionId,
          round_number: session.current_round,
          storyteller_id: session.current_storyteller_id,
          theme_id: themeId,
          whisp: generatedWhisp,
          selected_icon_ids: coreElementIds,
          icon_order: [0, 1],
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

    // Prepare core elements with isFromCore flag
    const coreElementsWithFlag = selectedCoreElements.map(e => ({ 
      id: e.id,
      name: e.name,
      icon: e.icon,
      image_url: e.image_url,
      color: e.color,
      isFromCore: true,
    }));

    return new Response(
      JSON.stringify({ 
        turn,
        whisp: generatedWhisp,
        theme: theme,
        // ALL theme elements for the storyteller to choose 3 from
        themeElements: themeElements || [],
        // The 2 random core elements (auto-selected)
        coreElements: coreElementsWithFlag,
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
