import { prisma } from '@/lib/db';
import { decrypt } from '@/lib/security/encryption';
import { sendTemplateMessage } from '@/lib/whatsapp/cloud-api';
import { incrementCampaignAnalytics } from '@/lib/cache/analytics';
import { retryWithStandardBackoff, isRetryableError } from '@/lib/retry';
import { checkUsageLimit } from '@/lib/billing/check-usage';

const BATCH_SIZE = 50;
const RATE_LIMIT_DELAY_MS = 1500; // 1.5 seconds delay between batches for rate limiting

/**
 * Transform template components from GET format to SEND format
 * Meta API returns components with "text" property when fetching templates
 * But expects "parameters" array when sending templates
 * For templates without parameters (like hello_world), return empty array
 */
function transformComponentsForSend(componentsJson: any[]): any[] {
  console.log('[TRANSFORM_COMPONENTS] Input components:', JSON.stringify(componentsJson, null, 2));

  // If no components, return empty array
  if (!componentsJson || componentsJson.length === 0) {
    console.log('[TRANSFORM_COMPONENTS] No components, returning empty array');
    return [];
  }

  // Check if template has parameters (indicated by {{1}}, {{2}}, etc. in text)
  const hasParameters = componentsJson.some((comp) =>
    comp.text && (comp.text.includes('{{') || comp.example)
  );

  console.log('[TRANSFORM_COMPONENTS] Template has parameters:', hasParameters);

  // If template has no parameters, return empty array
  // This is for simple templates like hello_world
  if (!hasParameters) {
    console.log('[TRANSFORM_COMPONENTS] Template has no parameters, returning empty array');
    return [];
  }

  // Transform components with parameters
  const transformed = componentsJson
    .filter((comp) => comp.type === 'BODY')
    .map((comp) => ({
      type: 'body',
      parameters: comp.example?.body_text?.[0]?.map((value: string, index: number) => ({
        type: 'text',
        text: value,
      })) || [],
    }));

  console.log('[TRANSFORM_COMPONENTS] Transformed components:', JSON.stringify(transformed, null, 2));
  return transformed;
}

interface CampaignExecutionResult {
  processed: number;
  sent: number;
  failed: number;
  errors: string[];
}

/**
 * Process pending recipients for a campaign
 * Sends messages in batches and updates recipient status
 */
