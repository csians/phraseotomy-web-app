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
    const { sessionId, delaySeconds = 35 } = await req.json();

    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: 'Session ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🧹 Scheduling cleanup for session ${sessionId} in ${delaySeconds} seconds`);

    // Use background task to handle cleanup after delay
    const cleanupTask = async () => {
      // Wait for the specified delay
      await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000));

      console.log(`🧹 Starting cleanup for session ${sessionId}`);

      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      try {
        // 1. Get all audio files to delete from storage
        const { data: audioRecords } = await supabase
          .from('game_audio')
          .select('audio_url')
          .eq('session_id', sessionId);

        // 2. Get recording URLs from game_turns
        const { data: turnRecords } = await supabase
          .from('game_turns')
          .select('recording_url')
          .eq('session_id', sessionId)
          .not('recording_url', 'is', null);

        // 3. Delete audio files from storage
        const audioUrls = [
          ...(audioRecords || []).map(r => r.audio_url),
          ...(turnRecords || []).map(r => r.recording_url)
        ].filter(Boolean);

        for (const audioUrl of audioUrls) {
          try {
            // Extract file path from URL (format: bucket/path/to/file)
            const urlParts = audioUrl.split('/storage/v1/object/public/');
            if (urlParts.length > 1) {
              const [bucket, ...pathParts] = urlParts[1].split('/');
              const filePath = pathParts.join('/');
              
              console.log(`🗑️ Deleting audio file: ${bucket}/${filePath}`);
              await supabase.storage.from(bucket).remove([filePath]);
            }
          } catch (error) {
            console.error(`Failed to delete audio file ${audioUrl}:`, error);
          }
        }

        // 4. Get all turn IDs first
        const { data: turns } = await supabase
          .from('game_turns')
          .select('id')
          .eq('session_id', sessionId);

        const turnIds = (turns || []).map(t => t.id);

        // 5. Delete related records in order (foreign key constraints)
        if (turnIds.length > 0) {
          console.log('🗑️ Deleting game_guesses...');
          await supabase
            .from('game_guesses')
            .delete()
            .in('turn_id', turnIds);
        }

        console.log('🗑️ Deleting game_audio...');
        await supabase
          .from('game_audio')
          .delete()
          .eq('session_id', sessionId);

        console.log('🗑️ Deleting game_turns...');
        await supabase
          .from('game_turns')
          .delete()
          .eq('session_id', sessionId);

        console.log('🗑️ Deleting game_rounds...');
        await supabase
          .from('game_rounds')
          .delete()
          .eq('session_id', sessionId);

        console.log('🗑️ Deleting game_players...');
        await supabase
          .from('game_players')
          .delete()
          .eq('session_id', sessionId);

        console.log('🗑️ Deleting game_sessions...');
        const { error: sessionError } = await supabase
          .from('game_sessions')
          .delete()
          .eq('id', sessionId);

        if (sessionError) {
          throw sessionError;
        }

        console.log(`✅ Successfully cleaned up session ${sessionId}`);
      } catch (error) {
        console.error(`❌ Error cleaning up session ${sessionId}:`, error);
      }
    };

    // Schedule the cleanup task in the background
    cleanupTask().catch(err => console.error('Background cleanup error:', err));

    // Return immediate response
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Cleanup scheduled for session ${sessionId} in ${delaySeconds} seconds` 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in cleanup-game-session:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
