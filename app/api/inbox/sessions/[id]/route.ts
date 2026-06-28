import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// Validation schema for updating a chat session
const updateSessionSchema = z.object({
  assignedToUserId: z.string().optional(),
  status: z.enum(['ACTIVE', 'CLOSED', 'ARCHIVED']).optional(),
});

/**
 * PATCH /api/inbox/sessions/[id]
 * Update a chat session (assign agent, change status, etc.)
 * STRICT: Only updates sessions belonging to the authenticated tenant
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = session.tenant.id;
    const sessionId = params.id;

    // Validate request body
    const body = await request.json();
    const validationResult = updateSessionSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: validationResult.error.errors },
        { status: 400 }
      );
    }

    const { assignedToUserId, status } = validationResult.data;

    // If assigning to a user, verify the user is a team member of this tenant
    if (assignedToUserId) {
      const teamMember = await prisma.teamMember.findFirst({
        where: {
          id: assignedToUserId,
          tenantId,
        },
      });

      if (!teamMember) {
        return NextResponse.json(
          { error: 'User is not a team member of this tenant' },
          { status: 400 }
        );
      }
    }

    // Update the chat session with tenant isolation
    const updatedSession = await prisma.chatSession.update({
      where: {
        id: sessionId,
        tenantId, // STRICT: Only update if session belongs to this tenant
      },
      data: {
        ...(assignedToUserId !== undefined && { assignedToUserId }),
        ...(status !== undefined && { status }),
      },
      include: {
        assignedToUser: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json(updatedSession);
  } catch (error) {
    console.error('[INBOX_SESSIONS_PATCH] Error:', error);
    
    if (error instanceof Error && error.message.includes('Record to update not found')) {
      return NextResponse.json(
        { error: 'Chat session not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update chat session' },
      { status: 500 }
    );
  }
}
