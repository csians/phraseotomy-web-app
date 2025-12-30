import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useRef, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Send, Volume2, Play, Pause } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { IconSelectionPanel, IconItem } from "@/components/IconSelectionPanel";

interface GuessingInterfaceProps {
  storytellerName: string;
  theme: { id: string; name: string };
  audioUrl?: string;
  sessionId: string;
  roundNumber: number;
  playerId: string;
  onGuessSubmit: (gameCompleted?: boolean, players?: any[], wasCorrect?: boolean, whisp?: string, nextRound?: any, allPlayersAnswered?: boolean) => void;
  selectedIcons?: IconItem[];
  turnMode?: "audio" | "elements";
  sendWebSocketMessage?: (message: any) => void;
  turnId?: string;
  onAllPlayersAnswered?: (whisp: string, wasCorrect: boolean) => void;
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
  sendWebSocketMessage,
  turnId,
  onAllPlayersAnswered,
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
  const lastCheckedRoundRef = useRef<number | null>(null);
  const lastCheckedTurnIdRef = useRef<string | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  
  // Check if we've already auto-played for this session (persists across component remounts)
  const getHasAutoPlayed = () => {
    const key = `autoplay_${sessionId}`;
    return sessionStorage.getItem(key) === 'true';
  };
  
  const setHasAutoPlayed = () => {
    const key = `autoplay_${sessionId}`;
    sessionStorage.setItem(key, 'true');
  };

  // Track if player has submitted in current session to prevent unlocking
  const hasSubmittedThisTurnRef = useRef(false);
  
