export interface TenantConfig {
  id: "staging" | "prod";
  shopDomain: string;
  displayName: string;
  themeColor?: string;
  appDomains?: string[]; // Custom app domains for this tenant
  customShopDomains?: string[]; // Custom Shopify domains that map to shopDomain
  proxyPath?: string; // Shopify App Proxy path (e.g., "/apps/phraseotomy")
}

/**
 * Get the full app URL for a tenant (Shopify proxy URL for production)
 * @param shopDomain - The Shopify shop domain
 * @returns Full app URL or null
 */
export function getAppUrlForShop(shopDomain: string): string | null {
  const tenant = getTenantConfig(shopDomain);
  if (!tenant) return null;

  // For production with custom domains, use the Shopify proxy URL
  if (tenant.customShopDomains?.length && tenant.proxyPath) {
    return `https://${tenant.customShopDomains[0]}${tenant.proxyPath}`;
  }

  // Fallback to app domain
  if (tenant.appDomains?.length) {
    return `https://${tenant.appDomains[0]}`;
  }

  return null;
}

// Tenant configurations - Production only
const tenants: TenantConfig[] = [
  {
    id: "prod",
    shopDomain: "phraseotomy.com",
    displayName: "Phraseotomy",
    themeColor: "#FBBF24",
    appDomains: ["phraseotomy.com", "phraseotomy.ourstagingserver.com", "localhost"],
    customShopDomains: ["phraseotomy.com", "qxqtbf-21.myshopify.com"], // phraseotomy.com for redirects (user-facing)
    proxyPath: "/pages/play-online", // Shopify App Proxy path
  },
];

/**
 * Get tenant configuration based on shop domain
 * Supports both .myshopify.com domains and custom domains
 * @param shopDomain - The Shopify shop domain (e.g., "testing-cs-store.myshopify.com" or "phraseotomy.com")
 * @returns Tenant configuration or null if not found
 */
export function getTenantConfig(shopDomain: string): TenantConfig | null {
  const normalizedDomain = shopDomain.toLowerCase().trim();
  const tenant = tenants.find(
    (t) =>
      t.shopDomain.toLowerCase() === normalizedDomain ||
      t.customShopDomains?.some((domain) => domain.toLowerCase() === normalizedDomain),
  );

  return tenant || null;
}

/**
 * Resolve a custom shop domain to its .myshopify.com equivalent
 * @param shopDomain - Any shop domain (custom or .myshopify.com)
 * @returns The .myshopify.com domain or original if no mapping found
 */
export function resolveShopDomain(shopDomain: string): string {
  const tenant = getTenantConfig(shopDomain);
  return tenant?.shopDomain || shopDomain;
}

/**
 * Get all configured tenants
 * @returns Array of all tenant configurations
 */
export function getAllTenants(): TenantConfig[] {
  return [...tenants];
}

/**
 * Get tenant configuration based on current app domain
 * @param hostname - The current hostname (e.g., "app.phraseotomy.com")
 * @returns Tenant configuration or null if not found
 */
export function getTenantByAppDomain(hostname: string): TenantConfig | null {
  const normalizedHostname = hostname.toLowerCase().trim();
  const tenant = tenants.find((t) => t.appDomains?.some((domain) => normalizedHostname.includes(domain)));

  return tenant || null;
}

/**
 * Auto-detect tenant based on current environment
 * Prioritizes shop parameter over app domain for accurate tenant detection
 * @param searchParams - URLSearchParams object for shop parameter
 * @returns Tenant configuration or null if not found
 */
export function autoDetectTenant(searchParams?: URLSearchParams | string): TenantConfig | null {
  // First try to detect by shop parameter (most reliable for multi-tenant apps)
  if (searchParams) {
    const params = typeof searchParams === "string" ? new URLSearchParams(searchParams) : searchParams;
    const shop = params.get("shop");

    if (shop) {
      const tenantByShop = getTenantConfig(shop);
      if (tenantByShop) {
        console.log("🎯 Tenant detected by shop parameter:", {
          shop,
          tenant: tenantByShop.id,
        });
        return tenantByShop;
      }
    }
  }

  // Fallback to app domain detection
  const hostname = window.location.hostname;
  const tenantByDomain = getTenantByAppDomain(hostname);

  if (tenantByDomain) {
    console.log("🎯 Tenant detected by app domain:", {
      hostname,
      tenant: tenantByDomain.id,
      shopDomain: tenantByDomain.shopDomain,
    });
    return tenantByDomain;
  }

  return null;
}

/**
 * Get the primary app domain for a tenant based on shop domain
 * @param shopDomain - The Shopify shop domain (e.g., "phraseotomy.com")
 * @returns The primary app domain (e.g., "app.phraseotomy.com") or null
 */
export function getAppDomainForShop(shopDomain: string): string | null {
  const tenant = getTenantConfig(shopDomain);
  return tenant?.appDomains?.[0] || null;
}

/**
 * Check if current hostname matches the correct app domain for the shop
 * @param shopDomain - The Shopify shop domain
 * @returns true if we're on the correct domain for this shop
 */
export function isCorrectAppDomain(shopDomain: string): boolean {
  const tenant = getTenantConfig(shopDomain);
  if (!tenant?.appDomains) return true; // No restriction

  const currentHost = window.location.hostname.toLowerCase();
  return tenant.appDomains.some((domain) => currentHost.includes(domain.toLowerCase()));
}

/**
 * Extract shop domain from URL query parameters
 * @param searchParams - URLSearchParams object or search string
 * @returns Shop domain or null
 */
export function getShopFromParams(searchParams: URLSearchParams | string): string | null {
  const params = typeof searchParams === "string" ? new URLSearchParams(searchParams) : searchParams;

  return params.get("shop");
}
