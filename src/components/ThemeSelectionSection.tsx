import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { ThemeCodeDialog } from "./ThemeCodeDialog";
import { CheckCircle2, Lock, Plus } from "lucide-react";

interface Theme {
  id: string;
  name: string;
  icon: string;
  is_core: boolean;
  isCore: boolean;
  isUnlocked: boolean;
}

interface ThemeSelectionSectionProps {
  availableThemes: Theme[];
  selectedThemes: string[];
  onThemeToggle: (themeId: string) => void;
  isBasePack: boolean;
  customerId: string;
  shopDomain: string;
  onThemeUnlocked: (themes: string[]) => void;
}

const BASE_PACK_THEMES = ["At Home", "Lifestyle", "At Work", "Travel"];

export function ThemeSelectionSection({
  availableThemes,
  selectedThemes,
  onThemeToggle,
  isBasePack,
  customerId,
  shopDomain,
  onThemeUnlocked,
}: ThemeSelectionSectionProps) {
  const [showThemeCodeDialog, setShowThemeCodeDialog] = useState(false);

  // Show theme selection only if base pack is unlocked
  if (!isBasePack) {
    return null;
  }

  // Filter themes into base and additional
  const baseThemes = availableThemes.filter(theme => 
    BASE_PACK_THEMES.includes(theme.name) && theme.isCore && theme.isUnlocked
  );
  
  const additionalThemes = availableThemes.filter(theme => 
    !BASE_PACK_THEMES.includes(theme.name)
  );

  return (
    <div className="space-y-4">
      <Label className="text-base font-semibold">Select Themes</Label>
      
      {/* Base Themes */}
      {baseThemes.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Base Themes (Included)</p>
          <div className="grid grid-cols-2 gap-3">
            {baseThemes.map((theme) => (
              <Card
                key={theme.id}
                className={`cursor-pointer transition-all duration-200 ${
                  selectedThemes.includes(theme.id)
                    ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                    : "border-border hover:border-primary/40 hover:bg-muted/50"
                }`}
                onClick={() => onThemeToggle(theme.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0">
                      {selectedThemes.includes(theme.id) ? (
                        <CheckCircle2 className="h-5 w-5 text-primary" />
                      ) : (
                        <div className="h-5 w-5 rounded-full border-2 border-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{theme.name}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Additional Themes */}
      {additionalThemes.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Additional Themes</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowThemeCodeDialog(true)}
              className="text-xs"
            >
              <Plus className="h-3 w-3 mr-1" />
              Choose More Themes
            </Button>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            {additionalThemes.map((theme) => (
              <Card
                key={theme.id}
                className={`transition-all duration-200 ${
                  theme.isUnlocked
                    ? selectedThemes.includes(theme.id)
                      ? "border-primary bg-primary/10 ring-2 ring-primary/20 cursor-pointer"
                      : "border-border hover:border-primary/40 hover:bg-muted/50 cursor-pointer"
                    : "border-muted bg-muted/30 opacity-60 cursor-not-allowed"
                }`}
                onClick={() => theme.isUnlocked && onThemeToggle(theme.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0">
                      {!theme.isUnlocked ? (
                        <Lock className="h-5 w-5 text-muted-foreground" />
                      ) : selectedThemes.includes(theme.id) ? (
                        <CheckCircle2 className="h-5 w-5 text-primary" />
                      ) : (
                        <div className="h-5 w-5 rounded-full border-2 border-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className={`font-medium text-sm ${
                        !theme.isUnlocked ? "text-muted-foreground" : ""
                      }`}>
                        {theme.name}
                      </p>
                      {!theme.isUnlocked && (
                        <p className="text-xs text-muted-foreground">Locked</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {selectedThemes.length > 0 && (
        <div className="text-sm text-muted-foreground">
          {selectedThemes.length} theme(s) selected
        </div>
      )}

      <ThemeCodeDialog
        open={showThemeCodeDialog}
        onOpenChange={setShowThemeCodeDialog}
        customerId={customerId}
        shopDomain={shopDomain}
        onThemeUnlocked={onThemeUnlocked}
      />
    </div>
  );
}
