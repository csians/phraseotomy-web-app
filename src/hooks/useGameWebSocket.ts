import { useEffect, useRef, useCallback, useState } from 'react';
import { useToast } from '@/hooks/use-toast';

interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

interface UseGameWebSocketProps {
  sessionId: string;
  playerId: string;
  playerName: string;
  onMessage: (message: WebSocketMessage) => void;
  enabled?: boolean;
}

export const useGameWebSocket = ({
  sessionId,
  playerId,
  playerName,
  onMessage,
  enabled = true,
}: UseGameWebSocketProps) => {
  const wsRef = useRef<WebSocket | null>(null);
  const { toast } = useToast();
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 10;
  const [isConnected, setIsConnected] = useState(false);
  const heartbeatRef = useRef<NodeJS.Timeout>();

  const connect = useCallback(() => {
    if (!enabled || !sessionId || !playerId) {
      console.log('🔌 WebSocket not enabled or missing params:', { enabled, sessionId, playerId });
      return;
    }

    // Close existing connection if any
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      console.log('🔌 Closing existing WebSocket connection');
      wsRef.current.close();
    }

    // Use the full WebSocket URL for the edge function
    const wsUrl = `wss://egrwijzbxxhkhrrelsgi.supabase.co/functions/v1/game-websocket?sessionId=${sessionId}&playerId=${playerId}&playerName=${encodeURIComponent(playerName)}`;
    
    console.log('🔌 Connecting to WebSocket:', wsUrl);
    
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('✅ WebSocket connected successfully');
        reconnectAttemptsRef.current = 0;
        setIsConnected(true);

        // Start heartbeat to keep connection alive
        heartbeatRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 30000); // Ping every 30 seconds
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          // Ignore pong messages
          if (message.type === 'pong') return;
          
          console.log('📨 WebSocket message received:', message.type, message);
          onMessage(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        setIsConnected(false);
      };

      ws.onclose = (event) => {
        console.log('🔌 WebSocket disconnected:', event.code, event.reason);
        wsRef.current = null;
        setIsConnected(false);

        // Clear heartbeat
        if (heartbeatRef.current) {
          clearInterval(heartbeatRef.current);
        }

        // Attempt to reconnect with exponential backoff
        if (reconnectAttemptsRef.current < maxReconnectAttempts && enabled) {
          reconnectAttemptsRef.current++;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
          console.log(`🔄 Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
          toast({
            title: "Connection Lost",
            description: "Real-time updates disconnected. Refresh the page to reconnect.",
            variant: "destructive",
          });
        }
      };
    } catch (error) {
      console.error('Error creating WebSocket:', error);
      setIsConnected(false);
    }
  }, [enabled, sessionId, playerId, playerName, onMessage, toast]);

  const disconnect = useCallback(() => {
    console.log('🔌 Disconnecting WebSocket');
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      console.log('📤 Sending WebSocket message:', message.type, message);
      wsRef.current.send(JSON.stringify(message));
      return true;
    } else {
      console.warn('⚠️ WebSocket not connected, cannot send message:', message.type);
      return false;
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return { sendMessage, disconnect, isConnected };
};
