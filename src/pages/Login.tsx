import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const [lobbyCode, setLobbyCode] = useState("");
  const [guestName, setGuestName] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [showGuestJoin, setShowGuestJoin] = useState(false);

  // Generate a random guest name suffix
  const generateRandomSuffix = () => {
    return Math.floor(Math.random() * 900) + 100; // 100-999
  };

  useEffect(() => {
    // Check for guest join parameters FIRST - join lobby directly
    const urlParams = getAllUrlParams();
    const guestParam = urlParams.get("guest");
    const lobbyCodeParam = urlParams.get("lobbyCode");
    const guestDataParam = urlParams.get("guestData");
    const guestShopParam = urlParams.get("shop");

    if (guestParam === "true" && lobbyCodeParam && guestDataParam) {
      console.log("Guest parameters detected, joining lobby directly");

      const joinLobbyAsGuest = async () => {
        try {
          const guestData = JSON.parse(decodeURIComponent(guestDataParam));

          // Store guest data in localStorage
          localStorage.setItem("guest_player_id", guestData.player_id);
          localStorage.setItem("guestPlayerData", JSON.stringify(guestData));
          if (guestShopParam) {
            localStorage.setItem("shop_domain", guestShopParam);
          }

          // Join the lobby directly
          const { data: joinData, error: joinError } = await supabase.functions.invoke("join-lobby", {
            body: {
              lobbyCode: lobbyCodeParam.toUpperCase(),
              playerName: guestData.name,
              playerId: guestData.player_id,
            },
          });

          if (joinError || joinData?.error) {
            console.error("Error joining lobby:", joinError || joinData?.error);
            toast({
              title: "Failed to Join",
              description: joinData?.error || "Could not join the lobby",
              variant: "destructive",
            });
            setLoading(false);
            return;
          }

          // Store session for persistence
          const sessionId = joinData?.session?.id;
          if (sessionId) {
            sessionStorage.setItem("current_lobby_session", sessionId);
            toast({
              title: "Success!",
              description: `Joined as ${guestData.name}`,
            });
            navigate(`/lobby/${sessionId}`, { replace: true });
          } else {
            setLoading(false);
          }
        } catch (error) {
          console.error("Error in guest join:", error);
          toast({
            title: "Failed to Join",
            description: "Could not join the lobby",
            variant: "destructive",
          });
          setLoading(false);
        }
      };

      joinLobbyAsGuest();
      return;
    }

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

            // For production with Shopify proxy, redirect to proxy URL
            if (tenant?.proxyPath && tenant?.customShopDomains?.length) {
              const proxyUrl = `https://${tenant.customShopDomains[0]}${tenant.proxyPath}#/play/host`;
              console.log("🚀 Redirecting to Shopify proxy URL:", proxyUrl);
              if (window.self !== window.top) {
                window.top!.location.href = proxyUrl;
              } else {
                window.location.href = proxyUrl;
              }
            } else {
              // Staging or no proxy - stay on current domain
              if (window.self !== window.top) {
                window.top!.location.href = `${window.location.origin}${window.location.pathname}#/play/host`;
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

    // Check for signed token in URL (from Shopify app-login page)
    const token = urlParams.get("r");
    const shopParam = urlParams.get("shop");
    const customerIdParam = urlParams.get("customer_id");
    const customerNameParam = urlParams.get("customer_name");

    console.log(customerNameParam);
    
    const customerEmailParam = urlParams.get("customer_email");

    // Handle direct login with shop and customer_id (no token)
    if (shopParam && customerIdParam && !token) {
      console.log("🔄 Direct login detected with shop and customer_id");
      
      // Clean URL immediately by removing all query parameters
      const cleanUrl = window.location.origin + window.location.pathname + (window.location.hash ? window.location.hash.split('?')[0] : '');
      window.history.replaceState({}, document.title, cleanUrl);
      console.log("🧹 URL cleaned to:", cleanUrl);
      
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

            // For production with Shopify proxy, redirect to proxy URL
            if (tenant?.proxyPath && tenant?.customShopDomains?.length) {
              const proxyUrl = `https://${tenant.customShopDomains[0]}${tenant.proxyPath}#/play/host`;
              console.log("🚀 Redirecting to Shopify proxy URL:", proxyUrl);
              window.location.href = proxyUrl;
            } else {
              // Staging or no proxy - stay on current domain
              console.log("🚀 Navigating to play page on current domain");
              navigate("/play/host", { replace: true });
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

                    // For production with Shopify proxy, redirect to proxy URL
                    if (tenant?.proxyPath && tenant?.customShopDomains?.length) {
                      const proxyUrl = `https://${tenant.customShopDomains[0]}${tenant.proxyPath}#/play/host`;
                      console.log("🚀 Redirecting to Shopify proxy URL:", proxyUrl);
                      if (window.self !== window.top) {
                        window.top!.location.href = proxyUrl;
                      } else {
                        window.location.href = proxyUrl;
                      }
                    } else {
                      // Staging or no proxy - stay on current domain
                      if (window.self !== window.top) {
                        window.top!.location.href = `${window.location.origin}${window.location.pathname}#/play/host`;
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

      if (data?.loginUrl) {
        const app = getAppBridge();
        if (app) {
          const redirect = Redirect.create(app);
          redirect.dispatch(Redirect.Action.REMOTE, data.loginUrl);
        } else {
          window.location.href = data.loginUrl;
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

  const handleGuestJoin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!guestName.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter your name",
        variant: "destructive",
      });
      return;
    }

    if (!lobbyCode.trim() || lobbyCode.trim().length !== 6) {
      toast({
        title: "Missing Information",
        description: "Please enter a valid 6-digit lobby code",
        variant: "destructive",
      });
      return;
    }

    setIsJoining(true);

    try {
      // Generate or retrieve guest player ID
      let guestPlayerId = localStorage.getItem("guest_player_id");
      if (!guestPlayerId) {
        guestPlayerId = `guest_${Math.random().toString(36).substring(2, 15)}`;
        localStorage.setItem("guest_player_id", guestPlayerId);
      }

      // Use the entered name with a random suffix for uniqueness
      const playerName = `${guestName.trim()}${generateRandomSuffix()}`;

      // Store guest data in localStorage for the session
      localStorage.setItem(
        "guestPlayerData",
        JSON.stringify({
          player_id: guestPlayerId,
          name: playerName,
          is_guest: true,
        }),
      );

      const { data, error } = await supabase.functions.invoke("join-lobby", {
        body: {
          lobbyCode: lobbyCode.toUpperCase(),
          playerName: playerName,
          playerId: guestPlayerId,
        },
      });

      if (error) {
        throw new Error(error.message || "Failed to join lobby");
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      toast({
        title: "Success!",
        description: `Joined as ${playerName}`,
      });

      // Store session in sessionStorage for persistence
      sessionStorage.setItem("current_lobby_session", data.session.id);

      navigate(`/lobby/${data.session.id}`);
    } catch (error: any) {
      console.error("Error joining lobby:", error);
      toast({
        title: "Failed to Join",
        description: error.message || "Could not join the lobby. Please check the code.",
        variant: "destructive",
      });
    } finally {
      setIsJoining(false);
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
        <DebugInfo tenant={tenant} shopDomain={shopDomain} customer={null} backendConnected={true} />

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

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">or</span>
          </div>
        </div>

        {/* Guest Join Section */}
        {!showGuestJoin ? (
          <Button variant="outline" className="w-full py-6 text-lg" size="lg" onClick={() => setShowGuestJoin(true)}>
            Join Lobby Without Login
          </Button>
        ) : (
          <Card className="border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-center">Join as Guest</CardTitle>
              <CardDescription className="text-center">Enter your name and the lobby code to join</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleGuestJoin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="guestName">Your Name</Label>
                  <Input
                    id="guestName"
                    placeholder="Enter your name"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    maxLength={50}
                    className="text-center"
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lobbyCode">Lobby Code</Label>
                  <Input
                    id="lobbyCode"
                    placeholder="Enter 6-digit lobby code"
                    value={lobbyCode}
                    onChange={(e) => setLobbyCode(e.target.value.toUpperCase())}
                    maxLength={6}
                    className="text-center text-xl tracking-widest font-mono"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    className="flex-1"
                    onClick={() => {
                      setShowGuestJoin(false);
                      setLobbyCode("");
                      setGuestName("");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={isJoining || lobbyCode.trim().length !== 6 || !guestName.trim()}
                  >
                    {isJoining ? "Joining..." : "Join Game"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Login;
