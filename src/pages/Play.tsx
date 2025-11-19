// import { useEffect, useState } from "react";
// import { useNavigate } from "react-router-dom";
// import { Redirect } from "@shopify/app-bridge/actions";
// import { isSupabaseConfigured } from "@/lib/supabaseClient";
// import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
// import { Button } from "@/components/ui/button";
// import { Badge } from "@/components/ui/badge";
// import { Skeleton } from "@/components/ui/skeleton";
// import { Input } from "@/components/ui/input";
// import { useToast } from "@/hooks/use-toast";
// import type { TenantConfig } from "@/lib/types";
// import { APP_VERSION } from "@/lib/types";
// import { getCustomerLicenses, getCustomerSessions, type CustomerLicense, type GameSession } from "@/lib/customerAccess";
// import { getAppBridge } from "@/lib/appBridge";

// // Extend window to include embedded config and customer data

// const Play = () => {
//   const navigate = useNavigate();
//   const { toast } = useToast();
//   const [shopDomain, setShopDomain] = useState<string | null>(null);
//   const [tenant, setTenant] = useState<TenantConfig | null>(null);
//   const [customer, setCustomer] = useState<{ id: string; email: string; name: string } | null>(null);
//   const [licenses, setLicenses] = useState<CustomerLicense[]>([]);
//   const [sessions, setSessions] = useState<GameSession[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [dataLoading, setDataLoading] = useState(false);
//   const [lobbyCode, setLobbyCode] = useState("");
//   const [guestName, setGuestName] = useState("");
//   const [redemptionCode, setRedemptionCode] = useState("");

//   const [loginStatusFromUrl, setLoginStatusFromUrl] = useState<{
//     status: "success" | "failed" | "unknown";
//     params: Record<string, string>;
//   } | null>(null);

//   // Check for Shopify login success/failure parameters in URL
//   useEffect(() => {
//     const urlParams = new URLSearchParams(window.location.search);

//     // Common Shopify login redirect parameters
//     const loginStatus = urlParams.get("login");
//     const error = urlParams.get("error");
//     const errorDescription = urlParams.get("error_description");
//     const errorCode = urlParams.get("error_code");
//     const customerAccount = urlParams.get("customer_account");
//     const returnUrl = urlParams.get("return_url");
//     const checkoutToken = urlParams.get("checkout_token");
//     const state = urlParams.get("state");

//     // Collect all parameters for logging
//     const allParams: Record<string, string> = {};
//     urlParams.forEach((value, key) => {
//       allParams[key] = value;
//     });

//     // Determine login status
//     let status: "success" | "failed" | "unknown" = "unknown";

//     // Check for success indicators
//     if (loginStatus === "success" || customerAccount || checkoutToken) {
//       status = "success";
//       console.log("✅ Shopify login successful (from URL parameter)", {
//         loginStatus,
//         customerAccount,
//         checkoutToken,
//         returnUrl,
//         allParams,
//         timestamp: new Date().toISOString(),
//       });
//     }

//     // Check for failure indicators
//     if (loginStatus === "failed" || error || errorCode) {
//       status = "failed";
//       console.error("❌ Shopify login failed (from URL parameter)", {
//         loginStatus,
//         error,
//         errorCode,
//         errorDescription,
//         allParams,
//         timestamp: new Date().toISOString(),
//       });
//     }

//     // Log all URL parameters for debugging (always log if there are any params)
//     if (urlParams.toString()) {
//       console.log("📋 All URL Parameters after Shopify redirect:", allParams);
//       setLoginStatusFromUrl({
//         status,
//         params: allParams,
//       });
//     }

//     // Clean up URL parameters after reading them (optional - removes them from URL bar)
//     // Uncomment the lines below if you want to clean the URL after reading parameters
//     // if (urlParams.toString()) {
//     //   const cleanUrl = window.location.pathname;
//     //   window.history.replaceState({}, document.title, cleanUrl);
//     // }
//   }, []);

