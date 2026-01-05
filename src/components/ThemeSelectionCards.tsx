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

// Theme images
import atHomeImg from "@/assets/themes/at-home.jpg";
import atWorkImg from "@/assets/themes/at-work.jpg";
import lifestyleImg from "@/assets/themes/lifestyle.jpg";
import travelImg from "@/assets/themes/travel.jpg";

// Map theme names to their images (case-insensitive matching)
const THEME_IMAGES: Record<string, string> = {
  "at home": atHomeImg,
  athome: atHomeImg,
  home: atHomeImg,
  "at work": atWorkImg,
  atwork: atWorkImg,
  work: atWorkImg,
  lifestyle: lifestyleImg,
  travel: travelImg,
};

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
  
  // All themes passed here are already filtered by pack
  // Filter out "Core" theme and separate base themes and expansion themes
  const filteredThemes = themes.filter((t) => t.name.toLowerCase() !== 'core');
  const baseThemes = filteredThemes.filter((t) => coreThemeNames.includes(t.name));
  const expansionThemes = filteredThemes.filter((t) => !coreThemeNames.includes(t.name));
  
  // Combine all themes and mark only first 4 as enabled
  const allThemes = [...baseThemes, ...expansionThemes];
  const themesWithEnabledStatus = allThemes.map((theme, index) => ({
    ...theme,
    isUnlocked: index < 4, // Only first 4 themes are enabled
  }));

  const renderThemeCard = (theme: ThemeOption) => {
    const IconComponent = iconMap[theme.icon] || Sparkles;
    const isSelected = selectedThemeId === theme.id;
    const isLocked = !theme.isUnlocked;
    const themeImage = THEME_IMAGES[theme.name.toLowerCase()];
    const isCoreTheme = coreThemeNames.includes(theme.name);

    return (
      <button
        key={theme.id}
        onClick={() => !isLocked && !disabled && onThemeSelect(theme.id)}
        onMouseEnter={() => setHoveredTheme(theme.id)}
        onMouseLeave={() => setHoveredTheme(null)}
        disabled={isLocked || disabled}
        className={cn(
          "relative aspect-[3/4] rounded-xl overflow-hidden border-2 transition-all duration-200 shadow-md",
          "flex flex-col justify-between p-4",
          isSelected
            ? "border-primary ring-2 ring-primary ring-offset-2 ring-offset-background scale-105 shadow-lg"
            : isLocked
            ? "border-muted cursor-not-allowed opacity-60"
            : "border-transparent hover:border-primary/50 hover:scale-102 cursor-pointer",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        {/* Theme image background */}
        {themeImage ? (
          <img 
            src={themeImage} 
            alt={theme.name} 
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div
            className="absolute inset-0 w-full h-full"
            style={{
              backgroundColor: isLocked ? "#374151" : "#4b5563",
            }}
          />
        )}

        {/* Overlay gradient for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

        {isLocked && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-xl z-10">
            <div className="flex flex-col items-center gap-2">
              <Lock className="h-6 w-6 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                {theme.packName || "Expansion Pack"}
              </span>
            </div>
          </div>
        )}

        {/* Content - only show theme name if NO image exists */}
        {!themeImage && (
          <div className="relative z-10 flex flex-col h-full items-center justify-center">
            {/* Theme name - large bold text */}
            <span className="text-2xl font-bold block text-white drop-shadow-lg">
              {theme.name.toUpperCase()}
            </span>
          </div>
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

      {/* All Themes - no section titles, only first 4 enabled */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {themesWithEnabledStatus.map(renderThemeCard)}
      </div>
    </div>
  );
}
