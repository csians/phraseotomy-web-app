export interface TenantConfig {
  id: 'staging' | 'prod';
  shopDomain: string;
  displayName: string;
  themeColor?: string;
}

// Tenant configurations for different Shopify stores
const tenants: TenantConfig[] = [
  {
    id: 'staging',
    shopDomain: 'testing-cs-store.myshopify.com',
    displayName: 'Phraseotomy Staging',
    themeColor: '#FCD34D',
  },
  {
    id: 'prod',
    shopDomain: 'phraseotomy.myshopify.com',
    displayName: 'Phraseotomy',
    themeColor: '#FBBF24',
  },
];

/**
 * Get tenant configuration based on shop domain
 * @param shopDomain - The Shopify shop domain (e.g., "testing-cs-store.myshopify.com")
 * @returns Tenant configuration or null if not found
 */
export function getTenantConfig(shopDomain: string): TenantConfig | null {
  const normalizedDomain = shopDomain.toLowerCase().trim();
  const tenant = tenants.find(
    (t) => t.shopDomain.toLowerCase() === normalizedDomain
  );
  
  return tenant || null;
}

/**
 * Get all configured tenants
 * @returns Array of all tenant configurations
 */
export function getAllTenants(): TenantConfig[] {
  return [...tenants];
}

/**
 * Extract shop domain from URL query parameters
 * @param searchParams - URLSearchParams object or search string
 * @returns Shop domain or null
 */
export function getShopFromParams(searchParams: URLSearchParams | string): string | null {
  const params = typeof searchParams === 'string' 
    ? new URLSearchParams(searchParams) 
    : searchParams;
  
  return params.get('shop');
}
