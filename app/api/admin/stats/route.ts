import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { requireSuperAdmin } from '@/lib/auth/super-admin';
import { prisma } from '@/lib/db';
import { SubscriptionPlan } from '@prisma/client';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/stats
 * Return platform-wide metrics for SUPER_ADMIN
 */
export async function GET(request: Request) {
  try {
    const session = await getSession();

    try {
      requireSuperAdmin(session);
    } catch (error) {
      return NextResponse.json(
        { error: 'Forbidden: SUPER_ADMIN access required' },
        { status: 403 }
      );
    }

    // Calculate total tenants
    let totalTenants;
    try {
      totalTenants = await prisma.tenant.count();
    } catch (dbError) {
      console.error('[ADMIN_STATS] Database query error counting tenants:', dbError);
      return NextResponse.json(
        { error: 'Database query failed while counting tenants' },
        { status: 500 }
      );
    }

    // Calculate total revenue based on subscription plans
    // Pricing: FREE=$0, STARTER=$29, GROWTH=$99, AGENCY=$299
    const planPricing: Record<SubscriptionPlan, number> = {
      FREE: 0,
      STARTER: 29,
      GROWTH: 99,
      AGENCY: 299,
    };

    let tenantsByPlan;
    try {
      tenantsByPlan = await prisma.tenant.groupBy({
        by: ['subscriptionPlan'],
        _count: true,
      });
    } catch (dbError) {
      console.error('[ADMIN_STATS] Database query error grouping tenants by plan:', dbError);
      return NextResponse.json(
        { error: 'Database query failed while grouping tenants by plan' },
        { status: 500 }
      );
    }

    let totalRevenue = 0;
    for (const group of tenantsByPlan) {
      const plan = group.subscriptionPlan as SubscriptionPlan;
      const count = group._count;
      totalRevenue += (planPricing[plan] || 0) * count;
    }

    // Calculate total messages sent (all tenants combined)
    let totalMessages;
    try {
      totalMessages = await prisma.whatsAppMessageLog.count({
        where: {
          status: {
            in: ['SENT', 'DELIVERED', 'READ'],
          },
        },
      });
    } catch (dbError) {
      console.error('[ADMIN_STATS] Database query error counting total messages:', dbError);
      return NextResponse.json(
        { error: 'Database query failed while counting total messages' },
        { status: 500 }
      );
    }

    // Calculate active WhatsApp accounts
    let activeWhatsAppAccounts;
    try {
      activeWhatsAppAccounts = await prisma.whatsappAccount.count({
        where: {
          isActive: true,
          connectionStatus: 'CONNECTED',
        },
      });
    } catch (dbError) {
      console.error('[ADMIN_STATS] Database query error counting active WhatsApp accounts:', dbError);
      return NextResponse.json(
        { error: 'Database query failed while counting active WhatsApp accounts' },
        { status: 500 }
      );
    }

    // Calculate messages sent this month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    let messagesThisMonth;
    try {
      messagesThisMonth = await prisma.whatsAppMessageLog.count({
        where: {
          createdAt: {
            gte: startOfMonth,
          },
          status: {
            in: ['SENT', 'DELIVERED', 'READ'],
          },
        },
      });
    } catch (dbError) {
      console.error('[ADMIN_STATS] Database query error counting messages this month:', dbError);
      return NextResponse.json(
        { error: 'Database query failed while counting messages this month' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      totalTenants,
      totalRevenue,
      totalMessages,
      activeWhatsAppAccounts,
      messagesThisMonth,
      tenantsByPlan,
    });
  } catch (error) {
    console.error('[ADMIN_STATS] Error fetching admin stats:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
