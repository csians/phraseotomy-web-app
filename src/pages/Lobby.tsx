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
} from "lucide-react";
import { LobbyAudioRecording } from "@/components/LobbyAudioRecording";
import { getAllUrlParams } from "@/lib/urlUtils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ThemeElements } from "@/components/ThemeElements";

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
  console.log("session", session);
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
  console.log("currentTurn", currentTurn);
  const [guessInput, setGuessInput] = useState("");
  const [isSubmittingGuess, setIsSubmittingGuess] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [showCountdown, setShowCountdown] = useState(false);
  const [countdownNumber, setCountdownNumber] = useState(3);
  const [isLockedOut, setIsLockedOut] = useState(false);
  const [playerAnswers, setPlayerAnswers] = useState<Array<{
    playerId: string;
    playerName: string;
    guess: string;
    isCorrect: boolean;
  }>>([]);
  const [showResults, setShowResults] = useState(false);

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
    console.log("🚀 [GUEST] Checking for guest data in URL...");
    const urlParams = new URLSearchParams(window.location.search);
    const guestDataStr = urlParams.get('guestData');
    const guestSession = urlParams.get('guestSession');
    
    console.log("🔍 [GUEST] guestData param:", guestDataStr);
    console.log("🔍 [GUEST] guestSession param:", guestSession);
    
    if (guestDataStr) {
      try {
        const guestData = JSON.parse(guestDataStr);
        console.log('✅ [GUEST] Guest data from URL:', guestData);
        
        // Store guest data in BOTH storages for reliability in Shopify context
        sessionStorage.setItem('guest_player_id', guestData.player_id);
        sessionStorage.setItem('guestPlayerData', JSON.stringify(guestData));
        localStorage.setItem('guest_player_id', guestData.player_id);
        localStorage.setItem('guestPlayerData', JSON.stringify(guestData));
        console.log('✅ [GUEST] Stored guest_player_id in both storages:', guestData.player_id);
        
        if (guestSession) {
          sessionStorage.setItem('current_lobby_session', guestSession);
          console.log('✅ [GUEST] Stored guestSession:', guestSession);
        }
        
        // Clean up URL params
        const cleanUrl = window.location.origin + window.location.pathname + window.location.hash;
        window.history.replaceState({}, '', cleanUrl);
        console.log('✅ [GUEST] Cleaned URL');
      } catch (e) {
        console.error('❌ [GUEST] Error parsing guest data:', e);
      }
    } else {
      console.log('ℹ️ [GUEST] No guest data in URL');
      // Check if we already have guest data stored
      const storedGuestIdSession = sessionStorage.getItem('guest_player_id');
      const storedGuestIdLocal = localStorage.getItem('guest_player_id');
      console.log('🔍 [GUEST] Existing guest_player_id in sessionStorage:', storedGuestIdSession);
      console.log('🔍 [GUEST] Existing guest_player_id in localStorage:', storedGuestIdLocal);
      
      // Sync between storages if one has it
      if (storedGuestIdSession && !storedGuestIdLocal) {
        localStorage.setItem('guest_player_id', storedGuestIdSession);
        console.log('✅ [GUEST] Synced from session to local storage');
      } else if (storedGuestIdLocal && !storedGuestIdSession) {
        sessionStorage.setItem('guest_player_id', storedGuestIdLocal);
        console.log('✅ [GUEST] Synced from local to session storage');
      }
    }
  }, []);

  // Get current customer ID helper
  const getCurrentCustomerId = useCallback(() => {
    console.log("🔍 [GET_ID] Starting getCurrentCustomerId...");
    
    const urlParams = getAllUrlParams();
    const urlCustomerId = urlParams.get("customer_id");
    if (urlCustomerId) {
      console.log("✅ [GET_ID] Found customer ID in URL:", urlCustomerId);
      return urlCustomerId;
    }

    const storageKeys = ["customerData", "phraseotomy_customer_data", "customer_data"];
    for (const key of storageKeys) {
      let dataStr = sessionStorage.getItem(key) || localStorage.getItem(key);
      if (dataStr) {
        try {
          const parsed = JSON.parse(dataStr);
          const customerId = parsed.customer_id || parsed.id || parsed.customerId;
          if (customerId) {
            console.log(`✅ [GET_ID] Found customer ID in ${key}:`, customerId);
            return String(customerId);
          }
        } catch (e) {
          console.error(`Error parsing ${key}:`, e);
        }
      }
    }
    
    // Check for guest player ID in both sessionStorage and localStorage
    const guestPlayerIdSession = sessionStorage.getItem("guest_player_id");
    const guestPlayerIdLocal = localStorage.getItem("guest_player_id");
    const guestPlayerId = guestPlayerIdSession || guestPlayerIdLocal;
    
    console.log("🔍 [GET_ID] Guest player ID (session):", guestPlayerIdSession);
    console.log("🔍 [GET_ID] Guest player ID (local):", guestPlayerIdLocal);
    
    if (guestPlayerId) {
      console.log("✅ [GET_ID] Found guest player ID:", guestPlayerId);
      // Store in both storages for reliability
      if (!guestPlayerIdSession) sessionStorage.setItem("guest_player_id", guestPlayerId);
      if (!guestPlayerIdLocal) localStorage.setItem("guest_player_id", guestPlayerId);
      return guestPlayerId;
    }
    
    // As a last resort, check if we have guestPlayerData
    const guestDataStr = sessionStorage.getItem("guestPlayerData") || localStorage.getItem("guestPlayerData");
    if (guestDataStr) {
      try {
        const guestData = JSON.parse(guestDataStr);
        if (guestData.player_id) {
          console.log("✅ [GET_ID] Found player ID in guestPlayerData:", guestData.player_id);
          // Store it for next time
          sessionStorage.setItem("guest_player_id", guestData.player_id);
          localStorage.setItem("guest_player_id", guestData.player_id);
          return guestData.player_id;
        }
      } catch (e) {
        console.error("Error parsing guestPlayerData:", e);
      }
    }
    
    console.log("❌ [GET_ID] No player ID found anywhere");
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
  const broadcastEvent = useCallback((event: string, payload: any) => {
    if (broadcastChannelRef.current) {
      console.log("📤 [BROADCAST] Sending event:", event, payload);
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
  }, [currentPlayerId, currentPlayerName]);

  useEffect(() => {
    console.log("🚀 [LOBBY] useEffect running - sessionId:", sessionId);
    console.log("🚀 [LOBBY] Supabase client:", supabase);
    
    if (!sessionId) {
      console.log("⚠️ [LOBBY] No sessionId available");
      setLoading(false);
      return;
    }

    // Store sessionId in sessionStorage to persist across refreshes
    sessionStorage.setItem('current_lobby_session', sessionId);
    console.log("✅ [LOBBY] Stored session in sessionStorage:", sessionId);
    
    console.log("📡 [LOBBY] Calling fetchLobbyData...");
    fetchLobbyData();

    // Set up real-time subscription for lobby updates using Supabase Realtime Broadcast
    console.log("🔄 [REALTIME] Setting up Supabase Realtime subscription for session:", sessionId);
    console.log("🔄 [REALTIME] Channel name will be: lobby-broadcast-" + sessionId);
    
    const channel = supabase
      .channel(`lobby-broadcast-${sessionId}`, {
        config: {
          broadcast: { self: false }, // Don't receive own broadcasts
        },
      })
      // Listen for broadcast events (player joins, game events, etc.)
      .on("broadcast", { event: "player_joined" }, (payload) => {
        console.log("📢 [BROADCAST] player_joined received:", payload);
        toast({
          title: "Player Joined! 🎮",
          description: `${payload.payload?.senderName || 'A player'} joined the lobby`,
        });
        // Refresh player list
        fetchLobbyData();
      })
      .on("broadcast", { event: "player_left" }, (payload) => {
        console.log("📢 [BROADCAST] player_left received:", payload);
        toast({
          title: "Player Left",
          description: `${payload.payload?.senderName || 'A player'} left the lobby`,
        });
        fetchLobbyData();
      })
      .on("broadcast", { event: "game_started" }, (payload) => {
        console.log("📢 [BROADCAST] game_started received:", payload);
        toast({
          title: "Game Started! 🎮",
          description: `${payload.payload?.senderName || 'Host'} started the game`,
        });
        setIsGameStarted(true);
        // Show countdown for all players
        setShowCountdown(true);
        setCountdownNumber(3);
        setTimeout(() => setCountdownNumber(2), 1000);
        setTimeout(() => setCountdownNumber(1), 2000);
        setTimeout(() => {
          setShowCountdown(false);
          fetchLobbyData();
        }, 3000);
      })
      .on("broadcast", { event: "lobby_ended" }, (payload) => {
        console.log("📢 [BROADCAST] lobby_ended received:", payload);
        toast({
          title: "Lobby Ended",
          description: "The host has ended this lobby",
        });
        navigate("/login");
      })
      .on("broadcast", { event: "theme_selected" }, (payload) => {
        console.log("📢 [BROADCAST] theme_selected received:", payload);
        toast({
          title: "Theme Selected",
          description: `${payload.payload?.senderName || 'Host'} chose a theme`,
        });
        if (payload.payload?.themeId) {
          setSelectedTheme(payload.payload.themeId);
        }
        fetchLobbyData();
      })
      .on("broadcast", { event: "secret_selected" }, (payload) => {
        console.log("📢 [BROADCAST] secret_selected received:", payload);
        toast({
          title: "Secret Element Selected",
          description: `${payload.payload?.senderName || 'Storyteller'} has selected their secret element`,
        });
        fetchLobbyData();
      })
      .on("broadcast", { event: "recording_uploaded" }, (payload) => {
        console.log("📢 [BROADCAST] recording_uploaded received:", payload);
        toast({
          title: "Audio Ready! 🎤",
          description: "Listen to the clue and guess the secret element",
        });
        setHasRecording(true);
        fetchLobbyData();
      })
      .on("broadcast", { event: "guess_submitted" }, (payload) => {
        console.log("📢 [BROADCAST] guess_submitted received:", payload);
        if (payload.payload?.isCorrect) {
          toast({
            title: "Correct Answer! 🎉",
            description: `${payload.payload?.senderName || 'A player'} guessed correctly!`,
          });
        }
        fetchLobbyData();
      })
      .on("broadcast", { event: "player_answered" }, (payload) => {
        console.log("📢 [BROADCAST] player_answered received:", payload);
        const { playerId, playerName, guess, isCorrect } = payload.payload;
        
        // Add answer to local state (avoid duplicates)
        setPlayerAnswers(prev => {
          const exists = prev.find(a => a.playerId === playerId);
          if (exists) return prev;
          return [...prev, { playerId, playerName, guess, isCorrect }];
        });
      })
      .on("broadcast", { event: "refresh_state" }, (payload) => {
        console.log("📢 [BROADCAST] refresh_state received:", payload);
        // Reset local state for new round
        setGuessInput("");
        setPlayerAnswers([]);
        setShowResults(false);
        setIsLockedOut(false);
        // Then fetch updated data
        fetchLobbyData();
      })
      // Also listen for postgres changes as backup
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "game_sessions",
          filter: `id=eq.${sessionId}`,
        },
        (payload) => {
          console.log("📢 [REALTIME] game_sessions changed:", payload.eventType, payload);

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
            console.log("📢 [REALTIME] Session UPDATE - status:", updatedSession.status, "theme:", updatedSession.selected_theme_id);
            setSession(updatedSession);

            if (updatedSession.selected_theme_id) {
              setSelectedTheme(updatedSession.selected_theme_id);
            }

            if (updatedSession.selected_audio_id) {
              setSelectedAudio(updatedSession.selected_audio_id);
            }

            if (updatedSession.status === "active" && !isGameStarted) {
              console.log("📢 [REALTIME] Game started - status changed to active");
              setIsGameStarted(true);
              fetchLobbyData();
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
          console.log("📢 [REALTIME] game_players INSERT:", payload);
          const newPlayer = payload.new as Player;
          if (newPlayer.session_id === sessionId) {
            console.log("✅ [REALTIME] Player joined this session:", newPlayer.name);
            setPlayers((prev) => {
              const exists = prev.some(p => p.id === newPlayer.id || p.player_id === newPlayer.player_id);
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
          console.log("📢 [REALTIME] game_players DELETE:", payload);
          const leftPlayer = payload.old as Player;
          if (leftPlayer.session_id === sessionId) {
            console.log("✅ [REALTIME] Player left this session:", leftPlayer.name);
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
          console.log("📢 [REALTIME] customer_audio changed:", payload.eventType, payload);
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
          console.log("📢 [REALTIME] game_turns changed:", payload.eventType, payload);

          if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            const turnData = payload.new as any;
            console.log("📢 [REALTIME] Turn data changed - refreshing lobby data");
            console.log("📢 [REALTIME] Turn details - theme:", turnData.theme_id, "secret:", turnData.secret_element, "recording:", turnData.recording_url);
            fetchLobbyData();
          }
        },
      )
      .subscribe((status, err) => {
        console.log("🔌 [REALTIME] Subscription status:", status, "error:", err);
        if (err) {
          console.error("❌ [REALTIME] Subscription error:", err);
          setIsConnected(false);
        }
        if (status === "SUBSCRIBED") {
          console.log("✅ [REALTIME] Successfully subscribed to channel lobby-broadcast-" + sessionId);
          setIsConnected(true);
          
          // Announce our presence after subscribing
          setTimeout(() => {
            console.log("📤 [BROADCAST] Announcing player joined to all");
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
          console.error("❌ [REALTIME] Channel error - realtime will not work");
          setIsConnected(false);
        }
        if (status === "TIMED_OUT") {
          console.error("❌ [REALTIME] Subscription timed out");
          setIsConnected(false);
        }
      });

    // Store channel ref for broadcasting
    broadcastChannelRef.current = channel;

    return () => {
      console.log("🧹 [LOBBY] Cleaning up subscription");
      setIsConnected(false);
      supabase.removeChannel(channel);
    };
  }, [sessionId, navigate, toast, currentPlayerId, currentPlayerName]);

  // getCurrentCustomerId is already defined above as a useCallback

  const fetchCustomerAudio = async (customerId: string) => {
    try {
      console.log("customer id ", customerId);
      console.log("Fetching audio for customer:", customerId);

      const { data, error } = await supabase.functions.invoke("get-customer-audio", {
        body: { customerId: customerId.toString() },
      });

      if (error) {
        console.error("Error fetching customer audio:", error);
        return;
      }

      console.log("Audio files received:", data?.audioFiles?.length || 0);
      setAudioFiles(data?.audioFiles || []);
    } catch (error) {
      console.error("Error in fetchCustomerAudio:", error);
    }
  };

  const fetchLobbyData = async () => {
    try {
      setLoading(true);

      console.log("Fetching lobby data for session:", sessionId);

      // Get current customer ID or guest player ID
      const currentCustomerId = getCurrentCustomerId();
      const guestPlayerId = localStorage.getItem("guest_player_id");
      const currentPlayerId = currentCustomerId || guestPlayerId;

      console.log("Current player ID:", currentPlayerId);

      // Call edge function to fetch lobby data with service role permissions
      const { data, error } = await supabase.functions.invoke("get-lobby-data", {
        body: { sessionId, customerId: currentCustomerId },
      });

      if (error) {
        console.error("Lobby data fetch error:", error);
        throw error;
      }

      console.log("Lobby data received:", data);

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

      // For page refreshes, we don't need to re-validate player membership
      // The real-time subscriptions will handle session updates

      setSession(data.session);
      setPlayers(data.players || []);

      // Set audio files from the response (edge function fetches them if user is host)
      setAudioFiles(data.audioFiles || []);
      console.log("Audio files from response:", data.audioFiles?.length || 0);

      // Set selected theme if it exists in session
      if (data.session.selected_theme_id) {
        setSelectedTheme(data.session.selected_theme_id);
      }

      // Check if there's already a turn with secret element and recording from currentTurn data
      if (data.currentTurn) {
        setCurrentTurn(data.currentTurn);
        if (data.currentTurn.secret_element) {
          setSelectedElementId(data.currentTurn.secret_element);
        }
        if (data.currentTurn.recording_url) {
          setHasRecording(true);
        }
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
      console.log("Starting game...");
      console.log("Session ID:", sessionId);

      // Call edge function to start the game with service role permissions
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

      console.log("Game started successfully:", data);
      
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
        // Update session state after countdown
        if (data.session) {
          setSession(data.session);
        }
        fetchLobbyData();
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

  const handleEndLobby = async () => {
    const customerId = getCurrentCustomerId();
    if (!session || !customerId) {
      return;
    }

    setIsEndingLobby(true);

    try {
      console.log("Ending lobby:", sessionId);

      // Broadcast lobby_ended to all players via Supabase Broadcast BEFORE deleting
      broadcastEvent("lobby_ended", {});

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

      console.log("Lobby ended successfully:", data);
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

  const handleRecordingComplete = async (audioBlob: Blob) => {
    console.log("Recording complete, uploading audio...");
    setIsUploading(true);

    try {
      const currentCustomerId = getCurrentCustomerId();
      console.log("🔍 [UPLOAD] Current customer ID:", currentCustomerId);
      console.log("🔍 [UPLOAD] Guest player ID from localStorage:", localStorage.getItem("guest_player_id"));
      console.log("🔍 [UPLOAD] All localStorage keys:", Object.keys(localStorage));
      
      if (!currentCustomerId) {
        console.error("❌ [UPLOAD] No customer ID found!");
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
      console.log("data from lobby upload", data);

      if (data.success && data.audio_id) {
        console.log("Recording complete, audio ID:", data.audio_id);
        setHasRecording(true);
        
        // Broadcast recording_uploaded to all players via Supabase Broadcast
        broadcastEvent("recording_uploaded", { audioUrl: data.audio_url });
        
        // Refresh lobby data to get updated recording URL from game_turns
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
      const currentPlayer = players.find(p => p.player_id === getCurrentCustomerId());
      const playerName = currentPlayer?.name || "Unknown";
      
      // Broadcast answer to all players
      broadcastEvent("player_answered", {
        playerId: getCurrentCustomerId(),
        playerName,
        guess: guessInput,
        isCorrect: data.correct,
      });
      
      // Add to local answers
      setPlayerAnswers(prev => [...prev, {
        playerId: getCurrentCustomerId()!,
        playerName,
        guess: guessInput,
        isCorrect: data.correct,
      }]);
      
      setGuessInput("");
      
      // If all players answered, show results
      if (data.all_players_answered) {
        setShowResults(true);
        
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
        console.log("Theme saved successfully:", data);
        
        // Broadcast theme_selected to all players via Supabase Broadcast
        const themeName = themes.find(t => t.id === themeId)?.name || "Unknown";
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
        console.log("Secret element saved successfully:", data);
        
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
        <p className="text-muted-foreground">Loading lobby...</p>
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

  console.log("Host check:", {
    currentCustomerId,
    hostCustomerId: session?.host_customer_id,
    isHost,
    hasAudioFiles: audioFiles.length > 0,
  });

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      {/* Countdown Overlay */}
      {showCountdown && (
        <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-sm flex items-center justify-center">
          <div className="text-center animate-pulse">
            <div className="text-[150px] md:text-[200px] font-bold text-primary animate-bounce">
              {countdownNumber}
            </div>
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
                  {[...players].sort((a, b) => (b.score || 0) - (a.score || 0)).map((player, index) => (
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

      <div className="max-w-4xl mx-auto space-y-6">
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

        <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" onClick={() => navigate("/play/host")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Play
          </Button>

          {isHost && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" disabled={isEndingLobby}>
                  <XCircle className="mr-2 h-4 w-4" />
                  {isEndingLobby ? "Ending..." : "End Lobby"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>End Lobby?</AlertDialogTitle>
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
                    End Lobby
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Lobby: {session.lobby_code}</CardTitle>
            <CardDescription>
              Host: {session.host_customer_name || "Unknown"} • Status: {session.status}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Packs:</p>
              <p className="text-sm">{session.packs_used.join(", ") || "None"}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Users className="mr-2 h-5 w-5" />
              Players ({players.length})
            </CardTitle>
            <CardDescription>{isHost ? "You are the host" : "You are a player in this lobby"}</CardDescription>
          </CardHeader>
          <CardContent>
            {players.length === 0 ? (
              <p className="text-sm text-muted-foreground">No players have joined yet</p>
            ) : (
              <ul className="space-y-2">
                {players.map((player) => (
                  <li key={player.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{player.name}</span>
                      {player.player_id === session.host_customer_id && (
                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">Host</span>
                      )}
                      {player.player_id === session.current_storyteller_id && (
                        <span className="text-xs bg-yellow-500/20 text-yellow-500 px-2 py-0.5 rounded">Storyteller</span>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-lg font-bold text-primary">{player.score ?? 0} pts</span>
                      <span className="text-sm text-muted-foreground">Turn {player.turn_order}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Start Game button for host */}
        {isStoryteller && session.status === "waiting" && (
          <Card>
            <CardHeader>
              <CardTitle>Ready to Start?</CardTitle>
              <CardDescription>Start the game when all players have joined</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleStartGame} className="w-full" size="lg">
                Start Game
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Theme Selection - Step 1 (Only for current storyteller after game starts) */}
        {isStoryteller && session.status === "active" && themes.length > 0 && !selectedTheme && (
          <Card>
            <CardHeader>
              <CardTitle>Step 1: Select Theme</CardTitle>
              <CardDescription>Choose a theme for the game</CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={selectedTheme} onValueChange={handleThemeChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a theme..." />
                </SelectTrigger>
                <SelectContent>
                  {themes.map((theme) => {
                    const IconComponent = iconMap[theme.icon.toLowerCase()] || Sparkles;
                    return (
                      <SelectItem key={theme.id} value={theme.id}>
                        <div className="flex items-center gap-2">
                          <IconComponent className="h-4 w-4" />
                          <span>{theme.name}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        )}

        {/* Secret Element Selection - Step 2 (Only for current storyteller after game starts) */}
        {isStoryteller && session.status === "active" && selectedTheme && !selectedElementId && (
          <Card>
            <CardHeader>
              <CardTitle>Step 2: Select Your Secret Element</CardTitle>
              <CardDescription>Choose 1 secret element (only you can see this)</CardDescription>
            </CardHeader>
            <CardContent>
              <ThemeElements
                themeId={selectedTheme}
                onElementSelect={handleSecretElementSelect}
                selectedElementId={selectedElementId}
              />
            </CardContent>
          </Card>
        )}

        {/* Audio Recording - Step 3 (Only for current storyteller after game starts) */}
        {isStoryteller && session.status === "active" && selectedTheme && selectedElementId && !hasRecording && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Music className="mr-2 h-5 w-5" />
                Step 3: Record Audio Clue
              </CardTitle>
              <CardDescription>Record a clue about your secret element</CardDescription>
            </CardHeader>
            <CardContent>
              <LobbyAudioRecording onRecordingComplete={handleRecordingComplete} isUploading={isUploading} />
            </CardContent>
          </Card>
        )}

        {/* Show Selected Theme to non-storyteller players */}
        {!isStoryteller && session.status === "active" && (selectedTheme || session.selected_theme_id) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {(() => {
                  const themeId = selectedTheme || session.selected_theme_id;
                  const theme = themes.find(t => t.id === themeId);
                  const IconComponent = theme ? (iconMap[theme.icon.toLowerCase()] || Sparkles) : Sparkles;
                  return <IconComponent className="h-5 w-5" />;
                })()}
                Current Theme
              </CardTitle>
              <CardDescription>The storyteller has selected this theme</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-semibold text-primary">
                {themes.find(t => t.id === (selectedTheme || session.selected_theme_id))?.name || "Loading..."}
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
              <CardDescription>Listen to the audio clue and guess the secret element</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <audio controls src={currentTurn.recording_url} className="w-full" />
              
              {/* Show elements for guessing */}
              {(selectedTheme || session.selected_theme_id) && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Choose from these elements:</p>
                  <ThemeElements
                    themeId={selectedTheme || session.selected_theme_id || ""}
                    onElementSelect={(elementName) => setGuessInput(elementName)}
                    selectedElementId={guessInput}
                    isGuessing={true}
                  />
                </div>
              )}
              
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder={isLockedOut ? "You're locked out this round" : "Type your guess or click an element above..."}
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
                <Button 
                  onClick={handleSubmitGuess} 
                  disabled={!guessInput.trim() || isSubmittingGuess || isLockedOut}
                >
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
                          answer.isCorrect ? "bg-green-500/10 border border-green-500/30" : "bg-red-500/10 border border-red-500/30"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{answer.playerName}</span>
                          <span className="text-sm text-muted-foreground">guessed:</span>
                          <span className="font-semibold">{answer.guess}</span>
                        </div>
                        <span className="text-lg">
                          {answer.isCorrect ? "✅" : "❌"}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground mt-3 text-center">
                    Correct answer: <span className="font-semibold">{currentTurn?.secret_element?.startsWith("custom:") 
                      ? currentTurn.secret_element.substring(7) 
                      : currentTurn?.secret_element}</span>
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
