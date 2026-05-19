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
    const { turnId, secretElementId } = await req.json();

    if (!turnId || !secretElementId) {
      return new Response(
        JSON.stringify({ error: "Missing turnId or secretElementId" }),
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

    // Update turn with secret element
    const { error: updateError } = await supabase
      .from("game_turns")
      .update({ 
        secret_element: cleanSecretElement
      })
      .eq("id", turnId);

    if (updateError) {
      console.error("Error updating turn:", updateError);
      return new Response(
        JSON.stringify({ error: updateError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in update-turn-secret:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
