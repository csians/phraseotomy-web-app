import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pack_id, tenant_id, is_default } = await req.json();

    if (!pack_id || !tenant_id) {
      return new Response(
        JSON.stringify({ error: 'pack_id and tenant_id are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log('Setting default pack:', { pack_id, tenant_id, is_default });

    // Verify pack belongs to tenant
    const { data: pack, error: fetchError } = await supabase
      .from('packs')
      .select('id, name, tenant_id')
      .eq('id', pack_id)
      .single();

    if (fetchError || !pack) {
      return new Response(
        JSON.stringify({ error: 'Pack not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (pack.tenant_id !== tenant_id) {
      return new Response(
        JSON.stringify({ error: 'Pack does not belong to this tenant' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Update the pack's is_default status
    // The database trigger will handle unsetting other defaults
    const { error: updateError } = await supabase
      .from('packs')
      .update({ is_default: is_default ?? true })
      .eq('id', pack_id);

    if (updateError) {
      console.error('Error updating pack:', updateError);
      return new Response(
        JSON.stringify({ error: updateError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`✅ Pack "${pack.name}" ${is_default ? 'set as' : 'unset from'} default`);

    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in admin-set-default-pack:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
