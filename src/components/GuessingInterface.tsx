import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useRef, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Send, Volume2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { IconSelectionPanel, IconItem } from "@/components/IconSelectionPanel";

interface GuessingInterfaceProps {
  storytellerName: string;
  theme: { id: string; name: string };
  audioUrl: string;
  sessionId: string;
  roundNumber: number;
  playerId: string;
  onGuessSubmit: () => void;
  selectedIcons?: IconItem[];
}

export function GuessingInterface({
  storytellerName,
  theme,
  audioUrl,
  sessionId,
  roundNumber,
  playerId,
  onGuessSubmit,
  selectedIcons = [],
}: GuessingInterfaceProps) {
  const { toast } = useToast();
  const [guess, setGuess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLockedOut, setIsLockedOut] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Reset guessing state when round changes
  useEffect(() => {
    console.log("Round changed to:", roundNumber, "- Resetting guessing state");
    setGuess("");
    setIsLockedOut(false);
    setHasSubmitted(false);
  }, [roundNumber]);

  const handleSubmitGuess = async () => {
    const trimmedGuess = guess.trim();
    
    if (!trimmedGuess) {
      toast({
        title: "Empty Guess",
        description: "Please type your guess.",
        variant: "destructive",
      });
      return;
    }

    if (isLockedOut || hasSubmitted) {
      toast({
        title: "Already Answered",
        description: "You already submitted a guess. Wait for the next round!",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Submit guess to edge function
      const { data, error } = await supabase.functions.invoke("submit-guess", {
        body: {
          sessionId,
          roundNumber,
          playerId,
          guess: trimmedGuess,
        },
      });

      if (error) throw error;

      const { correct, points_earned } = data;
      setHasSubmitted(true);

      if (correct) {
        toast({
          title: "🎉 Correct!",
          description: `You guessed "${trimmedGuess}" and earned ${points_earned} points!`,
        });
        onGuessSubmit();
      } else {
        setIsLockedOut(true);
        toast({
          title: "❌ Wrong Answer!",
          description: `"${trimmedGuess}" is not correct. Wait for the next round!`,
          variant: "destructive",
          duration: 5000,
        });
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

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isSubmitting && !isLockedOut && !hasSubmitted) {
      handleSubmitGuess();
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-4xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-center text-2xl">
              Guess the <span className="text-primary">Whisp!</span>
            </CardTitle>
            <CardDescription className="text-center text-lg">
              Theme: {theme.name} • Listen to {storytellerName}'s story and guess the word
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Icons Display */}
            {selectedIcons.length > 0 && (
              <div className="bg-muted/30 p-6 rounded-xl">
                <IconSelectionPanel
                  icons={selectedIcons}
                  isDraggable={false}
                  label="Story Icons (in order)"
                />
              </div>
            )}

            {/* Audio Player */}
            <div className="bg-muted/50 p-6 rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <Volume2 className="h-5 w-5 text-primary" />
                <span className="font-medium">Listen to the story:</span>
              </div>
              <audio ref={audioRef} controls src={audioUrl} className="w-full" autoPlay />
            </div>

            {/* Guess Input */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-semibold">
                  What's the whisp word? (10 points):
                </h3>
                {(isLockedOut || hasSubmitted) && (
                  <div className={`text-sm font-medium px-3 py-1 rounded-full ${
                    isLockedOut 
                      ? "bg-red-500/10 text-red-600" 
                      : "bg-green-500/10 text-green-600"
                  }`}>
                    {isLockedOut ? "🔒 Locked this round" : "✓ Submitted"}
                  </div>
                )}
              </div>
              
              {isLockedOut ? (
                <div className="bg-destructive/10 border-2 border-destructive/50 rounded-lg p-8 text-center">
                  <p className="text-lg font-semibold text-destructive mb-2">❌ Wrong Guess!</p>
                  <p className="text-sm text-muted-foreground">
                    Wait for the next round to guess again. Other players are still guessing!
                  </p>
                </div>
              ) : hasSubmitted ? (
                <div className="bg-green-500/10 border-2 border-green-500/50 rounded-lg p-8 text-center">
                  <p className="text-lg font-semibold text-green-600 mb-2">✓ Guess Submitted!</p>
                  <p className="text-sm text-muted-foreground">
                    Waiting for other players to finish guessing...
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <Input
                    value={guess}
                    onChange={(e) => setGuess(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Type your guess here..."
                    className="text-lg py-6"
                    disabled={isSubmitting}
                    autoFocus
                  />
                  <Button
                    onClick={handleSubmitGuess}
                    disabled={isSubmitting || !guess.trim()}
                    size="lg"
                    className="w-full"
                  >
                    <Send className="mr-2 h-5 w-5" />
                    {isSubmitting ? "Submitting..." : "Submit Guess"}
                  </Button>
                </div>
              )}
            </div>

            {/* Tips */}
            <div className="bg-muted/50 p-4 rounded-lg">
              <p className="text-sm text-muted-foreground text-center">
                💡 Look at the icons and listen to the story. The whisp is a single word related to the theme "{theme.name}".
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
