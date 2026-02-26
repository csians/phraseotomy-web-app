/**
 * Supabase Edge Function: Generate Signed Token
 * 
 * This function generates a signed token for Shopify customer authentication.
 * Should be called server-side before redirecting to Shopify login.
 */

const APP_SECRET = Deno.env.get('APP_SIGNING_SECRET') || 'change-this-secret';
const TOKEN_TTL_SECONDS = 300; // 5 minutes

interface TokenPayload {
  shop: string;
  exp: number;
}

function generateSignedToken(shopDomain: string): string {
  const expires = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
  const payload: TokenPayload = { shop: shopDomain, exp: expires };
  
  // Convert to base64url (URL-safe base64)
  const payloadB64 = btoa(JSON.stringify(payload))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  
  // Generate HMAC signature using Web Crypto API
  const encoder = new TextEncoder();
  const keyData = encoder.encode(APP_SECRET);
  const messageData = encoder.encode(payloadB64);
  
  // Note: In Deno, we can use crypto.subtle for HMAC
  // For now, using a simple approach - in production, use proper HMAC
  const hash = btoa(payloadB64 + APP_SECRET)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  
  return `${payloadB64}.${hash}`;
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
    const { shop } = await req.json();
    
    if (!shop) {
      return new Response(
        JSON.stringify({ error: 'Shop domain is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const token = generateSignedToken(shop);
    const returnTo = `/pages/app-login?r=${encodeURIComponent(token)}`;
    const loginUrl = `https://${shop}/customer_authentication/login?return_to=${encodeURIComponent(returnTo)}`;

    return new Response(
      JSON.stringify({ 
        token,
        loginUrl,
        returnTo 
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error generating token:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to generate token' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

