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
    const { sessionId, roundNumber, playerId, reason } = await req.json();

    if (!sessionId || !roundNumber || !playerId) {
      return new Response(
        JSON.stringify({ error: "Missing sessionId, roundNumber, or playerId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`⏰ Auto-submitting guess for player ${playerId}, session ${sessionId}, reason: ${reason}`);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get turn data
    const { data: turns, error: turnError } = await supabase
      .from("game_turns")
      .select("id, whisp, storyteller_id")
      .eq("session_id", sessionId)
      .eq("round_number", roundNumber)
      .order("created_at", { ascending: false })
      .limit(1);

    if (turnError || !turns || turns.length === 0) {
      console.error("Turn not found:", turnError);
      return new Response(
        JSON.stringify({ error: "Turn not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const turnData = turns[0];
    const storytellerId = turnData.storyteller_id;

    // Check if player already submitted a guess
    const { data: existingGuess } = await supabase
      .from("game_guesses")
      .select("id")
      .eq("turn_id", turnData.id)
      .eq("player_id", playerId)
      .limit(1);

    if (existingGuess && existingGuess.length > 0) {
      console.log(`Player ${playerId} already submitted a guess`);
      return new Response(
        JSON.stringify({ success: true, already_submitted: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert empty/timeout guess (wrong answer)
    const { error: insertError } = await supabase
      .from("game_guesses")
      .insert({
        turn_id: turnData.id,
        player_id: playerId,
        guessed_elements: ["[TIMEOUT]"],
        points_earned: 0,
      });

    if (insertError) {
      console.error("Error inserting timeout guess:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to submit timeout guess" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Award storyteller 1 point for the timeout (same as wrong answer)
    await supabase.rpc("increment_player_score", {
      p_player_id: storytellerId,
      p_points: 1,
    });

    console.log(`✅ Auto-submitted timeout guess for player ${playerId}`);

    // Check if all players have now answered
    const { data: sessionPlayers } = await supabase
      .from("game_players")
      .select("player_id")
      .eq("session_id", sessionId);

    const { data: allGuesses } = await supabase
      .from("game_guesses")
      .select("player_id")
      .eq("turn_id", turnData.id);

    const nonStorytellerPlayers = sessionPlayers?.filter(
      p => p.player_id !== storytellerId
    ) || [];
    
    const uniquePlayerAnswers = new Set(allGuesses?.map(g => g.player_id) || []);
    const allPlayersAnswered = nonStorytellerPlayers.length > 0 && 
                               uniquePlayerAnswers.size >= nonStorytellerPlayers.length;

    let nextRoundInfo = null;
    let gameCompleted = false;

    if (allPlayersAnswered) {
      console.log("✅ All players have answered after timeout - completing turn");

      // Mark turn as completed
      await supabase
        .from("game_turns")
        .update({ completed_at: new Date().toISOString() })
        .eq("id", turnData.id);

      // Get session data for round advancement
      const { data: sessionData } = await supabase
        .from("game_sessions")
        .select("current_round, total_rounds, selected_theme_id")
        .eq("id", sessionId)
        .single();

      if (sessionData) {
        const nextRound = sessionData.current_round + 1;
        
        if (nextRound <= sessionData.total_rounds) {
          const { data: allPlayers } = await supabase
            .from("game_players")
            .select("player_id, name, turn_order")
            .eq("session_id", sessionId)
            .order("turn_order", { ascending: true });

          const nextStoryteller = allPlayers?.find(p => p.turn_order === nextRound);
          
          if (nextStoryteller) {
            await supabase
              .from("game_turns")
              .insert({
                session_id: sessionId,
                round_number: nextRound,
                storyteller_id: nextStoryteller.player_id,
                theme_id: sessionData.selected_theme_id || null,
              });

            await supabase
              .from("game_sessions")
              .update({
                current_round: nextRound,
                current_storyteller_id: nextStoryteller.player_id,
              })
              .eq("id", sessionId);

            console.log(`✅ Advanced to round ${nextRound}`);
            nextRoundInfo = {
              roundNumber: nextRound,
              newStorytellerId: nextStoryteller.player_id,
              newStorytellerName: nextStoryteller.name,
            };
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

          gameCompleted = true;

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
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        timeout: true,
        all_players_answered: allPlayersAnswered,
        next_round: nextRoundInfo,
        game_completed: gameCompleted,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in auto-submit-guess:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
