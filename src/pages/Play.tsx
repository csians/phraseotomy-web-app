import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { lobbyCodeSchema, validateInput } from "@/lib/validation";
import { supabase } from "@/integrations/supabase/client";
import { redeemCode } from "@/lib/redemption";

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
  const [redemptionCode, setRedemptionCode] = useState("");
  const [isRedeeming, setIsRedeeming] = useState(false);

  // Initialize from localStorage and verify session
  useEffect(() => {
    const initializeSession = async () => {
      // Check for embedded config from proxy (primary method)
      if (window.__PHRASEOTOMY_CONFIG__ && window.__PHRASEOTOMY_SHOP__) {
        setTenant(window.__PHRASEOTOMY_CONFIG__);
        setShopDomain(window.__PHRASEOTOMY_SHOP__);
        
        if (window.__PHRASEOTOMY_CUSTOMER__) {
          console.log('👤 Customer Data from proxy:', {
            id: window.__PHRASEOTOMY_CUSTOMER__.id,
            email: window.__PHRASEOTOMY_CUSTOMER__.email,
            name: window.__PHRASEOTOMY_CUSTOMER__.name,
          });
          setCustomer(window.__PHRASEOTOMY_CUSTOMER__);
          
          // Store customer data in localStorage for Lobby page
          localStorage.setItem('customerData', JSON.stringify({
            customer_id: window.__PHRASEOTOMY_CUSTOMER__.id,
            id: window.__PHRASEOTOMY_CUSTOMER__.id,
            email: window.__PHRASEOTOMY_CUSTOMER__.email,
            name: window.__PHRASEOTOMY_CUSTOMER__.name,
            first_name: window.__PHRASEOTOMY_CUSTOMER__.firstName,
            last_name: window.__PHRASEOTOMY_CUSTOMER__.lastName,
          }));
        }
        
        setLoading(false);
        return;
      }

      const urlParams = new URLSearchParams(window.location.search);
      
      // Check for iframe config from URL parameters (fallback method)
      const configParam = urlParams.get('config');
      const shopParam = urlParams.get('shop');
      const customerParam = urlParams.get('customer');
      
      if (configParam && shopParam) {
        try {
          const tenantConfig = JSON.parse(configParam);
          const customerData = customerParam ? JSON.parse(customerParam) : null;
          
          console.log('🎯 Config loaded from URL params (iframe mode)');
          setTenant(tenantConfig);
          setShopDomain(shopParam);
          
          if (customerData) {
            console.log('👤 Customer Data from iframe params:', {
              id: customerData.id,
              email: customerData.email,
              name: customerData.name,
            });
            setCustomer(customerData);
            
            // Store customer data in localStorage for Lobby page
            localStorage.setItem('customerData', JSON.stringify({
              customer_id: customerData.id,
              id: customerData.id,
              email: customerData.email,
              name: customerData.name,
              first_name: customerData.firstName,
              last_name: customerData.lastName,
            }));
          }
          
          setLoading(false);
          return;
        } catch (error) {
          console.error('Error parsing URL config:', error);
        }
      }

      // Check if accessed from Shopify embedded app (has host parameter)
      const hostParam = urlParams.get('host');
      
      if (hostParam && shopParam) {
        console.log('🔗 Embedded app detected, redirecting to login with shop context');
        navigate(`/login?shop=${shopParam}&host=${hostParam}`, { replace: true });
        return;
      }

      // Try to restore session from localStorage
      const sessionToken = localStorage.getItem('phraseotomy_session_token');
      const storedCustomerData = localStorage.getItem('customerData');
      
      if (!sessionToken || !storedCustomerData) {
        console.log('⚠️ No session found, redirecting to login');
        navigate('/login', { replace: true });
        return;
      }

      try {
        // Verify session token is still valid
        const { data: customerData, error: customerError } = await supabase.functions.invoke('get-customer-data', {
          body: { sessionToken },
        });

        if (customerError || !customerData) {
          console.warn('⚠️ Invalid session, clearing and redirecting to login');
          localStorage.removeItem('phraseotomy_session_token');
          localStorage.removeItem('customerData');
          navigate('/login', { replace: true });
          return;
        }

        // Decode session token to get customer info
        const [payloadB64] = sessionToken.split('.');
        if (payloadB64) {
          const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));
          
          // Check if token is expired
          if (payload.exp && payload.exp * 1000 < Date.now()) {
            console.warn('⚠️ Session token expired, redirecting to login');
            localStorage.removeItem('phraseotomy_session_token');
            localStorage.removeItem('customerData');
            navigate('/login', { replace: true });
            return;
          }

          // Load tenant for this shop
          if (payload.shop) {
            const { data: dbTenant } = await supabase
              .from("tenants")
              .select("id, name, tenant_key, shop_domain, environment")
              .eq("shop_domain", payload.shop)
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
          }

          // Set customer state
          const parsedCustomerData = JSON.parse(storedCustomerData);
          const customerObj: ShopifyCustomer = {
            id: payload.customer_id,
            email: parsedCustomerData.email || null,
            firstName: parsedCustomerData.first_name || null,
            lastName: parsedCustomerData.last_name || null,
            name: parsedCustomerData.name || null,
          };
          setCustomer(customerObj);

          console.log('✅ Session restored successfully');
        }
      } catch (error) {
        console.error('Error restoring session:', error);
        localStorage.removeItem('phraseotomy_session_token');
        localStorage.removeItem('customerData');
        navigate('/login', { replace: true });
        return;
      }

      setLoading(false);
    };

    initializeSession();
  }, [navigate]);

  // Load customer data when logged in
  useEffect(() => {
    if (!loading && customer && shopDomain) {
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

  const handleJoinGame = async () => {
    try {
      // Validate lobby code
      const validatedLobbyCode = validateInput(lobbyCodeSchema, lobbyCode);
      
      // Determine player ID and name
      let playerId: string;
      let playerName: string;
      
      if (customer) {
        playerId = customer.id;
        playerName = customer.name || customer.email || "Customer";
      } else {
        // This shouldn't happen since user must be logged in
        toast({
          title: "Error",
          description: "Please log in to join a game.",
          variant: "destructive",
        });
        return;
      }

      // Call join-lobby edge function
      const { data, error } = await supabase.functions.invoke("join-lobby", {
        body: {
          lobbyCode: validatedLobbyCode,
          playerName,
          playerId,
        },
      });

      if (error) {
        toast({
          title: "Failed to Join",
          description: error.message || "Could not join the lobby",
          variant: "destructive",
        });
        return;
      }

      if (data?.session) {
        toast({
          title: "Joined Lobby!",
          description: `You've joined lobby ${validatedLobbyCode}`,
        });
        
        // Navigate to lobby page
        navigate(`/lobby/${data.session.id}`);
      }
    } catch (error) {
      console.error("Error joining game:", error);
      toast({
        title: "Invalid Input",
        description: error instanceof Error ? error.message : "Please check your lobby code",
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
    if (!customer || !shopDomain) {
      toast({
        title: "Error",
        description: "Please log in to redeem a code.",
        variant: "destructive",
      });
      return;
    }

    if (redemptionCode.length !== 6) {
      toast({
        title: "Invalid Code",
        description: "Please enter a 6-character code.",
        variant: "destructive",
      });
      return;
    }

    setIsRedeeming(true);
    try {
      const result = await redeemCode(redemptionCode, customer.id, shopDomain);
      
      if (result.success) {
        toast({
          title: "Success!",
          description: result.message,
        });
        
        // Clear the input
        setRedemptionCode("");
        
        // Refresh customer data to show updated licenses
        setDataLoading(true);
        try {
          const [customerLicenses, customerSessions] = await Promise.all([
            getCustomerLicenses(customer.id, shopDomain),
            getCustomerSessions(customer.id, shopDomain),
          ]);
          setLicenses(customerLicenses);
          setSessions(customerSessions);
        } catch (error) {
          console.error("Error refreshing customer data:", error);
        } finally {
          setDataLoading(false);
        }
      } else {
        toast({
          title: "Redemption Failed",
          description: result.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error redeeming code:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsRedeeming(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('phraseotomy_session_token');
    localStorage.removeItem('customerData');
    navigate('/login');
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
        {/* Welcome message */}
        <div className="text-center flex items-center justify-between">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-white">Welcome, {customer?.name || customer?.email}!</h2>
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleLogout}
            className="ml-4"
          >
            Logout
          </Button>
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
                <Button onClick={handleRedeemCode} disabled={redemptionCode.length !== 6 || isRedeeming}>
                  {isRedeeming ? "Redeeming..." : "Redeem"}
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
              {hasActiveLicenses 
                ? "Start a new game session and invite friends"
                : "Redeem a code above to unlock game packs and start hosting"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              onClick={handleHostGame}
              disabled={!hasActiveLicenses}
              className="w-full bg-game-yellow hover:bg-game-yellow/90 text-game-black font-bold disabled:opacity-50 disabled:cursor-not-allowed"
              size="lg"
            >
              Host New Game
            </Button>
            {!hasActiveLicenses && (
              <p className="text-xs text-muted-foreground text-center">
                You need an active license to host games
              </p>
            )}
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
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => navigate(`/lobby/${session.id}`)}
                    >
                      Rejoin
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                <p className="text-sm">No active games</p>
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
