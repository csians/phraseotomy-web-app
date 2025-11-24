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

/**
 * Generate and store a session token for authenticated customer
 */
async function generateAndStoreSessionToken(customerId: string, shopDomain: string): Promise<void> {
  try {
    const { data, error } = await supabase.functions.invoke('generate-session-token', {
      body: { customerId, shopDomain },
    });

    if (error) {
      console.error('Error generating session token:', error);
      return;
    }

    if (data?.sessionToken) {
      localStorage.setItem('phraseotomy_session_token', data.sessionToken);
    }
  } catch (error) {
    console.error('Error calling generate-session-token:', error);
  }
}

const Login = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [shopDomain, setShopDomain] = useState<string | null>(null);
  const [tenant, setTenant] = useState<TenantConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [lobbyCode, setLobbyCode] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => {
    // Check for embedded config from proxy (primary method)
    if (window.__PHRASEOTOMY_CONFIG__ && window.__PHRASEOTOMY_SHOP__) {
      setTenant(window.__PHRASEOTOMY_CONFIG__);
      setShopDomain(window.__PHRASEOTOMY_SHOP__);
      const customerData = window.__PHRASEOTOMY_CUSTOMER__ || null;
      
      // If customer is already logged in, redirect to play page
      if (customerData) {
        console.log('Customer already logged in, redirecting to play page');
        
        // Store customer data
        localStorage.setItem('customerData', JSON.stringify({
          customer_id: customerData.id,
          id: customerData.id,
          email: customerData.email,
          name: customerData.name,
          first_name: customerData.firstName,
          last_name: customerData.lastName,
        }));
        
        // Generate session token
        generateAndStoreSessionToken(customerData.id, window.__PHRASEOTOMY_SHOP__).then(() => {
          navigate('/play/host');
        });
      }
      
      setLoading(false);
      return;
    }

    // Check for signed token in URL (from Shopify app-login page)
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('r');
    const shopParam = urlParams.get('shop');
    const customerIdParam = urlParams.get('customer_id');
    
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
          const { data, error } = await supabase.functions.invoke('verify-login-token', {
            body: { token, shopDomain: shopParam || undefined },
          });
          
          if (error) {
            console.error('Error verifying token:', error);
            toast({
              title: 'Verification Failed',
              description: 'Could not verify authentication token. Please try logging in again.',
              variant: 'destructive',
              duration: 5000,
            });
            setLoading(false);
            return;
          }
          
          if (data?.valid && data?.shop) {
            console.log('✅ Token verified, shop:', data.shop);
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
              console.error('Error loading tenant:', error);
            }
            
            // Handle customer_id from URL (after Shopify login)
            if (customerIdParam && verifiedShop) {
              console.log('👤 Customer ID detected in URL:', customerIdParam);
              
              // Generate session token for this customer
              try {
                const { data: sessionData, error: sessionError } = await supabase.functions.invoke('generate-session-token', {
                  body: { customerId: customerIdParam, shopDomain: verifiedShop },
                });

                if (sessionError) {
                  console.error('Error generating session token:', sessionError);
                  setLoading(false);
                } else if (sessionData?.sessionToken) {
                  localStorage.setItem('phraseotomy_session_token', sessionData.sessionToken);
                  console.log('✅ Session token generated and stored');

                  // Fetch full customer data
                  const { data: customerData, error: customerError } = await supabase.functions.invoke('get-customer-data', {
                    body: { sessionToken: sessionData.sessionToken },
                  });

                  if (!customerError && customerData) {
                    console.log('📦 Full Customer Data Retrieved:', {
                      customer_id: customerIdParam,
                      shop: verifiedShop,
                      customer: customerData.customer,
                      licenses: customerData.licenses || [],
                      sessions: customerData.sessions || [],
                    });

                    // Store customer data in localStorage
                    localStorage.setItem('customerData', JSON.stringify({
                      customer_id: customerIdParam,
                      id: customerIdParam,
                      email: customerData.customer?.email || null,
                      name: customerData.customer?.name || null,
                      first_name: customerData.customer?.first_name || null,
                      last_name: customerData.customer?.last_name || null,
                    }));

                    // Clean up URL parameters and redirect to play page
                    navigate('/play/host', { replace: true });
                  }
                  
                  setLoading(false);
                }
              } catch (error) {
                console.error('Error processing customer data:', error);
                setLoading(false);
              }
            } else {
              setLoading(false);
            }
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
    if (!shopDomain) {
      toast({
        title: "Configuration Error",
        description: "Shop domain not configured. Please contact support.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('generate-login-token', {
        body: { shopDomain },
      });

      if (error) {
        console.error('Error generating login token:', error);
        toast({
          title: 'Login Error',
          description: 'Failed to generate login token. Please try again.',
          variant: 'destructive',
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
      console.error('Login error:', error);
      toast({
        title: 'Login Error',
        description: 'Failed to initiate login. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleJoinGame = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!lobbyCode.trim() || !playerName.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter both lobby code and your name",
        variant: "destructive",
      });
      return;
    }

    setIsJoining(true);

    try {
      // Generate or retrieve guest player ID
      let guestPlayerId = localStorage.getItem('guest_player_id');
      if (!guestPlayerId) {
        guestPlayerId = crypto.randomUUID();
        localStorage.setItem('guest_player_id', guestPlayerId);
      }

      const { data, error } = await supabase.functions.invoke('join-lobby', {
        body: {
          lobbyCode: lobbyCode.toUpperCase(),
          playerName: playerName.trim(),
          playerId: guestPlayerId,
        },
      });

      if (error) {
        throw new Error(error.message || "Failed to join lobby");
      }
      
      toast({
        title: "Success!",
        description: "Joined the lobby successfully",
      });
      
      navigate(`/lobby/${data.session.id}`);
    } catch (error: any) {
      console.error("Error joining lobby:", error);
      toast({
        title: "Failed to Join",
        description: error.message || "Could not join the lobby",
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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <DebugInfo 
          tenant={tenant}
          shopDomain={shopDomain}
          customer={null}
          backendConnected={true}
        />

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Phraseotomy
            </CardTitle>
            <CardDescription>
              Welcome! Log in to host games
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              onClick={handleLogin}
              className="w-full"
              size="lg"
            >
              Log in with Shopify
            </Button>
            
            {tenant && (
              <p className="text-xs text-center text-muted-foreground">
                Connected to {tenant.name}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl text-center">Join a Game</CardTitle>
            <CardDescription className="text-center">
              Enter the lobby code to join
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleJoinGame} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="lobbyCode">Lobby Code</Label>
                <Input
                  id="lobbyCode"
                  placeholder="Enter 6-digit code"
                  value={lobbyCode}
                  onChange={(e) => setLobbyCode(e.target.value.toUpperCase())}
                  maxLength={6}
                  className="text-center text-lg tracking-widest font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="playerName">Your Name</Label>
                <Input
                  id="playerName"
                  placeholder="Enter your name"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={isJoining || !lobbyCode.trim() || !playerName.trim()}
              >
                {isJoining ? "Joining..." : "Join Game"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Login;
