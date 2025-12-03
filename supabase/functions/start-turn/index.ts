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
    const { sessionId, turnId } = await req.json();

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

    // Get session details including the pre-selected theme
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

    if (!session.selected_theme_id) {
      return new Response(
        JSON.stringify({ error: "No theme selected for this session" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the theme name for whisp generation
    const { data: theme, error: themeError } = await supabase
      .from("themes")
      .select("id, name")
      .eq("id", session.selected_theme_id)
      .single();

    if (themeError || !theme) {
      return new Response(
        JSON.stringify({ error: "Theme not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate AI whisp based on theme
    console.log("Generating whisp for theme:", theme.name);
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a creative word generator for a storytelling party game. Generate a single word related to the theme "${theme.name}" that players can create stories about. The word should be:
- A common, family-friendly word (noun, verb, or adjective)
- Related to the theme but not too obvious
- Easy to describe through storytelling
- Suitable for all ages
- Examples could include: objects, emotions, actions, places, animals, foods, etc.

IMPORTANT: Respond with ONLY the single word, nothing else. No punctuation, no explanation.`
          },
          {
            role: "user",
            content: `Generate a creative word related to the theme "${theme.name}" for a storytelling game.`
          }
        ],
      }),
    });

    if (!aiResponse.ok) {
      console.error("AI API error:", await aiResponse.text());
      return new Response(
        JSON.stringify({ error: "Failed to generate whisp" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    const generatedWhisp = aiData.choices?.[0]?.message?.content?.trim() || "Mystery";
    console.log("Generated whisp:", generatedWhisp);

    // Check if turn exists for this round, if not create it
    let turn;
    if (turnId) {
      // Update existing turn with whisp
      const { data: updatedTurn, error: updateError } = await supabase
        .from("game_turns")
        .update({ 
          whisp: generatedWhisp,
          theme_id: session.selected_theme_id,
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
      // Create new turn record with whisp
      const { data: newTurn, error: turnError } = await supabase
        .from("game_turns")
        .insert({
          session_id: sessionId,
          round_number: session.current_round,
          storyteller_id: session.current_storyteller_id,
          theme_id: session.selected_theme_id,
          whisp: generatedWhisp,
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

    return new Response(
      JSON.stringify({ 
        turn,
        whisp: generatedWhisp,
        theme: theme,
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
