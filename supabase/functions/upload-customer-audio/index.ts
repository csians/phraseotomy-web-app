import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const formData = await req.formData();
    const audio = formData.get('audio');
    const customerId = formData.get('customer_id');
    const shopDomain = formData.get('shop_domain');
    const tenantId = formData.get('tenant_id');
    const sessionId = formData.get('session_id');
    const roundNumber = formData.get('round_number');

    if (!audio || !(audio instanceof File)) {
      return new Response(
        JSON.stringify({ error: 'No audio file provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!customerId || !shopDomain || !tenantId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate file size (10MB max)
    if (audio.size > 10 * 1024 * 1024) {
      return new Response(
        JSON.stringify({ error: 'File size exceeds 10MB limit' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate file type
    const allowedTypes = ['audio/webm', 'audio/wav', 'audio/mp3', 'audio/mpeg', 'audio/ogg'];
    if (!allowedTypes.includes(audio.type)) {
      return new Response(
        JSON.stringify({ error: 'Invalid file type. Allowed: webm, wav, mp3, ogg' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate unique filename
    const timestamp = Date.now();
    const fileExtension = audio.name.split('.').pop() || 'webm';
    const filename = `customer_${customerId}_${timestamp}.${fileExtension}`;
    const filePath = `${shopDomain}/${customerId}/${filename}`;

    // Upload to Supabase Storage
    const arrayBuffer = await audio.arrayBuffer();
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('audio_uploads')
      .upload(filePath, arrayBuffer, {
        contentType: audio.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return new Response(
        JSON.stringify({ error: 'Failed to upload audio file' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('audio_uploads')
      .getPublicUrl(filePath);

    const audioUrl = urlData.publicUrl;

    // Insert metadata into customer_audio table
    console.log('Inserting audio record with customer_id:', customerId, 'Type:', typeof customerId);
    
    const { data: audioRecord, error: dbError } = await supabase
      .from('customer_audio')
      .insert({
        customer_id: customerId.toString(),
        shop_domain: shopDomain.toString(),
        tenant_id: tenantId.toString(),
        audio_url: audioUrl,
        filename: audio.name,
      })
      .select()
      .maybeSingle();

    if (dbError || !audioRecord) {
      console.error('Database error:', dbError);
      return new Response(
        JSON.stringify({ error: 'Failed to save audio metadata', details: dbError?.message || 'No record created' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Audio record created:', audioRecord.id, 'for customer:', audioRecord.customer_id);

    // Update game_turns with recording_url if sessionId and roundNumber are provided
    if (sessionId && roundNumber) {
      console.log('Updating game_turns with recording_url for session:', sessionId, 'round:', roundNumber);
      const { error: turnError } = await supabase
        .from('game_turns')
        .update({ recording_url: audioUrl })
        .eq('session_id', sessionId)
        .eq('round_number', parseInt(roundNumber.toString()));

      if (turnError) {
        console.error('Failed to update game_turns:', turnError);
        // Don't fail the request, just log the error
      } else {
        console.log('Successfully updated game_turns with recording_url');
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        audio_url: audioUrl,
        audio_id: audioRecord.id,
        message: 'Audio uploaded successfully',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});