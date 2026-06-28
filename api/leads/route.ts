import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { z } from 'zod';

// Validation schema for creating a lead
const createLeadSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  stage: z.enum(['NEW', 'INTERESTED', 'FOLLOW_UP', 'WON', 'LOST']).optional(),
  value: z.number().optional(),
  contactId: z.string().optional(),
  assignedToUserId: z.string().optional(),
});

// GET - Fetch all leads for the tenant
export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const leads = await prisma.lead.findMany({
      where: {
        tenantId: session.tenant.id,
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
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json(leads);
  } catch (error) {
    console.error('[LEADS_GET] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 });
  }
}

// POST - Create a new lead
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validationResult = createLeadSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: validationResult.error.errors },
        { status: 400 }
      );
    }

    const { title, stage, value, contactId, assignedToUserId } = validationResult.data;

    // If contactId is provided, verify it belongs to the tenant
    if (contactId) {
      const contact = await prisma.contact.findFirst({
        where: {
          id: contactId,
          tenantId: session.tenant.id,
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
    if (assignedToUserId) {
      const teamMember = await prisma.teamMember.findFirst({
        where: {
          id: assignedToUserId,
          tenantId: session.tenant.id,
        },
      });

      if (!teamMember) {
        return NextResponse.json(
          { error: 'User is not a team member of this tenant' },
          { status: 400 }
        );
      }
    }

    const lead = await prisma.lead.create({
      data: {
        tenantId: session.tenant.id,
        title,
        stage: stage || 'NEW',
        value: value !== undefined ? value : null,
        contactId: contactId || null,
        assignedToUserId: assignedToUserId || null,
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

    return NextResponse.json(lead, { status: 201 });
  } catch (error) {
    console.error('[LEADS_POST] Error:', error);
    return NextResponse.json({ error: 'Failed to create lead' }, { status: 500 });
  }
}
