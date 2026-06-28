import { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { analyticsStreamManager } from '@/lib/websocket/analytics-stream';

// Force dynamic route to avoid static generation issues
export const dynamic = 'force-dynamic';

/**
 * Analytics Stream API (SSE)
 * Provides real-time analytics updates via Server-Sent Events
 * Strict tenant isolation enforced
 */
export async function GET(request: NextRequest) {
  try {
    // Get authenticated session
    const session = await getSession();

    if (!session) {
      return new Response('Unauthorized', { status: 401 });
    }

    const tenantId = session.tenant.id;

    // Create SSE stream
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        try {
          const connectionId = `${tenantId}-${Date.now()}-${Math.random()}`;

          // Custom writable stream for the manager
          const writableStream = {
            write: (data: string) => {
              try {
                controller.enqueue(encoder.encode(data));
              } catch (error) {
                console.error('[ANALYTICS_STREAM_ROUTE_ERROR] Write error:', error instanceof Error ? error.stack : error);
              }
            },
            end: () => {
              try {
                controller.close();
              } catch (error) {
                console.error('[ANALYTICS_STREAM_ROUTE_ERROR] End error:', error instanceof Error ? error.stack : error);
              }
            },
          };

          // Register connection
          try {
            analyticsStreamManager.registerConnection(connectionId, tenantId, writableStream as any);
          } catch (error) {
            console.error('[ANALYTICS_STREAM_ROUTE_ERROR] Register connection:', error instanceof Error ? error.stack : error);
          }

          // Send initial connection message
          const initialMessage = `data: ${JSON.stringify({
            type: 'connection_established',
            tenantId,
            timestamp: new Date().toISOString(),
          })}\n\n`;
          controller.enqueue(encoder.encode(initialMessage));

          // Send keepalive every 30 seconds
          const keepaliveInterval = setInterval(() => {
            try {
              controller.enqueue(encoder.encode(': keepalive\n\n'));
            } catch (error) {
              console.error('[ANALYTICS_STREAM_ROUTE_ERROR] Keepalive error:', error instanceof Error ? error.stack : error);
              clearInterval(keepaliveInterval);
            }
          }, 30000);

          // Cleanup on connection close
          request.signal.addEventListener('abort', () => {
            clearInterval(keepaliveInterval);
            try {
              analyticsStreamManager.unregisterConnection(connectionId);
            } catch (error) {
              console.error('[ANALYTICS_STREAM_ROUTE_ERROR] Unregister connection:', error instanceof Error ? error.stack : error);
            }
            try {
              controller.close();
            } catch (error: any) {
              if (error.code !== 'ERR_INVALID_STATE') {
                console.error('[ANALYTICS_STREAM_ROUTE_ERROR] Close stream:', error instanceof Error ? error.stack : error);
              }
            }
          });
        } catch (error) {
          console.error('[ANALYTICS_STREAM_ROUTE_ERROR] Stream start error:', error instanceof Error ? error.stack : error);
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable nginx buffering
      },
    });
  } catch (error) {
    console.error('[ANALYTICS_STREAM_ROUTE_ERROR] Request processing error:', error instanceof Error ? error.stack : error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
