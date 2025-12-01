import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("🗑️ Starting to delete all lobbies and related data...");

    // Delete all related data in correct order to avoid foreign key constraints
    
    // 1. Delete all game_guesses
    const { error: guessesError } = await supabase
      .from("game_guesses")
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (guessesError) {
      console.error("Error deleting game guesses:", guessesError);
    } else {
      console.log("✅ Deleted all game guesses");
    }

    // 2. Delete all game_turns
    const { error: turnsError } = await supabase
      .from("game_turns")
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (turnsError) {
      console.error("Error deleting game turns:", turnsError);
    } else {
      console.log("✅ Deleted all game turns");
    }

    // 3. Delete all game_audio
    const { error: audioError } = await supabase
      .from("game_audio")
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (audioError) {
      console.error("Error deleting game audio:", audioError);
    } else {
      console.log("✅ Deleted all game audio");
    }

    // 4. Delete all game_rounds
    const { error: roundsError } = await supabase
      .from("game_rounds")
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (roundsError) {
      console.error("Error deleting game rounds:", roundsError);
    } else {
      console.log("✅ Deleted all game rounds");
    }

    // 5. Delete all game_players
    const { error: playersError } = await supabase
      .from("game_players")
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (playersError) {
      console.error("Error deleting game players:", playersError);
    } else {
      console.log("✅ Deleted all game players");
    }

    // 6. Finally, delete all game_sessions
    const { error: sessionsError } = await supabase
      .from("game_sessions")
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (sessionsError) {
      console.error("Error deleting game sessions:", sessionsError);
      return new Response(
        JSON.stringify({ error: "Failed to delete all sessions" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("✅ Deleted all game sessions");
    console.log("🎉 All lobbies and related data deleted successfully");

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "All lobbies and related data deleted successfully" 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("Error in end-all-lobbies function:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
