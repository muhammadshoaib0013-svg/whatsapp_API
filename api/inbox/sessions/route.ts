import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { z } from 'zod';

// Validation schema
const getSessionsSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  cursor: z.string().optional(),
  status: z.enum(['ACTIVE', 'CLOSED', 'ARCHIVED']).optional(),
  unreadOnly: z.coerce.boolean().optional(),
});

/**
 * GET /api/inbox/sessions
 * Fetch chat sessions for the authenticated tenant with pagination
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
    const validationResult = getSessionsSchema.safeParse({
      limit: searchParams.get('limit') || '50',
      cursor: searchParams.get('cursor') || undefined,
      status: searchParams.get('status') || undefined,
      unreadOnly: searchParams.get('unreadOnly') || undefined,
    });

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: validationResult.error.errors },
        { status: 400 }
      );
    }

    const { limit, cursor, status, unreadOnly } = validationResult.data;

    // Build query with tenant isolation
    const whereClause: any = {
      tenantId, // STRICT: Always filter by tenantId
    };

    if (status) {
      whereClause.status = status;
    }

    if (unreadOnly) {
      whereClause.unreadCount = { gt: 0 };
    }

    // Fetch chat sessions with pagination
    const sessions = await prisma.chatSession.findMany({
      where: whereClause,
      orderBy: { lastMessageAt: 'desc' },
      take: limit + 1, // Fetch one extra to determine if there's a next page
      cursor: cursor ? { id: cursor } : undefined,
      include: {
        whatsappAccount: {
          select: {
            id: true,
            displayName: true,
            businessPhoneNumber: true,
          },
        },
        _count: {
          select: { messages: true },
        },
      },
    });

    // Determine pagination
    let nextCursor: string | undefined;
    if (sessions.length > limit) {
      const nextItem = sessions.pop();
      nextCursor = nextItem!.id;
    }

    return NextResponse.json({
      sessions,
      nextCursor,
      hasMore: !!nextCursor,
    });
  } catch (error) {
    console.error('[INBOX_API_ERROR] GET sessions:', error instanceof Error ? error.stack : error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
