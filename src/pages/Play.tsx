import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/Header";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import type { TenantConfig, ShopifyCustomer } from "@/lib/types";
import { APP_VERSION } from "@/lib/types";
import { getCustomerData, type CustomerLicense, type GameSession } from "@/lib/customerAccess";
import { getCustomerThemes } from "@/lib/themeCodeUtils";
import { lobbyCodeSchema, validateInput } from "@/lib/validation";
import { supabase } from "@/integrations/supabase/client";
import { getAllUrlParams } from "@/lib/urlUtils";
import { redeemCode, redirectToShopifyWithError } from "@/lib/redemption";
import { ShopThemesDialog } from "@/components/ShopThemesDialog";

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
  const [availablePacks, setAvailablePacks] = useState<{ id: string; name: string; description: string | null }[]>([]);
  const [unlockedThemes, setUnlockedThemes] = useState<{ id: string; name: string; is_core: boolean }[]>([]);
  const [showRedeemDialog, setShowRedeemDialog] = useState(false);
  const [showShopThemesDialog, setShowShopThemesDialog] = useState(false);
  const [nameAutoSaveAttempted, setNameAutoSaveAttempted] = useState(false);
  const [isUpdatingName, setIsUpdatingName] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  // Code from URL, console, or sessionStorage (set by App.tsx before URL was cleaned)
  useEffect(() => {
    const urlParams = getAllUrlParams();
    const codeFromUrl = urlParams.get("Code") || urlParams.get("code");
    const codeFromConsole = (window as unknown as { __PHRASEOTOMY_LOBBY_CODE__?: string }).__PHRASEOTOMY_LOBBY_CODE__;
    const codeFromStorage = sessionStorage.getItem("phraseotomy_url_code");
    const code = codeFromUrl || codeFromConsole || codeFromStorage;

    console.log("🎮 [Play] Code sources:", {
      fromUrl: codeFromUrl ?? null,
      fromConsole: codeFromConsole ?? null,
      fromStorage: codeFromStorage ?? null,
      resolved: code ?? null,
    });

    if (code && typeof code === "string" && /^[A-Za-z0-9]{6}$/.test(code.trim())) {
      const normalized = code.trim().toUpperCase();
      setLobbyCode(normalized);
      sessionStorage.setItem("phraseotomy_url_code", normalized);
      console.log("🎮 [Play] Lobby code set:", normalized);
    }
  }, []);

  // Check if customer needs to enter their name
  const customerNeedsName = (cust: ShopifyCustomer | null): boolean => {
    if (!cust) return false;
    const hasName = cust.name && cust.name.trim().length > 0;
    const hasFirstName = cust.firstName && cust.firstName.trim().length > 0;
    return !hasName && !hasFirstName;
  };

  // Function to extract and format name from email
  const extractNameFromEmail = (email: string | null): string => {
    if (!email) return "";

    // Extract part before @
    const emailPrefix = email.split("@")[0];

    // Replace special characters (., _, -, +, etc.) with spaces
    const withSpaces = emailPrefix.replace(/[._\-+]/g, " ");

    // Split by spaces and capitalize each word
    const words = withSpaces.split(/\s+/).filter(word => word.length > 0);
    const capitalizedWords = words.map(word => {
      if (word.length === 0) return "";
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    });

    return capitalizedWords.join(" ");
  };


  // Fetch customer data and update state
  // const fetchAndSetCustomerData = async (customerId: string, shopDomain: string) => {
  //   try {
  //     const customerData = await getCustomerData(customerId, shopDomain);

  //     if (customerData?.customer) {
  //       setCustomer(prev => {
  //         if (!prev) return prev;

  //         return {
  //           id: customerData.customer.id,
  //           email: customerData.customer.email ?? prev.email ?? null,
  //           name: customerData.customer.name ?? prev.name ?? null,
  //           firstName: customerData.customer.first_name ?? prev.firstName ?? null,
  //           lastName: customerData.customer.last_name ?? prev.lastName ?? null,
  //         };
  //       });
  //     }

  //   } catch (error) {
  //     console.error("Error fetching customer data after name update:", error);
  //   }
  // };

  // Auto-save name from email without showing dialog
 const autoSaveNameFromEmail = async (customerData: ShopifyCustomer, shopDomain: string) => {
  if (!customerData.email) return;

  const extractedName = extractNameFromEmail(customerData.email);
  if (!extractedName || extractedName.length < 2) return;

  try {
    setIsUpdatingName(true); // 🔥 START BLOCKING FETCH

    const { data, error } = await supabase.functions.invoke("update-customer-name", {
      body: {
        customer_id: customerData.id,
        customer_name: extractedName,
        shop_domain: shopDomain,
      },
    });

    if (error || data?.error) {
      console.error("Error auto-saving name:", error || data?.error);
      return;
    }

    const nameParts = extractedName.split(" ");

    setCustomer(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        name: extractedName,
        firstName: nameParts[0],
        lastName: nameParts.slice(1).join(" ") || null,
      };
    });
    const existingData = localStorage.getItem("customerData");
