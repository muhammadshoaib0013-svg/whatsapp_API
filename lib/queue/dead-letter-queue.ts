/**
 * Dead-Letter Queue (DLQ) for Failed Recipients
 * Handles permanently failed recipients for manual review and retry
 */

import { prisma } from '@/lib/db';

export interface DLQEntry {
  id: string;
  campaignRecipientId: string;
  campaignId: string;
  tenantId: string;
  phoneNumber: string;
  failureReason: string;
  retryCount: number;
  lastAttemptAt: Date;
  metadata?: Record<string, any>;
}

export interface DLQStats {
  totalEntries: number;
  byCampaign: Record<string, number>;
  byReason: Record<string, number>;
  recentFailures: number;
}

/**
 * Add a failed recipient to the Dead-Letter Queue
 */
export async function addToDLQ(
  campaignRecipientId: string,
  failureReason: string,
  metadata?: Record<string, any>
): Promise<void> {
  const recipient = await prisma.campaignRecipient.findUnique({
    where: { id: campaignRecipientId },
    include: { campaign: true },
  });

  if (!recipient) {
    throw new Error(`Campaign recipient ${campaignRecipientId} not found`);
  }

  // Check if already in DLQ
  const existingDLQ = await prisma.deadLetterQueue.findFirst({
    where: { campaignRecipientId },
  });

  if (existingDLQ) {
    // Update existing entry
    await prisma.deadLetterQueue.update({
      where: { id: existingDLQ.id },
      data: {
        failureReason,
        retryCount: existingDLQ.retryCount + 1,
        lastAttemptAt: new Date(),
        metadata: {
          ...(existingDLQ.metadata as Record<string, any> || {}),
          ...metadata,
        },
      },
    });
  } else {
    // Create new DLQ entry
    await prisma.deadLetterQueue.create({
      data: {
        campaignRecipientId,
        campaignId: recipient.campaignId,
        tenantId: recipient.tenantId,
        phoneNumber: recipient.phoneNumber,
        failureReason,
        retryCount: 1,
        lastAttemptAt: new Date(),
        metadata,
      },
    });
  }

  console.log(`[DLQ] Added recipient ${recipient.phoneNumber} to DLQ: ${failureReason}`);
}

/**
 * Get all DLQ entries for a tenant
 */
export async function getDLQEntries(
  tenantId: string,
  campaignId?: string,
  limit: number = 100,
  offset: number = 0
): Promise<DLQEntry[]> {
  const where: any = { tenantId };

  if (campaignId) {
    where.campaignId = campaignId;
  }

  const entries = await prisma.deadLetterQueue.findMany({
    where,
    orderBy: { lastAttemptAt: 'desc' },
    take: limit,
    skip: offset,
  });

  return entries.map(entry => ({
    id: entry.id,
    campaignRecipientId: entry.campaignRecipientId,
    campaignId: entry.campaignId,
    tenantId: entry.tenantId,
    phoneNumber: entry.phoneNumber,
    failureReason: entry.failureReason,
    retryCount: entry.retryCount,
    lastAttemptAt: entry.lastAttemptAt,
    metadata: entry.metadata as Record<string, any> | undefined,
  }));
}

/**
 * Get DLQ statistics for a tenant
 */
export async function getDLQStats(tenantId: string): Promise<DLQStats> {
  const totalEntries = await prisma.deadLetterQueue.count({
    where: { tenantId },
  });

  const entriesByCampaign = await prisma.deadLetterQueue.groupBy({
    by: ['campaignId'],
    where: { tenantId },
    _count: { id: true },
  });

  const byCampaign: Record<string, number> = {};
  entriesByCampaign.forEach(group => {
    byCampaign[group.campaignId] = group._count.id;
  });

  const entriesByReason = await prisma.deadLetterQueue.groupBy({
    by: ['failureReason'],
    where: { tenantId },
    _count: { id: true },
  });

  const byReason: Record<string, number> = {};
  entriesByReason.forEach(group => {
    byReason[group.failureReason] = group._count.id;
  });

  // Count recent failures (last 24 hours)
  const recentFailures = await prisma.deadLetterQueue.count({
    where: {
      tenantId,
      lastAttemptAt: {
        gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
    },
  });

  return {
    totalEntries,
    byCampaign,
    byReason,
    recentFailures,
  };
}

/**
 * Retry a DLQ entry (remove from DLQ and reset recipient status)
 */
export async function retryDLQEntry(dlqEntryId: string): Promise<void> {
  const dlqEntry = await prisma.deadLetterQueue.findUnique({
    where: { id: dlqEntryId },
  });

  if (!dlqEntry) {
    throw new Error(`DLQ entry ${dlqEntryId} not found`);
  }

  // Reset recipient status to PENDING
  await prisma.campaignRecipient.update({
    where: { id: dlqEntry.campaignRecipientId },
    data: {
      status: 'PENDING',
      errorMessage: null,
      metaMessageId: null,
      sentAt: null,
      deliveredAt: null,
      readAt: null,
    },
  });

  // Remove from DLQ
  await prisma.deadLetterQueue.delete({
    where: { id: dlqEntryId },
  });

  console.log(`[DLQ] Retried recipient ${dlqEntry.phoneNumber} (removed from DLQ)`);
}

/**
 * Batch retry multiple DLQ entries
 */
export async function batchRetryDLQEntries(dlqEntryIds: string[]): Promise<{
  successful: number;
  failed: number;
  errors: string[];
}> {
  let successful = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const entryId of dlqEntryIds) {
    try {
      await retryDLQEntry(entryId);
      successful++;
    } catch (error) {
      failed++;
      errors.push(`${entryId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return { successful, failed, errors };
}

/**
 * Delete a DLQ entry (permanently remove, no retry)
 */
export async function deleteDLQEntry(dlqEntryId: string): Promise<void> {
  await prisma.deadLetterQueue.delete({
    where: { id: dlqEntryId },
  });

  console.log(`[DLQ] Deleted DLQ entry ${dlqEntryId}`);
}

/**
 * Clear all DLQ entries for a campaign
 */
export async function clearDLQForCampaign(campaignId: string): Promise<number> {
  const result = await prisma.deadLetterQueue.deleteMany({
    where: { campaignId },
  });

  console.log(`[DLQ] Cleared ${result.count} DLQ entries for campaign ${campaignId}`);
  return result.count;
}

/**
 * Auto-retry DLQ entries that are eligible for retry
 * (e.g., after a certain time period or if retry count is below threshold)
 */
export async function autoRetryEligibleDLQEntries(
  tenantId: string,
  maxRetryCount: number = 3,
  minHoursSinceLastAttempt: number = 24
): Promise<number> {
  const eligibleEntries = await prisma.deadLetterQueue.findMany({
    where: {
      tenantId,
      retryCount: { lt: maxRetryCount },
      lastAttemptAt: {
        lte: new Date(Date.now() - minHoursSinceLastAttempt * 60 * 60 * 1000),
      },
    },
  });

  let retried = 0;
  for (const entry of eligibleEntries) {
    try {
      await retryDLQEntry(entry.id);
      retried++;
    } catch (error) {
      console.error(`[DLQ] Auto-retry failed for entry ${entry.id}:`, error);
    }
  }

  console.log(`[DLQ] Auto-retried ${retried} eligible entries`);
  return retried;
}
