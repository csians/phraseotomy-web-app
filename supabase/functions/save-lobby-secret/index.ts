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

    console.log("Saving secret element for session", sessionId, "element:", secretElementId);

    // Check if a turn already exists for this session
    const { data: existingTurn, error: checkError } = await supabase
      .from("game_turns")
      .select("id")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (checkError) {
      console.error("Error checking for existing turn:", checkError);
    }

    let turnData;

    if (existingTurn) {
      // Update existing turn with secret element
      const { data: updatedTurn, error: updateError } = await supabase
        .from("game_turns")
        .update({ 
          secret_element: secretElementId
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
      console.log("Secret element updated in existing turn:", turnData);
    } else {
      // Create new turn record with secret element
      const { data: session } = await supabase
        .from("game_sessions")
        .select("current_round, current_storyteller_id, selected_theme_id")
        .eq("id", sessionId)
        .single();

      if (!session || !session.selected_theme_id) {
        return new Response(
          JSON.stringify({ error: "Session not found or theme not selected" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: newTurn, error: insertError } = await supabase
        .from("game_turns")
        .insert({
          session_id: sessionId,
          round_number: session.current_round || 1,
          storyteller_id: customerId,
          theme_id: session.selected_theme_id,
          secret_element: secretElementId,
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
      console.log("Secret element saved in new turn:", turnData);
    }

    return new Response(
      JSON.stringify({ 
        turn: turnData,
        secretElementId 
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
