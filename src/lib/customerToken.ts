import { supabase } from '@/integrations/supabase/client';

const TOKEN_KEY = 'phraseotomy_customer_token';
const TOKEN_EXPIRY_KEY = 'phraseotomy_token_expiry';

/**
 * Store customer token in localStorage
 */
export function storeCustomerToken(token: string, expiresAt?: string) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    if (expiresAt) {
      localStorage.setItem(TOKEN_EXPIRY_KEY, expiresAt);
    }
    console.log('✅ Customer token stored');
  } catch (error) {
    console.error('Failed to store customer token:', error);
  }
}

/**
 * Get stored customer token
 */
export function getCustomerToken(): string | null {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
    
    if (!token) return null;
    
    // Check if token is expired
    if (expiry) {
      const expiryDate = new Date(expiry);
      if (new Date() > expiryDate) {
        console.log('⚠️ Customer token expired, clearing');
        clearCustomerToken();
        return null;
      }
    }
    
    return token;
  } catch (error) {
    console.error('Failed to get customer token:', error);
    return null;
  }
}

/**
 * Clear stored customer token
 */
export function clearCustomerToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_EXPIRY_KEY);
    console.log('🗑️ Customer token cleared');
  } catch (error) {
    console.error('Failed to clear customer token:', error);
  }
}

/**
 * Validate customer token with backend
 */
export async function validateCustomerToken(token: string): Promise<{
  valid: boolean;
  customerId?: string;
  shopDomain?: string;
  tenantId?: string;
  error?: string;
}> {
  try {
    const { data, error } = await supabase.functions.invoke('validate-customer-token', {
      body: { token },
    });

    if (error) {
      console.error('Token validation error:', error);
      return { valid: false, error: error.message };
    }

    return data;
  } catch (error) {
    console.error('Token validation failed:', error);
    return { valid: false, error: 'Validation request failed' };
  }
}

/**
 * Initialize customer token from URL parameters
 */
export function initializeTokenFromURL() {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('customerToken');
    
    if (token) {
      console.log('🔐 Customer token found in URL, storing...');
      storeCustomerToken(token);
      
      // Remove token from URL for security
      urlParams.delete('customerToken');
      const newUrl = `${window.location.pathname}${urlParams.toString() ? '?' + urlParams.toString() : ''}${window.location.hash}`;
      window.history.replaceState({}, '', newUrl);
    }
  } catch (error) {
    console.error('Failed to initialize token from URL:', error);
  }
}

/**
 * Get customer token for API requests
 * Returns the stored token or attempts to get it from URL
 */
export function getCustomerTokenForRequest(): string | null {
  // Try to get from storage first
  let token = getCustomerToken();
  
  // If not in storage, try URL
  if (!token) {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      token = urlParams.get('customerToken');
      
      if (token) {
        storeCustomerToken(token);
      }
    } catch (error) {
      console.error('Failed to get token from URL:', error);
    }
  }
  
  return token;
}
