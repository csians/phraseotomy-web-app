import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAllUrlParams } from "@/lib/urlUtils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const GuestJoin = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState("Joining lobby...");

  useEffect(() => {
    const joinLobby = async () => {
      try {
        const urlParams = getAllUrlParams();
        const lobbyCode = urlParams.get("lobbyCode");
        const guestDataStr = urlParams.get("guestData");
        const shop = urlParams.get("shop");

        if (!lobbyCode || !guestDataStr) {
          setStatus("Missing lobby code or guest data");
          toast.error("Invalid join link");
          setTimeout(() => navigate("/login"), 2000);
          return;
        }

        const guestData = JSON.parse(decodeURIComponent(guestDataStr));
        
        // Store guest data in localStorage
        localStorage.setItem("guest_player_id", guestData.player_id);
        localStorage.setItem("guestPlayerData", JSON.stringify(guestData));
        if (shop) {
          localStorage.setItem("shop_domain", shop);
        }

        setStatus("Joining lobby...");

        // Join the lobby using lobbyCode directly
        const { data: joinData, error: joinError } = await supabase.functions.invoke(
          "join-lobby",
          {
            body: {
              lobbyCode: lobbyCode.toUpperCase(),
              playerName: guestData.name,
              playerId: guestData.player_id,
            },
          }
        );

        if (joinError) {
          console.error("Error joining lobby:", joinError);
          setStatus("Failed to join lobby");
          toast.error("Failed to join lobby. Please try again.");
          setTimeout(() => navigate("/login"), 2000);
          return;
        }

        if (joinData?.error) {
          console.error("Join lobby error:", joinData.error);
          setStatus(joinData.error);
          toast.error(joinData.error);
          setTimeout(() => navigate("/login"), 2000);
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
        setTimeout(() => navigate("/login"), 2000);
      }
    };

    joinLobby();
  }, [navigate]);

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
};

export default GuestJoin;
