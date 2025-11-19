const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const APP_SECRET = Deno.env.get('APP_SIGNING_SECRET')!;
const SESSION_TTL_SECONDS = 3600; // 1 hour session validity

/**
 * Generate a signed session token for authenticated Shopify customers
 * This token is used for subsequent API calls to fetch customer data
 */
async function generateSessionToken(
  customerId: string,
  shopDomain: string
): Promise<string> {
  const expires = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = JSON.stringify({
    customer_id: customerId,
    shop: shopDomain,
    exp: expires,
  });

  const payloadB64 = btoa(payload)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

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

  const signature = await crypto.subtle.sign('HMAC', key, msgData);
  const sig = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  return `${payloadB64}.${sig}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { customerId, shopDomain } = await req.json();

    if (!customerId || !shopDomain) {
      return new Response(
        JSON.stringify({ error: 'Missing customerId or shopDomain' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const sessionToken = await generateSessionToken(customerId, shopDomain);

    return new Response(
      JSON.stringify({ sessionToken }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error generating session token:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to generate session token' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
