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
    const { sessionId, reason } = await req.json();

    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: "Missing sessionId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`⏰ Skipping turn for session ${sessionId}, reason: ${reason}`);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get current session state
    const { data: sessionData, error: sessionError } = await supabase
      .from("game_sessions")
      .select("id, current_round, total_rounds, current_storyteller_id")
      .eq("id", sessionId)
      .single();

    if (sessionError || !sessionData) {
      console.error("Error fetching session:", sessionError);
      return new Response(
        JSON.stringify({ error: "Session not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark current turn as completed (skipped)
    const { data: currentTurns } = await supabase
      .from("game_turns")
      .select("id")
      .eq("session_id", sessionId)
      .eq("round_number", sessionData.current_round)
      .order("created_at", { ascending: false })
      .limit(1);

    if (currentTurns && currentTurns.length > 0) {
      await supabase
        .from("game_turns")
        .update({ completed_at: new Date().toISOString() })
        .eq("id", currentTurns[0].id);
      console.log(`✅ Marked turn ${currentTurns[0].id} as completed (skipped)`);
    }

    const nextRound = sessionData.current_round + 1;
    let nextRoundInfo = null;
    let gameCompleted = false;

    if (nextRound <= sessionData.total_rounds) {
      // Get next storyteller (player with turn_order = nextRound)
      const { data: allPlayers, error: playersError } = await supabase
        .from("game_players")
        .select("player_id, name, turn_order")
        .eq("session_id", sessionId)
        .order("turn_order", { ascending: true });

      if (playersError || !allPlayers || allPlayers.length === 0) {
        console.error("Error fetching players:", playersError);
        return new Response(
          JSON.stringify({ error: "Failed to get players" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const nextStoryteller = allPlayers.find(p => p.turn_order === nextRound);
      
      if (nextStoryteller) {
        // Create new turn for next round
        // No theme_id - storyteller will select theme at start of their turn
        const { error: newTurnError } = await supabase
          .from("game_turns")
          .insert({
            session_id: sessionId,
            round_number: nextRound,
            storyteller_id: nextStoryteller.player_id,
            theme_id: null, // Storyteller selects theme at start of turn
          });

        if (newTurnError) {
          console.error("Error creating new turn:", newTurnError);
        } else {
          console.log(`✅ Created new turn for round ${nextRound}`);
        }

        // Update session to next round
        const { error: updateError } = await supabase
          .from("game_sessions")
          .update({
            current_round: nextRound,
            current_storyteller_id: nextStoryteller.player_id,
          })
          .eq("id", sessionId);

        if (updateError) {
          console.error("Error advancing round:", updateError);
        } else {
          console.log(`✅ Advanced to round ${nextRound}, storyteller: ${nextStoryteller.player_id}`);
          nextRoundInfo = {
            roundNumber: nextRound,
            newStorytellerId: nextStoryteller.player_id,
            newStorytellerName: nextStoryteller.name,
          };
        }
      }
    } else {
      // Game complete
      const { data: winners } = await supabase
        .from("game_players")
        .select("player_id, name, score")
        .eq("session_id", sessionId)
        .order("score", { ascending: false })
        .limit(1);

      await supabase
        .from("game_sessions")
        .update({ status: "completed", ended_at: new Date().toISOString() })
        .eq("id", sessionId);

      console.log("🎉 Game completed - all rounds finished");
      gameCompleted = true;

      // Schedule cleanup
      fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/cleanup-game-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
        },
        body: JSON.stringify({ sessionId, delaySeconds: 35 })
      }).catch(err => console.error('Failed to schedule cleanup:', err));

      if (winners && winners.length > 0) {
        nextRoundInfo = {
          gameCompleted: true,
          winnerId: winners[0].player_id,
          winnerName: winners[0].name,
          winnerScore: winners[0].score,
        };
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        skipped: true,
        reason,
        next_round: nextRoundInfo,
        game_completed: gameCompleted,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in skip-turn:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