//   useEffect(() => {
//     // Check for embedded config from proxy (primary method)
//     if (window.__PHRASEOTOMY_CONFIG__ && window.__PHRASEOTOMY_SHOP__) {
//       setTenant(window.__PHRASEOTOMY_CONFIG__);
//       setShopDomain(window.__PHRASEOTOMY_SHOP__);
//       setCustomer(window.__PHRASEOTOMY_CUSTOMER__ || null);
//       setLoading(false);
//       return;
//     }

//     // Fallback: Load tenant from database for direct access (not through proxy)
//     const fetchTenant = async () => {
//       try {
//         // Only select safe columns (exclude shopify_client_secret for security)
//         const { data: dbTenant } = await (await import("@/integrations/supabase/client")).supabase
//           .from("tenants")
//           .select("id, name, tenant_key, shop_domain, environment")
//           .eq("is_active", true)
//           .limit(1)
//           .maybeSingle();

//         if (dbTenant) {
//           const mappedTenant: TenantConfig = {
//             id: dbTenant.id,
//             name: dbTenant.name,
//             tenant_key: dbTenant.tenant_key,
//             shop_domain: dbTenant.shop_domain,
//             environment: dbTenant.environment,
//             verified: true,
//           };
//           setTenant(mappedTenant);
//           setShopDomain(dbTenant.shop_domain);
//         }
//       } catch (error) {
//         console.error("Error loading tenant:", error);
//       } finally {
//         setLoading(false);
//       }
//     };

//     fetchTenant();
//   }, []);

//   // Load customer data when logged in
//   useEffect(() => {
//     if (!loading && customer && shopDomain) {
//       // Log successful login
//       console.log("✅ Login successful!", {
//         customer: {
//           id: customer.id,
//           email: customer.email,
//           name: customer.name,
//         },
//         shopDomain,
//         timestamp: new Date().toISOString(),
//       });

//       const fetchCustomerData = async () => {
//         setDataLoading(true);
//         try {
//           const [customerLicenses, customerSessions] = await Promise.all([
//             getCustomerLicenses(customer.id, shopDomain),
//             getCustomerSessions(customer.id, shopDomain),
//           ]);

//           setLicenses(customerLicenses);
//           setSessions(customerSessions);

//           console.log("✅ Customer data loaded:", {
//             licenses: customerLicenses.length,
//             sessions: customerSessions.length,
//           });
//         } catch (error) {
//           console.error("Error loading customer data:", error);
//         } finally {
//           setDataLoading(false);
//         }
//       };

//       fetchCustomerData();
//     }
//   }, [loading, customer, shopDomain]);

//   const handleJoinGame = () => {
//     if (!lobbyCode.trim()) {
//       toast({
//         title: "Missing Lobby Code",
//         description: "Please enter a lobby code to join a game.",
//         variant: "destructive",
//       });
//       return;
//     }

//     if (!customer && !guestName.trim()) {
//       toast({
//         title: "Missing Name",
//         description: "Please enter your name to join as a guest.",
//         variant: "destructive",
//       });
//       return;
//     }

//     toast({
//       title: "Coming Soon",
//       description: "Game lobby joining will be available soon.",
//     });
//   };

//   const handleHostGame = () => {
//     navigate("/create-lobby", {
//       state: { customer, shopDomain, tenant },
//     });
//   };

//   const handleRedeemCode = () => {
//     if (!redemptionCode.trim()) {
//       toast({
//         title: "Missing Code",
//         description: "Please enter a 6-digit code.",
//         variant: "destructive",
//       });
//       return;
//     }

//     toast({
//       title: "Coming Soon",
//       description: "Code redemption will be available soon.",
//     });
//   };

//   // const handleLogin = () => {
//   //   console.log("first url");
//   //   const effectiveShopDomain = shopDomain || tenant?.shop_domain;
//   //   if (!effectiveShopDomain) {
//   //     toast({
//   //       title: "Cannot Login",
//   //       description: "Shop domain not available. Please access this app through your Shopify store.",
//   //       variant: "destructive",
//   //     });
//   //     return;
//   //   }

