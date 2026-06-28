import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// Validation schemas
const getMessagesSchema = z.object({
  chatSessionId: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  cursor: z.string().optional(),
});

const sendMessageSchema = z.object({
  chatSessionId: z.string(),
  content: z.string().min(1).max(4096),
  messageType: z.enum(['TEXT', 'IMAGE', 'DOCUMENT', 'AUDIO', 'VIDEO']).default('TEXT'),
});

/**
 * GET /api/inbox/messages
 * Fetch messages for a chat session with pagination
 * STRICT: All queries are scoped to the authenticated tenant
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = session.tenant.id;
    const { searchParams } = new URL(request.url);

    // Validate query parameters
    const validationResult = getMessagesSchema.safeParse({
      chatSessionId: searchParams.get('chatSessionId') || undefined,
      limit: searchParams.get('limit') || '50',
      cursor: searchParams.get('cursor') || undefined,
    });

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: validationResult.error.errors },
        { status: 400 }
      );
    }

    const { chatSessionId, limit, cursor } = validationResult.data;

    // If chatSessionId is provided, verify it belongs to the tenant
    if (chatSessionId) {
      const chatSession = await prisma.chatSession.findFirst({
        where: {
          id: chatSessionId,
          tenantId, // STRICT: Tenant isolation
        },
      });

      if (!chatSession) {
        return NextResponse.json(
          { error: 'Chat session not found' },
          { status: 404 }
        );
      }
    }

    // Build query with tenant isolation
    const whereClause: any = {
      tenantId, // STRICT: Always filter by tenantId
    };

    if (chatSessionId) {
      whereClause.chatSessionId = chatSessionId;
    }

    // Fetch messages with pagination
    const messages = await prisma.message.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: limit + 1, // Fetch one extra to determine if there's a next page
      cursor: cursor ? { id: cursor } : undefined,
      include: {
        chatSession: {
          select: {
            id: true,
            customerPhoneNumber: true,
            customerName: true,
          },
        },
      },
    });

    // Determine pagination
    let nextCursor: string | undefined;
    if (messages.length > limit) {
      const nextItem = messages.pop();
      nextCursor = nextItem!.id;
    }

    return NextResponse.json({
      messages,
      nextCursor,
      hasMore: !!nextCursor,
    });
  } catch (error) {
    console.error('[INBOX_API_ERROR] GET messages:', error instanceof Error ? error.stack : error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/inbox/messages
 * Send a message to a customer
 * STRICT: All operations are scoped to the authenticated tenant
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = session.tenant.id;

    // Validate request body
    const body = await request.json();
    const validationResult = sendMessageSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: validationResult.error.errors },
        { status: 400 }
      );
    }

    const { chatSessionId, content, messageType } = validationResult.data;

    // Verify chat session belongs to the tenant
    const chatSession = await prisma.chatSession.findFirst({
      where: {
        id: chatSessionId,
        tenantId, // STRICT: Tenant isolation
      },
      include: {
        whatsappAccount: {
          select: {
            id: true,
            displayName: true,
            businessPhoneNumber: true,
            connectionStatus: true,
          },
        },
      },
    });

    if (!chatSession) {
      return NextResponse.json(
        { error: 'Chat session not found' },
        { status: 404 }
      );
    }

    // Create message record
    const message = await prisma.message.create({
      data: {
        tenantId, // STRICT: Tenant isolation
        whatsappAccountId: chatSession.whatsappAccountId,
        chatSessionId,
        direction: 'OUTBOUND',
        content,
        messageType,
        status: 'SENT',
      },
    });

    // Update chat session
    await prisma.chatSession.update({
      where: { id: chatSessionId },
      data: {
        lastMessageAt: new Date(),
        lastMessagePreview: content.substring(0, 100),
      },
    });

    // TODO: Send message via WhatsApp API
    // This would involve calling the WhatsApp Cloud API to actually send the message
    // For now, we're just storing it in the database

    return NextResponse.json({
      message: 'Message sent successfully',
      messageId: message.id,
    });
  } catch (error) {
    console.error('[INBOX_API_ERROR] POST message:', error instanceof Error ? error.stack : error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
