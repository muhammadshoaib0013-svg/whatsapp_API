import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { DatabaseUnavailableError } from '@/lib/auth/session';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
import { requireOwnerOrAdmin } from '@/lib/auth/permissions';

const updateSettingsSchema = z.object({
  aiEnabled: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check permission: only OWNER and ADMIN can access settings
    try {
      await requireOwnerOrAdmin();
    } catch (permError) {
      return NextResponse.json(
        { error: 'Forbidden: Only Owner and Admin can access settings' },
        { status: 403 }
      );
    }

    // Fetch tenant settings
    const tenant = await prisma.tenant.findUnique({
      where: { id: session.tenant.id },
      select: {
        id: true,
        name: true,
        aiEnabled: true,
        subscriptionPlan: true,
        subscriptionStatus: true,
        trialEndsAt: true,
        stripeCustomerId: true,
      },
    });

    if (!tenant) {
      return NextResponse.json(
        { error: 'Tenant not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: tenant.id,
      name: tenant.name,
      aiEnabled: tenant.aiEnabled,
      subscriptionPlan: tenant.subscriptionPlan,
      subscriptionStatus: tenant.subscriptionStatus,
      trialEndsAt: tenant.trialEndsAt,
      stripeCustomerId: tenant.stripeCustomerId,
    });
  } catch (error) {
    if (error instanceof DatabaseUnavailableError) {
      return NextResponse.json(
        { error: 'Database temporarily unavailable. Please retry.' },
        { status: 503 }
      );
    }

    console.error('[SETTINGS_GET] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check permission: only OWNER and ADMIN can update settings
    try {
      await requireOwnerOrAdmin();
    } catch (permError) {
      return NextResponse.json(
        { error: 'Forbidden: Only Owner and Admin can update settings' },
        { status: 403 }
      );
    }

    const body = await request.json();
    
    // Validate request body
    const validationResult = updateSettingsSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.errors },
        { status: 400 }
      );
    }

    // Update tenant settings
    const updatedTenant = await prisma.tenant.update({
      where: { id: session.tenant.id },
      data: validationResult.data,
      select: {
        id: true,
        aiEnabled: true,
      },
    });

    return NextResponse.json({
      id: updatedTenant.id,
      aiEnabled: updatedTenant.aiEnabled,
    });
  } catch (error) {
    if (error instanceof DatabaseUnavailableError) {
      return NextResponse.json(
        { error: 'Database temporarily unavailable. Please retry.' },
        { status: 503 }
      );
    }

    console.error('[SETTINGS_PATCH] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
