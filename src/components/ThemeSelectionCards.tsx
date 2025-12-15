import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lock } from "lucide-react";
import {
  Briefcase, Home, Plane, Bike, Wine, Rocket, Skull, Sparkles,
  Music, Gamepad2, Heart, Camera, LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const iconMap: Record<string, LucideIcon> = {
  briefcase: Briefcase,
  home: Home,
  plane: Plane,
  bike: Bike,
  wine: Wine,
  rocket: Rocket,
  skull: Skull,
  sparkles: Sparkles,
  music: Music,
  gamepad2: Gamepad2,
  heart: Heart,
  camera: Camera,
};

export interface ThemeOption {
  id: string;
  name: string;
  icon: string;
  isCore: boolean;
  isUnlocked: boolean;
  packName?: string;
  packId?: string | null;
}

interface ThemeSelectionCardsProps {
  themes: ThemeOption[];
  onThemeSelect: (themeId: string) => void;
  selectedThemeId?: string;
  disabled?: boolean;
  playerName?: string;
  unlockedPackIds?: string[]; // Pack IDs the customer has unlocked
}

export function ThemeSelectionCards({
  themes,
  onThemeSelect,
  selectedThemeId,
  disabled = false,
  playerName,
  unlockedPackIds = [],
}: ThemeSelectionCardsProps) {
  const [hoveredTheme, setHoveredTheme] = useState<string | null>(null);

  // Core theme names that are always enabled
  const coreThemeNames = ['At Home', 'At Work', 'Lifestyle', 'Travel'];
  
  // Filter themes based on theme name
  // Only these 4 themes are clickable; all other themes are visible but disabled
  const visibleThemes = themes.map((theme) => {
    const isEnabled = coreThemeNames.includes(theme.name);
    return { ...theme, isUnlocked: isEnabled };
  });

  // Separate base themes and other themes
  const baseThemes = visibleThemes.filter((t) => coreThemeNames.includes(t.name));
  const expansionThemes = visibleThemes.filter((t) => !coreThemeNames.includes(t.name));

  const renderThemeCard = (theme: ThemeOption) => {
    const IconComponent = iconMap[theme.icon] || Sparkles;
    const isSelected = selectedThemeId === theme.id;
    const isLocked = !theme.isUnlocked;

    return (
      <button
        key={theme.id}
        onClick={() => !isLocked && !disabled && onThemeSelect(theme.id)}
        onMouseEnter={() => setHoveredTheme(theme.id)}
        onMouseLeave={() => setHoveredTheme(null)}
        disabled={isLocked || disabled}
        className={cn(
          "relative flex flex-col items-center justify-center gap-3 p-6 rounded-xl border-2 transition-all duration-200",
          isSelected
            ? "bg-primary text-primary-foreground border-primary shadow-lg scale-105"
            : isLocked
            ? "bg-muted/30 border-muted cursor-not-allowed opacity-60"
            : "bg-card border-border hover:border-primary/50 hover:bg-primary/5 cursor-pointer",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        {isLocked && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-xl">
            <div className="flex flex-col items-center gap-2">
              <Lock className="h-6 w-6 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                {theme.packName || "Expansion Pack"}
              </span>
            </div>
          </div>
        )}

        <div
          className={cn(
            "h-16 w-16 rounded-full flex items-center justify-center transition-colors",
            isSelected ? "bg-primary-foreground/20" : "bg-primary/10"
          )}
        >
          <IconComponent
            className={cn(
              "h-8 w-8 transition-colors",
              isSelected ? "text-primary-foreground" : "text-primary"
            )}
          />
        </div>

        <span className="text-lg font-semibold">{theme.name}</span>

        {theme.isCore && (
          <Badge variant="secondary" className="text-xs">
            Base Game
          </Badge>
        )}
      </button>
    );
  };

  return (
    <div className="space-y-8">
      {playerName && (
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground mb-2">
            <span className="text-primary">{playerName}</span>, choose a theme!
          </h2>
          <p className="text-muted-foreground">
            Select a theme for your story. Icons from this theme will guide your storytelling.
          </p>
        </div>
      )}

      {/* Base Game Themes */}
      <div>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Base Game Themes
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {baseThemes.map(renderThemeCard)}
        </div>
      </div>

      {/* Expansion Themes */}
      {expansionThemes.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Rocket className="h-5 w-5 text-primary" />
            Expansion Packs
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {expansionThemes.map(renderThemeCard)}
          </div>
        </div>
      )}
    </div>
  );
}
