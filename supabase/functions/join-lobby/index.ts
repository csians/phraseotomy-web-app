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
    const { lobbyCode, playerName, playerId } = await req.json();

    console.log("Joining lobby:", { lobbyCode, playerName, playerId });

    if (!lobbyCode || !playerName || !playerId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: lobbyCode, playerName, playerId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate lobby code format (6 characters)
    if (lobbyCode.length !== 6) {
      return new Response(
        JSON.stringify({ error: "Invalid lobby code format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate player name length
    if (playerName.trim().length === 0 || playerName.length > 100) {
      return new Response(
        JSON.stringify({ error: "Player name must be between 1 and 100 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Check if lobby exists and is accepting players (waiting or active)
    const { data: session, error: sessionError } = await supabase
      .from("game_sessions")
      .select("*")
      .eq("lobby_code", lobbyCode.toUpperCase())
      .in("status", ["waiting", "active"])
      .single();

    if (sessionError || !session) {
      console.error("Lobby not found or not accepting players:", sessionError);
      return new Response(
        JSON.stringify({ error: "Lobby not found or has ended. Please check the lobby code." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if player already in this session
    const { data: existingPlayer } = await supabase
      .from("game_players")
      .select("id")
      .eq("session_id", session.id)
      .eq("player_id", playerId)
      .single();

    if (existingPlayer) {
      // Player already in lobby, just return success
      console.log("Player already in lobby, returning session");
      return new Response(
        JSON.stringify({ session, message: "Already in lobby" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Count current players
    const { data: players, error: playersError } = await supabase
      .from("game_players")
      .select("id")
      .eq("session_id", session.id);

    if (playersError) {
      console.error("Error counting players:", playersError);
      return new Response(
        JSON.stringify({ error: "Failed to check player count" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if lobby is full (max 12 players)
    if (players && players.length >= 12) {
      return new Response(
        JSON.stringify({ error: "Lobby is full (maximum 12 players)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Add player to the lobby with next turn order
    const nextTurnOrder = (players?.length || 0) + 1;

    const { data: newPlayer, error: insertError } = await supabase
      .from("game_players")
      .insert({
        session_id: session.id,
        player_id: playerId,
        name: playerName.trim(),
        turn_order: nextTurnOrder,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error adding player to lobby:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to join lobby" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Player joined successfully:", newPlayer);

    return new Response(
      JSON.stringify({ session, player: newPlayer }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in join-lobby function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
