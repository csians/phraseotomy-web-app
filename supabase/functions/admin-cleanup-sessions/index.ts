import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { statuses = ['completed', 'active'] } = await req.json().catch(() => ({}));

    console.log(`🧹 Starting cleanup of sessions with status: ${statuses.join(', ')}`);

    // 1. Get all sessions to delete
    const { data: sessionsToDelete, error: sessionsError } = await supabase
      .from('game_sessions')
      .select('id, lobby_code, status')
      .in('status', statuses);

    if (sessionsError) {
      console.error('Error fetching sessions:', sessionsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch sessions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!sessionsToDelete || sessionsToDelete.length === 0) {
      console.log('No sessions to delete');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No sessions to delete',
          deleted: 0
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const sessionIds = sessionsToDelete.map(s => s.id);
    console.log(`Found ${sessionIds.length} sessions to delete: ${sessionsToDelete.map(s => s.lobby_code).join(', ')}`);

    // 2. Get all turn IDs for these sessions
    const { data: turns } = await supabase
      .from('game_turns')
      .select('id')
      .in('session_id', sessionIds);

    const turnIds = (turns || []).map(t => t.id);

    // 3. Delete in correct order (respecting foreign keys)
    
    // Delete game_guesses
    if (turnIds.length > 0) {
      console.log(`Deleting game_guesses for ${turnIds.length} turns...`);
      const { error: guessesError } = await supabase
        .from('game_guesses')
        .delete()
        .in('turn_id', turnIds);

      if (guessesError) {
        console.error('Error deleting game_guesses:', guessesError);
      }
    }

    // Delete game_audio
    console.log(`Deleting game_audio for ${sessionIds.length} sessions...`);
    const { error: audioError } = await supabase
      .from('game_audio')
      .delete()
      .in('session_id', sessionIds);

    if (audioError) {
      console.error('Error deleting game_audio:', audioError);
    }

    // Delete game_turns
    console.log(`Deleting game_turns for ${sessionIds.length} sessions...`);
    const { error: turnsError } = await supabase
      .from('game_turns')
      .delete()
      .in('session_id', sessionIds);

    if (turnsError) {
      console.error('Error deleting game_turns:', turnsError);
    }

    // Delete game_rounds
    console.log(`Deleting game_rounds for ${sessionIds.length} sessions...`);
    const { error: roundsError } = await supabase
      .from('game_rounds')
      .delete()
      .in('session_id', sessionIds);

    if (roundsError) {
      console.error('Error deleting game_rounds:', roundsError);
    }

    // Delete game_players
    console.log(`Deleting game_players for ${sessionIds.length} sessions...`);
    const { error: playersError } = await supabase
      .from('game_players')
      .delete()
      .in('session_id', sessionIds);

    if (playersError) {
      console.error('Error deleting game_players:', playersError);
    }

    // Delete game_sessions
    console.log(`Deleting ${sessionIds.length} game_sessions...`);
    const { error: sessionsDeleteError } = await supabase
      .from('game_sessions')
      .delete()
      .in('id', sessionIds);

    if (sessionsDeleteError) {
      console.error('Error deleting game_sessions:', sessionsDeleteError);
      return new Response(
        JSON.stringify({ error: 'Failed to delete sessions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✅ Successfully deleted ${sessionIds.length} sessions`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Deleted ${sessionIds.length} sessions`,
        deleted: sessionIds.length,
        sessions: sessionsToDelete.map(s => ({ lobby_code: s.lobby_code, status: s.status }))
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in admin-cleanup-sessions:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
