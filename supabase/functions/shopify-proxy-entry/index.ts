import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/**
 * Verify Shopify HMAC signature for app proxy requests
 */
async function verifyShopifyHmac(queryParams: URLSearchParams, clientSecret: string): Promise<boolean> {
  const signature = queryParams.get("signature");
  if (!signature) {
    return false;
  }

  // Create a copy without the signature
  const paramsWithoutSignature = new URLSearchParams(queryParams);
  paramsWithoutSignature.delete("signature");

  // Sort and format parameters as Shopify expects
  const sortedParams = Array.from(paramsWithoutSignature.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("");

  // Generate HMAC
  const encoder = new TextEncoder();
  const keyData = encoder.encode(clientSecret);
  const messageData = encoder.encode(sortedParams);

  const cryptoKey = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);

  const signatureBuffer = await crypto.subtle.sign("HMAC", cryptoKey, messageData);
  const calculatedSignature = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return signature === calculatedSignature;
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const queryParams = url.searchParams;
  const shop = queryParams.get("shop");

  console.log("Proxy request received:", {
    shop,
    hasSignature: !!queryParams.get("signature"),
    hasCustomer: !!queryParams.get("logged_in_customer_id"),
  });

  // CORS headers for browser requests
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // If no shop parameter, return error
  if (!shop) {
    return new Response(JSON.stringify({ error: "No shop parameter", verified: false }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch tenant configuration (excluding secrets)
    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("id, name, tenant_key, shop_domain, environment, is_active")
      .eq("shop_domain", shop)
      .eq("is_active", true)
      .maybeSingle();

    if (tenantError) {
      console.error("Error fetching tenant:", tenantError);
      return new Response(JSON.stringify({ error: tenantError.message, verified: false }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!tenant) {
      console.log("Tenant not found for shop:", shop);
      return new Response(
        generateErrorHtml(
          "Tenant Not Found",
          `No active tenant found for shop: ${shop}. Please ensure the tenant is configured in Supabase with shop_domain matching exactly.`,
        ),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "text/html" },
        },
      );
    }

    // Fetch client secret and access token separately for HMAC verification and API calls
    const { data: secretData, error: secretError } = await supabase
      .from("tenants")
      .select("shopify_client_secret, access_token")
      .eq("shop_domain", shop)
      .single();

    if (secretError || !secretData) {
      console.error("Error fetching tenant credentials");
      return new Response(generateErrorHtml("Configuration Error", "Unable to verify request authenticity."), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "text/html" },
      });
    }

    // Verify HMAC signature
    const isValidSignature = await verifyShopifyHmac(queryParams, secretData.shopify_client_secret);

    if (!isValidSignature) {
      console.log("Invalid HMAC signature for shop:", shop);
      return new Response(
        generateErrorHtml(
          "Authentication Failed",
          "HMAC signature verification failed. Please check your Shopify Client Secret in the tenant configuration.",
        ),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "text/html" },
        },
      );
    }

    console.log("HMAC verified successfully for tenant:", tenant.tenant_key);

    // Check for guest join parameters FIRST
    const isGuestJoin = queryParams.get("guest") === "true";
    const guestLobbyCode = queryParams.get("lobbyCode");
    const guestDataStr = queryParams.get("guestData");

    if (isGuestJoin && guestLobbyCode && guestDataStr) {
      console.log("Guest join detected, processing...");
      
      try {
        const guestData = JSON.parse(guestDataStr);
        console.log("Guest data:", guestData);

        // Call join-lobby directly
        const { data: joinResult, error: joinError } = await supabase.functions.invoke(
          "join-lobby",
          {
            body: {
              lobbyCode: guestLobbyCode.toUpperCase(),
              playerName: guestData.name,
              playerId: guestData.player_id,
            },
          }
        );

        if (joinError) {
          console.error("Error joining lobby:", joinError);
          return new Response(
            generateErrorHtml("Failed to Join", `Could not join lobby: ${joinError.message}`),
            { status: 400, headers: { "Content-Type": "text/html" } }
          );
        }

        if (joinResult?.error) {
          console.error("Join lobby error:", joinResult.error);
          return new Response(
            generateErrorHtml("Failed to Join", joinResult.error),
            { status: 400, headers: { "Content-Type": "text/html" } }
          );
        }

        const sessionId = joinResult?.session?.id;
        if (!sessionId) {
          return new Response(
            generateErrorHtml("Failed to Join", "No session ID returned"),
            { status: 400, headers: { "Content-Type": "text/html" } }
          );
        }

        console.log("✅ Guest joined successfully, session:", sessionId);

        // Redirect directly to the lobby page on standalone app
        const baseUrl = "https://phraseotomy.ourstagingserver.com";
        const redirectUrl = `${baseUrl}/#/lobby/${sessionId}?guestData=${encodeURIComponent(guestDataStr)}&shop=${shop}`;
        
        return new Response(generateGuestRedirectHtml(redirectUrl, guestData.name, sessionId), {
          status: 200,
          headers: { "Content-Type": "text/html" },
        });
      } catch (error) {
        console.error("Error processing guest join:", error);
        return new Response(
          generateErrorHtml("Failed to Join", "Could not process guest join"),
          { status: 400, headers: { "Content-Type": "text/html" } }
        );
      }
    }

    // Extract customer ID from Shopify proxy parameters
    const customerId = queryParams.get("logged_in_customer_id") || null;

    // If no customer is logged in, show login page with guest option
    if (!customerId) {
      console.log("No customer logged in, showing login options");
      const loginUrl = `https://${shop}/account/login?return_url=/apps/phraseotomy`;

      return new Response(generateLoginRedirectHtml(loginUrl, shop), {
        status: 200,
        headers: { "Content-Type": "application/liquid" },
      });
    }

    let customerData = null;

    if (customerId && secretData.access_token) {
      // Fetch full customer data from Shopify API
      try {
        const shopifyResponse = await fetch(`https://${shop}/admin/api/2024-01/customers/${customerId}.json`, {
          headers: {
            "X-Shopify-Access-Token": secretData.access_token,
            "Content-Type": "application/json",
          },
        });

        if (shopifyResponse.ok) {
          const shopifyData = await shopifyResponse.json();
          const customer = shopifyData.customer;

          customerData = {
            id: customerId,
            email: customer.email || null,
            firstName: customer.first_name || null,
            lastName: customer.last_name || null,
            name: [customer.first_name, customer.last_name].filter(Boolean).join(" ") || customer.email || null,
          };

          console.log("✅ Customer data fetched from Shopify:", {
            id: customerData.id,
            email: customerData.email,
            name: customerData.name,
          });
        } else {
          console.warn("Failed to fetch customer from Shopify:", shopifyResponse.status);
          // Fallback to just ID
          customerData = {
            id: customerId,
            email: null,
            firstName: null,
            lastName: null,
            name: null,
          };
        }
      } catch (error) {
        console.error("Error fetching customer from Shopify:", error);
        // Fallback to just ID
        customerData = {
          id: customerId,
          email: null,
          firstName: null,
          lastName: null,
          name: null,
        };
      }
    }

    console.log("Customer data:", customerData ? `Logged in: ${customerId}` : "Not logged in");

    // Generate nonce for CSP
    const nonce = crypto.randomUUID();

    // Return HTML with application/liquid content type so Shopify renders it
    const headers = new Headers({
      "Content-Type": "application/liquid",
    });

    // Pass token and customer data to app
    return new Response(generateAppHtml(tenant, shop, customerData, nonce), {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("Error in shopify-proxy-entry:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return new Response(
      generateErrorHtml(
        "Server Error",
        `An error occurred: ${errorMessage}. Please check the Edge Function logs in Supabase.`,
      ),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "text/html" },
      },
    );
  }
});

