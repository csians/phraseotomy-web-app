import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

export type Tenant = Tables<'tenants'>;

export function useTenant(shopDomain: string | null) {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!shopDomain) {
      setTenant(null);
      setLoading(false);
      setError(null);
      return;
    }

    const fetchTenant = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data, error: fetchError } = await supabase
          .from('tenants')
          .select('*')
          .eq('shop_domain', shopDomain)
          .eq('is_active', true)
          .maybeSingle();

        if (fetchError) {
          console.error('Error fetching tenant:', fetchError);
          setError(fetchError.message);
          setTenant(null);
        } else {
          setTenant(data);
        }
      } catch (err) {
        console.error('Error fetching tenant:', err);
        setError('Failed to load tenant configuration');
        setTenant(null);
      } finally {
        setLoading(false);
      }
    };

    fetchTenant();
  }, [shopDomain]);

  return { tenant, loading, error };
}
