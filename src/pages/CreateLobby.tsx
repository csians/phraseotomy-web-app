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
import Header from "@/components/Header";
import type { Tables } from "@/integrations/supabase/types";
import { Check } from "lucide-react";

// Theme images
import atHomeImg from "@/assets/themes/at-home.jpg";
import atWorkImg from "@/assets/themes/at-work.jpg";
import lifestyleImg from "@/assets/themes/lifestyle.jpg";
import travelImg from "@/assets/themes/travel.jpg";

// Map theme names to their images (case-insensitive matching)
const THEME_IMAGES: Record<string, string> = {
  "at home": atHomeImg,
  "athome": atHomeImg,
  "home": atHomeImg,
  "at work": atWorkImg,
  "atwork": atWorkImg,
  "work": atWorkImg,
  "lifestyle": lifestyleImg,
  "travel": travelImg,
};

type Pack = Tables<"packs">;
type Theme = Tables<"themes">;

export default function CreateLobby() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const [lobbyName, setLobbyName] = useState("");
  const [selectedPack, setSelectedPack] = useState<string>("");
  const [selectedTheme, setSelectedTheme] = useState<string>("");
  const [isCreating, setIsCreating] = useState(false);
  const [availablePacks, setAvailablePacks] = useState<string[]>([]);
  const [loadingPacks, setLoadingPacks] = useState(true);
  const [allPacks, setAllPacks] = useState<Pack[]>([]);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [loadingThemes, setLoadingThemes] = useState(true);
  const [gameMode, setGameMode] = useState<"live" | "async">("live");
  const [timerPreset, setTimerPreset] = useState<"quick" | "normal" | "extended">("normal");

  const TIMER_PRESETS = {
    quick: { story: 300, guess: 180, label: "Quick (5/3 min)" },
    normal: { story: 600, guess: 420, label: "Normal (10/7 min)" },
    extended: { story: 900, guess: 600, label: "Extended (15/10 min)" },
  };

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

  useEffect(() => {
    if (!loadingPacks && allPacks.length > 0 && availablePacks.length > 0) {
      // Find last unlocked pack (highest)
      const highestUnlocked = [...allPacks].reverse().find((p) => availablePacks.includes(p.id));

      if (highestUnlocked) {
        setSelectedPack(highestUnlocked.id);
      }
    }
  }, [loadingPacks, allPacks, availablePacks]);

  // Load themes filtered by available packs
  // Show all themes that are linked to any of the customer's unlocked packs via theme_packs junction table
  useEffect(() => {
    const loadThemes = async () => {
      if (loadingPacks || availablePacks.length === 0) {
        if (!loadingPacks) setLoadingThemes(false);
        return;
      }

      try {
        // Fetch themes and theme_packs junction data
        const [themesRes, themePacksRes] = await Promise.all([
          supabase.from("themes").select("*").order("name", { ascending: true }),
          supabase.from("theme_packs").select("theme_id, pack_id")
        ]);

        if (themesRes.error) throw themesRes.error;
        if (themePacksRes.error) throw themePacksRes.error;

        const allThemes = themesRes.data || [];
        const themePacks = themePacksRes.data || [];

        // Get theme IDs that are linked to any available pack via junction table
        const themeIdsInAvailablePacks = new Set(
          themePacks
            .filter(tp => availablePacks.includes(tp.pack_id))
            .map(tp => tp.theme_id)
        );

        // Also include themes with direct pack_id match (legacy support)
        const filteredThemes = allThemes.filter(
          (theme) => 
            themeIdsInAvailablePacks.has(theme.id) || 
            (theme.pack_id && availablePacks.includes(theme.pack_id))
        );

        setThemes(filteredThemes);

        // Auto-select first theme if available
        if (filteredThemes.length > 0 && !selectedTheme) {
          setSelectedTheme(filteredThemes[0].id);
        }
      } catch (error) {
        console.error("Error loading themes:", error);
        setThemes([]);
      } finally {
        setLoadingThemes(false);
      }
    };

    loadThemes();
  }, [loadingPacks, availablePacks]);

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

    if (!selectedTheme) {
      toast({
        title: "Select Theme",
        description: "Please select a theme for the game",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);

    try {
      const lobbyCode = generateLobbyCode();

      // Use edge function to create session (bypasses RLS with service role)
      const timerSettings = TIMER_PRESETS[timerPreset];
      const { data, error } = await supabase.functions.invoke("create-game-session", {
        body: {
          lobbyCode,
          hostCustomerId: customer.id,
          hostCustomerName: customer.name || customer.email,
          shopDomain,
          tenantId: tenant.id,
          packsUsed: [selectedPack],
          gameName: lobbyName.trim(),
          themeId: selectedTheme,
          gameMode,
          timerPreset: gameMode === "live" ? timerPreset : null,
          storyTimeSeconds: gameMode === "live" ? timerSettings.story : null,
          guessTimeSeconds: gameMode === "live" ? timerSettings.guess : null,
        },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || "Failed to create lobby");
      }

      const newSession = data.session;

      // Store customer data in localStorage for session persistence across refreshes
      const customerData = {
        customer_id: customer.id,
        id: customer.id,
        name: customer.name || customer.email,
        email: customer.email,
        firstName: customer.firstName,
        lastName: customer.lastName,
      };
      localStorage.setItem("customerData", JSON.stringify(customerData));
      sessionStorage.setItem("customerData", JSON.stringify(customerData));

      // Store player ID specifically for lobby refresh recovery
      localStorage.setItem("lobby_player_id", customer.id);
      sessionStorage.setItem("lobby_player_id", customer.id);

      // Store session ID for refresh persistence
      sessionStorage.setItem("current_lobby_session", newSession.id);
      localStorage.setItem("current_lobby_session", newSession.id);

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
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <div className="flex-1 p-4">
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
                      {customer.name ||
                        `${customer.firstName || ""} ${customer.lastName || ""}`.trim() ||
                        customer.email}
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

              {/* Game Mode Selection */}
              <div className="space-y-3">
                <Label>Game Mode</Label>
                <RadioGroup value={gameMode} onValueChange={(v) => setGameMode(v as "live" | "async")}>
                  <div className="grid grid-cols-2 gap-3">
                    <div
                      className={`flex items-start space-x-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                        gameMode === "live"
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-accent hover:text-accent-foreground"
                      }`}
                      onClick={() => setGameMode("live")}
                    >
                      <RadioGroupItem value="live" id="live" className="mt-0.5" />
                      <div className="space-y-1">
                        <Label htmlFor="live" className="cursor-pointer font-medium">
                          ⏱️ Live Mode
                        </Label>
                        <p className="text-xs text-muted-foreground">Time-based gameplay with countdown timers</p>
                      </div>
                    </div>
                    <div
                      className={`flex items-start space-x-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                        gameMode === "async"
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-accent hover:text-accent-foreground"
                      }`}
                      onClick={() => setGameMode("async")}
                    >
                      <RadioGroupItem value="async" id="async" className="mt-0.5" />
                      <div className="space-y-1">
                        <Label htmlFor="async" className="cursor-pointer font-medium">
                          📬 Async Mode
                        </Label>
                        <p className="text-xs text-muted-foreground">Play at your own pace, no time limits</p>
                      </div>
                    </div>
                  </div>
                </RadioGroup>
              </div>

              {/* Timer Presets (only for Live mode) */}
              {gameMode === "live" && (
                <div className="space-y-3">
                  <Label>Timer Settings</Label>
                  <RadioGroup
                    value={timerPreset}
                    onValueChange={(v) => setTimerPreset(v as "quick" | "normal" | "extended")}
                  >
                    <div className="grid grid-cols-3 gap-2">
                      {(
                        Object.entries(TIMER_PRESETS) as [keyof typeof TIMER_PRESETS, (typeof TIMER_PRESETS)["quick"]][]
                      ).map(([key, preset]) => (
                        <div
                          key={key}
                          className={`flex flex-col items-center p-3 rounded-lg border cursor-pointer transition-colors text-center ${
                            timerPreset === key
                              ? "border-primary bg-primary/5"
                              : "border-border hover:bg-accent hover:text-accent-foreground"
                          }`}
                          onClick={() => setTimerPreset(key)}
                        >
                          <RadioGroupItem value={key} id={key} className="sr-only" />
                          <Label htmlFor={key} className="cursor-pointer text-sm font-medium capitalize">
                            {key}
                          </Label>
                          <p className="text-xs text-muted-foreground mt-1">
                            {Math.floor(preset.story / 60)}/{Math.floor(preset.guess / 60)} min
                          </p>
                        </div>
                      ))}
                    </div>
                  </RadioGroup>
                  <p className="text-xs text-muted-foreground">
                    Story time / Guess time. Auto-submits when timer expires.
                  </p>
                </div>
              )}

              <div className="space-y-3">
                <Label>Select Theme</Label>
                {loadingThemes ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[1, 2, 3, 4].map((i) => (
                      <Skeleton key={i} className="aspect-[3/4] rounded-xl" />
                    ))}
                  </div>
                ) : themes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No themes available</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {themes.map((theme) => {
                      const isSelected = selectedTheme === theme.id;
                      const themeImage = THEME_IMAGES[theme.name.toLowerCase()];
                      
                      return (
                        <button
                          key={theme.id}
                          type="button"
                          onClick={() => setSelectedTheme(theme.id)}
                          className={`relative aspect-[3/4] rounded-xl overflow-hidden border-2 transition-all duration-200 ${
                            isSelected 
                              ? "border-primary ring-2 ring-primary ring-offset-2 ring-offset-background scale-105" 
                              : "border-transparent hover:border-muted-foreground/30 hover:scale-102"
                          }`}
                        >
                          {themeImage ? (
                            <img 
                              src={themeImage} 
                              alt={theme.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center">
                              <span className="text-lg font-bold text-foreground text-center px-2">
                                {theme.name}
                              </span>
                            </div>
                          )}
                          
                          {/* Selection indicator */}
                          {isSelected && (
                            <div className="absolute top-2 right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                              <Check className="w-4 h-4 text-primary-foreground" />
                            </div>
                          )}
                          
                          {/* Theme name overlay */}
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                            <p className="text-white text-sm font-semibold text-center truncate">
                              {theme.name}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">Whisps will be auto-generated based on this theme</p>
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
                            className={`flex items-start space-x-3 p-3 rounded-lg border transition-colors ${
                              selectedPack === pack.id
                                ? "border-primary bg-primary text-primary-foreground"
                                : isAvailable
                                  ? "border-border bg-card hover:bg-accent hover:text-accent-foreground cursor-pointer"
                                  : "border-muted bg-muted/30 opacity-60 cursor-not-allowed"
                            }`}
                            onClick={() => isAvailable && setSelectedPack(pack.id)}
                          >
                            {/* <RadioGroupItem value={pack.id} id={pack.id} disabled={!isAvailable} className="mt-0.5" /> */}
                            <RadioGroupItem
                              value={pack.id}
                              id={pack.id}
                              disabled={!isAvailable}
                              className="
                              mt-0.5
                              data-[state=checked]:bg-black
                              data-[state=checked]:border-black
                            "
                            />
                            <div className="space-y-1 leading-none flex-1 pt-0.5">
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
    </div>
  );
}
