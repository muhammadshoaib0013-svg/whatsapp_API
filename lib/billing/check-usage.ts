import { prisma } from '@/lib/db';
import { SubscriptionPlan } from '@prisma/client';

/**
 * Get the message limit for a subscription plan
 */
function getPlanLimit(plan: SubscriptionPlan): number {
  switch (plan) {
    case 'STARTER':
      return 1000;
    case 'GROWTH':
      return 5000;
    case 'AGENCY':
      return 20000;
    case 'FREE':
      return 100;
    default:
      return 100;
  }
}

/**
 * Check if the tenant has exceeded their message limit for the current month
 * @param tenantId - The tenant ID to check
 * @returns Object with { allowed: boolean, limit: number, used: number, remaining: number }
 */
export async function checkUsageLimit(tenantId: string): Promise<{
  allowed: boolean;
  limit: number;
  used: number;
  remaining: number;
  plan: SubscriptionPlan;
}> {
  try {
    // Get the tenant's subscription plan
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { subscriptionPlan: true },
    });

    if (!tenant) {
      throw new Error('Tenant not found');
    }

    const plan = tenant.subscriptionPlan;
    const limit = getPlanLimit(plan);

    // Count messages sent in the current month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const messageCount = await prisma.whatsAppMessageLog.count({
      where: {
        tenantId,
        createdAt: {
          gte: startOfMonth,
        },
        status: {
          in: ['SENT', 'DELIVERED', 'READ'],
        },
      },
    });

    const used = messageCount;
    const remaining = Math.max(0, limit - used);
    const allowed = used < limit;

    return {
      allowed,
      limit,
      used,
      remaining,
      plan,
    };
  } catch (error) {
    console.error('[CHECK_USAGE] Error checking usage limit:', error);
    throw error;
  }
}

/**
 * Check usage limit and throw an error if exceeded
 * Use this in API routes to enforce limits
 */
export async function enforceUsageLimit(tenantId: string): Promise<void> {
  const usage = await checkUsageLimit(tenantId);

  if (!usage.allowed) {
    throw new Error(
      `Message limit exceeded for your plan (${usage.plan}). Limit: ${usage.limit}, Used: ${usage.used}. Please upgrade your subscription to continue sending messages.`
    );
  }
}
