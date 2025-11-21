import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Music, Users } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
}

export default function Lobby() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [session, setSession] = useState<GameSession | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [audioFiles, setAudioFiles] = useState<AudioFile[]>([]);
  const [selectedAudio, setSelectedAudio] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) {
      navigate("/play");
      return;
    }

    fetchLobbyData();
  }, [sessionId]);

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

      // Call edge function to fetch lobby data with service role permissions
      const { data, error } = await supabase.functions.invoke("get-lobby-data", {
        body: { sessionId, customerId: null },
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
        navigate("/play");
        return;
      }

      setSession(data.session);
      setPlayers(data.players || []);

      // Fetch customer audio using the host's customer ID from the session
      if (data?.session?.host_customer_id) {
        console.log("fetching......");
        await fetchCustomerAudio(data.session.host_customer_id);
      }
    } catch (error) {
      console.error("Error fetching lobby data:", error);
      toast({
        title: "Error",
        description: "Failed to load lobby details",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStartGame = async () => {
    if (!selectedAudio) {
      toast({
        title: "Select Audio",
        description: "Please select an audio file before starting the game",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log("Starting game with audio:", selectedAudio);
      console.log("Session ID:", sessionId);

      // Call edge function to start the game with service role permissions
      const { data, error } = await supabase.functions.invoke("start-game", {
        body: {
          sessionId,
          selectedAudioId: selectedAudio,
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
        description: "The game has been started with the selected audio.",
      });

      // Refresh lobby data to show updated status
      await fetchLobbyData();
    } catch (error) {
      console.error("Error in handleStartGame:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred.",
        variant: "destructive",
      });
    }
  };

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

  // Check if current user is the host
  let isHost = false;
  console.log("ishost", isHost);
  let currentCustomerId = null;

  console.log("currentCustomerId", currentCustomerId);

  // Try multiple storage keys
  const storageKeys = ["customerData", "phraseotomy_customer_data", "customer_data"];

  for (const key of storageKeys) {
    // Try sessionStorage
    let dataStr = sessionStorage.getItem(key);
    if (dataStr) {
      try {
        const parsed = JSON.parse(dataStr);
        currentCustomerId = parsed.customer_id || parsed.id || parsed.customerId;
        if (currentCustomerId) {
          console.log(`Found customer ID in sessionStorage[${key}]:`, currentCustomerId);
          break;
        }
      } catch (e) {
        console.error(`Error parsing sessionStorage[${key}]:`, e);
      }
    }

    // Try localStorage
    if (!currentCustomerId) {
      dataStr = localStorage.getItem(key);
      if (dataStr) {
        try {
          const parsed = JSON.parse(dataStr);
          currentCustomerId = parsed.customer_id || parsed.id || parsed.customerId;
          if (currentCustomerId) {
            console.log(`Found customer ID in localStorage[${key}]:`, currentCustomerId);
            break;
          }
        } catch (e) {
          console.error(`Error parsing localStorage[${key}]:`, e);
        }
      }
    }
  }

  // If we have audio files, we can infer the customer ID from them
  if (!currentCustomerId && audioFiles.length > 0) {
    currentCustomerId = audioFiles[0].customer_id;
    console.log("Inferred customer ID from audio files:", currentCustomerId);
  }

  if (currentCustomerId && session) {
    console.log("hello");
    isHost = session.host_customer_id === currentCustomerId.toString();
    console.log("hiiiii");
    console.log("Host check:", { currentCustomerId, hostCustomerId: session.host_customer_id, isHost });
  } else {
    console.warn("Could not determine if user is host", { currentCustomerId, session: !!session });
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <Button variant="ghost" onClick={() => navigate("/play")} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Play
        </Button>

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
          </CardHeader>
          <CardContent>
            {players.length === 0 ? (
              <p className="text-sm text-muted-foreground">No players have joined yet</p>
            ) : (
              <ul className="space-y-2">
                {players.map((player) => (
                  <li key={player.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                    <span className="font-medium">{player.name}</span>
                    <span className="text-sm text-muted-foreground">Turn {player.turn_order}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {isHost && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Music className="mr-2 h-5 w-5" />
                Select Audio
              </CardTitle>
              <CardDescription>Choose an audio file for this game</CardDescription>
            </CardHeader>
            <CardContent>
              {audioFiles.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No audio files uploaded yet. Upload audio from the Play page.
                </p>
              ) : (
                <Select value={selectedAudio} onValueChange={setSelectedAudio}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select an audio file" />
                  </SelectTrigger>
                  <SelectContent>
                    {audioFiles.map((audio) => (
                      <SelectItem key={audio.id} value={audio.id}>
                        <div className="flex flex-col">
                          <span className="font-medium">{audio.filename}</span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(audio.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {audioFiles.length > 0 && (
                <Button onClick={handleStartGame} className="w-full mt-4" disabled={!selectedAudio}>
                  Start Game
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
