import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Music,
  Users,
  XCircle,
  Briefcase,
  Home,
  Plane,
  Bike,
  Wine,
  Rocket,
  Skull,
  Sparkles,
  Wifi,
  WifiOff,
  Trophy,
  PartyPopper,
  Eye,
  Shuffle,
  GripVertical,
  UserMinus,
  Loader2,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { LobbyAudioRecording } from "@/components/LobbyAudioRecording";
import { getAllUrlParams } from "@/lib/urlUtils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ThemeElements } from "@/components/ThemeElements";
import Header from "@/components/Header";
import { ElementsInterface } from "@/components/ElementsInterface";
import { IconItem } from "@/components/IconSelectionPanel";
import { TurnModeSelection } from "@/components/TurnModeSelection";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Player {
  id: string;
  name: string;
  player_id: string;
  session_id: string;
  turn_order: number;
  score?: number;
}

// Sortable Player Item Component
function SortablePlayerItem({
  player,
  isHost,
  currentStorytellerId,
  hostCustomerId,
  isDraggable,
  onKick,
  isKicking,
  sessionStatus,
  currentUserId,
}: {
  player: Player;
  isHost: boolean;
  currentStorytellerId: string | undefined;
  hostCustomerId: string;
  isDraggable: boolean;
  onKick?: (playerId: string, playerName: string) => void;
  isKicking?: boolean;
  sessionStatus?: string;
  currentUserId?: string | null;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: player.id,
    disabled: !isDraggable,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isPlayerHost = player.player_id === hostCustomerId;
  const isCurrentUser = currentUserId && player.player_id === currentUserId;
  const canKick = isHost && !isPlayerHost && !isCurrentUser && sessionStatus === "waiting";

  return (
    <li ref={setNodeRef} style={style} className={`flex items-center justify-between p-2 rounded-md ${isCurrentUser ? 'bg-primary/10 border border-primary/20' : 'bg-muted/50'}`}>
      <div className="flex items-center gap-2">
        {isDraggable && (
          <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
        <span className="font-medium">{player.name}</span>
        {isCurrentUser && (
          <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded font-semibold">You</span>
        )}
        {isPlayerHost && (
          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">Host</span>
        )}
        {player.player_id === currentStorytellerId && (
          <span className="text-xs bg-yellow-500/20 text-yellow-500 px-2 py-0.5 rounded">Storyteller</span>
        )}
      </div>
      <div className="flex items-center gap-4">
        <span className="text-lg font-bold text-primary">{player.score ?? 0} pts</span>
        <span className="text-sm text-muted-foreground">Turn {player.turn_order}</span>
        {canKick && onKick && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => onKick(player.player_id, player.name)}
            disabled={isKicking}
          >
            {isKicking ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UserMinus className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>
    </li>
  );
}

interface AudioFile {
  id: string;
  filename: string;
  audio_url: string;
  created_at: string;
  customer_id: string;
}

interface GameSession {
  id: string;
  lobby_code: string;
  game_name: string | null;
  host_customer_id: string;
  host_customer_name: string;
  status: string;
  packs_used: string[];
  selected_audio_id: string | null;
  selected_theme_id: string | null;
  started_at: string | null;
  shop_domain: string;
  tenant_id: string;
  current_round?: number;
  current_storyteller_id?: string;
  total_rounds?: number;
}

interface Theme {
  id: string;
  name: string;
  icon: string;
}

export default function Lobby() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [session, setSession] = useState<GameSession | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [audioFiles, setAudioFiles] = useState<AudioFile[]>([]);
  const [selectedAudio, setSelectedAudio] = useState<string>("");
  const [themes, setThemes] = useState<Theme[]>([]);
  const [selectedTheme, setSelectedTheme] = useState<string>("");
  const [selectedElementId, setSelectedElementId] = useState<string>("");
  const [hasRecording, setHasRecording] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isEndingLobby, setIsEndingLobby] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isGameStarted, setIsGameStarted] = useState(false);
  const [currentTurn, setCurrentTurn] = useState<any>(null);
  const [guessInput, setGuessInput] = useState("");
  const [isSubmittingGuess, setIsSubmittingGuess] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [showCountdown, setShowCountdown] = useState(false);
  const [countdownNumber, setCountdownNumber] = useState(3);
  const [isLockedOut, setIsLockedOut] = useState(false);
  const [playerAnswers, setPlayerAnswers] = useState<
    Array<{
      playerId: string;
      playerName: string;
      guess: string;
      isCorrect: boolean;
    }>
  >([]);
  const [showResults, setShowResults] = useState(false);
  const [packNames, setPackNames] = useState<string[]>([]);
  const [isKickingPlayer, setIsKickingPlayer] = useState(false);
  const [joiningPlayerName, setJoiningPlayerName] = useState<string | null>(null);
  const [turnElements, setTurnElements] = useState<IconItem[]>([]);
  const [isSelectingMode, setIsSelectingMode] = useState(false);

  // Reset lockout state when round changes
  useEffect(() => {
    if (session?.current_round) {
      setIsLockedOut(false);
      setGuessInput("");
      setPlayerAnswers([]);
      setShowResults(false);
    }
  }, [session?.current_round]);

  // Handle guest data from URL params on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const guestDataStr = urlParams.get("guestData");
    const guestSession = urlParams.get("guestSession");

    if (guestDataStr) {
      try {
        const guestData = JSON.parse(guestDataStr);
        sessionStorage.setItem("guest_player_id", guestData.player_id);
        sessionStorage.setItem("guestPlayerData", JSON.stringify(guestData));
        localStorage.setItem("guest_player_id", guestData.player_id);
        localStorage.setItem("guestPlayerData", JSON.stringify(guestData));

        if (guestSession) {
          sessionStorage.setItem("current_lobby_session", guestSession);
        }

        const cleanUrl = window.location.origin + window.location.pathname + window.location.hash;
        window.history.replaceState({}, "", cleanUrl);
      } catch (e) {
        console.error("Error parsing guest data:", e);
      }
    } else {
      const storedGuestIdSession = sessionStorage.getItem("guest_player_id");
      const storedGuestIdLocal = localStorage.getItem("guest_player_id");

      if (storedGuestIdSession && !storedGuestIdLocal) {
        localStorage.setItem("guest_player_id", storedGuestIdSession);
      } else if (storedGuestIdLocal && !storedGuestIdSession) {
        sessionStorage.setItem("guest_player_id", storedGuestIdLocal);
      }
    }
  }, []);

  // Get current customer ID helper
  const getCurrentCustomerId = useCallback(() => {
    const urlParams = getAllUrlParams();
    const urlCustomerId = urlParams.get("customer_id");
    if (urlCustomerId) return urlCustomerId;

    const lobbyPlayerId = sessionStorage.getItem("lobby_player_id") || localStorage.getItem("lobby_player_id");
    if (lobbyPlayerId) return lobbyPlayerId;

    const storageKeys = ["customerData", "phraseotomy_customer_data", "customer_data"];
    for (const key of storageKeys) {
      let dataStr = sessionStorage.getItem(key) || localStorage.getItem(key);
      if (dataStr) {
        try {
          const parsed = JSON.parse(dataStr);
          const customerId = parsed.customer_id || parsed.id || parsed.customerId;
          if (customerId) return String(customerId);
        } catch (e) {
          console.error(`Error parsing ${key}:`, e);
        }
      }
    }

    const guestPlayerIdSession = sessionStorage.getItem("guest_player_id");
    const guestPlayerIdLocal = localStorage.getItem("guest_player_id");
    const guestPlayerId = guestPlayerIdSession || guestPlayerIdLocal;

    if (guestPlayerId) {
      if (!guestPlayerIdSession) sessionStorage.setItem("guest_player_id", guestPlayerId);
      if (!guestPlayerIdLocal) localStorage.setItem("guest_player_id", guestPlayerId);
      return guestPlayerId;
    }

    const guestDataStr = sessionStorage.getItem("guestPlayerData") || localStorage.getItem("guestPlayerData");
    if (guestDataStr) {
      try {
        const guestData = JSON.parse(guestDataStr);
        if (guestData.player_id) {
          sessionStorage.setItem("guest_player_id", guestData.player_id);
          localStorage.setItem("guest_player_id", guestData.player_id);
          return guestData.player_id;
        }
      } catch (e) {
        console.error("Error parsing guestPlayerData:", e);
      }
    }

    return null;
  }, []);

  // Get current player name
  const getCurrentPlayerName = useCallback(() => {
    const storageKeys = ["customerData", "phraseotomy_customer_data", "customer_data"];
    for (const key of storageKeys) {
      let dataStr = sessionStorage.getItem(key) || localStorage.getItem(key);
      if (dataStr) {
        try {
          const parsed = JSON.parse(dataStr);
          if (parsed.name) return parsed.name;
          if (parsed.first_name) return parsed.first_name;
        } catch (e) {}
      }
    }
    return localStorage.getItem("guest_player_name") || "Player";
  }, []);

  const currentPlayerId = getCurrentCustomerId();
  const currentPlayerName = getCurrentPlayerName();

  // Broadcast channel ref for sending messages
  const broadcastChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Function to broadcast events to all players in the lobby
  const broadcastEvent = useCallback(
    (event: string, payload: any) => {
      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.send({
          type: "broadcast",
          event,
          payload: {
            ...payload,
            senderId: currentPlayerId,
            senderName: currentPlayerName,
            timestamp: new Date().toISOString(),
          },
        });
      }
    },
    [currentPlayerId, currentPlayerName],
  );

  // Shuffle turn order
  const handleShuffleTurns = async () => {
    if (!sessionId || !isHost) return;

    const shuffledPlayers = [...players];
    // Fisher-Yates shuffle
    for (let i = shuffledPlayers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledPlayers[i], shuffledPlayers[j]] = [shuffledPlayers[j], shuffledPlayers[i]];
    }

    // Call edge function to update turn order with service role permissions
    const updatePayload = shuffledPlayers.map((player, idx) => ({
      playerId: player.player_id,
      turnOrder: idx + 1,
    }));

    try {
      const { error } = await supabase.functions.invoke("update-turn-order", {
        body: { sessionId, updates: updatePayload },
      });

      if (error) throw error;

      // Update local state
      setPlayers(shuffledPlayers.map((p, idx) => ({ ...p, turn_order: idx + 1 })));

      // Broadcast immediately (database changes will also trigger listeners)
      broadcastEvent("turn_order_changed", { shuffled: true, timestamp: Date.now() });

      toast({
        title: "Turn Order Shuffled",
        description: "Players have been randomly reordered",
      });
    } catch (error) {
      console.error("Error shuffling turns:", error);
      toast({
        title: "Error",
        description: "Failed to shuffle turn order",
        variant: "destructive",
      });
    }
  };

  // Handle drag end for reordering
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = players.findIndex((p) => p.id === active.id);
    const newIndex = players.findIndex((p) => p.id === over.id);

    const reorderedPlayers = arrayMove(players, oldIndex, newIndex);

    try {
      // Call edge function to update turn order with service role permissions
      const updatePayload = reorderedPlayers.map((player, idx) => ({
        playerId: player.player_id,
        turnOrder: idx + 1,
      }));

      const { error } = await supabase.functions.invoke("update-turn-order", {
        body: { sessionId, updates: updatePayload },
      });

      if (error) throw error;

      // Update local state
      setPlayers(reorderedPlayers.map((p, idx) => ({ ...p, turn_order: idx + 1 })));

      // Broadcast immediately (database changes will also trigger listeners)
      broadcastEvent("turn_order_changed", { dragged: true, timestamp: Date.now() });

      toast({
        title: "Turn Order Updated",
        description: "Players have been reordered",
      });
    } catch (error) {
      console.error("Error updating turn order:", error);
      toast({
        title: "Error",
        description: "Failed to update turn order",
        variant: "destructive",
      });
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  useEffect(() => {
    if (!sessionId) {
      setLoading(false);
      return;
    }

    // Store sessionId in both storage types to persist across refreshes and browser restarts
    sessionStorage.setItem("current_lobby_session", sessionId);
    localStorage.setItem("current_lobby_session", sessionId);
    fetchLobbyData();

    // Set up real-time subscription for lobby updates using Supabase Realtime Broadcast
    const channel = supabase
      .channel(`lobby-broadcast-${sessionId}`, {
        config: {
          broadcast: { self: false }, // Don't receive own broadcasts
        },
      })
      // Listen for broadcast events (player joins, game events, etc.)
      .on("broadcast", { event: "player_joining" }, (payload) => {
        const joiningName = payload.payload?.playerName || "A player";
        setJoiningPlayerName(joiningName);
        toast({
          title: "Player Joining...",
          description: `${joiningName} is joining the lobby`,
        });
      })
      .on("broadcast", { event: "player_joined" }, (payload) => {
        setJoiningPlayerName(null);
        toast({
          title: "Player Joined! 🎮",
          description: `${payload.payload?.senderName || "A player"} joined the lobby`,
        });
        fetchLobbyData();
      })
      .on("broadcast", { event: "player_left" }, (payload) => {
        const leftPlayerId = payload.payload?.playerId;
        const leftPlayerName = payload.payload?.senderName || "A player";
        
        if (leftPlayerId) {
          setPlayers((prev) => prev.filter((p) => p.player_id !== leftPlayerId));
        }
        
        toast({
          title: "Player Left",
          description: `${leftPlayerName} left the lobby`,
        });
        
        fetchLobbyData();
      })
      .on("broadcast", { event: "player_kicked" }, (payload) => {
        const kickedPlayerId = payload.payload?.playerId;
        const kickedPlayerName = payload.payload?.playerName || "A player";
        const currentId = getCurrentCustomerId();
        
        if (kickedPlayerId === currentId) {
          toast({
            title: "You were kicked",
            description: "The host removed you from the lobby",
            variant: "destructive",
          });
          sessionStorage.removeItem("current_lobby_session");
          localStorage.removeItem("current_lobby_session");
          localStorage.removeItem("guest_player_id");
          localStorage.removeItem("guestPlayerData");
          localStorage.removeItem("lobby_player_id");
          sessionStorage.removeItem("guest_player_id");
          sessionStorage.removeItem("guestPlayerData");
          sessionStorage.removeItem("lobby_player_id");
          navigate("/guest-join", { replace: true });
          return;
        }
        
        if (kickedPlayerId) {
          setPlayers((prev) => prev.filter((p) => p.player_id !== kickedPlayerId));
        }
        
        toast({
          title: "Player Kicked",
          description: `${kickedPlayerName} was removed from the lobby`,
        });
        
        fetchLobbyData();
      })
      .on("broadcast", { event: "game_started" }, (payload) => {
        toast({
          title: "Game Started! 🎮",
          description: `${payload.payload?.senderName || "Host"} started the game`,
        });
        setIsGameStarted(true);
        setShowCountdown(true);
        setCountdownNumber(3);
        setTimeout(() => setCountdownNumber(2), 1000);
        setTimeout(() => setCountdownNumber(1), 2000);
        setTimeout(() => {
          setShowCountdown(false);
          // Navigate to game page after countdown (for all players)
          navigate(`/game/${sessionId}`);
        }, 3000);
      })
      .on("broadcast", { event: "lobby_ended" }, (payload) => {
        toast({
          title: "Lobby Ended",
          description: "The host has ended this lobby",
        });
        navigate("/login");
      })
      .on("broadcast", { event: "theme_selected" }, (payload) => {
        toast({
          title: "Theme Selected",
          description: `${payload.payload?.senderName || "Host"} chose a theme`,
        });
        if (payload.payload?.themeId) {
          setSelectedTheme(payload.payload.themeId);
        }
        fetchLobbyData();
      })
      .on("broadcast", { event: "secret_selected" }, (payload) => {
        toast({
          title: "Secret Element Selected",
          description: `${payload.payload?.senderName || "Storyteller"} has selected their secret element`,
        });
        fetchLobbyData();
      })
      .on("broadcast", { event: "recording_uploaded" }, (payload) => {
        toast({
          title: "Audio Ready! 🎤",
          description: "Listen to the clue and guess the secret element",
        });
        setHasRecording(true);
        fetchLobbyData();
      })
      .on("broadcast", { event: "guess_submitted" }, (payload) => {
        if (payload.payload?.isCorrect) {
          toast({
            title: "Correct Answer! 🎉",
            description: `${payload.payload?.senderName || "A player"} guessed correctly!`,
          });
        }
        fetchLobbyData();
      })
      .on("broadcast", { event: "player_answered" }, (payload) => {
        const { playerId, playerName, guess, isCorrect } = payload.payload;
        setPlayerAnswers((prev) => {
          const exists = prev.find((a) => a.playerId === playerId);
          if (exists) return prev;
          return [...prev, { playerId, playerName, guess, isCorrect }];
        });
      })
      .on("broadcast", { event: "all_answers_received" }, (payload) => {
        const { secretElement, allAnswers } = payload.payload;
        setCurrentTurn((prev) => ({
          ...prev,
          secret_element: secretElement,
        }));
        if (allAnswers && allAnswers.length > 0) {
          setPlayerAnswers(allAnswers);
        }
        setShowResults(true);
        toast({
          title: "Round Complete!",
          description: "All players have answered. See results below.",
        });
      })
      .on("broadcast", { event: "refresh_state" }, (payload) => {
        setGuessInput("");
        setPlayerAnswers([]);
        setShowResults(false);
        setIsLockedOut(false);
        setSelectedTheme("");
        setSelectedElementId("");
        setHasRecording(false);
        fetchLobbyData();
      })
      .on("broadcast", { event: "turn_order_changed" }, async (payload) => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        await fetchLobbyData();
        toast({
          title: "Turn Order Updated",
          description: "The host has reordered the players",
        });
      })
      // Listen for game_players changes (turn order updates)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "game_players",
          filter: `session_id=eq.${sessionId}`,
        },
        async (payload) => {
          if (payload.new && "turn_order" in payload.new) {
            await fetchLobbyData();
            if (!isHost) {
              toast({
                title: "Turn Order Updated",
                description: "The host has reordered the players",
              });
            }
          }
        },
      )
      // Listen for game_players DELETE (player left)
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "game_players",
          filter: `session_id=eq.${sessionId}`,
        },
        async (payload) => {
          const deletedPlayer = payload.old as { name?: string; player_id?: string };
          toast({
            title: "Player Left",
            description: `${deletedPlayer?.name || "A player"} has left the game`,
          });
          await fetchLobbyData();
        },
      )
      // Listen for game_players INSERT (player joined)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "game_players",
          filter: `session_id=eq.${sessionId}`,
        },
        async (payload) => {
          const newPlayer = payload.new as { name?: string };
          toast({
            title: "Player Joined! 🎮",
            description: `${newPlayer?.name || "A player"} joined the lobby`,
          });
          await fetchLobbyData();
        },
      )
      // Listen for game_sessions changes
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "game_sessions",
          filter: `id=eq.${sessionId}`,
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            toast({
              title: "Lobby Ended",
              description: "The host has ended this lobby",
            });
            navigate("/login");
            return;
          }

          if (payload.eventType === "UPDATE") {
            const updatedSession = payload.new as GameSession;
            setSession(updatedSession);

            if (updatedSession.selected_theme_id) {
              setSelectedTheme(updatedSession.selected_theme_id);
            }

            if (updatedSession.selected_audio_id) {
              setSelectedAudio(updatedSession.selected_audio_id);
            }

            if (updatedSession.status === "active" && !isGameStarted) {
              setIsGameStarted(true);
              // Redirect to game page immediately when status becomes active
              navigate(`/game/${sessionId}`, { replace: true });
            }
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "game_players",
        },
        (payload) => {
          const newPlayer = payload.new as Player;
          if (newPlayer.session_id === sessionId) {
            setPlayers((prev) => {
              const exists = prev.some((p) => p.id === newPlayer.id || p.player_id === newPlayer.player_id);
              if (exists) return prev;
              return [...prev, newPlayer];
            });
            toast({
              title: "Player Joined",
              description: `${newPlayer.name} joined the lobby`,
            });
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "game_players",
        },
        (payload) => {
          const leftPlayer = payload.old as Player;
          if (leftPlayer.session_id === sessionId) {
            setPlayers((prev) => prev.filter((p) => p.id !== leftPlayer.id));
            toast({
              title: "Player Left",
              description: `${leftPlayer.name} left the lobby`,
            });
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "customer_audio",
        },
        async (payload) => {
          const currentCustomerId = getCurrentCustomerId();
          if (currentCustomerId && (payload.eventType === "INSERT" || payload.eventType === "DELETE")) {
            await fetchCustomerAudio(currentCustomerId);
            toast({
              title: "Audio Updated",
              description: payload.eventType === "INSERT" ? "New audio file uploaded" : "Audio file removed",
            });
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
          if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            fetchLobbyData();
          }
        },
      );

    // Store channel ref for broadcasting immediately (before subscribe completes)
    broadcastChannelRef.current = channel;

    channel.subscribe((status, err) => {
      if (err) {
        console.error("Realtime subscription error:", err);
        setIsConnected(false);
      }
      if (status === "SUBSCRIBED") {
        setIsConnected(true);
        setTimeout(() => {
          channel.send({
            type: "broadcast",
            event: "player_joined",
            payload: {
              senderId: currentPlayerId,
              senderName: currentPlayerName,
              timestamp: new Date().toISOString(),
            },
          });
        }, 500);
      }
      if (status === "CHANNEL_ERROR") {
        console.error("Realtime channel error");
        setIsConnected(false);
      }
      if (status === "TIMED_OUT") {
        console.error("Realtime subscription timed out");
        setIsConnected(false);
      }
    });

    return () => {
      setIsConnected(false);
      supabase.removeChannel(channel);
    };
  }, [sessionId, navigate, toast, currentPlayerId, currentPlayerName]);

  // getCurrentCustomerId is already defined above as a useCallback

  const fetchCustomerAudio = async (customerId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("get-customer-audio", {
        body: { customerId: customerId.toString() },
      });

      if (error) {
        console.error("Error fetching customer audio:", error);
        return;
      }

      setAudioFiles(data?.audioFiles || []);
    } catch (error) {
      console.error("Error in fetchCustomerAudio:", error);
    }
  };

  const fetchLobbyData = async () => {
    try {
      setLoading(true);

      const currentCustomerId = getCurrentCustomerId();
      const guestPlayerId = localStorage.getItem("guest_player_id");
      const currentPlayerId = currentCustomerId || guestPlayerId;

      const { data, error } = await supabase.functions.invoke("get-lobby-data", {
        body: { sessionId, customerId: currentCustomerId },
      });

      if (error) {
        console.error("Lobby data fetch error:", error);
        throw error;
      }

      if (!data?.session) {
        console.error("Session not found in response");
        toast({
          title: "Session not found",
          description: "This game session doesn't exist or you don't have access to it",
          variant: "destructive",
        });
        // Don't navigate away - stay on lobby page to show error
        setLoading(false);
        return;
      }

      // If the game is already active, redirect to the Game page immediately
      // This handles page refresh during active game
      if (data.session.status === "active") {
        console.log("Game is already active, redirecting to game page...");
        navigate(`/game/${sessionId}`, { replace: true });
        return;
      }

      // For page refreshes, we don't need to re-validate player membership
      // The real-time subscriptions will handle session updates

      setSession(data.session);
      setPlayers(data.players || []);

      // Store the current player's ID for refresh recovery
      if (currentPlayerId) {
        sessionStorage.setItem("lobby_player_id", currentPlayerId);
        localStorage.setItem("lobby_player_id", currentPlayerId);
      }

      // Set audio files from the response (edge function fetches them if user is host)
      setAudioFiles(data.audioFiles || []);

      // Fetch pack names if packs_used has IDs
      if (data.session?.packs_used && data.session.packs_used.length > 0) {
        const { data: packsData, error: packsError } = await supabase
          .from("packs")
          .select("name")
          .in("id", data.session.packs_used);

        if (!packsError && packsData) {
          setPackNames(packsData.map((p) => p.name));
        } else {
          console.error("Error fetching pack names:", packsError);
          setPackNames([]);
        }
      } else {
        setPackNames([]);
      }

      // Check if there's already a turn with secret element and recording from currentTurn data
      if (data.currentTurn) {
        setCurrentTurn(data.currentTurn);

        // Only set theme/element/recording if they exist in the CURRENT turn
        // This prevents showing previous round's data
        if (data.currentTurn.theme_id) {
          setSelectedTheme(data.currentTurn.theme_id);
        } else {
          // New round - clear theme selection
          setSelectedTheme("");
        }

        if (data.currentTurn.secret_element) {
          setSelectedElementId(data.currentTurn.secret_element);
        } else {
          setSelectedElementId("");
        }

        if (data.currentTurn.recording_url) {
          setHasRecording(true);
        } else {
          setHasRecording(false);
        }

        // Fetch elements for turn_mode === "elements"
        if (data.currentTurn?.turn_mode === "elements" && data.currentTurn?.selected_icon_ids?.length > 0) {
          const { data: elementsData } = await supabase
            .from("elements")
            .select("id, name, icon, theme_id")
            .in("id", data.currentTurn.selected_icon_ids);
          
          if (elementsData) {
            // Get the theme_id for this turn to determine which are core icons
            const turnThemeId = data.currentTurn.theme_id;
            const orderedElements = data.currentTurn.selected_icon_ids.map((iconId: string, index: number) => {
              const element = elementsData.find((e) => e.id === iconId);
              return {
                id: iconId,
                name: element?.name || "",
                icon: element?.icon || "sparkles",
                isFromCore: element?.theme_id !== turnThemeId,
              };
            });
            setTurnElements(orderedElements);
          }
        }
      } else {
        // No current turn data - reset everything
        setSelectedTheme("");
        setSelectedElementId("");
        setHasRecording(false);
        setTurnElements([]);
      }

      // Fetch themes
      const { data: themesData, error: themesError } = await supabase.from("themes").select("*").order("name");

      if (!themesError && themesData) {
        setThemes(themesData);
      }
    } catch (errors: any) {
      console.error("Error fetching lobby data:", errors);
      const errorMessage = errors?.message || "Failed to load lobby details";

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
      // Don't navigate away on error - stay on lobby page
    } finally {
      setLoading(false);
    }
  };

  const handleStartGame = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("start-game", {
        body: {
          sessionId,
        },
      });

      if (error) {
        console.error("Error starting game:", error);
        toast({
          title: "Error",
          description: `Failed to start the game: ${error.message}`,
          variant: "destructive",
        });
        return;
      }

      // Broadcast game_started to all players via Supabase Broadcast
      broadcastEvent("game_started", {});

      // Show countdown animation
      setShowCountdown(true);
      setCountdownNumber(3);

      // Countdown sequence
      setTimeout(() => setCountdownNumber(2), 1000);
      setTimeout(() => setCountdownNumber(1), 2000);
      setTimeout(() => {
        setShowCountdown(false);
        // Navigate to game page after countdown
        navigate(`/game/${sessionId}`);
      }, 3000);

      toast({
        title: "Game Started!",
        description: "Get ready to play!",
      });
    } catch (error) {
      console.error("Error in handleStartGame:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred.",
        variant: "destructive",
      });
    }
  };

  // Handle mode selection (audio vs elements)
  const handleModeSelect = async (mode: "audio" | "elements") => {
    if (!sessionId || !session?.selected_theme_id) {
      toast({
        title: "Error",
        description: "No theme selected for this session.",
        variant: "destructive",
      });
      return;
    }

    setIsSelectingMode(true);

    try {
      const turnId = currentTurn?.id;
      
      console.log("Starting turn with mode:", mode, "themeId:", session.selected_theme_id, "turnId:", turnId);
      
      // Call start-turn with the session's theme and selected mode
      const { data, error } = await supabase.functions.invoke("start-turn", {
        body: { 
          sessionId, 
          turnId,
          selectedThemeId: session.selected_theme_id,
          turnMode: mode,
        },
      });

      if (error) throw error;

      console.log("Start-turn response:", data);

      // Wait for DB to commit
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Update local state immediately
      setCurrentTurn(data.turn);
      if (mode === "elements" && data.selectedIcons) {
        setTurnElements(data.selectedIcons);
      }
      
      // Broadcast mode selected to other players
      broadcastEvent("mode_selected", { mode, whisp: data.whisp });

      toast({
        title: "Wisp Generated!",
        description: `Your word is: "${data.whisp}"`,
      });

      // Fetch updated data
      await fetchLobbyData();
    } catch (error) {
      console.error("Error selecting mode:", error);
      toast({
        title: "Error",
        description: "Failed to start turn. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSelectingMode(false);
    }
  };
  const handleEndLobby = async () => {
    const customerId = getCurrentCustomerId();
    if (!session || !customerId) {
      return;
    }

    setIsEndingLobby(true);

    try {
      // Broadcast lobby_ended to all players via Supabase Broadcast BEFORE deleting
      // Broadcast to both lobby and game channels to cover all players
      broadcastEvent("lobby_ended", {});
      
      // Also broadcast to game channel for players who are on the game page
      const gameChannel = supabase.channel(`game-${sessionId}`);
      await gameChannel.send({
        type: "broadcast",
        event: "lobby_ended",
        payload: { sessionId, timestamp: new Date().toISOString() },
      });
      supabase.removeChannel(gameChannel);

      const { data, error } = await supabase.functions.invoke("end-lobby", {
        body: {
          sessionId,
          hostCustomerId: customerId,
        },
      });

      if (error) {
        console.error("Error ending lobby:", error);
        toast({
          title: "Error",
          description: "Failed to end the lobby. Please try again.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Lobby Ended",
        description: "The lobby has been closed and deleted.",
      });

      // Navigate back to play page
      navigate("/play/host");
    } catch (error) {
      console.error("Error in handleEndLobby:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsEndingLobby(false);
    }
  };

  const handleLeaveGame = async () => {
    const playerId = getCurrentCustomerId();
    if (!sessionId || !playerId) {
      toast({
        title: "Error",
        description: "Unable to leave game - missing session or player information",
        variant: "destructive",
      });
      return;
    }

    // Get the player name for the broadcast
    const currentPlayer = players.find(p => p.player_id === playerId);
    const playerNameToSend = currentPlayer?.name || currentPlayerName || "A player";

    try {
      // First delete from database
      const { data, error } = await supabase.functions.invoke("leave-lobby", {
        body: { sessionId, playerId },
      });
      
      // Broadcast AFTER successful deletion so other players see updated data
      broadcastEvent("player_left", { playerId, senderName: playerNameToSend, timestamp: Date.now() });
      
      // Also broadcast to game channel for players on game page
      const gameChannel = supabase.channel(`game-${sessionId}`);
      await gameChannel.send({
        type: "broadcast",
        event: "player_left",
        payload: { playerId, senderName: playerNameToSend, timestamp: Date.now() },
      });
      supabase.removeChannel(gameChannel);

      if (error) {
        console.error("Error leaving lobby:", error);
        toast({
          title: "Error",
          description: error.message || "Failed to leave the lobby",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Left Game",
        description: "You have successfully left the game.",
      });

      // Wait a moment for the broadcast and realtime events to propagate
      await new Promise(resolve => setTimeout(resolve, 300));

      // Clear session storage
      sessionStorage.removeItem("current_lobby_session");
      localStorage.removeItem("current_lobby_session");
      sessionStorage.removeItem("lobby_player_id");
      localStorage.removeItem("lobby_player_id");
      
      // Check if this is a guest player and clear their data
      const guestPlayerId = localStorage.getItem("guest_player_id");
      const isGuest = guestPlayerId === playerId;
      
      if (isGuest) {
        // Clear guest-specific data
        localStorage.removeItem("guest_player_id");
        localStorage.removeItem("guestPlayerData");
        sessionStorage.removeItem("guest_player_id");
        sessionStorage.removeItem("guestPlayerData");
        // Navigate to guest join page
        navigate("/guest-join", { replace: true });
      } else {
        // Authenticated user - go to their play page
        navigate("/play/host", { replace: true });
      }
    } catch (error) {
      console.error("Error in handleLeaveGame:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred.",
        variant: "destructive",
      });
    }
  };

  // Handler for "Join Another Game" - leaves current game and goes to join page
  const handleJoinAnotherGame = async () => {
    const playerId = getCurrentCustomerId();
    if (!sessionId || !playerId) {
      navigate("/guest-join");
      return;
    }

    try {
      const currentPlayer = players.find(p => p.player_id === playerId);
      const playerNameToSend = currentPlayer?.name || currentPlayerName || "A player";

      // First delete from database
      const { error } = await supabase.functions.invoke("leave-lobby", {
        body: { sessionId, playerId },
      });

      if (error) {
        console.error("Error leaving lobby:", error);
      }
      
      // Broadcast AFTER deletion so other players see updated data
      broadcastEvent("player_left", { playerId, senderName: playerNameToSend, timestamp: Date.now() });
      
      // Also broadcast to game channel for players on game page
      const gameChannel = supabase.channel(`game-${sessionId}`);
      await gameChannel.send({
        type: "broadcast",
        event: "player_left",
        payload: { playerId, senderName: playerNameToSend, timestamp: Date.now() },
      });
      supabase.removeChannel(gameChannel);

      // Clear session storage
      sessionStorage.removeItem("current_lobby_session");
      localStorage.removeItem("current_lobby_session");
      sessionStorage.removeItem("lobby_player_id");
      localStorage.removeItem("lobby_player_id");
      
      // Clear guest data if applicable
      const guestPlayerId = localStorage.getItem("guest_player_id");
      if (guestPlayerId === playerId) {
        localStorage.removeItem("guest_player_id");
        localStorage.removeItem("guestPlayerData");
        sessionStorage.removeItem("guest_player_id");
        sessionStorage.removeItem("guestPlayerData");
      }

      // Wait a moment for the broadcast and realtime events to propagate
      await new Promise(resolve => setTimeout(resolve, 300));

      // Always navigate to guest join page for joining another game
      navigate("/guest-join", { replace: true });
    } catch (error) {
      console.error("Error in handleJoinAnotherGame:", error);
      navigate("/guest-join", { replace: true });
    }
  };

  // Handler for host to kick a player
  const handleKickPlayer = async (playerIdToKick: string, playerName: string) => {
    const hostId = getCurrentCustomerId();
    if (!sessionId || !hostId) return;

    setIsKickingPlayer(true);
    try {
      const { data, error } = await supabase.functions.invoke("kick-player", {
        body: { sessionId, playerIdToKick, hostId },
      });

      if (error) {
        console.error("Error kicking player:", error);
        toast({
          title: "Error",
          description: "Failed to kick player",
          variant: "destructive",
        });
        return;
      }

      // Remove player from local state immediately
      setPlayers((prev) => prev.filter((p) => p.player_id !== playerIdToKick));

      // Broadcast to all players
      broadcastEvent("player_kicked", { 
        playerId: playerIdToKick, 
        playerName,
        kickedBy: getCurrentPlayerName()
      });

      toast({
        title: "Player Kicked",
        description: `${playerName} has been removed from the lobby`,
      });
    } catch (error) {
      console.error("Error in handleKickPlayer:", error);
      toast({
        title: "Error",
        description: "Failed to kick player",
        variant: "destructive",
      });
    } finally {
      setIsKickingPlayer(false);
    }
  };

  const handleRecordingComplete = async (audioBlob: Blob) => {
    setIsUploading(true);

    try {
      const currentCustomerId = getCurrentCustomerId();

      if (!currentCustomerId) {
        console.error("No customer ID found for upload");
        toast({
          title: "Error",
          description: "Unable to identify player. Please refresh the page.",
          variant: "destructive",
        });
        setIsUploading(false);
        return;
      }

      const formData = new FormData();
      formData.append("audio", audioBlob);
      formData.append("customer_id", currentCustomerId);
      formData.append("shop_domain", session?.shop_domain || "");
      formData.append("tenant_id", session?.tenant_id || "");
      formData.append("session_id", sessionId || "");
      formData.append("round_number", session?.current_round?.toString() || "1");

      const response = await fetch(`https://egrwijzbxxhkhrrelsgi.supabase.co/functions/v1/upload-customer-audio`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Upload failed:", errorText);
        throw new Error("Failed to upload audio");
      }

      const data = await response.json();

      if (data.success && data.audio_id) {
        setHasRecording(true);
        broadcastEvent("recording_uploaded", { audioUrl: data.audio_url });
        await fetchLobbyData();
        toast({
          title: "Recording saved",
          description: "Your audio has been uploaded successfully",
        });
      }
    } catch (error) {
      console.error("Error uploading audio:", error);
      toast({
        title: "Upload failed",
        description: "Failed to save recording. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmitGuess = async () => {
    if (!guessInput.trim() || !currentTurn) return;

    setIsSubmittingGuess(true);
    try {
      const currentCustomerId = getCurrentCustomerId();
      const guestPlayerId = localStorage.getItem("guest_player_id");
      const currentPlayerId = currentCustomerId || guestPlayerId;

      if (!currentPlayerId) {
        toast({
          title: "Error",
          description: "Unable to identify player. Please refresh the page.",
          variant: "destructive",
        });
        setIsSubmittingGuess(false);
        return;
      }

      const response = await fetch(`https://egrwijzbxxhkhrrelsgi.supabase.co/functions/v1/submit-guess`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId: sessionId,
          roundNumber: session?.current_round ?? 1,
          playerId: currentPlayerId,
          guess: guessInput.trim(),
        }),
      });

      const data = await response.json();

      // Lock player after submission (correct or wrong)
      setIsLockedOut(true);

      // Get player name for display
      const currentPlayer = players.find((p) => p.player_id === getCurrentCustomerId());
      const playerName = currentPlayer?.name || "Unknown";

      // Broadcast answer to all players
      broadcastEvent("player_answered", {
        playerId: getCurrentCustomerId(),
        playerName,
        guess: guessInput,
        isCorrect: data.correct,
      });

      // Add to local answers
      setPlayerAnswers((prev) => [
        ...prev,
        {
          playerId: getCurrentCustomerId()!,
          playerName,
          guess: guessInput,
          isCorrect: data.correct,
        },
      ]);

      setGuessInput("");

      // If all players answered, show results
      if (data.all_players_answered) {
        setShowResults(true);

        // Update currentTurn with secret element from response
        if (data.secret_element) {
          setCurrentTurn((prev) => ({
            ...prev,
            secret_element: data.secret_element,
          }));
        }

        // Broadcast to all other players that all answers are received
        broadcastEvent("all_answers_received", {
          secretElement: data.secret_element,
          allAnswers: playerAnswers, // Send accumulated answers
        });

        toast({
          title: "Round Complete!",
          description: "All players have answered. See results below.",
        });

        // Advance to next round after showing results
        if (data.next_round) {
          setTimeout(() => {
            broadcastEvent("refresh_state", {
              roundNumber: data.next_round.roundNumber,
              newStorytellerId: data.next_round.newStorytellerId,
            });
            // Reset states for next round
            setGuessInput("");
            setSelectedTheme("");
            setSelectedElementId("");
            setHasRecording(false);
            setPlayerAnswers([]);
            setShowResults(false);
            setIsLockedOut(false); // Allow guessing in new round
            // Fetch updated data after state reset
            fetchLobbyData();
          }, 5000); // Show results for 5 seconds
        }

        // If game completed
        if (data.game_completed && data.next_round) {
          setTimeout(() => {
            broadcastEvent("refresh_state", {
              gameCompleted: true,
              winnerId: data.next_round.winnerId,
              winnerName: data.next_round.winnerName,
            });
          }, 5000);
        }
      } else {
        // Not all players answered yet
        toast({
          title: data.correct ? "Correct! ✅" : "Wrong ❌",
          description: data.correct
            ? `You earned ${data.points_earned} points! Waiting for other players...`
            : "Waiting for other players to answer...",
          variant: data.correct ? "default" : "destructive",
        });
      }
    } catch (error) {
      console.error("Error submitting guess:", error);
      toast({
        title: "Error",
        description: "Failed to submit guess. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmittingGuess(false);
    }
  };

  const handleThemeChange = async (themeId: string) => {
    setSelectedTheme(themeId);

    const customerId = getCurrentCustomerId();
    if (!customerId) {
      toast({
        title: "Error",
        description: "Unable to identify player. Please refresh the page.",
        variant: "destructive",
      });
      return;
    }

    // Get customer name from storage if available
    const customerData = localStorage.getItem("customerData");
    const customerName = customerData ? JSON.parse(customerData).name : null;

    // Update session with selected theme via edge function
    try {
      const { data, error } = await supabase.functions.invoke("update-session-theme", {
        body: {
          sessionId,
          themeId,
          customerId,
          customerName,
        },
      });

      if (error) {
        console.error("Error updating theme:", error);
        toast({
          title: "Error",
          description: "Failed to save theme selection",
          variant: "destructive",
        });
      } else {
        // Broadcast theme_selected to all players via Supabase Broadcast
        const themeName = themes.find((t) => t.id === themeId)?.name || "Unknown";
        broadcastEvent("theme_selected", { themeId, themeName });

        toast({
          title: "Theme Selected",
          description: "Now select your secret element",
        });
      }
    } catch (error) {
      console.error("Error in handleThemeChange:", error);
      toast({
        title: "Error",
        description: "Failed to save theme selection",
        variant: "destructive",
      });
    }
  };

  const handleSecretElementSelect = async (elementName: string) => {
    setSelectedElementId(elementName);

    const customerId = getCurrentCustomerId();
    if (!customerId) {
      toast({
        title: "Error",
        description: "Unable to identify player. Please refresh the page.",
        variant: "destructive",
      });
      return;
    }

    // Save secret element to database via edge function
    try {
      const { data, error } = await supabase.functions.invoke("save-lobby-secret", {
        body: {
          sessionId,
          secretElementId: elementName, // Now passing element name directly
          customerId,
        },
      });

      if (error) {
        console.error("Error saving secret element:", error);
        toast({
          title: "Error",
          description: "Failed to save secret element",
          variant: "destructive",
        });
      } else {
        // Broadcast secret_selected to all players via Supabase Broadcast
        broadcastEvent("secret_selected", { elementId: elementName });

        toast({
          title: "Secret Element Selected",
          description: "Now record your audio clue",
        });
      }
    } catch (error) {
      console.error("Error in handleSecretElementSelect:", error);
      toast({
        title: "Error",
        description: "Failed to save secret element",
        variant: "destructive",
      });
    }
  };

  const iconMap: Record<string, any> = {
    briefcase: Briefcase,
    home: Home,
    plane: Plane,
    bike: Bike,
    wine: Wine,
    rocket: Rocket,
    skull: Skull,
    sparkles: Sparkles,
  };

  // Check if current user is the host and storyteller
  const currentCustomerId = getCurrentCustomerId();
  const isHost = currentCustomerId && session ? String(session.host_customer_id) === String(currentCustomerId) : false;

  // Determine storyteller - use currentTurn if available, otherwise use session.current_storyteller_id or first player
  const effectiveStorytellerId =
    currentTurn?.storyteller_id ||
    session?.current_storyteller_id ||
    players.sort((a, b) => a.turn_order - b.turn_order)[0]?.player_id;

  const isStoryteller =
    currentCustomerId && effectiveStorytellerId ? String(effectiveStorytellerId) === String(currentCustomerId) : false;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading Game...</p>
      </div>
    );
  }

  if (!session && !loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Lobby not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <div className="flex-1 p-4 md:p-8">
      {/* Countdown Overlay */}
      {showCountdown && (
        <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-sm flex items-center justify-center">
          <div className="text-center animate-pulse">
            <div className="text-[150px] md:text-[200px] font-bold text-primary animate-bounce">{countdownNumber}</div>
            <p className="text-2xl text-muted-foreground mt-4">Get Ready!</p>
          </div>
        </div>
      )}

      {/* Game Completed Screen */}
      {session?.status === "completed" && (
        <div className="fixed inset-0 z-[90] bg-background flex items-center justify-center p-4">
          <Card className="max-w-md w-full text-center">
            <CardHeader className="pb-2">
              <div className="flex justify-center mb-4">
                <PartyPopper className="h-16 w-16 text-primary animate-bounce" />
              </div>
              <CardTitle className="text-3xl">Game Complete!</CardTitle>
              <CardDescription className="text-lg">Thank you for playing!</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Final Scores */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold flex items-center justify-center gap-2">
                  <Trophy className="h-5 w-5 text-yellow-500" />
                  Final Scores
                </h3>
                <div className="space-y-2">
                  {[...players]
                    .sort((a, b) => (b.score || 0) - (a.score || 0))
                    .map((player, index) => (
                      <div
                        key={player.id}
                        className={`flex items-center justify-between p-3 rounded-lg ${
                          index === 0 ? "bg-yellow-500/20 border border-yellow-500/50" : "bg-muted"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {index === 0 && <Trophy className="h-4 w-4 text-yellow-500" />}
                          <span className={index === 0 ? "font-bold" : ""}>{player.name}</span>
                        </div>
                        <span className="font-bold text-primary">{player.score || 0} pts</span>
                      </div>
                    ))}
                </div>
              </div>

              <Button onClick={() => navigate("/play/host")} className="w-full">
                Back to Home
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* <div className="max-w-4xl mx-auto space-y-6">
      
        <div className="fixed top-4 right-4 z-50">
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
              isConnected
                ? "bg-green-500/10 text-green-600 border border-green-500/20"
                : "bg-red-500/10 text-red-600 border border-red-500/20"
            }`}
          >
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
        </div> */}

        <div className="flex items-center justify-between mb-4">
          {isHost ? (
            <>
              <Button variant="ghost" onClick={() => navigate("/play/host")}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Play
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" disabled={isEndingLobby}>
                    <XCircle className="mr-2 h-4 w-4" />
                    {isEndingLobby
                      ? session?.status === "waiting"
                        ? "Deleting..."
                        : "Ending..."
                      : session?.status === "waiting"
                        ? "Delete Game"
                        : "End Game"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{session?.status === "waiting" ? "Delete Game?" : "End Game?"}</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will close the lobby and remove all players. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleEndLobby}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {session?.status === "waiting" ? "Delete Game" : "End Game"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    <XCircle className="mr-2 h-4 w-4" />
                    Leave Game
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Leave Game?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to leave this game? You can rejoin later with the lobby code.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleLeaveGame}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Leave Game
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <Button variant="outline" size="sm" onClick={handleJoinAnotherGame}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Join Another Game
              </Button>
            </div>
          )}
        </div>

        {/* Game Details Card - Visible to all players */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Game: {session?.game_name || "Loading..."}</CardTitle>
            <CardDescription className="text-base">
              Host: {session?.host_customer_name || "Unknown"} • Status: {session?.status || "waiting"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {isHost && (
                <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
                  <p className="text-sm font-semibold text-primary">
                    Share this code with other players to join:{" "}
                    <span className="text-lg font-bold">{session?.lobby_code}</span>
                  </p>
                </div>
              )}
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Packs:</p>
                <p className="text-sm font-medium">{packNames.length > 0 ? packNames.join(", ") : "None"}</p>
              </div>
              {session?.selected_theme_id && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Theme:</p>
                  <div className="flex items-center gap-2">
                    {(() => {
                      const theme = themes.find((t) => t.id === session.selected_theme_id);
                      const IconComponent = theme ? iconMap[theme.icon?.toLowerCase()] || Sparkles : Sparkles;
                      return (
                        <>
                          <IconComponent className="h-4 w-4 text-primary" />
                          <p className="text-sm font-medium">{theme?.name || "Loading..."}</p>
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Users className="mr-2 h-5 w-5" />
                <CardTitle>Players ({players.length})</CardTitle>
              </div>
              {isHost && session.status === "waiting" && players.length > 1 && (
                <Button variant="outline" size="sm" onClick={handleShuffleTurns} className="gap-2">
                  <Shuffle className="h-4 w-4" />
                  Shuffle Turns
                </Button>
              )}
            </div>
            <CardDescription>{isHost ? "You are the host" : "You are a player in this lobby"}</CardDescription>
            {isHost && session.status === "waiting" && (
              <p className="text-xs text-muted-foreground mt-2">Drag and drop players to reorder turns</p>
            )}
          </CardHeader>
          <CardContent>
            {players.length === 0 && !joiningPlayerName ? (
              <p className="text-sm text-muted-foreground">No players have joined yet</p>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={players.map((p) => p.id)} strategy={verticalListSortingStrategy}>
                  <ul className="space-y-2">
                    {joiningPlayerName && (
                      <li className="flex items-center justify-between p-2 rounded-md bg-muted/30 border border-dashed border-muted-foreground/30 animate-pulse">
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          <span className="font-medium text-muted-foreground">{joiningPlayerName}</span>
                          <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">Joining...</span>
                        </div>
                      </li>
                    )}
                    {players.map((player) => (
                      <SortablePlayerItem
                        key={player.id}
                        player={player}
                        isHost={isHost}
                        currentStorytellerId={session.current_storyteller_id}
                        hostCustomerId={session.host_customer_id}
                        isDraggable={isHost && session.status === "waiting"}
                        onKick={handleKickPlayer}
                        isKicking={isKickingPlayer}
                        sessionStatus={session.status}
                        currentUserId={currentPlayerId}
                      />
                    ))}
                  </ul>
                </SortableContext>
              </DndContext>
            )}
          </CardContent>
        </Card>

        {/* Start Game button for host */}
        {isHost && session.status === "waiting" && (
          <Card>
            <CardHeader>
              <CardTitle>Ready to Start?</CardTitle>
              <CardDescription>
                {players.length < 4 
                  ? "Minimum 4 players required to start the game" 
                  : "Start the game when all players have joined"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={handleStartGame} 
                className="w-full" 
                size="lg"
                disabled={players.length < 4}
              >
                Start Game {players.length < 4 && `(${players.length}/4 players)`}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Mode Selection - For storyteller when game is active but no whisp generated yet */}
        {isStoryteller && session.status === "active" && currentTurn && !currentTurn.whisp && (
          <TurnModeSelection
            onModeSelect={handleModeSelect}
            playerName={players.find(p => p.player_id === currentPlayerId)?.name}
            disabled={isSelectingMode}
          />
        )}

        {/* Show Whisp to Storyteller - Auto-generated based on theme (only for audio mode) */}
        {isStoryteller && session.status === "active" && currentTurn?.whisp && currentTurn?.turn_mode !== "elements" && (
          <Card className="border-primary/50 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center text-primary">
                <Eye className="mr-2 h-5 w-5" />
                Your Wisp Word
              </CardTitle>
              <CardDescription>Create a story about this word - other players will try to guess it!</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-4 bg-background rounded-lg border-2 border-primary/30 text-center">
                <p className="text-3xl font-bold text-primary">{currentTurn.whisp}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Audio Recording - For storyteller after whisp is shown (only for audio mode) */}
        {isStoryteller && session.status === "active" && currentTurn?.whisp && !hasRecording && currentTurn?.turn_mode !== "elements" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Music className="mr-2 h-5 w-5" />
                Record Your Story
              </CardTitle>
              <CardDescription>Tell a story about your wisp word - be creative!</CardDescription>
            </CardHeader>
            <CardContent>
              <LobbyAudioRecording onRecordingComplete={handleRecordingComplete} isUploading={isUploading} />
            </CardContent>
          </Card>
        )}

        {/* Elements Interface - For storyteller when turn_mode is elements */}
        {isStoryteller && session.status === "active" && currentTurn?.whisp && currentTurn?.turn_mode === "elements" && !currentTurn?.completed_at && (
          <ElementsInterface
            theme={{ id: selectedTheme || session.selected_theme_id || "", name: themes.find(t => t.id === (selectedTheme || session.selected_theme_id))?.name || "" }}
            whisp={currentTurn.whisp}
            sessionId={sessionId || ""}
            playerId={currentCustomerId || ""}
            turnId={currentTurn.id}
            onSubmit={() => {
              setCurrentTurn((prev: any) => ({ ...prev, completed_at: new Date().toISOString() }));
            }}
            isStoryteller={true}
            storytellerName={players.find(p => p.player_id === currentTurn.storyteller_id)?.name || "Storyteller"}
            sendWebSocketMessage={(msg) => {
              broadcastChannelRef.current?.send({
                type: "broadcast",
                event: "elements_submitted",
                payload: msg,
              });
            }}
            selectedIcons={turnElements}
          />
        )}

        {/* Waiting for storyteller to select mode - For non-storytellers */}
        {!isStoryteller && session.status === "active" && currentTurn && !currentTurn.whisp && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                Waiting for Storyteller
              </CardTitle>
              <CardDescription>
                {players.find(p => p.player_id === session.current_storyteller_id)?.name || "The storyteller"} is selecting their mode...
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {/* Show Current Theme to non-storyteller players */}
        {!isStoryteller && session.status === "active" && session.selected_theme_id && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {(() => {
                  const theme = themes.find((t) => t.id === session.selected_theme_id);
                  const IconComponent = theme ? iconMap[theme.icon.toLowerCase()] || Sparkles : Sparkles;
                  return <IconComponent className="h-5 w-5" />;
                })()}
                Game Theme
              </CardTitle>
              <CardDescription>The storyteller is creating a story based on this theme</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-semibold text-primary">
                {themes.find((t) => t.id === session.selected_theme_id)?.name || "Loading..."}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Guessing Interface - Show for non-storyteller players when recording is complete */}
        {!isStoryteller && hasRecording && currentTurn?.recording_url && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Music className="w-5 h-5" />
                Listen and Guess
              </CardTitle>
              <CardDescription>Listen to the story and guess the wisp word!</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <audio controls src={currentTurn.recording_url} className="w-full" />

              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder={
                    isLockedOut ? "You're locked out this round" : "Type your guess..."
                  }
                  value={guessInput}
                  onChange={(e) => setGuessInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !isSubmittingGuess && !isLockedOut) {
                      handleSubmitGuess();
                    }
                  }}
                  disabled={isSubmittingGuess || isLockedOut}
                  className={isLockedOut ? "opacity-50 cursor-not-allowed" : ""}
                />
                <Button onClick={handleSubmitGuess} disabled={!guessInput.trim() || isSubmittingGuess || isLockedOut}>
                  {isLockedOut ? "Locked" : isSubmittingGuess ? "Submitting..." : "Submit Guess"}
                </Button>
              </div>
              {isLockedOut && !showResults && (
                <p className="text-sm text-muted-foreground font-medium">
                  ✅ Answer submitted. Waiting for other players...
                </p>
              )}

              {/* Show all player answers when round is complete */}
              {showResults && playerAnswers.length > 0 && (
                <div className="mt-4 p-4 bg-muted/50 rounded-lg border">
                  <h4 className="font-semibold mb-3">Round Results:</h4>
                  <div className="space-y-2">
                    {playerAnswers.map((answer, idx) => (
                      <div
                        key={idx}
                        className={`flex items-center justify-between p-2 rounded ${
                          answer.isCorrect
                            ? "bg-green-500/10 border border-green-500/30"
                            : "bg-red-500/10 border border-red-500/30"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{answer.playerName}</span>
                          <span className="text-sm text-muted-foreground">guessed:</span>
                          <span className="font-semibold">{answer.guess}</span>
                        </div>
                        <span className="text-lg">{answer.isCorrect ? "✅" : "❌"}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground mt-3 text-center">
                    Correct answer: <span className="font-semibold">{currentTurn?.whisp}</span>
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
