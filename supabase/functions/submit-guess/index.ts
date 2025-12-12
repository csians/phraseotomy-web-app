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
    const { sessionId, roundNumber, playerId, guess } = await req.json();

    if (!sessionId || !roundNumber || !playerId || !guess) {
      return new Response(
        JSON.stringify({ error: "Missing sessionId, roundNumber, playerId, or guess" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get the turn data including whisp using sessionId and roundNumber
    // Use order + limit to handle multiple turns for same round (get latest)
    const { data: turns, error: turnError } = await supabase
      .from("game_turns")
      .select("id, whisp, session_id, completed_at, storyteller_id")
      .eq("session_id", sessionId)
      .eq("round_number", roundNumber)
      .order("created_at", { ascending: false })
      .limit(1);

    if (turnError) {
      console.error("Error fetching turn:", turnError);
      return new Response(
        JSON.stringify({ error: "Turn not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const turnData = turns && turns.length > 0 ? turns[0] : null;

    if (!turnData) {
      console.error("No turn found for session:", sessionId, "round:", roundNumber);
      return new Response(
        JSON.stringify({ error: "Turn not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    console.log("Found turn:", turnData.id, "whisp:", turnData.whisp);

    // Check if turn is already completed (story not yet submitted)
    // Note: completed_at is set when the storyteller submits the audio
    // We allow guesses after the storyteller has submitted

    // Check if player has already answered this turn
    const { data: playerGuesses, error: playerGuessError } = await supabase
      .from("game_guesses")
      .select("id")
      .eq("turn_id", turnData.id)
      .eq("player_id", playerId);

    if (playerGuessError) {
      console.error("Error checking player guesses:", playerGuessError);
    }

    // If player already answered, don't allow another guess
    if (playerGuesses && playerGuesses.length > 0) {
      return new Response(
        JSON.stringify({ error: "You have already answered this round" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if whisp exists
    if (!turnData.whisp) {
      return new Response(
        JSON.stringify({ error: "Whisp not set for this turn", correct: false }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Normalize the guess and whisp for comparison
    const normalizedGuess = guess.trim().toLowerCase();
    const normalizedWhisp = turnData.whisp.trim().toLowerCase();

    const isCorrect = normalizedGuess === normalizedWhisp;
    console.log(`Guess: "${normalizedGuess}" vs Whisp: "${normalizedWhisp}" = ${isCorrect}`);
    const pointsEarned = isCorrect ? 10 : 0;

    // Use storyteller_id from turnData (already fetched above)
    const storytellerId = turnData.storyteller_id;

    // Insert the guess
    const { error: insertError } = await supabase
      .from("game_guesses")
      .insert({
        turn_id: turnData.id,
        player_id: playerId,
        guessed_elements: [guess],
        points_earned: pointsEarned,
      });

    if (insertError) {
      console.error("Error inserting guess:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to submit guess" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update scores based on correct/wrong answer
    if (isCorrect) {
      // If correct, award player 10 points (game score)
      const { error: scoreError } = await supabase.rpc("increment_player_score", {
        p_player_id: playerId,
        p_points: 10,
      });

      if (scoreError) {
        console.error("Error updating player score:", scoreError);
      }

      // Also update customer total points (lifetime score)
      const { error: totalPointsError } = await supabase.rpc("increment_customer_total_points", {
        p_customer_id: playerId,
        p_points: 10,
      });

      if (totalPointsError) {
        console.error("Error updating customer total points:", totalPointsError);
      }
    } else {
      // If wrong, award storyteller 10 points (game score)
      const { error: storytellerScoreError } = await supabase.rpc("increment_player_score", {
        p_player_id: storytellerId,
        p_points: 10,
      });

      if (storytellerScoreError) {
        console.error("Error updating storyteller score:", storytellerScoreError);
      }

      // Also update storyteller's customer total points (lifetime score)
      const { error: storytellerTotalPointsError } = await supabase.rpc("increment_customer_total_points", {
        p_customer_id: storytellerId,
        p_points: 10,
      });

      if (storytellerTotalPointsError) {
        console.error("Error updating storyteller customer total points:", storytellerTotalPointsError);
      }
    }

    // Check if all non-storyteller players have answered
    const { data: sessionPlayers, error: sessionPlayersError } = await supabase
      .from("game_players")
      .select("player_id")
      .eq("session_id", sessionId);

    if (sessionPlayersError) {
      console.error("Error fetching session players:", sessionPlayersError);
    }

    // Count non-storyteller players who have answered
    const { data: allGuesses, error: allGuessesError } = await supabase
      .from("game_guesses")
      .select("player_id")
      .eq("turn_id", turnData.id);

    if (allGuessesError) {
      console.error("Error fetching all guesses:", allGuessesError);
    }

    const nonStorytellerPlayers = sessionPlayers?.filter(
      p => p.player_id !== storytellerId
    ) || [];
    
    const uniquePlayerAnswers = new Set(allGuesses?.map(g => g.player_id) || []);
    const allPlayersAnswered = nonStorytellerPlayers.length > 0 && 
                               uniquePlayerAnswers.size >= nonStorytellerPlayers.length;

    console.log(`Players answered: ${uniquePlayerAnswers.size}/${nonStorytellerPlayers.length}`);

    let nextRoundInfo = null;
    let gameCompleted = false;

    // If all players have answered, complete the turn and advance
    if (allPlayersAnswered) {
      console.log("✅ All players have answered - completing turn");

      // Mark turn as completed
      const { error: completeError } = await supabase
        .from("game_turns")
        .update({ completed_at: new Date().toISOString() })
        .eq("id", turnData.id);

      if (completeError) {
        console.error("Error completing turn:", completeError);
      }

      // Advance to next round
      const { data: sessionData, error: sessionError } = await supabase
        .from("game_sessions")
        .select("current_round, total_rounds, id")
        .eq("id", sessionId)
        .single();

      if (sessionError || !sessionData) {
        console.error("Error fetching session for round advancement:", sessionError);
      } else {
        const nextRound = sessionData.current_round + 1;
        
        // Only advance if there are more rounds
        if (nextRound <= sessionData.total_rounds) {
          // Get next storyteller (next player in turn order)
          const { data: allPlayers, error: playersError } = await supabase
            .from("game_players")
            .select("player_id, name, turn_order")
            .eq("session_id", sessionId)
            .order("turn_order", { ascending: true });

          if (playersError || !allPlayers || allPlayers.length === 0) {
            console.error("Error fetching players for round advancement:", playersError);
          } else {
            // Find the player with turn_order matching the next round
            const nextStoryteller = allPlayers.find(p => p.turn_order === nextRound);
            
            if (nextStoryteller) {
              // Get the session's selected theme (theme stays the same for ALL rounds)
              const { data: currentSession } = await supabase
                .from("game_sessions")
                .select("selected_theme_id")
                .eq("id", sessionId)
                .single();

              // Create a new turn record for the next round
              // Include theme_id from session so phase determination skips theme selection
              // Whisp will be generated when the new storyteller selects their mode via start-turn
              const { error: newTurnError } = await supabase
                .from("game_turns")
                .insert({
                  session_id: sessionId,
                  round_number: nextRound,
                  storyteller_id: nextStoryteller.player_id,
                  theme_id: currentSession?.selected_theme_id || null, // Keep the session's theme
                  // No whisp, selected_icon_ids, or turn_mode
                  // These will be set when the new storyteller selects mode
                });

              if (newTurnError) {
                console.error("Error creating new turn for next round:", newTurnError);
              } else {
                console.log(`✅ Created new turn for round ${nextRound} with theme_id: ${currentSession?.selected_theme_id}`);
              }

              // Update session to next round and storyteller
              // KEEP selected_theme_id - theme is fixed for all rounds
              const { error: updateError } = await supabase
                .from("game_sessions")
                .update({
                  current_round: nextRound,
                  current_storyteller_id: nextStoryteller.player_id,
                  // DO NOT clear selected_theme_id - theme stays the same for all rounds
                })
                .eq("id", sessionId);

              if (updateError) {
                console.error("Error advancing to next round:", updateError);
              } else {
                console.log(`✅ Advanced to round ${nextRound}, storyteller: ${nextStoryteller.player_id}`);
                nextRoundInfo = {
                  roundNumber: nextRound,
                  newStorytellerId: nextStoryteller.player_id,
                  newStorytellerName: nextStoryteller.name,
                };
              }
            }
          }
        } else {
          // Game complete - all rounds finished
          // Get all players with final scores for sending to clients
          const { data: allFinalPlayers, error: allFinalPlayersError } = await supabase
            .from("game_players")
            .select("id, player_id, name, score, turn_order")
            .eq("session_id", sessionId)
            .order("score", { ascending: false });

          if (allFinalPlayersError) {
            console.error("Error fetching final players:", allFinalPlayersError);
          }

          const { error: endError } = await supabase
            .from("game_sessions")
            .update({ status: "completed", ended_at: new Date().toISOString() })
            .eq("id", sessionId);

          if (endError) {
            console.error("Error ending game:", endError);
          } else {
            console.log("🎉 Game completed - all rounds finished");
            gameCompleted = true;
            
            // Schedule automatic cleanup in 35 seconds
            console.log('🧹 Scheduling game cleanup in 35 seconds...');
            fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/cleanup-game-session`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
              },
              body: JSON.stringify({ sessionId, delaySeconds: 35 })
            }).catch(err => {
              console.error('Failed to schedule cleanup:', err);
            });
            
            const winner = allFinalPlayers && allFinalPlayers.length > 0 ? allFinalPlayers[0] : null;
            nextRoundInfo = {
              gameCompleted: true,
              winnerId: winner?.player_id,
              winnerName: winner?.name,
              winnerScore: winner?.score,
              players: allFinalPlayers || [], // Include all players with final scores
            };
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        correct: isCorrect,
        points_earned: pointsEarned,
        whisp: turnData.whisp,
        all_players_answered: allPlayersAnswered,
        next_round: nextRoundInfo,
        game_completed: gameCompleted,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in submit-guess:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