//   //   console.log("hiii");

//   //   // Use the specific app URL for return redirect
//   //   // This ensures Shopify redirects back to your app after login
//   //   const appBaseUrl = "https://id-preview--46e7a4fc-a12f-4e7f-812c-75f62bdac4d4.lovable.app";
//   //   const returnUrl = `${appBaseUrl}/apps/phraseotomy`;

//   //   console.log("Redirecting to login with return URL:", returnUrl);

//   //   // Construct login URL with return_url parameter
//   //   // Shopify will redirect back to this URL after successful login
//   //   const loginUrl = `https://${effectiveShopDomain}/account/login?return_url=${encodeURIComponent(returnUrl)}`;

//   //   console.log("Login URL:", loginUrl);

//   //   // Direct redirect - works in App Proxy context and standalone
//   //   window.location.href = loginUrl;

//   //   console.log("hiiii");
//   // };

//   const handleLogin = () => {
//     console.log("first url");
//     const effectiveShopDomain = shopDomain || tenant?.shop_domain;
//     if (!effectiveShopDomain) {
//       toast({
//         title: "Cannot Login",
//         description: "Shop domain not available. Please access this app through your Shopify store.",
//         variant: "destructive",
//       });
//       return;
//     }

//     console.log("hiii");

//     // Use the specific app URL for return redirect
//     // This ensures Shopify redirects back to your app after login
//     const appBaseUrl = "https://id-preview--46e7a4fc-a12f-4e7f-812c-75f62bdac4d4.lovable.app";
//     const returnUrl = `${appBaseUrl}/apps/phraseotomy?login=success`;

//     console.log("Redirecting to login with return URL:", returnUrl);

//     // Construct login URL with return_url parameter
//     // Shopify will redirect back to this URL after successful login
//     const loginUrl = `https://${effectiveShopDomain}/account/login?return_url=${encodeURIComponent(returnUrl)}`;

//     console.log("Login URL:", loginUrl);

//     // Open login URL in a new tab/window
//     const newWindow = window.open(loginUrl, "_blank", "noopener,noreferrer");

//     // Check if popup was blocked
//     if (!newWindow || newWindow.closed || typeof newWindow.closed === "undefined") {
//       toast({
//         title: "Popup Blocked",
//         description: "Please allow popups for this site to open the login page in a new tab.",
//         variant: "destructive",
//       });
//     }

//     console.log("hiiii");
//   };

//   if (loading) {
//     return (
//       <div className="min-h-screen bg-game-black flex items-center justify-center px-4">
//         <div className="text-center">
//           <div className="animate-spin rounded-full h-12 w-12 border-4 border-game-yellow border-t-transparent mx-auto"></div>
//           <p className="mt-4 text-game-yellow">Loading...</p>
//         </div>
//       </div>
//     );
//   }

//   const appEnv = import.meta.env.VITE_APP_ENV || "development";
//   const hasActiveLicenses = licenses.length > 0;
//   const allPacks = Array.from(new Set(licenses.flatMap((l) => l.packs_unlocked)));
//   const earliestExpiry = licenses.reduce(
//     (earliest, license) => {
//       if (!license.expires_at) return earliest;
//       const expiryDate = new Date(license.expires_at);
//       return !earliest || expiryDate < earliest ? expiryDate : earliest;
//     },
//     null as Date | null,
//   );

//   return (
//     <div className="min-h-screen bg-game-black flex flex-col items-center justify-between px-4 py-8">
//       {/* Logo and Branding */}
//       <div className="w-full max-w-2xl text-center pt-8">
//         <div className="w-20 h-20 mx-auto mb-4 bg-game-yellow rounded-2xl flex items-center justify-center shadow-lg">
//           <span className="text-5xl font-black text-game-black">P</span>
//         </div>
//         <h1 className="text-4xl font-black text-white mb-2 tracking-wider">PHRASEOTOMY</h1>
//         <p className="text-sm text-game-yellow uppercase tracking-widest font-semibold">The Party Game</p>
//       </div>

