import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

interface ConnectedClient {
  socket: WebSocket;
  sessionId: string;
  playerId: string;
  playerName: string;
}

const clients = new Map<string, ConnectedClient[]>();

const broadcastToSession = (sessionId: string, message: any, excludePlayerId?: string) => {
  const sessionClients = clients.get(sessionId) || [];
  console.log(`📡 Broadcasting to session ${sessionId}: ${sessionClients.length} clients`);
  
  sessionClients.forEach((client) => {
    if (excludePlayerId && client.playerId === excludePlayerId) {
      return; // Don't send to the player who triggered the event
    }
    
    try {
      if (client.socket.readyState === WebSocket.OPEN) {
        client.socket.send(JSON.stringify(message));
      }
    } catch (error) {
      console.error("Error broadcasting to client:", error);
    }
  });
};

serve(async (req) => {
  const upgrade = req.headers.get("upgrade") || "";
  
  if (upgrade.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket", { status: 426 });
  }

  const url = new URL(req.url);
  const sessionId = url.searchParams.get("sessionId");
  const playerId = url.searchParams.get("playerId");
  const playerName = url.searchParams.get("playerName") || "Unknown";

  if (!sessionId || !playerId) {
    return new Response("Missing sessionId or playerId", { status: 400 });
  }

  const { socket, response } = Deno.upgradeWebSocket(req);

  socket.onopen = () => {
    console.log(`✅ WebSocket connected: Player ${playerName} (${playerId}) joined session ${sessionId}`);
    
    // Add client to session
    if (!clients.has(sessionId)) {
      clients.set(sessionId, []);
    }
    clients.get(sessionId)!.push({ socket, sessionId, playerId, playerName });

    // Notify others that player joined
    broadcastToSession(sessionId, {
      type: "player_joined",
      playerId,
      playerName,
      timestamp: new Date().toISOString(),
    }, playerId);

    // Send welcome message
    socket.send(JSON.stringify({
      type: "connected",
      message: "Connected to game session",
      sessionId,
      playerId,
    }));
  };

  socket.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      console.log(`📨 Received message from ${playerName}:`, message.type);

      // Broadcast game events to all players in the session
      switch (message.type) {
        case "theme_selected":
          broadcastToSession(sessionId, {
            type: "theme_selected",
            themeId: message.themeId,
            themeName: message.themeName,
            storytellerId: playerId,
            timestamp: new Date().toISOString(),
          });
          break;

        case "elements_generated":
          broadcastToSession(sessionId, {
            type: "elements_generated",
            elements: message.elements,
            timestamp: new Date().toISOString(),
          });
          break;

        case "secret_element_selected":
          // Only storyteller knows the secret element
          socket.send(JSON.stringify({
            type: "secret_confirmed",
            elementId: message.elementId,
            timestamp: new Date().toISOString(),
          }));
          
          // Tell others storyteller is ready to record
          broadcastToSession(sessionId, {
            type: "storyteller_ready",
            storytellerId: playerId,
            timestamp: new Date().toISOString(),
          }, playerId);
          break;

        case "recording_started":
          broadcastToSession(sessionId, {
            type: "recording_started",
            storytellerId: playerId,
            timestamp: new Date().toISOString(),
          }, playerId);
          break;

        case "recording_stopped":
          broadcastToSession(sessionId, {
            type: "recording_stopped",
            storytellerId: playerId,
            timestamp: new Date().toISOString(),
          }, playerId);
          break;

        case "story_submitted":
          broadcastToSession(sessionId, {
            type: "story_submitted",
            audioUrl: message.audioUrl,
            storytellerId: playerId,
            timestamp: new Date().toISOString(),
          });
          break;

        case "guess_submitted":
          broadcastToSession(sessionId, {
            type: "guess_submitted",
            playerId,
            playerName,
            timestamp: new Date().toISOString(),
          }, playerId);
          break;

        case "refresh_game_state":
          // Tell all clients to refresh from database
          broadcastToSession(sessionId, {
            type: "refresh_game_state",
            timestamp: new Date().toISOString(),
          });
          break;

        default:
          console.log(`Unknown message type: ${message.type}`);
      }
    } catch (error) {
      console.error("Error processing message:", error);
    }
  };

  socket.onclose = () => {
    console.log(`❌ WebSocket disconnected: Player ${playerName} (${playerId}) left session ${sessionId}`);
    
    // Remove client from session
    const sessionClients = clients.get(sessionId) || [];
    const updatedClients = sessionClients.filter((c) => c.playerId !== playerId);
    
    if (updatedClients.length === 0) {
      clients.delete(sessionId);
    } else {
      clients.set(sessionId, updatedClients);
    }

    // Notify others that player left
    broadcastToSession(sessionId, {
      type: "player_left",
      playerId,
      playerName,
      timestamp: new Date().toISOString(),
    });
  };

  socket.onerror = (error) => {
    console.error("WebSocket error:", error);
  };

  return response;
});