/**
 * Generate login redirect HTML for unauthenticated users
 */
function generateLoginRedirectHtml(loginUrl: string, shop: string): string {
  const baseUrl = "https://phraseotomy.ourstagingserver.com";
  return `<style nonce="${crypto.randomUUID()}">
  body {
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: #0a0a0a;
    color: #fbbf24;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
  }
  .login-prompt {
    text-align: center;
    max-width: 400px;
    padding: 40px;
  }
  .logo {
    width: 80px;
    height: 80px;
    margin: 0 auto 24px;
    background: #fbbf24;
    border-radius: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 48px;
    font-weight: 900;
    color: #0a0a0a;
  }
  h1 {
    font-size: 32px;
    margin: 0 0 16px 0;
    font-weight: 800;
  }
  p {
    font-size: 16px;
    margin: 0 0 24px 0;
    opacity: 0.8;
  }
  .login-btn {
    display: inline-block;
    padding: 16px 32px;
    background: #fbbf24;
    color: #0a0a0a;
    text-decoration: none;
    border-radius: 8px;
    font-weight: 600;
    font-size: 16px;
    transition: transform 0.2s;
    width: 100%;
    box-sizing: border-box;
    border: none;
    cursor: pointer;
  }
  .login-btn:hover {
    transform: scale(1.05);
  }
  .divider {
    display: flex;
    align-items: center;
    margin: 24px 0;
    color: rgba(251, 191, 36, 0.5);
  }
  .divider::before,
  .divider::after {
    content: '';
    flex: 1;
    height: 1px;
    background: rgba(251, 191, 36, 0.3);
  }
  .divider span {
    padding: 0 16px;
    font-size: 14px;
  }
  .guest-section {
    margin-top: 16px;
  }
  .guest-btn {
    display: inline-block;
    padding: 14px 28px;
    background: transparent;
    color: #fbbf24;
    text-decoration: none;
    border-radius: 8px;
    font-weight: 600;
    font-size: 14px;
    transition: all 0.2s;
    border: 2px solid rgba(251, 191, 36, 0.5);
    cursor: pointer;
    width: 100%;
    box-sizing: border-box;
  }
  .guest-btn:hover {
    background: rgba(251, 191, 36, 0.1);
    border-color: #fbbf24;
  }
  .guest-form {
    display: none;
    margin-top: 16px;
  }
  .guest-form.active {
    display: block;
  }
  .guest-input {
    width: 100%;
    padding: 14px 16px;
    background: rgba(251, 191, 36, 0.1);
    border: 2px solid rgba(251, 191, 36, 0.3);
    border-radius: 8px;
    color: #fbbf24;
    font-size: 16px;
    text-align: center;
    font-weight: 600;
    box-sizing: border-box;
    margin-bottom: 12px;
  }
  .guest-input.lobby-code {
    letter-spacing: 4px;
  }
  .guest-input::placeholder {
    color: rgba(251, 191, 36, 0.5);
    letter-spacing: normal;
  }
  .guest-input:focus {
    outline: none;
    border-color: #fbbf24;
  }
  .input-label {
    font-size: 12px;
    color: rgba(251, 191, 36, 0.7);
    margin-bottom: 6px;
    text-align: left;
  }
  .join-btn {
    display: inline-block;
    padding: 14px 28px;
    background: #fbbf24;
    color: #0a0a0a;
    text-decoration: none;
    border-radius: 8px;
    font-weight: 600;
    font-size: 14px;
    transition: transform 0.2s;
    border: none;
    cursor: pointer;
    width: 100%;
    box-sizing: border-box;
  }
  .join-btn:hover {
    transform: scale(1.05);
  }
  .join-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
</style>
<div class="login-prompt">
  <div class="logo">P</div>
  <h1>PHRASEOTOMY</h1>
  <p>Log in to your account to host a game</p>
  <a href="${loginUrl}" class="login-btn">Log In</a>
  
  <div class="divider"><span>or</span></div>
  
  <div class="guest-section">
    <button class="guest-btn" onclick="toggleGuestForm()">Join Lobby Without Login</button>
    <div id="guestForm" class="guest-form">
      <div class="input-label">Your Name</div>
      <input 
        type="text" 
        id="guestName" 
        class="guest-input" 
        placeholder="Enter your name" 
        maxlength="50"
      />
      <div class="input-label">Lobby Code</div>
      <input 
        type="text" 
        id="lobbyCode" 
        class="guest-input lobby-code" 
        placeholder="Enter 6-digit lobby code" 
        maxlength="6"
        oninput="this.value = this.value.toUpperCase().replace(/[^A-Z0-9]/g, '')"
      />
      <button class="join-btn" onclick="joinAsGuest()" id="joinBtn" disabled>Join Game</button>
    </div>
  </div>
</div>
<script>
  function toggleGuestForm() {
    const form = document.getElementById('guestForm');
    form.classList.toggle('active');
    if (form.classList.contains('active')) {
      document.getElementById('guestName').focus();
    }
  }
  
  function validateForm() {
    const name = document.getElementById('guestName').value.trim();
    const code = document.getElementById('lobbyCode').value;
    document.getElementById('joinBtn').disabled = !name || code.length !== 6;
  }
  
  document.getElementById('guestName').addEventListener('input', validateForm);
  document.getElementById('lobbyCode').addEventListener('input', validateForm);
  
  function joinAsGuest() {
    const name = document.getElementById('guestName').value.trim();
    const code = document.getElementById('lobbyCode').value;
    if (name && code.length === 6) {
      const guestId = 'guest_' + Math.random().toString(36).substring(2, 11);
      const playerName = name + Math.floor(Math.random() * 900 + 100);
      const guestData = JSON.stringify({ player_id: guestId, name: playerName, is_guest: true });
      
      // Redirect to Shopify proxy with guest params
      const params = new URLSearchParams({
        lobbyCode: code,
        guestData: guestData,
        shop: '${shop}'
      });
      window.top.location.href = 'https://${shop}/apps/phraseotomy?guest=true&' + params.toString() + '#/lobby/join';
    }
  }
</script>`;
}

