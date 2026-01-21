import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { redeemCode, redirectToShopifyWithError } from "@/lib/redemption";
import type { ShopifyCustomer } from "@/lib/types";

const RedeemCode = () => {
  const { toast } = useToast();
  const [customer, setCustomer] = useState<ShopifyCustomer | null>(null);
  const [shopDomain, setShopDomain] = useState<string | null>(null);
  const [redemptionCode, setRedemptionCode] = useState("");
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isNotLoggedIn, setIsNotLoggedIn] = useState(false);
  const [pendingAutoRedeem, setPendingAutoRedeem] = useState<{code: string, customerId: string, domain: string} | null>(null);
  const [cameFromShopify, setCameFromShopify] = useState(false);

  const handleRedeemCode = useCallback(async (code?: string, customerId?: string, domain?: string, fromShopify?: boolean) => {
    const codeToRedeem = code || redemptionCode;
    const customerToUse = customerId ? { id: customerId } : customer;
    const domainToUse = domain || shopDomain;
    const isFromShopify = fromShopify !== undefined ? fromShopify : cameFromShopify;

    if (!customerToUse || !domainToUse) {
      toast({
        title: "Error",
        description: "Please log in to redeem a code.",
        variant: "destructive",
      });
      return;
    }

    if (codeToRedeem.length !== 6) {
      const errorMsg = "Invalid code format. Please enter a 6-character code.";
      toast({
        title: "Invalid Code",
        description: errorMsg,
        variant: "destructive",
      });
      
      // Redirect back to Shopify if came from Shopify
      if (isFromShopify) {
        setTimeout(() => {
          redirectToShopifyWithError(errorMsg);
        }, 1000);
      }
      return;
    }

    setIsRedeeming(true);
    try {
      const result = await redeemCode(codeToRedeem, customerToUse.id, domainToUse);

      if (result.success) {
        toast({
          title: "Success!",
          description: result.message,
        });

        // Clear the input
        setRedemptionCode("");

        // If came from Shopify, redirect to play page (same window)
        if (isFromShopify) {
          setTimeout(() => {
            // Redirect to play page on same domain
            window.location.href = `${window.location.origin}${window.location.pathname}#/play/host`;
          }, 1000); // Small delay to show success message
        } else {
          // For manual redemption, open play page in new window
          setTimeout(() => {
            const playUrl = 'https://phraseotomy.com/apps/phraseotomy';
            window.open(playUrl, "_blank");
          }, 1500);
        }
      } else {
        // Error message is already properly formatted from redemption.ts
        const errorMessage = result.message || "Redemption Failed";
        
        toast({
          title: "Redemption Failed",
          description: errorMessage,
          variant: "destructive",
        });
        
        // Redirect back to Shopify with error if came from Shopify
        if (isFromShopify) {
          setTimeout(() => {
            redirectToShopifyWithError(errorMessage);
          }, 1500); // Small delay to show error message
        }
      }
    } catch (error) {
      console.error("Error redeeming code:", error);
      const errorMsg = "An unexpected error occurred. Please try again.";
      toast({
        title: "Error",
        description: errorMsg,
        variant: "destructive",
      });
      
      // Redirect back to Shopify with error if came from Shopify
      if (isFromShopify) {
        setTimeout(() => {
          redirectToShopifyWithError(errorMsg);
        }, 1500);
      }
    } finally {
      setIsRedeeming(false);
    }
  }, [redemptionCode, customer, shopDomain, toast, cameFromShopify]);

  // Check authentication and redirect if not logged in
  useEffect(() => {
    const checkAuthentication = async () => {
      // Check for pending redeem params from Shopify redirect
      const pendingRedeemParams = sessionStorage.getItem('pending_redeem_params');
      if (pendingRedeemParams) {
        // Keep loading state true to show loader while processing
        setLoading(true);
        
        try {
          const redeemParams = JSON.parse(pendingRedeemParams);
          console.log('🎟️ Processing redeem params from Shopify:', redeemParams);
          
          // Mark that this redemption came from Shopify
          setCameFromShopify(true);
          
          // Clear the params from sessionStorage
          sessionStorage.removeItem('pending_redeem_params');
          
          // Authenticate customer using CustomerId and shop_domain
          const { resolveShopDomain } = await import("@/lib/tenants");
          const resolvedShopDomain = resolveShopDomain(redeemParams.shop_domain);
          
          // Generate session token for this customer
          const { data: sessionData, error: sessionError } = await supabase.functions.invoke("generate-session-token", {
            body: { customerId: redeemParams.CustomerId, shopDomain: resolvedShopDomain },
          });

          if (sessionError || !sessionData?.sessionToken) {
            console.error("Error generating session token:", sessionError);
            const errorMsg = "Could not authenticate. Please try logging in again.";
            toast({
              title: "Authentication Failed",
              description: errorMsg,
              variant: "destructive",
            });
            
            // Redirect back to Shopify with error
            setTimeout(() => {
              redirectToShopifyWithError(errorMsg);
            }, 1500);
            
            setIsNotLoggedIn(true);
            setLoading(false);
            return;
          }

          // Store session token
          localStorage.setItem("phraseotomy_session_token", sessionData.sessionToken);
          
          // Store customer data
          const customerData = {
            customer_id: redeemParams.CustomerId,
            id: redeemParams.CustomerId,
            email: redeemParams.CustomerEmail ? decodeURIComponent(redeemParams.CustomerEmail) : null,
            name: null,
            first_name: null,
            last_name: null,
          };
          localStorage.setItem("customerData", JSON.stringify(customerData));
          
          // Fetch full customer data
          const { data: fullCustomerData, error: customerError } = await supabase.functions.invoke("get-customer-data", {
            body: { sessionToken: sessionData.sessionToken },
          });

          if (!customerError && fullCustomerData?.customer) {
            const updatedCustomerData = {
              customer_id: redeemParams.CustomerId,
              id: redeemParams.CustomerId,
              email: fullCustomerData.customer?.email || redeemParams.CustomerEmail ? decodeURIComponent(redeemParams.CustomerEmail) : null,
              name: fullCustomerData.customer?.name || null,
              first_name: fullCustomerData.customer?.first_name || null,
              last_name: fullCustomerData.customer?.last_name || null,
            };
            localStorage.setItem("customerData", JSON.stringify(updatedCustomerData));
            
            setCustomer({
              id: redeemParams.CustomerId,
              email: updatedCustomerData.email,
              name: updatedCustomerData.name,
              firstName: updatedCustomerData.first_name,
              lastName: updatedCustomerData.last_name,
            });
          } else {
            setCustomer({
              id: redeemParams.CustomerId,
              email: redeemParams.CustomerEmail ? decodeURIComponent(redeemParams.CustomerEmail) : null,
              name: null,
              firstName: null,
              lastName: null,
            });
          }
          
          setShopDomain(resolvedShopDomain);
          
          // Set pending auto-redeem to trigger after state is set
          // This will automatically redeem the code
          if (redeemParams.Code) {
            setRedemptionCode(redeemParams.Code);
            setPendingAutoRedeem({
              code: redeemParams.Code,
              customerId: redeemParams.CustomerId,
              domain: resolvedShopDomain
            });
          }
          
          // Don't set loading to false here - let the redemption process handle it
          // The loader will stay until redemption completes
          return;
        } catch (error) {
          console.error("Error processing redeem params:", error);
          const errorMsg = "Failed to process redemption. Please try again.";
          toast({
            title: "Error",
            description: errorMsg,
            variant: "destructive",
          });
          
          // Redirect back to Shopify with error
          setTimeout(() => {
            redirectToShopifyWithError(errorMsg);
          }, 1500);
          
          setLoading(false);
          return;
        }
      }

      // Check for embedded config from proxy (primary method)
      if (window.__PHRASEOTOMY_CONFIG__ && window.__PHRASEOTOMY_SHOP__) {
        setShopDomain(window.__PHRASEOTOMY_SHOP__);
        
        if (window.__PHRASEOTOMY_CUSTOMER__) {
          setCustomer(window.__PHRASEOTOMY_CUSTOMER__);
          setLoading(false);
          return;
        }
      }

      // Check localStorage for session
      const storedCustomerData = localStorage.getItem("customerData");
      const sessionToken = localStorage.getItem("phraseotomy_session_token");

      if (!storedCustomerData || !sessionToken) {
        console.log("No session found");
        setIsNotLoggedIn(true);
        setLoading(false);
        return;
      }

      try {
        // Verify session token is still valid
        const { data: customerData, error: customerError } = await supabase.functions.invoke("get-customer-data", {
          body: { sessionToken },
        });

        if (customerError || !customerData) {
          console.warn("⚠️ Invalid session");
          localStorage.removeItem("phraseotomy_session_token");
          localStorage.removeItem("customerData");
          setIsNotLoggedIn(true);
          setLoading(false);
          return;
        }

        // Decode session token to get customer info and shop domain
        const [payloadB64] = sessionToken.split(".");
        if (payloadB64) {
          const payload = JSON.parse(atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/")));

          // Check if token is expired
          if (payload.exp && payload.exp * 1000 < Date.now()) {
            console.warn("⚠️ Session token expired");
            localStorage.removeItem("phraseotomy_session_token");
            localStorage.removeItem("customerData");
            setIsNotLoggedIn(true);
            setLoading(false);
            return;
          }

          // Get shop domain from token payload
          if (payload.shop) {
            setShopDomain(payload.shop);
          }

          // Parse customer data
          const parsedCustomerData = JSON.parse(storedCustomerData);
          const customerObj: ShopifyCustomer = {
            id: payload.customer_id || parsedCustomerData.id || parsedCustomerData.customer_id,
            email: parsedCustomerData.email || customerData?.customer?.email || null,
            name: parsedCustomerData.name || customerData?.customer?.name || null,
            firstName: parsedCustomerData.first_name || customerData?.customer?.first_name || null,
            lastName: parsedCustomerData.last_name || customerData?.customer?.last_name || null,
          };
          setCustomer(customerObj);
        } else {
          // Fallback: parse customer data without token payload
          const parsedCustomerData = JSON.parse(storedCustomerData);
          setCustomer({
            id: parsedCustomerData.id || parsedCustomerData.customer_id,
            email: parsedCustomerData.email,
            name: parsedCustomerData.name,
            firstName: parsedCustomerData.first_name,
            lastName: parsedCustomerData.last_name,
          });
        }
      } catch (error) {
        console.error("Error verifying session:", error);
        setIsNotLoggedIn(true);
        setLoading(false);
        return;
      } finally {
        setLoading(false);
      }
    };

    checkAuthentication();
  }, [toast]);

  // Auto-redeem when pending auto-redeem is set and customer/shopDomain are ready
  useEffect(() => {
    if (pendingAutoRedeem && customer && shopDomain && !isRedeeming && loading) {
      // Set loading to false before starting redemption (it was kept true during auth)
      setLoading(false);
      // Trigger redemption
      handleRedeemCode(pendingAutoRedeem.code, pendingAutoRedeem.customerId, pendingAutoRedeem.domain, cameFromShopify);
      setPendingAutoRedeem(null);
    }
  }, [pendingAutoRedeem, customer, shopDomain, handleRedeemCode, isRedeeming, cameFromShopify, loading]);


  // Show only loader when coming from Shopify (page already exists in Shopify)
  if (cameFromShopify && (loading || isRedeeming || pendingAutoRedeem)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mx-auto"></div>
          <p className="text-muted-foreground">
            {isRedeeming ? "Redeeming code..." : "Processing..."}
          </p>
        </div>
      </div>
    );
  }

  // Regular loading state for non-Shopify flows
  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 flex items-center justify-center">
          <Card className="w-full max-w-md">
            <CardHeader>
              <div className="h-6 w-48 bg-muted animate-pulse rounded" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="h-10 w-full bg-muted animate-pulse rounded" />
                <div className="h-10 w-full bg-muted animate-pulse rounded" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (isNotLoggedIn) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 flex items-center justify-center">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Login Required</CardTitle>
              <CardDescription>
                You need to be logged in to redeem license codes.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Please log in to your account to access the redeem code page.
              </p>
              <Button
                onClick={() => {
                  // Redirect to phraseotomy.com login page
                  window.location.href = "https://phraseotomy.com/#/login";
                }}
                className="w-full"
                size="lg"
              >
                Back to Login
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Profile</h1>
            <p className="text-muted-foreground mt-2">Manage your account and redeem license codes</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Redeem License Code</CardTitle>
              <CardDescription>
                Enter your 6-character license code to unlock game packs
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="redemption-code">License Code</Label>
                <Input
                  id="redemption-code"
                  type="text"
                  placeholder="Enter 6-character code"
                  value={redemptionCode}
                  onChange={(e) => setRedemptionCode(e.target.value.toUpperCase().trim())}
                  maxLength={6}
                  disabled={isRedeeming}
                  className="text-center text-lg tracking-widest font-mono"
                />
              </div>
              <Button
                onClick={() => handleRedeemCode()}
                disabled={isRedeeming || redemptionCode.length !== 6}
                className="w-full"
                size="lg"
              >
                {isRedeeming ? "Redeeming..." : "Redeem Code"}
              </Button>
            </CardContent>
          </Card>

          {customer && (
            <Card>
              <CardHeader>
                <CardTitle>Account Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <Label className="text-muted-foreground">Name</Label>
                  <p className="text-sm font-medium">{customer.name || customer.firstName || "Not provided"}</p>
                </div>
                {customer.email && (
                  <div>
                    <Label className="text-muted-foreground">Email</Label>
                    <p className="text-sm font-medium">{customer.email}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default RedeemCode;

