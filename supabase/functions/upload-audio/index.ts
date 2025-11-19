import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.83.0';

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

    // Parse form data
    const formData = await req.formData();
    const audioFile = formData.get('audio') as File;
    const sessionId = formData.get('session_id') as string;
    const playerId = formData.get('player_id') as string;
    const roundNumber = formData.get('round_number') as string;

    // Validate required fields
    if (!audioFile) {
      return new Response(
        JSON.stringify({ error: 'Audio file is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!sessionId || !playerId || !roundNumber) {
      return new Response(
        JSON.stringify({ 
          error: 'Missing required fields: session_id, player_id, round_number' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate file size (10MB max)
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    if (audioFile.size > MAX_FILE_SIZE) {
      return new Response(
        JSON.stringify({ error: 'File size exceeds 10MB limit' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate MIME type
    const ALLOWED_MIME_TYPES = ['audio/webm', 'audio/wav', 'audio/mp3', 'audio/mpeg', 'audio/ogg'];
    if (!audioFile.type || !ALLOWED_MIME_TYPES.includes(audioFile.type)) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid file type. Allowed: webm, wav, mp3, ogg' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate session exists and player is in the session
    const { data: session, error: sessionError } = await supabase
      .from('game_sessions')
      .select('id')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return new Response(
        JSON.stringify({ error: 'Invalid session ID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify player is in the session
    const { data: player, error: playerError } = await supabase
      .from('game_players')
      .select('id')
      .eq('session_id', sessionId)
      .eq('player_id', playerId)
      .single();

    if (playerError || !player) {
      return new Response(
        JSON.stringify({ error: 'Player not found in this session' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if audio already exists for this round/player
    const { data: existingAudio } = await supabase
      .from('game_audio')
      .select('id')
      .eq('session_id', sessionId)
      .eq('player_id', playerId)
      .eq('round_number', parseInt(roundNumber))
      .single();

    if (existingAudio) {
      return new Response(
        JSON.stringify({ error: 'Audio already uploaded for this round' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate unique filename
    const timestamp = Date.now();
    const fileExt = audioFile.name.split('.').pop() || 'webm';
    const fileName = `${sessionId}/${playerId}_round${roundNumber}_${timestamp}.${fileExt}`;

    console.log(`Uploading audio file: ${fileName}, size: ${audioFile.size} bytes`);

    // Convert File to ArrayBuffer
    const arrayBuffer = await audioFile.arrayBuffer();

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('audio_uploads')
      .upload(fileName, arrayBuffer, {
        contentType: audioFile.type || 'audio/webm',
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return new Response(
        JSON.stringify({ error: `Upload failed: ${uploadError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Upload successful:', uploadData);

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('audio_uploads')
      .getPublicUrl(fileName);

    const audioUrl = urlData.publicUrl;

    // Store metadata in game_audio table
    const { data: audioRecord, error: dbError } = await supabase
      .from('game_audio')
      .insert({
        session_id: sessionId,
        player_id: playerId,
        round_number: parseInt(roundNumber),
        audio_url: audioUrl,
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      // Still return the URL even if DB insert fails
      return new Response(
        JSON.stringify({
          url: audioUrl,
          warning: 'Audio uploaded but failed to save metadata',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Audio record created:', audioRecord);

    return new Response(
      JSON.stringify({
        url: audioUrl,
        audio_id: audioRecord.id,
        message: 'Audio uploaded successfully',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in upload-audio function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
