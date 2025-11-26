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
    const { turnId, playerId, guess } = await req.json();

    if (!turnId || !playerId || !guess) {
      return new Response(
        JSON.stringify({ error: "Missing turnId, playerId, or guess" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get the turn data including secret element
    const { data: turnData, error: turnError } = await supabase
      .from("game_turns")
      .select("secret_element, session_id, completed_at")
      .eq("id", turnId)
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
      .eq("turn_id", turnId)
      .gt("points_earned", 0)
      .limit(1);

    if (guessCheckError) {
      console.error("Error checking existing guesses:", guessCheckError);
    }

    const alreadyAnswered = existingGuesses && existingGuesses.length > 0;

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
        turn_id: turnId,
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
        .eq("id", turnId);

      if (completeError) {
        console.error("Error completing turn:", completeError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        correct: isCorrect,
        points_earned: pointsEarned,
        already_answered: alreadyAnswered,
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
