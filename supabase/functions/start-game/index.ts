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

    // Get session (theme is not required at game start - storyteller selects per turn)
    const { data: sessionData, error: sessionError } = await supabase
      .from("game_sessions")
      .select("id")
      .eq("id", sessionId)
      .single();

    if (sessionError || !sessionData) {
      return new Response(
        JSON.stringify({ error: "Session not found" }),
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

    // Create ONLY the first turn (no theme - storyteller will select at start of their turn)
    // Other turns will be created as rounds progress
    const { data: createdTurn, error: turnError } = await supabase
      .from("game_turns")
      .insert({
        session_id: sessionId,
        round_number: 1,
        storyteller_id: firstPlayer.player_id,
        theme_id: null, // Storyteller will select theme at start of turn
        turn_mode: null, // Storyteller will choose mode
        // whisp will be generated in start-turn after theme and mode selection
      })
      .select()
      .single();

    if (turnError) {
      console.error("Error creating first turn:", turnError);
    } else {
      console.log(`Created first turn for round 1, storyteller: ${firstPlayer.player_id}`);
    }

    const turn = createdTurn || null;

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