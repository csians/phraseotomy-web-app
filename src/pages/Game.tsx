import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Scoreboard } from "@/components/Scoreboard";
import { ThemeSelection } from "@/components/ThemeSelection";
import { StorytellingInterface } from "@/components/StorytellingInterface";
import { GuessingInterface } from "@/components/GuessingInterface";

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
          console.log('Game session updated:', payload);
          // Refresh game state when session changes (theme, round, etc.)
          initializeGame();
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
          console.log('Game turn updated:', payload);
          // Refresh when turn is created or updated (elements, recording, etc.)
          initializeGame();
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
          console.log('Player score updated:', payload);
          // Refresh when player scores change
          initializeGame();
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
          console.log('New guess submitted:', payload);
          // Show notification when someone guesses
          toast({
            title: "Player Guessed!",
            description: "A player has submitted their guess",
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleThemeSelect = async (themeId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("start-turn", {
        body: { sessionId, themeId },
      });

      if (error) throw error;

      toast({
        title: "Theme Selected!",
        description: "Now tell your story using the elements.",
      });

      await initializeGame();
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

        {gamePhase === "storytelling" && currentTurn && (
          <StorytellingInterface
            theme={currentTurn.theme}
            elements={selectedElements}
            sessionId={sessionId!}
            playerId={currentPlayerId}
            turnId={currentTurn.id}
            onStoryComplete={handleStoryComplete}
            isStoryteller={isStoryteller}
            storytellerName={players.find((p) => p.player_id === session.current_storyteller_id)?.name || "Player"}
          />
        )}

        {gamePhase === "guessing" && !isStoryteller && currentTurn?.recording_url && (
          <GuessingInterface
            storytellerName={players.find((p) => p.player_id === session.current_storyteller_id)?.name || "Player"}
            theme={currentTurn.theme}
            audioUrl={currentTurn.recording_url}
            availableElements={themeElements}
            correctElements={currentTurn.selected_elements}
            turnId={currentTurn.id}
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
