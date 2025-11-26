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

    // Get the first player to be the storyteller
    const { data: firstPlayer, error: playerError } = await supabase
      .from("game_players")
      .select("player_id")
      .eq("session_id", sessionId)
      .order("turn_order", { ascending: true })
      .limit(1)
      .single();

    if (playerError || !firstPlayer) {
      return new Response(
        JSON.stringify({ error: "No players found in session" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update game session to start the game
    const updateData: any = {
      status: "active",
      started_at: new Date().toISOString(),
      current_storyteller_id: firstPlayer.player_id,
      current_round: 1,
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

    // Check if turn already exists (from lobby setup)
    const { data: existingTurn, error: checkError } = await supabase
      .from("game_turns")
      .select("*")
      .eq("session_id", sessionId)
      .eq("round_number", 1)
      .maybeSingle();

    let turn = existingTurn;

    // Only create turn if it doesn't exist
    if (!existingTurn && !checkError) {
      const { data: newTurn, error: turnError } = await supabase
        .from("game_turns")
        .insert({
          session_id: sessionId,
          round_number: 1,
          storyteller_id: firstPlayer.player_id,
        })
        .select()
        .single();

      if (turnError) {
        console.error("Error creating first turn:", turnError);
      } else {
        console.log("First turn created:", newTurn);
        turn = newTurn;
      }
    } else if (existingTurn) {
      console.log("Turn already exists, using existing turn:", existingTurn);
    }

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
