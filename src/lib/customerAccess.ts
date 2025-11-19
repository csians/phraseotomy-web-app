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

export async function getCustomerLicenses(
  customerId: string,
  shopDomain: string
): Promise<CustomerLicense[]> {
  const { data, error } = await supabase
    .from('customer_licenses')
    .select(`
      id,
      license_code_id,
      activated_at,
      status,
      license_codes!inner (
        code,
        packs_unlocked,
        expires_at
      )
    `)
    .eq('customer_id', customerId)
    .eq('shop_domain', shopDomain)
    .eq('status', 'active');

  if (error) {
    console.error('Error fetching customer licenses:', error);
    return [];
  }

  return (data || []).map((item: any) => ({
    id: item.id,
    license_code_id: item.license_code_id,
    activated_at: item.activated_at,
    status: item.status,
    code: item.license_codes.code,
    packs_unlocked: item.license_codes.packs_unlocked,
    expires_at: item.license_codes.expires_at,
  }));
}

export async function getCustomerSessions(
  customerId: string,
  shopDomain: string
): Promise<GameSession[]> {
  const { data, error } = await supabase
    .from('game_sessions')
    .select('*')
    .eq('host_customer_id', customerId)
    .eq('shop_domain', shopDomain)
    .in('status', ['waiting', 'in_progress'])
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching game sessions:', error);
    return [];
  }

  return data || [];
}
