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

    // Create all turns for all rounds upfront
    const turnsToCreate = allPlayers.map((player, index) => ({
      session_id: sessionId,
      round_number: index + 1,
      storyteller_id: player.player_id,
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
