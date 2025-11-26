import { useEffect, useState, useRef } from "react";
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
  current_round?: number;
  current_storyteller_id?: string;
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
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "game_turns",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          console.log("Game turn changed:", payload);

          // Update secret element and recording status in real-time
          if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            const turnData = payload.new as any;
            if (turnData.secret_element) {
              setSelectedElementId(turnData.secret_element);
            }
            if (turnData.recording_url) {
              setHasRecording(true);
            }
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

  const handleRecordingComplete = async (audioBlob: Blob) => {
    console.log("Recording complete, uploading audio...");
    setIsUploading(true);

    try {
      const currentCustomerId = getCurrentCustomerId();
      if (!currentCustomerId) {
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

      if (data.already_answered) {
        toast({
          title: "Round Complete",
          description: "Someone already answered correctly!",
        });
        setGuessInput("");
        return;
      }

      if (data.correct) {
        toast({
          title: "Correct! 🎉",
          description: `You earned ${data.points_earned} points!`,
        });
        setGuessInput("");
        // Refresh lobby data to show updated scores
        fetchLobbyData();
      } else {
        toast({
          title: "Incorrect",
          description: "That's not the right answer. Try again!",
          variant: "destructive",
        });
        setGuessInput("");
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
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="Type your guess..."
                  value={guessInput}
                  onChange={(e) => setGuessInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !isSubmittingGuess) {
                      handleSubmitGuess();
                    }
                  }}
                  disabled={isSubmittingGuess}
                />
                <Button onClick={handleSubmitGuess} disabled={!guessInput.trim() || isSubmittingGuess}>
                  {isSubmittingGuess ? "Submitting..." : "Submit Guess"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
