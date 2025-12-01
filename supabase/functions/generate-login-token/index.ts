const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const APP_SECRET = Deno.env.get("APP_SIGNING_SECRET")!;
const TOKEN_TTL_SECONDS = 60;

async function generateSignedToken(shopDomain: string): Promise<string> {
  const expires = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
  const payload = JSON.stringify({ shop: shopDomain, exp: expires });

  const payloadB64 = btoa(payload).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");

  const encoder = new TextEncoder();
  const keyData = encoder.encode(APP_SECRET);
  const msgData = encoder.encode(payloadB64);

  const key = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);

  const signature = await crypto.subtle.sign("HMAC", key, msgData);
  const sig = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

  return `${payloadB64}.${sig}`;
}

function createShopLoginUrl(shopDomain: string, token: string): string {
  const returnTo = `/pages/app-redirect?r=${encodeURIComponent(token)}`;
  console.log("hiiii");
  console.log("shopDomainshopDomain", shopDomain);
  return `https://${shopDomain}/customer_authentication/login?return_to=${encodeURIComponent(returnTo)}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { shopDomain } = await req.json();

    if (!shopDomain) {
      return new Response(JSON.stringify({ error: "Missing shopDomain parameter" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = await generateSignedToken(shopDomain);
    const loginUrl = createShopLoginUrl(shopDomain, token);

    console.log("Generated login token for shop:", shopDomain);

    return new Response(JSON.stringify({ loginUrl, token }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error generating login token:", error);
    return new Response(JSON.stringify({ error: "Failed to generate login token" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
