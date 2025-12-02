import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAllUrlParams } from "@/lib/urlUtils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Users } from "lucide-react";

const GuestJoin = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [lobbyCode, setLobbyCode] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => {
    const checkAutoJoin = async () => {
      const urlParams = getAllUrlParams();
      const lobbyCodeParam = urlParams.get("lobbyCode");
      const guestDataStr = urlParams.get("guestData");
      const shop = urlParams.get("shop");

      // If no params, show the join form
      if (!lobbyCodeParam || !guestDataStr) {
        setShowForm(true);
        return;
      }

      // Auto-join flow with URL params
      setStatus("Joining lobby...");
      
      try {
        const guestData = JSON.parse(decodeURIComponent(guestDataStr));
        
        // Store guest data in BOTH storages for Shopify context
        sessionStorage.setItem("guest_player_id", guestData.player_id);
        sessionStorage.setItem("guestPlayerData", JSON.stringify(guestData));
        localStorage.setItem("guest_player_id", guestData.player_id);
        localStorage.setItem("guestPlayerData", JSON.stringify(guestData));
        if (shop) {
          localStorage.setItem("shop_domain", shop);
        }

        // Join the lobby using lobbyCode directly
        const { data: joinData, error: joinError } = await supabase.functions.invoke(
          "join-lobby",
          {
            body: {
              lobbyCode: lobbyCodeParam.toUpperCase(),
              playerName: guestData.name,
              playerId: guestData.player_id,
            },
          }
        );

        if (joinError) {
          console.error("Error joining lobby:", joinError);
          setStatus("Failed to join lobby");
          toast.error("Failed to join lobby. Please try again.");
          setShowForm(true);
          return;
        }

        if (joinData?.error) {
          console.error("Join lobby error:", joinData.error);
          setStatus(joinData.error);
          toast.error(joinData.error);
          setShowForm(true);
          return;
        }

        // Store session for persistence
        const sessionId = joinData?.session?.id;
        if (sessionId) {
          sessionStorage.setItem("current_lobby_session", sessionId);
        }

        setStatus("Success! Redirecting...");
        toast.success("Joined lobby successfully!");
        
        // Clean the URL before navigating
        window.history.replaceState({}, '', window.location.pathname + window.location.hash.split('?')[0]);
        
        // Navigate to lobby
        navigate(`/lobby/${sessionId}`, { replace: true });
      } catch (error) {
        console.error("Error in guest join:", error);
        setStatus("An error occurred");
        toast.error("Failed to join lobby");
        setShowForm(true);
      }
    };

    checkAutoJoin();
  }, [navigate]);

  const handleJoinLobby = async () => {
    if (!lobbyCode.trim()) {
      toast.error("Please enter a lobby code");
      return;
    }
    if (!playerName.trim()) {
      toast.error("Please enter your name");
      return;
    }

    setIsJoining(true);

    try {
      // Generate a unique player ID for guest
      const guestPlayerId = `guest_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      // Store guest data
      const guestData = {
        player_id: guestPlayerId,
        name: playerName.trim(),
      };
      sessionStorage.setItem("guest_player_id", guestPlayerId);
      sessionStorage.setItem("guestPlayerData", JSON.stringify(guestData));
      localStorage.setItem("guest_player_id", guestPlayerId);
      localStorage.setItem("guestPlayerData", JSON.stringify(guestData));

      const { data: joinData, error: joinError } = await supabase.functions.invoke(
        "join-lobby",
        {
          body: {
            lobbyCode: lobbyCode.toUpperCase().trim(),
            playerName: playerName.trim(),
            playerId: guestPlayerId,
          },
        }
      );

      if (joinError) {
        console.error("Error joining lobby:", joinError);
        toast.error("Failed to join lobby. Please try again.");
        setIsJoining(false);
        return;
      }

      if (joinData?.error) {
        console.error("Join lobby error:", joinData.error);
        toast.error(joinData.error);
        setIsJoining(false);
        return;
      }

      // Store session for persistence
      const sessionId = joinData?.session?.id;
      if (sessionId) {
        sessionStorage.setItem("current_lobby_session", sessionId);
      }

      toast.success("Joined lobby successfully!");
      navigate(`/lobby/${sessionId}`, { replace: true });
    } catch (error) {
      console.error("Error joining lobby:", error);
      toast.error("Failed to join lobby");
      setIsJoining(false);
    }
  };

  // Show loading state for auto-join
  if (status && !showForm) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-6 bg-primary rounded-2xl flex items-center justify-center">
            <span className="text-3xl font-black text-primary-foreground">P</span>
          </div>
          <h1 className="text-2xl font-bold text-primary mb-4">PHRASEOTOMY</h1>
          <div className="flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-muted-foreground">{status}</p>
          </div>
        </div>
      </div>
    );
  }

  // Show join form
  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-md mx-auto space-y-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/login")}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Home
        </Button>

        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 bg-primary rounded-2xl flex items-center justify-center">
            <span className="text-3xl font-black text-primary-foreground">P</span>
          </div>
          <h1 className="text-3xl font-bold text-primary">PHRASEOTOMY</h1>
          <p className="text-muted-foreground mt-2">Join a game lobby</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Join Game
            </CardTitle>
            <CardDescription>
              Enter the lobby code shared by the host to join their game
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="lobbyCode">Lobby Code</Label>
              <Input
                id="lobbyCode"
                placeholder="Enter 6-digit code"
                value={lobbyCode}
                onChange={(e) => setLobbyCode(e.target.value.toUpperCase())}
                maxLength={6}
                className="text-center text-xl font-bold tracking-widest"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="playerName">Your Name</Label>
              <Input
                id="playerName"
                placeholder="Enter your name"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
              />
            </div>
            <Button 
              className="w-full" 
              onClick={handleJoinLobby}
              disabled={isJoining || !lobbyCode.trim() || !playerName.trim()}
            >
              {isJoining ? (
                <>
                  <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2" />
                  Joining...
                </>
              ) : (
                "Join Game"
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default GuestJoin;