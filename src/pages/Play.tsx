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
import { CustomerAudioUpload } from "@/components/CustomerAudioUpload";
import type { TenantConfig, ShopifyCustomer } from "@/lib/types";
import { APP_VERSION } from "@/lib/types";
import { getCustomerLicenses, getCustomerSessions, type CustomerLicense, type GameSession } from "@/lib/customerAccess";
import { getAppBridge } from "@/lib/appBridge";
import { lobbyCodeSchema, playerNameSchema, redemptionCodeSchema, validateInput } from "@/lib/validation";
import { supabase } from "@/integrations/supabase/client";
import { redeemCode } from "@/lib/redemption";

// Extend window to include embedded config and customer data

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
  const [isRedeeming, setIsRedeeming] = useState(false);

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
      const customerData = window.__PHRASEOTOMY_CUSTOMER__ || null;
      setCustomer(customerData);
      
      // Log customer data when available from proxy
      if (customerData) {
        console.log('👤 Customer Data from Proxy:', {
          id: customerData.id,
          email: customerData.email,
          name: customerData.name,
          firstName: customerData.firstName,
          lastName: customerData.lastName,
        });
        
        // Generate session token if customer is logged in
        generateAndStoreSessionToken(customerData.id, window.__PHRASEOTOMY_SHOP__).then(() => {
          // After session token is generated, fetch and log full customer data
          const sessionToken = localStorage.getItem('phraseotomy_session_token');
          if (sessionToken) {
            supabase.functions.invoke('get-customer-data', {
              body: { sessionToken },
            }).then(({ data: customerData, error }) => {
              if (!error && customerData) {
                console.log('📦 Full Customer Data (licenses & sessions):', {
                  licenses: customerData.licenses || [],
                  sessions: customerData.sessions || [],
                  tenantId: customerData.tenantId,
                });
              }
            });
          }
        });
      } else {
        console.log('ℹ️ No customer data in proxy - user not logged in');
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
          // Use secure edge function for token verification
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

            console.log('verifiedShop', verifiedShop);
            
            // Try to fetch customer data if session token exists
            const sessionToken = localStorage.getItem('phraseotomy_session_token');
            if (sessionToken) {
              try {
                const { data: customerData, error: customerError } = await supabase.functions.invoke('get-customer-data', {
                  body: { sessionToken },
                });

                if (!customerError && customerData) {
                  console.log('📦 Customer Data after token verification:', {
                    licenses: customerData.licenses || [],
                    sessions: customerData.sessions || [],
                    tenantId: customerData.tenantId,
                    sessionToken: sessionToken.substring(0, 20) + '...', // Log partial token for debugging
                  });

                  // Also decode session token to get customer_id
                  try {
                    const [payloadB64] = sessionToken.split('.');
                    if (payloadB64) {
                      const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));
                      console.log('👤 Customer Info from session token:', {
                        customer_id: payload.customer_id,
                        shop: payload.shop,
                        exp: payload.exp,
                        expiresAt: new Date(payload.exp * 1000).toISOString(),
                      });
                    }
                  } catch (decodeError) {
                    console.warn('Could not decode session token:', decodeError);
                  }
                } else {
                  console.warn('⚠️ Could not fetch customer data:', customerError);
                }
              } catch (error) {
                console.error('Error fetching customer data:', error);
              }
            } else {
              console.log('ℹ️ No session token found - customer data will be available after proxy redirect');
            }
            
            // Load tenant for verified shop and continue flow
            let loadedTenantId: string | undefined;
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
                loadedTenantId = dbTenant.id;
                setTenant(mappedTenant);
                setShopDomain(dbTenant.shop_domain);
                console.log('✅ Tenant loaded after token verification:', mappedTenant);
              } else {
                console.warn('⚠️ Tenant not found for shop:', verifiedShop);
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
                      tenantId: customerData.tenantId,
                    });

                    // Set customer state with data from Shopify
                    const customerObj: ShopifyCustomer = {
                      id: customerIdParam,
                      email: customerData.customer?.email || null,
                      firstName: customerData.customer?.first_name || null,
                      lastName: customerData.customer?.last_name || null,
                      name: customerData.customer?.name || null,
                    };
                    setCustomer(customerObj);

                    // Set licenses and sessions
                    setLicenses(customerData.licenses || []);
                    setSessions(customerData.sessions || []);

                    // Clean up URL parameters
                    const cleanUrl = window.location.pathname;
                    window.history.replaceState({}, document.title, cleanUrl);
                  } else {
                    console.warn('⚠️ Could not fetch customer data:', customerError);
                  }
                  
                  // Set loading to false after customer data is processed
                  setLoading(false);
                }
              } catch (error) {
                console.error('Error processing customer data:', error);
                setLoading(false);
              }
            } else {
              // No customer_id in URL, set loading to false
              console.log('ℹ️ No customer_id in URL - user not logged in or will be available via proxy');
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
      // Try to auto-detect tenant by app domain or fallback to first active tenant
      const fetchTenant = async () => {
        try {
          // Import auto-detect function
          const { autoDetectTenant } = await import("@/lib/tenants");
          const detectedTenant = autoDetectTenant(urlParams);
          
          if (detectedTenant && detectedTenant.shopDomain) {
            // Load the detected tenant from database
            const { data: dbTenant } = await (await import("@/integrations/supabase/client")).supabase
              .from("tenants")
              .select("id, name, tenant_key, shop_domain, environment")
              .eq("shop_domain", detectedTenant.shopDomain)
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
              console.log('✅ Tenant auto-detected and loaded:', {
                detectionMethod: detectedTenant.appDomains ? 'app domain' : 'shop parameter',
                hostname: window.location.hostname,
                tenant: mappedTenant,
              });
            }
          } else {
            // Fallback: load first active tenant
            console.log('ℹ️ No tenant auto-detected, loading first active tenant as fallback');
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

  // Restore session from localStorage if exists
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get("r");
    const customerId = urlParams.get("customer_id");
    
    // Only attempt session restoration if there's no active login flow
    if (!token && !customerId && !customer) {
      const sessionToken = localStorage.getItem('phraseotomy_session_token');
      
      if (sessionToken) {
        console.log('🔄 Attempting to restore session from localStorage...');
        
        const restoreSession = async () => {
          try {
            const { data: customerData, error: customerError } = await supabase.functions.invoke('get-customer-data', {
              body: { sessionToken },
            });

            if (!customerError && customerData) {
              console.log('✅ Session restored successfully:', {
                customer: customerData.customer,
                licenses: customerData.licenses || [],
                sessions: customerData.sessions || [],
                shopDomain: customerData.shopDomain,
              });

              // Decode session token to get customer_id
              try {
                const [payloadB64] = sessionToken.split('.');
                if (payloadB64) {
                  const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));
                  
                  // Check if token is expired
                  if (payload.exp && payload.exp * 1000 < Date.now()) {
                    console.warn('⚠️ Session token expired, clearing...');
                    localStorage.removeItem('phraseotomy_session_token');
                    return;
                  }
                  
                  // Set customer state
                  const customerObj: ShopifyCustomer = {
                    id: payload.customer_id,
                    email: customerData.customer?.email || null,
                    firstName: customerData.customer?.first_name || null,
                    lastName: customerData.customer?.last_name || null,
                    name: customerData.customer?.name || null,
                  };
                  setCustomer(customerObj);

                  // Set shop domain from payload
                  if (payload.shop) {
                    setShopDomain(payload.shop);
                  }

                  // Set licenses and sessions
                  setLicenses(customerData.licenses || []);
                  setSessions(customerData.sessions || []);
                }
              } catch (decodeError) {
                console.error('Error decoding session token:', decodeError);
                localStorage.removeItem('phraseotomy_session_token');
              }
            } else {
              console.warn('⚠️ Invalid session token, clearing...', customerError);
              localStorage.removeItem('phraseotomy_session_token');
            }
          } catch (error) {
            console.error('Error restoring session:', error);
            localStorage.removeItem('phraseotomy_session_token');
          }
        };
        
        restoreSession();
      }
    }
  }, []); // Run once on mount

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
            customer: {
              id: customer.id,
              email: customer.email,
              name: customer.name,
            },
            licenses: {
              count: customerLicenses.length,
              details: customerLicenses.map(l => ({
                id: l.id,
                code: l.code,
                packs_unlocked: l.packs_unlocked,
                status: l.status,
                expires_at: l.expires_at,
              })),
            },
            sessions: {
              count: customerSessions.length,
              details: customerSessions.map(s => ({
                id: s.id,
                lobby_code: s.lobby_code,
                status: s.status,
                packs_used: s.packs_used,
                created_at: s.created_at,
              })),
            },
            shopDomain,
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
        // Logged-in customer
        playerId = customer.id;
        playerName = customer.name || customer.email || "Customer";
      } else {
        // Guest player - validate name
        const validatedGuestName = validateInput(playerNameSchema, guestName);
        
        // Generate a unique guest ID
        playerId = `guest_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        playerName = validatedGuestName;
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
        description: error instanceof Error ? error.message : "Please check your lobby code and name",
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
                    <Button onClick={handleRedeemCode} disabled={redemptionCode.length !== 6 || isRedeeming}>
                      {isRedeeming ? "Redeeming..." : "Redeem"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Host New Game & Audio Upload */}
            {hasActiveLicenses && (
              <div className="space-y-4">
                <Card className="bg-card border-game-gray">
                  <CardHeader>
                    <CardTitle className="text-lg">Host New Game</CardTitle>
                    <CardDescription>
                      Start a new game session and invite friends
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button
                      onClick={handleHostGame}
                      className="w-full bg-game-yellow hover:bg-game-yellow/90 text-game-black font-bold"
                      size="lg"
                    >
                      Host New Game
                    </Button>
                  </CardContent>
                </Card>

                {tenant && (
                  <CustomerAudioUpload
                    customerId={customer!.id}
                    shopDomain={shopDomain}
                    tenantId={tenant.id}
                    onUploadComplete={() => {
                      toast({
                        title: "Success",
                        description: "Audio uploaded successfully!",
                      });
                    }}
                  />
                )}
              </div>
            )}

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
