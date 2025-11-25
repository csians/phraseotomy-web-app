/**
 * Supabase Edge Function: Import License Codes
 * 
 * Imports license codes from CSV with validation and deduplication
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

type ImportCode = {
  code: string;
  pack_names: string[];
  expiration_date?: string;
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
    const { shop_domain, codes }: { shop_domain: string; codes: ImportCode[] } = await req.json();

    if (!shop_domain || !codes || !Array.isArray(codes)) {
      return new Response(
        JSON.stringify({ error: 'shop_domain and codes array are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get tenant
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id')
      .eq('shop_domain', shop_domain)
      .eq('is_active', true)
      .maybeSingle();

    if (tenantError || !tenant) {
      console.error('Tenant not found:', tenantError);
      return new Response(
        JSON.stringify({ error: 'Tenant not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Check for existing codes to prevent duplicates
    const { data: existingCodes } = await supabase
      .from('license_codes')
      .select('code')
      .eq('tenant_id', tenant.id);

    const existingCodeSet = new Set(existingCodes?.map(c => c.code) || []);
    
    // Filter out duplicates
    const newCodes = codes.filter(c => !existingCodeSet.has(c.code));
    const duplicatesFound = codes.length - newCodes.length;

    console.log(`Import: ${codes.length} total, ${newCodes.length} new, ${duplicatesFound} duplicates`);

    if (newCodes.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          imported: 0,
          duplicates_found: duplicatesFound,
          message: 'All codes already exist',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get or create packs
    const allPackNames = [...new Set(newCodes.flatMap(c => c.pack_names))];
    
    // Fetch existing packs
    const { data: existingPacks, error: packsError } = await supabase
      .from('packs')
      .select('id, name')
      .eq('tenant_id', tenant.id)
      .in('name', allPackNames);

    if (packsError) {
      console.error('Packs fetch error:', packsError);
      throw packsError;
    }

    const existingPackNames = existingPacks?.map(p => p.name) || [];
    const packsToCreate = allPackNames.filter(name => !existingPackNames.includes(name));

    // Create missing packs
    if (packsToCreate.length > 0) {
      const { error: createPacksError } = await supabase
        .from('packs')
        .insert(packsToCreate.map(name => ({
          tenant_id: tenant.id,
          name,
          description: null,
        })));

      if (createPacksError) {
        console.error('Create packs error:', createPacksError);
        throw createPacksError;
      }
    }

    // Fetch all packs again to get IDs
    const { data: allPacks, error: allPacksError } = await supabase
      .from('packs')
      .select('id, name')
      .eq('tenant_id', tenant.id)
      .in('name', allPackNames);

    if (allPacksError) {
      console.error('All packs fetch error:', allPacksError);
      throw allPacksError;
    }

    const packNameToId = new Map(allPacks?.map(p => [p.name, p.id]) || []);

    // Insert license codes
    const codesToInsert = newCodes.map((code) => ({
      tenant_id: tenant.id,
      code: code.code.toUpperCase(),
      packs_unlocked: code.pack_names, // Keep for backward compatibility
      expires_at: code.expiration_date ? new Date(code.expiration_date).toISOString() : null,
      status: 'unused',
    }));

    const { data: insertedCodes, error: insertError } = await supabase
      .from('license_codes')
      .insert(codesToInsert)
      .select('id, code');

    if (insertError) {
      console.error('Insert error:', insertError);
      return new Response(
        JSON.stringify({ error: insertError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Create pack associations in junction table
    const codeIdMap = new Map(insertedCodes?.map(c => [c.code, c.id]) || []);
    const packAssociations: { license_code_id: string; pack_id: string }[] = [];

    newCodes.forEach(code => {
      const codeId = codeIdMap.get(code.code.toUpperCase());
      if (codeId) {
        code.pack_names.forEach(packName => {
          const packId = packNameToId.get(packName);
          if (packId) {
            packAssociations.push({
              license_code_id: codeId,
              pack_id: packId,
            });
          }
        });
      }
    });

    // Insert pack associations
    if (packAssociations.length > 0) {
      const { error: assocError } = await supabase
        .from('license_code_packs')
        .insert(packAssociations);

      if (assocError) {
        console.error('Pack associations error:', assocError);
        return new Response(
          JSON.stringify({ error: assocError.message }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    console.log(`✅ Successfully imported ${newCodes.length} codes`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        imported: newCodes.length,
        duplicates_found: duplicatesFound,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in import-license-codes:', error);
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
