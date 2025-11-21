import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EndLobbyRequest {
  sessionId: string;
  hostCustomerId: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { sessionId, hostCustomerId }: EndLobbyRequest = await req.json();

    console.log("Ending lobby:", { sessionId, hostCustomerId });

    if (!sessionId || !hostCustomerId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify that the user is the host of this session
    const { data: session, error: sessionError } = await supabase
      .from("game_sessions")
      .select("host_customer_id, status")
      .eq("id", sessionId)
      .single();

    if (sessionError || !session) {
      console.error("Session not found:", sessionError);
      return new Response(
        JSON.stringify({ error: "Session not found" }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (session.host_customer_id !== hostCustomerId) {
      console.error("User is not the host");
      return new Response(
        JSON.stringify({ error: "Only the host can end the lobby" }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Delete related data first (if there are no cascade deletes set up)
    // Delete game_audio
    const { error: audioError } = await supabase
      .from("game_audio")
      .delete()
      .eq("session_id", sessionId);

    if (audioError) {
      console.error("Error deleting game audio:", audioError);
    }

    // Delete game_rounds
    const { error: roundsError } = await supabase
      .from("game_rounds")
      .delete()
      .eq("session_id", sessionId);

    if (roundsError) {
      console.error("Error deleting game rounds:", roundsError);
    }

    // Delete game_players
    const { error: playersError } = await supabase
      .from("game_players")
      .delete()
      .eq("session_id", sessionId);

    if (playersError) {
      console.error("Error deleting game players:", playersError);
    }

    // Finally, delete the game session
    const { error: deleteError } = await supabase
      .from("game_sessions")
      .delete()
      .eq("id", sessionId);

    if (deleteError) {
      console.error("Error deleting game session:", deleteError);
      return new Response(
        JSON.stringify({ error: "Failed to delete lobby" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("Lobby ended successfully");

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Lobby ended and deleted successfully" 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("Error in end-lobby function:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
