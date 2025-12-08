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

    // Get theme name for logging
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

    // Get all elements for this theme to use as whisps
    const { data: themeElements, error: elementsError } = await supabase
      .from("elements")
      .select("id, name")
      .eq("theme_id", sessionData.selected_theme_id);

    if (elementsError || !themeElements || themeElements.length === 0) {
      console.error("No elements found for theme:", sessionData.selected_theme_id);
      return new Response(
        JSON.stringify({ error: "No elements found for this theme. Please add elements first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${themeElements.length} elements for theme "${theme.name}"`);

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

    // Generate whisps for ALL turns by randomly selecting elements from the theme
    console.log("Selecting whisps from theme elements:", theme.name);
    
    const whisps: string[] = [];
    const usedIndices = new Set<number>();
    
    // Select a unique random element for each round
    for (let i = 0; i < totalRounds; i++) {
      let randomIndex: number;
      
      // Try to get a unique element (if we have enough elements)
      if (usedIndices.size < themeElements.length) {
        do {
          randomIndex = Math.floor(Math.random() * themeElements.length);
        } while (usedIndices.has(randomIndex));
        usedIndices.add(randomIndex);
      } else {
        // If we've used all elements, allow duplicates
        randomIndex = Math.floor(Math.random() * themeElements.length);
      }
      
      const whisp = themeElements[randomIndex].name;
      whisps.push(whisp);
      console.log(`Selected whisp for round ${i + 1}:`, whisp);
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

    const { data: updatedSession, error: updateError } = await supabase
      .from("game_sessions")
      .update(updateData)
      .eq("id", sessionId)
      .select()
      .single();

    if (updateError) {
      console.error("Error starting game:", updateError);
      return new Response(
        JSON.stringify({ error: updateError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Game started successfully:", updatedSession);

    // Create all turns for all rounds upfront, each with their own whisp
    const turnsToCreate = allPlayers.map((player, index) => ({
      session_id: sessionId,
      round_number: index + 1,
      storyteller_id: player.player_id,
      theme_id: sessionData.selected_theme_id,
      whisp: whisps[index] || "Mystery",
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
      JSON.stringify({ session: updatedSession, turn }),
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