export async function processCampaignRecipients(
  campaignId: string,
  tenantId: string
): Promise<CampaignExecutionResult> {
  console.log('=== CAMPAIGN EXECUTION START ===');
  console.log('[CAMPAIGN_ID]', campaignId);
  console.log('[TENANT_ID]', tenantId);
  console.log('[QUEUE_PROCESSING] Starting campaign recipient processing');
  console.log('[QUEUE_PROCESSING] Campaign ID:', campaignId);
  console.log('[QUEUE_PROCESSING] Tenant ID:', tenantId);

  const result: CampaignExecutionResult = {
    processed: 0,
    sent: 0,
    failed: 0,
    errors: [],
  };

  try {
    // First, get campaign to check if it's an A/B test
    const campaignBasic = await prisma.campaign.findFirst({
      where: {
        id: campaignId,
        tenantId: tenantId,
      },
      select: {
        id: true,
        isAbTest: true,
        templateIdA: true,
        templateIdB: true,
      },
    });

    if (!campaignBasic) {
      throw new Error('Campaign not found');
    }

    // Get campaign details with appropriate template includes
    const campaign = await prisma.campaign.findFirst({
      where: {
        id: campaignId,
        tenantId: tenantId,
      },
      include: {
        template: true,
        ...(campaignBasic.isAbTest && campaignBasic.templateIdA && {
          templateA: {
            where: { id: campaignBasic.templateIdA },
          },
        }),
        ...(campaignBasic.isAbTest && campaignBasic.templateIdB && {
          templateB: {
            where: { id: campaignBasic.templateIdB },
          },
        }),
        account: true,
      },
    });

    console.log('[QUEUE_PROCESSING] Campaign found:', !!campaign);
    if (campaign) {
      console.log('[QUEUE_PROCESSING] Campaign status:', campaign.status);
      console.log('[QUEUE_PROCESSING] Campaign template:', campaign.template?.name);
      console.log('[QUEUE_PROCESSING] Campaign account:', campaign.account?.displayName);
    }

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    if (campaign.status !== 'SENDING') {
      throw new Error('Campaign is not in SENDING status');
    }

    // Check usage limit before processing campaign
    const usage = await checkUsageLimit(tenantId);
    console.log('[USAGE_CHECK] Plan:', usage.plan, 'Limit:', usage.limit, 'Used:', usage.used, 'Remaining:', usage.remaining);

    if (!usage.allowed) {
      console.error('[USAGE_CHECK] Message limit exceeded for campaign');
      throw new Error(`Message limit exceeded for your plan (${usage.plan}). Limit: ${usage.limit}, Used: ${usage.used}. Please upgrade your subscription to continue sending messages.`);
    }

    // Get pending recipients
    const pendingRecipients = await prisma.campaignRecipient.findMany({
      where: {
        campaignId: campaignId,
        tenantId: tenantId,
        status: 'PENDING',
        isValid: true,
      },
      take: BATCH_SIZE,
    });

    console.log('[QUEUE_PROCESSING] Pending recipients found:', pendingRecipients.length);

    if (pendingRecipients.length === 0) {
      console.log('[QUEUE_PROCESSING] No pending recipients to process');
      return result;
    }

    // Decrypt access token
    console.log('[QUEUE_PROCESSING] Decrypting access token');
    const accessToken = await decrypt(campaign.account.encryptedAccessToken);
    console.log('[QUEUE_PROCESSING] Access token decrypted successfully');

    // Process each recipient with isolated error handling
    for (const recipient of pendingRecipients) {
      // Isolated try/catch for each recipient to prevent single failure from stopping queue
      try {
        // Check campaign status before processing each recipient
        const currentCampaign = await prisma.campaign.findUnique({
          where: { id: campaignId },
          select: { status: true },
        });

        if (!currentCampaign || currentCampaign.status !== 'SENDING') {
          console.log('[CAMPAIGN_STATUS] Campaign status changed to:', currentCampaign?.status);
          console.log('[CAMPAIGN_STATUS] Stopping processing');
          break;
        }

        result.processed++;
        console.log('[RECIPIENT_PROCESSING] Processing recipient:', recipient.phoneNumber);

        try {
          // Mark as processing with idempotency check
          // Use optimistic locking to prevent concurrent processing
          const updateResult = await prisma.campaignRecipient.updateMany({
            where: {
              id: recipient.id,
              status: 'PENDING', // Only update if still PENDING
            },
            data: {
              status: 'PROCESSING',
            },
          });

          if (updateResult.count === 0) {
            console.log('[IDEMPOTENCY] Recipient already processed or in progress:', recipient.phoneNumber);
            continue; // Skip this recipient
          }

          console.log('[RECIPIENT_PROCESSING] Recipient marked as PROCESSING:', recipient.phoneNumber);

          // Determine which template to use (A/B testing logic)
          let selectedTemplate = campaign.template;
          let templateVariant = 'default';

          if (campaign.isAbTest && campaign.templateA && campaign.templateB) {
            // Alternate between Template A and Template B based on recipient index
            const recipientIndex = pendingRecipients.findIndex(r => r.id === recipient.id);
            const useTemplateA = recipientIndex % 2 === 0;
            selectedTemplate = useTemplateA ? campaign.templateA : campaign.templateB;
            templateVariant = useTemplateA ? 'A' : 'B';
            console.log('[AB_TEST] Using Template', templateVariant, 'for recipient:', recipient.phoneNumber);
          }

          // Parse template components and transform to send format
          console.log('[WHATSAPP_SEND] Template componentsJson:', JSON.stringify(selectedTemplate.componentsJson, null, 2));

          // Transform components from GET format to SEND format
          const components = transformComponentsForSend(selectedTemplate.componentsJson as any[]);

          console.log('[WHATSAPP_SEND] Transformed components for send:', JSON.stringify(components, null, 2));

          // Send message with retry logic
          console.log('[WHATSAPP_SEND] Sending message to:', recipient.phoneNumber);
          console.log('[WHATSAPP_SEND] Template:', selectedTemplate.name);
          console.log('[WHATSAPP_SEND] Template Variant:', templateVariant);
          console.log('[WHATSAPP_SEND] Phone number ID:', campaign.account.phoneNumberId);
          console.log('[WHATSAPP_SEND] Graph API version:', campaign.account.graphApiVersion);

          const retryResult = await retryWithStandardBackoff(
            async () => {
              return await sendTemplateMessage(
                campaign.account.phoneNumberId,
                recipient.phoneNumber,
                selectedTemplate.name,
                selectedTemplate.language,
                components,
                accessToken,
                campaign.account.graphApiVersion
              );
            },
            (attempt, error) => {
              console.log(`[RETRY] Attempt ${attempt} for recipient ${recipient.phoneNumber}:`, error.message);
            }
          );

          if (!retryResult.success || !retryResult.data) {
            throw new Error(`Failed to send message after ${retryResult.attempts} attempts: ${retryResult.error?.message}`);
          }

          const metaMessageId = retryResult.data;

          console.log('[WHATSAPP_RESPONSE] Message sent successfully');
          console.log('[WHATSAPP_RESPONSE] Meta message ID:', metaMessageId);
          console.log('[WHATSAPP_RESPONSE] Total attempts:', retryResult.attempts);

          // Update recipient status to SENT
          await prisma.campaignRecipient.update({
            where: { id: recipient.id },
            data: {
              status: 'SENT',
              metaMessageId: metaMessageId,
              sentAt: new Date(),
              metadata: {
                templateVariant: templateVariant,
                templateId: selectedTemplate.id,
              },
            },
          });

          console.log('[RECIPIENT_SENT] Recipient marked as SENT:', recipient.phoneNumber);

          // Increment Redis analytics counter for sent
          await incrementCampaignAnalytics(campaignId, 'sent');

          result.sent++;

          // Log message
          await prisma.whatsAppMessageLog.create({
            data: {
              tenantId: tenantId,
              whatsappAccountId: campaign.whatsappAccountId,
              templateId: selectedTemplate.id,
              toPhoneNumber: recipient.phoneNumber,
              messageType: 'template',
              status: 'SENT',
              metaMessageId: metaMessageId,
              requestJson: {
                campaignId: campaignId,
                recipientId: recipient.id,
                templateName: selectedTemplate.name,
                templateVariant: templateVariant,
                isAbTest: campaign.isAbTest,
              },
            },
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.log('[RECIPIENT_FAILED] Failed to send message to:', recipient.phoneNumber);
          console.log('[RECIPIENT_FAILED] Error:', errorMessage);

          // Update recipient status to FAILED
          await prisma.campaignRecipient.update({
            where: { id: recipient.id },
            data: {
              status: 'FAILED',
              errorMessage: errorMessage,
            },
          });

          result.failed++;
          result.errors.push(`${recipient.phoneNumber}: ${errorMessage}`);

          // Increment Redis analytics counter for failed
          await incrementCampaignAnalytics(campaignId, 'failed');

          // Move to Dead Letter Queue for permanent failures
          // Check if this is a permanent failure (not retryable)
          const isPermanentFailure = error instanceof Error && !isRetryableError(error);
          
          if (isPermanentFailure) {
            console.log('[DLQ] Moving recipient to Dead Letter Queue:', recipient.phoneNumber);
            
            // Check if already in DLQ to avoid duplicates
            const existingDLQEntry = await prisma.deadLetterQueue.findFirst({
              where: {
                campaignRecipientId: recipient.id,
              },
            });

            if (!existingDLQEntry) {
              await prisma.deadLetterQueue.create({
                data: {
                  campaignRecipientId: recipient.id,
                  campaignId: campaignId,
                  tenantId: tenantId,
                  phoneNumber: recipient.phoneNumber,
                  failureReason: errorMessage,
                  retryCount: 1,
                  metadata: {
                    recipientId: recipient.id,
                    campaignId: campaignId,
                    templateId: campaign.templateId,
                    errorType: 'permanent',
                  },
                },
              });
              console.log('[DLQ] Recipient added to Dead Letter Queue');
            } else {
              console.log('[DLQ] Recipient already in Dead Letter Queue, updating retry count');
              await prisma.deadLetterQueue.update({
                where: { id: existingDLQEntry.id },
                data: {
                  retryCount: existingDLQEntry.retryCount + 1,
                  lastAttemptAt: new Date(),
                },
              });
            }
          }
        }

        // Rate limiting: Add delay between each recipient to respect API limits
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY_MS));
      } catch (recipientError) {
        // This outer catch ensures that even if the inner error handling fails,
        // the queue loop continues to the next recipient
        console.error('[RECIPIENT_CRASH] Unexpected error processing recipient:', recipient.phoneNumber);
        console.error('[RECIPIENT_CRASH] Error:', recipientError);
        result.failed++;
        result.errors.push(`${recipient.phoneNumber}: CRASH - ${recipientError instanceof Error ? recipientError.message : 'Unknown error'}`);
      }
    }

    // Check if all recipients are processed
    const remainingPending = await prisma.campaignRecipient.count({
      where: {
        campaignId: campaignId,
        tenantId: tenantId,
        status: 'PENDING',
        isValid: true,
      },
    });

    console.log('[CAMPAIGN_COMPLETION] Remaining pending recipients:', remainingPending);

    // If no more pending recipients, determine final campaign status
    if (remainingPending === 0) {
      const totalRecipients = await prisma.campaignRecipient.count({
        where: {
          campaignId: campaignId,
          tenantId: tenantId,
          isValid: true,
        },
      });

      const sentCount = await prisma.campaignRecipient.count({
        where: {
          campaignId: campaignId,
          tenantId: tenantId,
          status: 'SENT',
          isValid: true,
        },
      });

      const failedCount = await prisma.campaignRecipient.count({
        where: {
          campaignId: campaignId,
          tenantId: tenantId,
          status: 'FAILED',
          isValid: true,
        },
      });

      console.log('[CAMPAIGN_COMPLETION] Total recipients:', totalRecipients);
      console.log('[CAMPAIGN_COMPLETION] Sent count:', sentCount);
      console.log('[CAMPAIGN_COMPLETION] Failed count:', failedCount);

      let finalStatus: 'COMPLETED' | 'FAILED' | 'COMPLETED_WITH_ERRORS';
      if (failedCount === 0) {
        finalStatus = 'COMPLETED';
      } else if (sentCount === 0) {
        finalStatus = 'FAILED';
      } else {
        finalStatus = 'COMPLETED_WITH_ERRORS';
      }

      console.log('[CAMPAIGN_COMPLETION] Final campaign status:', finalStatus);

      await prisma.campaign.update({
        where: { id: campaignId },
        data: { status: finalStatus },
      });

      console.log('[CAMPAIGN_COMPLETION] Campaign status updated to:', finalStatus);
    }

    return result;
  } catch (error) {
    console.error('Campaign execution error:', error);
    throw error;
  }
}

/**
 * Get the batch size constant
 */
export function getBatchSize(): number {
  return BATCH_SIZE;
}
