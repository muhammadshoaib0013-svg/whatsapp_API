/**
 * Inbox Stream Manager
 * Manages Server-Sent Events (SSE) connections for real-time inbox updates
 * Strict tenant isolation enforced
 */

interface Connection {
  id: string;
  tenantId: string;
  writable: any;
}

class InboxStreamManager {
  private connections: Map<string, Connection> = new Map();

  registerConnection(connectionId: string, tenantId: string, writable: any) {
    this.connections.set(connectionId, { id: connectionId, tenantId, writable });
    console.log('[INBOX_STREAM] Connection registered:', { connectionId, tenantId });
  }

  unregisterConnection(connectionId: string) {
    const connection = this.connections.get(connectionId);
    if (connection) {
      this.connections.delete(connectionId);
      console.log('[INBOX_STREAM] Connection unregistered:', connectionId);
    }
  }

  /**
   * Send an update to all connections for a specific tenant
   */
  sendToTenant(tenantId: string, data: any) {
    let sentCount = 0;

    for (const [connectionId, connection] of this.connections.entries()) {
      if (connection.tenantId === tenantId) {
        try {
          const message = `data: ${JSON.stringify(data)}\n\n`;
          connection.writable.write(message);
          sentCount++;
        } catch (error) {
          console.error('[INBOX_STREAM] Failed to send to connection:', connectionId, error);
          this.unregisterConnection(connectionId);
        }
      }
    }

    if (sentCount > 0) {
      console.log('[INBOX_STREAM] Sent update to tenant:', { tenantId, sentCount });
    }
  }

  /**
   * Broadcast a new message to all connections for a tenant
   */
  broadcastNewMessage(tenantId: string, message: any) {
    this.sendToTenant(tenantId, {
      type: 'new_message',
      data: message,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Broadcast a new chat session to all connections for a tenant
   */
  broadcastNewSession(tenantId: string, session: any) {
    this.sendToTenant(tenantId, {
      type: 'new_session',
      data: session,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Broadcast session update to all connections for a tenant
   */
  broadcastSessionUpdate(tenantId: string, session: any) {
    this.sendToTenant(tenantId, {
      type: 'session_update',
      data: session,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get connection count for a tenant
   */
  getConnectionCount(tenantId: string): number {
    let count = 0;
    for (const connection of this.connections.values()) {
      if (connection.tenantId === tenantId) {
        count++;
      }
    }
    return count;
  }

  /**
   * Get total connection count
   */
  getTotalConnections(): number {
    return this.connections.size;
  }
}

// Singleton instance
export const inboxStreamManager = new InboxStreamManager();
