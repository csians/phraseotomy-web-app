import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Element {
  id: string;
  name: string;
  icon: string;
}

interface GuessingInterfaceProps {
  storytellerName: string;
  theme: { id: string; name: string };
  audioUrl: string;
  availableElements: Element[];
  correctElements: string[];
  turnId: string;
  playerId: string;
  onGuessSubmit: () => void;
}

export function GuessingInterface({
  storytellerName,
  theme,
  audioUrl,
  availableElements,
  correctElements,
  turnId,
  playerId,
  onGuessSubmit,
}: GuessingInterfaceProps) {
  const { toast } = useToast();
  const [selectedElements, setSelectedElements] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const toggleElement = (elementId: string) => {
    setSelectedElements((prev) =>
      prev.includes(elementId)
        ? prev.filter((id) => id !== elementId)
        : [...prev, elementId]
    );
  };

  const handleSubmitGuess = async () => {
    if (selectedElements.length === 0) {
      toast({
        title: "No Selection",
        description: "Please select at least one element.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Calculate points (10 points per correct element)
      const correctGuesses = selectedElements.filter((id) =>
        correctElements.includes(id)
      );
      const pointsEarned = correctGuesses.length * 10;

      // Submit guess
      const { error: guessError } = await supabase.from("game_guesses").insert({
        turn_id: turnId,
        player_id: playerId,
        guessed_elements: selectedElements,
        points_earned: pointsEarned,
      });

      if (guessError) throw guessError;

      // Update player score
      const { error: scoreError } = await supabase.rpc("increment_player_score", {
        p_player_id: playerId,
        p_points: pointsEarned,
      });

      if (scoreError) {
        console.error("Error updating score:", scoreError);
      }

      toast({
        title: `You earned ${pointsEarned} points!`,
        description: `You guessed ${correctGuesses.length} out of ${correctElements.length} elements correctly.`,
      });

      onGuessSubmit();
    } catch (error) {
      console.error("Error submitting guess:", error);
      toast({
        title: "Submission Failed",
        description: "Could not submit your guess. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-3xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-center text-2xl">
              Listen to <span className="text-primary">{storytellerName}'s</span> story
            </CardTitle>
            <CardDescription className="text-center text-lg">
              Theme: {theme.name} • Guess which elements they used
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-muted/50 p-6 rounded-lg">
              <audio
                ref={audioRef}
                controls
                src={audioUrl}
                className="w-full"
                autoPlay
              />
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-3">
                Select the elements you heard (10 points each):
              </h3>
              <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                {availableElements.map((element) => (
                  <button
                    key={element.id}
                    onClick={() => toggleElement(element.id)}
                    className={`flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all ${
                      selectedElements.includes(element.id)
                        ? "bg-primary/20 border-primary"
                        : "bg-card border-border hover:border-primary/50"
                    }`}
                  >
                    <div className="text-2xl mb-2">{element.icon}</div>
                    <p className="text-xs font-medium text-center">{element.name}</p>
                    {selectedElements.includes(element.id) && (
                      <Check className="h-4 w-4 text-primary mt-1" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <Button
              onClick={handleSubmitGuess}
              disabled={isSubmitting || selectedElements.length === 0}
              size="lg"
              className="w-full"
            >
              {isSubmitting ? "Submitting..." : "Submit Guess"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
