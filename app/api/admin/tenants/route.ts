import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { requireSuperAdmin } from '@/lib/auth/super-admin';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/tenants
 * Return list of all tenants with their plans and message counts for SUPER_ADMIN
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

    // Get all tenants with their details
    let tenants;
    try {
      tenants = await prisma.tenant.findMany({
        select: {
          id: true,
          name: true,
          slug: true,
          subscriptionPlan: true,
          status: true,
          createdAt: true,
          _count: {
            select: {
              messageLogs: true,
              whatsappAccounts: true,
              teamMembers: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    } catch (dbError) {
      console.error('[ADMIN_TENANTS] Database query error fetching tenants:', dbError);
      return NextResponse.json(
        { error: 'Database query failed while fetching tenants' },
        { status: 500 }
      );
    }

    // Calculate message count for current month for each tenant
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const tenantsWithMessageCount = await Promise.all(
      tenants.map(async (tenant) => {
        try {
          const messageCount = await prisma.whatsAppMessageLog.count({
            where: {
              tenantId: tenant.id,
              createdAt: {
                gte: startOfMonth,
              },
              status: {
                in: ['SENT', 'DELIVERED', 'READ'],
              },
            },
          });

          return {
            id: tenant.id,
            name: tenant.name,
            slug: tenant.slug,
            subscriptionPlan: tenant.subscriptionPlan,
            status: tenant.status,
            createdAt: tenant.createdAt,
            messageCountThisMonth: messageCount,
            totalMessages: tenant._count.messageLogs,
            whatsappAccounts: tenant._count.whatsappAccounts,
            teamMembers: tenant._count.teamMembers,
          };
        } catch (countError) {
          console.error('[ADMIN_TENANTS] Error counting messages for tenant:', tenant.id, countError);
          // Return tenant with default count if query fails
          return {
            id: tenant.id,
            name: tenant.name,
            slug: tenant.slug,
            subscriptionPlan: tenant.subscriptionPlan,
            status: tenant.status,
            createdAt: tenant.createdAt,
            messageCountThisMonth: 0,
            totalMessages: tenant._count.messageLogs,
            whatsappAccounts: tenant._count.whatsappAccounts,
            teamMembers: tenant._count.teamMembers,
          };
        }
      })
    );

    return NextResponse.json({
      tenants: tenantsWithMessageCount,
      total: tenantsWithMessageCount.length,
    });
  } catch (error) {
    console.error('[ADMIN_TENANTS] Error fetching admin tenants:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
