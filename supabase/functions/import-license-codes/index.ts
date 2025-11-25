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
  pack_name: string;
  expiration_date: string;
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

    // Prepare inserts
    const inserts = newCodes.map(code => ({
      tenant_id: tenant.id,
      code: code.code,
      packs_unlocked: [code.pack_name], // Store pack name in array
      status: 'unused',
      expires_at: code.expiration_date ? new Date(code.expiration_date).toISOString() : null,
    }));

    // Batch insert
    const { error: insertError } = await supabase
      .from('license_codes')
      .insert(inserts);

    if (insertError) {
      console.error('Error inserting codes:', insertError);
      return new Response(
        JSON.stringify({ error: insertError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
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
