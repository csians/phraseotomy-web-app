import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useGameWebSocket } from "@/hooks/useGameWebSocket";
import { Scoreboard } from "@/components/Scoreboard";
import { UnifiedStorytellingInterface } from "@/components/UnifiedStorytellingInterface";
import { GuessingInterface } from "@/components/GuessingInterface";
import { ThemeSelectionCards } from "@/components/ThemeSelectionCards";
import { GameTimer } from "@/components/GameTimer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Loader2, Trophy, ArrowLeft } from "lucide-react";
import Header from "@/components/Header";
import type { IconItem } from "@/components/IconSelectionPanel";


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
  turn_mode?: "audio" | "elements" | null;
  story_time_seconds?: number;
  guess_time_seconds?: number;
}

interface Turn {
  id: string;
  theme_id: string;
  whisp: string | null;
  recording_url: string | null;
  completed_at: string | null;
  created_at: string;
  theme: Theme;
  selected_icon_ids?: string[];
  icon_order?: number[];
  turn_mode?: "audio" | "elements";
}

interface IconItemLocal {
  id: string;
  name: string;
  icon: string;
  isFromCore: boolean;
  image_url?: string | null;
  color?: string | null;
}

interface ThemeElement {
  id: string;
  name: string;
  icon: string;
  image_url?: string | null;
  color?: string | null;
}

type GamePhase = "selecting_theme" | "storytelling" | "guessing" | "scoring";