//       {/* Main Content */}
//       <div className="w-full max-w-2xl space-y-6">
//         {!customer ? (
//           // STATE 1: Not logged in
//           <>
//             {/* Section A: Bought the game */}
//             <Card className="bg-card border-game-gray">
//               <CardHeader>
//                 <CardTitle className="text-xl">I bought the game</CardTitle>
//                 <CardDescription>Bought Phraseotomy? Log in to redeem your code and host games.</CardDescription>
//               </CardHeader>
//               <CardContent>
//                 <Button
//                   onClick={handleLogin}
//                   className="w-full bg-game-yellow hover:bg-game-yellow/90 text-game-black font-bold"
//                   size="lg"
//                 >
//                   Log in to Phraseotomy
//                 </Button>
//               </CardContent>
//             </Card>

//             {/* Section B: Joining a game */}
//             <Card className="bg-card border-game-gray">
//               <CardHeader>
//                 <CardTitle className="text-xl">I'm joining a game</CardTitle>
//                 <CardDescription>Joining a party? Enter the lobby code your host gave you.</CardDescription>
//               </CardHeader>
//               <CardContent className="space-y-4">
//                 <div className="space-y-2">
//                   <label className="text-sm text-muted-foreground">Lobby Code</label>
//                   <Input
//                     placeholder="Enter lobby code"
//                     value={lobbyCode}
//                     onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLobbyCode(e.target.value.toUpperCase())}
//                     maxLength={6}
//                   />
//                 </div>
//                 <div className="space-y-2">
//                   <label className="text-sm text-muted-foreground">Your Name</label>
//                   <Input
//                     placeholder="Enter your name"
//                     value={guestName}
//                     onChange={(e: React.ChangeEvent<HTMLInputElement>) => setGuestName(e.target.value)}
//                   />
//                 </div>
//                 <Button onClick={handleJoinGame} className="w-full" size="lg">
//                   Join Game
//                 </Button>
//               </CardContent>
//             </Card>
//           </>
//         ) : (
//           // STATE 2 & 3: Logged in
//           <>
//             {/* Welcome message */}
//             <div className="text-center">
//               <h2 className="text-2xl font-bold text-white">Welcome, {customer.name || customer.email}!</h2>
//             </div>

//             {/* Access Status Card */}
//             <Card className="bg-card border-game-gray">
//               <CardHeader>
//                 <CardTitle className="text-lg">Access Status</CardTitle>
//               </CardHeader>
//               <CardContent className="space-y-4">
//                 {dataLoading ? (
//                   <div className="space-y-2">
//                     <Skeleton className="h-4 w-full" />
//                     <Skeleton className="h-4 w-3/4" />
//                   </div>
//                 ) : hasActiveLicenses ? (
//                   <>
//                     <div className="flex items-center justify-between text-sm">
//                       <span className="text-muted-foreground">Access:</span>
//                       <span className="text-game-yellow font-semibold">
//                         Active {earliestExpiry ? `until ${earliestExpiry.toLocaleDateString()}` : ""}
//                       </span>
//                     </div>
//                     {allPacks.length > 0 && (
//                       <div className="pt-2 border-t border-border">
//                         <p className="text-xs text-muted-foreground mb-2">Packs unlocked:</p>
//                         <div className="flex flex-wrap gap-1.5">
//                           {allPacks.map((pack) => (
//                             <Badge
//                               key={pack}
//                               variant="secondary"
//                               className="bg-game-yellow/20 text-game-yellow border-game-yellow/30"
//                             >
//                               {pack}
//                             </Badge>
//                           ))}
//                         </div>
//                       </div>
//                     )}
//                   </>
//                 ) : (
//                   <div className="text-center py-4">
//                     <p className="text-muted-foreground mb-2">You don't have any active packs yet.</p>
//                     <p className="text-sm text-muted-foreground">
//                       Redeem a code from your Phraseotomy game to unlock themes and host games.
//                     </p>
//                   </div>
//                 )}

