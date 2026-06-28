import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';

// Force dynamic route to avoid static generation issues
export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/grant-super-admin
 * TEMPORARY HELPER: Grant SUPER_ADMIN role to current user
 * REMOVE THIS FILE AFTER USE
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Update the current user's role to SUPER_ADMIN
    const updatedMember = await prisma.teamMember.updateMany({
      where: {
        userId: session.user.id,
        tenantId: session.tenant.id,
      },
      data: {
        role: 'SUPER_ADMIN',
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Role updated to SUPER_ADMIN',
      updatedCount: updatedMember.count,
    });
  } catch (error) {
    console.error('[GRANT_SUPER_ADMIN] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
