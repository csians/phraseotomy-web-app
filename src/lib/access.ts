import { supabase } from '@/integrations/supabase/client';
import type { AccessStatus } from './types';

/**
 * Load access status for a given shop domain
 * 
 * TODO: Future Supabase Schema
 * 
 * CREATE TABLE public.access_codes (
 *   id uuid primary key default gen_random_uuid(),
 *   shop_domain text not null,
 *   redemption_code text unique not null,
 *   activated_at timestamp with time zone default now(),
 *   expires_at timestamp with time zone not null,
 *   is_active boolean default true,
 *   created_at timestamp with time zone default now()
 * );
 * 
 * CREATE TABLE public.pack_unlocks (
 *   id uuid primary key default gen_random_uuid(),
 *   access_code_id uuid references access_codes(id) on delete cascade,
 *   pack_name text not null,
 *   unlocked_at timestamp with time zone default now()
 * );
 * 
 * -- Enable RLS
 * ALTER TABLE public.access_codes ENABLE ROW LEVEL SECURITY;
 * ALTER TABLE public.pack_unlocks ENABLE ROW LEVEL SECURITY;
 * 
 * -- Policies (example - adjust based on auth strategy)
 * CREATE POLICY "Users can view their own access codes"
 *   ON public.access_codes FOR SELECT
 *   USING (shop_domain = current_setting('app.current_shop', true));
 */

/**
 * Load access status for the given shop domain
 * Currently returns mocked data based on tenant
 * 
 * @param shopDomain - The Shopify shop domain (e.g., "testing-cs-store.myshopify.com")
 * @returns AccessStatus with license info and unlocked packs
 */
export async function loadAccessStatus(shopDomain: string | null): Promise<AccessStatus> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 500));

  // Demo mode - no shop domain
  if (!shopDomain) {
    return {
      hasActiveLicense: false,
      licenseExpiresAt: null,
      unlockedPacks: [],
    };
  }

  // Staging tenant mock data
  if (shopDomain.includes('testing-cs-store')) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    
    return {
      hasActiveLicense: true,
      licenseExpiresAt: expiresAt,
      unlockedPacks: [],
      redemptionCode: 'STAGE-TEST-2024',
    };
  }

  // Production tenant mock data
  if (shopDomain.includes('phraseotomy')) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 90);
    
    return {
      hasActiveLicense: true,
      licenseExpiresAt: expiresAt,
      unlockedPacks: [],
      redemptionCode: 'PROD-GOLD-2024',
    };
  }

  // TODO: When Supabase schema is ready, replace mock with real query:
  // const { data: accessCode, error } = await supabase
  //   .from('access_codes')
  //   .select(`
  //     *,
  //     pack_unlocks (
  //       pack_name
  //     )
  //   `)
  //   .eq('shop_domain', shopDomain)
  //   .eq('is_active', true)
  //   .gte('expires_at', new Date().toISOString())
  //   .maybeSingle();
  //
  // if (error) throw error;
  // if (!accessCode) return { hasActiveLicense: false, ... };
  //
  // return {
  //   hasActiveLicense: true,
  //   licenseExpiresAt: new Date(accessCode.expires_at),
  //   unlockedPacks: accessCode.pack_unlocks.map(p => p.pack_name),
  //   redemptionCode: accessCode.redemption_code,
  // };

  // Default - no access
  return {
    hasActiveLicense: false,
    licenseExpiresAt: null,
    unlockedPacks: [],
  };
}
