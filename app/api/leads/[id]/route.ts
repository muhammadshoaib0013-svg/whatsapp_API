import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// Validation schema for updating a lead
const updateLeadSchema = z.object({
  stage: z.enum(['NEW', 'INTERESTED', 'FOLLOW_UP', 'WON', 'LOST']).optional(),
  title: z.string().optional(),
  value: z.number().optional(),
  contactId: z.string().optional(),
  assignedToUserId: z.string().optional(),
});

/**
 * PATCH /api/leads/[id]
 * Update a lead (change stage, title, value, etc.)
 * STRICT: Only updates leads belonging to the authenticated tenant
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
    const leadId = params.id;

    // Validate request body
    const body = await request.json();
    const validationResult = updateLeadSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: validationResult.error.errors },
        { status: 400 }
      );
    }

    const { stage, title, value, contactId, assignedToUserId } = validationResult.data;

    // If contactId is provided, verify it belongs to the tenant
    if (contactId !== undefined) {
      const contact = await prisma.contact.findFirst({
        where: {
          id: contactId,
          tenantId,
        },
      });

      if (!contact) {
        return NextResponse.json(
          { error: 'Contact not found or does not belong to this tenant' },
          { status: 400 }
        );
      }
    }

    // If assignedToUserId is provided, verify it's a team member of this tenant
    if (assignedToUserId !== undefined) {
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

    // Update the lead with tenant isolation
    const updatedLead = await prisma.lead.update({
      where: {
        id: leadId,
        tenantId, // STRICT: Only update if lead belongs to this tenant
      },
      data: {
        ...(stage !== undefined && { stage }),
        ...(title !== undefined && { title }),
        ...(value !== undefined && { value }),
        ...(contactId !== undefined && { contactId }),
        ...(assignedToUserId !== undefined && { assignedToUserId }),
      },
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            phoneNumber: true,
          },
        },
      },
    });

    return NextResponse.json(updatedLead);
  } catch (error) {
    console.error('[LEADS_PATCH] Error:', error);
    
    if (error instanceof Error && error.message.includes('Record to update not found')) {
      return NextResponse.json(
        { error: 'Lead not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update lead' },
      { status: 500 }
    );
  }
}