//                 {/* Redeem Code Section */}
//                 <div className="pt-4 border-t border-border space-y-3">
//                   <label className="text-sm font-medium">
//                     {hasActiveLicenses ? "Redeem another code" : "Redeem a code"}
//                   </label>
//                   <div className="flex gap-2">
//                     <Input
//                       placeholder="Enter code"
//                       value={redemptionCode}
//                       onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
//                         setRedemptionCode(e.target.value.toUpperCase())
//                       }
//                       maxLength={6}
//                     />
//                     <Button onClick={handleRedeemCode} disabled={redemptionCode.length !== 6}>
//                       Redeem
//                     </Button>
//                   </div>
//                 </div>
//               </CardContent>
//             </Card>

//             {/* Host New Game */}
//             <Card className="bg-card border-game-gray">
//               <CardHeader>
//                 <CardTitle className="text-lg">Host New Game</CardTitle>
//                 <CardDescription>
//                   {hasActiveLicenses ? "Start a new game session and invite friends" : "Redeem a code to host games"}
//                 </CardDescription>
//               </CardHeader>
//               <CardContent>
//                 <Button
//                   onClick={handleHostGame}
//                   disabled={!hasActiveLicenses}
//                   className="w-full bg-game-yellow hover:bg-game-yellow/90 text-game-black font-bold disabled:opacity-50 disabled:cursor-not-allowed"
//                   size="lg"
//                 >
//                   {hasActiveLicenses ? "Host New Game" : "Unlock with Code First"}
//                 </Button>
//               </CardContent>
//             </Card>

//             {/* Your Games */}
//             <Card className="bg-card border-game-gray">
//               <CardHeader>
//                 <CardTitle className="text-lg">Your Games</CardTitle>
//                 <CardDescription>Active game sessions you're hosting</CardDescription>
//               </CardHeader>
//               <CardContent>
//                 {dataLoading ? (
//                   <div className="space-y-2">
//                     <Skeleton className="h-16 w-full" />
//                   </div>
//                 ) : sessions.length > 0 ? (
//                   <div className="space-y-3">
//                     {sessions.map((session) => (
//                       <div
//                         key={session.id}
//                         className="flex items-center justify-between p-4 bg-game-gray/30 rounded-lg border border-game-yellow/20"
//                       >
//                         <div>
//                           <p className="font-mono text-lg text-game-yellow font-bold">{session.lobby_code}</p>
//                           <p className="text-xs text-muted-foreground capitalize">{session.status}</p>
//                         </div>
//                         <Button variant="outline" size="sm">
//                           Rejoin
//                         </Button>
//                       </div>
//                     ))}
//                   </div>
//                 ) : (
//                   <div className="text-center py-6 text-muted-foreground">
//                     <p className="mb-2">You don't have any active games yet.</p>
//                     <p className="text-sm">Host a new game to get started!</p>
//                   </div>
//                 )}
//               </CardContent>
//             </Card>

//             {/* Join Another Game */}
//             <Card className="bg-card border-game-gray">
//               <CardHeader>
//                 <CardTitle className="text-lg">Join Another Game</CardTitle>
//                 <CardDescription>Enter a lobby code to join someone else's game</CardDescription>
//               </CardHeader>
//               <CardContent className="space-y-4">
//                 <div className="space-y-2">
//                   <Input
//                     placeholder="Enter lobby code"
//                     value={lobbyCode}
//                     onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLobbyCode(e.target.value.toUpperCase())}
//                     maxLength={6}
//                   />
//                 </div>
//                 <Button onClick={handleJoinGame} className="w-full" size="lg">
//                   Join Game
//                 </Button>
//               </CardContent>
//             </Card>
//           </>
//         )}
//       </div>

