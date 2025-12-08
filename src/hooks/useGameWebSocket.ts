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
  const isConnectingRef = useRef(false);
  const mountedRef = useRef(true);
  const lastConnectionParamsRef = useRef<string>('');
  
  // Use refs to avoid dependency changes triggering reconnects
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = undefined;
    }
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = undefined;
    }
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.onmessage = null;
      wsRef.current.onopen = null;
      wsRef.current.close();
      wsRef.current = null;
    }
    isConnectingRef.current = false;
    setIsConnected(false);
  }, []);

  const connect = useCallback(() => {
    if (!enabled || !sessionId || !playerId) {
      console.log('🔌 WebSocket not enabled or missing params:', { enabled, sessionId, playerId });
      return;
    }

    // Create a unique key for current connection params
    const connectionKey = `${sessionId}-${playerId}`;
    
    // Prevent duplicate connections
    if (isConnectingRef.current) {
      return;
    }

    // Already connected with same params
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && lastConnectionParamsRef.current === connectionKey) {
      return;
    }

    // If params changed, disconnect first
    if (wsRef.current && lastConnectionParamsRef.current !== connectionKey) {
      disconnect();
    }

    isConnectingRef.current = true;
    lastConnectionParamsRef.current = connectionKey;

    console.log('🔌 Connecting to WebSocket:', sessionId);

    const wsUrl = `wss://egrwijzbxxhkhrrelsgi.supabase.co/functions/v1/game-websocket?sessionId=${sessionId}&playerId=${playerId}&playerName=${encodeURIComponent(playerName)}`;
    
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) return;
        console.log('✅ WebSocket connected');
        reconnectAttemptsRef.current = 0;
        isConnectingRef.current = false;
        setIsConnected(true);

        if (heartbeatRef.current) {
          clearInterval(heartbeatRef.current);
        }
        heartbeatRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 30000);
      };

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'pong' || message.type === 'connected') return;
          onMessageRef.current(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onerror = () => {
        if (!mountedRef.current) return;
        isConnectingRef.current = false;
        setIsConnected(false);
      };

      ws.onclose = (event) => {
        if (!mountedRef.current) return;
        
        wsRef.current = null;
        isConnectingRef.current = false;
        setIsConnected(false);

        if (heartbeatRef.current) {
          clearInterval(heartbeatRef.current);
          heartbeatRef.current = undefined;
        }

        // Only reconnect if still mounted and enabled
        if (mountedRef.current && reconnectAttemptsRef.current < maxReconnectAttempts && enabled) {
          reconnectAttemptsRef.current++;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
          console.log(`🔄 Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            if (mountedRef.current) {
              connect();
            }
          }, delay);
        } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
          toast({
            title: "Connection Lost",
            description: "Real-time updates disconnected. Refresh to reconnect.",
            variant: "destructive",
          });
        }
      };
    } catch (error) {
      console.error('Error creating WebSocket:', error);
      isConnectingRef.current = false;
      setIsConnected(false);
    }
  }, [enabled, sessionId, playerId, playerName, toast, disconnect]);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
      return true;
    }
    return false;
  }, []);

  // Only run effect when key params change
  useEffect(() => {
    mountedRef.current = true;
    
    if (enabled && sessionId && playerId) {
      connect();
    }

    return () => {
      mountedRef.current = false;
      disconnect();
    };
  }, [sessionId, playerId, enabled]); // Remove connect/disconnect from deps

  return { sendMessage, disconnect, isConnected };
};
