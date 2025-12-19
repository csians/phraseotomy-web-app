import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Send, Sparkles, Lightbulb, Grid3X3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { IconSelectionPanel, IconItem } from "@/components/IconSelectionPanel";

interface ElementsInterfaceProps {
  theme: { id: string; name: string };
  whisp: string;
  sessionId: string;
  playerId: string;
  turnId: string;
  onSubmit: () => void;
  isStoryteller: boolean;
  storytellerName: string;
  sendWebSocketMessage?: (message: any) => void;
  selectedIcons?: IconItem[];
}

export function ElementsInterface({
  theme,
  whisp,
  sessionId,
  playerId,
  turnId,
  onSubmit,
  isStoryteller,
  storytellerName,
  sendWebSocketMessage,
  selectedIcons = [],
}: ElementsInterfaceProps) {
  const { toast } = useToast();
  const [orderedIcons, setOrderedIcons] = useState<IconItem[]>(selectedIcons);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setOrderedIcons(selectedIcons);
  }, [selectedIcons]);

  // Just update local state on drag - no API call until submit
  const handleIconOrderChange = (newOrder: IconItem[]) => {
    setOrderedIcons(newOrder);
  };

  const handleSubmit = async () => {
    if (orderedIcons.length === 0) {
      toast({
        title: "No Elements",
        description: "Waiting for elements to load...",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Save final reordered icon IDs and mark turn as completed
      const reorderedIconIds = orderedIcons.map((icon) => icon.id);
      
      const { error: updateError } = await supabase
        .from("game_turns")
        .update({ 
          selected_icon_ids: reorderedIconIds,
          completed_at: new Date().toISOString()
        })
        .eq("id", turnId);

      if (updateError) throw updateError;

      // Notify others via WebSocket
      sendWebSocketMessage?.({
        type: "elements_submitted",
        reorderedIconIds,
      });

      toast({
        title: "Elements Submitted!",
        description: "Other players can now guess your wisp.",
      });

      onSubmit();
    } catch (error) {
      console.error("Error submitting elements:", error);
      toast({
        title: "Submit Failed",
        description: "Could not submit your elements. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-4xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-center text-2xl">
              {isStoryteller ? (
                <span className="text-primary flex items-center justify-center gap-2">
                  <Grid3X3 className="h-6 w-6" />
                  Arrange Your Elements
                </span>
              ) : (
                <span className="text-primary">
                  {storytellerName} is arranging elements
                </span>
              )}
            </CardTitle>
            <CardDescription className="text-center text-lg">
              Theme: {theme.name}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Icons Display - Only show to storyteller during arrangement phase */}
            {isStoryteller && orderedIcons.length > 0 && (
              <div className="bg-muted/30 p-6 rounded-xl">
                <IconSelectionPanel
                  icons={orderedIcons}
                  onOrderChange={handleIconOrderChange}
                  isDraggable={true}
                  label="Drag elements to create your clue order"
                />
              </div>
            )}

            {/* Wisp display - only visible to storyteller */}
            {isStoryteller && whisp && (
              <div className="bg-primary/10 p-6 rounded-lg border-2 border-primary/20">
                <div className="flex items-center justify-center gap-2 mb-3">
                  <Sparkles className="h-6 w-6 text-primary" />
                  <h3 className="text-xl font-semibold text-primary">Your Secret Wisp</h3>
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
                <p className="text-4xl font-bold text-center text-primary mb-3">{whisp}</p>
                <p className="text-sm text-muted-foreground text-center">
                  Arrange the elements above in an order that hints at this word!
                </p>
              </div>
            )}

            {/* Non-storyteller waiting view - DON'T show elements until submitted */}
            {!isStoryteller && (
              <div className="bg-muted/50 p-6 rounded-lg text-center">
                <Grid3X3 className="h-12 w-12 mx-auto mb-3 text-muted-foreground animate-pulse" />
                <p className="text-lg font-medium text-muted-foreground">
                  Waiting for {storytellerName} to arrange elements...
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  The elements will appear after the storyteller submits.
                </p>
              </div>
            )}

            {/* Submit section - only for storyteller */}
            {isStoryteller && (
              <div className="border-t border-border pt-6">
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting || orderedIcons.length === 0}
                  size="lg"
                  className="w-full"
                >
                  <Send className="mr-2 h-5 w-5" />
                  {isSubmitting ? "Submitting..." : "Submit Element Order"}
                </Button>
              </div>
            )}

            {/* Tips */}
            <div className="bg-muted/50 p-4 rounded-lg">
              <div className="flex items-start gap-2">
                <Lightbulb className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <p className="text-sm text-muted-foreground">
                  {isStoryteller 
                    ? "Arrange the elements in an order that tells a story or gives clues about your wisp word. The order matters - use it creatively!"
                    : "Look at how the elements are ordered. The sequence is your clue to guess the wisp word!"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
