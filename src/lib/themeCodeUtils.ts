// Example: Check if a theme code exists and what it unlocks
export async function checkThemeCode(code: string, tenantId: string) {
  const { data, error } = await supabase
    .from('theme_codes')
    .select(`
      *,
      theme_code_themes!inner (
        themes!inner (
          id,
          name,
          is_core
        )
      )
    `)
    .eq('code', code.toUpperCase())
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (error) {
    console.error('Error checking theme code:', error);
    return null;
  }

  return data;
}

// Example: Check customer's unlocked themes
export async function getCustomerThemes(customerId: string, shopDomain: string) {
  const { data, error } = await supabase
    .from('customer_theme_codes')
    .select(`
      theme_codes!inner (
        code,
        theme_code_themes!inner (
          themes!inner (
            id,
            name,
            is_core
          )
        )
      )
    `)
    .eq('customer_id', customerId)
    .eq('shop_domain', shopDomain)
    .eq('status', 'active');

  if (error) {
    console.error('Error getting customer themes:', error);
    return [];
  }

  return data;
}
