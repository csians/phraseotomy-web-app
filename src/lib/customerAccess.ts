import { supabase } from '@/integrations/supabase/client';

export interface Pack {
  id: string;
  name: string;
  description: string | null;
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
}

export async function getCustomerLicenses(
  customerId: string,
  shopDomain: string
): Promise<CustomerLicense[]> {
  try {
    const { data, error } = await supabase.functions.invoke('get-customer-licenses-sessions', {
      body: { customerId, shopDomain },
    });

    if (error) {
      console.error('Error fetching customer licenses:', error);
      return [];
    }

    return data?.licenses || [];
  } catch (error) {
    console.error('Error calling get-customer-licenses-sessions function:', error);
    return [];
  }
}

export async function getCustomerSessions(
  customerId: string,
  shopDomain: string
): Promise<GameSession[]> {
  try {
    const { data, error } = await supabase.functions.invoke('get-customer-licenses-sessions', {
      body: { customerId, shopDomain },
    });

    if (error) {
      console.error('Error fetching customer sessions:', error);
      return [];
    }

    return data?.sessions || [];
  } catch (error) {
    console.error('Error calling get-customer-licenses-sessions function:', error);
    return [];
  }
}

export async function getCustomerAvailablePacks(
  customerId: string,
  shopDomain: string
): Promise<Pack[]> {
  try {
    const { data, error } = await supabase.functions.invoke('get-customer-licenses-sessions', {
      body: { customerId, shopDomain },
    });

    if (error) {
      console.error('Error fetching customer available packs:', error);
      return [];
    }

    return data?.availablePacks || [];
  } catch (error) {
    console.error('Error calling get-customer-licenses-sessions function:', error);
    return [];
  }
}