if (existingData) {
  const parsed = JSON.parse(existingData);
  parsed.name = extractedName;
  parsed.first_name = nameParts[0];
  parsed.last_name = nameParts.slice(1).join(" ") || null;
  localStorage.setItem("customerData", JSON.stringify(parsed));
}

    
    console.log("✅ Name auto-saved from email:", extractedName);

  } catch (error) {
    console.error("Error auto-saving name:", error);
  } finally {
    setIsUpdatingName(false); // 🔥 ALLOW FETCH AGAIN
  }
};

  // Store customer in database on first login
  const storeCustomerInDatabase = async (customerData: ShopifyCustomer, shopDomain: string, tenantId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("store-customer", {
        body: {
          customer_id: customerData.id,
          customer_email: customerData.email,
          customer_name: customerData.name,
          first_name: customerData.firstName,
          last_name: customerData.lastName,
          shop_domain: shopDomain,
          tenant_id: tenantId,
        },
      });

      if (error) {
        console.error("Error storing customer:", error);
      } else {
        if (data?.customer) {
          const existingData = localStorage.getItem("customerData");
          const existing = existingData ? JSON.parse(existingData) : {};

          localStorage.setItem(
            "customerData",
            JSON.stringify({
              ...existing,
              db_id: data.customer.id,
              email: data?.customer?.customer_email,
              staging_customer_id: data.customer.staging_customer_id,
              prod_customer_id: data.customer.prod_customer_id,
              is_new: data.is_new,
            }),
          );
        }
      }
    } catch (error) {
      console.error("Error calling store-customer:", error);
    }
  };

  // Initialize from localStorage and verify session
  useEffect(() => {
    const initializeSession = async () => {
      const urlParams = getAllUrlParams();

      // PRIORITY: Check for redeem code parameters FIRST (before any other checks)
      // This handles Shopify redirects with redeem code params in URL hash
      const redeemCodeParam = urlParams.get("Code") || urlParams.get("code");
      const customerIdParam = urlParams.get("CustomerId") || urlParams.get("customer_id");
      const customerEmailParam = urlParams.get("CustomerEmail") || urlParams.get("customer_email");
      const shopDomainParam = urlParams.get("shop_domain");

      if (redeemCodeParam && customerIdParam && shopDomainParam) {
        console.log('🎟️ [PLAY] Redeem code params detected on Play page:', {
          Code: redeemCodeParam,
          CustomerId: customerIdParam,
          CustomerEmail: customerEmailParam,
          shop_domain: shopDomainParam
        });

        try {
          // Call redeem-license-code API
          const redeemResult = await redeemCode(redeemCodeParam, customerIdParam, shopDomainParam);

          if (!redeemResult.success) {
            // Failed - redirect to Shopify with error message
            console.error('❌ Redeem code failed:', redeemResult.message);
            redirectToShopifyWithError(redeemResult.message);
            return;
          }

          // Success - redirect to Shopify app page
          console.log('✅ Redeem code successful:', redeemResult.message);
          // window.location.href = 'https://phraseotomy.com/apps/phraseotomy';
          window.top.location.href = 'https://phraseotomy.com/pages/play-online';
          return;
        } catch (error) {
          console.error('❌ Error processing redeem code:', error);
          const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred. Please try again.";
          redirectToShopifyWithError(errorMessage);
          return;
        }
      }

      // Check for embedded config from proxy (primary method)
      if (window.__PHRASEOTOMY_CONFIG__ && window.__PHRASEOTOMY_SHOP__) {
        setTenant(window.__PHRASEOTOMY_CONFIG__);
        setShopDomain(window.__PHRASEOTOMY_SHOP__);

        if (window.__PHRASEOTOMY_CUSTOMER__) {
          setCustomer(window.__PHRASEOTOMY_CUSTOMER__);

          // Store customer data in localStorage for Lobby page
          localStorage.setItem(
            "customerData",
            JSON.stringify({
              customer_id: window.__PHRASEOTOMY_CUSTOMER__.id,
              id: window.__PHRASEOTOMY_CUSTOMER__.id,
              email: window.__PHRASEOTOMY_CUSTOMER__.email,
              name: window.__PHRASEOTOMY_CUSTOMER__.name,
              first_name: window.__PHRASEOTOMY_CUSTOMER__.firstName,
              last_name: window.__PHRASEOTOMY_CUSTOMER__.lastName,
            }),
          );

          // Store customer in database
          storeCustomerInDatabase(
            window.__PHRASEOTOMY_CUSTOMER__,
            window.__PHRASEOTOMY_SHOP__,
            window.__PHRASEOTOMY_CONFIG__.id,
          );
        }

        setLoading(false);
        return;
      }

      // Check for iframe config from URL parameters (fallback method)
      const configParam = urlParams.get("config");
      const shopParam = urlParams.get("shop");
      const customerParam = urlParams.get("customer");

      if (configParam && shopParam) {
        try {
          const tenantConfig = JSON.parse(configParam);
          const customerData = customerParam ? JSON.parse(customerParam) : null;

          setTenant(tenantConfig);
          setShopDomain(shopParam);

          if (customerData) {
            setCustomer(customerData);

            // Store customer data in localStorage for Lobby page
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

            // Store customer in database
            storeCustomerInDatabase(customerData, shopParam, tenantConfig.id);
          }

          setLoading(false);
          return;
        } catch (error) {
          console.error("Error parsing URL config:", error);
        }
      }

      // Check if accessed from Shopify embedded app (has host parameter)
      const hostParam = urlParams.get("host");

      if (hostParam && shopParam) {
        navigate(`/login?shop=${shopParam}&host=${hostParam}`, { replace: true });
        return;
      }

      const sessionToken = localStorage.getItem("phraseotomy_session_token");
      const storedCustomerData = localStorage.getItem("customerData");

      if (!sessionToken || !storedCustomerData) {
        navigate("/login", { replace: true });
        return;
      }

      try {
        // Verify session token is still valid
        const { data: customerData, error: customerError } = await supabase.functions.invoke("get-customer-data", {
          body: { sessionToken },
        });

        if (customerError || !customerData) {
          console.warn("⚠️ Invalid session, clearing and redirecting to login");
          localStorage.removeItem("phraseotomy_session_token");
          localStorage.removeItem("customerData");
          navigate("/login", { replace: true });
          return;
        }

        // Use licenses and sessions from get-customer-data so UI shows correct packs / host eligibility
        setLicenses(customerData.licenses || []);
        setSessions(customerData.sessions || []);

        // Decode session token to get customer info
        const [payloadB64] = sessionToken.split(".");
        if (payloadB64) {
          const payload = JSON.parse(atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/")));

          // Check if token is expired
          if (payload.exp && payload.exp * 1000 < Date.now()) {
            console.warn("⚠️ Session token expired, redirecting to login");
            localStorage.removeItem("phraseotomy_session_token");
            localStorage.removeItem("customerData");
            navigate("/login", { replace: true });
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

              // Store customer in database
              storeCustomerInDatabase(customerObj, dbTenant.shop_domain, dbTenant.id);
            }
          }

          console.log("✅ Session restored successfully");
        }
      } catch (error) {
        console.error("Error restoring session:", error);
        localStorage.removeItem("phraseotomy_session_token");
        localStorage.removeItem("customerData");
        navigate("/login", { replace: true });
        return;
      }

      setLoading(false);
    };

    initializeSession();
  }, [navigate]);

  // Auto-save name from email when customer has no name (no dialog)
  useEffect(() => {
    if (!loading && customer && shopDomain && customerNeedsName(customer) && customer.email && !nameAutoSaveAttempted) {
      setNameAutoSaveAttempted(true);
      autoSaveNameFromEmail(customer, shopDomain);
    }
  }, [loading, customer, shopDomain, nameAutoSaveAttempted]);

  // Load customer data when logged in (use get-customer-data so licenses match session and show correct packs)
  useEffect(() => {
if (!loading && customer?.id && shopDomain && !isUpdatingName) {
      const fetchCustomerData = async () => {
        setDataLoading(true);
        try {
          const tenantId = tenant?.id;
          const sessionToken = localStorage.getItem("phraseotomy_session_token");

          const [customerDataResponse, packsData, customerThemes] = await Promise.all([
            sessionToken
              ? supabase.functions.invoke("get-customer-data", { body: { sessionToken } })
              : getCustomerData(customer.id, shopDomain).then((data) => ({ data, error: null })),
            tenantId
              ? supabase
                  .from("packs")
                  .select("id, name, description")
                  .eq("tenant_id", tenantId)
              : Promise.resolve({ data: [], error: null }),
            getCustomerThemes(customer.id, shopDomain),
          ]);

          const customerData = customerDataResponse?.data;
          const hasError = customerDataResponse?.error != null;

          if (packsData.data) {
            setAvailablePacks(packsData.data);
          }

          if (!hasError && customerData) {
            if (customerData.customer) {
              setCustomer(prev => {
                if (!prev) return prev;

                return {
                  id: customerData.customer.id,
                  email: customerData.customer.email ?? prev.email ?? null,

                  // 🔥 Only overwrite name if backend actually has one
                  name:
                    customerData.customer.name && customerData.customer.name.trim().length > 0
                      ? customerData.customer.name
                      : prev.name,

                  firstName:
                    customerData.customer.first_name && customerData.customer.first_name.trim().length > 0
                      ? customerData.customer.first_name
                      : prev.firstName,

                  lastName:
                    customerData.customer.last_name && customerData.customer.last_name.trim().length > 0
                      ? customerData.customer.last_name
                      : prev.lastName,
                };
              });
            }
            setLicenses(customerData.licenses || []);
            setSessions(customerData.sessions || []);
          }

          // Parse and set unlocked themes
          if (Array.isArray(customerThemes)) {
            // Flatten and extract theme info
            const themes: { id: string; name: string; is_core: boolean }[] = [];
            customerThemes.forEach((themeCode: any) => {
              const themeCodeThemes = themeCode.theme_codes?.theme_code_themes || [];
              themeCodeThemes.forEach((tt: any) => {
                if (tt.themes) {
                  themes.push({
                    id: tt.themes.id,
                    name: tt.themes.name,
                    is_core: tt.themes.is_core,
                  });
                }
              });
            });
            // Remove duplicates by id
            const uniqueThemes = Array.from(new Map(themes.map(t => [t.id, t])).values());
            setUnlockedThemes(uniqueThemes);
          }
        } catch (error) {
          console.error("Error loading customer data:", error);
        } finally {
          setDataLoading(false);
        }
      };

      fetchCustomerData();
    }
  }, [loading, customer?.id, shopDomain, isUpdatingName]);
  const handleJoinGame = async () => {
    if (isJoining) return; // Prevent multiple submissions
    setIsJoining(true);
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
        // Extract error message from response body
        // When edge function returns non-2xx, the actual error message is in the response body
        let errorMessage = "Could not join the lobby";

        try {
          // Try to parse the error response body from error.context (Response object)
          if (error.context && error.context instanceof Response) {
            // Clone the response since it can only be read once
            const clonedResponse = error.context.clone();
            const responseBody = await clonedResponse.json();
            if (responseBody?.error) {
              errorMessage = responseBody.error;
            }
          } else if (data?.error) {
            // Fallback: check if error is in data
            errorMessage = data.error;
          } else if (error.message && error.message !== "Edge Function returned a non-2xx status code") {
            // Use error.message if it's not the generic Supabase message
            errorMessage = error.message;
          }
        } catch (parseError) {
          // If JSON parsing fails, try to get text from response
          try {
            if (error.context && error.context instanceof Response) {
              const clonedResponse = error.context.clone();
              const textBody = await clonedResponse.text();
              if (textBody) {
                const parsed = JSON.parse(textBody);
                if (parsed?.error) {
                  errorMessage = parsed.error;
                }
              }
            }
          } catch (e) {
            // If all parsing fails, use generic message
            console.error("Error parsing error response:", e);
          }
        }

        toast({
          title: "Unable to Join",
          description: errorMessage,
          variant: "destructive",
        });
        setIsJoining(false);
        return;
      }

      if (data?.session) {
        // Store player ID for lobby identification (critical for "(You)" display)
        sessionStorage.setItem("lobby_player_id", playerId);
        localStorage.setItem("lobby_player_id", playerId);
        sessionStorage.setItem("current_lobby_session", data.session.id);
        localStorage.setItem("current_lobby_session", data.session.id);

        // Clear the lobby code input
        setLobbyCode("");

        // Check if user was already in the lobby
        if (data.message === "Already in lobby") {
          toast({
            title: "Already in Lobby",
            description: `You're already in lobby ${validatedLobbyCode}. Redirecting...`,
          });
        } else {
          // New join - show success message
          toast({
            title: "Successfully Joined! 🎮",
            description: `Welcome to lobby ${validatedLobbyCode}. Waiting for other players...`,
          });
        }

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
      setIsJoining(false);
    }
  };

  const handleHostGame = () => {
    if (!hasActiveLicenses) {
      setShowRedeemDialog(true);
      return;
    }
    navigate("/create-lobby", {
      state: { customer, shopDomain, tenant },
    });
  };


  const handleLogout = () => {
    // Clear local storage
    localStorage.removeItem("phraseotomy_session_token");
    localStorage.removeItem("customerData");
    localStorage.removeItem("shop_domain");
    // Always redirect to login page after logout
    navigate("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen-safe bg-game-black flex items-center justify-center px-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-game-yellow border-t-transparent mx-auto"></div>
          <p className="mt-4 text-game-yellow">Loading...</p>
        </div>
      </div>
    );
  }

  const appEnv = import.meta.env.VITE_APP_ENV || "development";


  // Filter out expired licenses (safety check - should already be filtered by backend)
  const now = new Date();
  const activeLicenses = licenses.filter(license => {
    if (license.expires_at) {
      const expiryDate = new Date(license.expires_at);
      return expiryDate >= now; // Only include non-expired licenses
    }
    return true; // Include licenses without expiration
  });

  const hasActiveLicenses = activeLicenses.length > 0;
  const allPacks = Array.from(new Set(activeLicenses.flatMap((l) => l.packs_unlocked)));
  const earliestExpiry = activeLicenses.reduce(
    (earliest, license) => {
      if (!license.expires_at) return earliest;
      const expiryDate = new Date(license.expires_at);
      return !earliest || expiryDate < earliest ? expiryDate : earliest;
    },
    null as Date | null,
  );

  // Unlocked themes display (for demo, can be styled as needed)
  const unlockedThemeNames = unlockedThemes.map(t => t.name);


  return (
    <div className="min-h-screen-safe bg-game-black flex flex-col">
      {/* <Header /> */}
      <div className="flex-1 flex flex-col items-center justify-between px-4 py-8 pb-safe">

        {/* Redeem Code Dialog */}
        <Dialog open={showRedeemDialog} onOpenChange={setShowRedeemDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Redeem Code Required</DialogTitle>
              <DialogDescription>
                If you want to host a game, you need to redeem a code first.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowRedeemDialog(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  window.open("https://phraseotomy.com/pages/redeem-code", "_blank");
                  setShowRedeemDialog(false);
                }}
                className="bg-game-yellow hover:bg-game-yellow/90 text-game-black"
              >
                Redeem Code
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>


        {/* Unlocked Themes Display */}
        {unlockedThemes.length > 0 && (
          <div className="w-full max-w-2xl text-center pt-4">
            <h3 className="text-lg font-semibold text-game-yellow mb-2">Unlocked Themes</h3>
            <div className="flex flex-wrap gap-2 justify-center">
              {unlockedThemes.map(theme => (
                <Badge
                  key={theme.id}
                  variant="secondary"
                  className="bg-game-yellow/20 text-game-yellow border-game-yellow/30 px-3 py-1"
                >
                  ✓ {theme.name}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <div className="w-full max-w-2xl space-y-5">
          {/* Welcome message */}
          <div className="text-center flex items-center justify-center gap-6">
            <h2 className="text-xl font-bold text-white">Welcome, {customer?.name?.trim() ? customer.name : customer?.email || "Player"}!</h2>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              Logout
            </Button>
          </div>
          {/*PLAY ONLINE */}
          {/* <div className="w-full max-w-2xl pt-8">
            <Card className="bg-card border-game-gray">
              <CardHeader>
                <CardTitle className="text-lg">
                  Play Online
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-1">
                <p>Activate the Core Pack to host online games.</p>
                <p>Play with friends by sharing your Lobby ID.</p>
              </CardContent>
            </Card>
          </div> */}


          {/* Your Packs Card */}
          <Card className="bg-card border-game-gray">
            {/* <CardHeader>
              <CardTitle className="text-lg">Your Packs</CardTitle>
            </CardHeader>  */}

            <CardContent className="space-y-4">
              {dataLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              ) : (
                <>
                  {/* <div>
                    <p className="text-xs text-muted-foreground mb-2">Unlocked</p>
                    <div className="flex flex-wrap gap-2">
                      {allPacks.length > 0 ? (
                        allPacks.map((pack) => (
                          <Badge
                            key={pack}
                            variant="secondary"
                            className="bg-game-yellow/20 text-game-yellow border-game-yellow/30 px-3 py-1"
                          >
                            ✓ {pack}
                          </Badge>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">No packs unlocked yet</p>
                      )}
                    </div> 
                  </div>*/}
                  {availablePacks.filter((p) => !allPacks.includes(p.name)).length > 0 && (
                    <div className="pt-3 border-t border-border">
                      <p className="text-xs text-muted-foreground mb-2">Available to Unlock</p>
                      <div className="flex flex-wrap gap-2">
                        {/* {availablePacks
                          .filter((p) => !allPacks.includes(p.name))
                          .map((pack) => (
                            <Badge
                              key={pack.id}
                              variant="outline"
                              className="bg-muted/30 text-muted-foreground border-muted px-3 py-1 opacity-60"
                            >
                              🔒 {pack.name}
                            </Badge>
                          ))} */}
                      </div>
                    </div>
                  )}

                  <div className="pt-4 border-t border-border">
                    <div className="bg-gradient-to-r from-game-yellow/10 to-game-yellow/5 rounded-lg p-4 border border-game-yellow/20">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-semibold text-game-yellow text-sm">🎨 Want more themes?</h4>
                          <p className="text-xs text-muted-foreground mt-1">Browse and unlock additional themes!</p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-game-yellow text-game-yellow hover:bg-game-yellow hover:text-game-black"
                          onClick={() => setShowShopThemesDialog(true)}
                        >
                          Shop Themes
                        </Button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Host New Game */}
          <Card className="bg-card border-game-gray">
            <CardHeader>
              <CardTitle className="text-lg">Host New Game</CardTitle>
              <CardDescription>
                Start a new game session and invite friends
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-0\2">
              <Button
                onClick={handleHostGame}
                className="w-full bg-game-yellow hover:bg-game-yellow/90 text-game-black font-bold"
                size="lg"
              >
                Host New Game
              </Button>
            </CardContent>
          </Card>

          {/* My Games */}
          <Card className="bg-card border-game-gray">
            <CardHeader>
              <CardTitle className="text-lg">My Games</CardTitle>
              <CardDescription>Games you're hosting or have joined</CardDescription>
            </CardHeader>
            <CardContent>
              {dataLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : sessions.length > 0 ? (
                <div className="space-y-3 max-h-[160px] overflow-y-auto pr-1">
                  {sessions.map((session) => (
                    <div
                      key={session.id}
                      className="flex items-center justify-between p-4 bg-game-gray/30 rounded-lg border border-game-yellow/20"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-mono text-lg text-game-yellow font-bold">{session.lobby_code}</p>
                          <Badge
                            variant={session.is_host ? "default" : "secondary"}
                            className={
                              session.is_host
                                ? "bg-game-yellow text-game-black text-xs"
                                : "bg-muted text-muted-foreground text-xs"
                            }
                          >
                            {session.is_host ? "Host" : "Joined"}
                          </Badge>
                        </div>
                        {session.game_name && <p className="text-sm text-white">{session.game_name}</p>}
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="capitalize">{session.status}</span>
                          {session.player_count !== undefined && <span>• {session.player_count}/12 players</span>}
                          {!session.is_host && session.host_customer_name && (
                            <span>• Hosted by {session.host_customer_name}</span>
                          )}
                        </div>
                      </div>
                      {session.status === "completed" ? (
                        <div className="px-3 py-1 bg-destructive/20 text-destructive text-sm font-medium rounded">
                          Ended
                        </div>
                      ) : (
                        <Button variant="outline" size="sm" onClick={() => navigate(`/lobby/${session.id}`)}>
                          Rejoin
                        </Button>
                      )}
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
              <CardDescription>Enter a lobby code to join someone else game</CardDescription>
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
              <Button onClick={handleJoinGame} className="w-full" size="lg" disabled={isJoining}>
                {isJoining ? "Joining Game..." : "Join Game"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Shop Themes Dialog */}
      {tenant && customer && shopDomain && (
        <ShopThemesDialog
          open={showShopThemesDialog}
          onOpenChange={setShowShopThemesDialog}
          tenantId={tenant.id}
          customerId={customer.id}
          shopDomain={shopDomain}
        />
      )}
    </div>
  );
};

export default Play;