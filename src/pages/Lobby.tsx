import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Music, Users } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

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
      if (data.session.host_customer_id) {
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

  const handleStartGame = () => {
    if (!selectedAudio) {
      toast({
        title: "Select Audio",
        description: "Please select an audio file before starting the game",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Game Starting",
      description: "Starting the game with selected audio...",
    });

    // TODO: Implement game start logic
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
  let currentCustomerId = null;

  // Try sessionStorage first
  const sessionDataStr = sessionStorage.getItem("customerData");
  if (sessionDataStr) {
    try {
      const parsed = JSON.parse(sessionDataStr);
      currentCustomerId = parsed.customer_id || parsed.id;
    } catch (e) {
      console.error("Error parsing session customer data:", e);
    }
  }

  // Fallback to localStorage
  if (!currentCustomerId) {
    const localDataStr = localStorage.getItem("phraseotomy_customer_data");
    if (localDataStr) {
      try {
        const parsed = JSON.parse(localDataStr);
        currentCustomerId = parsed.customer_id || parsed.id;
      } catch (e) {
        console.error("Error parsing local customer data:", e);
      }
    }
  }

  if (currentCustomerId && session) {
    isHost = session.host_customer_id === currentCustomerId.toString();
    console.log("Host check:", { currentCustomerId, hostCustomerId: session.host_customer_id, isHost });
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
                <RadioGroup value={selectedAudio} onValueChange={setSelectedAudio}>
                  <div className="space-y-2">
                    {audioFiles.map((audio) => (
                      <div key={audio.id} className="flex items-center space-x-2 p-3 rounded-md border">
                        <RadioGroupItem value={audio.id} id={audio.id} />
                        <Label htmlFor={audio.id} className="flex-1 cursor-pointer">
                          <div className="flex flex-col">
                            <span className="font-medium">{audio.filename}</span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(audio.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </Label>
                      </div>
                    ))}
                  </div>
                </RadioGroup>
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
