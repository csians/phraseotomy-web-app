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
  console.log(`📡 Broadcasting "${message.type}" to session ${sessionId}: ${sessionClients.length} clients`);
  
  sessionClients.forEach((client) => {
    if (excludePlayerId && client.playerId === excludePlayerId) {
      return; // Don't send to the player who triggered the event
    }
    
    try {
      if (client.socket.readyState === WebSocket.OPEN) {
        client.socket.send(JSON.stringify(message));
        console.log(`   → Sent to ${client.playerName} (${client.playerId})`);
      }
    } catch (error) {
      console.error("Error broadcasting to client:", error);
    }
  });
};

// Broadcast to ALL clients in session including sender
const broadcastToAll = (sessionId: string, message: any) => {
  const sessionClients = clients.get(sessionId) || [];
  console.log(`📡 Broadcasting "${message.type}" to ALL in session ${sessionId}: ${sessionClients.length} clients`);
  
  sessionClients.forEach((client) => {
    try {
      if (client.socket.readyState === WebSocket.OPEN) {
        client.socket.send(JSON.stringify(message));
        console.log(`   → Sent to ${client.playerName} (${client.playerId})`);
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
    
    // Remove any existing connection for this player (prevent duplicates)
    const sessionClients = clients.get(sessionId)!;
    const existingIndex = sessionClients.findIndex(c => c.playerId === playerId);
    if (existingIndex !== -1) {
      console.log(`   Removing existing connection for ${playerName}`);
      sessionClients.splice(existingIndex, 1);
    }
    
    sessionClients.push({ socket, sessionId, playerId, playerName });
    console.log(`   Total clients in session: ${sessionClients.length}`);

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
      connectedPlayers: sessionClients.length,
    }));
  };

  socket.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      console.log(`📨 Received "${message.type}" from ${playerName} (${playerId})`);

      // Broadcast game events to all players in the session
      switch (message.type) {
        // ==================== LOBBY EVENTS ====================
        case "game_started":
          // Host started the game - notify ALL players
          broadcastToAll(sessionId, {
            type: "game_started",
            sessionId,
            startedBy: playerId,
            startedByName: playerName,
            timestamp: new Date().toISOString(),
          });
          break;

        case "lobby_ended":
          // Host ended the lobby - notify ALL players
          broadcastToAll(sessionId, {
            type: "lobby_ended",
            sessionId,
            endedBy: playerId,
            endedByName: playerName,
            timestamp: new Date().toISOString(),
          });
          break;

        // ==================== THEME EVENTS ====================
        case "theme_selected":
          // Storyteller selected a theme - notify ALL players
          broadcastToAll(sessionId, {
            type: "theme_selected",
            themeId: message.themeId,
            themeName: message.themeName,
            storytellerId: playerId,
            storytellerName: playerName,
            timestamp: new Date().toISOString(),
          });
          break;

        // ==================== ELEMENT EVENTS ====================
        case "elements_generated":
          // Elements have been generated for the turn - notify ALL
          broadcastToAll(sessionId, {
            type: "elements_generated",
            elements: message.elements,
            timestamp: new Date().toISOString(),
          });
          break;

        case "secret_element_selected":
          // Storyteller selected secret element
          // Confirm to storyteller
          socket.send(JSON.stringify({
            type: "secret_confirmed",
            elementId: message.elementId,
            timestamp: new Date().toISOString(),
          }));
          
          // Tell others storyteller is ready (but don't reveal the secret)
          broadcastToSession(sessionId, {
            type: "storyteller_ready",
            storytellerId: playerId,
            storytellerName: playerName,
            timestamp: new Date().toISOString(),
          }, playerId);
          break;

        // ==================== RECORDING EVENTS ====================
        case "recording_started":
          broadcastToSession(sessionId, {
            type: "recording_started",
            storytellerId: playerId,
            storytellerName: playerName,
            timestamp: new Date().toISOString(),
          }, playerId);
          break;

        case "recording_stopped":
          broadcastToSession(sessionId, {
            type: "recording_stopped",
            storytellerId: playerId,
            storytellerName: playerName,
            timestamp: new Date().toISOString(),
          }, playerId);
          break;

        case "recording_uploaded":
          // Audio recording uploaded - notify ALL players to start guessing
          broadcastToAll(sessionId, {
            type: "recording_uploaded",
            audioUrl: message.audioUrl,
            storytellerId: playerId,
            storytellerName: playerName,
            timestamp: new Date().toISOString(),
          });
          break;

        case "story_submitted":
          // Story is complete - notify ALL players
          broadcastToAll(sessionId, {
            type: "story_submitted",
            audioUrl: message.audioUrl,
            storytellerId: playerId,
            storytellerName: playerName,
            timestamp: new Date().toISOString(),
          });
          break;

        // ==================== GUESS EVENTS ====================
        case "guess_submitted":
          // Player submitted a guess - notify ALL
          broadcastToAll(sessionId, {
            type: "guess_submitted",
            playerId,
            playerName,
            isCorrect: message.isCorrect,
            pointsEarned: message.pointsEarned || 0,
            timestamp: new Date().toISOString(),
          });
          break;

        case "correct_answer":
          // Someone got the correct answer - notify ALL
          broadcastToAll(sessionId, {
            type: "correct_answer",
            winnerId: message.winnerId || playerId,
            winnerName: message.winnerName || playerName,
            pointsEarned: message.pointsEarned || 10,
            secretElement: message.secretElement,
            timestamp: new Date().toISOString(),
          });
          break;

        // ==================== TURN/ROUND EVENTS ====================
        case "turn_completed":
          // Current turn is complete - notify ALL
          broadcastToAll(sessionId, {
            type: "turn_completed",
            roundNumber: message.roundNumber,
            timestamp: new Date().toISOString(),
          });
          break;

        case "next_turn":
          // Moving to next turn - notify ALL
          broadcastToAll(sessionId, {
            type: "next_turn",
            roundNumber: message.roundNumber,
            newStorytellerId: message.newStorytellerId,
            newStorytellerName: message.newStorytellerName,
            timestamp: new Date().toISOString(),
          });
          break;

        case "game_completed":
          // Game is over - notify ALL
          broadcastToAll(sessionId, {
            type: "game_completed",
            winnerId: message.winnerId,
            winnerName: message.winnerName,
            finalScores: message.finalScores,
            timestamp: new Date().toISOString(),
          });
          break;

        // ==================== SCORE EVENTS ====================
        case "score_updated":
          // Player's score changed - notify ALL
          broadcastToAll(sessionId, {
            type: "score_updated",
            playerId: message.playerId,
            playerName: message.playerName,
            newScore: message.newScore,
            pointsEarned: message.pointsEarned,
            timestamp: new Date().toISOString(),
          });
          break;

        // ==================== UTILITY EVENTS ====================
        case "refresh_game_state":
          // Tell all clients to refresh from database
          broadcastToAll(sessionId, {
            type: "refresh_game_state",
            triggeredBy: playerId,
            timestamp: new Date().toISOString(),
          });
          break;

        case "ping":
          // Heartbeat - respond with pong
          socket.send(JSON.stringify({
            type: "pong",
            timestamp: new Date().toISOString(),
          }));
          break;

        default:
          console.log(`Unknown message type: ${message.type}`);
          // Forward unknown messages to all players (future-proofing)
          broadcastToAll(sessionId, {
            ...message,
            senderId: playerId,
            senderName: playerName,
            timestamp: new Date().toISOString(),
          });
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
      console.log(`   Session ${sessionId} has no more clients, removed from memory`);
    } else {
      clients.set(sessionId, updatedClients);
      console.log(`   Remaining clients in session: ${updatedClients.length}`);
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
    console.error(`WebSocket error for ${playerName}:`, error);
  };

  return response;
});
