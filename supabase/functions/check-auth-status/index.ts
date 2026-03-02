/**
 * Check Auth Status API
 *
 * Verifies if the user is logged in (has a valid session token from Shopify login flow).
 * Call from browser with your phraseotomy_session_token to check auth status.
 *
 * Request: { sessionToken: string }
 * Response: { loggedIn: boolean, customer?: { id }, shop?: string, error?: string }
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const APP_SECRET = Deno.env.get('APP_SIGNING_SECRET')!;

async function verifySessionToken(token: string): Promise<{
  customer_id: string;
  shop: string;
  exp: number;
} | null> {
  try {
    const [payloadB64, signature] = token.split('.');
    if (!payloadB64 || !signature) return null;

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
    const signatureBytes = Uint8Array.from(
      atob(signature.replace(/-/g, '+').replace(/_/g, '/') + '=='.slice(0, (4 - signature.length % 4) % 4)),
      (c) => c.charCodeAt(0)
    );
    const isValid = await crypto.subtle.verify('HMAC', key, signatureBytes, msgData);
    if (!isValid) return null;

    const payload = JSON.parse(
      atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/') + '=='.slice(0, (4 - payloadB64.length % 4) % 4))
    );
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) return null;

    return payload;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const sessionToken = body.sessionToken || body.session_token;

    if (!sessionToken) {
      return new Response(
        JSON.stringify({ loggedIn: false, error: 'No session token provided' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const payload = await verifySessionToken(sessionToken);
    if (!payload) {
      return new Response(
        JSON.stringify({ loggedIn: false, error: 'Invalid or expired token' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        loggedIn: true,
        customer: { id: payload.customer_id },
        shop: payload.shop,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('check-auth-status error:', err);
    return new Response(
      JSON.stringify({ loggedIn: false, error: 'Server error' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
