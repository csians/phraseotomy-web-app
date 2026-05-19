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
    const { sessionId, themeId, customerId, customerName } = await req.json();

    if (!sessionId || !themeId) {
      return new Response(
        JSON.stringify({ error: "Missing sessionId or themeId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    console.log("Updating session", sessionId, "with theme", themeId, "by customer", customerName);

    // Update session with selected theme using service role to bypass RLS
    const { data: updatedSession, error: updateError } = await supabase
      .from("game_sessions")
      .update({ 
        selected_theme_id: themeId,
        updated_at: new Date().toISOString()
      })
      .eq("id", sessionId)
      .select("id, selected_theme_id, updated_at")
      .single();

    if (updateError) {
      console.error("Error updating session theme:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to update theme: " + updateError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Theme updated successfully:", updatedSession);

    return new Response(
      JSON.stringify({ 
        session: updatedSession,
        selectedBy: {
          customerId,
          customerName
        }
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in update-session-theme:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
