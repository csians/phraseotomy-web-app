/**
 * Token Authentication Utilities
 * Provides token verification for Shopify customer login
 * 
 * SECURITY NOTE: Token generation and signing MUST only happen server-side
 * in edge functions. This file only contains verification helpers that call
 * secure edge functions.
 */

const TOKEN_TTL_SECONDS = 300; // 5 minutes

export interface TokenPayload {
  shop: string;
  exp: number;
}

/**
 * DEPRECATED: Token generation moved to server-side edge function
 * Use the 'generate-login-token' edge function instead
 * 
 * @deprecated Use edge function instead for security
 */
export async function generateSignedToken(shopDomain: string): Promise<string> {
  throw new Error('Client-side token generation is disabled for security. Use generate-login-token edge function.');
}

/**
 * DEPRECATED: Token verification moved to server-side edge function
 * Use the 'verify-login-token' edge function instead
 * 
 * @deprecated Use edge function instead for security
 */
export async function verifySignedToken(token: string): Promise<TokenPayload | false> {
  throw new Error('Client-side token verification is disabled for security. Use verify-login-token edge function.');
}

/**
 * Create a Shopify login URL with signed token
 * This should be called server-side in production
 */
export async function createShopLoginUrl(shopDomain: string): Promise<string> {
  const token = await generateSignedToken(shopDomain);
  const returnTo = `/pages/app-login?r=${encodeURIComponent(token)}`;
  return `https://${shopDomain}/customer_authentication/login?return_to=${encodeURIComponent(returnTo)}`;
}

/**
 * Verify token from URL parameter
 * Used in the Play page to verify tokens from Shopify redirect
 */
export async function verifyTokenFromUrl(): Promise<{ shop: string } | null> {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('r');
  
  if (!token) return null;
  
  const payload = await verifySignedToken(token);
  if (!payload) return null;
  
  return { shop: payload.shop };
}

