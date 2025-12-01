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
    const { sessionId, secretElementId, customerId } = await req.json();

    if (!sessionId || !secretElementId) {
      return new Response(
        JSON.stringify({ error: "Missing sessionId or secretElementId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Strip "custom:" prefix if present so guesses can match directly
    const cleanSecretElement = secretElementId.startsWith('custom:') 
      ? secretElementId.replace('custom:', '') 
      : secretElementId;

    // Get current round from session
    const { data: session, error: sessionError } = await supabase
      .from("game_sessions")
      .select("current_round, current_storyteller_id, selected_theme_id")
      .eq("id", sessionId)
      .single();

    if (sessionError || !session) {
      console.error("Error fetching session:", sessionError);
      return new Response(
        JSON.stringify({ error: "Session not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const currentRound = session.current_round || 1;
    console.log("Saving secret element for session", sessionId, "round:", currentRound, "element:", cleanSecretElement);

    // Check if a turn exists for the CURRENT round
    const { data: existingTurn, error: checkError } = await supabase
      .from("game_turns")
      .select("id, round_number")
      .eq("session_id", sessionId)
      .eq("round_number", currentRound)
      .maybeSingle();

    if (checkError) {
      console.error("Error checking for existing turn:", checkError);
    }

    let turnData;

    if (existingTurn) {
      // Update existing turn for current round with secret element
      console.log("Found existing turn for round", currentRound, "- updating secret element");
      const { data: updatedTurn, error: updateError } = await supabase
        .from("game_turns")
        .update({ 
          secret_element: cleanSecretElement
        })
        .eq("id", existingTurn.id)
        .select()
        .single();

      if (updateError) {
        console.error("Error updating turn secret:", updateError);
        return new Response(
          JSON.stringify({ error: "Failed to update secret: " + updateError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      turnData = updatedTurn;
      console.log("Secret element updated in existing turn for round", currentRound, ":", turnData);
    } else {
      // Create new turn record for current round with secret element
      console.log("No turn found for round", currentRound, "- creating new turn");
      
      if (!session.selected_theme_id) {
        return new Response(
          JSON.stringify({ error: "Theme not selected for session" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: newTurn, error: insertError } = await supabase
        .from("game_turns")
        .insert({
          session_id: sessionId,
          round_number: currentRound,
          storyteller_id: customerId || session.current_storyteller_id,
          theme_id: session.selected_theme_id,
          secret_element: cleanSecretElement,
        })
        .select()
        .single();

      if (insertError) {
        console.error("Error creating turn with secret:", insertError);
        return new Response(
          JSON.stringify({ error: "Failed to save secret: " + insertError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      turnData = newTurn;
      console.log("Secret element saved in new turn for round", currentRound, ":", turnData);
    }

    return new Response(
      JSON.stringify({ 
        turn: turnData,
        secretElementId,
        roundNumber: currentRound
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in save-lobby-secret:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
