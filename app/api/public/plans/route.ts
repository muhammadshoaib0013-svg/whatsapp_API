import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET - List all active plans (public endpoint for pricing page)
export async function GET() {
  try {
    const plans = await prisma.plan.findMany({
      where: {
        isActive: true,
      },
      orderBy: [
        { isFeatured: 'desc' },
        { price: 'asc' },
      ],
    });

    return NextResponse.json(plans);
  } catch (error) {
    console.error('[PUBLIC_PLANS_GET] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch plans' }, { status: 500 });
  }
}
