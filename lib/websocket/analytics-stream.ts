/**
 * Real-Time Analytics Streaming Service
 * Server-Sent Events (SSE) implementation for real-time dashboard updates
 * Strict tenant isolation enforced
 */

import { getSession } from '@/lib/auth/session';

export interface AnalyticsStreamEvent {
  type: 'message_status' | 'metrics_update' | 'cache_invalidation' | 'campaign_progress';
  tenantId: string;
  whatsappAccountId?: string;
  campaignId?: string;
  data: {
    messageId?: string;
    status?: string;
    timestamp: string;
    [key: string]: any;
  };
}

/**
 * Analytics Stream Manager
 * Manages SSE connections for real-time analytics updates
 */
class AnalyticsStreamManager {
  private connections: Map<string, NodeJS.WritableStream> = new Map();
  private tenantConnections: Map<string, Set<string>> = new Map();

  /**
   * Register a new SSE connection for a tenant
   */
  registerConnection(connectionId: string, tenantId: string, stream: NodeJS.WritableStream): void {
    this.connections.set(connectionId, stream);
    
    if (!this.tenantConnections.has(tenantId)) {
      this.tenantConnections.set(tenantId, new Set());
    }
    this.tenantConnections.get(tenantId)!.add(connectionId);

    console.log(`[SSE] Connection registered: ${connectionId} for tenant: ${tenantId}`);
  }

  /**
   * Unregister a connection
   */
  unregisterConnection(connectionId: string): void {
    const stream = this.connections.get(connectionId);
    if (stream) {
      stream.end();
    }
    this.connections.delete(connectionId);

    // Remove from tenant connections
    for (const [tenantId, connectionSet] of this.tenantConnections.entries()) {
      if (connectionSet.has(connectionId)) {
        connectionSet.delete(connectionId);
        if (connectionSet.size === 0) {
          this.tenantConnections.delete(tenantId);
        }
        break;
      }
    }

    console.log(`[SSE] Connection unregistered: ${connectionId}`);
  }

  /**
   * Broadcast event to all connections for a specific tenant
   * Strict tenant isolation - only sends to connections for the specified tenant
   */
  broadcastToTenant(tenantId: string, event: AnalyticsStreamEvent): void {
    const connectionSet = this.tenantConnections.get(tenantId);
    
    if (!connectionSet || connectionSet.size === 0) {
      console.log(`[SSE] No active connections for tenant: ${tenantId}`);
      return;
    }

    const eventData = `data: ${JSON.stringify(event)}\n\n`;
    const deadConnections: string[] = [];

    connectionSet.forEach((connectionId) => {
      const stream = this.connections.get(connectionId);
      
      if (stream) {
        try {
          stream.write(eventData);
        } catch (error) {
          console.error(`[SSE] Error writing to connection ${connectionId}:`, error);
          deadConnections.push(connectionId);
        }
      } else {
        deadConnections.push(connectionId);
      }
    });

    // Clean up dead connections
    deadConnections.forEach((connectionId) => {
      this.unregisterConnection(connectionId);
    });

    console.log(`[SSE] Broadcast to ${connectionSet.size - deadConnections.length} connections for tenant: ${tenantId}`);
  }

  /**
   * Get connection count for a tenant
   */
  getConnectionCount(tenantId: string): number {
    return this.tenantConnections.get(tenantId)?.size || 0;
  }

  /**
   * Get total connection count
   */
  getTotalConnectionCount(): number {
    return this.connections.size;
  }
}

// Singleton instance
export const analyticsStreamManager = new AnalyticsStreamManager();

/**
 * Send analytics update event
 */
export function sendAnalyticsUpdate(tenantId: string, whatsappAccountId: string | undefined, data: any): void {
  const event: AnalyticsStreamEvent = {
    type: 'message_status',
    tenantId,
    whatsappAccountId,
    data: {
      ...data,
      timestamp: new Date().toISOString(),
    },
  };

  analyticsStreamManager.broadcastToTenant(tenantId, event);
}

/**
 * Send cache invalidation event
 */
export function sendCacheInvalidation(tenantId: string, whatsappAccountId: string | undefined): void {
  const event: AnalyticsStreamEvent = {
    type: 'cache_invalidation',
    tenantId,
    whatsappAccountId,
    data: {
      timestamp: new Date().toISOString(),
    },
  };

  analyticsStreamManager.broadcastToTenant(tenantId, event);
}

/**
 * Send campaign progress event
 */
export function sendCampaignProgress(
  tenantId: string,
  whatsappAccountId: string | undefined,
  campaignId: string,
  progress: {
    total: number;
    sent: number;
    delivered: number;
    read: number;
    failed: number;
    percentage: number;
    status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'PAUSED';
  }
): void {
  const event: AnalyticsStreamEvent = {
    type: 'campaign_progress',
    tenantId,
    whatsappAccountId,
    campaignId,
    data: {
      ...progress,
      timestamp: new Date().toISOString(),
    },
  };

  analyticsStreamManager.broadcastToTenant(tenantId, event);
}
