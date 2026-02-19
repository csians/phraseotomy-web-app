import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getAppBridge } from "@/lib/appBridge";
import { Redirect } from "@shopify/app-bridge/actions";
import { DebugInfo } from "@/components/DebugInfo";
import type { TenantConfig } from "@/lib/types";
import { getAllUrlParams } from "@/lib/urlUtils";

/**
 * Generate and store a session token for authenticated customer
 */
async function generateAndStoreSessionToken(customerId: string, shopDomain: string): Promise<void> {
  try {
    const { data, error } = await supabase.functions.invoke("generate-session-token", {
      body: { customerId, shopDomain },
    });

    if (error) {
      console.error("Error generating session token:", error);
      return;
    }

    if (data?.sessionToken) {
      localStorage.setItem("phraseotomy_session_token", data.sessionToken);
    }
  } catch (error) {
    console.error("Error calling generate-session-token:", error);
  }
}

const Login = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [shopDomain, setShopDomain] = useState<string | null>(null);
  const [tenant, setTenant] = useState<TenantConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const urlParams = getAllUrlParams();
    // Check for embedded config from proxy (primary method)
    if (window.__PHRASEOTOMY_CONFIG__ && window.__PHRASEOTOMY_SHOP__) {
      setTenant(window.__PHRASEOTOMY_CONFIG__);
      setShopDomain(window.__PHRASEOTOMY_SHOP__);
      const customerData = window.__PHRASEOTOMY_CUSTOMER__ || null;

      // If customer is already logged in, break out of iframe to standalone app
      if (customerData) {
        console.log("Customer already logged in, breaking out of iframe to standalone app");

        // Store customer data
        localStorage.setItem(
          "customerData",
          JSON.stringify({
            customer_id: customerData.id,
            id: customerData.id,
            email: customerData.email,
            name: customerData.name,
            first_name: customerData.firstName,
            last_name: customerData.lastName,
          }),
        );

        // Generate session token and redirect appropriately
        generateAndStoreSessionToken(customerData.id, window.__PHRASEOTOMY_SHOP__)
          .then(async () => {
            // Import tenant utilities
            const { getAppUrlForShop, getTenantConfig } = await import("@/lib/tenants");
            const tenant = getTenantConfig(window.__PHRASEOTOMY_SHOP__);

            // For production: full-page redirect to play-online (no #/play/host in URL)
            if (tenant?.customShopDomains?.length) {
              const playOnlineUrl = `https://${tenant.customShopDomains[0]}/pages/play-online`;
              console.log("🚀 Redirecting to play-online (top window):", playOnlineUrl);
              window.top!.location.href = playOnlineUrl;
            } else {
              // Staging or no proxy - stay on current domain
              if (window.self !== window.top) {
                window.location.href = `${window.location.origin}${window.location.pathname}#/play/host`;
              } else {
                navigate("/play/host", { replace: true });
              }
            }
          })
          .finally(() => {
            setLoading(false);
          });
        return;
      }

      setLoading(false);
      return;
    }

    // Check sessionStorage first for params (cleaned at app level), then fall back to URL params
    const pendingLoginParams = sessionStorage.getItem('pending_login_params');
    let shopParam = urlParams.get("shop");
    let customerIdParam = urlParams.get("customer_id");
    let customerNameParam = urlParams.get("customer_name");
    let customerEmailParam = urlParams.get("customer_email");
    let token = urlParams.get("r");
    
    // Use pending params from sessionStorage if available (URL was cleaned at app level)
    if (pendingLoginParams) {
      try {
        const parsed = JSON.parse(pendingLoginParams);
        shopParam = parsed.shop || shopParam;
        customerIdParam = parsed.customer_id || customerIdParam;
        customerNameParam = parsed.customer_name || customerNameParam;
        customerEmailParam = parsed.customer_email || customerEmailParam;
        token = parsed.r || token;
        console.log("📦 Using pending login params from sessionStorage:", parsed);
        // Clear after use
        sessionStorage.removeItem('pending_login_params');
      } catch (e) {
        console.error("Failed to parse pending login params:", e);
      }
    }

    console.log(customerNameParam);

    // Handle direct login with shop and customer_id (no token)
    if (shopParam && customerIdParam && !token) {
      console.log("🔄 Direct login detected with shop and customer_id");
      
      const handleDirectLogin = async () => {
        try {
          // Resolve custom domain to .myshopify.com domain
          const { resolveShopDomain } = await import("@/lib/tenants");

          const resolvedShopDomain = resolveShopDomain(shopParam);

          console.log("🔍 Resolving shop domain:", {
            original: shopParam,
            resolved: resolvedShopDomain,
          });

          // Load tenant for the shop
          const { data: dbTenant } = await supabase
            .from("tenants")
            .select("id, name, tenant_key, shop_domain, environment")
            .eq("shop_domain", resolvedShopDomain)
            .eq("is_active", true)
            .maybeSingle();

          if (!dbTenant) {
            console.error("Tenant not found for shop:", {
              original: shopParam,
              resolved: resolvedShopDomain,
            });
            toast({
              title: "Configuration Error",
              description: "Shop not found. Please contact support.",
              variant: "destructive",
            });
            setLoading(false);
            return;
          }

          const mappedTenant: TenantConfig = {
            id: dbTenant.id,
            name: dbTenant.name,
            tenant_key: dbTenant.tenant_key,
            shop_domain: dbTenant.shop_domain,
            environment: dbTenant.environment,
            verified: true,
          };
          setTenant(mappedTenant);
          setShopDomain(dbTenant.shop_domain);

          // Generate session token for this customer (use resolved shop domain)
          const { data: sessionData, error: sessionError } = await supabase.functions.invoke("generate-session-token", {
            body: { customerId: customerIdParam, shopDomain: resolvedShopDomain },
          });

          if (sessionError) {
            console.error("Error generating session token:", sessionError);
            toast({
              title: "Login Failed",
              description: "Could not authenticate. Please try again.",
              variant: "destructive",
            });
            setLoading(false);
            return;
          }

          if (sessionData?.sessionToken) {
            localStorage.setItem("phraseotomy_session_token", sessionData.sessionToken);
            console.log("✅ Session token generated and stored");

            // Parse customer name from URL if available
            const customerName = customerNameParam ? decodeURIComponent(customerNameParam.replace(/\+/g, ' ')) : null;
            const firstName = customerName ? customerName.split(' ')[0] : null;
            const lastName = customerName ? customerName.split(' ').slice(1).join(' ') : null;
            const email = customerEmailParam ? decodeURIComponent(customerEmailParam) : null;

            // Store customer data from URL immediately
            const immediateCustomerData = {
              customer_id: customerIdParam,
              id: customerIdParam,
              email: email,
              name: customerName,
              first_name: firstName,
              last_name: lastName,
            };
            
            localStorage.setItem("customerData", JSON.stringify(immediateCustomerData));
            localStorage.setItem("shop_domain", shopParam);

            // Fetch full customer data in background for additional info
            const { data: customerData, error: customerError } = await supabase.functions.invoke("get-customer-data", {
              body: { sessionToken: sessionData.sessionToken },
            });

            if (!customerError && customerData) {
              console.log("📦 Customer Data Retrieved:", {
                customer_id: customerIdParam,
                shop: shopParam,
                customer: customerData.customer,
              });

              // Update with fetched data if available
              localStorage.setItem(
                "customerData",
                JSON.stringify({
                  customer_id: customerIdParam,
                  id: customerIdParam,
                  email: customerData.customer?.email || email,
                  name: customerData.customer?.name || customerName,
                  first_name: customerData.customer?.first_name || firstName,
                  last_name: customerData.customer?.last_name || lastName,
                }),
              );
            }

            // Get tenant config to determine redirect URL
            const { getTenantConfig } = await import("@/lib/tenants");
            const tenant = getTenantConfig(shopParam);

            // Check if we're already on the target domain (phraseotomy.com or its proxy)
            const currentHost = window.location.hostname;
            const currentUrl = window.location.href;
            const isOnProxyDomain = tenant?.customShopDomains?.some(d => currentHost.includes(d.replace('https://', ''))) ||
              currentHost.includes('phraseotomy.com') ||
              currentUrl.includes('phraseotomy.com');

            // Always use React Router navigation when we have customer data and are on the right domain
            // This avoids cross-origin iframe navigation issues
            if (isOnProxyDomain || shopParam === 'phraseotomy.com' || shopParam?.includes('phraseotomy')) {
              // Already on the proxy domain or targeting it, use React Router navigation (no page reload)
              console.log("🚀 Using React Router navigation (already authenticated on target domain)");
              // Redirect to /play with query params for shop, customer_id, customer_name, customer_email
              const playUrl = `/play?shop=${encodeURIComponent(shopParam)}&customer_id=${encodeURIComponent(customerIdParam)}&customer_name=${encodeURIComponent(customerName || "")}&customer_email=${encodeURIComponent(email || "")}`;
              navigate(playUrl, { replace: true });
            } else if (tenant?.customShopDomains?.length && window.self === window.top) {
              // Full-page redirect to play-online with params (no #/play/host in URL)
              const playOnlineUrl = `https://${tenant.customShopDomains[0]}/pages/play-online?shop=${encodeURIComponent(shopParam)}&customer_id=${encodeURIComponent(customerIdParam)}&customer_name=${encodeURIComponent(customerName || "")}&customer_email=${encodeURIComponent(email || "")}`;
              console.log("🚀 Redirecting to play-online:", playOnlineUrl);
              window.top.location.href = playOnlineUrl;
            } else {
              // Default: use React Router navigation
              console.log("🚀 Navigating to play page on current domain");
              const playUrl = `/play?shop=${encodeURIComponent(shopParam)}&customer_id=${encodeURIComponent(customerIdParam)}&customer_name=${encodeURIComponent(customerName || "")}&customer_email=${encodeURIComponent(email || "")}`;
              navigate(playUrl, { replace: true });
            }
            return;
          }

          setLoading(false);
        } catch (error) {
          console.error("Error in direct login:", error);
          toast({
            title: "Login Failed",
            description: "An error occurred during authentication.",
            variant: "destructive",
          });
          setLoading(false);
        }
      };

      handleDirectLogin();
      return;
    }

    // Helper function to load tenant for a shop
    const loadTenantForShop = async (shop: string) => {
      try {
        const { data: dbTenant } = await supabase
          .from("tenants")
          .select("id, name, tenant_key, shop_domain, environment")
          .eq("shop_domain", shop)
          .eq("is_active", true)
          .maybeSingle();

        if (dbTenant) {
          const mappedTenant: TenantConfig = {
            id: dbTenant.id,
            name: dbTenant.name,
            tenant_key: dbTenant.tenant_key,
            shop_domain: dbTenant.shop_domain,
            environment: dbTenant.environment,
            verified: true,
          };
          setTenant(mappedTenant);
          setShopDomain(dbTenant.shop_domain);
        }
      } catch (error) {
        console.error("Error loading tenant:", error);
      } finally {
        setLoading(false);
      }
    };

    // Verify token if present
    if (token) {
      const verifyToken = async () => {
        try {
          const { data, error } = await supabase.functions.invoke("verify-login-token", {
            body: { token, shopDomain: shopParam || undefined },
          });

          if (error) {
            console.error("Error verifying token:", error);
            toast({
              title: "Verification Failed",
              description: "Could not verify authentication token. Please try logging in again.",
              variant: "destructive",
              duration: 5000,
            });
            setLoading(false);
            return;
          }

          if (data?.valid && data?.shop) {
            console.log("✅ Token verified, shop:", data.shop);
            const verifiedShop = data.shop;

            // Load tenant for verified shop
            try {
              const { data: dbTenant } = await supabase
                .from("tenants")
                .select("id, name, tenant_key, shop_domain, environment")
                .eq("shop_domain", verifiedShop)
                .eq("is_active", true)
                .maybeSingle();

              if (dbTenant) {
                const mappedTenant: TenantConfig = {
                  id: dbTenant.id,
                  name: dbTenant.name,
                  tenant_key: dbTenant.tenant_key,
                  shop_domain: dbTenant.shop_domain,
                  environment: dbTenant.environment,
                  verified: true,
                };
                setTenant(mappedTenant);
                setShopDomain(dbTenant.shop_domain);
              }
            } catch (error) {
              console.error("Error loading tenant:", error);
            }

            // Handle customer_id from URL (after Shopify login)
            if (customerIdParam && verifiedShop) {
              console.log("👤 Customer ID detected in URL:", customerIdParam);

              // Generate session token for this customer
              try {
                const { data: sessionData, error: sessionError } = await supabase.functions.invoke(
                  "generate-session-token",
                  {
                    body: { customerId: customerIdParam, shopDomain: verifiedShop },
                  },
                );

                if (sessionError) {
                  console.error("Error generating session token:", sessionError);
                  setLoading(false);
                } else if (sessionData?.sessionToken) {
                  localStorage.setItem("phraseotomy_session_token", sessionData.sessionToken);
                  console.log("✅ Session token generated and stored");

                  // Fetch full customer data
                  const { data: customerData, error: customerError } = await supabase.functions.invoke(
                    "get-customer-data",
                    {
                      body: { sessionToken: sessionData.sessionToken },
                    },
                  );

                  if (!customerError && customerData) {
                    console.log("📦 Full Customer Data Retrieved:", {
                      customer_id: customerIdParam,
                      shop: verifiedShop,
                      customer: customerData.customer,
                      licenses: customerData.licenses || [],
                      sessions: customerData.sessions || [],
                    });

                    // Store customer data in localStorage
                    localStorage.setItem(
                      "customerData",
                      JSON.stringify({
                        customer_id: customerIdParam,
                        id: customerIdParam,
                        email: customerData.customer?.email || null,
                        name: customerData.customer?.name || null,
                        first_name: customerData.customer?.first_name || null,
                        last_name: customerData.customer?.last_name || null,
                      }),
                    );

                    // Get tenant config to determine redirect URL
                    const { getTenantConfig } = await import("@/lib/tenants");
                    const tenant = getTenantConfig(verifiedShop);

                    // For production: full-page redirect to play-online (no #/play/host in URL)
                    if (tenant?.customShopDomains?.length) {
                      const playOnlineUrl = `https://${tenant.customShopDomains[0]}/pages/play-online`;
                      console.log("🚀 Redirecting to play-online (top window):", playOnlineUrl);
                      window.top!.location.href = playOnlineUrl;
                    } else {
                      // Staging or no proxy - stay on current domain
                      if (window.self !== window.top) {
                        window.location.href = `${window.location.origin}${window.location.pathname}#/play/host`;
                      } else {
                        navigate("/play/host", { replace: true });
                      }
                    }
                  }

                  setLoading(false);
                }
              } catch (error) {
                console.error("Error processing customer data:", error);
                setLoading(false);
              }
            } else {
              setLoading(false);
            }
          } else {
            console.warn("⚠️ Invalid or expired token");
            toast({
              title: "Invalid Token",
              description: "The authentication token is invalid or expired. Please try logging in again.",
              variant: "destructive",
              duration: 5000,
            });
            setLoading(false);
          }
        } catch (error) {
          console.error("Error verifying token:", error);
          setLoading(false);
        }
      };

      verifyToken();
      return;
    }

    // No token - use shop parameter
    const shopToUse = shopParam;
    if (shopToUse) {
      loadTenantForShop(shopToUse);
    } else {
      // Try to auto-detect tenant
      const fetchTenant = async () => {
        try {
          const { autoDetectTenant } = await import("@/lib/tenants");
          const detectedTenant = autoDetectTenant(urlParams);

          if (detectedTenant && detectedTenant.shopDomain) {
            await loadTenantForShop(detectedTenant.shopDomain);
          } else {
            setLoading(false);
          }
        } catch (error) {
          console.error("Error loading tenant:", error);
          setLoading(false);
        }
      };

      fetchTenant();
    }
  }, [navigate, toast]);

  const handleLogin = async () => {
    console.log("shopDomainshopDomain", shopDomain);
    if (!shopDomain) {
      toast({
        title: "Configuration Error",
        description: "Shop domain not configured. Please contact support.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("generate-login-token", {
        body: { shopDomain },
      });

      if (error) {
        console.error("Error generating login token:", error);
        toast({
          title: "Login Error",
          description: "Failed to generate login token. Please try again.",
          variant: "destructive",
        });
        return;
      }

      // Store generated login token for debugging / later flows
      if (data?.token) {
        try {
          localStorage.setItem("phraseotomy_login_token", data.token);
        } catch (e) {
          console.warn("Unable to persist login token to localStorage:", e);
        }
      }

      if (data?.loginUrl) {
        const app = getAppBridge();
        if (app) {
          const redirect = Redirect.create(app);
          redirect.dispatch(Redirect.Action.REMOTE, data.loginUrl);
        } else {
          // Use top location for iframe context so Shopify login replaces the full page
          window.top.location.href = data.loginUrl;
        }
      }
    } catch (error) {
      console.error("Login error:", error);
      toast({
        title: "Login Error",
        description: "Failed to initiate login. Please try again.",
        variant: "destructive",
      });
    }
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <Skeleton className="h-8 w-3/4 mb-2" />
            <Skeleton className="h-4 w-full" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        {/* <DebugInfo tenant={tenant} shopDomain={shopDomain} customer={null} backendConnected={true} /> */}

        {/* Logo and Title */}
        <div className="text-center space-y-4">
          <div className="mx-auto w-20 h-20 bg-primary rounded-2xl flex items-center justify-center">
            <span className="text-4xl font-bold text-primary-foreground">P</span>
          </div>
          <h1 className="text-3xl font-bold text-primary tracking-wide">PHRASEOTOMY</h1>
          <p className="text-muted-foreground">Please log in to your account to access the game</p>
        </div>

        {/* Login Button */}
        <div className="space-y-4">
          <Button onClick={handleLogin} className="w-full py-6 text-lg" size="lg">
            Log In
          </Button>

          {tenant && <p className="text-xs text-center text-muted-foreground">Connected to {tenant.name}</p>}
        </div>

      </div>
    </div>
  );
};

export default Login;
