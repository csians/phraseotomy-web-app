/**
 * Shopify Customer API utilities
 * 
 * Functions to fetch customer data and metafields from Shopify
 */

export interface CustomerMetafield {
  id: string;
  namespace: string;
  key: string;
  value: string;
  type: string;
}

export interface CustomerProductAccess {
  packIds: string[];
  productIds: string[];
}

/**
 * Fetch customer metafields from Shopify
 * This should be called server-side via Edge Function
 */
export async function fetchCustomerMetafields(
  customerId: string,
  shopDomain: string,
  accessToken?: string
): Promise<CustomerMetafield[]> {
  try {
    // In production, call Edge Function to fetch metafields
    // The Edge Function will use Shopify Admin API with proper authentication
    if (import.meta.env.PROD && import.meta.env.VITE_SUPABASE_URL) {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-customer-metafields`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            customerId,
            shopDomain,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch customer metafields');
      }

      const data = await response.json();
      return data.metafields || [];
    }

    // Local development: Return mock data
    console.warn('Using mock metafields for local development');
    return [
      {
        id: 'mock-1',
        namespace: 'phraseotomy',
        key: 'assigned_packs',
        value: JSON.stringify(['base', 'expansion1']),
        type: 'list.single_line_text_field',
      },
    ];
  } catch (error) {
    console.error('Error fetching customer metafields:', error);
    return [];
  }
}

/**
 * Parse customer metafields to extract assigned packs/products
 */
export function parseCustomerAccess(metafields: CustomerMetafield[]): CustomerProductAccess {
  const packIds: string[] = [];
  const productIds: string[] = [];

  for (const metafield of metafields) {
    // Look for phraseotomy namespace
    if (metafield.namespace === 'phraseotomy') {
      if (metafield.key === 'assigned_packs' || metafield.key === 'packs') {
        try {
          const value = typeof metafield.value === 'string' 
            ? JSON.parse(metafield.value) 
            : metafield.value;
          
          if (Array.isArray(value)) {
            packIds.push(...value);
          } else if (typeof value === 'string') {
            // Comma-separated list
            packIds.push(...value.split(',').map(s => s.trim()));
          }
        } catch (e) {
          console.warn('Error parsing pack metafield:', e);
        }
      }

      if (metafield.key === 'assigned_products' || metafield.key === 'products') {
        try {
          const value = typeof metafield.value === 'string' 
            ? JSON.parse(metafield.value) 
            : metafield.value;
          
          if (Array.isArray(value)) {
            productIds.push(...value);
          } else if (typeof value === 'string') {
            productIds.push(...value.split(',').map(s => s.trim()));
          }
        } catch (e) {
          console.warn('Error parsing product metafield:', e);
        }
      }
    }
  }

  return {
    packIds: [...new Set(packIds)], // Remove duplicates
    productIds: [...new Set(productIds)],
  };
}

/**
 * Get available packs for customer based on metafields
 */
export async function getCustomerAvailablePacks(
  customerId: string,
  shopDomain: string
): Promise<string[]> {
  const metafields = await fetchCustomerMetafields(customerId, shopDomain);
  const access = parseCustomerAccess(metafields);
  
  // If no metafields, return all packs (or base pack only)
  if (access.packIds.length === 0) {
    return ['base']; // Default to base pack only
  }
  
  return access.packIds;
}

