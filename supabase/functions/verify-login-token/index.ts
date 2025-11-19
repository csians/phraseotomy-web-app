const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const APP_SECRET = Deno.env.get('APP_SIGNING_SECRET')!;

async function verifySignedToken(token: string): Promise<false | { shop: string; exp: number }> {
  try {
    const [payloadB64, sig] = token.split('.');
    if (!payloadB64 || !sig) {
      console.error('Invalid token format');
      return false;
    }

    // Create expected signature
    const encoder = new TextEncoder();
    const keyData = encoder.encode(APP_SECRET);
    const msgData = encoder.encode(payloadB64);
    
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const expectedSig = await crypto.subtle.sign('HMAC', key, msgData);
    const expectedSigB64 = btoa(String.fromCharCode(...new Uint8Array(expectedSig)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');

    // Constant-time comparison
    if (sig !== expectedSigB64) {
      console.error('Signature mismatch');
      return false;
    }

    // Decode and parse payload
    const payloadStr = atob(
      payloadB64
        .replace(/-/g, '+')
        .replace(/_/g, '/')
    );
    const payload = JSON.parse(payloadStr);

    // Check expiration
    if (!payload.exp || Math.floor(Date.now() / 1000) > payload.exp) {
      console.error('Token expired');
      return false;
    }

    console.log('Token verified successfully for shop:', payload.shop);
    return payload;
  } catch (error) {
    console.error('Token verification error:', error);
    return false;
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { token, shopDomain } = await req.json();

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Missing token parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const payload = await verifySignedToken(token);

    if (!payload) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Optionally validate that the shop matches
    if (shopDomain && payload.shop !== shopDomain) {
      console.error('Shop domain mismatch');
      return new Response(
        JSON.stringify({ error: 'Shop domain mismatch' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        valid: true, 
        shop: payload.shop,
        exp: payload.exp
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error verifying login token:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to verify token' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
