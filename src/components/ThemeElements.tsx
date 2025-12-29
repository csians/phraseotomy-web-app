import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Sparkles, PlusCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface Element {
  id: string;
  name: string;
  icon: string;
  theme_id: string;
}

interface ThemeElementsProps {
  themeId: string;
  onElementSelect?: (elementName: string) => void;
  selectedElementId?: string;
  isGuessing?: boolean; // When true, hides custom element input (for guessing players)
}

export function ThemeElements({ themeId, onElementSelect, selectedElementId, isGuessing = false }: ThemeElementsProps) {
  const [elements, setElements] = useState<Element[]>([]);
  const [loading, setLoading] = useState(true);
  const [customElement, setCustomElement] = useState("");

  useEffect(() => {
    fetchElements();
  }, [themeId]);

  const fetchElements = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("elements")
        .select("*")
        .eq("theme_id", themeId)
        .limit(5);

      if (error) {
        console.error("Error fetching elements:", error);
        return;
      }

      setElements(data || []);
    } catch (error) {
      console.error("Error in fetchElements:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCustomElementSelect = () => {
    if (customElement.trim()) {
      // Pass custom element as "custom:{text}" format
      onElementSelect?.(`custom:${customElement.trim()}`);
      setCustomElement(""); // Clear input after selection
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCustomElementSelect();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (elements.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-muted-foreground">No elements found for this theme</p>
      </div>
    );
  }

  const isCustomSelected = selectedElementId?.startsWith('custom:');
  const selectedCustomText = isCustomSelected ? selectedElementId?.replace('custom:', '') : '';

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-5 gap-4">
        {elements.map((element) => {
          const isSelected = selectedElementId === element.name;
          return (
            <div
              key={element.id}
              onClick={() => onElementSelect?.(element.name)}
              className={`flex flex-col items-center gap-2 p-4 rounded-lg cursor-pointer transition-all ${
                isSelected 
                  ? 'bg-primary text-primary-foreground ring-2 ring-primary shadow-lg scale-105' 
                  : 'bg-muted/50 hover:bg-muted hover:scale-102'
              }`}
            >
              <div className={`h-12 w-12 rounded-full flex items-center justify-center ${
                isSelected ? 'bg-primary-foreground/20' : 'bg-primary/10'
              }`}>
                <Sparkles className={`h-6 w-6 ${isSelected ? 'text-primary-foreground' : 'text-primary'}`} />
              </div>
              <p className="text-xs font-medium text-center">{element.name}</p>
            </div>
          );
        })}
      </div>

      {/* Only show custom element input for storyteller, not for guessing players */}
      {!isGuessing && (
        <div className="border-t border-border pt-6">
          <p className="text-sm font-medium mb-3 text-muted-foreground">Or add your own custom element:</p>
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder="Type your custom element..."
              value={customElement}
              onChange={(e) => setCustomElement(e.target.value)}
              onKeyPress={handleKeyPress}
              maxLength={50}
              className="flex-1"
            />
            <Button 
              onClick={handleCustomElementSelect}
              disabled={!customElement.trim()}
              variant={isCustomSelected ? "default" : "outline"}
            >
              <PlusCircle className="h-4 w-4 mr-2" />
              {isCustomSelected ? "Selected" : "Select"}
            </Button>
          </div>
          {isCustomSelected && selectedCustomText && (
            <p className="text-sm text-muted-foreground mt-2">
              Custom element selected: <span className="font-medium text-foreground">"{selectedCustomText}"</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
