import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Music, Users, XCircle } from "lucide-react";
import { LobbyAudioRecording } from "@/components/LobbyAudioRecording";

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
  started_at: string | null;
  shop_domain: string;
  tenant_id: string;
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
  const [isEndingLobby, setIsEndingLobby] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

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
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_sessions',
          filter: `id=eq.${sessionId}`
        },
        (payload) => {
          console.log('Game session changed:', payload);
          
          // If the session was deleted, redirect to homepage
          if (payload.eventType === 'DELETE') {
            toast({
              title: "Lobby Ended",
              description: "The host has ended this lobby",
            });
            navigate('/login');
            return;
          }
          
          // If session was updated, refresh the data
          if (payload.eventType === 'UPDATE') {
            const updatedSession = payload.new as GameSession;
            setSession(updatedSession);
            
            // Auto-play audio when game starts
            if (updatedSession.status === 'active' && updatedSession.selected_audio_id) {
              console.log('Game started - attempting to play audio');
              setTimeout(() => {
                if (audioRef.current) {
                  audioRef.current.play().catch(err => {
                    console.error('Error auto-playing audio:', err);
                    toast({
                      title: "Audio Playback",
                      description: "Please click the audio to start playback",
                    });
                  });
                }
              }, 500);
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'game_players',
          filter: `session_id=eq.${sessionId}`
        },
        (payload) => {
          console.log('New player joined:', payload);
          // Add the new player to the list
          setPlayers(prev => [...prev, payload.new as Player]);
          toast({
            title: "Player Joined",
            description: `${(payload.new as Player).name} joined the lobby`,
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'game_players',
          filter: `session_id=eq.${sessionId}`
        },
        (payload) => {
          console.log('Player left:', payload);
          // Remove the player from the list
          setPlayers(prev => prev.filter(p => p.id !== (payload.old as Player).id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, navigate, toast]);

  // Helper function to get current customer ID
  const getCurrentCustomerId = () => {
    // Check URL parameters first (in case customer_id is in URL)
    const urlParams = new URLSearchParams(window.location.search);
    const urlCustomerId = urlParams.get('customer_id');
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
      const guestPlayerId = localStorage.getItem('guest_player_id');
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

      // Verify that the current user is actually in the players list
      const isPlayerInSession = data.players?.some(
        (player: Player) => player.player_id === currentPlayerId
      );

      if (!currentPlayerId || !isPlayerInSession) {
        toast({
          title: "Access Denied",
          description: "You must join with a lobby code and name to access this lobby",
          variant: "destructive",
        });
        navigate("/login");
        return;
      }

      setSession(data.session);
      setPlayers(data.players || []);
      
      // Set audio files from the response (edge function fetches them if user is host)
      setAudioFiles(data.audioFiles || []);
      console.log("Audio files from response:", data.audioFiles?.length || 0);
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
    if (!selectedAudio) {
      toast({
        title: "Record Audio",
        description: "Please record audio before starting the game",
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
        description: "The game has been started with the recorded audio.",
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

  const handleEndLobby = async () => {
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
    hasAudioFiles: audioFiles.length > 0
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
                  <AlertDialogAction onClick={handleEndLobby} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
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
            <CardDescription>
              {isHost ? "You are the host" : "You are a player in this lobby"}
            </CardDescription>
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

        {!isHost && session.status === "waiting" && (
          <Card>
            <CardHeader>
              <CardTitle>Waiting for Host</CardTitle>
              <CardDescription>The host will select audio and start the game</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Please wait while the host prepares the game...
              </p>
            </CardContent>
          </Card>
        )}

        {isHost && session.status === "waiting" && (
          <LobbyAudioRecording
            sessionId={sessionId || ''}
            customerId={currentCustomerId || ''}
            shopDomain={session.shop_domain}
            tenantId={session.tenant_id}
            onRecordingComplete={handleRecordingComplete}
            onStartGame={handleStartGame}
            hasRecording={!!selectedAudio}
          />
        )}

        {session.status === "active" && session.selected_audio_id && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Music className="mr-2 h-5 w-5" />
                Selected Audio
              </CardTitle>
              <CardDescription>Audio file for this game</CardDescription>
            </CardHeader>
            <CardContent>
              {(() => {
                console.log("Looking for audio ID:", session.selected_audio_id);
                console.log("Available audio files:", audioFiles);
                const selectedAudioFile = audioFiles.find(a => a.id === session.selected_audio_id);
                console.log("Found audio file:", selectedAudioFile);
                
                return selectedAudioFile ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 rounded-md bg-muted/50">
                      <div className="flex-1">
                        <p className="font-medium">{selectedAudioFile.filename}</p>
                        <p className="text-xs text-muted-foreground">
                          Selected on {new Date(session.started_at || '').toLocaleDateString()}
                        </p>
                      </div>
                      <Music className="h-5 w-5 text-primary" />
                    </div>
                    
                    {isHost ? (
                      <audio 
                        ref={audioRef}
                        controls 
                        className="w-full mt-2" 
                        preload="auto"
                        onPlay={() => console.log('Audio playing')}
                        onError={(e) => console.error('Audio error:', e)}
                      >
                        <source src={selectedAudioFile.audio_url} type="audio/mpeg" />
                        <source src={selectedAudioFile.audio_url} type="audio/mp3" />
                        Your browser does not support the audio element.
                      </audio>
                    ) : (
                      <div className="relative w-full mt-2">
                        <audio 
                          ref={audioRef}
                          className="w-full hidden" 
                          preload="auto"
                          onPlay={() => console.log('Audio playing')}
                          onError={(e) => console.error('Audio error:', e)}
                        >
                          <source src={selectedAudioFile.audio_url} type="audio/mpeg" />
                          <source src={selectedAudioFile.audio_url} type="audio/mp3" />
                          Your browser does not support the audio element.
                        </audio>
                        <div className="flex items-center justify-center p-4 bg-primary/10 rounded-lg">
                          <Music className="h-6 w-6 text-primary animate-pulse mr-2" />
                          <p className="text-sm font-medium">Audio will play automatically</p>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Loading audio details...</p>
                    <p className="text-xs text-muted-foreground">
                      Selected audio ID: {session.selected_audio_id}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Available audio count: {audioFiles.length}
                    </p>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
