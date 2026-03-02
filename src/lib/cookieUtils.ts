/**
 * Shopify customer session cookie - set by Shopify when customer logs in.
 * Removed by Shopify when customer logs out.
 * Supports both flat format and nested customer_data format.
 */
const COOKIE_NAMES = ['_customer_session_from_shopify', 'customer_data'];

export interface ShopifyCustomerCookie {
  customer_id: string;
  customer_first_name?: string;
  customer_last_name?: string;
  customer_email?: string;
}

function extractFromParsed(parsed: Record<string, unknown>): ShopifyCustomerCookie | null {
  // Handle nested customer_data: {"customer_data": {"customer_id":"...", ...}}
  let data = parsed as Record<string, unknown>;
  if (parsed?.customer_data && typeof parsed.customer_data === 'object') {
    data = parsed.customer_data as Record<string, unknown>;
  }

  const customerId = data?.customer_id ?? data?.id;
  if (customerId && typeof customerId === 'string') {
    return {
      customer_id: customerId,
      customer_first_name: typeof data.customer_first_name === 'string' ? data.customer_first_name : (typeof data.first_name === 'string' ? data.first_name : undefined),
      customer_last_name: typeof data.customer_last_name === 'string' ? data.customer_last_name : (typeof data.last_name === 'string' ? data.last_name : undefined),
      customer_email: typeof data.customer_email === 'string' ? data.customer_email : (typeof data.email === 'string' ? data.email : undefined),
    };
  }
  return null;
}

/**
 * Parse the Shopify customer session cookie value.
 * Supports: {"customer_id":"...", ...} or {"customer_data": {"customer_id":"...", ...}}
 */
export function getCustomerFromShopifyCookie(): ShopifyCustomerCookie | null {
  if (typeof document === 'undefined') return null;

  const cookies = document.cookie.split(';');
  const cookieNamesFound = cookies.map((c) => c.split('=')[0]?.trim()).filter(Boolean);
  console.log('🍪 [cookieUtils] All cookie names (JS-accessible):', cookieNamesFound, '| Looking for:', COOKIE_NAMES, '| Note: HttpOnly cookies are NOT visible here');

  for (const cookie of cookies) {
    const eqIdx = cookie.indexOf('=');
    const cookieName = eqIdx >= 0 ? cookie.slice(0, eqIdx).trim() : '';
    const value = eqIdx >= 0 ? cookie.slice(eqIdx + 1).trim() : '';
    if (COOKIE_NAMES.includes(cookieName) && value) {
      console.log('🍪 [cookieUtils] Found matching cookie:', cookieName, 'value length:', value.length);
      try {
        const decoded = decodeURIComponent(value);
        const parsed = JSON.parse(decoded) as Record<string, unknown>;
        console.log('🍪 [cookieUtils] Parsed keys:', Object.keys(parsed));
        const result = extractFromParsed(parsed);
        if (result) {
          console.log('🍪 [cookieUtils] ✅ Extracted customer:', result.customer_id);
          return result;
        }
        console.log('🍪 [cookieUtils] No customer_id in parsed data');
      } catch (e) {
        console.log('🍪 [cookieUtils] Parse error:', e);
      }
      break;
    }
  }
  console.log('🍪 [cookieUtils] No customer cookie found');
  return null;
}

/**
 * Set customer_data cookie on the current domain (staging).
 * Used when we receive customer data via URL/postMessage so we can read it on subsequent visits.
 */
export function setCustomerDataCookie(customer: {
  id?: string;
  customer_id?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  first_name?: string;
  last_name?: string;
  customer_email?: string;
  customer_first_name?: string;
  customer_last_name?: string;
}): void {
  if (typeof document === 'undefined') return;
  const id = customer.customer_id || customer.id;
  if (!id) return;
  const payload = {
    customer_id: id,
    customer_email: customer.customer_email || customer.email,
    customer_first_name: customer.customer_first_name ?? customer.firstName ?? customer.first_name,
    customer_last_name: customer.customer_last_name ?? customer.lastName ?? customer.last_name,
  };
  const value = encodeURIComponent(JSON.stringify(payload));
  document.cookie = `customer_data=${value}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
}

/**
 * Clear customer_data cookie (e.g. on logout).
 */
export function clearCustomerDataCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = "customer_data=; path=/; max-age=0";
}