/**
 * Generate HTML that embeds the React app from custom domain
 */
function generateAppHtml(tenant: any, shop: string, customer: any = null, nonce: string): string {
  // Sanitize tenant data for embedding
  const tenantConfig = {
    id: tenant.id,
    name: tenant.name,
    tenant_key: tenant.tenant_key,
    shop_domain: tenant.shop_domain,
    environment: tenant.environment,
    verified: true,
  };

  // Use custom domain
  const baseUrl = "https://phraseotomy.ourstagingserver.com";

  // Encode configuration as URL parameters (before hash for HashRouter)
  const configParams = new URLSearchParams({
    config: JSON.stringify(tenantConfig),
    shop: shop,
    customer: customer ? JSON.stringify(customer) : "",
  });

  // For HashRouter, parameters must come before the hash
  const appUrl = `${baseUrl}/?${configParams.toString()}#/play/host`;

  // Return iframe embed with custom domain
  return `<style nonce="${nonce}">
  /* Hide Shopify theme header and footer */
  header,
  .header,
  .site-header,
  footer,
  .footer,
  .site-footer,
  .shopify-section-header,
  .shopify-section-footer,
  [data-section-type="header"],
  [data-section-type="footer"] {
    display: none !important;
  }
  
  /* Make body full viewport */
  body {
    margin: 0 !important;
    padding: 0 !important;
    overflow: hidden !important;
  }
  
  main,
  .main-content,
  #MainContent {
    margin: 0 !important;
    padding: 0 !important;
    max-width: 100% !important;
    width: 100% !important;
  }
  
  /* Full-page app container */
  .phraseotomy-wrapper {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    margin: 0;
    padding: 0;
    z-index: 9999;
    background: #0a0a0a;
  }
  
  .phraseotomy-frame {
    width: 100%;
    height: 100%;
    border: none;
    display: block;
  }
</style>
<div class="phraseotomy-wrapper">
  <iframe 
    class="phraseotomy-frame"
    src="${appUrl}"
    allow="camera; microphone; autoplay; fullscreen"
    title="Phraseotomy"
  ></iframe>
</div>`;
}

