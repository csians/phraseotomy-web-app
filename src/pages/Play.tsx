import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Redirect } from "@shopify/app-bridge/actions";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import type { TenantConfig, ShopifyCustomer } from "@/lib/types";
import { APP_VERSION } from "@/lib/types";
import { getCustomerLicenses, getCustomerSessions, type CustomerLicense, type GameSession } from "@/lib/customerAccess";
import { getAppBridge } from "@/lib/appBridge";
import { lobbyCodeSchema, playerNameSchema, redemptionCodeSchema, validateInput } from "@/lib/validation";

// Extend window to include embedded config and customer data

const Play = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [shopDomain, setShopDomain] = useState<string | null>(null);
  const [tenant, setTenant] = useState<TenantConfig | null>(null);
  const [customer, setCustomer] = useState<ShopifyCustomer | null>(null);
  const [licenses, setLicenses] = useState<CustomerLicense[]>([]);
  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [lobbyCode, setLobbyCode] = useState("");
  const [guestName, setGuestName] = useState("");
  const [redemptionCode, setRedemptionCode] = useState("");

  const [loginStatusFromUrl, setLoginStatusFromUrl] = useState<{
    status: "success" | "failed" | "unknown";
    params: Record<string, string>;
  } | null>(null);

  // Check for Shopify login success/failure parameters in URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);

    // Common Shopify login redirect parameters
    const loginStatus = urlParams.get("login");
    const error = urlParams.get("error");
    const errorDescription = urlParams.get("error_description");
    const errorCode = urlParams.get("error_code");
    const customerAccount = urlParams.get("customer_account");
    const returnUrl = urlParams.get("return_url");
    const checkoutToken = urlParams.get("checkout_token");
    const state = urlParams.get("state");

    // Collect all parameters for logging
    const allParams: Record<string, string> = {};
    urlParams.forEach((value, key) => {
      allParams[key] = value;
    });

    // Determine login status
    let status: "success" | "failed" | "unknown" = "unknown";

    // Check for success indicators
    if (loginStatus === "success" || customerAccount || checkoutToken) {
      status = "success";
      console.log("✅ Shopify login successful (from URL parameter)", {
        loginStatus,
        customerAccount,
        checkoutToken,
        returnUrl,
        allParams,
        timestamp: new Date().toISOString(),
      });
    }

    // Check for failure indicators
    if (loginStatus === "failed" || error || errorCode) {
      status = "failed";
      console.error("❌ Shopify login failed (from URL parameter)", {
        loginStatus,
        error,
        errorCode,
        errorDescription,
        allParams,
        timestamp: new Date().toISOString(),
      });
    }

    // Log all URL parameters for debugging (always log if there are any params)
    if (urlParams.toString()) {
      console.log("📋 All URL Parameters after Shopify redirect:", allParams);
      setLoginStatusFromUrl({
        status,
        params: allParams,
      });
    }

    // Clean up URL parameters after reading them (optional - removes them from URL bar)
    // Uncomment the lines below if you want to clean the URL after reading parameters
    // if (urlParams.toString()) {
    //   const cleanUrl = window.location.pathname;
    //   window.history.replaceState({}, document.title, cleanUrl);
    // }
  }, []);

  useEffect(() => {
    // Check for embedded config from proxy (primary method)
    if (window.__PHRASEOTOMY_CONFIG__ && window.__PHRASEOTOMY_SHOP__) {
      setTenant(window.__PHRASEOTOMY_CONFIG__);
      setShopDomain(window.__PHRASEOTOMY_SHOP__);
      setCustomer(window.__PHRASEOTOMY_CUSTOMER__ || null);
      setLoading(false);
      return;
    }

    // Check for signed token in URL (from Shopify app-login page)
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('r');
    const shopParam = urlParams.get('shop');
    
    // Helper function to load tenant for a shop
    const loadTenantForShop = async (shop: string, hasToken?: boolean) => {
      // Load tenant from database
      try {
        const { data: dbTenant } = await (await import("@/integrations/supabase/client")).supabase
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
          const { verifySignedToken } = await import('@/lib/tokenAuth');
          const payload = await verifySignedToken(token);
          
          if (payload) {
            console.log('✅ Token verified, shop:', payload.shop);
            const verifiedShop = payload.shop;
            setShopDomain(verifiedShop);
            
            // Clean up token from URL but keep shop parameter
            urlParams.delete('r');
            if (!urlParams.has('shop')) {
              urlParams.set('shop', verifiedShop);
            }
            const cleanUrl = window.location.pathname + (urlParams.toString() ? `?${urlParams.toString()}` : '');
            window.history.replaceState({}, document.title, cleanUrl);
            
            // Load tenant for verified shop (token indicates customer logged in)
            await loadTenantForShop(verifiedShop, true);
          } else {
            console.warn('⚠️ Invalid or expired token');
            
            toast({
              title: 'Invalid Token',
              description: 'The authentication token is invalid or expired. Please try logging in again.',
              variant: 'destructive',
              duration: 5000,
            });
            
            setLoading(false);
          }
        } catch (error) {
          console.error('Error verifying token:', error);
          setLoading(false);
        }
      };
      
      verifyToken();
      return; // Wait for token verification
    }

    // No token - use shop parameter or existing shopDomain
    const shopToUse = shopParam;
    if (shopToUse) {
      loadTenantForShop(shopToUse, false);
    } else if (shopDomain) {
      // If shopDomain is already set (from previous render), use it
      loadTenantForShop(shopDomain, false);
    } else {
      // No shop available, try to load any tenant
      const fetchTenant = async () => {
        try {
          const { data: dbTenant } = await (await import("@/integrations/supabase/client")).supabase
            .from("tenants")
            .select("id, name, tenant_key, shop_domain, environment")
            .eq("is_active", true)
            .limit(1)
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
      fetchTenant();
    }
  }, [toast, shopDomain]);

  // Load customer data when logged in
  useEffect(() => {
    if (!loading && customer && shopDomain) {
      // Log successful login
      console.log("✅ Login successful!", {
        customer: {
          id: customer.id,
          email: customer.email,
          name: customer.name,
        },
        shopDomain,
        timestamp: new Date().toISOString(),
      });

      const fetchCustomerData = async () => {
        setDataLoading(true);
        try {
          const [customerLicenses, customerSessions] = await Promise.all([
            getCustomerLicenses(customer.id, shopDomain),
            getCustomerSessions(customer.id, shopDomain),
          ]);

          setLicenses(customerLicenses);
          setSessions(customerSessions);

          console.log("✅ Customer data loaded:", {
            licenses: customerLicenses.length,
            sessions: customerSessions.length,
          });
        } catch (error) {
          console.error("Error loading customer data:", error);
        } finally {
          setDataLoading(false);
        }
      };

      fetchCustomerData();
    }
  }, [loading, customer, shopDomain]);

  // Auto-redirect to CreateLobby when customer is logged in AND has redeemed codes
  useEffect(() => {
    // Only redirect if:
    // 1. Initial loading is complete
    // 2. Customer data loading is complete
    // 3. Customer is logged in (has customer data from Shopify)
    // 4. Customer has active licenses (redeemed codes)
    // 5. We have shop domain and tenant info
    // 6. We're on the /play route (not already on create-lobby)
    if (!loading && !dataLoading && customer && shopDomain && tenant && licenses.length > 0) {
      const currentPath = window.location.pathname;
      const isOnPlayPage = currentPath === '/play' || currentPath === '/apps/phraseotomy' || currentPath === '/';
      
      if (!isOnPlayPage) {
        // Already on a different page, don't redirect
        return;
      }

      // Check if customer just logged in (from URL params or fresh customer data)
      const urlParams = new URLSearchParams(window.location.search);
      const justLoggedIn = 
        loginStatusFromUrl?.status === 'success' || 
        urlParams.get('logged_in_customer_id') !== null ||
        urlParams.get('customer_account') !== null;

      // Small delay to ensure all data is loaded and UI is ready
      const redirectTimer = setTimeout(() => {
        console.log("🔄 Auto-redirecting logged-in customer with redeemed codes to CreateLobby", {
          customer: customer.email || customer.id,
          shopDomain,
          licensesCount: licenses.length,
          justLoggedIn,
        });
        navigate("/create-lobby", {
          state: { customer, shopDomain, tenant },
          replace: true,
        });
      }, 1000); // Delay to let user see they're logged in and have access

      return () => clearTimeout(redirectTimer);
    }
  }, [loading, dataLoading, customer, shopDomain, tenant, licenses, navigate, loginStatusFromUrl]);

  const handleJoinGame = () => {
    try {
      const validatedLobbyCode = validateInput(lobbyCodeSchema, lobbyCode);
      const validatedGuestName = customer ? null : validateInput(playerNameSchema, guestName);
      
      toast({
        title: "Coming Soon",
        description: "Game lobby joining will be available soon.",
      });
    } catch (error) {
      toast({
        title: "Invalid Input",
        description: error instanceof Error ? error.message : "Please check your input",
        variant: "destructive",
      });
    }
  };

  const handleHostGame = () => {
    navigate("/create-lobby", {
      state: { customer, shopDomain, tenant },
    });
  };

  const handleRedeemCode = async () => {
    try {
      const validatedCode = validateInput(redemptionCodeSchema, redemptionCode);
      console.log("Redeeming code:", validatedCode);
      // TODO: Implement redeem code logic
      toast({
        title: "Coming Soon",
        description: "Code redemption will be available soon.",
      });
    } catch (error) {
      toast({
        title: "Invalid Code",
        description: error instanceof Error ? error.message : "Please enter a valid code",
        variant: "destructive",
      });
    }
  };

  const handleLogin = async () => {
    const effectiveShopDomain = shopDomain || tenant?.shop_domain;
    if (!effectiveShopDomain) {
      toast({
        title: "Cannot Login",
        description: "Shop domain not available. Please access this app through your Shopify store.",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log('Generating login token for shop:', effectiveShopDomain);
      
      // Call edge function to generate signed token
      const { data, error } = await (await import("@/integrations/supabase/client")).supabase.functions.invoke('generate-login-token', {
        body: { shopDomain: effectiveShopDomain }
      });

      if (error) throw error;
      if (!data?.loginUrl) throw new Error('No login URL returned');

      console.log('Login URL generated, redirecting...');
      
      // Use App Bridge to navigate parent window (bypasses iframe security)
      const appBridge = getAppBridge();
      if (appBridge) {
        const redirect = Redirect.create(appBridge);
        redirect.dispatch(Redirect.Action.REMOTE, data.loginUrl);
      } else {
        // Fallback for non-Shopify environments
        window.location.href = data.loginUrl;
      }
    } catch (error) {
      console.error('Error generating login token:', error);
      toast({
        title: "Login Error",
        description: "Failed to generate login token. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-game-black flex items-center justify-center px-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-game-yellow border-t-transparent mx-auto"></div>
          <p className="mt-4 text-game-yellow">Loading...</p>
        </div>
      </div>
    );
  }

  const appEnv = import.meta.env.VITE_APP_ENV || "development";
  const hasActiveLicenses = licenses.length > 0;
  const allPacks = Array.from(new Set(licenses.flatMap((l) => l.packs_unlocked)));
  const earliestExpiry = licenses.reduce(
    (earliest, license) => {
      if (!license.expires_at) return earliest;
      const expiryDate = new Date(license.expires_at);
      return !earliest || expiryDate < earliest ? expiryDate : earliest;
    },
    null as Date | null,
  );

  return (
    <div className="min-h-screen bg-game-black flex flex-col items-center justify-between px-4 py-8">
      {/* Logo and Branding */}
      <div className="w-full max-w-2xl text-center pt-8">
        <div className="w-20 h-20 mx-auto mb-4 bg-game-yellow rounded-2xl flex items-center justify-center shadow-lg">
          <span className="text-5xl font-black text-game-black">P</span>
        </div>
        <h1 className="text-4xl font-black text-white mb-2 tracking-wider">PHRASEOTOMY</h1>
        <p className="text-sm text-game-yellow uppercase tracking-widest font-semibold">The Party Game</p>
      </div>

      {/* Main Content */}
      <div className="w-full max-w-2xl space-y-6">
        {!customer ? (
          // STATE 1: Not logged in
          <>
            {/* Section A: Bought the game */}
            <Card className="bg-card border-game-gray">
              <CardHeader>
                <CardTitle className="text-xl">I bought the game</CardTitle>
                <CardDescription>Bought Phraseotomy? Log in to redeem your code and host games.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={handleLogin}
                  className="w-full bg-game-yellow hover:bg-game-yellow/90 text-game-black font-bold"
                  size="lg"
                >
                  Log in to Phraseotomy
                </Button>
              </CardContent>
            </Card>

            {/* Section B: Joining a game */}
            <Card className="bg-card border-game-gray">
              <CardHeader>
                <CardTitle className="text-xl">I'm joining a game</CardTitle>
                <CardDescription>Joining a party? Enter the lobby code your host gave you.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">Lobby Code</label>
                  <Input
                    placeholder="Enter lobby code"
                    value={lobbyCode}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLobbyCode(e.target.value.toUpperCase())}
                    maxLength={6}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">Your Name</label>
                  <Input
                    placeholder="Enter your name"
                    value={guestName}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setGuestName(e.target.value)}
                  />
                </div>
                <Button onClick={handleJoinGame} className="w-full" size="lg">
                  Join Game
                </Button>
              </CardContent>
            </Card>
          </>
        ) : (
          // STATE 2 & 3: Logged in
          <>
            {/* Welcome message */}
            <div className="text-center">
              <h2 className="text-2xl font-bold text-white">Welcome, {customer.name || customer.email}!</h2>
            </div>

            {/* Access Status Card */}
            <Card className="bg-card border-game-gray">
              <CardHeader>
                <CardTitle className="text-lg">Access Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {dataLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                ) : hasActiveLicenses ? (
                  <>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Access:</span>
                      <span className="text-game-yellow font-semibold">
                        Active {earliestExpiry ? `until ${earliestExpiry.toLocaleDateString()}` : ""}
                      </span>
                    </div>
                    {allPacks.length > 0 && (
                      <div className="pt-2 border-t border-border">
                        <p className="text-xs text-muted-foreground mb-2">Packs unlocked:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {allPacks.map((pack) => (
                            <Badge
                              key={pack}
                              variant="secondary"
                              className="bg-game-yellow/20 text-game-yellow border-game-yellow/30"
                            >
                              {pack}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-muted-foreground mb-2">You don't have any active packs yet.</p>
                    <p className="text-sm text-muted-foreground">
                      Redeem a code from your Phraseotomy game to unlock themes and host games.
                    </p>
                  </div>
                )}

                {/* Redeem Code Section */}
                <div className="pt-4 border-t border-border space-y-3">
                  <label className="text-sm font-medium">
                    {hasActiveLicenses ? "Redeem another code" : "Redeem a code"}
                  </label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter code"
                      value={redemptionCode}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setRedemptionCode(e.target.value.toUpperCase())
                      }
                      maxLength={6}
                    />
                    <Button onClick={handleRedeemCode} disabled={redemptionCode.length !== 6}>
                      Redeem
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Host New Game */}
            <Card className="bg-card border-game-gray">
              <CardHeader>
                <CardTitle className="text-lg">Host New Game</CardTitle>
                <CardDescription>
                  {hasActiveLicenses ? "Start a new game session and invite friends" : "Redeem a code to host games"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={handleHostGame}
                  disabled={!hasActiveLicenses}
                  className="w-full bg-game-yellow hover:bg-game-yellow/90 text-game-black font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                  size="lg"
                >
                  {hasActiveLicenses ? "Host New Game" : "Unlock with Code First"}
                </Button>
              </CardContent>
            </Card>

            {/* Your Games */}
            <Card className="bg-card border-game-gray">
              <CardHeader>
                <CardTitle className="text-lg">Your Games</CardTitle>
                <CardDescription>Active game sessions you're hosting</CardDescription>
              </CardHeader>
              <CardContent>
                {dataLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : sessions.length > 0 ? (
                  <div className="space-y-3">
                    {sessions.map((session) => (
                      <div
                        key={session.id}
                        className="flex items-center justify-between p-4 bg-game-gray/30 rounded-lg border border-game-yellow/20"
                      >
                        <div>
                          <p className="font-mono text-lg text-game-yellow font-bold">{session.lobby_code}</p>
                          <p className="text-xs text-muted-foreground capitalize">{session.status}</p>
                        </div>
                        <Button variant="outline" size="sm">
                          Rejoin
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    <p className="mb-2">You don't have any active games yet.</p>
                    <p className="text-sm">Host a new game to get started!</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Join Another Game */}
            <Card className="bg-card border-game-gray">
              <CardHeader>
                <CardTitle className="text-lg">Join Another Game</CardTitle>
                <CardDescription>Enter a lobby code to join someone else's game</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Input
                    placeholder="Enter lobby code"
                    value={lobbyCode}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLobbyCode(e.target.value.toUpperCase())}
                    maxLength={6}
                  />
                </div>
                <Button onClick={handleJoinGame} className="w-full" size="lg">
                  Join Game
                </Button>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="w-full max-w-2xl pt-12 pb-4">
        <div className="bg-game-gray/30 border border-game-yellow/20 rounded-lg p-4">
          <div className="text-xs text-game-yellow/80 space-y-1.5">
            <div className="flex justify-between">
              <span className="font-semibold">Environment:</span>
              <span className="uppercase">{appEnv}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold">Backend:</span>
              <span>{isSupabaseConfigured() ? "Connected" : "Not Configured"}</span>
            </div>
            {tenant && (
              <>
                <div className="flex justify-between">
                  <span className="font-semibold">Tenant:</span>
                  <span>{tenant.tenant_key}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">Shop:</span>
                  <span>{shopDomain || "Unknown"}</span>
                </div>
              </>
            )}
            {customer && (
              <div className="flex justify-between">
                <span className="font-semibold">Customer:</span>
                <span>{customer.email || customer.name || customer.id}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Play;
