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
    const { sessionId } = await req.json();

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

    // Get all themes
    const { data: themes, error: themesError } = await supabase
      .from("themes")
      .select("*");

    if (themesError) {
      console.error("Error fetching themes:", themesError);
    }

    // Get current turn if exists
    const { data: currentTurn, error: turnError } = await supabase
      .from("game_turns")
      .select(`
        *,
        theme:themes(*)
      `)
      .eq("session_id", sessionId)
      .eq("round_number", session.current_round)
      .maybeSingle();

    if (turnError) {
      console.error("Error fetching turn:", turnError);
    }

    // If there's a current turn with selected elements, get the element details
    let selectedElements = null;
    if (currentTurn?.selected_elements) {
      const { data: elements, error: elementsError } = await supabase
        .from("elements")
        .select("*")
        .in("id", currentTurn.selected_elements);

      if (!elementsError) {
        selectedElements = elements;
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
        themes: themes || [],
        currentTurn,
        selectedElements,
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
