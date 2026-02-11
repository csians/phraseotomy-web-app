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

    // Run all database queries in parallel to reduce total time
    const [licensesResult, hostedSessionsResult, playerEntriesResult] = await Promise.all([
      // Fetch customer licenses - search across all related domains and customer IDs
      supabase
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
        .eq('status', 'active'),
      
      // Fetch hosted game sessions - search across all related domains and customer IDs
      supabase
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
        .limit(10),
      
      // Fetch joined game sessions (where user is a player but not the host)
      supabase
        .from('game_players')
        .select('session_id, player_id')
        .in('player_id', customerIdsToSearch)
    ]);

    const { data: licenses, error: licensesError } = licensesResult;
    const { data: hostedSessions, error: hostedError } = hostedSessionsResult;
    const { data: playerEntries, error: playerError } = playerEntriesResult;

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

    if (hostedError) {
      console.error('Error fetching hosted sessions:', hostedError);
    }

    if (playerError) {
      console.error('Error fetching player entries:', playerError);
    }

    // Get unique session IDs where user is a player
    const joinedSessionIds = [...new Set((playerEntries || []).map(p => p.session_id))];
    
    // Fetch joined sessions (exclude hosted ones) and get player counts in parallel
    const hostedIds = (hostedSessions || []).map(s => s.id);
    const nonHostedSessionIds = joinedSessionIds.filter(id => !hostedIds.includes(id));
    
    let joinedSessions: any[] = [];
    let playerCounts: Record<string, number> = {};
    
    if (nonHostedSessionIds.length > 0 || (hostedSessions || []).length > 0) {
      // Prepare the queries
      const parallelQueries: Promise<any>[] = [];
      
      // Query for joined sessions (only if there are non-hosted ones)
      if (nonHostedSessionIds.length > 0) {
        parallelQueries.push(
          supabase
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
            .limit(10)
        );
      } else {
        parallelQueries.push(Promise.resolve({ data: null, error: null }));
      }
      
      // Query for player counts for all sessions
      const allSessionIds = [
        ...(hostedSessions || []).map(s => s.id),
        ...nonHostedSessionIds,
      ];
      
      if (allSessionIds.length > 0) {
        parallelQueries.push(
          supabase
            .from('game_players')
            .select('session_id')
            .in('session_id', allSessionIds)
        );
      } else {
        parallelQueries.push(Promise.resolve({ data: null, error: null }));
      }
      
      const [joinedResult, playerCountResult] = await Promise.all(parallelQueries);
      
      if (joinedResult && joinedResult.data) {
        joinedSessions = joinedResult.data;
      }
      if (joinedResult && joinedResult.error) {
        console.error('Error fetching joined sessions:', joinedResult.error);
      }
      
      if (playerCountResult && playerCountResult.data) {
        playerCounts = playerCountResult.data.reduce((acc: Record<string, number>, p) => {
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

    // Transform licenses to match expected format and filter out expired ones
    const now = new Date();
    const formattedLicenses = (licenses || [])
      .map(license => {
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
      })
      .filter(license => {
        // Filter out expired licenses
        if (license.expires_at) {
          const expiryDate = new Date(license.expires_at);
          if (expiryDate < now) {
            console.log(`Filtering out expired license: ${license.id}, expired at: ${license.expires_at}`);
            return false; // Exclude expired license
          }
        }
        return true; // Include non-expired or never-expiring licenses
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
