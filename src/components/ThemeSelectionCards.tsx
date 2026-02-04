import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Briefcase, Home, Plane, Bike, Wine, Rocket, Skull, Sparkles,
  Music, Gamepad2, Heart, Camera, LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Theme images - Core themes
import atHomeImg from "@/assets/themes/at-home.jpg";
import atWorkImg from "@/assets/themes/at-work.jpg";
import lifestyleImg from "@/assets/themes/lifestyle.jpg";
import travelImg from "@/assets/themes/travel.jpg";

// Theme images - Expansion themes (regular)
import adultTileImg from "@/assets/themes/adult tile.png";
import fantasyTileImg from "@/assets/themes/fantasy tile.png";
import horrorTileImg from "@/assets/themes/horror tile.png";
import sciFiTileImg from "@/assets/themes/sci-fi tile.png";

// Theme images - Expansion themes (grey/locked versions)
import adultTileGreyImg from "@/assets/themes/adult tile grey.png";
import fantasyTileGreyImg from "@/assets/themes/fantasy tile grey.png";
import horrorTileGreyImg from "@/assets/themes/horror tile grey.png";
import sciFiTileGreyImg from "@/assets/themes/sci-fi tile grey.png";

// Map theme names to their images (case-insensitive matching)
// Regular images for unlocked themes
const THEME_IMAGES: Record<string, string> = {
  "at home": atHomeImg,
  athome: atHomeImg,
  home: atHomeImg,
  "at work": atWorkImg,
  atwork: atWorkImg,
  work: atWorkImg,
  lifestyle: lifestyleImg,
  travel: travelImg,
  adult: adultTileImg,
  fantasy: fantasyTileImg,
  horror: horrorTileImg,
  "sci-fi": sciFiTileImg,
  scifi: sciFiTileImg,
  "sci fi": sciFiTileImg,
};

// Map theme IDs to their images for direct lookup
const THEME_IMAGES_BY_ID: Record<string, string> = {
  // Core themes
  "dd7cb9da-7af3-40d1-8d48-c68cfb63816a": atWorkImg,      // At Work
  "219a2cd6-2f57-47aa-a326-2587b7612e74": atHomeImg,      // At Home
  "f9fc1b75-7ae2-4b0f-8be9-cc0ead6f193f": travelImg,      // Travel
  "64baef58-c0f3-4f75-a3ff-13889b5d862d": lifestyleImg,   // Lifestyle
  
  // Premium themes
  "98c9218d-8b63-4bef-a049-05861b2da98c": adultTileImg,   // Adult
  "c84fc90d-5d48-43e6-9f3b-2e8a5a4e9b6c": fantasyTileImg, // Fantasy
  "a1b2c3d4-e5f6-7890-abcd-ef1234567890": horrorTileImg,  // Horror
  "b2c3d4e5-f6a7-8901-bcde-f12345678901": sciFiTileImg,   // Sci-Fi
};

// Map theme IDs to their grey images (for locked themes)
const THEME_IMAGES_GREY_BY_ID: Record<string, string> = {
  "98c9218d-8b63-4bef-a049-05861b2da98c": adultTileGreyImg,   // Adult
  "c84fc90d-5d48-43e6-9f3b-2e8a5a4e9b6c": fantasyTileGreyImg, // Fantasy
  "a1b2c3d4-e5f6-7890-abcd-ef1234567890": horrorTileGreyImg,  // Horror
  "b2c3d4e5-f6a7-8901-bcde-f12345678901": sciFiTileGreyImg,   // Sci-Fi
};

// Map theme names to their grey images (for locked themes)
const THEME_IMAGES_GREY: Record<string, string> = {
  adult: adultTileGreyImg,
  fantasy: fantasyTileGreyImg,
  horror: horrorTileGreyImg,
  "sci-fi": sciFiTileGreyImg,
  scifi: sciFiTileGreyImg,
  "sci fi": sciFiTileGreyImg,
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
  unlockedPackIds?: string[]; 
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
  
  // Filter out "Core" theme and only show unlocked themes
  const filteredThemes = themes.filter((t) => 
    t.name.toLowerCase() !== 'core' && t.isUnlocked !== false
  );
  const baseThemes = filteredThemes.filter((t) => coreThemeNames.includes(t.name));
  const expansionThemes = filteredThemes.filter((t) => !coreThemeNames.includes(t.name));
  
  // Combine all unlocked themes
  const allThemes = [...baseThemes, ...expansionThemes];
  const themesWithEnabledStatus = allThemes;

  const renderThemeCard = (theme: ThemeOption) => {
    const IconComponent = iconMap[theme.icon] || Sparkles;
    const isSelected = selectedThemeId === theme.id;
    const isLocked = !theme.isUnlocked;
    const themeNameLower = theme.name.toLowerCase();
    
    // Try to get image by ID first, then fallback to name-based lookup
    let themeImage = THEME_IMAGES_BY_ID[theme.id] || THEME_IMAGES[themeNameLower];
    if (isLocked && (THEME_IMAGES_GREY_BY_ID[theme.id] || THEME_IMAGES_GREY[themeNameLower])) {
      themeImage = THEME_IMAGES_GREY_BY_ID[theme.id] || THEME_IMAGES_GREY[themeNameLower];
    }
    
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
