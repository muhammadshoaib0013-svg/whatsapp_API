/**
 * useCampaignProgress Hook
 * React hook for consuming real-time campaign progress updates via SSE
 * Automatically handles connection, reconnection, and cleanup
 */

import { useEffect, useRef, useState, useCallback } from 'react';

export interface CampaignProgressEvent {
  type: 'campaign_progress';
  tenantId: string;
  whatsappAccountId?: string;
  campaignId?: string;
  data: {
    total: number;
    sent: number;
    delivered: number;
    read: number;
    failed: number;
    percentage: number;
    status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'PAUSED';
    timestamp: string;
  };
}

export interface UseCampaignProgressOptions {
  campaignId?: string;
  enabled?: boolean;
  onProgress?: (event: CampaignProgressEvent) => void;
  onError?: (error: Event) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export function useCampaignProgress(options: UseCampaignProgressOptions = {}) {
  const {
    campaignId,
    enabled = true,
    onProgress,
    onError,
    onConnect,
    onDisconnect,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [progress, setProgress] = useState<CampaignProgressEvent | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const MAX_RECONNECT_ATTEMPTS = 5;
  const RECONNECT_DELAY = 3000;

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    try {
      const eventSource = new EventSource('/api/analytics/stream');
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        console.log('[SSE] Campaign progress connection established');
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;
        onConnect?.();
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as CampaignProgressEvent;
          
          // Only update if campaignId matches or if no campaignId filter
          if (!campaignId || data.campaignId === campaignId) {
            setProgress(data);
            onProgress?.(data);
          }
        } catch (error) {
          console.error('[SSE] Error parsing campaign progress message:', error);
        }
      };

      eventSource.onerror = (error) => {
        console.error('[SSE] Campaign progress connection error:', error);
        setIsConnected(false);
        onError?.(error);

        // Attempt reconnection
        if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttemptsRef.current++;
          console.log(`[SSE] Reconnecting... Attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS}`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, RECONNECT_DELAY);
        } else {
          console.error('[SSE] Max reconnection attempts reached');
          onDisconnect?.();
        }
      };
    } catch (error) {
      console.error('[SSE] Failed to create EventSource for campaign progress:', error);
      onError?.(error as Event);
    }
  }, [campaignId, onConnect, onError, onDisconnect, onProgress]);

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
    onDisconnect?.();
  }, [onDisconnect]);

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
    progress,
    connect,
    disconnect,
  };
}