  // Check if player already submitted guess for this round on mount/round change
  // Only check once per round to avoid unnecessary API calls
  useEffect(() => {
    // Skip if we already checked this round
    if (lastCheckedRoundRef.current === roundNumber) {
      return;
    }

    const checkExistingGuess = async () => {
      console.log("Round changed to:", roundNumber, "- Checking existing guesses");
      
      // Reset submission tracking for new round (will be set again if already submitted)
      const previousSubmittedState = hasSubmittedThisTurnRef.current;
      hasSubmittedThisTurnRef.current = false;

      try {
        // First check if this player is the storyteller - if so, skip checking guesses
        const { data: turnData } = await supabase
          .from("game_turns")
          .select("id, storyteller_id, completed_at")
          .eq("session_id", sessionId)
          .eq("round_number", roundNumber)
          .maybeSingle();
        
        // If player is the storyteller, don't check for guesses (storytellers don't guess)
        // Also skip if turn is not completed yet (storyteller might still be submitting)
        if (turnData?.storyteller_id === playerId) {
          console.log("Player is storyteller - skipping guess check and resetting state");
          lastCheckedRoundRef.current = roundNumber;
          // Reset state to prevent showing wrong answer dialog
          setIsLockedOut(false);
          setHasSubmitted(false);
          setGuess("");
          return;
        }
        
        // If turn is not completed yet, don't check for guesses (storyteller is still submitting)
        if (!turnData?.completed_at) {
          console.log("Turn not completed yet - skipping guess check");
          lastCheckedRoundRef.current = roundNumber;
          // Reset state to prevent showing wrong answer dialog
          setIsLockedOut(false);
          setHasSubmitted(false);
          return;
        }
        
        // Check if player already submitted a guess for this turn
        const turnIdForGuess = turnData?.id;

        if (turnIdForGuess) {
          // Skip if we already checked this turn
          if (lastCheckedTurnIdRef.current === turnIdForGuess) {
            lastCheckedRoundRef.current = roundNumber;
            // Preserve submission state if we already checked
            if (previousSubmittedState) {
              hasSubmittedThisTurnRef.current = true;
            }
            return;
          }

          const { data: existingGuess } = await supabase
            .from("game_guesses")
            .select("id, points_earned")
            .eq("turn_id", turnIdForGuess)
            .eq("player_id", playerId)
            .maybeSingle();

          if (existingGuess) {
            console.log("Player already submitted guess for this round");
            hasSubmittedThisTurnRef.current = true;
            setHasSubmitted(true);
            // If points_earned is 0, they guessed wrong
            if (existingGuess.points_earned === 0) {
              setIsLockedOut(true);
            }
          } else {
            // No existing guess - reset state only if we haven't submitted in this turn
            if (!previousSubmittedState) {
              setGuess("");
              setIsLockedOut(false);
              setHasSubmitted(false);
            }
          }

          // Mark this turn as checked
          lastCheckedTurnIdRef.current = turnIdForGuess;
        } else {
          // No turn data yet - reset state only if we haven't submitted
          if (!previousSubmittedState) {
            setGuess("");
            setIsLockedOut(false);
            setHasSubmitted(false);
          }
        }
        
        // Mark this round as checked
        lastCheckedRoundRef.current = roundNumber;
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
      if (audio.duration && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };

    const handleLoadedData = () => {
      if (audio.duration && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };

    // Use requestAnimationFrame for smooth progress bar updates
    // This provides 60fps updates instead of relying on timeupdate (which fires ~4 times per second)
    const updateProgress = () => {
      const currentAudio = audioRef.current;
      if (!currentAudio) {
        animationFrameRef.current = null;
        return;
      }

      const time = currentAudio.currentTime;
      const dur = currentAudio.duration;
      
      // Always update current time if valid
      if (time !== undefined && isFinite(time) && time >= 0) {
        setCurrentTime(time);
      }
      
      // Update duration if valid and different
      if (dur !== undefined && isFinite(dur) && dur > 0) {
        if (!duration || Math.abs(duration - dur) > 0.1) {
          setDuration(dur);
        }
      }
      
      // Continue animation loop if playing (check multiple conditions)
      if (!currentAudio.paused && !currentAudio.ended && currentAudio.readyState > 0) {
        animationFrameRef.current = requestAnimationFrame(updateProgress);
      } else {
        // Stop loop if paused or ended
        animationFrameRef.current = null;
        if (currentAudio.ended) {
          setIsPlaying(false);
          setCurrentTime(dur || 0);
        } else if (currentAudio.paused) {
          setIsPlaying(false);
        }
      }
    };

    const handlePlay = () => {
      setIsPlaying(true);
      // Start animation frame loop immediately for smooth updates
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      // Start the loop right away
      animationFrameRef.current = requestAnimationFrame(updateProgress);
    };

    const handlePause = () => {
      setIsPlaying(false);
      // Stop animation frame loop
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      // Stop animation frame loop
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };

    const handleCanPlay = () => {
      if (audio.duration && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };

    // Fallback timeupdate handler (only used if animation frame isn't running)
    const handleTimeUpdate = () => {
      // Only update if animation frame isn't running (fallback)
      if (!animationFrameRef.current && audio.currentTime !== undefined && isFinite(audio.currentTime)) {
        setCurrentTime(audio.currentTime);
      }
    };

    // Attach all event listeners
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('loadeddata', handleLoadedData);
    audio.addEventListener('canplay', handleCanPlay);
    // Use 'play' and 'playing' events to start animation loop
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('playing', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);
    // Also listen for timeupdate as fallback (but animation frame is primary)
    audio.addEventListener('timeupdate', handleTimeUpdate);

    // Ensure duration is set if already loaded
    if (audio.readyState >= 2 && audio.duration && isFinite(audio.duration)) {
      setDuration(audio.duration);
    }

    // Autoplay only once when audioUrl first loads on initial page visit
    // Use sessionStorage to persist across component remounts
    if (!getHasAutoPlayed() && audioUrl) {
      setHasAutoPlayed();
      // Try to play, but don't show errors if autoplay is blocked by browser
      audio.play().catch((err) => {
        console.log("Autoplay prevented by browser:", err);
        // Remove the flag if autoplay was blocked - user can manually play
        const key = `autoplay_${sessionId}`;
        sessionStorage.removeItem(key);
      });
    }

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('loadeddata', handleLoadedData);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('playing', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      // Clean up animation frame
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [audioUrl, sessionId]);

  // Poll to check if all players have answered (for players who submitted early)
  // This ensures all players see the round transition, not just the last one to submit
  const hasTriggeredTransitionRef = useRef(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    if (!turnId || !onAllPlayersAnswered || !hasSubmitted) return;
    if (hasTriggeredTransitionRef.current) return; // Already triggered transition
    
    const checkAllPlayersAnswered = async () => {
      // Stop polling if transition already triggered
      if (hasTriggeredTransitionRef.current) {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        return;
      }
      
      try {
        // Get the turn to check if it's completed
        const { data: turnData } = await supabase
          .from("game_turns")
          .select("id, completed_at, whisp, storyteller_id")
          .eq("id", turnId)
          .maybeSingle();
        
        if (!turnData) return;
        
        // If turn is completed, all players have answered
        if (turnData.completed_at) {
          // Check if current player got it right
          const { data: myGuess } = await supabase
            .from("game_guesses")
            .select("points_earned")
            .eq("turn_id", turnId)
            .eq("player_id", playerId)
            .maybeSingle();
          
          const wasCorrect = myGuess?.points_earned === 1;
          const whisp = turnData.whisp || "";
          
          // Mark as triggered and stop polling
          hasTriggeredTransitionRef.current = true;
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          
          onAllPlayersAnswered(whisp, wasCorrect);
          return;
        }
        
        // Check if all non-storyteller players have answered
        const { data: sessionPlayers } = await supabase
          .from("game_players")
          .select("player_id")
          .eq("session_id", sessionId);
        
        if (!sessionPlayers) return;
        
        const storytellerId = turnData.storyteller_id;
        const nonStorytellerPlayers = sessionPlayers.filter(
          p => p.player_id !== storytellerId
        );
        
        const { data: allGuesses } = await supabase
          .from("game_guesses")
          .select("player_id")
          .eq("turn_id", turnId);
        
        const uniqueAnswers = new Set(allGuesses?.map(g => g.player_id) || []);
        const allAnswered = nonStorytellerPlayers.length > 0 && 
                           uniqueAnswers.size >= nonStorytellerPlayers.length;
        
        // Only trigger if all players answered AND turn is completed
        // Don't show dialog if turn is not yet marked as completed
        // The backend will mark it complete when the last player submits
        if (allAnswered && turnData.whisp && turnData.completed_at) {
          // All players answered AND turn is completed
          const { data: myGuess } = await supabase
            .from("game_guesses")
            .select("points_earned")
            .eq("turn_id", turnId)
            .eq("player_id", playerId)
            .maybeSingle();
          
          const wasCorrect = myGuess?.points_earned === 1;
          
          // Mark as triggered and stop polling
          hasTriggeredTransitionRef.current = true;
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          
          onAllPlayersAnswered(turnData.whisp, wasCorrect);
        }
      } catch (error) {
        console.error("Error checking all players answered:", error);
      }
    };
    
    // Poll every 2 seconds if player has submitted but waiting for others
    pollIntervalRef.current = setInterval(checkAllPlayersAnswered, 2000);
    
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [turnId, sessionId, playerId, hasSubmitted, onAllPlayersAnswered]);

  // Reset transition trigger when round changes
  useEffect(() => {
    hasTriggeredTransitionRef.current = false;
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
    if (!isFinite(time) || isNaN(time) || time < 0) {
      return "0:00";
    }
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

    if (trimmedGuess.length < 3) {
      toast({
        title: "Guess Too Short",
        description: "Your guess must be at least 3 characters long.",
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

      const { correct, points_earned, game_completed, next_round, whisp, all_players_answered } = data;
      console.log("📊 Guess result from API:", { correct, points_earned, game_completed, whisp, all_players_answered });
      
      // Mark as submitted and prevent unlocking
      hasSubmittedThisTurnRef.current = true;
      setHasSubmitted(true);

      if (correct === true) {
        toast({
          title: "🎉 Correct!",
          description: `You guessed "${trimmedGuess}" and earned ${points_earned} points!`,
        });
        // Correct guess: lock via hasSubmitted (no "wrong" lockout UI)
      } else {
        setIsLockedOut(true);
        toast({
          title: "❌ Wrong Answer!",
          description: `"${trimmedGuess}" is not correct. Wait for the next round!`,
          variant: "destructive",
          duration: 5000,
        });
      }
      
      // Broadcast round result to all players when all have answered (non-game-completing round)
      if (all_players_answered && !game_completed && next_round && sendWebSocketMessage) {
        sendWebSocketMessage({
          type: "next_turn",
          roundNumber: next_round.roundNumber,
          newStorytellerId: next_round.newStorytellerId,
          newStorytellerName: next_round.newStorytellerName,
          secretElement: whisp,
          wasCorrect: correct === true,
        });
      }
      
      // Notify parent with game completion info, players data, correctness (explicit boolean), and whisp
      // Only pass nextRound if all players have answered (to prevent showing transition message early)
      onGuessSubmit(game_completed, next_round?.players, correct === true, whisp, all_players_answered ? next_round : undefined, all_players_answered);
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
    if (e.key === "Enter" && !isSubmitting && !isLockedOut && !hasSubmitted && guess.trim().length >= 3) {
      e.preventDefault();
      handleSubmitGuess();
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-4xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-center text-2xl">
              Guess the <span className="text-primary">Wisp!</span>
            </CardTitle>
            <CardDescription className="text-center text-lg">
              Theme: {theme.name} • {turnMode === "elements" 
                ? `Look at ${storytellerName}'s element order and guess the word`
                : `Listen to ${storytellerName}'s story and guess the word`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Icons Display - always show when icons are available (storyteller arranges them) */}
            {selectedIcons.length > 0 && (
              <div className="bg-muted/30 p-6 rounded-xl">
                <IconSelectionPanel
                  icons={selectedIcons}
                  isDraggable={false}
                  label="Storyteller's Arranged Elements"
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
                    className="h-12 w-12 rounded-full border-2 border-primary bg-primary/10 hover:bg-primary/20 flex-shrink-0"
                  >
                    {isPlaying ? (
                      <Pause className="h-5 w-5 text-primary" />
                    ) : (
                      <Play className="h-5 w-5 text-primary ml-0.5" />
                    )}
                  </Button>
                  <div className="flex-1 space-y-2">
                    {/* Custom Progress Bar */}
                    <div 
                      className="relative h-3 w-full bg-muted rounded-full cursor-pointer overflow-hidden"
                      onClick={(e) => {
                        if (!audioRef.current || duration <= 0) return;
                        const rect = e.currentTarget.getBoundingClientRect();
                        const clickX = e.clientX - rect.left;
                        const percentage = clickX / rect.width;
                        const newTime = percentage * duration;
                        audioRef.current.currentTime = newTime;
                        setCurrentTime(newTime);
                      }}
                    >
                      {/* Progress Fill */}
                      <div 
                        className="absolute top-0 left-0 h-full bg-primary rounded-full"
                        style={{ width: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%' }}
                      />
                      {/* Thumb/Dot */}
                      <div 
                        className="absolute top-1/2 -translate-y-1/2 h-5 w-5 bg-primary rounded-full border-2 border-background shadow-lg"
                        style={{ left: duration > 0 ? `calc(${(currentTime / duration) * 100}% - 10px)` : '0px' }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{formatTime(currentTime)}</span>
                      <span>{duration > 0 ? formatTime(duration) : "--:--"}</span>
                    </div>
                  </div>
                </div>
                <audio 
                  ref={audioRef} 
                  src={audioUrl} 
                  className="hidden" 
                  preload="metadata"
                />
              </div>
            )}

            {/* Element arrangement hint */}
            {selectedIcons.length > 0 && (
              <div className="bg-primary/10 p-6 rounded-lg text-center">
                <p className="text-lg font-medium text-primary">
                  🔍 Study the element order above — it's your clue!
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  {storytellerName} arranged these elements to hint at the wisp word.
                </p>
              </div>
            )}

            {/* Guess Input */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-semibold">
                  What's the wisp word? (1 point):
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
                    onChange={(e) => {
                      // Prevent changes if already submitted or locked out
                      if (!hasSubmitted && !isLockedOut) {
                        setGuess(e.target.value);
                      }
                    }}
                    onKeyPress={handleKeyPress}
                    placeholder="Type your guess here... (min 3 characters)"
                    className="text-lg py-6"
                    disabled={isSubmitting || hasSubmitted || isLockedOut}
                    autoFocus={!hasSubmitted && !isLockedOut}
                    minLength={3}
                  />
                  <Button
                    onClick={handleSubmitGuess}
                    disabled={isSubmitting || hasSubmitted || isLockedOut || !guess.trim() || guess.trim().length < 3}
                    size="lg"
                    className="w-full"
                  >
                    <Send className="mr-2 h-5 w-5" />
                    {isSubmitting ? "Submitting..." : hasSubmitted || isLockedOut ? "Already Submitted" : "Submit Guess"}
                  </Button>
                </div>
              )}
            </div>

            {/* Tips */}
            <div className="bg-muted/50 p-4 rounded-lg">
              <p className="text-sm text-muted-foreground text-center">
                💡 Look at the arranged elements{turnMode === "audio" ? " and listen to the story" : ""}. The wisp is a single word related to the theme "{theme.name}". Your guess must be at least 3 characters long.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