//       {/* Footer */}
//       <div className="w-full max-w-2xl pt-12 pb-4">
//         <div className="bg-game-gray/30 border border-game-yellow/20 rounded-lg p-4">
//           <div className="text-xs text-game-yellow/80 space-y-1.5">
//             <div className="flex justify-between">
//               <span className="font-semibold">Environment:</span>
//               <span className="uppercase">{appEnv}</span>
//             </div>
//             <div className="flex justify-between">
//               <span className="font-semibold">Backend:</span>
//               <span>{isSupabaseConfigured() ? "Connected" : "Not Configured"}</span>
//             </div>
//             {tenant && (
//               <>
//                 <div className="flex justify-between">
//                   <span className="font-semibold">Tenant:</span>
//                   <span>{tenant.tenant_key}</span>
//                 </div>
//                 <div className="flex justify-between">
//                   <span className="font-semibold">Shop:</span>
//                   <span>{shopDomain || "Unknown"}</span>
//                 </div>
//               </>
//             )}
//             {customer && (
//               <div className="flex justify-between">
//                 <span className="font-semibold">Customer:</span>
//                 <span>{customer.email}</span>
//               </div>
//             )}
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default Play;

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
import type { TenantConfig } from "@/lib/types";
import { APP_VERSION } from "@/lib/types";
import { getCustomerLicenses, getCustomerSessions, type CustomerLicense, type GameSession } from "@/lib/customerAccess";
import { getAppBridge } from "@/lib/appBridge";

// Extend window to include embedded config and customer data

