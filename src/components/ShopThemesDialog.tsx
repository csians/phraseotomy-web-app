import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Lock, ShoppingCart, Check } from "lucide-react";
import { EnterThemeCodeDialog } from "./EnterThemeCodeDialog";

// Theme images
import atHomeImg from "@/assets/themes/at-home.jpg";
import atWorkImg from "@/assets/themes/at-work.jpg";
import lifestyleImg from "@/assets/themes/lifestyle.jpg";
import travelImg from "@/assets/themes/travel.jpg";
import adultTileImg from "@/assets/themes/adult tile.png";
import fantasyTileImg from "@/assets/themes/fantasy tile.png";
import horrorTileImg from "@/assets/themes/horror tile.png";
import sciFiTileImg from "@/assets/themes/sci-fi tile.png";
import adultTileGreyImg from "@/assets/themes/adult tile grey.png";
import fantasyTileGreyImg from "@/assets/themes/fantasy tile grey.png";
import horrorTileGreyImg from "@/assets/themes/horror tile grey.png";
import sciFiTileGreyImg from "@/assets/themes/sci-fi tile grey.png";

// Map theme IDs to their images
const THEME_IMAGES_BY_ID: Record<string, string> = {
  "dd7cb9da-7af3-40d1-8d48-c68cfb63816a": atWorkImg,
  "219a2cd6-2f57-47aa-a326-2587b7612e74": atHomeImg,
  "f9fc1b75-7ae2-4b0f-8be9-cc0ead6f193f": travelImg,
  "64baef58-c0f3-4f75-a3ff-13889b5d862d": lifestyleImg,
  "98c9218d-8b63-4bef-a049-05861b2da98c": adultTileImg,
  "c84fc90d-5d48-43e6-9f3b-2e8a5a4e9b6c": fantasyTileImg,
  "a1b2c3d4-e5f6-7890-abcd-ef1234567890": horrorTileImg,
  "b2c3d4e5-f6a7-8901-bcde-f12345678901": sciFiTileImg,
};

const THEME_IMAGES_GREY_BY_ID: Record<string, string> = {
  "98c9218d-8b63-4bef-a049-05861b2da98c": adultTileGreyImg,
  "c84fc90d-5d48-43e6-9f3b-2e8a5a4e9b6c": fantasyTileGreyImg,
  "a1b2c3d4-e5f6-7890-abcd-ef1234567890": horrorTileGreyImg,
  "b2c3d4e5-f6a7-8901-bcde-f12345678901": sciFiTileGreyImg,
};

const THEME_IMAGES_BY_NAME: Record<string, string> = {
  "at home": atHomeImg,
  "at work": atWorkImg,
  "lifestyle": lifestyleImg,
  "travel": travelImg,
  "adult": adultTileImg,
  "fantasy": fantasyTileImg,
  "horror": horrorTileImg,
  "sci-fi": sciFiTileImg,
};

const THEME_IMAGES_GREY_BY_NAME: Record<string, string> = {
  "adult": adultTileGreyImg,
  "fantasy": fantasyTileGreyImg,
  "horror": horrorTileGreyImg,
  "sci-fi": sciFiTileGreyImg,
};

interface Theme {
  id: string;
  name: string;
  icon: string;
  is_core: boolean;
  color: string | null;
  pack_id: string | null;
}

interface ThemeCode {
  id: string;
  code: string;
  status: string;
  themes: { id: string; name: string; icon: string; color: string | null }[];
}

interface ShopThemesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  customerId: string;
  shopDomain: string;
}

