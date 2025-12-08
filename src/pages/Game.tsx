import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useGameWebSocket } from "@/hooks/useGameWebSocket";
import { Scoreboard } from "@/components/Scoreboard";
import { StorytellingInterface } from "@/components/StorytellingInterface";
import { GuessingInterface } from "@/components/GuessingInterface";
import { ThemeSelectionCards, ThemeOption } from "@/components/ThemeSelectionCards";
import { TurnModeSelection } from "@/components/TurnModeSelection";
import { ElementsInterface } from "@/components/ElementsInterface";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wifi, WifiOff, Loader2 } from "lucide-react";

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
  isCore?: boolean;
  isUnlocked?: boolean;
  packName?: string;
  pack_id?: string | null;
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
  selected_theme_id?: string;
}

interface Turn {
  id: string;
  theme_id: string;
  whisp: string | null;
  recording_url: string | null;
  completed_at: string | null;
  theme: Theme;
  selected_icon_ids?: string[];
  icon_order?: number[];
  turn_mode?: "audio" | "elements";
}

interface IconItem {
  id: string;
  name: string;
  icon: string;
  isFromCore: boolean;
}

type GamePhase = "selecting_theme" | "selecting_mode" | "storytelling" | "elements" | "guessing" | "scoring";

export default function Game() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<GameSession | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [currentTurn, setCurrentTurn] = useState<Turn | null>(null);
  const [selectedIcons, setSelectedIcons] = useState<IconItem[]>([]);
  const [gamePhase, setGamePhase] = useState<GamePhase>("selecting_theme");
  const [currentPlayerId, setCurrentPlayerId] = useState<string>("");
  const [isReceivingAudio, setIsReceivingAudio] = useState(false);
  const [isGeneratingWhisp, setIsGeneratingWhisp] = useState(false);
  const [selectedThemeId, setSelectedThemeId] = useState<string>("");
  const [unlockedPackIds, setUnlockedPackIds] = useState<string[]>([]);
  const [selectedTurnMode, setSelectedTurnMode] = useState<"audio" | "elements" | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<string[]>([]);
  const isPlayingRef = useRef(false);

  // Get current player ID from storage - must be defined before getCurrentPlayerInfo
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
          
          // Mark session as expired immediately
          supabase
            .from('game_sessions')
            .update({ status: 'expired' })
            .eq('id', sessionId)
            .then(() => console.log('✅ Session marked as expired'));
          
          // Schedule automatic cleanup after 35 seconds
          console.log('🧹 Scheduling game cleanup in 35 seconds...');
          supabase.functions.invoke('cleanup-game-session', {
            body: { sessionId, delaySeconds: 35 }
          }).catch(err => {
            console.error('Failed to schedule cleanup:', err);
          });
          
          // Show countdown warning after 5 seconds (30 seconds before cleanup)
          setTimeout(() => {
            toast({
              title: "⏰ Lobby Cleanup Warning",
              description: "This lobby will be automatically deleted in 30 seconds...",
              duration: 30000,
            });
          }, 5000);
          
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
      setSelectedIcons(data.selectedIcons || []);
      setUnlockedPackIds(data.unlockedPackIds || []);

      // Determine game phase based on turn state
      let phase: GamePhase;
      const turnMode = data.currentTurn?.turn_mode;
      const hasWhisp = !!data.currentTurn?.whisp;
      
      console.log("🎮 [GAME DEBUG] Phase determination:");
      console.log("  - currentTurn exists:", !!data.currentTurn);
      console.log("  - currentTurn data:", JSON.stringify(data.currentTurn, null, 2));
      console.log("  - turnMode:", turnMode);
      console.log("  - hasWhisp:", hasWhisp);
      console.log("  - whisp value:", data.currentTurn?.whisp);
      console.log("  - completed_at:", data.currentTurn?.completed_at);
      
      // Check if turn_mode has been explicitly set (not just the default)
      // We use the presence of whisp to determine if mode was selected
      if (!data.currentTurn) {
        phase = "selecting_theme";
        console.log("🎮 [GAME DEBUG] No turn - setting phase to selecting_theme");
      } else if (!hasWhisp) {
        // No whisp yet = storyteller needs to select mode first
        phase = "selecting_mode";
        console.log("🎮 [GAME DEBUG] No whisp - setting phase to selecting_mode");
      } else if (!data.currentTurn.completed_at) {
        // Whisp exists, use turn_mode to determine which interface to show
        if (turnMode === "elements") {
          phase = "elements";
          console.log("🎮 [GAME DEBUG] Turn in elements mode - setting phase to elements");
        } else {
          phase = "storytelling";
          console.log("🎮 [GAME DEBUG] Turn in audio mode - setting phase to storytelling");
        }
      } else {
        phase = "guessing";
        console.log("🎮 [GAME DEBUG] Turn completed - setting phase to guessing");
      }
      
      console.log("🎮 [GAME DEBUG] Final phase:", phase);
      setGamePhase(phase);
      
      // Set turn mode if exists
      if (data.currentTurn?.turn_mode) {
        setSelectedTurnMode(data.currentTurn.turn_mode);
      }
      
      // Set selected theme if exists
      if (data.currentTurn?.theme_id) {
        setSelectedThemeId(data.currentTurn.theme_id);
      }
      
      // Check if current player is storyteller
      const isStoryteller = playerId === data.session?.current_storyteller_id;
      console.log("🎮 [GAME DEBUG] isStoryteller:", isStoryteller);
      console.log("🎮 [GAME DEBUG] playerId:", playerId);
      console.log("🎮 [GAME DEBUG] storytellerId:", data.session?.current_storyteller_id);
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

  // Handle theme selection - now only saves theme, whisp generated after mode selection
  const handleThemeSelect = async (themeId: string) => {
    setSelectedThemeId(themeId);
    
    try {
      // Save theme selection to game_sessions
      const { error } = await supabase
        .from("game_sessions")
        .update({ selected_theme_id: themeId })
        .eq("id", sessionId);

      if (error) throw error;

      // Also update the current turn's theme_id (without generating whisp yet)
      if (currentTurn?.id) {
        await supabase
          .from("game_turns")
          .update({ theme_id: themeId })
          .eq("id", currentTurn.id);
      }

      // Move to mode selection phase
      setGamePhase("selecting_mode");
      
      // Notify other players
      sendWebSocketMessage({
        type: "theme_selected",
        themeId,
      });

      toast({
        title: "Theme Selected!",
        description: "Now choose your clue mode",
      });
    } catch (error) {
      console.error("Error selecting theme:", error);
      toast({
        title: "Error",
        description: "Failed to select theme.",
        variant: "destructive",
      });
    }
  };

  // Handle mode selection
  const handleModeSelect = async (mode: "audio" | "elements") => {
    setSelectedTurnMode(mode);
    setIsGeneratingWhisp(true);
    
    try {
      // Call start-turn with the selected theme and mode
      const { data, error } = await supabase.functions.invoke("start-turn", {
        body: { 
          sessionId, 
          turnId: currentTurn?.id,
          selectedThemeId,
          turnMode: mode,
        },
      });

      if (error) throw error;

      // Wait for DB to commit
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Refresh local state from database
      await initializeGame();
      
      // Notify other players via WebSocket to refresh their state
      sendWebSocketMessage({
        type: "mode_selected",
        mode,
        whisp: data.whisp,
      });

      toast({
        title: "Whisp Generated! ✨",
        description: `Your word is: "${data.whisp}"`,
      });
    } catch (error) {
      console.error("Error selecting mode:", error);
      toast({
        title: "Error",
        description: "Failed to start turn.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingWhisp(false);
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

  // Debug render state
  console.log("🎮 [RENDER DEBUG] gamePhase:", gamePhase);
  console.log("🎮 [RENDER DEBUG] isStoryteller:", isStoryteller);
  console.log("🎮 [RENDER DEBUG] currentPlayerId:", currentPlayerId);
  console.log("🎮 [RENDER DEBUG] session.current_storyteller_id:", session.current_storyteller_id);
  console.log("🎮 [RENDER DEBUG] currentTurn:", currentTurn);
  console.log("🎮 [RENDER DEBUG] Should show mode selection:", gamePhase === "selecting_mode" && isStoryteller);

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
        {/* Theme Selection Phase - Storyteller chooses theme */}
        {gamePhase === "selecting_theme" && isStoryteller && (
          <div className="min-h-screen flex items-center justify-center p-4">
            <Card className="w-full max-w-4xl">
              <CardHeader>
                <CardTitle className="text-center text-2xl">
                  Your Turn to Tell a Story!
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isGeneratingWhisp ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-4">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                    <p className="text-lg text-muted-foreground">
                      Generating your secret whisp word...
                    </p>
                  </div>
                ) : (
                  <ThemeSelectionCards
                    themes={themes.map(t => ({
                      id: t.id,
                      name: t.name,
                      icon: t.icon,
                      isCore: t.isCore || false,
                      isUnlocked: t.isUnlocked !== false,
                      packName: t.packName,
                      packId: t.pack_id,
                    }))}
                    onThemeSelect={handleThemeSelect}
                    selectedThemeId={selectedThemeId}
                    disabled={isGeneratingWhisp}
                    playerName={players.find(p => p.player_id === currentPlayerId)?.name}
                    unlockedPackIds={unlockedPackIds}
                  />
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {gamePhase === "selecting_theme" && !isStoryteller && (
          <div className="min-h-screen flex items-center justify-center">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-foreground mb-2">
                Waiting for storyteller...
              </h2>
              <p className="text-muted-foreground">
                {players.find((p) => p.player_id === session.current_storyteller_id)?.name} is selecting a theme
              </p>
            </div>
          </div>
        )}

        {/* Mode Selection Phase - Storyteller chooses audio or elements */}
        {gamePhase === "selecting_mode" && isStoryteller && (
          <div className="min-h-screen flex items-center justify-center p-4">
            <Card className="w-full max-w-4xl">
              <CardHeader>
                <CardTitle className="text-center text-2xl">
                  Choose Your Clue Style
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isGeneratingWhisp ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-4">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                    <p className="text-lg text-muted-foreground">
                      Generating your secret whisp word...
                    </p>
                  </div>
                ) : (
                  <TurnModeSelection
                    onModeSelect={handleModeSelect}
                    playerName={players.find(p => p.player_id === currentPlayerId)?.name}
                    disabled={isGeneratingWhisp}
                  />
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {gamePhase === "selecting_mode" && !isStoryteller && (
          <div className="min-h-screen flex items-center justify-center">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-foreground mb-2">
                Waiting for storyteller...
              </h2>
              <p className="text-muted-foreground">
                {players.find((p) => p.player_id === session.current_storyteller_id)?.name} is choosing their clue mode
              </p>
            </div>
          </div>
        )}


        {/* Storytelling Phase */}
        {gamePhase === "storytelling" && isStoryteller && currentTurn && (
          <StorytellingInterface
            theme={currentTurn.theme}
            whisp={currentTurn.whisp || ""}
            sessionId={sessionId!}
            playerId={currentPlayerId}
            turnId={currentTurn.id}
            onStoryComplete={handleStoryComplete}
            isStoryteller={isStoryteller}
            storytellerName={players.find((p) => p.player_id === session.current_storyteller_id)?.name || "Player"}
            sendWebSocketMessage={sendWebSocketMessage}
            selectedIcons={selectedIcons}
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
                  Listen carefully and try to guess the whisp word!
                </p>
                {isReceivingAudio && (
                  <div className="mt-4 flex items-center justify-center gap-2 text-sm text-green-600">
                    <div className="h-3 w-3 rounded-full bg-green-600 animate-pulse" />
                    <span className="font-medium">Listening to live recording...</span>
                  </div>
                )}
              </div>
              
              <div className="text-center text-sm text-muted-foreground">
                Waiting for {players.find((p) => p.player_id === session.current_storyteller_id)?.name} to record their story...
              </div>
            </div>
          </div>
        )}

        {/* Elements Phase - Storyteller arranges elements */}
        {gamePhase === "elements" && isStoryteller && currentTurn && (
          <ElementsInterface
            theme={currentTurn.theme}
            whisp={currentTurn.whisp || ""}
            sessionId={sessionId!}
            playerId={currentPlayerId}
            turnId={currentTurn.id}
            onSubmit={handleStoryComplete}
            isStoryteller={isStoryteller}
            storytellerName={players.find((p) => p.player_id === session.current_storyteller_id)?.name || "Player"}
            sendWebSocketMessage={sendWebSocketMessage}
            selectedIcons={selectedIcons}
          />
        )}

        {gamePhase === "elements" && !isStoryteller && (
          <div className="min-h-screen flex items-center justify-center p-4">
            <div className="max-w-2xl w-full space-y-6">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-foreground mb-2">
                  {players.find((p) => p.player_id === session.current_storyteller_id)?.name} is arranging elements
                </h2>
                <p className="text-muted-foreground">
                  Watch the elements and try to guess the whisp word!
                </p>
              </div>
              
              <div className="text-center text-sm text-muted-foreground">
                Waiting for {players.find((p) => p.player_id === session.current_storyteller_id)?.name} to submit their element order...
              </div>
            </div>
          </div>
        )}

        {/* Guessing Phase */}
        {gamePhase === "guessing" && !isStoryteller && currentTurn && (currentTurn.recording_url || currentTurn.turn_mode === "elements") && (
          <GuessingInterface
            storytellerName={players.find((p) => p.player_id === session.current_storyteller_id)?.name || "Player"}
            theme={currentTurn.theme}
            audioUrl={currentTurn.recording_url || undefined}
            sessionId={sessionId!}
            roundNumber={session.current_round ?? 1}
            playerId={currentPlayerId}
            onGuessSubmit={handleGuessSubmit}
            selectedIcons={selectedIcons}
            turnMode={currentTurn.turn_mode}
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
              {currentTurn?.whisp && (
                <p className="mt-4 text-lg">
                  Your whisp was: <span className="font-bold text-primary">{currentTurn.whisp}</span>
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
