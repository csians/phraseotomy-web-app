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

        setStatus("Looking up lobby...");

        // First, find the session by lobby code
        const { data: session, error: sessionError } = await supabase
          .from("game_sessions")
          .select("id, status, tenant_id, shop_domain")
          .eq("lobby_code", lobbyCode.toUpperCase())
          .maybeSingle();

        if (sessionError || !session) {
          setStatus("Lobby not found");
          toast.error("Lobby not found. Please check the code and try again.");
          setTimeout(() => navigate("/login"), 2000);
          return;
        }

        if (session.status !== "waiting") {
          setStatus("Lobby is no longer accepting players");
          toast.error("This lobby is no longer accepting new players.");
          setTimeout(() => navigate("/login"), 2000);
          return;
        }

        setStatus("Joining lobby...");

        // Join the lobby
        const { data: joinData, error: joinError } = await supabase.functions.invoke(
          "join-lobby",
          {
            body: {
              session_id: session.id,
              player_id: guestData.player_id,
              player_name: guestData.name,
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

        // Store session for persistence
        sessionStorage.setItem("current_lobby_session", session.id);

        setStatus("Success! Redirecting...");
        toast.success("Joined lobby successfully!");
        
        // Navigate to lobby
        navigate(`/lobby/${session.id}`, { replace: true });
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
