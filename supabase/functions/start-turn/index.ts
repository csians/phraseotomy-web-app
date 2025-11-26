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
    const { sessionId, themeId } = await req.json();

    if (!sessionId || !themeId) {
      return new Response(
        JSON.stringify({ error: "Missing sessionId or themeId" }),
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
      .select("current_round, current_storyteller_id")
      .eq("id", sessionId)
      .single();

    if (sessionError || !session) {
      return new Response(
        JSON.stringify({ error: "Session not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get random 5 elements from the theme
    const { data: allElements, error: elementsError } = await supabase
      .from("elements")
      .select("id")
      .eq("theme_id", themeId);

    if (elementsError || !allElements || allElements.length < 5) {
      return new Response(
        JSON.stringify({ error: "Not enough elements in theme" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Randomly select 5 elements
    const shuffled = allElements.sort(() => 0.5 - Math.random());
    const selectedElements = shuffled.slice(0, 5).map((e) => e.id);

    // Create turn record
    const { data: turn, error: turnError } = await supabase
      .from("game_turns")
      .insert({
        session_id: sessionId,
        round_number: session.current_round,
        storyteller_id: session.current_storyteller_id,
        theme_id: themeId,
        selected_elements: selectedElements,
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

    // Update session with selected theme (using service role to bypass RLS)
    console.log("Updating session", sessionId, "with theme", themeId);
    const { data: updatedSession, error: updateError } = await supabase
      .from("game_sessions")
      .update({ selected_theme_id: themeId })
      .eq("id", sessionId)
      .select("id, selected_theme_id")
      .single();

    if (updateError) {
      console.error("Error updating session:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to update session: " + updateError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Session updated successfully:", updatedSession);

    return new Response(
      JSON.stringify({ 
        turn,
        session: updatedSession,
        selectedElements 
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
