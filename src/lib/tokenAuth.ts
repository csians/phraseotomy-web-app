/**
 * Token-based authentication for Shopify customer login
 * 
 * This module handles generating and verifying signed tokens for secure
 * customer authentication redirects.
 */

// For local development, use a simple secret
// In production, this should come from environment variables
const APP_SECRET = import.meta.env.VITE_APP_SIGNING_SECRET || 'local-dev-secret-change-in-production';
const TOKEN_TTL_SECONDS = 60; // 60 seconds expiry

export interface TokenPayload {
  shop: string;
  exp: number;
}

/**
 * Generate a signed token for a shop domain
 * This should be called server-side (Edge Function) in production
 * For local dev, we provide a client-side version using Web Crypto API
 */
export async function generateSignedToken(shopDomain: string): Promise<string> {
  const expires = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
  const payload: TokenPayload = { shop: shopDomain, exp: expires };
  
  // Convert to base64url (URL-safe base64)
  const payloadB64 = btoa(JSON.stringify(payload))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  
  // Generate HMAC signature using Web Crypto API (same method as verification)
  try {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(APP_SECRET);
    const messageData = encoder.encode(payloadB64);
    
    // Import key for HMAC
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    // Sign the payload
    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    const signatureArray = Array.from(new Uint8Array(signatureBuffer));
    const signatureB64 = btoa(String.fromCharCode(...signatureArray))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
    
    return `${payloadB64}.${signatureB64}`;
  } catch (error) {
    console.error('Error generating token with Web Crypto, using fallback:', error);
    // Fallback for environments without Web Crypto API
    const hash = btoa(payloadB64 + APP_SECRET)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
    return `${payloadB64}.${hash}`;
  }
}

/**
 * Verify a signed token
 * Returns the payload if valid, false otherwise
 */
export async function verifySignedToken(token: string): Promise<TokenPayload | false> {
  try {
    const [payloadB64, sig] = token.split('.');
    if (!payloadB64 || !sig) return false;
    
    // Verify signature - try both methods for compatibility
    let signatureValid = false;
    
    // Method 1: Try Web Crypto API HMAC (new method)
    try {
      const encoder = new TextEncoder();
      const keyData = encoder.encode(APP_SECRET);
      const messageData = encoder.encode(payloadB64);
      
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      
      const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
      const signatureArray = Array.from(new Uint8Array(signatureBuffer));
      const expectedSig = btoa(String.fromCharCode(...signatureArray))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
      
      if (sig === expectedSig) {
        signatureValid = true;
      }
    } catch (error) {
      console.warn('Web Crypto API not available, trying fallback method');
    }
    
    // Method 2: Try simple hash method (old/fallback method)
    if (!signatureValid) {
      const expectedHash = btoa(payloadB64 + APP_SECRET)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
      
      if (sig === expectedHash) {
        signatureValid = true;
      }
    }
    
    if (!signatureValid) {
      console.warn('Token signature mismatch - tried both methods:', {
        received: sig.substring(0, 30) + '...',
        secretLength: APP_SECRET.length,
        secretUsed: APP_SECRET.substring(0, 10) + '...',
      });
      return false;
    }
    
    // Decode payload
    const payloadStr = atob(
      payloadB64.replace(/-/g, '+').replace(/_/g, '/')
    );
    const payload: TokenPayload = JSON.parse(payloadStr);
    
    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (!payload.exp) {
      console.warn('Token has no expiration');
      return false;
    }
    
    if (now > payload.exp) {
      console.warn('Token expired:', {
        expiredAt: new Date(payload.exp * 1000).toISOString(),
        currentTime: new Date(now * 1000).toISOString(),
        secondsAgo: now - payload.exp,
      });
      return false;
    }
    
    return payload;
  } catch (e) {
    console.error('Token verification error:', e);
    return false;
  }
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

