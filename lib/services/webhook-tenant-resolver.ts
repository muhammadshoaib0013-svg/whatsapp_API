import { prisma } from '@/lib/db';

/**
 * Resolve tenant by webhook phoneNumberId
 * This function performs a secure database lookup to determine which tenant
 * owns the WhatsApp account that received the webhook.
 * 
 * @param phoneNumberId - The WhatsApp Phone Number ID from the webhook payload
 * @returns Object containing tenantId, whatsappAccountId, and businessPhoneNumber
 * @throws Error if phoneNumberId is not found (CRITICAL_SECURITY_EVENT)
 */
export async function resolveTenantByWebhook(phoneNumberId: string) {
  if (!phoneNumberId) {
    console.error('[WEBHOOK_TENANT_RESOLVER] phoneNumberId is missing');
    throw new Error('phoneNumberId is required');
  }

  const account = await prisma.whatsappAccount.findFirst({
    where: { phoneNumberId },
    select: {
      id: true,
      tenantId: true,
      businessPhoneNumber: true,
      displayName: true,
    },
  });

  if (!account) {
    console.error('[CRITICAL_SECURITY_EVENT] Webhook received for unknown phoneNumberId:', phoneNumberId);
    throw new Error('WhatsApp account not found for phoneNumberId');
  }

  if (process.env.NODE_ENV === 'development') {
    console.log('[WEBHOOK_TENANT_RESOLVER] Resolved tenant:', {
      phoneNumberId,
      tenantId: account.tenantId,
      whatsappAccountId: account.id,
      businessPhoneNumber: account.businessPhoneNumber,
    });
  }

  return {
    tenantId: account.tenantId,
    whatsappAccountId: account.id,
    businessPhoneNumber: account.businessPhoneNumber,
    displayName: account.displayName,
  };
}