export function ShopThemesDialog({
  open,
  onOpenChange,
  tenantId,
  customerId,
  shopDomain,
}: ShopThemesDialogProps) {
  const [themes, setThemes] = useState<Theme[]>([]);
  const [loading, setLoading] = useState(false);
  const [purchasingTheme, setPurchasingTheme] = useState<string | null>(null);
  const [showThemeCodeDialog, setShowThemeCodeDialog] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState<{ id: string; name: string } | null>(null);
  const [unlockedThemeIds, setUnlockedThemeIds] = useState<Set<string>>(new Set());
  const [themeCodes, setThemeCodes] = useState<ThemeCode[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (open && tenantId) {
      loadThemes();
      loadUnlockedThemes();
      loadThemeCodes();
    }
  }, [open, tenantId]);

  const loadUnlockedThemes = async () => {
    try {
      const unlocked = new Set<string>();

      // 1. Get all themes and mark base pack themes as unlocked (static)
      const { data: allThemes } = await supabase
        .from("themes")
        .select("id, name")
        .in("name", []);

      if (allThemes?.length) {
        allThemes.forEach(theme => unlocked.add(theme.id));
      }

      // 2. Get theme codes redeemed by this customer
      const { data: redeemedCodes, error: codeError } = await supabase
        .from("theme_codes")
        .select("themes_unlocked")
        .eq("redeemed_by", customerId);

      if (!codeError && redeemedCodes?.length) {
        redeemedCodes.forEach(code => {
          (code.themes_unlocked || []).forEach(themeId => {
            unlocked.add(themeId);
          });
        });
      }

      setUnlockedThemeIds(unlocked);
    } catch (error) {
      console.error("Error loading unlocked themes:", error);
    }
  };

  const loadThemeCodes = async () => {
    try {
      const { data: unusedCodes } = await supabase
        .from("theme_codes")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("status", "unused");

      const { data: activeCodes } = await supabase
        .from("theme_codes")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("status", "active");

      const foundCodes = unusedCodes?.length > 0 ? unusedCodes : activeCodes || [];
      
      if (foundCodes.length > 0) {
        const unredeemed = foundCodes.filter(code => !code.redeemed_at);
        const formattedCodes = unredeemed.map(code => ({
          id: code.id,
          code: code.code,
          status: code.status,
          themes: [{ id: '', name: 'Theme code available', icon: '🎯', color: '#64748b' }]
        }));

        setThemeCodes(formattedCodes);
      } else {
        setThemeCodes([]);
      }
    } catch (error) {
      console.error("Error loading theme codes:", error);
    }
  };

  const loadThemes = async () => {
    setLoading(true);
    try {
      // Get all themes (themes belong to packs, not directly to tenants)
      const { data: allThemes, error } = await supabase
        .from("themes")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) throw error;

      setThemes(allThemes || []);
    } catch (error) {
      console.error("Error loading themes:", error);
      toast({
        title: "Error",
        description: "Failed to load themes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGetThemeCode = (themeId: string, themeName: string) => {
    setSelectedTheme({ id: themeId, name: themeName });
    setShowThemeCodeDialog(true);
  };

  const handleThemeUnlocked = () => {
    // Reload unlocked themes
    loadUnlockedThemes();
    loadThemeCodes(); // Refresh codes list
    setShowThemeCodeDialog(false);
    setSelectedTheme(null);
  };

  const copyToClipboard = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast({
        title: "Copied!",
        description: `Code ${code} copied to clipboard`,
      });
    } catch (error) {
      console.error("Failed to copy:", error);
      toast({
        title: "Copy failed",
        description: "Unable to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  // Show all themes without pack filtering
  const availableThemes = themes;
  const coreThemes = availableThemes.filter(theme => theme.is_core);
  const nonCoreThemes = availableThemes.filter(theme => !theme.is_core);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Shop Additional Themes
          </DialogTitle>
          <DialogDescription>
            Purchase themes not included in your current pack
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto space-y-6 pr-4" style={{
          scrollbarWidth: 'thin',
          scrollbarColor: 'transparent transparent'
        }}>
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </div>
          ) : (
            <>
              {/* Premium Themes Section */}
              {nonCoreThemes.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">Premium Themes</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {nonCoreThemes.map((theme) => {
                      const isUnlocked = unlockedThemeIds.has(theme.id);
                      const themeImage = isUnlocked
                        ? (THEME_IMAGES_BY_ID[theme.id] || THEME_IMAGES_BY_NAME[theme.name.toLowerCase()])
                        : (THEME_IMAGES_GREY_BY_ID[theme.id] || THEME_IMAGES_GREY_BY_NAME[theme.name.toLowerCase()] || THEME_IMAGES_BY_ID[theme.id] || THEME_IMAGES_BY_NAME[theme.name.toLowerCase()]);
                      return (
                      <Card key={theme.id} className="border-border hover:border-primary transition-colors overflow-hidden">
                        <CardContent className="p-0">
                          {themeImage ? (
                            <img src={themeImage} alt={theme.name} className="w-full aspect-[4/4] object-cover" />
                          ) : (
                            <div className="w-full aspect-[3/4] flex items-center justify-center" style={{ backgroundColor: theme.color || '#6b7280' }}>
                              <span className="text-2xl">{theme.icon || '🎯'}</span>
                            </div>
                          )}
                          <div className="p-4 text-center">
                            <h4 className="font-medium text-sm mb-2">{theme.name}</h4>
                            <div className="space-y-2">
                              {isUnlocked ? (
                                <Badge variant="secondary" className="bg-blue-100 text-blue-700 text-xs">
                                  Unlocked
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs">
                                  Premium Theme
                                </Badge>
                              )}
                              <Button
                                size="sm"
                                onClick={() => handleGetThemeCode(theme.id, theme.name)}
                                className="w-full text-xs"
                                disabled={isUnlocked}
                              >
                                {isUnlocked ? "Already Unlocked" : "Unlock Theme"}
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )})}
                  </div>
                </div>
              )}

              {availableThemes.length === 0 && !loading && (
                <div className="text-center py-8 text-muted-foreground">
                  <Check className="h-12 w-12 mx-auto mb-4 text-green-500" />
                  <p className="text-lg font-medium mb-2">You have all available themes!</p>
                  <p className="text-sm">All themes are included in your current pack.</p>
                </div>
              )}
              
              {availableThemes.length > 0 && coreThemes.length === 0 && nonCoreThemes.length === 0 && !loading && (
                <div className="text-center py-8 text-muted-foreground">
                  <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No additional themes available for purchase</p>
                </div>
              )}
            </>
          )}
        </div>

        <div className="border-t pt-4 mt-4">
          <div className="flex justify-between items-center text-sm text-muted-foreground">
            <p>Need help? Contact support for theme codes.</p>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>

      {/* Theme Code Input Dialog */}
      {selectedTheme && (
        <EnterThemeCodeDialog
          open={showThemeCodeDialog}
          onOpenChange={setShowThemeCodeDialog}
          themeId={selectedTheme.id}
          themeName={selectedTheme.name}
          customerId={customerId}
          shopDomain={shopDomain}
          tenantId={tenantId}
          onThemeUnlocked={handleThemeUnlocked}
        />
      )}
    </Dialog>
  );
}