import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { customerId, shopDomain } = await req.json();

    if (!customerId || !shopDomain) {
      return new Response(
        JSON.stringify({ error: 'Missing customerId or shopDomain' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('Fetching data for customer:', { customerId, shopDomain });

    // Initialize Supabase with service role (bypasses RLS)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch customer licenses
    const { data: licenses, error: licensesError } = await supabase
      .from('customer_licenses')
      .select(`
        id,
        license_code_id,
        customer_id,
        customer_name,
        customer_email,
        status,
        activated_at,
        shop_domain,
        tenant_id,
        license_codes (
          code,
          packs_unlocked,
          expires_at
        )
      `)
      .eq('customer_id', customerId)
      .eq('shop_domain', shopDomain)
      .eq('status', 'active');

    if (licensesError) {
      console.error('Error fetching licenses:', licensesError);
      return new Response(
        JSON.stringify({ error: licensesError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Fetch customer game sessions
    const { data: sessions, error: sessionsError } = await supabase
      .from('game_sessions')
      .select(`
        id,
        lobby_code,
        host_customer_id,
        host_customer_name,
        status,
        packs_used,
        created_at,
        started_at,
        ended_at,
        shop_domain,
        tenant_id
      `)
      .eq('host_customer_id', customerId)
      .eq('shop_domain', shopDomain)
      .order('created_at', { ascending: false })
      .limit(10);

    if (sessionsError) {
      console.error('Error fetching sessions:', sessionsError);
      return new Response(
        JSON.stringify({ error: sessionsError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Transform licenses to match expected format
    const formattedLicenses = (licenses || []).map(license => {
      const licenseCode = Array.isArray(license.license_codes) 
        ? license.license_codes[0] 
        : license.license_codes;
      
      return {
        id: license.id,
        license_code_id: license.license_code_id,
        customer_id: license.customer_id,
        customer_name: license.customer_name,
        customer_email: license.customer_email,
        status: license.status,
        activated_at: license.activated_at,
        shop_domain: license.shop_domain,
        tenant_id: license.tenant_id,
        packs_unlocked: licenseCode?.packs_unlocked || [],
        expires_at: licenseCode?.expires_at || null,
      };
    });

    console.log('Successfully fetched data:', {
      licenses: formattedLicenses.length,
      sessions: sessions?.length || 0,
    });

    return new Response(
      JSON.stringify({
        licenses: formattedLicenses,
        sessions: sessions || [],
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in get-customer-licenses-sessions:', error);
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
