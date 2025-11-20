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

    // Fetch customer's audio files if customerId is provided
    let audioData = [];
    if (customerId) {
      console.log('Fetching audio for customer:', customerId);
      
      const { data, error: audioError } = await supabase
        .from('customer_audio')
        .select('*')
        .eq('customer_id', customerId.toString())
        .order('created_at', { ascending: false });

      if (audioError) {
        console.error('Audio fetch error:', audioError);
      } else {
        audioData = data || [];
        console.log('Audio files found:', audioData.length);
      }
    }

    return new Response(
      JSON.stringify({
        session: sessionData,
        players: playersData || [],
        audioFiles: audioData,
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
