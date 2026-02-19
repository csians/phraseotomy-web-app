import { supabase } from '@/integrations/supabase/client';

/** Customer details as returned from Shopify (get-customer-from-shopify API) */
export interface ShopifyCustomerDetails {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  name: string | null;
  phone: string | null;
  created_at: string | null;
  updated_at: string | null;
}

/**
 * Fetch customer details from Shopify by customer ID and shop domain.
 * Uses Shopify Admin API only (not Supabase).
 */
export async function getCustomerFromShopify(
  customerId: string,
  shopDomain: string
): Promise<ShopifyCustomerDetails | null> {
  try {
    const { data, error } = await supabase.functions.invoke('get-customer-from-shopify', {
      body: { customerId, shopDomain },
    });
    if (error) {
      console.error('Error fetching customer from Shopify:', error);
      return null;
    }
    return data?.customer ?? null;
  } catch (e) {
    console.error('Error calling get-customer-from-shopify:', e);
    return null;
  }
}

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
  game_name?: string | null;
  host_customer_name?: string | null;
  is_host: boolean;
  player_count?: number;
}
 
export type CustomerData = {
  customer?: {
    id: string;
    email: string | null;
    name: string | null;
    first_name: string | null;
    last_name: string | null;
  };
  licenses: CustomerLicense[];
  sessions: GameSession[];
}

export async function getCustomerData(
  customerId: string,
  shopDomain: string
): Promise<CustomerData> {
  try {
    const { data, error } = await supabase.functions.invoke('get-customer-licenses-sessions', {
      body: { customerId, shopDomain },
    });

    if (error) {
      console.error('Error fetching customer data:', error);
      return { licenses: [], sessions: [] };
    }

    return {
      licenses: data?.licenses || [],
      sessions: data?.sessions || [],
      customer: data?.customer || undefined,
    };
  } catch (error) {
    console.error('Error calling get-customer-licenses-sessions function:', error);
    return { licenses: [], sessions: [] };
  }
}

export async function getCustomerLicenses(
  customerId: string,
  shopDomain: string
): Promise<CustomerLicense[]> {
  const data = await getCustomerData(customerId, shopDomain);
  return data.licenses;
}

export async function getCustomerSessions(
  customerId: string,
  shopDomain: string
): Promise<GameSession[]> {
  const data = await getCustomerData(customerId, shopDomain);
  return data.sessions;
}
