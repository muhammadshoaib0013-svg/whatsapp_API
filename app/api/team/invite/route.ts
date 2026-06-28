import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { requireOwnerOrAdmin } from '@/lib/auth/permissions';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
import bcrypt from 'bcryptjs';

const inviteSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().min(1, 'Name is required'),
  role: z.enum(['OWNER', 'ADMIN', 'AGENT']).optional().default('AGENT'),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check permission: only OWNER and ADMIN can invite team members
    try {
      await requireOwnerOrAdmin();
    } catch (permError) {
      return NextResponse.json(
        { error: 'Forbidden: Only Owner and Admin can invite team members' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validationResult = inviteSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.errors },
        { status: 400 }
      );
    }

    const { email, name, role } = validationResult.data;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    let userId: string;

    if (existingUser) {
      // Check if user is already a team member of this tenant
      const existingTeamMember = await prisma.teamMember.findFirst({
        where: {
          userId: existingUser.id,
          tenantId: session.tenant.id,
        },
      });

      if (existingTeamMember) {
        return NextResponse.json(
          { error: 'User is already a member of this team' },
          { status: 400 }
        );
      }

      userId = existingUser.id;
    } else {
      // Generate a random password (since we don't have email server)
      const randomPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8);
      const passwordHash = await bcrypt.hash(randomPassword, 10);

      // Create new user
      const newUser = await prisma.user.create({
        data: {
          email,
          name,
          passwordHash,
        },
      });

      userId = newUser.id;
    }

    // Create team member
    const teamMember = await prisma.teamMember.create({
      data: {
        userId,
        tenantId: session.tenant.id,
        role: role as 'OWNER' | 'ADMIN' | 'AGENT',
      },
    });

    return NextResponse.json(
      {
        message: 'User created and added to team successfully',
        user: {
          id: userId,
          email,
          name,
        },
        teamMember: {
          id: teamMember.id,
          role: teamMember.role,
        },
        note: 'Since email notifications are not configured, please share the login credentials with the user manually.',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[TEAM_INVITE] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Fetch all team members for the current tenant
    const teamMembers = await prisma.teamMember.findMany({
      where: {
        tenantId: session.tenant.id,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return NextResponse.json({
      teamMembers: teamMembers.map((tm) => ({
        id: tm.id,
        role: tm.role,
        user: tm.user,
        createdAt: tm.createdAt,
      })),
    });
  } catch (error) {
    console.error('[TEAM_GET] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
