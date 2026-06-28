import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth/session';
import { requireSuperAdmin } from '@/lib/auth/super-admin';

// GET - List all plans (SUPER_ADMIN only)
export async function GET() {
  try {
    const session = await getSession();
    await requireSuperAdmin(session);

    const plans = await prisma.plan.findMany({
      orderBy: [
        { isFeatured: 'desc' },
        { price: 'asc' },
      ],
    });

    return NextResponse.json(plans);
  } catch (error) {
    console.error('[ADMIN_PLANS_GET] Error:', error);
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Failed to fetch plans' }, { status: 500 });
  }
}

// POST - Create a new plan (SUPER_ADMIN only)
export async function POST(request: Request) {
  try {
    const session = await getSession();
    await requireSuperAdmin(session);

    const body = await request.json();
    const { name, description, price, currency, interval, stripePriceId, features, category, isActive, isFeatured } = body;

    if (!name || price === undefined || !interval || !stripePriceId || !category) {
      return NextResponse.json(
        { error: 'Missing required fields: name, price, interval, stripePriceId, category' },
        { status: 400 }
      );
    }

    const plan = await prisma.plan.create({
      data: {
        name,
        description,
        price: parseFloat(price),
        currency: currency || 'USD',
        interval,
        stripePriceId,
        features: features || [],
        category,
        isActive: isActive !== undefined ? isActive : true,
        isFeatured: isFeatured !== undefined ? isFeatured : false,
      },
    });

    return NextResponse.json(plan, { status: 201 });
  } catch (error) {
    console.error('[ADMIN_PLANS_POST] Error:', error);
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Failed to create plan' }, { status: 500 });
  }
}
