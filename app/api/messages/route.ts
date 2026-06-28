import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth, DatabaseUnavailableError } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

/**
 * GET /api/messages?chatSessionId={id}
 * 
 * Fetches messages for a specific chat session with strict tenant isolation.
 * 
 * Query Parameters:
 * - chatSessionId: The ID of the chat session to fetch messages for
 * 
 * Security:
 * - Requires authenticated session
 * - Enforces tenant isolation using tenantId from session
 * - Validates that the chat session belongs to the tenant
 * 
 * Returns:
 * - 200: Array of messages sorted by createdAt (ascending)
 * - 400: Missing chatSessionId parameter
 * - 401: Unauthorized (no valid session)
 * - 403: Forbidden (chat session doesn't belong to tenant)
 * - 404: Chat session not found
 * - 500: Internal server error
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate and get session with tenant information
    const session = await requireAuth();
    const tenantId = session.tenant.id;

    // Get chatSessionId from query parameters
    const { searchParams } = new URL(request.url);
    const chatSessionId = searchParams.get('chatSessionId');

    if (!chatSessionId) {
      return NextResponse.json(
        { error: 'chatSessionId parameter is required' },
        { status: 400 }
      );
    }

    // Verify that the chat session belongs to the tenant (security check)
    const chatSession = await prisma.chatSession.findFirst({
      where: {
        id: chatSessionId,
        tenantId, // STRICT: Tenant isolation
      },
    });

    if (!chatSession) {
      return NextResponse.json(
        { error: 'Chat session not found or access denied' },
        { status: 404 }
      );
    }

    // Fetch messages for the chat session with tenant isolation
    const messages = await prisma.message.findMany({
      where: {
        chatSessionId,
        tenantId, // STRICT: Tenant isolation
      },
      orderBy: {
        createdAt: 'asc', // Sort by createdAt ascending
      },
    });

    return NextResponse.json({
      messages,
      chatSession: {
        id: chatSession.id,
        customerPhoneNumber: chatSession.customerPhoneNumber,
        customerName: chatSession.customerName,
        status: chatSession.status,
      },
    });
  } catch (error) {
    // Handle database unavailability gracefully
    if (error instanceof DatabaseUnavailableError) {
      console.error('[MESSAGES_API] Database unavailable:', error.message);
      return NextResponse.json(
        { error: 'Database temporarily unavailable. Please retry.' },
        { status: 503 }
      );
    }

    // Handle unauthorized errors
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Handle other errors
    console.error('[MESSAGES_API] Error fetching messages:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
