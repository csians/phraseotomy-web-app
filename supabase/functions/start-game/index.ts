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
    const { sessionId, selectedAudioId } = await req.json();

    console.log("Starting game:", { sessionId, selectedAudioId });

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

    // Get session including theme
    const { data: sessionData, error: sessionError } = await supabase
      .from("game_sessions")
      .select("selected_theme_id")
      .eq("id", sessionId)
      .single();

    if (sessionError || !sessionData?.selected_theme_id) {
      return new Response(
        JSON.stringify({ error: "No theme selected for this game" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get theme name for whisp generation
    const { data: theme, error: themeError } = await supabase
      .from("themes")
      .select("name")
      .eq("id", sessionData.selected_theme_id)
      .single();

    if (themeError || !theme) {
      return new Response(
        JSON.stringify({ error: "Theme not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get all players to determine total rounds and first storyteller
    const { data: allPlayers, error: playerError } = await supabase
      .from("game_players")
      .select("player_id")
      .eq("session_id", sessionId)
      .order("turn_order", { ascending: true });

    if (playerError || !allPlayers || allPlayers.length === 0) {
      return new Response(
        JSON.stringify({ error: "No players found in session" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const firstPlayer = allPlayers[0];
    const totalRounds = allPlayers.length;

    // Generate whisp for first turn using AI
    console.log("Generating whisp for theme:", theme.name);
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    let firstWhisp = "Mystery"; // fallback
    
    if (LOVABLE_API_KEY) {
      try {
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

IMPORTANT: Respond with ONLY the single word, nothing else. No punctuation, no explanation.`
              },
              {
                role: "user",
                content: `Generate a creative word related to the theme "${theme.name}" for a storytelling game.`
              }
            ],
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          firstWhisp = aiData.choices?.[0]?.message?.content?.trim() || "Mystery";
          console.log("Generated whisp:", firstWhisp);
        } else {
          console.error("AI API error:", await aiResponse.text());
        }
      } catch (aiError) {
        console.error("Error generating whisp:", aiError);
      }
    }

    // Update game session to start the game
    const updateData: any = {
      status: "active",
      started_at: new Date().toISOString(),
      current_storyteller_id: firstPlayer.player_id,
      current_round: 1,
      total_rounds: totalRounds,
    };

    // Only update selected_audio_id if provided
    if (selectedAudioId) {
      updateData.selected_audio_id = selectedAudioId;
    }

    const { data, error } = await supabase
      .from("game_sessions")
      .update(updateData)
      .eq("id", sessionId)
      .select()
      .single();

    if (error) {
      console.error("Error starting game:", error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Game started successfully:", data);

    // Create all turns for all rounds upfront, with whisp for first turn
    const turnsToCreate = allPlayers.map((player, index) => ({
      session_id: sessionId,
      round_number: index + 1,
      storyteller_id: player.player_id,
      theme_id: sessionData.selected_theme_id,
      whisp: index === 0 ? firstWhisp : null, // Only first turn gets whisp now
    }));

    const { data: createdTurns, error: turnsError } = await supabase
      .from("game_turns")
      .insert(turnsToCreate)
      .select();

    if (turnsError) {
      console.error("Error creating turns:", turnsError);
    } else {
      console.log(`Created ${createdTurns?.length} turns for ${totalRounds} rounds`);
    }

    const turn = createdTurns?.[0] || null;

    return new Response(
      JSON.stringify({ session: data, turn }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in start-game function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
