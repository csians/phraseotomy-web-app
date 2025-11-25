/**
 * Supabase Edge Function: Import Packs
 * 
 * Imports packs from CSV/XLSX with validation and deduplication
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

type ImportPack = {
  name: string;
  description?: string;
};

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tenant_id, packs }: { tenant_id: string; packs: ImportPack[] } = await req.json();

    if (!tenant_id || !packs || !Array.isArray(packs)) {
      return new Response(
        JSON.stringify({ error: 'tenant_id and packs array are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`📦 Importing ${packs.length} packs for tenant: ${tenant_id}`);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Check for existing packs to prevent duplicates
    const { data: existingPacks } = await supabase
      .from('packs')
      .select('name')
      .eq('tenant_id', tenant_id);

    const existingPackNames = new Set(existingPacks?.map(p => p.name.toLowerCase()) || []);
    
    // Filter out duplicates (case-insensitive)
    const newPacks = packs.filter(p => !existingPackNames.has(p.name.toLowerCase()));
    const duplicatesFound = packs.length - newPacks.length;

    console.log(`Import: ${packs.length} total, ${newPacks.length} new, ${duplicatesFound} duplicates`);

    if (newPacks.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          imported: 0,
          duplicates_found: duplicatesFound,
          message: 'All packs already exist',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert new packs
    const packsToInsert = newPacks.map((pack) => ({
      tenant_id: tenant_id,
      name: pack.name,
      description: pack.description || null,
    }));

    const { error: insertError } = await supabase
      .from('packs')
      .insert(packsToInsert);

    if (insertError) {
      console.error('❌ Insert error:', insertError);
      return new Response(
        JSON.stringify({ error: insertError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`✅ Successfully imported ${newPacks.length} packs`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        imported: newPacks.length,
        duplicates_found: duplicatesFound,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('❌ Error in import-packs:', error);
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
