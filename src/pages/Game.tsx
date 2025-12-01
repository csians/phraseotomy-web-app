import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useGameWebSocket } from "@/hooks/useGameWebSocket";
import { Scoreboard } from "@/components/Scoreboard";
import { ThemeSelection } from "@/components/ThemeSelection";
import { StorytellingInterface } from "@/components/StorytellingInterface";
import { GuessingInterface } from "@/components/GuessingInterface";
import { Wifi, WifiOff } from "lucide-react";

interface Player {
  id: string;
  name: string;
  player_id: string;
  score: number;
  turn_order: number;
}

interface Theme {
  id: string;
  name: string;
  icon: string;
}

interface Element {
  id: string;
  name: string;
  icon: string;
}

interface GameSession {
  id: string;
  current_round: number;
  total_rounds: number;
  current_storyteller_id: string;
  status: string;
}

interface Turn {
  id: string;
  theme_id: string;
  selected_elements: string[];
  recording_url: string | null;
  completed_at: string | null;
  theme: Theme;
}

export default function Game() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<GameSession | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [currentTurn, setCurrentTurn] = useState<Turn | null>(null);
  const [selectedElements, setSelectedElements] = useState<Element[]>([]);
  const [themeElements, setThemeElements] = useState<Element[]>([]);
  const [gamePhase, setGamePhase] = useState<"theme_selection" | "storytelling" | "guessing" | "scoring">("theme_selection");
  const [currentPlayerId, setCurrentPlayerId] = useState<string>("");
  const [isReceivingAudio, setIsReceivingAudio] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<string[]>([]);
  const isPlayingRef = useRef(false);

  // Get current player info for WebSocket
  const getCurrentPlayerInfo = () => {
    const playerId = getCurrentPlayerId();
    const player = players.find(p => p.player_id === playerId);
    return {
      playerId,
      playerName: player?.name || "Player"
    };
  };

  // Initialize audio context for real-time playback
  useEffect(() => {
    audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Function to play audio chunks in real-time
  const playAudioChunk = async (base64Audio: string) => {
    if (!audioContextRef.current) return;

    try {
      // Decode base64 to ArrayBuffer
      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Decode audio data
      const audioBuffer = await audioContextRef.current.decodeAudioData(bytes.buffer);
      
      // Create source and play
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      source.start(0);
    } catch (error) {
      console.error("Error playing audio chunk:", error);
    }
  };

  // WebSocket for real-time updates - just refreshes from database
  const { sendMessage: sendWebSocketMessage, isConnected } = useGameWebSocket({
    sessionId: sessionId || "",
    playerId: currentPlayerId,
    playerName: getCurrentPlayerInfo().playerName,
    enabled: !!sessionId && !!currentPlayerId,
    onMessage: (message) => {
      console.log('🎮 Game WebSocket message:', message.type, message);
      
      switch (message.type) {
        case "recording_started":
          setIsReceivingAudio(true);
          toast({
            title: "🎤 Recording Started",
            description: "Listen to the storyteller's live recording",
          });
          break;

        case "recording_stopped":
          setIsReceivingAudio(false);
          break;

        case "audio_chunk":
          // Play audio chunk in real-time
          if (message.audioData && message.storytellerId !== currentPlayerId) {
            playAudioChunk(message.audioData);
          }
          break;

        case "theme_selected":
          toast({
            title: "Theme Selected",
            description: `${message.storytellerName || 'Storyteller'} chose a theme`,
          });
          setTimeout(() => initializeGame(), 300);
          break;

        case "storyteller_ready":
          toast({
            title: "Secret Element Selected",
            description: `${message.storytellerName || 'Storyteller'} has selected their secret element`,
          });
          setTimeout(() => initializeGame(), 300);
          break;

        case "recording_uploaded":
        case "story_submitted":
          toast({
            title: "Audio Ready! 🎤",
            description: "Listen to the clue and guess the secret element",
          });
          setTimeout(() => initializeGame(), 300);
          break;

        case "guess_submitted":
          if (message.playerId !== currentPlayerId) {
            if (message.isCorrect) {
              toast({
                title: "Correct Answer! 🎉",
                description: `${message.playerName} got it right!`,
              });
            } else {
              toast({
                title: "Guess Made",
                description: `${message.playerName} made a guess`,
              });
            }
          }
          setTimeout(() => initializeGame(), 300);
          break;

        case "correct_answer":
          toast({
            title: "Round Complete! 🏆",
            description: `${message.winnerName} got it right! The answer was "${message.secretElement}"`,
          });
          setTimeout(() => initializeGame(), 500);
          break;

        case "next_turn":
          toast({
            title: "Next Turn",
            description: `${message.newStorytellerName}'s turn to tell a story!`,
          });
          setTimeout(() => initializeGame(), 500);
          break;

        case "game_completed":
          toast({
            title: "Game Over! 🎊",
            description: `${message.winnerName} won the game!`,
            duration: 5000,
          });
          
          // Schedule automatic cleanup after 35 seconds
          console.log('🧹 Scheduling game cleanup in 35 seconds...');
          supabase.functions.invoke('cleanup-game-session', {
            body: { sessionId, delaySeconds: 35 }
          }).catch(err => {
            console.error('Failed to schedule cleanup:', err);
          });
          
          setTimeout(() => initializeGame(), 500);
          break;

        case "player_joined":
          toast({
            title: "Player Joined",
            description: `${message.playerName} joined the game`,
          });
          setTimeout(() => initializeGame(), 300);
          break;
          
        case "player_left":
          toast({
            title: "Player Left",
            description: `${message.playerName} left the game`,
          });
          setTimeout(() => initializeGame(), 300);
          break;

        case "refresh_game_state":
          console.log("🔄 Refresh triggered by WebSocket");
          setTimeout(() => initializeGame(), 300);
          break;

        default:
          console.log("Unknown WebSocket message:", message.type);
          // Refresh on any unknown message type to stay in sync
          setTimeout(() => initializeGame(), 500);
      }
    },
  });

  useEffect(() => {
    console.log("Game component mounted, sessionId:", sessionId);
    if (!sessionId) {
      console.log("No sessionId, redirecting to /play/host");
      navigate("/play/host");
      return;
    }

    initializeGame();
    const cleanup = setupRealtimeSubscriptions();
    
    return () => {
      if (cleanup) cleanup();
    };
  }, [sessionId]);

  const getCurrentPlayerId = () => {
    const storageKeys = ["customerData", "phraseotomy_customer_data", "customer_data"];
    for (const key of storageKeys) {
      const dataStr = sessionStorage.getItem(key) || localStorage.getItem(key);
      if (dataStr) {
        try {
          const parsed = JSON.parse(dataStr);
          return parsed.customer_id || parsed.id || parsed.customerId;
        } catch (e) {
          console.error(`Error parsing ${key}:`, e);
        }
      }
    }
    return localStorage.getItem('guest_player_id') || "";
  };

  const initializeGame = async () => {
    try {
      setLoading(true);
      const playerId = getCurrentPlayerId();
      console.log("Current player ID:", playerId);
      setCurrentPlayerId(playerId);

      console.log("Fetching game state for session:", sessionId);
      const { data, error } = await supabase.functions.invoke("get-game-state", {
        body: { sessionId },
      });

      if (error) {
        console.error("Error from get-game-state:", error);
        throw error;
      }

      console.log("Game state received:", data);
      console.log("Session:", data.session);
      console.log("Players:", data.players);
      console.log("Themes count:", data.themes?.length);
      console.log("Current turn:", data.currentTurn);
      console.log("Current storyteller:", data.session?.current_storyteller_id);

      setSession(data.session);
      setPlayers(data.players || []);
      setThemes(data.themes || []);
      setCurrentTurn(data.currentTurn);
      setSelectedElements(data.selectedElements || []);
      setThemeElements(data.themeElements || []);

      // Determine game phase
      let phase: "theme_selection" | "storytelling" | "guessing" | "scoring";
      if (!data.currentTurn) {
        phase = "theme_selection";
        console.log("No current turn - setting phase to theme_selection");
      } else if (!data.currentTurn.completed_at) {
        phase = "storytelling";
        console.log("Turn exists but not completed - setting phase to storytelling");
      } else {
        phase = "guessing";
        console.log("Turn completed - setting phase to guessing");
      }
      setGamePhase(phase);
      
      // Check if current player is storyteller
      const isStoryteller = playerId === data.session?.current_storyteller_id;
      console.log("Is current player storyteller?", isStoryteller);
      console.log("Player ID:", playerId, "Storyteller ID:", data.session?.current_storyteller_id);
    } catch (error) {
      console.error("Error initializing game:", error);
      toast({
        title: "Error",
        description: "Failed to load game state.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeSubscriptions = () => {
    const channel = supabase
      .channel(`game-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_sessions',
          filter: `id=eq.${sessionId}`
        },
        (payload) => {
          console.log('🔄 Game session updated:', payload);
          // Refresh game state when session changes (theme, round, etc.)
          setTimeout(() => initializeGame(), 100);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_turns',
          filter: `session_id=eq.${sessionId}`
        },
        (payload) => {
          console.log('🎯 Game turn updated:', payload);
          // Refresh when turn is created or updated (elements, recording, etc.)
          setTimeout(() => initializeGame(), 100);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'game_players',
          filter: `session_id=eq.${sessionId}`
        },
        (payload) => {
          console.log('📊 Player score updated:', payload);
          // Refresh when player scores change
          setTimeout(() => initializeGame(), 100);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'game_guesses',
        },
        (payload) => {
          console.log('💡 New guess submitted:', payload);
          // Show notification when someone guesses
          toast({
            title: "Player Guessed!",
            description: "A player has submitted their guess",
          });
          setTimeout(() => initializeGame(), 100);
        }
      )
      .subscribe((status) => {
        console.log('📡 Realtime subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ Successfully subscribed to real-time updates');
        }
      });

    return () => {
      console.log('🔌 Unsubscribing from real-time updates');
      supabase.removeChannel(channel);
    };
  };

  const handleThemeSelect = async (themeId: string) => {
    try {
      // Theme and elements are saved to database via start-turn
      const { data, error } = await supabase.functions.invoke("start-turn", {
        body: { sessionId, themeId },
      });

      if (error) throw error;

      // Wait for DB to commit
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Refresh local state from database
      await initializeGame();
      
      // Notify other players via WebSocket to refresh their state
      sendWebSocketMessage({
        type: "theme_selected",
        themeId,
      });

      toast({
        title: "Theme Selected!",
        description: "Now select your secret element and record your story.",
      });
    } catch (error) {
      console.error("Error starting turn:", error);
      toast({
        title: "Error",
        description: "Failed to start turn.",
        variant: "destructive",
      });
    }
  };

  const handleStoryComplete = () => {
    toast({
      title: "Story Submitted!",
      description: "Waiting for other players to guess...",
    });
    initializeGame();
  };

  const handleGuessSubmit = () => {
    toast({
      title: "Guess Submitted!",
      description: "Waiting for other players...",
    });
    initializeGame();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading game...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Game not found</p>
      </div>
    );
  }

  const isStoryteller = currentPlayerId === session.current_storyteller_id;
  const currentPlayer = players.find((p) => p.player_id === currentPlayerId);

  return (
    <div className="min-h-screen bg-background">
      {/* Connection Status Indicator */}
      <div className="fixed top-4 right-4 z-50">
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
          isConnected 
            ? "bg-green-500/10 text-green-600 border border-green-500/20" 
            : "bg-red-500/10 text-red-600 border border-red-500/20"
        }`}>
          {isConnected ? (
            <>
              <Wifi className="h-3 w-3" />
              <span>Live</span>
            </>
          ) : (
            <>
              <WifiOff className="h-3 w-3" />
              <span>Connecting...</span>
            </>
          )}
        </div>
      </div>

      {/* Scoreboard - Always visible */}
      <div className="fixed top-4 left-4 w-80 z-50">
        <Scoreboard
          players={players}
          currentRound={session.current_round}
          totalRounds={session.total_rounds}
          currentStorytellerId={session.current_storyteller_id}
        />
      </div>

      {/* Game Content */}
      <div className="ml-96 p-4">
        {gamePhase === "theme_selection" && isStoryteller && (
          <>
            <div className="mb-4 text-sm text-muted-foreground">
              Debug: Showing theme selection (Phase: {gamePhase}, IsStoryteller: {isStoryteller.toString()}, Themes: {themes.length})
            </div>
            <ThemeSelection
              themes={themes}
              onThemeSelect={handleThemeSelect}
              playerName={currentPlayer?.name || "Player"}
            />
          </>
        )}

        {gamePhase === "theme_selection" && !isStoryteller && (
          <div className="min-h-screen flex items-center justify-center">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-foreground mb-2">
                Waiting for storyteller...
              </h2>
              <p className="text-muted-foreground">
                {players.find((p) => p.player_id === session.current_storyteller_id)?.name} is choosing a theme
              </p>
            </div>
          </div>
        )}

        {gamePhase === "storytelling" && isStoryteller && currentTurn && (
          <StorytellingInterface
            theme={currentTurn.theme}
            elements={selectedElements}
            sessionId={sessionId!}
            playerId={currentPlayerId}
            turnId={currentTurn.id}
            onStoryComplete={handleStoryComplete}
            isStoryteller={isStoryteller}
            storytellerName={players.find((p) => p.player_id === session.current_storyteller_id)?.name || "Player"}
            sendWebSocketMessage={sendWebSocketMessage}
          />
        )}

        {gamePhase === "storytelling" && !isStoryteller && (
          <div className="min-h-screen flex items-center justify-center p-4">
            <div className="max-w-2xl w-full space-y-6">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-foreground mb-2">
                  {players.find((p) => p.player_id === session.current_storyteller_id)?.name} is telling a story
                </h2>
                <p className="text-muted-foreground">
                  Watch the elements below - one of them is the secret!
                </p>
                {isReceivingAudio && (
                  <div className="mt-4 flex items-center justify-center gap-2 text-sm text-green-600">
                    <div className="h-3 w-3 rounded-full bg-green-600 animate-pulse" />
                    <span className="font-medium">Listening to live recording...</span>
                  </div>
                )}
              </div>
              
              {selectedElements.length > 0 && (
                <div className="bg-card border border-border rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-foreground mb-4">Elements in Play</h3>
                  <div className="grid grid-cols-5 gap-4">
                    {selectedElements.map((element) => (
                      <div
                        key={element.id}
                        className="flex flex-col items-center p-4 bg-muted rounded-lg"
                      >
                        <span className="text-3xl mb-2">{element.icon}</span>
                        <span className="text-sm text-center text-muted-foreground">
                          {element.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="text-center text-sm text-muted-foreground">
                Waiting for {players.find((p) => p.player_id === session.current_storyteller_id)?.name} to record their story...
              </div>
            </div>
          </div>
        )}

        {gamePhase === "guessing" && !isStoryteller && currentTurn?.recording_url && (
          <GuessingInterface
            storytellerName={players.find((p) => p.player_id === session.current_storyteller_id)?.name || "Player"}
            theme={currentTurn.theme}
            audioUrl={currentTurn.recording_url}
            availableElements={selectedElements}
            correctElements={currentTurn.selected_elements}
            sessionId={sessionId!}
            roundNumber={session.current_round ?? 1}
            playerId={currentPlayerId}
            onGuessSubmit={handleGuessSubmit}
          />
        )}

        {gamePhase === "guessing" && isStoryteller && (
          <div className="min-h-screen flex items-center justify-center">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-foreground mb-2">
                Players are guessing...
              </h2>
              <p className="text-muted-foreground">
                Watch the scoreboard to see who gets it right!
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
