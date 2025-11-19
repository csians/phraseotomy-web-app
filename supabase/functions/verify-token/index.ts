/**
 * Supabase Edge Function: Verify Signed Token
 * 
 * This function verifies a signed token from Shopify redirect.
 * Should be called when the app receives a token in the URL.
 */

const APP_SECRET = Deno.env.get('APP_SIGNING_SECRET')!;

interface TokenPayload {
  shop: string;
  exp: number;
}

async function verifySignedToken(token: string): Promise<TokenPayload | false> {
  try {
    const [payloadB64, sig] = token.split('.');
    if (!payloadB64 || !sig) return false;
    
    // Verify signature using HMAC-SHA256
    const encoder = new TextEncoder();
    const keyData = encoder.encode(APP_SECRET);
    const msgData = encoder.encode(payloadB64);
    
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    
    // Decode signature from base64url
    const sigBytes = Uint8Array.from(
      atob(sig.replace(/-/g, '+').replace(/_/g, '/')),
      c => c.charCodeAt(0)
    );
    
    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      sigBytes,
      msgData
    );
    
    if (!isValid) return false;
    
    // Decode payload
    const payloadStr = atob(
      payloadB64.replace(/-/g, '+').replace(/_/g, '/')
    );
    const payload: TokenPayload = JSON.parse(payloadStr);
    
    // Check expiration
    if (!payload.exp || Math.floor(Date.now() / 1000) > payload.exp) {
      return false;
    }
    
    return payload;
  } catch (e) {
    console.error('Token verification error:', e);
    return false;
  }
}

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token');
    
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Token is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const payload = verifySignedToken(token);
    
    if (!payload) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({ 
        valid: true,
        shop: payload.shop,
        expiresAt: payload.exp 
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error verifying token:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to verify token' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

