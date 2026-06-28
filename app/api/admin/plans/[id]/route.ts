import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth/session';
import { requireSuperAdmin } from '@/lib/auth/super-admin';

export const dynamic = 'force-dynamic';

// PUT - Update a plan (SUPER_ADMIN only)
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    await requireSuperAdmin(session);

    const { id } = params;
    const body = await request.json();
    const { name, description, price, currency, interval, stripePriceId, features, category, isActive, isFeatured } = body;

    const plan = await prisma.plan.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(price !== undefined && { price: parseFloat(price) }),
        ...(currency !== undefined && { currency }),
        ...(interval !== undefined && { interval }),
        ...(stripePriceId !== undefined && { stripePriceId }),
        ...(features !== undefined && { features }),
        ...(category !== undefined && { category }),
        ...(isActive !== undefined && { isActive }),
        ...(isFeatured !== undefined && { isFeatured }),
      },
    });

    return NextResponse.json(plan);
  } catch (error) {
    console.error('[ADMIN_PLANS_PUT] Error:', error);
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Failed to update plan' }, { status: 500 });
  }
}

// DELETE - Delete a plan (SUPER_ADMIN only)
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    await requireSuperAdmin(session);

    const { id } = params;

    await prisma.plan.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[ADMIN_PLANS_DELETE] Error:', error);
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Failed to delete plan' }, { status: 500 });
  }
}
