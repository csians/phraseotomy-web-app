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
    const { sessionId, customerId } = await req.json();

    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: 'Session ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fetching lobby data for session:', sessionId, 'customer:', customerId);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // Fetch session details
    const { data: sessionData, error: sessionError } = await supabase
      .from('game_sessions')
      .select('*')
      .eq('id', sessionId)
      .maybeSingle();

    if (sessionError) {
      console.error('Session fetch error:', sessionError);
      throw sessionError;
    }

    if (!sessionData) {
      return new Response(
        JSON.stringify({ error: 'Session not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch players in this session
    const { data: playersData, error: playersError } = await supabase
      .from('game_players')
      .select('*')
      .eq('session_id', sessionId)
      .order('turn_order');

    if (playersError) {
      console.error('Players fetch error:', playersError);
      throw playersError;
    }

    // Fetch customer's audio files if customerId is provided (for host to select)
    let audioData = [];
    if (customerId) {
      console.log('Fetching audio for customer ID:', customerId, 'Type:', typeof customerId);
      
      // Convert to string to match database format
      const customerIdStr = customerId.toString();
      console.log('Customer ID as string:', customerIdStr);
      
      const { data, error: audioError } = await supabase
        .from('customer_audio')
        .select('*')
        .eq('customer_id', customerIdStr)
        .order('created_at', { ascending: false });

      if (audioError) {
        console.error('Audio fetch error:', audioError);
      } else {
        audioData = data || [];
        console.log('Audio files found:', audioData.length);
        if (audioData.length > 0) {
          console.log('Sample audio record:', audioData[0]);
        }
      }
    } else {
      console.log('No customer ID provided for audio fetch');
    }

    // If game is active and has selected audio, fetch that audio for all players
    let selectedAudioData = null;
    if (sessionData.status === 'active' && sessionData.selected_audio_id) {
      console.log('Fetching selected audio for all players:', sessionData.selected_audio_id);
      const { data: selectedAudio, error: selectedAudioError } = await supabase
        .from('customer_audio')
        .select('*')
        .eq('id', sessionData.selected_audio_id)
        .maybeSingle();

      if (selectedAudioError) {
        console.error('Selected audio fetch error:', selectedAudioError);
      } else if (selectedAudio) {
        selectedAudioData = selectedAudio;
        console.log('Selected audio found:', selectedAudio);
        // Add selected audio to audioData if not already present
        if (!audioData.find(a => a.id === selectedAudio.id)) {
          audioData.push(selectedAudio);
        }
      }
    }

    // Fetch current turn data (theme, secret element, recording)
    let currentTurnData = null;
    const { data: turnData, error: turnError } = await supabase
      .from('game_turns')
      .select('*')
      .eq('session_id', sessionId)
      .eq('round_number', sessionData.current_round || 1)
      .maybeSingle();

    if (turnError) {
      console.error('Turn fetch error:', turnError);
    } else if (turnData) {
      currentTurnData = turnData;
      console.log('Current turn data found:', turnData);
      
      // Hide secret_element from non-storytellers
      if (currentTurnData && currentTurnData.storyteller_id !== customerId) {
        currentTurnData = { ...currentTurnData, secret_element: null };
      }
    }

    return new Response(
      JSON.stringify({
        session: sessionData,
        players: playersData || [],
        audioFiles: audioData,
        currentTurn: currentTurnData,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in get-lobby-data:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