/**
 * Generate error HTML page
 */
function generateErrorHtml(title: string, message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Error - Phraseotomy</title>
    <style>
      body {
        font-family: system-ui, -apple-system, sans-serif;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        margin: 0;
        background: #0a0a0a;
        color: #fbbf24;
      }
      .error-container {
        text-align: center;
        padding: 2rem;
        max-width: 500px;
      }
      h1 {
        font-size: 3rem;
        margin: 0 0 1rem 0;
      }
      p {
        font-size: 1.125rem;
        margin: 0.5rem 0;
      }
      .message {
        background: rgba(251, 191, 36, 0.1);
        border: 1px solid rgba(251, 191, 36, 0.3);
        border-radius: 0.5rem;
        padding: 1rem;
        margin-top: 1.5rem;
      }
    </style>
  </head>
  <body>
    <div class="error-container">
      <h1>⚠️</h1>
      <h2>${title}</h2>
      <div class="message">
        <p>${message}</p>
      </div>
    </div>
  </body>
</html>`;
}

/**
 * Generate redirect HTML for guest users joining lobby
 */
function generateGuestRedirectHtml(redirectUrl: string, playerName: string, sessionId: string): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Joining Lobby - Phraseotomy</title>
    <style>
      body {
        font-family: system-ui, -apple-system, sans-serif;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        margin: 0;
        background: #0a0a0a;
        color: #fbbf24;
      }
      .container {
        text-align: center;
        padding: 2rem;
      }
      .logo {
        width: 64px;
        height: 64px;
        margin: 0 auto 24px;
        background: #fbbf24;
        border-radius: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 32px;
        font-weight: 900;
        color: #0a0a0a;
      }
      h1 {
        font-size: 1.5rem;
        margin: 0 0 0.5rem 0;
      }
      p {
        font-size: 1rem;
        margin: 0;
        opacity: 0.8;
      }
      .spinner {
        width: 24px;
        height: 24px;
        border: 3px solid rgba(251, 191, 36, 0.3);
        border-top-color: #fbbf24;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin: 24px auto 0;
      }
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="logo">P</div>
      <h1>Joining Lobby...</h1>
      <p>Welcome, ${playerName}!</p>
      <div class="spinner"></div>
    </div>
    <script>
      // Store guest data in localStorage before redirect
      localStorage.setItem('current_lobby_session', '${sessionId}');
      
      // Redirect to lobby
      setTimeout(function() {
        window.top.location.href = '${redirectUrl}';
      }, 500);
    </script>
  </body>
</html>`;
}
