import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Briefcase,
  Home,
  Plane,
  Bike,
  Wine,
  Rocket,
  Skull,
  Sparkles,
} from "lucide-react";
import { useState } from "react";

interface Theme {
  id: string;
  name: string;
  icon: string;
}

interface ThemeSelectionProps {
  themes: Theme[];
  onThemeSelect: (themeId: string) => void;
  playerName: string;
}

const iconMap: Record<string, any> = {
  briefcase: Briefcase,
  home: Home,
  plane: Plane,
  bike: Bike,
  wine: Wine,
  rocket: Rocket,
  skull: Skull,
  sparkles: Sparkles,
};

export function ThemeSelection({ themes, onThemeSelect, playerName }: ThemeSelectionProps) {
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);

  const handleThemeClick = (themeId: string) => {
    setSelectedTheme(themeId);
    onThemeSelect(themeId);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">
            <span className="text-primary">{playerName}</span>, it's your turn!
          </h1>
          <p className="text-muted-foreground text-lg">Choose a theme for your story.</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {themes.map((theme) => {
            const IconComponent = iconMap[theme.icon] || Sparkles;
            return (
              <Button
                key={theme.id}
                variant="outline"
                onClick={() => handleThemeClick(theme.id)}
                disabled={!!selectedTheme}
                className="h-32 flex flex-col items-center justify-center gap-3 bg-card hover:bg-primary/10 hover:border-primary transition-all"
              >
                <IconComponent className="h-12 w-12" />
                <span className="text-lg font-semibold">{theme.name}</span>
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
