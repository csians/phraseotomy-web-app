import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Sparkles } from "lucide-react";

interface Element {
  id: string;
  name: string;
  icon: string;
  theme_id: string;
}

interface ThemeElementsProps {
  themeId: string;
}

export function ThemeElements({ themeId }: ThemeElementsProps) {
  const [elements, setElements] = useState<Element[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="grid grid-cols-5 gap-4">
      {elements.map((element) => (
        <div
          key={element.id}
          className="flex flex-col items-center gap-2 p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
        >
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <p className="text-xs font-medium text-center">{element.name}</p>
        </div>
      ))}
    </div>
  );
}
