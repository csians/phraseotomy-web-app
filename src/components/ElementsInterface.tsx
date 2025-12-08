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

  const handleIconOrderChange = async (newOrder: IconItem[]) => {
    setOrderedIcons(newOrder);
    
    // Save new order to database
    const iconOrder = newOrder.map((_, index) => index);
    try {
      await supabase.functions.invoke("update-icon-order", {
        body: { turnId, iconOrder },
      });
      
      // Notify other players
      sendWebSocketMessage?.({
        type: "icons_reordered",
        iconOrder,
      });
    } catch (error) {
      console.error("Error updating icon order:", error);
    }
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
      // Save final icon order and mark turn as completed
      const iconOrder = orderedIcons.map((_, index) => index);
      
      const { error: updateError } = await supabase
        .from("game_turns")
        .update({ 
          icon_order: iconOrder,
          completed_at: new Date().toISOString()
        })
        .eq("id", turnId);

      if (updateError) throw updateError;

      // Notify others via WebSocket
      sendWebSocketMessage?.({
        type: "elements_submitted",
        selectedIcons: orderedIcons,
        iconOrder,
      });

      toast({
        title: "Elements Submitted!",
        description: "Other players can now guess your whisp.",
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
            {/* Icons Display - Draggable for storyteller */}
            {orderedIcons.length > 0 && (
              <div className="bg-muted/30 p-6 rounded-xl">
                <IconSelectionPanel
                  icons={orderedIcons}
                  onOrderChange={isStoryteller ? handleIconOrderChange : undefined}
                  isDraggable={isStoryteller}
                  label={isStoryteller ? "Drag elements to create your clue order" : "Element Order"}
                />
              </div>
            )}

            {/* Whisp display - only visible to storyteller */}
            {isStoryteller && whisp && (
              <div className="bg-primary/10 p-6 rounded-lg border-2 border-primary/20">
                <div className="flex items-center justify-center gap-2 mb-3">
                  <Sparkles className="h-6 w-6 text-primary" />
                  <h3 className="text-xl font-semibold text-primary">Your Secret Whisp</h3>
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
                <p className="text-4xl font-bold text-center text-primary mb-3">{whisp}</p>
                <p className="text-sm text-muted-foreground text-center">
                  Arrange the elements above in an order that hints at this word!
                </p>
              </div>
            )}

            {/* Non-storyteller waiting view */}
            {!isStoryteller && (
              <div className="bg-muted/50 p-6 rounded-lg text-center">
                <Grid3X3 className="h-12 w-12 mx-auto mb-3 text-muted-foreground animate-pulse" />
                <p className="text-lg font-medium text-muted-foreground">
                  Waiting for {storytellerName} to arrange elements...
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Look at the element order for clues and try to guess the whisp word!
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
                    ? "Arrange the elements in an order that tells a story or gives clues about your whisp word. The order matters - use it creatively!"
                    : "Look at how the elements are ordered. The sequence is your clue to guess the whisp word!"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
