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
  
  // Extract route from URL path (e.g., /apps/phraseotomy/redeem-code -> /redeem-code)
  const pathParts = url.pathname.split('/').filter(p => p);
  let targetRoute = "/play/host"; // default route
  if (pathParts.length > 2 && pathParts[0] === 'apps' && pathParts[1] === 'phraseotomy') {
    // Extract route after /apps/phraseotomy
    const routePart = pathParts.slice(2).join('/');
    if (routePart) {
      targetRoute = `/${routePart}`;
    }
  }
  console.log("🔍 [ROUTE_DETECTION] URL path:", url.pathname, "-> Target route:", targetRoute);

  console.log("Proxy request received:", {
    shop,
    hasSignature: !!queryParams.get("signature"),
    hasCustomer: !!queryParams.get("logged_in_customer_id"),
  });

  console.log("🔍 [PROXY_PARAMS] All query parameters:");
  for (const [key, value] of queryParams.entries()) {
    if (key !== "signature") {
      // Don't log the signature itself
      console.log(`  ${key}: ${value}`);
    }
  }

  const loggedInCustomerId = queryParams.get("logged_in_customer_id");
  console.log("🔍 [CUSTOMER_ID] logged_in_customer_id from Shopify:", loggedInCustomerId);

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

  // Custom domain mapping: Shopify always sends the .myshopify.com domain
  // Map known Shopify domains to custom domains used in tenant table
  const shopDomainMapping: Record<string, string> = {
    "qxqtbf-21.myshopify.com": "phraseotomy.com",
    "testing-cs-store.myshopify.com": "testing-cs-store.myshopify.com", // staging stays as-is
  };

  const effectiveShopDomain = shopDomainMapping[shop] || shop;
  console.log("🔍 [DOMAIN_MAPPING] shop:", shop, "-> effectiveShopDomain:", effectiveShopDomain);

  try {
    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch tenant configuration - try effective domain first, then original
    let tenant = null;
    let tenantError = null;

    // Try with mapped domain first
    const { data: tenantData, error: error1 } = await supabase
      .from("tenants")
      .select("id, name, tenant_key, shop_domain, environment, is_active")
      .eq("shop_domain", effectiveShopDomain)
      .eq("is_active", true)
      .maybeSingle();

    if (tenantData) {
      tenant = tenantData;
    } else if (effectiveShopDomain !== shop) {
      // Fallback to original shop domain if mapping didn't work
      console.log("🔍 [DOMAIN_MAPPING] Trying original shop domain as fallback");
      const { data: fallbackData, error: error2 } = await supabase
        .from("tenants")
        .select("id, name, tenant_key, shop_domain, environment, is_active")
        .eq("shop_domain", shop)
        .eq("is_active", true)
        .maybeSingle();
      
      tenant = fallbackData;
      tenantError = error2;
    } else {
      tenantError = error1;
    }

    if (tenantError) {
      console.error("Error fetching tenant:", tenantError);
      return new Response(JSON.stringify({ error: tenantError.message, verified: false }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!tenant) {
      console.log("Tenant not found for shop:", shop, "or", effectiveShopDomain);
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

    // Use tenant's shop_domain for subsequent queries (the one from DB)
    const tenantShopDomain = tenant.shop_domain;
    console.log("🔍 [TENANT_FOUND] Using tenant shop_domain:", tenantShopDomain);

    // Fetch client secret and access token using the tenant's actual shop_domain
    const { data: secretData, error: secretError } = await supabase
      .from("tenants")
      .select("shopify_client_secret, access_token")
      .eq("shop_domain", tenantShopDomain)
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


    // Extract customer ID and other data from Shopify proxy parameters
    const customerId = queryParams.get("logged_in_customer_id") || null;
    const customerNameFromProxy = queryParams.get("customer_name") || null;
    const customerEmailFromProxy = queryParams.get("customer_email") || null;
    
    console.log("🔍 [CUSTOMER_ID] Extracted customerId:", customerId);
    console.log("🔍 [CUSTOMER_ID] customer_name from proxy:", customerNameFromProxy);
    console.log("🔍 [CUSTOMER_ID] customer_email from proxy:", customerEmailFromProxy);
    console.log("🔍 [CUSTOMER_ID] Will fetch from Shopify API with this ID:", customerId);

    // If no customer is logged in, show login page
    if (!customerId) {
      console.log("No customer logged in, showing login page");
      const loginUrl = `https://${shop}/customer_authentication/login?return_to=/pages/app-redirect`;

      return new Response(generateLoginRedirectHtml(loginUrl, shop, tenant.environment), {
        status: 200,
        headers: { "Content-Type": "application/liquid" },
      });
    }

    // Parse name from proxy params
    const proxyFirstName = customerNameFromProxy ? customerNameFromProxy.split(' ')[0] : null;
    const proxyLastName = customerNameFromProxy ? customerNameFromProxy.split(' ').slice(1).join(' ') || null : null;

    let customerData = null;

    if (customerId && secretData.access_token) {
      // Fetch full customer data from Shopify API
      try {
        const apiUrl = `https://${shop}/admin/api/2024-01/customers/${customerId}.json`;
        console.log("🔍 [SHOPIFY_API] Fetching customer from:", apiUrl);
        console.log("🔍 [SHOPIFY_API] Has access token:", !!secretData.access_token);

        const shopifyResponse = await fetch(apiUrl, {
          headers: {
            "X-Shopify-Access-Token": secretData.access_token,
            "Content-Type": "application/json",
          },
        });

        console.log("🔍 [SHOPIFY_API] Response status:", shopifyResponse.status);
        console.log("🔍 [SHOPIFY_API] Response ok:", shopifyResponse.ok);

        if (shopifyResponse.ok) {
          const responseText = await shopifyResponse.text();
          console.log("🔍 [SHOPIFY_API] Raw response (first 500 chars):", responseText.substring(0, 500));

          const shopifyData = JSON.parse(responseText);
          const customer = shopifyData.customer;

          console.log("🔍 [SHOPIFY_API] Parsed customer object:", {
            id: customer?.id,
            email: customer?.email,
            first_name: customer?.first_name,
            last_name: customer?.last_name,
          });

          // Use Shopify API data with proxy params as fallback
          const firstName = customer?.first_name || proxyFirstName;
          const lastName = customer?.last_name || proxyLastName;
          const email = customer?.email || customerEmailFromProxy;
          // Don't fall back to email for name - name should be null if there's no actual name
          const name = [firstName, lastName].filter(Boolean).join(" ") || customerNameFromProxy || null;

          customerData = {
            id: customerId,
            email: email,
            firstName: firstName,
            lastName: lastName,
            name: name,
          };

          console.log("✅ Customer data fetched from Shopify (with proxy fallback):", {
            id: customerData.id,
            email: customerData.email,
            name: customerData.name,
            firstName: customerData.firstName,
            lastName: customerData.lastName,
          });
          console.log("🔍 [CUSTOMER_DATA] Full customerData object being passed to app:", JSON.stringify(customerData));
        } else {
          const errorText = await shopifyResponse.text();
          console.warn("❌ Failed to fetch customer from Shopify. Status:", shopifyResponse.status);
          console.warn("❌ Error response:", errorText);
          // Fallback to proxy params
          customerData = {
            id: customerId,
            email: customerEmailFromProxy,
            firstName: proxyFirstName,
            lastName: proxyLastName,
            name: customerNameFromProxy,
          };
          console.log("🔄 Using proxy params as fallback:", customerData);
        }
      } catch (error) {
        console.error("❌ Error fetching customer from Shopify:", error);
        console.error("❌ Error details:", error instanceof Error ? error.message : String(error));
        // Fallback to proxy params
        customerData = {
          id: customerId,
          email: customerEmailFromProxy,
          firstName: proxyFirstName,
          lastName: proxyLastName,
          name: customerNameFromProxy,
        };
        console.log("🔄 Using proxy params as fallback:", customerData);
      }
    } else if (customerId) {
      // No access token, use proxy params directly
      customerData = {
        id: customerId,
        email: customerEmailFromProxy,
        firstName: proxyFirstName,
        lastName: proxyLastName,
        name: customerNameFromProxy,
      };
      console.log("🔄 No access token, using proxy params:", customerData);
    }

    console.log("Customer data:", customerData ? `Logged in: ${customerId}` : "Not logged in");

    // Generate nonce for CSP
    const nonce = crypto.randomUUID();

    // Return HTML with application/liquid content type so Shopify renders it
    const headers = new Headers({
      "Content-Type": "application/liquid",
    });

    // Pass token and customer data to app
    return new Response(generateAppHtml(tenant, shop, customerData, nonce, null, targetRoute), {
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
function generateLoginRedirectHtml(loginUrl: string, shop: string, environment: string): string {
  console.log("hiiii");
  // Choose base URL based on tenant environment
  const baseUrl =
    tenant.environment === "production"
      ? "https://phraseotomy.com/apps/phraseotomy"
      : "https://phraseotomy.ourstagingserver.com";
  return `<style nonce="${crypto.randomUUID()}">
  #header-group,.header-group, footer, header {
    display: none !important;
  }
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
</style>
<div class="login-prompt">
  <div class="logo">P</div>
  <h1>PHRASEOTOMY</h1>
  <p>Log in to your account to play the game</p>
  <a href="${loginUrl}" class="login-btn">Log In</a>
</div>`;
}

/**
 * Generate HTML that embeds the React app from custom domain
 */
function generateAppHtml(
  tenant: any,
  shop: string,
  customer: any = null,
  nonce: string,
  guestSession: string | null = null,
  targetRoute: string = "/play/host",
): string {
  // Sanitize tenant data for embedding
  const tenantConfig = {
    id: tenant.id,
    name: tenant.name,
    tenant_key: tenant.tenant_key,
    shop_domain: tenant.shop_domain,
    environment: tenant.environment,
    verified: true,
  };

  // Use staging domain for both environments
  // const baseUrl = "https://phraseotomy.com/apps/phraseotomy";
  const baseUrl = "https://phraseotomy.ourstagingserver.com";

  // Encode configuration as URL parameters (before hash for HashRouter)
  const configParams = new URLSearchParams({
    config: JSON.stringify(tenantConfig),
    shop: tenant.shop_domain, // Use tenant's shop_domain (phraseotomy.com)
  });

  // Add individual customer params for frontend compatibility
  if (customer) {
    configParams.set("customer", JSON.stringify(customer));
    if (customer.id) configParams.set("customer_id", customer.id);
    if (customer.email) configParams.set("customer_email", customer.email);
    if (customer.name) configParams.set("customer_name", customer.name);
  }

  // If guest session provided, add it to params
  if (guestSession) {
    configParams.set("guestSession", guestSession);
  }

  // Determine the route - if guest session, go to lobby; otherwise use targetRoute
  const route = guestSession ? `/lobby/${guestSession}` : targetRoute;

  // For HashRouter, parameters must come before the hash
  const appUrl = `${baseUrl}/?${configParams.toString()}#${route}`;

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