export default function Game() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false); // Start with false to prevent stuck loading screen
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
  const [gameCompleted, setGameCompleted] = useState(false);
  const [isAnnouncingWinner, setIsAnnouncingWinner] = useState(false);
  const [gameWinner, setGameWinner] = useState<Player | null>(null);
  const [isTieGame, setIsTieGame] = useState(false);
  const [isRoundTransitioning, setIsRoundTransitioning] = useState(false);
  const [roundResultMessage, setRoundResultMessage] = useState<{correct: boolean; message: string} | null>(null);
  const [isModeTransitioning, setIsModeTransitioning] = useState(false);
  const [selectedTurnMode, setSelectedTurnMode] = useState<"audio" | "elements" | null>(null);
  const [themeElementsForSelection, setThemeElementsForSelection] = useState<ThemeElement[]>([]);
  const [coreElementsForSelection, setCoreElementsForSelection] = useState<IconItem[]>([]);
  const [currentWhisp, setCurrentWhisp] = useState<string>("");
  
  // Refs to track completion state for use in callbacks (avoid stale closures)
  const gameCompletedRef = useRef(false);
  const isAnnouncingWinnerRef = useRef(false);
  const isModeSelectingRef = useRef(false); // Prevent refresh during mode selection
  const isStorytellerActiveRef = useRef(false); // Prevent polling during storytelling
  const roundTransitionTriggeredRef = useRef<string | null>(null); // Prevent duplicate round transitions
  const gameCompletionResultShownRef = useRef(false); // Prevent duplicate game completion result displays
  const [lifetimePoints, setLifetimePoints] = useState<Record<string, number>>({});
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<string[]>([]);
  const isPlayingRef = useRef(false);
  const refreshDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const lastRefreshRef = useRef<number>(0);
  // Track if timer callbacks have been triggered for current turn to prevent loops
  const storyTimeUpTriggeredRef = useRef<string>("");
  const guessTimeUpTriggeredRef = useRef<string>("");

  type RefreshOptions = { bypassStoryPause?: boolean; showLoading?: boolean };

  // Debounced refresh to prevent infinite loops
  const debouncedRefresh = useCallback((options: RefreshOptions = {}) => {
    const bypassStoryPause = options.bypassStoryPause === true;
    // Default to false - only show loading if explicitly requested (initial load only)
    const showLoading = options.showLoading === true;

    // Don't refresh if game is completed, announcing winner, selecting mode, storyteller is active, or round is transitioning
    if (
      gameCompletedRef.current ||
      isAnnouncingWinnerRef.current ||
      isModeSelectingRef.current ||
      (!bypassStoryPause && isStorytellerActiveRef.current) ||
      roundTransitionTriggeredRef.current !== null // Don't refresh while round transition is active
    ) {
      console.log("Skipping refresh - game completed, announcing winner, selecting mode, storyteller active, or round transitioning");
      return;
    }

    const now = Date.now();
    // Prevent refreshing more than once per second
    if (now - lastRefreshRef.current < 1000) {
      return;
    }

    if (refreshDebounceRef.current) {
      clearTimeout(refreshDebounceRef.current);
    }

    refreshDebounceRef.current = setTimeout(() => {
      lastRefreshRef.current = Date.now();
      // Ensure showLoading is false unless explicitly set to true
      initializeGame({ ...options, showLoading: options.showLoading === true });
    }, 300);
  }, []); // Using refs instead of state for checks

  // Force refresh that bypasses storyteller active check - for critical state transitions
  const forceRefresh = useCallback(() => {
    // Still skip if game is completed or announcing winner
    if (gameCompletedRef.current || isAnnouncingWinnerRef.current) {
      console.log("Skipping forceRefresh - game completed or announcing winner");
      return;
    }

    // Clear the storyteller active flag since story is submitted
    isStorytellerActiveRef.current = false;

    if (refreshDebounceRef.current) {
      clearTimeout(refreshDebounceRef.current);
    }

    console.log("🔄 Force refresh triggered - story submitted, transitioning to guessing phase");
    refreshDebounceRef.current = setTimeout(() => {
      lastRefreshRef.current = Date.now();
      initializeGame({ bypassStoryPause: true, showLoading: false });
    }, 100); // Shorter delay for immediate transition
  }, []);

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

    // Guest users may only have the id in sessionStorage (Safari/3rd-party iframe constraints)
    return sessionStorage.getItem("guest_player_id") || localStorage.getItem("guest_player_id") || "";
  };

  // Get current player info for WebSocket
  const getCurrentPlayerInfo = () => {
    const playerId = getCurrentPlayerId();
    const player = players.find((p) => p.player_id === playerId);
    return {
      playerId,
      playerName: player?.name || "Player",
    };
  };

  // Fetch lifetime points for players from customers table
  const fetchLifetimePoints = async (playersToFetch: Player[]) => {
    try {
      const playerIds = playersToFetch.map(p => p.player_id);
      const { data, error } = await supabase
        .from('customers')
        .select('customer_id, total_points')
        .in('customer_id', playerIds);
      
      if (error) {
        console.error("Error fetching lifetime points:", error);
        return;
      }
      
      const pointsMap: Record<string, number> = {};
      data?.forEach(c => {
        pointsMap[c.customer_id] = c.total_points || 0;
      });
      setLifetimePoints(pointsMap);
    } catch (err) {
      console.error("Failed to fetch lifetime points:", err);
    }
  };

  // Helper function to determine winner and detect ties
  const determineWinnerAndTies = (playersData: Player[]) => {
    if (!playersData || playersData.length === 0) {
      setGameWinner(null);
      setIsTieGame(false);
      return;
    }
    
    const sortedPlayers = [...playersData].sort((a, b) => (b.score || 0) - (a.score || 0));
    const highestScore = sortedPlayers[0]?.score || 0;
    
    // Count how many players have the highest score
    const playersWithHighestScore = sortedPlayers.filter(p => (p.score || 0) === highestScore);
    
    if (playersWithHighestScore.length > 1) {
      // It's a tie
      setIsTieGame(true);
      setGameWinner(null);
    } else {
      setIsTieGame(false);
      setGameWinner(sortedPlayers[0] || null);
    }
  };
  
  // Keep refs in sync with state (for use in callbacks to avoid stale closures)
  useEffect(() => {
    gameCompletedRef.current = gameCompleted;
  }, [gameCompleted]);
  
  useEffect(() => {
    isAnnouncingWinnerRef.current = isAnnouncingWinner;
  }, [isAnnouncingWinner]);

  // Pause polling during storytelling phase for ALL players (not just storyteller)
  // This prevents continuous get-game-state calls while someone is creating their story
  useEffect(() => {
    const shouldPausePolling = gamePhase === "storytelling" && !gameCompleted;
    isStorytellerActiveRef.current = shouldPausePolling;
    console.log("Polling paused during storytelling:", shouldPausePolling, "gamePhase:", gamePhase);
  }, [gamePhase, gameCompleted]);
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
          if (message.audioData && message.storytellerId !== currentPlayerId) {
            playAudioChunk(message.audioData);
          }
          break;

        case "theme_selected":
          toast({
            title: "Theme Selected",
            description: `${message.storytellerName || "Storyteller"} chose a theme`,
          });
          debouncedRefresh({ showLoading: false });
          break;

        case "mode_selected":
        case "storyteller_ready":
          toast({
            title: "Mode Selected",
            description: `${message.storytellerName || "Storyteller"} is ready`,
          });
          debouncedRefresh({ showLoading: false });
          break;

        case "recording_uploaded":
        case "story_submitted":
          toast({
            title: "Audio Ready! 🎤",
            description: "Listen to the clue and guess the secret element",
          });
          // Use forceRefresh to bypass storyteller active check and transition to guessing
          forceRefresh();
          break;

        case "elements_submitted":
          toast({
            title: "Elements Ready!",
            description: "The storyteller has submitted their elements",
          });
          debouncedRefresh();
          break;

        case "icons_reordered":
          // Ignore live reordering - only refresh on elements_submitted
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
          debouncedRefresh({ showLoading: false });
          break;

        case "correct_answer":
          toast({
            title: "Round Complete! 🏆",
            description: `${message.winnerName} got it right! The answer was "${message.secretElement}"`,
          });
          debouncedRefresh({ showLoading: false });
          break;

        case "next_turn":
          // Skip showing round transition dialog - just refresh silently
          debouncedRefresh({ showLoading: false });
          break;

        case "round_result":
          // This message should only be shown when ALL players have answered
          // Skip if turn is not actually completed (check via realtime or polling instead)
          console.log("📢 Round result received (ignoring - should use next_turn or realtime instead):", message);
          // Don't show dialog here - let the realtime subscription or polling handle it
          break;

      case "game_completed":
          console.log("🎉 Received game_completed event:", message);
          
          // Don't process if already showing result (use ref to prevent race conditions)
          if (gameCompletionResultShownRef.current) {
            console.log("Game completion result already shown, skipping duplicate WebSocket event");
            return;
          }
          
          // NO REFRESH - Use only WebSocket message data for instant display
          // WebSocket message should contain all necessary data (players, secretElement, wasCorrect)
          if (!message.players || message.players.length === 0) {
            console.error("⚠️ WebSocket game_completed message missing players data");
            return;
          }
          
          const secretElement = message.secretElement || currentTurn?.whisp || "?";
          // Use wasCorrect from message if available (for the last player who submitted)
          // For storyteller and other players, will be determined in handleGameCompletion
          const playerWasCorrect = message.wasCorrect !== undefined ? message.wasCorrect : undefined;
          
          // Use shared handler to show round result - ensures ALL players (including storyteller) see it the same way
          // WebSocket broadcasts to ALL players simultaneously, ensuring synchronization
          // NO REFRESH CALLS - all data comes from WebSocket message
          handleGameCompletion(message.players, secretElement, playerWasCorrect);

          supabase
            .from("game_sessions")
            .update({ status: "expired" })
            .eq("id", sessionId)
            .then(() => console.log("✅ Session marked as expired"));

          // Auto-cleanup disabled - keeping sessions for history
          break;

        case "player_joined":
          toast({
            title: "Player Joined",
            description: `${message.playerName} joined the game`,
          });
          debouncedRefresh({ showLoading: false });
          break;

        case "player_left":
          toast({
            title: "Player Left",
            description: `${message.playerName} left the game`,
          });
          debouncedRefresh({ showLoading: false });
          break;

        case "refresh_game_state":
          debouncedRefresh({ showLoading: false });
          break;

        default:
          // Don't refresh on unknown messages
          break;
      }
    },
  });

  useEffect(() => {
    console.log("Game component mounted, sessionId:", sessionId);
    if (!sessionId) {
      console.log("No sessionId, redirecting to /play/host");
      setLoading(false);
      navigate("/play/host");
      return;
    }

    // Set a timeout fallback to ensure loading never gets stuck (3 seconds max)
    let loadingTimeoutId: NodeJS.Timeout | null = setTimeout(() => {
      console.warn("⚠️ Loading timeout - clearing loading state to prevent stuck screen");
      setLoading(false);
    }, 3000);

    // Only show loading briefly for initial load
    setLoading(true);
    initializeGame({ showLoading: true }).finally(() => {
      // Always clear loading after initialization, regardless of success/failure
      setLoading(false);
      // Clear timeout once initialization completes
      if (loadingTimeoutId) {
        clearTimeout(loadingTimeoutId);
        loadingTimeoutId = null;
      }
    });
    
    const cleanup = setupRealtimeSubscriptions();

    // Poll fallback: only when WS is disconnected. Used as a safety net for completion state.
    const pollId = window.setInterval(async () => {
      try {
        if (!sessionId) return;
        if (isConnected) return;
        if (gameCompletedRef.current || isAnnouncingWinnerRef.current || isModeSelectingRef.current) return;
        // Skip polling when storyteller is actively creating their story
        if (isStorytellerActiveRef.current) return;

        const playerId = getCurrentPlayerId();
        const { data, error } = await supabase.functions.invoke("get-game-state", {
          body: { sessionId, playerId },
        });

        if (error) {
          console.log("poll:get-game-state error", error);
          return;
        }

        const status = data?.session?.status;
        if (status === "completed" || status === "expired") {
          console.log("🎯 Poll detected game completed:", status);

          // Don't process if already showing result (use ref to prevent race conditions)
          // WebSocket should be the primary source for synchronized display - skip poll if WebSocket already handled it
          if (gameCompletionResultShownRef.current || isRoundTransitioning || isAnnouncingWinnerRef.current || gameCompletedRef.current) {
            console.log("Already showing game completion result via WebSocket, skipping poll fallback");
            return;
          }

          // Poll is fallback only - WebSocket should handle this first
          // Use data from poll response - no additional refresh needed
          const secret = data?.currentTurn?.whisp || currentTurn?.whisp || "?";
          const playersForCompletion: Player[] = data?.players || [];

          if (playersForCompletion.length > 0) {
            setSession(data.session);
            // Use shared handler to show round result - ensures all players see it the same way
            // NO REFRESH - using data from poll response
            handleGameCompletion(playersForCompletion, secret);
          }
        }
      } catch (err) {
        console.error("poll:get-game-state failed", err);
      }
    }, 10000);

    return () => {
      if (cleanup) cleanup();
      window.clearInterval(pollId);
      // Clear loading timeout on unmount
      if (loadingTimeoutId) {
        clearTimeout(loadingTimeoutId);
      }
    };
  }, [sessionId, isConnected]);

  // Auto-trigger turn start when theme is selected but no whisp yet
  const autoTurnTriggeredRef = useRef(false);
  useEffect(() => {
    // Only run once when conditions are met
    if (autoTurnTriggeredRef.current) return;

    const hasWhisp = !!currentTurn?.whisp;
    const isStoryteller = session?.current_storyteller_id === currentPlayerId;
    const hasTheme = !!session?.selected_theme_id;

    if (
      hasTheme &&
      isStoryteller &&
      !hasWhisp &&
      !isGeneratingWhisp &&
      gamePhase === "storytelling"
    ) {
      console.log("Auto-triggering turn start with theme:", session?.selected_theme_id);
      autoTurnTriggeredRef.current = true;
      handleStartTurn(session?.selected_theme_id || "");
    }

    // Reset flag when turn changes
    if (hasWhisp) {
      autoTurnTriggeredRef.current = false;
    }
  }, [
    session?.selected_theme_id,
    session?.current_storyteller_id,
    currentPlayerId,
    currentTurn?.whisp,
    gamePhase,
    isGeneratingWhisp,
  ]);

  const initializeGame = async (options: RefreshOptions = {}) => {
    const bypassStoryPause = options.bypassStoryPause === true;
    // Default to false - only show loading if explicitly requested (initial load only)
    const showLoading = options.showLoading === true;

    // Don't reinitialize if game is already completed, announcing winner, selecting mode, or storyteller is active
    if (
      gameCompletedRef.current ||
      isAnnouncingWinnerRef.current ||
      isModeSelectingRef.current ||
      (!bypassStoryPause && isStorytellerActiveRef.current)
    ) {
      console.log(
        "Skipping initializeGame - game completed, announcing winner, selecting mode, or storyteller active",
      );
      // Only clear loading if it was shown
      if (showLoading) {
        setLoading(false);
      }
      return;
    }

    try {
      // Only show loading if explicitly requested (initial load or user action)
      if (showLoading) {
        setLoading(true);
      }
      const playerId = getCurrentPlayerId();
      console.log("Current player ID:", playerId);
      setCurrentPlayerId(playerId);

      console.log("Fetching game state for session:", sessionId);
      const { data, error } = await supabase.functions.invoke("get-game-state", {
        body: { sessionId, playerId },
      });

      if (error) {
        console.error("Error from get-game-state:", error);
        // Always clear loading on error
        setLoading(false);
        // Check if session was deleted (game completed and cleaned up)
        if (error.message?.includes("Session not found") || session?.status === "expired") {
          console.log("Session was cleaned up, redirecting...");
          toast({
            title: "Game Ended",
            description: "This game session has been cleaned up.",
          });
          navigate("/play/host");
          return;
        }
        throw error;
      }

      // If session not found in response, it was deleted
      if (!data?.session) {
        console.log("Session not found in response, likely cleaned up");
        // Always clear loading
        setLoading(false);
        toast({
          title: "Game Ended",
          description: "This game session has ended.",
        });
        navigate("/play/host");
        return;
      }

      // If session is expired/completed, show winner dialog
      if (data.session?.status === "expired" || data.session?.status === "completed") {
        console.log("Game already completed, status:", data.session.status);
        setSession(data.session);
        setPlayers(data.players || []);

        // Find winner (or detect tie) and show completion dialog
        determineWinnerAndTies(data.players || []);
        setGameCompleted(true);

        // Fetch lifetime points for completed game
        fetchLifetimePoints(data.players || []);
        // Always clear loading
        setLoading(false);
        return;
      }

      console.log("Game state received:", data);
      console.log("Session:", data.session);
      console.log("Players:", data.players);
      console.log("Themes count:", data.themes?.length);
      console.log("Current turn:", data.currentTurn);
      console.log("Current storyteller:", data.session?.current_storyteller_id);

      // Reset round transition trigger when round changes
      const previousRound = session?.current_round;
      const newRound = data.session?.current_round;
      if (previousRound !== undefined && newRound !== undefined && previousRound !== newRound) {
        console.log(`🔄 Round changed from ${previousRound} to ${newRound} - resetting transition trigger`);
        roundTransitionTriggeredRef.current = null;
      }
      
      setSession(data.session);
      setPlayers(data.players || []);
      setThemes(data.themes || []);
      
      // Decode whisp for storyteller if it's encrypted
      const isStoryteller = data.session?.current_storyteller_id === playerId;
      if (data.currentTurn && data.currentTurn.whisp && isStoryteller) {
        // Decode if it's encrypted (starts with _ENC_)
        let decodedWhisp = data.currentTurn.whisp;
        if (data.currentTurn.whisp.startsWith('_ENC_')) {
          try {
            decodedWhisp = atob(data.currentTurn.whisp.substring(5));
          } catch (e) {
            console.error('Error decoding whisp:', e);
            decodedWhisp = data.currentTurn.whisp;
          }
        }
        setCurrentTurn({ ...data.currentTurn, whisp: decodedWhisp });
      } else {
        setCurrentTurn(data.currentTurn);
      }
      
      setSelectedIcons(data.selectedIcons || []);
      setUnlockedPackIds(data.unlockedPackIds || []);

      // Determine game phase based on turn state
      let phase: GamePhase;
      const turnMode = data.currentTurn?.turn_mode;
      const hasWhisp = !!data.currentTurn?.whisp;
      const hasTheme = !!data.currentTurn?.theme_id;

      // Session theme is the permanent theme for all rounds (selected once in Round 1)
      const sessionThemeId = data.session?.selected_theme_id;
      const sessionHasTheme = !!sessionThemeId;

      // Session-level turn mode (set at lobby creation - skips per-turn mode selection)
      const sessionTurnMode = data.session?.turn_mode;

      // Phase determination (simplified - unified flow):
      // 1. No session theme -> show theme selection
      // 2. Theme exists but no whisp -> storytelling (unified)
      // 3. Has whisp and completed -> guessing

      if (!sessionHasTheme && !hasTheme) {
        phase = "selecting_theme";
      } else if (!hasWhisp || !data.currentTurn?.completed_at) {
        phase = "storytelling";
      } else {
        phase = "guessing";
      }

      console.log(
        "Game phase:",
        phase,
        "sessionHasTheme:",
        sessionHasTheme,
        "hasTheme:",
        hasTheme,
        "hasWhisp:",
        hasWhisp,
        "turnMode:",
        turnMode,
        "sessionTurnMode:",
        sessionTurnMode,
      );
      setGamePhase(phase);

      // Always use session theme (for all rounds)
      if (sessionThemeId) {
        setSelectedThemeId(sessionThemeId);
      } else if (data.currentTurn?.theme_id) {
        setSelectedThemeId(data.currentTurn.theme_id);
      }

      // Set turn mode: prefer session-level, fallback to turn-level
      if (sessionTurnMode) {
        setSelectedTurnMode(sessionTurnMode);
      } else if (data.currentTurn?.turn_mode) {
        setSelectedTurnMode(data.currentTurn.turn_mode);
      } else {
        setSelectedTurnMode(null); // Reset for new turn - storyteller will choose
      }
    } catch (error) {
      console.error("Error initializing game:", error);
      // Don't show error toast if game is already completed/expired or we're announcing winner (use refs)
      if (
        session?.status !== "expired" &&
        session?.status !== "completed" &&
        !gameCompletedRef.current &&
        !isAnnouncingWinnerRef.current
      ) {
        toast({
          title: "Error",
          description: "Failed to load game state.",
          variant: "destructive",
        });
      }
    } finally {
      // Only hide loading if it was shown
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  const setupRealtimeSubscriptions = () => {
    const channel = supabase
      .channel(`game-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "game_sessions",
          filter: `id=eq.${sessionId}`,
        },
        (payload) => {
          // Check if game was just completed - show winner popup for everyone
          const newStatus = (payload.new as any)?.status;
          if (newStatus === "completed" || newStatus === "expired") {
            console.log("🎉 Game session status changed to (via Realtime):", newStatus);
            
            // Don't process if already showing result (use ref to prevent race conditions)
            // WebSocket should be the primary source for synchronized display - skip realtime if WebSocket already handled it
            if (gameCompletionResultShownRef.current || isAnnouncingWinnerRef.current || gameCompletedRef.current || isRoundTransitioning) {
              console.log("Already showing game completion result via WebSocket, skipping realtime event");
              return;
            }
            
            // Realtime is fallback only - WebSocket should handle this first
            // If we reach here, WebSocket might not be connected, so use realtime as fallback
            // But still try to avoid refresh by using existing data
            const secretElement = currentTurn?.whisp || "?";
            if (players && players.length > 0) {
              // Use existing players data if available - no refresh needed
              handleGameCompletion(players, secretElement);
            } else {
              // Only fetch if we don't have players data
              const fetchAndShowCompletion = async () => {
                try {
                  const { data: latestPlayers } = await supabase
                    .from("game_players")
                    .select("id, player_id, name, score, turn_order")
                    .eq("session_id", sessionId)
                    .order("score", { ascending: false });
                  
                  const playersForCompletion = (latestPlayers && latestPlayers.length > 0) ? latestPlayers : players;
                  handleGameCompletion(playersForCompletion, secretElement);
                } catch (err) {
                  console.error("Error fetching data for completion:", err);
                  handleGameCompletion(players, secretElement);
                }
              };
              fetchAndShowCompletion();
            }
          } else {
            debouncedRefresh({ showLoading: false });
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "game_turns",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          console.log("game_turns Realtime update received:", payload);

          // Prevent the storyteller UI from resetting while they are building the story.
          // We can reliably detect this from the updated row itself (no stale React state/closures).
          const myId = getCurrentPlayerId();
          const newRow = (payload as any)?.new;
          const storytellerId = newRow?.storyteller_id;
          const isMyTurn = !!storytellerId && myId === storytellerId;
          const isTurnCompleted = !!newRow?.completed_at;
          const oldRow = (payload as any)?.old;
          const wasJustCompleted = !oldRow?.completed_at && isTurnCompleted;

          // If I'm the storyteller and the turn is not completed yet, skip refresh.
          // (Refreshing sets loading=true in Game.tsx, which unmounts the interface and sends you back to Step 1.)
          if (isMyTurn && !isTurnCompleted) {
            console.log("Skipping refresh - storyteller is still composing the story");
            return;
          }

          // If turn was just completed (all players answered), show round transition for ALL players
          if (wasJustCompleted && isTurnCompleted && gamePhase === "guessing") {
            const turnId = newRow?.id;
            
            // Prevent duplicate transitions - check if we already showed this transition
            if (roundTransitionTriggeredRef.current === turnId) {
              console.log("⏭️ Skipping duplicate round transition for turn:", turnId);
              return;
            }
            
            console.log("🎯 Turn completed - refreshing silently (no dialog)");
            roundTransitionTriggeredRef.current = turnId;
            // Clear transition trigger immediately and refresh silently
            setTimeout(() => {
              roundTransitionTriggeredRef.current = null;
              debouncedRefresh({ bypassStoryPause: true, showLoading: false });
            }, 100);
            return;
          }

          // Skip refresh if round transition is already showing (prevents multiple API calls)
          if (roundTransitionTriggeredRef.current === null) {
            // Only refresh if not in round transition
            debouncedRefresh({ bypassStoryPause: true, showLoading: false });
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "game_players",
          filter: `session_id=eq.${sessionId}`,
        },
        () => {
          // Silent refresh when new player joins - don't show loading
          console.log("New player joined - silent refresh");
          debouncedRefresh({ showLoading: false, bypassStoryPause: true });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "game_players",
          filter: `session_id=eq.${sessionId}`,
        },
        () => {
          // Silent refresh for player updates (score changes, etc.) - don't show loading
          debouncedRefresh({ showLoading: false, bypassStoryPause: true });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "game_players",
          filter: `session_id=eq.${sessionId}`,
        },
        () => {
          console.log("Player deleted from game, refreshing...");
          debouncedRefresh({ showLoading: false });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "game_guesses",
        },
        (payload) => {
          // Get player_id from the inserted guess
          const guessPlayerId = (payload.new as any)?.player_id;
          
          // Find player name from current players state
          const guessingPlayer = players.find((p) => p.player_id === guessPlayerId);
          const playerName = guessingPlayer?.name || "A player";
          
          // Don't show toast if it's the current player (they already see their own submission)
          if (guessPlayerId !== currentPlayerId) {
            toast({
              title: "Player Guessed!",
              description: `${playerName} submitted their guess`,
            });
          }
          
          debouncedRefresh({ showLoading: false });
        },
      )
      .on("broadcast", { event: "lobby_ended" }, () => {
        toast({
          title: "Game Ended",
          description: "The host has ended this game",
        });
        navigate("/login", { replace: true });
      })
      .on("broadcast", { event: "player_left" }, (payload) => {
        const leftPlayerName = payload.payload?.senderName || "A player";
        toast({
          title: "Player Left",
          description: `${leftPlayerName} left the game`,
        });
        debouncedRefresh({ showLoading: false });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  // Handle theme selection - immediately start turn with unified flow
  const handleThemeSelect = async (themeId: string) => {
    setSelectedThemeId(themeId);
    setIsGeneratingWhisp(true);
    setIsModeTransitioning(true);

    try {
      // Save theme selection to game_sessions
      const { error } = await supabase.from("game_sessions").update({ selected_theme_id: themeId }).eq("id", sessionId);

      if (error) throw error;

      // Notify other players
      sendWebSocketMessage({
        type: "theme_selected",
        themeId,
      });

      // Start the turn immediately
      await handleStartTurn(themeId);
    } catch (error) {
      console.error("Error selecting theme:", error);
      toast({
        title: "Error",
        description: "Failed to select theme.",
        variant: "destructive",
      });
      setIsGeneratingWhisp(false);
      setIsModeTransitioning(false);
    }
  };

  // Handle starting a turn - unified flow (no mode selection)
  const handleStartTurn = async (themeId: string) => {
    try {
      // Get the current turn to ensure we have the latest turn ID
      const { data: gameState } = await supabase.functions.invoke("get-game-state", {
        body: { sessionId },
      });

      const turnId = gameState?.currentTurn?.id || currentTurn?.id;

      console.log("Starting turn with themeId:", themeId, "turnId:", turnId);

      // Call start-turn to get whisp, theme elements, and core elements
      const { data, error } = await supabase.functions.invoke("start-turn", {
        body: {
          sessionId,
          turnId,
          selectedThemeId: themeId,
        },
      });

      if (error) throw error;

      console.log("Start-turn response:", data);

      // Update local state with turn data
      const turnWithTheme = {
        ...data.turn,
        theme: data.theme,
      };
      setCurrentTurn(turnWithTheme);
      
      // Store theme elements and core elements for the unified interface
      setThemeElementsForSelection(data.themeElements || []);
      setCoreElementsForSelection(data.coreElements || []);
      setCurrentWhisp(data.whisp || "");

      // Move to storytelling phase (unified)
      setGamePhase("storytelling");

      // Notify other players
      sendWebSocketMessage({
        type: "mode_selected",
        whisp: data.whisp,
      });

      toast({
        title: "Turn Started! ✨",
        description: `Your secret whisp is: "${data.whisp}"`,
      });

      setTimeout(() => {
        setIsGeneratingWhisp(false);
        setIsModeTransitioning(false);
      }, 500);
    } catch (error) {
      console.error("Error starting turn:", error);
      toast({
        title: "Error",
        description: "Failed to start turn.",
        variant: "destructive",
      });
      setIsGeneratingWhisp(false);
      setIsModeTransitioning(false);
    }
  };

  const handleStoryComplete = () => {
    // Allow polling again after storyteller finishes
    isStorytellerActiveRef.current = false;
    toast({
      title: "Story Submitted!",
      description: "Waiting for other players to guess...",
    });
    initializeGame({ showLoading: false }); // Silent refresh after story submission
  };

  // Shared function to handle game completion - ensures all players see results the same way
  // NO REFRESH CALLS - uses only WebSocket data for instant display
  const handleGameCompletion = useCallback(async (playersData: Player[], secretElement: string, playerWasCorrect?: boolean | null) => {
    // Don't process if already showing round result or announcing winner
    // Use ref to prevent race conditions from multiple triggers (WebSocket, realtime, polling)
    if (gameCompletionResultShownRef.current || isRoundTransitioning || isAnnouncingWinnerRef.current || gameCompletedRef.current) {
      console.log("Already showing round result, announcing winner, or game completed, skipping");
      return;
    }
    
    // Mark as shown immediately to prevent duplicate displays
    gameCompletionResultShownRef.current = true;

    // Determine if current player was correct (if not provided)
    // For WebSocket messages, wasCorrect is already provided, so no database fetch needed
    let wasCorrect = playerWasCorrect;
    if (wasCorrect === undefined || wasCorrect === null) {
      const isStoryteller = currentPlayerId === session?.current_storyteller_id;
      if (isStoryteller) {
        wasCorrect = null; // Storyteller doesn't have a guess
      } else {
        // Only fetch from database if not provided (fallback for realtime/polling)
        // WebSocket messages should always include wasCorrect
        try {
          const { data: playerGuess } = await supabase
            .from("game_guesses")
            .select("points_earned")
            .eq("player_id", currentPlayerId)
            .eq("session_id", sessionId)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();
          
          wasCorrect = playerGuess?.points_earned === 1;
        } catch (err) {
          console.error("Error fetching player guess:", err);
          wasCorrect = false;
        }
      }
    }

    const isStoryteller = currentPlayerId === session?.current_storyteller_id;
    
    // Show round result dialog FIRST - cannot be skipped
    if (isStoryteller) {
      // Storyteller sees neutral message showing the secret element
      setRoundResultMessage({
        correct: true, // Use true for neutral styling
        message: `Game Complete! The secret wisp was "${secretElement}"`
      });
    } else {
      // Guessing players see their result
      setRoundResultMessage({
        correct: wasCorrect === true,
        message: wasCorrect === true 
          ? `Correct! The answer was "${secretElement}"` 
          : `Wrong Answer. The answer was "${secretElement}"`
      });
    }
    setIsRoundTransitioning(true);
    
    // Update players immediately
    setPlayers(playersData);
    determineWinnerAndTies(playersData);
    fetchLifetimePoints(playersData);
    
    // After showing round result for 3 seconds, show "Announcing Winner"
    setTimeout(() => {
      setIsRoundTransitioning(false);
      setRoundResultMessage(null);
      // Set ref BEFORE state to block concurrent refreshes
      isAnnouncingWinnerRef.current = true;
      setIsAnnouncingWinner(true);
      
      // After 3 seconds of "Announcing Winner", show the actual winner dialog
      setTimeout(() => {
        // Set ref BEFORE state to prevent race conditions
        gameCompletedRef.current = true;
        setIsAnnouncingWinner(false);
        setGameCompleted(true);
      }, 3000);
    }, 3000); // Show round result for 3 seconds
  }, [sessionId, currentPlayerId, session?.current_storyteller_id, isRoundTransitioning]);

  const handleGuessSubmit = async (gameCompletedFromGuess?: boolean, playersFromGuess?: any[], wasCorrect?: boolean, whisp?: string, nextRound?: any, allPlayersAnswered?: boolean) => {
    console.log("📝 handleGuessSubmit called:", { gameCompletedFromGuess, wasCorrect, whisp, playersCount: playersFromGuess?.length });
    
    toast({
      title: "Guess Submitted!",
      description: "Waiting for other players...",
    });
    
    // If game just completed, broadcast game_completed message and let WebSocket handler show result
    // This ensures the last player sees the result the same way as other players (via WebSocket)
    if (gameCompletedFromGuess && playersFromGuess && playersFromGuess.length > 0) {
      console.log("🎉 Game completed from guess submission, wasCorrect:", wasCorrect);
      
      // Broadcast game_completed to all players (including self via WebSocket)
      // The WebSocket handler will process this for ALL players, including the last one who submitted
      const sortedPlayers = [...playersFromGuess].sort((a: Player, b: Player) => (b.score || 0) - (a.score || 0));
      sendWebSocketMessage({
        type: "game_completed",
        winnerId: sortedPlayers[0]?.player_id,
        winnerName: sortedPlayers[0]?.name,
        players: playersFromGuess,
        wasCorrect: wasCorrect === true, // Include wasCorrect so last player sees their result correctly
        secretElement: whisp || currentTurn?.whisp,
      });
      
      // Don't call handleGameCompletion directly - let WebSocket handler do it for consistency
      // This ensures the last player sees the result dialog in exactly the same way as other players
      return;
    }
    
    // If all players answered but game continues (next round), skip dialog and refresh silently
    if (nextRound && nextRound.newStorytellerId && !gameCompletedFromGuess && allPlayersAnswered === true) {
      console.log("📢 Round complete, refreshing silently (no dialog)");
      // Clear transition trigger and refresh
      roundTransitionTriggeredRef.current = null;
      setTimeout(() => initializeGame({ showLoading: false }), 100);
      return;
    }
    
    // If player answered correctly but not all players have answered yet, don't show transition message
    // The message will be shown via WebSocket or polling when all players have answered
    // Don't refresh if round transition is active
    if (roundTransitionTriggeredRef.current === null) {
      initializeGame({ showLoading: false }); // Don't show loading for user action refreshes
    }
  };

  // Handle storyteller timer expiry - skip the round
  const handleStoryTimeUp = useCallback(async () => {
    const isCurrentStoryteller = currentPlayerId === session?.current_storyteller_id;
    const turnId = currentTurn?.id || "";
    
    // Prevent multiple triggers for the same turn
    if (!sessionId || !isCurrentStoryteller || gameCompleted) return;
    if (storyTimeUpTriggeredRef.current === turnId) {
      console.log("⏰ Story time already triggered for this turn, skipping");
      return;
    }
    storyTimeUpTriggeredRef.current = turnId;
    
    console.log("⏰ Story time expired - skipping round");
    toast({
      title: "⏰ Time's Up!",
      description: "Round skipped - moving to next storyteller",
      variant: "destructive",
    });

    try {
      const { data, error } = await supabase.functions.invoke("skip-turn", {
        body: { sessionId, reason: "storyteller_timeout" },
      });

      if (error) throw error;

      console.log("Skip turn response:", data);

      if (data.game_completed) {
        // Use WebSocket to broadcast game completion - ensures all players see result once and simultaneously
        const { data: latestPlayers } = await supabase
          .from("game_players")
          .select("id, player_id, name, score, turn_order")
          .eq("session_id", sessionId)
          .order("score", { ascending: false });
        
        const playersToUse = latestPlayers || players;
        const sortedPlayers = [...playersToUse].sort((a: Player, b: Player) => (b.score || 0) - (a.score || 0));
        
        // Broadcast via WebSocket - all players (including storyteller) will see result once via WebSocket handler
        sendWebSocketMessage({
          type: "game_completed",
          winnerId: sortedPlayers[0]?.player_id,
          winnerName: sortedPlayers[0]?.name,
          players: playersToUse,
          secretElement: currentTurn?.whisp || "?",
        });
      } else if (data.next_round) {
        sendWebSocketMessage({
          type: "next_turn",
          roundNumber: data.next_round.roundNumber,
          newStorytellerId: data.next_round.newStorytellerId,
          newStorytellerName: data.next_round.newStorytellerName,
        });
        // Only refresh if game continues
        initializeGame({ showLoading: false }); // Silent refresh after skip
      }
    } catch (error) {
      console.error("Error skipping turn:", error);
    }
  }, [sessionId, currentPlayerId, session?.current_storyteller_id, currentTurn?.id, gameCompleted, players, sendWebSocketMessage, toast]);

  // Handle guess timer expiry - auto-submit for players who haven't answered
  const handleGuessTimeUp = useCallback(async () => {
    const isCurrentStoryteller = currentPlayerId === session?.current_storyteller_id;
    const turnId = currentTurn?.id || "";
    
    // Prevent multiple triggers for the same turn
    if (!sessionId || !currentTurn || !session || isCurrentStoryteller || gameCompleted) return;
    if (guessTimeUpTriggeredRef.current === turnId) {
      console.log("⏰ Guess time already triggered for this turn, skipping");
      return;
    }
    guessTimeUpTriggeredRef.current = turnId;
    
    console.log("⏰ Guess time expired - auto-submitting");
    toast({
      title: "⏰ Time's Up!",
      description: "Your guess was automatically skipped",
      variant: "destructive",
    });

    try {
      const { data, error } = await supabase.functions.invoke("auto-submit-guess", {
        body: {
          sessionId,
          roundNumber: session.current_round,
          playerId: currentPlayerId,
          reason: "timeout",
        },
      });

      if (error) throw error;

      console.log("Auto-submit response:", data);

      if (data.game_completed) {
        // Use WebSocket to broadcast game completion - ensures all players see result once and simultaneously
        const { data: latestPlayers } = await supabase
          .from("game_players")
          .select("id, player_id, name, score, turn_order")
          .eq("session_id", sessionId)
          .order("score", { ascending: false });
        
        const playersToUse = latestPlayers || players;
        const sortedPlayers = [...playersToUse].sort((a: Player, b: Player) => (b.score || 0) - (a.score || 0));
        
        // Broadcast via WebSocket - all players (including storyteller) will see result once via WebSocket handler
        sendWebSocketMessage({
          type: "game_completed",
          winnerId: sortedPlayers[0]?.player_id,
          winnerName: sortedPlayers[0]?.name,
          players: playersToUse,
          secretElement: currentTurn?.whisp || "?",
        });
      } else if (data.next_round) {
        sendWebSocketMessage({
          type: "next_turn",
          roundNumber: data.next_round.roundNumber,
          newStorytellerId: data.next_round.newStorytellerId,
          newStorytellerName: data.next_round.newStorytellerName,
        });
        // Only refresh if game continues
        initializeGame({ showLoading: false }); // Silent refresh after auto-submit
      }
    } catch (error) {
      console.error("Error auto-submitting guess:", error);
    }
  }, [sessionId, currentTurn, session, currentPlayerId, gameCompleted, players, sendWebSocketMessage, toast]);

  // Only show the global loading screen before we have a session.
  // Once the game has loaded, avoid replacing the UI with "Loading game..."
  // during background refreshes of get-game-state.
  if (loading && !session) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading game...</p>
      </div>
    );
  }

  if (!loading && !session) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Game not found</p>
      </div>
    );
  }

  const isStoryteller = currentPlayerId === session.current_storyteller_id;
  const currentPlayer = players.find((p) => p.player_id === currentPlayerId);

  // Debug render state (only log once when phase changes)
  // console.log("🎮 [RENDER DEBUG] gamePhase:", gamePhase, "isStoryteller:", isStoryteller);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      {/* Main content area with responsive layout */}
      <div className="flex-1 flex flex-col md:flex-row">
        {/* Scoreboard - top on mobile, sidebar on desktop */}
        <aside className="w-full md:w-64 lg:w-80 flex-shrink-0 p-2 md:p-4 md:sticky md:top-0 md:h-[calc(100vh-64px)] md:overflow-y-auto">
          <Scoreboard
            players={players}
            currentRound={session.current_round}
            totalRounds={session.total_rounds}
            currentStorytellerId={session.current_storyteller_id}
            timerElement={
              !gameCompleted && currentTurn && gamePhase === "storytelling" && session.story_time_seconds ? (
                <GameTimer
                  totalSeconds={session.story_time_seconds}
                  startTime={currentTurn.created_at}
                  label="Story Time"
                  onTimeUp={isStoryteller ? handleStoryTimeUp : undefined}
                />
              ) : !gameCompleted && currentTurn && gamePhase === "guessing" && session.guess_time_seconds ? (
                <GameTimer
                  totalSeconds={session.guess_time_seconds}
                  startTime={currentTurn.completed_at}
                  label="Guess Time"
                  onTimeUp={!isStoryteller ? handleGuessTimeUp : undefined}
                />
              ) : undefined
            }
          />
        </aside>

        {/* Status Indicators - Timer and Connection (desktop only) */}
        <div className="hidden md:flex fixed top-20 right-4 z-50 flex-col gap-2 items-end">
          {/* Game Timer - show during mode selection, storytelling, elements, and guessing phases */}
          {!gameCompleted && currentTurn && gamePhase === "storytelling" && session.story_time_seconds && (
            <GameTimer
              totalSeconds={session.story_time_seconds}
              startTime={currentTurn.created_at}
              label="Story Time"
              onTimeUp={isStoryteller ? handleStoryTimeUp : undefined}
            />
          )}
          {!gameCompleted && currentTurn && gamePhase === "guessing" && session.guess_time_seconds && (
            <GameTimer
              totalSeconds={session.guess_time_seconds}
              startTime={currentTurn.completed_at}
              label="Guess Time"
              onTimeUp={!isStoryteller ? handleGuessTimeUp : undefined}
            />
          )}

          {/* Connection Status */}
          {/* <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
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
          </div> */}
        </div>

        {/* Game Content */}
        <main className="flex-1 p-4">
          {/* Mode Transition Loading Overlay - prevents flicker during mode selection */}
          {isModeTransitioning && (
            <div className="min-h-screen flex items-center justify-center">
              <div className="flex flex-col items-center justify-center py-12 gap-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="text-lg text-muted-foreground">Setting up your turn...</p>
              </div>
            </div>
          )}
          {/* Theme Selection Phase - Storyteller chooses theme */}
          {gamePhase === "selecting_theme" && isStoryteller && (
            <div className="min-h-screen flex items-center justify-center p-4">
              <Card className="w-full max-w-4xl">
                <CardHeader>
                  <CardTitle className="text-center text-2xl">Your Turn to Tell a Story!</CardTitle>
                </CardHeader>
                <CardContent>
                  {isGeneratingWhisp ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-4">
                      <Loader2 className="h-12 w-12 animate-spin text-primary" />
                      <p className="text-lg text-muted-foreground">Generating your secret whisp word...</p>
                    </div>
                  ) : (
                    <ThemeSelectionCards
                      themes={themes.map((t) => ({
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
                      playerName={players.find((p) => p.player_id === currentPlayerId)?.name}
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
                <h2 className="text-2xl font-bold text-foreground mb-2">Waiting for storyteller...</h2>
                <p className="text-muted-foreground">
                  {players.find((p) => p.player_id === session.current_storyteller_id)?.name} is selecting a theme
                </p>
              </div>
            </div>
          )}

          {/* Storytelling Phase - Unified flow */}
          {gamePhase === "storytelling" && isStoryteller && currentTurn && !isModeTransitioning && (
            <UnifiedStorytellingInterface
              theme={currentTurn.theme}
              whisp={currentTurn.whisp || currentWhisp || ""}
              sessionId={sessionId!}
              playerId={currentPlayerId}
              turnId={currentTurn.id}
              onStoryComplete={handleStoryComplete}
              isStoryteller={isStoryteller}
              storytellerName={players.find((p) => p.player_id === session.current_storyteller_id)?.name || "Player"}
              sendWebSocketMessage={sendWebSocketMessage}
              themeElements={themeElementsForSelection}
              coreElements={coreElementsForSelection}
            />
          )}

          {gamePhase === "storytelling" && !isStoryteller && !isModeTransitioning && (
            <div className="w-full flex items-start justify-center px-2 py-2 sm:min-h-screen sm:items-center sm:p-4">
              <div className="max-w-2xl w-full space-y-3 sm:space-y-6">
                <div className="text-center">
                  <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-foreground mb-1 sm:mb-2">
                    {players.find((p) => p.player_id === session.current_storyteller_id)?.name} is creating their story
                  </h2>
                  <p className="text-xs sm:text-sm text-muted-foreground">Get ready to listen and guess the secret wisp!</p>
                  {isReceivingAudio && (
                    <div className="mt-2 sm:mt-4 flex items-center justify-center gap-2 text-xs sm:text-sm text-green-600">
                      <div className="h-2 w-2 sm:h-3 sm:w-3 rounded-full bg-green-600 animate-pulse" />
                      <span className="font-medium">Listening to live recording...</span>
                    </div>
                  )}
                </div>
                <div className="flex justify-center pb-2 sm:pb-0">
                  <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin text-primary" />
                </div>
              </div>
            </div>
          )}

          {/* Guessing Phase - only show if game is NOT completed/announcing */}
          {gamePhase === "guessing" && !isStoryteller && currentTurn && !gameCompleted && !isAnnouncingWinner && (
            <GuessingInterface
              storytellerName={players.find((p) => p.player_id === session.current_storyteller_id)?.name || "Player"}
              theme={currentTurn.theme}
              audioUrl={currentTurn.turn_mode === "audio" ? currentTurn.recording_url || undefined : undefined}
              sessionId={sessionId!}
              roundNumber={session.current_round ?? 1}
              playerId={currentPlayerId}
              onGuessSubmit={handleGuessSubmit}
              selectedIcons={selectedIcons}
              turnMode={currentTurn.turn_mode || "audio"}
              sendWebSocketMessage={sendWebSocketMessage}
              turnId={currentTurn.id}
              onAllPlayersAnswered={(whisp, wasCorrect) => {
                // Skip showing round transition dialog - refresh silently
                console.log("✅ All players answered - refreshing silently (no dialog), wasCorrect:", wasCorrect);
                // Clear transition trigger and refresh
                roundTransitionTriggeredRef.current = null;
                debouncedRefresh({ bypassStoryPause: true, showLoading: false });
              }}
            />
          )}

          {gamePhase === "guessing" && isStoryteller && !gameCompleted && !isAnnouncingWinner && session?.status !== "completed" && session?.status !== "expired" && (
            <div className="w-full flex items-start justify-center px-2 py-2 sm:min-h-screen sm:items-center sm:p-4">
              <div className="text-center max-w-2xl w-full">
                <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-foreground mb-1 sm:mb-2">Players are guessing...</h2>
                <p className="text-xs sm:text-sm text-muted-foreground mb-2 sm:mb-0">Watch the scoreboard to see who gets it right!</p>
                {currentTurn?.whisp && (
                  <p className="mt-2 sm:mt-4 text-sm sm:text-base md:text-lg">
                    Your wisp was: <span className="font-bold text-primary">{currentTurn.whisp}</span>
                  </p>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Round Transition Dialog - Shows final round result before winner announcement - CANNOT BE SKIPPED */}
      <Dialog open={isRoundTransitioning} onOpenChange={() => {}}>
        <DialogContent 
          className="sm:max-w-md" 
          onPointerDownOutside={(e) => e.preventDefault()} 
          onEscapeKeyDown={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          hideCloseButton
        >
          <div className="flex flex-col items-center justify-center py-8 space-y-6">
            <div className={`h-16 w-16 rounded-full flex items-center justify-center ${
              roundResultMessage?.message?.includes('Game Complete') 
                ? 'bg-primary/20' 
                : roundResultMessage?.correct 
                  ? 'bg-green-500/20' 
                  : 'bg-red-500/20'
            }`}>
              <span className="text-3xl">
                {roundResultMessage?.message?.includes('Game Complete') 
                  ? '🎊' 
                  : roundResultMessage?.correct 
                    ? '✅' 
                    : '❌'}
              </span>
            </div>
            <div className="text-center space-y-3">
              <h2 className="text-2xl font-bold text-foreground">
                {roundResultMessage?.message?.includes('Game Complete') 
                  ? 'Game Complete!' 
                  : roundResultMessage?.correct 
                    ? 'Correct!' 
                    : 'Wrong Answer'}
              </h2>
              {roundResultMessage && (
                <p className={`text-lg ${
                  roundResultMessage.message?.includes('Game Complete')
                    ? 'text-primary'
                    : roundResultMessage.correct 
                      ? 'text-green-500' 
                      : 'text-red-500'
                }`}>
                  {roundResultMessage.message}
                </p>
              )}
              <p className="text-sm text-muted-foreground animate-pulse">
                Calculating final results...
              </p>
            </div>
            <div className="flex gap-1">
              <div className="h-2 w-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="h-2 w-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="h-2 w-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Announcing Winner Loading Dialog - CANNOT BE SKIPPED */}
      <Dialog open={isAnnouncingWinner} onOpenChange={() => {}}>
        <DialogContent 
          className="sm:max-w-md" 
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          hideCloseButton
        >
          <div className="flex flex-col items-center justify-center py-8 space-y-6">
            <div className="relative">
              <div className="h-20 w-20 rounded-full bg-primary/20 flex items-center justify-center animate-pulse">
                <Trophy className="h-10 w-10 text-primary animate-bounce" />
              </div>
              <div className="absolute inset-0 h-20 w-20 rounded-full border-4 border-primary/30 animate-ping" />
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold text-foreground">Game Complete!</h2>
              <p className="text-lg text-muted-foreground animate-pulse">Announcing winner...</p>
            </div>
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        </DialogContent>
      </Dialog>

      {/* Game Completed Winner Dialog - CANNOT BE SKIPPED */}
      <Dialog open={gameCompleted} onOpenChange={() => {}}>
        <DialogContent 
          className="sm:max-w-md" 
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          hideCloseButton
        >
          <DialogHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Trophy className="h-8 w-8 text-primary" />
            </div>
            <DialogTitle className="text-2xl text-center">Game Over! 🎊</DialogTitle>
            <DialogDescription className="text-center space-y-4">
              {isTieGame ? (
                <div className="space-y-2 pt-4">
                  <p className="text-lg font-semibold text-foreground">🤝 It's a Tie!</p>
                  <p className="text-muted-foreground">
                    {(() => {
                      const sortedPlayers = [...players].sort((a, b) => (b.score || 0) - (a.score || 0));
                      const highestScore = sortedPlayers[0]?.score || 0;
                      const tiedPlayers = sortedPlayers.filter(p => (p.score || 0) === highestScore);
                      return `${tiedPlayers.map(p => p.name).join(" & ")} tied with ${highestScore} points!`;
                    })()}
                  </p>
                </div>
              ) : gameWinner ? (
                <div className="space-y-2 pt-4">
                  <p className="text-lg font-semibold text-foreground">🏆 {gameWinner.name} wins!</p>
                  <p className="text-muted-foreground">Final Score: {gameWinner.score || 0} points</p>
                </div>
              ) : (
                <p>Thanks for playing!</p>
              )}

              {/* Final Standings */}
              <div className="mt-6 space-y-2 text-left">
                <p className="text-sm font-medium text-foreground">Final Standings:</p>
                {(() => {
                  const sortedPlayers = [...players].sort((a, b) => (b.score || 0) - (a.score || 0));
                  const highestScore = sortedPlayers[0]?.score || 0;
                  return sortedPlayers.map((player, index) => {
                    const isTied = isTieGame && (player.score || 0) === highestScore;
                    return (
                      <div key={player.id} className="flex items-center justify-between py-2 px-3 rounded bg-muted/50">
                        <span className="flex items-center gap-2">
                          <span className="text-sm font-medium">{index + 1}.</span>
                          <span>{player.name}</span>
                          {isTied && <span>🤝</span>}
                          {!isTieGame && index === 0 && <span>👑</span>}
                        </span>
                        <div className="flex flex-col items-end">
                          <span className="font-semibold">{player.score || 0} pts</span>
                          {lifetimePoints[player.player_id] !== undefined && (
                            <span className="text-xs text-muted-foreground">
                              Total: {lifetimePoints[player.player_id]} pts
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center pt-4">
            <Button onClick={() => navigate("/play/host")} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
