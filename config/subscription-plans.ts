/**
 * Subscription Plans Configuration
 * Defines three tiers: FREE, PRO, and ENTERPRISE
 * Used for tenant limits and billing enforcement
 */

export interface PlanLimits {
  maxWabas: number;
  maxMessagesPerDay: number;
  maxCampaignsPerMonth: number;
  features: string[];
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  currency: string;
  interval: 'monthly' | 'yearly';
  limits: PlanLimits;
}

export const SUBSCRIPTION_PLANS: Record<string, SubscriptionPlan> = {
  FREE: {
    id: 'FREE',
    name: 'Free',
    price: 0,
    currency: 'USD',
    interval: 'monthly',
    limits: {
      maxWabas: 1,
      maxMessagesPerDay: 50,
      maxCampaignsPerMonth: 1,
      features: [
        '1 WhatsApp Business Account',
        '50 messages per day',
        '1 campaign per month',
        'Basic analytics',
        'Email support',
      ],
    },
  },
  PRO: {
    id: 'PRO',
    name: 'Pro',
    price: 49,
    currency: 'USD',
    interval: 'monthly',
    limits: {
      maxWabas: 3,
      maxMessagesPerDay: 5000,
      maxCampaignsPerMonth: -1, // -1 means unlimited
      features: [
        '3 WhatsApp Business Accounts',
        '5,000 messages per day',
        'Unlimited campaigns',
        'Advanced analytics',
        'Priority support',
        'API access',
        'Webhook integration',
      ],
    },
  },
  ENTERPRISE: {
    id: 'ENTERPRISE',
    name: 'Enterprise',
    price: 199,
    currency: 'USD',
    interval: 'monthly',
    limits: {
      maxWabas: -1, // -1 means unlimited
      maxMessagesPerDay: -1, // -1 means unlimited
      maxCampaignsPerMonth: -1, // -1 means unlimited
      features: [
        'Unlimited WhatsApp Business Accounts',
        'Unlimited messages per day',
        'Unlimited campaigns',
        'Custom integrations',
        'Dedicated support',
        'SLA guarantee',
        'Custom reporting',
        'White-label options',
        'Advanced security features',
      ],
    },
  },
};

/**
 * Get plan by ID
 */
export function getPlanById(planId: string): SubscriptionPlan | undefined {
  return SUBSCRIPTION_PLANS[planId];
}

/**
 * Get all available plans
 */
export function getAllPlans(): SubscriptionPlan[] {
  return Object.values(SUBSCRIPTION_PLANS);
}

/**
 * Check if a limit is unlimited
 */
export function isUnlimited(limit: number): boolean {
  return limit === -1;
}

/**
 * Get plan limits for a specific plan
 */
export function getPlanLimits(planId: string): PlanLimits | undefined {
  const plan = getPlanById(planId);
  return plan?.limits;
}

/**
 * Validate if a tenant can add a WABA based on their plan
 */
export function canAddWaba(planId: string, currentWabaCount: number): boolean {
  const limits = getPlanLimits(planId);
  if (!limits) return false;
  
  if (isUnlimited(limits.maxWabas)) return true;
  return currentWabaCount < limits.maxWabas;
}

/**
 * Validate if a tenant can send a message based on their plan
 */
export function canSendMessage(
  planId: string,
  messagesSentToday: number
): boolean {
  const limits = getPlanLimits(planId);
  if (!limits) return false;
  
  if (isUnlimited(limits.maxMessagesPerDay)) return true;
  return messagesSentToday < limits.maxMessagesPerDay;
}

/**
 * Validate if a tenant can create a campaign based on their plan
 */
export function canCreateCampaign(
  planId: string,
  campaignsCreatedThisMonth: number
): boolean {
  const limits = getPlanLimits(planId);
  if (!limits) return false;
  
  if (isUnlimited(limits.maxCampaignsPerMonth)) return true;
  return campaignsCreatedThisMonth < limits.maxCampaignsPerMonth;
}

/**
 * Get remaining messages for the day
 */
export function getRemainingMessages(
  planId: string,
  messagesSentToday: number
): number {
  const limits = getPlanLimits(planId);
  if (!limits) return 0;
  
  if (isUnlimited(limits.maxMessagesPerDay)) return -1; // -1 means unlimited
  return Math.max(0, limits.maxMessagesPerDay - messagesSentToday);
}

/**
 * Get remaining campaigns for the month
 */
export function getRemainingCampaigns(
  planId: string,
  campaignsCreatedThisMonth: number
): number {
  const limits = getPlanLimits(planId);
  if (!limits) return 0;
  
  if (isUnlimited(limits.maxCampaignsPerMonth)) return -1; // -1 means unlimited
  return Math.max(0, limits.maxCampaignsPerMonth - campaignsCreatedThisMonth);
}

/**
 * Get remaining WABA slots
 */
export function getRemainingWabaSlots(
  planId: string,
  currentWabaCount: number
): number {
  const limits = getPlanLimits(planId);
  if (!limits) return 0;
  
  if (isUnlimited(limits.maxWabas)) return -1; // -1 means unlimited
  return Math.max(0, limits.maxWabas - currentWabaCount);
}
