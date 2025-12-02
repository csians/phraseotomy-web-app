import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getCustomerLicenses } from "@/lib/customerAccess";
import { Skeleton } from "@/components/ui/skeleton";
import type { Tables } from "@/integrations/supabase/types";

type Pack = Tables<"packs">;

export default function CreateLobby() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const [lobbyName, setLobbyName] = useState("");
  const [selectedPack, setSelectedPack] = useState<string>("");
  const [isCreating, setIsCreating] = useState(false);
  const [availablePacks, setAvailablePacks] = useState<string[]>([]);
  const [loadingPacks, setLoadingPacks] = useState(true);
  const [allPacks, setAllPacks] = useState<Pack[]>([]);

  // Get customer and shop info from location state or window
  const customer = location.state?.customer || window.__PHRASEOTOMY_CUSTOMER__;
  const shopDomain = location.state?.shopDomain || window.__PHRASEOTOMY_SHOP__;
  const tenant = location.state?.tenant || window.__PHRASEOTOMY_CONFIG__;

  // Load all packs from database for this tenant
  useEffect(() => {
    const loadAllPacks = async () => {
      if (!tenant?.id) {
        setLoadingPacks(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("packs")
          .select("*")
          .eq("tenant_id", tenant.id)
          .order("created_at", { ascending: true });

        if (error) throw error;
        setAllPacks(data || []);
      } catch (error) {
        console.error("Error loading packs:", error);
        setAllPacks([]);
      }
    };

    loadAllPacks();
  }, [tenant?.id]);

  // Load customer's available packs from redeemed codes
  useEffect(() => {
    const loadCustomerPacks = async () => {
      if (!customer || !shopDomain || allPacks.length === 0) {
        if (allPacks.length > 0) {
          setLoadingPacks(false);
        }
        return;
      }

      try {
        setLoadingPacks(true);

        // Get customer licenses (redeemed codes)
        const licenses = await getCustomerLicenses(customer.id, shopDomain);

        // Extract all unique pack names from all licenses
        const licensePackNames = new Set<string>();
        licenses.forEach((license) => {
          if (license.packs_unlocked && Array.isArray(license.packs_unlocked)) {
            license.packs_unlocked.forEach((pack) => licensePackNames.add(pack));
          }
        });

        // Map pack names to pack IDs from database
        const availablePackIds = allPacks.filter((pack) => licensePackNames.has(pack.name)).map((pack) => pack.id);

        setAvailablePacks(availablePackIds);

        // Auto-select first available pack if none selected
        if (availablePackIds.length > 0 && !selectedPack) {
          setSelectedPack(availablePackIds[0]);
        }
      } catch (error) {
        console.error("Error loading customer packs:", error);
        setAvailablePacks([]);
      } finally {
        setLoadingPacks(false);
      }
    };

    loadCustomerPacks();
  }, [customer, shopDomain, allPacks]);

  const generateLobbyCode = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const handleCreateLobby = async () => {
    if (!customer || !shopDomain || !tenant) {
      toast({
        title: "Error",
        description: "Missing authentication information",
        variant: "destructive",
      });
      return;
    }

    if (!lobbyName.trim()) {
      toast({
        title: "Game Name Required",
        description: "Please enter a game name",
        variant: "destructive",
      });
      return;
    }

    if (!selectedPack) {
      toast({
        title: "Select Pack",
        description: "Please select a pack",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);

    try {
      const lobbyCode = generateLobbyCode();

      // Use edge function to create session (bypasses RLS with service role)
      const { data, error } = await supabase.functions.invoke("create-game-session", {
        body: {
          lobbyCode,
          hostCustomerId: customer.id,
          hostCustomerName: customer.name || customer.email,
          shopDomain,
          tenantId: tenant.id,
          packsUsed: [selectedPack],
          gameName: lobbyName.trim(),
        },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || "Failed to create lobby");
      }

      const newSession = data.session;

      toast({
        title: "Lobby Created!",
        description: `Lobby Code: ${lobbyCode}`,
      });

      // Redirect to lobby page (replace to avoid back navigation issues)
      navigate(`/lobby/${newSession.id}`, { replace: true });
    } catch (error) {
      console.error("Error creating lobby:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create lobby. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  if (!customer) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Authentication Required</CardTitle>
            <CardDescription>Please log in to create a lobby</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/play/host")} className="w-full">
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check if customer has any redeemed codes (required to create lobby)
  if (!loadingPacks && availablePacks.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>No Game Access</CardTitle>
            <CardDescription>You need to redeem a code to unlock game packs before creating a lobby.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Each Phraseotomy game comes with a redemption code. Enter your code to unlock game packs and start hosting
              games.
            </p>
            <Button
              onClick={() => navigate("/play/host")}
              className="w-full bg-game-yellow hover:bg-game-yellow/90 text-game-black font-bold"
            >
              Go to Redeem Code
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto space-y-6 py-8">
        {/* Customer Profile Header */}
        {customer && (
          <Card className="bg-gradient-to-r from-primary/10 to-primary/5">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xl font-bold">
                  {customer.firstName?.[0] || customer.name?.[0] || customer.email?.[0] || "?"}
                </div>
                <div>
                  <h2 className="text-xl font-semibold">
                    {customer.name || `${customer.firstName || ""} ${customer.lastName || ""}`.trim() || customer.email}
                  </h2>
                  {customer.email && <p className="text-sm text-muted-foreground">{customer.email}</p>}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Create New Game</h1>
          <p className="text-muted-foreground">Set up your game and invite players</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Game Settings</CardTitle>
            <CardDescription>Choose your game packs</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="lobbyName">Game Name</Label>
              <Input
                id="lobbyName"
                required
                placeholder="My Awesome Game"
                value={lobbyName}
                onChange={(e) => setLobbyName(e.target.value)}
              />
            </div>

            <div className="space-y-4">
              <Label>Select Pack</Label>
              {loadingPacks ? (
                <div className="space-y-3">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : allPacks.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  <p>No packs have been created yet. Contact your administrator to create packs.</p>
                </div>
              ) : (
                <RadioGroup value={selectedPack} onValueChange={setSelectedPack}>
                  <div className="space-y-3">
                    {allPacks.map((pack) => {
                      const isAvailable = availablePacks.includes(pack.id);

                      return (
                        <div
                          key={pack.id}
                          className={`flex items-start space-x-3 p-3 rounded-lg border ${
                            isAvailable
                              ? "border-border bg-card hover:bg-accent cursor-pointer"
                              : "border-muted bg-muted/30 opacity-60 cursor-not-allowed"
                          }`}
                          onClick={() => isAvailable && setSelectedPack(pack.id)}
                        >
                          <RadioGroupItem value={pack.id} id={pack.id} disabled={!isAvailable} className="mt-0.5" />
                          <div className="space-y-1 leading-none flex-1">
                            <div className="flex items-center gap-2">
                              <Label
                                htmlFor={pack.id}
                                className={`text-sm font-medium leading-none ${
                                  isAvailable ? "cursor-pointer" : "cursor-not-allowed opacity-70"
                                }`}
                              >
                                {pack.name}
                              </Label>
                              {!isAvailable && (
                                <span className="text-xs text-muted-foreground italic">(Not unlocked)</span>
                              )}
                            </div>
                            {pack.description && <p className="text-sm text-muted-foreground">{pack.description}</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </RadioGroup>
              )}
              {!loadingPacks && availablePacks.length === 0 && allPacks.length > 0 && (
                <div className="text-center py-4 text-muted-foreground">
                  <p>No packs unlocked. Redeem a code to unlock game packs.</p>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => navigate("/play/host")} className="flex-1">
                Cancel
              </Button>
              <Button
                onClick={handleCreateLobby}
                disabled={isCreating || !selectedPack}
                className="flex-1 bg-game-yellow hover:bg-game-yellow/90 text-game-black font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                size="lg"
              >
                {isCreating ? "Creating..." : "Create Game"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-muted/50">
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground space-y-1">
              <p>
                <strong>Host:</strong> {customer.name || customer.email}
              </p>
              <p>
                <strong>Shop:</strong> {shopDomain}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
