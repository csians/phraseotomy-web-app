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
    const { customerId } = await req.json();

    if (!customerId) {
      return new Response(
        JSON.stringify({ error: 'Customer ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fetching audio files for customer:', customerId, 'Type:', typeof customerId);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // Convert to string to ensure matching
    const customerIdStr = customerId.toString();
    console.log('Querying with customer_id:', customerIdStr);

    // Fetch customer's audio files
    const { data: audioData, error: audioError } = await supabase
      .from('customer_audio')
      .select('*')
      .eq('customer_id', customerIdStr)
      .order('created_at', { ascending: false });

    if (audioError) {
      console.error('Audio fetch error:', audioError);
      throw audioError;
    }

    console.log('Audio files found:', audioData?.length || 0);
    if (audioData && audioData.length > 0) {
      console.log('Sample audio:', audioData[0]);
    }

    return new Response(
      JSON.stringify({
        audioFiles: audioData || [],
        count: audioData?.length || 0,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in get-customer-audio:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
