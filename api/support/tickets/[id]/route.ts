import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { z } from 'zod';

// Validation schema for updating a ticket
const updateTicketSchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
});

/**
 * PATCH /api/support/tickets/[id]
 * Update a ticket status (for Super Admin to resolve)
 * STRICT: Only updates tickets belonging to the authenticated tenant
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
    const ticketId = params.id;

    // Validate request body
    const body = await request.json();
    const validationResult = updateTicketSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: validationResult.error.errors },
        { status: 400 }
      );
    }

    const { status, priority } = validationResult.data;

    // Update the ticket with tenant isolation
    const updatedTicket = await prisma.supportTicket.update({
      where: {
        id: ticketId,
        tenantId, // STRICT: Only update if ticket belongs to this tenant
      },
      data: {
        ...(status !== undefined && { status }),
        ...(priority !== undefined && { priority }),
      },
    });

    return NextResponse.json(updatedTicket);
  } catch (error) {
    console.error('[SUPPORT_TICKETS_PATCH] Error:', error);
    
    if (error instanceof Error && error.message.includes('Record to update not found')) {
      return NextResponse.json(
        { error: 'Ticket not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update ticket' },
      { status: 500 }
    );
  }
}
