import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useRef, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Send, Volume2, Play, Pause } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { IconSelectionPanel, IconItem } from "@/components/IconSelectionPanel";
import { Slider } from "@/components/ui/slider";

interface GuessingInterfaceProps {
  storytellerName: string;
  theme: { id: string; name: string };
  audioUrl?: string;
  sessionId: string;
  roundNumber: number;
  playerId: string;
  onGuessSubmit: (gameCompleted?: boolean, players?: any[], wasCorrect?: boolean) => void;
  selectedIcons?: IconItem[];
  turnMode?: "audio" | "elements";
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
  turnMode = "audio",
}: GuessingInterfaceProps) {
  const { toast } = useToast();
  const [guess, setGuess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLockedOut, setIsLockedOut] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const hasAutoPlayedRef = useRef(false);

  // Check if player already submitted guess for this round on mount/round change
  useEffect(() => {
    const checkExistingGuess = async () => {
      console.log("Round changed to:", roundNumber, "- Checking existing guesses");
      setGuess("");
      setIsLockedOut(false);
      setHasSubmitted(false);

      try {
        // Check if player already submitted a guess for this turn
        const { data: turnData } = await supabase
          .from("game_turns")
          .select("id")
          .eq("session_id", sessionId)
          .eq("round_number", roundNumber)
          .maybeSingle();

        if (turnData?.id) {
          const { data: existingGuess } = await supabase
            .from("game_guesses")
            .select("id, points_earned")
            .eq("turn_id", turnData.id)
            .eq("player_id", playerId)
            .maybeSingle();

          if (existingGuess) {
            console.log("Player already submitted guess for this round");
            setHasSubmitted(true);
            // If points_earned is 0, they guessed wrong
            if (existingGuess.points_earned === 0) {
              setIsLockedOut(true);
            }
          }
        }
      } catch (error) {
        console.error("Error checking existing guess:", error);
      }
    };

    checkExistingGuess();
  }, [roundNumber, sessionId, playerId]);

  // Audio player event handlers and autoplay (once only)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) return;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handlePlay = () => {
      setIsPlaying(true);
    };

    const handlePause = () => {
      setIsPlaying(false);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);

    // Autoplay only once when audioUrl first loads
    if (!hasAutoPlayedRef.current && audioUrl) {
      hasAutoPlayedRef.current = true;
      audio.play().catch(console.error);
    }

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [audioUrl]);

  // Reset autoplay flag when round changes
  useEffect(() => {
    hasAutoPlayedRef.current = false;
  }, [roundNumber]);

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(console.error);
    }
  };

  const handleSeek = (value: number[]) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = value[0];
    setCurrentTime(value[0]);
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

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

      const { correct, points_earned, game_completed, next_round } = data;
      setHasSubmitted(true);

      if (correct) {
        toast({
          title: "🎉 Correct!",
          description: `You guessed "${trimmedGuess}" and earned ${points_earned} points!`,
        });
      } else {
        setIsLockedOut(true);
        toast({
          title: "❌ Wrong Answer!",
          description: `"${trimmedGuess}" is not correct. Wait for the next round!`,
          variant: "destructive",
          duration: 5000,
        });
      }
      
      // Notify parent with game completion info, players data, and correctness
      onGuessSubmit(game_completed, next_round?.players, correct);
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
              Theme: {theme.name} • {turnMode === "elements" 
                ? `Look at ${storytellerName}'s element order and guess the word`
                : `Listen to ${storytellerName}'s story and guess the word`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Icons Display - only show in elements mode */}
            {turnMode === "elements" && selectedIcons.length > 0 && (
              <div className="bg-muted/30 p-6 rounded-xl">
                <IconSelectionPanel
                  icons={selectedIcons}
                  isDraggable={false}
                  label="Story Icons (in order)"
                />
              </div>
            )}

            {/* Audio Player - only show in audio mode */}
            {turnMode === "audio" && audioUrl && (
              <div className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Volume2 className="h-5 w-5 text-primary" />
                  <span className="font-medium text-foreground">Listen to the story:</span>
                </div>
                <div className="flex items-center gap-4">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={togglePlayPause}
                    className="h-12 w-12 rounded-full border-2 border-primary bg-primary/10 hover:bg-primary/20"
                  >
                    {isPlaying ? (
                      <Pause className="h-5 w-5 text-primary" />
                    ) : (
                      <Play className="h-5 w-5 text-primary ml-0.5" />
                    )}
                  </Button>
                  <div className="flex-1 space-y-1">
                    <Slider
                      value={[currentTime]}
                      max={duration || 100}
                      step={0.1}
                      onValueChange={handleSeek}
                      className="cursor-pointer"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{formatTime(currentTime)}</span>
                      <span>{formatTime(duration)}</span>
                    </div>
                  </div>
                </div>
                <audio ref={audioRef} src={audioUrl} className="hidden" />
              </div>
            )}

            {/* Elements mode hint */}
            {turnMode === "elements" && (
              <div className="bg-primary/10 p-6 rounded-lg text-center">
                <p className="text-lg font-medium text-primary">
                  🔍 Study the element order above — it's your clue!
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  {storytellerName} arranged these elements to hint at the whisp word.
                </p>
              </div>
            )}

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
                💡 {turnMode === "elements" 
                  ? `Look at how ${storytellerName} ordered the elements. The sequence is your clue to guess the whisp word!`
                  : `Look at the icons and listen to the story. The whisp is a single word related to the theme "${theme.name}".`}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
