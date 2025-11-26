import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  turn_order: number;
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
  const [loading, setLoading] = useState(true);
  const [isEndingLobby, setIsEndingLobby] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isGameStarted, setIsGameStarted] = useState(false);

  useEffect(() => {
    if (!sessionId) {
      navigate("/play/host");
      return;
    }

    fetchLobbyData();

    // Set up real-time subscription for lobby updates
    const channel = supabase
      .channel(`lobby-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "game_sessions",
          filter: `id=eq.${sessionId}`,
        },
        (payload) => {
          console.log("Game session changed:", payload);

          // If the session was deleted, redirect to homepage
          if (payload.eventType === "DELETE") {
            toast({
              title: "Lobby Ended",
              description: "The host has ended this lobby",
            });
            navigate("/login");
            return;
          }

          // If session was updated, refresh the data
          if (payload.eventType === "UPDATE") {
            const updatedSession = payload.new as GameSession;
            setSession(updatedSession);

            // Update selected theme in real-time
            if (updatedSession.selected_theme_id) {
              setSelectedTheme(updatedSession.selected_theme_id);
            }

            // Update selected audio in real-time
            if (updatedSession.selected_audio_id) {
              setSelectedAudio(updatedSession.selected_audio_id);
            }

            // Navigate to game page when game starts
            if (updatedSession.status === "active" && !isGameStarted) {
              console.log("Game started - navigating to game page");
              setIsGameStarted(true);
              navigate(`/game/${sessionId}`);
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
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          console.log("New player joined:", payload);
          // Add the new player to the list
          setPlayers((prev) => [...prev, payload.new as Player]);
          toast({
            title: "Player Joined",
            description: `${(payload.new as Player).name} joined the lobby`,
          });
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
        (payload) => {
          console.log("Player left:", payload);
          // Remove the player from the list
          setPlayers((prev) => prev.filter((p) => p.id !== (payload.old as Player).id));
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
          console.log("Customer audio changed:", payload);
          const currentCustomerId = getCurrentCustomerId();
          
          // Refresh audio files when new audio is uploaded or deleted
          if (currentCustomerId && (payload.eventType === "INSERT" || payload.eventType === "DELETE")) {
            await fetchCustomerAudio(currentCustomerId);
            toast({
              title: "Audio Updated",
              description: payload.eventType === "INSERT" ? "New audio file uploaded" : "Audio file removed",
            });
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, navigate, toast]);

  // Helper function to get current customer ID
  const getCurrentCustomerId = () => {
    // Check URL parameters first (in case customer_id is in URL)
    const urlParams = getAllUrlParams();
    const urlCustomerId = urlParams.get("customer_id");
    if (urlCustomerId) {
      return urlCustomerId;
    }

    const storageKeys = ["customerData", "phraseotomy_customer_data", "customer_data"];

    for (const key of storageKeys) {
      // Try sessionStorage
      let dataStr = sessionStorage.getItem(key);
      if (dataStr) {
        try {
          const parsed = JSON.parse(dataStr);
          const customerId = parsed.customer_id || parsed.id || parsed.customerId;
          if (customerId) {
            return String(customerId);
          }
        } catch (e) {
          console.error(`Error parsing sessionStorage[${key}]:`, e);
        }
      }

      // Try localStorage
      dataStr = localStorage.getItem(key);
      if (dataStr) {
        try {
          const parsed = JSON.parse(dataStr);
          const customerId = parsed.customer_id || parsed.id || parsed.customerId;
          if (customerId) {
            return String(customerId);
          }
        } catch (e) {
          console.error(`Error parsing localStorage[${key}]:`, e);
        }
      }
    }

    return null;
  };

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
        toast({
          title: "Session not found",
          description: "This game session doesn't exist or you don't have access to it",
          variant: "destructive",
        });
        navigate("/login");
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

      // Fetch themes
      const { data: themesData, error: themesError } = await supabase.from("themes").select("*").order("name");

      if (!themesError && themesData) {
        setThemes(themesData);
      }
    } catch (error) {
      console.error("Error fetching lobby data:", error);
      toast({
        title: "Error",
        description: "Failed to load lobby details",
        variant: "destructive",
      });
      navigate("/login");
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
      toast({
        title: "Game Started!",
        description: "Get ready to play!",
      });

      // Navigate directly to the game page
      navigate(`/game/${sessionId}`);
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
    const currentCustomerId = getCurrentCustomerId();
    if (!session || !currentCustomerId) {
      return;
    }

    setIsEndingLobby(true);

    try {
      console.log("Ending lobby:", sessionId);

      const { data, error } = await supabase.functions.invoke("end-lobby", {
        body: {
          sessionId,
          hostCustomerId: currentCustomerId,
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

  const handleRecordingComplete = async (audioId: string) => {
    console.log("Recording complete, audio ID:", audioId);
    setSelectedAudio(audioId);

    // Refresh audio files
    await fetchLobbyData();

    toast({
      title: "Ready to Start",
      description: "Audio recorded successfully. You can now start the game.",
    });
  };

  // Theme selection removed - happens in Game phase only

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

  // Check if current user is the host
  const currentCustomerId = getCurrentCustomerId();
  const isHost = currentCustomerId && session ? String(session.host_customer_id) === String(currentCustomerId) : false;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading lobby...</p>
      </div>
    );
  }

  if (!session) {
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
      <div className="max-w-4xl mx-auto space-y-6">
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
                    </div>
                    <span className="text-sm text-muted-foreground">Turn {player.turn_order}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Start Game button for host */}
        {isHost && session.status === "waiting" && (
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

        {/* Display 5 Elements when theme is selected */}
        {isHost && session.status === "active" && selectedTheme && (
          <Card>
            <CardHeader>
              <CardTitle>Select Your Secret Element</CardTitle>
              <CardDescription>Choose 1 element from the 5 below</CardDescription>
            </CardHeader>
            <CardContent>
              <ThemeElements 
                themeId={selectedTheme} 
                onElementSelect={setSelectedElementId}
                selectedElementId={selectedElementId}
              />
            </CardContent>
          </Card>
        )}

        {/* Audio Recording for Host */}
        {isHost && session.status === "active" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Music className="mr-2 h-5 w-5" />
                Record Audio
              </CardTitle>
              <CardDescription>Record audio for the game</CardDescription>
            </CardHeader>
            <CardContent>
              <LobbyAudioRecording
                sessionId={sessionId!}
                customerId={currentCustomerId || ""}
                shopDomain={session.shop_domain}
                tenantId={session.tenant_id}
                hasRecording={false}
                onRecordingComplete={handleRecordingComplete}
              />
            </CardContent>
          </Card>
        )}

        {/* Theme Selection for Host */}
       
      </div>
    </div>
  );
}
