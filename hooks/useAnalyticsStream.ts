/**
 * useAnalyticsStream Hook
 * React hook for consuming real-time analytics updates via SSE
 * Automatically handles connection, reconnection, and cleanup
 */

import { useEffect, useRef, useState, useCallback } from 'react';

export interface AnalyticsStreamEvent {
  type: 'message_status' | 'metrics_update' | 'cache_invalidation' | 'connection_established';
  tenantId: string;
  whatsappAccountId?: string;
  data: {
    messageId?: string;
    status?: string;
    timestamp: string;
    [key: string]: any;
  };
}

export interface UseAnalyticsStreamOptions {
  enabled?: boolean;
  onMessage?: (event: AnalyticsStreamEvent) => void;
  onError?: (error: Event) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export function useAnalyticsStream(options: UseAnalyticsStreamOptions = {}) {
  const {
    enabled = true,
    onMessage,
    onError,
    onConnect,
    onDisconnect,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<AnalyticsStreamEvent | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const MAX_RECONNECT_ATTEMPTS = 5;
  const RECONNECT_DELAY = 3000;

  // Use refs to store callbacks to prevent reconnection loops
  const onMessageRef = useRef(onMessage);
  const onErrorRef = useRef(onError);
  const onConnectRef = useRef(onConnect);
  const onDisconnectRef = useRef(onDisconnect);

  // Update refs when callbacks change
  useEffect(() => {
    onMessageRef.current = onMessage;
    onErrorRef.current = onError;
    onConnectRef.current = onConnect;
    onDisconnectRef.current = onDisconnect;
  }, [onMessage, onError, onConnect, onDisconnect]);

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    try {
      const eventSource = new EventSource('/api/analytics/stream');
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        console.log('[SSE] Connection established');
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;
        onConnectRef.current?.();
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as AnalyticsStreamEvent;
          setLastEvent(data);
          onMessageRef.current?.(data);
        } catch (error) {
          console.error('[SSE] Error parsing message:', error);
        }
      };

      eventSource.onerror = (error) => {
        console.error('[SSE] Connection error:', error);
        setIsConnected(false);
        onErrorRef.current?.(error);

        // Attempt reconnection
        if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttemptsRef.current++;
          console.log(`[SSE] Reconnecting... Attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS}`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, RECONNECT_DELAY);
        } else {
          console.error('[SSE] Max reconnection attempts reached');
          onDisconnectRef.current?.();
        }
      };

    } catch (error) {
      console.error('[SSE] Failed to create EventSource:', error);
      onErrorRef.current?.(error as Event);
    }
  }, []); // Empty dependency array since we use refs

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    setIsConnected(false);
    onDisconnectRef.current?.();
  }, []); // Empty dependency array since we use refs

  useEffect(() => {
    if (enabled) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [enabled, connect, disconnect]);

  return {
    isConnected,
    lastEvent,
    connect,
    disconnect,
  };
}