const Play = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [shopDomain, setShopDomain] = useState<string | null>(null);
  const [tenant, setTenant] = useState<TenantConfig | null>(null);
  const [customer, setCustomer] = useState<{ id: string; email: string; name: string } | null>(null);
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
    console.log("🔍 Checking for login status in URL...");
    console.log("📍 Current URL:", window.location.href);
    console.log("📍 Current pathname:", window.location.pathname);
    console.log("📍 Current search:", window.location.search);

    const urlParams = new URLSearchParams(window.location.search);
    console.log("📋 URL Params string:", urlParams.toString());

    // Common Shopify login redirect parameters
    const loginStatus = urlParams.get("login");
    const error = urlParams.get("error");
    const errorDescription = urlParams.get("error_description");
    const errorCode = urlParams.get("error_code");
    const customerAccount = urlParams.get("customer_account");
    const returnUrl = urlParams.get("return_url");
    const checkoutToken = urlParams.get("checkout_token");
    const state = urlParams.get("state");

    console.log("🔑 Extracted parameters:", {
      loginStatus,
      error,
      errorCode,
      customerAccount,
      checkoutToken,
    });

    // Collect all parameters for logging
    const allParams: Record<string, string> = {};
    urlParams.forEach((value, key) => {
      allParams[key] = value;
    });

    // Determine login status
    let status: "success" | "failed" | "unknown" = "unknown";

    // Check for success indicators
    // Shopify may send various success indicators, or we may have our own login=success parameter
    const hasSuccessIndicator = loginStatus === "success" || customerAccount || checkoutToken;

    if (hasSuccessIndicator) {
      status = "success";
      console.log("✅ Shopify login successful (from URL parameter)", {
        loginStatus,
        customerAccount,
        checkoutToken,
        returnUrl,
        allParams,
        timestamp: new Date().toISOString(),
      });

      // Always ensure success parameter is in URL
      urlParams.set("login", "success");
      const newUrl = `${window.location.pathname}?${urlParams.toString()}`;
      window.history.replaceState({}, document.title, newUrl);
      console.log("✅ Updated URL with success parameter:", newUrl);

      // Show success toast
      toast({
        title: "Login Successful",
        description: "You have successfully logged in to your Shopify account.",
        variant: "default",
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

      // Show error toast
      toast({
        title: "Login Failed",
        description: errorDescription || error || "Unable to complete login. Please try again.",
        variant: "destructive",
      });
    }

    // Log all URL parameters for debugging (always log if there are any params)
    if (urlParams.toString()) {
      console.log("📋 All URL Parameters after Shopify redirect:", allParams);
      setLoginStatusFromUrl({
        status,
        params: allParams,
      });
    } else {
      console.log("ℹ️ No URL parameters found");
    }

    console.log("✅ Login status check completed. Status:", status);
  }, [toast]);

  useEffect(() => {
    // Check for return token (r) parameter after Shopify login
    const urlParams = new URLSearchParams(window.location.search);
    const returnToken = urlParams.get('r');
    const shopParam = urlParams.get('shop');

    if (returnToken && shopParam) {
      verifyLoginToken(returnToken, shopParam);
      return;
    }

    // Check for embedded config from proxy (primary method)
    if (window.__PHRASEOTOMY_CONFIG__ && window.__PHRASEOTOMY_SHOP__) {
      setTenant(window.__PHRASEOTOMY_CONFIG__);
      setShopDomain(window.__PHRASEOTOMY_SHOP__);
      setCustomer(window.__PHRASEOTOMY_CUSTOMER__ || null);
      setLoading(false);
      return;
    }

    // Fallback: Load tenant from database for direct access (not through proxy)
    const fetchTenant = async () => {
      try {
        const { data: dbTenant } = await (await import("@/integrations/supabase/client")).supabase
          .from("tenants")
          .select("*")
          .eq("is_active", true)
          .limit(1)
          .single();

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
  }, []);

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

  const verifyLoginToken = async (token: string, shop: string) => {
    try {
      console.log("Verifying login token for shop:", shop);
      
      const { supabase } = await import("@/integrations/supabase/client");
      const { data, error } = await supabase.functions.invoke('verify-login-token', {
        body: { token, shopDomain: shop }
      });

      if (error) throw error;

      if (data.valid) {
        console.log("Token verified successfully, customer is now logged in");
        toast({
          title: "Login Successful",
          description: "You have been logged in successfully!",
        });
        
        // Clean up URL parameters
        window.history.replaceState({}, document.title, window.location.pathname);
        
        // Reload to fetch customer data
        window.location.reload();
      } else {
        toast({
          title: "Login Failed",
          description: "Login verification failed. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error verifying login token:", error);
      toast({
        title: "Login Failed",
        description: "Login verification failed. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleJoinGame = () => {
    if (!lobbyCode.trim()) {
      toast({
        title: "Missing Lobby Code",
        description: "Please enter a lobby code to join a game.",
        variant: "destructive",
      });
      return;
    }

    if (!customer && !guestName.trim()) {
      toast({
        title: "Missing Name",
        description: "Please enter your name to join as a guest.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Coming Soon",
      description: "Game lobby joining will be available soon.",
    });
  };

  const handleHostGame = () => {
    navigate("/create-lobby", {
      state: { customer, shopDomain, tenant },
    });
  };

  const handleRedeemCode = () => {
    if (!redemptionCode.trim()) {
      toast({
        title: "Missing Code",
        description: "Please enter a 6-digit code.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Coming Soon",
      description: "Code redemption will be available soon.",
    });
  };

  const handleLogin = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

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
      const { supabase } = await import("@/integrations/supabase/client");
      const { data, error } = await supabase.functions.invoke('generate-login-token', {
        body: { shopDomain: effectiveShopDomain }
      });

      if (error) throw error;

      console.log("Redirecting to Shopify login with signed token");
      window.top ? (window.top.location.href = data.loginUrl) : (window.location.href = data.loginUrl);
    } catch (error) {
      console.error("Error generating login URL:", error);
      toast({
        title: "Login Error",
        description: "Failed to initiate login. Please try again.",
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
                <span>{customer.email}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Play;
