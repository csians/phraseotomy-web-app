import { supabase } from '@/integrations/supabase/client';

export interface CustomerLicense {
  id: string;
  license_code_id: string;
  activated_at: string;
  status: string;
  code: string;
  packs_unlocked: string[];
  expires_at: string | null;
}

export interface GameSession {
  id: string;
  lobby_code: string;
  status: string;
  created_at: string;
  packs_used: string[];
}

/**
 * Get or retrieve a session token from localStorage
 * Session tokens are stored after Shopify authentication
 */
function getSessionToken(): string | null {
  return localStorage.getItem('phraseotomy_session_token');
}

/**
 * Fetch customer data from authenticated edge function
 */
async function fetchCustomerData(sessionToken: string): Promise<{
  licenses: CustomerLicense[];
  sessions: GameSession[];
} | null> {
  try {
    const { data, error } = await supabase.functions.invoke('get-customer-data', {
      body: { sessionToken },
    });

    if (error) {
      console.error('Error fetching customer data:', error);
      return null;
    }

    return {
      licenses: data.licenses || [],
      sessions: data.sessions || [],
    };
  } catch (error) {
    console.error('Error calling get-customer-data function:', error);
    return null;
  }
}

export async function getCustomerLicenses(
  customerId: string,
  shopDomain: string
): Promise<CustomerLicense[]> {
  const sessionToken = getSessionToken();
  
  if (!sessionToken) {
    console.error('No session token available');
    return [];
  }

  const data = await fetchCustomerData(sessionToken);
  return data?.licenses || [];
}

export async function getCustomerSessions(
  customerId: string,
  shopDomain: string
): Promise<GameSession[]> {
  const sessionToken = getSessionToken();
  
  if (!sessionToken) {
    console.error('No session token available');
    return [];
  }

  const data = await fetchCustomerData(sessionToken);
  return data?.sessions || [];
}
