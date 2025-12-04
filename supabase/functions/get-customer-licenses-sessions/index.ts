import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Map of related shop domains (staging <-> production)
const RELATED_SHOP_DOMAINS: Record<string, string[]> = {
  // Production domains
  'phraseotomy.com': ['phraseotomy.com', 'qxqtbf-21.myshopify.com'],
  'qxqtbf-21.myshopify.com': ['phraseotomy.com', 'qxqtbf-21.myshopify.com', 'phraseotomy.ourstagingserver.com'],
  // Staging domains
  'testing-cs-store.myshopify.com': ['testing-cs-store.myshopify.com'],
  'phraseotomy.ourstagingserver.com': ['testing-cs-store.myshopify.com'],
};

function getRelatedDomains(shopDomain: string): string[] {
  return RELATED_SHOP_DOMAINS[shopDomain] || [shopDomain];
}

Deno.serve(async (req) => {
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

    const domainsToSearch = getRelatedDomains(shopDomain);
    
    console.log('Fetching data for customer:', { customerId, shopDomain, domainsToSearch });

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // First, try to find the customer record to get linked IDs (staging/prod)
    const { data: customerRecord } = await supabase
      .from('customers')
      .select('customer_id, staging_customer_id, prod_customer_id')
      .or(`customer_id.eq.${customerId},staging_customer_id.eq.${customerId},prod_customer_id.eq.${customerId}`)
      .in('shop_domain', domainsToSearch)
      .limit(1)
      .single();

    // Build list of all customer IDs to search (original + linked)
    const customerIdsToSearch = [customerId];
    if (customerRecord) {
      if (customerRecord.customer_id && !customerIdsToSearch.includes(customerRecord.customer_id)) {
        customerIdsToSearch.push(customerRecord.customer_id);
      }
      if (customerRecord.staging_customer_id && !customerIdsToSearch.includes(customerRecord.staging_customer_id)) {
        customerIdsToSearch.push(customerRecord.staging_customer_id);
      }
      if (customerRecord.prod_customer_id && !customerIdsToSearch.includes(customerRecord.prod_customer_id)) {
        customerIdsToSearch.push(customerRecord.prod_customer_id);
      }
    }

    console.log('Searching with customer IDs:', customerIdsToSearch);

    // Fetch customer licenses - search across all related domains and customer IDs
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
      .in('customer_id', customerIdsToSearch)
      .in('shop_domain', domainsToSearch)
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

    // Fetch hosted game sessions - search across all related domains and customer IDs
    const { data: hostedSessions, error: hostedError } = await supabase
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
        tenant_id,
        game_name
      `)
      .in('host_customer_id', customerIdsToSearch)
      .in('shop_domain', domainsToSearch)
      .in('status', ['waiting', 'active'])
      .order('created_at', { ascending: false })
      .limit(10);

    if (hostedError) {
      console.error('Error fetching hosted sessions:', hostedError);
    }

    // Fetch joined game sessions (where user is a player but not the host)
    const { data: playerEntries, error: playerError } = await supabase
      .from('game_players')
      .select('session_id, player_id')
      .in('player_id', customerIdsToSearch);

    if (playerError) {
      console.error('Error fetching player entries:', playerError);
    }

    // Get unique session IDs where user is a player
    const joinedSessionIds = [...new Set((playerEntries || []).map(p => p.session_id))];
    
    // Fetch joined sessions (exclude hosted ones)
    let joinedSessions: any[] = [];
    if (joinedSessionIds.length > 0) {
      const hostedIds = (hostedSessions || []).map(s => s.id);
      const nonHostedSessionIds = joinedSessionIds.filter(id => !hostedIds.includes(id));
      
      if (nonHostedSessionIds.length > 0) {
        const { data: joinedData, error: joinedError } = await supabase
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
            tenant_id,
            game_name
          `)
          .in('id', nonHostedSessionIds)
          .in('status', ['waiting', 'active'])
          .order('created_at', { ascending: false })
          .limit(10);

        if (joinedError) {
          console.error('Error fetching joined sessions:', joinedError);
        } else {
          joinedSessions = joinedData || [];
        }
      }
    }

    // Get player counts for all sessions
    const allSessionIds = [
      ...(hostedSessions || []).map(s => s.id),
      ...joinedSessions.map(s => s.id),
    ];

    let playerCounts: Record<string, number> = {};
    if (allSessionIds.length > 0) {
      const { data: playerCountData } = await supabase
        .from('game_players')
        .select('session_id')
        .in('session_id', allSessionIds);

      if (playerCountData) {
        playerCounts = playerCountData.reduce((acc: Record<string, number>, p) => {
          acc[p.session_id] = (acc[p.session_id] || 0) + 1;
          return acc;
        }, {});
      }
    }

    // Combine and mark sessions with player count
    const allSessions = [
      ...(hostedSessions || []).map(s => ({ ...s, is_host: true, player_count: playerCounts[s.id] || 0 })),
      ...joinedSessions.map(s => ({ ...s, is_host: false, player_count: playerCounts[s.id] || 0 })),
    ];

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
      sessions: allSessions.length,
      searchedDomains: domainsToSearch,
      searchedCustomerIds: customerIdsToSearch,
    });

    return new Response(
      JSON.stringify({
        licenses: formattedLicenses,
        sessions: allSessions,
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
