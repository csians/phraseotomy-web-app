/**
 * Normalize customer ID to string format for consistent API usage.
 * Extracts numeric part from Shopify GID (gid://shopify/Customer/123) or returns string as-is.
 */
export function normalizeCustomerId(id: string | number | null | undefined): string {
  if (id == null) return "";
  const s = String(id);
  const gidMatch = s.match(/gid:\/\/shopify\/Customer\/(\d+)/);
  return gidMatch ? gidMatch[1] : s;
}

/**
 * Parse URL parameters from both before and after the hash
 * This handles both BrowserRouter and HashRouter cases
 */
export function getAllUrlParams(): URLSearchParams {
  const params = new URLSearchParams();
  
  // Get params before hash (e.g., ?shop=example.com#/login)
  if (window.location.search) {
    const beforeHash = new URLSearchParams(window.location.search);
    beforeHash.forEach((value, key) => {
      params.set(key, value);
    });
  }
  
  // Get params after hash (e.g., #/login?shop=example.com)
  if (window.location.hash.includes('?')) {
    const hashParts = window.location.hash.split('?');
    if (hashParts[1]) {
      const afterHash = new URLSearchParams(hashParts[1]);
      afterHash.forEach((value, key) => {
        params.set(key, value);
      });
    }
  }
  
  return params;
}
