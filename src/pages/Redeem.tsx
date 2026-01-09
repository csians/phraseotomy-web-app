import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { redeemCode } from "@/lib/redemption";
import type { ShopifyCustomer } from "@/lib/types";
import Header from "@/components/Header";

const RedeemCode = () => {
  const { toast } = useToast();
  const [customer, setCustomer] = useState<ShopifyCustomer | null>(null);
  const [shopDomain, setShopDomain] = useState<string | null>(null);
  const [redemptionCode, setRedemptionCode] = useState("");
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isNotLoggedIn, setIsNotLoggedIn] = useState(false);

  // Check authentication and redirect if not logged in
  useEffect(() => {
    const checkAuthentication = async () => {
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
  }, []);

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

        // Open play page in new window after successful redemption
        setTimeout(() => {
          const playUrl = `${window.location.origin}${window.location.pathname}#/play/host`;
          window.open(playUrl, "_blank");
        }, 1500); // Small delay to show success message
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

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
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
        <Header />
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
      <Header />
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
                onClick={handleRedeemCode}
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

