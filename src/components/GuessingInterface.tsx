import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState, useRef, useEffect } from "react";
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
  sessionId: string;
  roundNumber: number;
  playerId: string;
  onGuessSubmit: () => void;
}

export function GuessingInterface({
  storytellerName,
  theme,
  audioUrl,
  availableElements,
  correctElements,
  sessionId,
  roundNumber,
  playerId,
  onGuessSubmit,
}: GuessingInterfaceProps) {
  console.log("storytellerName", storytellerName);
  console.log("theme", theme);
  console.log("audioUrl", audioUrl);
  console.log("playerId", playerId);
  console.log("availableElements", availableElements);
  console.log("correctElements", correctElements);
  console.log("sessionId", sessionId);
  console.log("roundNumber", roundNumber);
  console.log("onGuessSubmit", onGuessSubmit);

  const { toast } = useToast();
  const [selectedElements, setSelectedElements] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attemptsRemaining, setAttemptsRemaining] = useState(3);
  const [hasFailedAllAttempts, setHasFailedAllAttempts] = useState(false);
  const [wrongGuesses, setWrongGuesses] = useState<string[]>([]);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Reset guessing state when round changes (allows players to answer in new rounds)
  useEffect(() => {
    console.log("Round changed to:", roundNumber, "- Resetting guessing state");
    setSelectedElements([]);
    setAttemptsRemaining(3);
    setHasFailedAllAttempts(false);
    setWrongGuesses([]);
  }, [roundNumber]);

  const toggleElement = (elementId: string) => {
    // Only allow selecting ONE element
    setSelectedElements([elementId]);
  };

  const handleSubmitGuess = async () => {
    if (selectedElements.length === 0) {
      toast({
        title: "No Selection",
        description: "Please select one element.",
        variant: "destructive",
      });
      return;
    }

    if (hasFailedAllAttempts) {
      toast({
        title: "No Attempts Left",
        description: "You've used all 3 attempts for this round.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Get the element name from the selected element
      const selectedElement = availableElements.find((el) => el.id === selectedElements[0]);
      if (!selectedElement) {
        throw new Error("Selected element not found");
      }

      // Submit guess to edge function
      const { data, error } = await supabase.functions.invoke("submit-guess", {
        body: {
          sessionId,
          roundNumber,
          playerId,
          guess: selectedElement.name,
        },
      });

      if (error) throw error;

      const { correct, points_earned, attempts_remaining, max_attempts_reached } = data;

      // Update attempts remaining
      setAttemptsRemaining(attempts_remaining);
      setHasFailedAllAttempts(max_attempts_reached);

      if (correct) {
        toast({
          title: "🎉 Correct!",
          description: `You earned ${points_earned} points!`,
        });
        onGuessSubmit();
      } else if (max_attempts_reached) {
        toast({
          title: "❌ Out of Attempts",
          description: "You cannot answer in this round. Wait for the next round!",
          variant: "destructive",
        });
        setSelectedElements([]); // Clear selection
      } else {
        // Add the wrong guess to the disabled list for this round only
        setWrongGuesses([...wrongGuesses, selectedElements[0]]);
        toast({
          title: "❌ Wrong Guess",
          description: `You have ${attempts_remaining} attempt${attempts_remaining === 1 ? '' : 's'} left!`,
          variant: "destructive",
        });
        setSelectedElements([]); // Clear selection for next attempt
      }
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
              Guess the <span className="text-primary">Secret Element!</span>
            </CardTitle>
            <CardDescription className="text-center text-lg">
              Theme: {theme.name} • Listen and guess which ONE element was described
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-muted/50 p-6 rounded-lg">
              <audio ref={audioRef} controls src={audioUrl} className="w-full" autoPlay />
            </div>

            <div>
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-semibold">
                  Which element was {storytellerName} describing? (10 points):
                </h3>
                <div className={`text-sm font-medium px-3 py-1 rounded-full ${
                  attemptsRemaining === 3 ? 'bg-green-500/10 text-green-600' :
                  attemptsRemaining === 2 ? 'bg-yellow-500/10 text-yellow-600' :
                  attemptsRemaining === 1 ? 'bg-orange-500/10 text-orange-600' :
                  'bg-red-500/10 text-red-600'
                }`}>
                  {hasFailedAllAttempts ? 'Locked this round' : `${attemptsRemaining}/3 attempts`}
                </div>
              </div>
              <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                {availableElements.map((element) => {
                  const isWrongGuess = wrongGuesses.includes(element.id);
                  return (
                    <button
                      key={element.id}
                      onClick={() => !isWrongGuess && toggleElement(element.id)}
                      disabled={isWrongGuess}
                      className={`flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all ${
                        isWrongGuess
                          ? "bg-destructive/10 border-destructive/50 opacity-50 cursor-not-allowed"
                          : selectedElements.includes(element.id)
                          ? "bg-primary/20 border-primary"
                          : "bg-card border-border hover:border-primary/50"
                      }`}
                    >
                      <div className="text-2xl mb-2">{element.icon}</div>
                      <p className="text-xs font-medium text-center">{element.name}</p>
                      {selectedElements.includes(element.id) && <Check className="h-4 w-4 text-primary mt-1" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <Button
              onClick={handleSubmitGuess}
              disabled={isSubmitting || selectedElements.length === 0 || hasFailedAllAttempts}
              size="lg"
              className="w-full"
            >
              {isSubmitting ? "Submitting..." : hasFailedAllAttempts ? "Wait for Next Round" : "Submit Guess"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
