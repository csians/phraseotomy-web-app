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

    // Get the turn data including secret element using sessionId and roundNumber
    const { data: turnData, error: turnError } = await supabase
      .from("game_turns")
      .select("id, secret_element, session_id, completed_at")
      .eq("session_id", sessionId)
      .eq("round_number", roundNumber)
      .single();

    if (turnError || !turnData) {
      console.error("Error fetching turn:", turnError);
      return new Response(
        JSON.stringify({ error: "Turn not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if turn is already completed
    if (turnData.completed_at) {
      return new Response(
        JSON.stringify({ error: "Turn already completed", correct: false }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if there's already a correct guess for this turn
    const { data: existingGuesses, error: guessCheckError } = await supabase
      .from("game_guesses")
      .select("id")
      .eq("turn_id", turnData.id)
      .gt("points_earned", 0)
      .limit(1);

    if (guessCheckError) {
      console.error("Error checking existing guesses:", guessCheckError);
    }

    const alreadyAnswered = existingGuesses && existingGuesses.length > 0;

    // Check how many attempts this player has made for this turn
    const { data: playerGuesses, error: playerGuessError } = await supabase
      .from("game_guesses")
      .select("id")
      .eq("turn_id", turnData.id)
      .eq("player_id", playerId);

    if (playerGuessError) {
      console.error("Error checking player guesses:", playerGuessError);
    }

    const attemptNumber = (playerGuesses?.length || 0) + 1;
    const maxAttempts = 3;

    console.log(`Player ${playerId} attempt ${attemptNumber}/${maxAttempts} for turn ${turnData.id}`);

    // Check if secret element exists
    if (!turnData.secret_element) {
      return new Response(
        JSON.stringify({ error: "Secret element not set for this turn", correct: false }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Normalize the guess and secret element for comparison
    const normalizedGuess = guess.trim().toLowerCase();
    let normalizedSecret = "";
    
    // Handle custom elements (format: "custom:text")
    if (turnData.secret_element.startsWith("custom:")) {
      normalizedSecret = turnData.secret_element.substring(7).toLowerCase();
    } else {
      // Secret element is already the element name, not an ID
      normalizedSecret = turnData.secret_element.toLowerCase();
    }

    const isCorrect = normalizedGuess === normalizedSecret && !alreadyAnswered;
    const pointsEarned = isCorrect ? 10 : 0;

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

    // Check if player has reached max attempts and failed all
    const isLastAttempt = attemptNumber >= maxAttempts;
    const shouldFailPlayer = isLastAttempt && !isCorrect;

    if (shouldFailPlayer) {
      console.log(`Player ${playerId} failed after ${maxAttempts} attempts`);
      // Don't complete the turn yet - let other players continue guessing
    }

    // If correct and first to answer, update player score and complete turn
    if (isCorrect) {
      // Update player score using the increment function
      const { error: scoreError } = await supabase.rpc("increment_player_score", {
        p_player_id: playerId,
        p_points: 10,
      });

      if (scoreError) {
        console.error("Error updating player score:", scoreError);
      }

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

      let nextRoundInfo = null;
      let gameCompleted = false;

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
              // Update session to next round and storyteller
              const { error: updateError } = await supabase
                .from("game_sessions")
                .update({
                  current_round: nextRound,
                  current_storyteller_id: nextStoryteller.player_id,
                  selected_theme_id: null, // Reset theme for new turn
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
          // Get winner (player with highest score)
          const { data: winners, error: winnerError } = await supabase
            .from("game_players")
            .select("player_id, name, score")
            .eq("session_id", sessionId)
            .order("score", { ascending: false })
            .limit(1);

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
          correct: isCorrect,
          points_earned: pointsEarned,
          already_answered: alreadyAnswered,
          secret_element: turnData.secret_element,
          next_round: nextRoundInfo,
          game_completed: gameCompleted,
          attempts_remaining: 0,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        correct: isCorrect,
        points_earned: pointsEarned,
        already_answered: alreadyAnswered,
        attempts_remaining: Math.max(0, maxAttempts - attemptNumber),
        max_attempts_reached: shouldFailPlayer,
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
