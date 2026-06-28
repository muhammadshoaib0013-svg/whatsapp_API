import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { DatabaseUnavailableError } from '@/lib/auth/session';
import { AuditAction } from '@prisma/client';
import { sendTemplateMessage, decryptWhatsAppTokenSafely, getWhatsAppAccountForTenant } from '@/lib/whatsapp/cloud-api';

/**
 * Transform template components from GET format to SEND format
 * Meta API returns components with "text" property when fetching templates
 * But expects "parameters" array when sending templates
 * For templates without parameters (like hello_world), return empty array
 */
function transformComponentsForSend(componentsJson: any[]): any[] {
  // If no components, return empty array
  if (!componentsJson || componentsJson.length === 0) {
    return [];
  }

  // Check if template has parameters (indicated by {{1}}, {{2}}, etc. in text)
  const hasParameters = componentsJson.some((comp) =>
    comp.text && (comp.text.includes('{{') || comp.example)
  );

  // If template has no parameters, return empty array
  // This is for simple templates like hello_world
  if (!hasParameters) {
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

  return transformed;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Find campaign and verify ownership
    const campaign = await prisma.campaign.findFirst({
      where: {
        id: params.id,
        tenantId: session.tenant.id,
      },
    });

    if (!campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      );
    }

    // Only allow resuming PAUSED campaigns
    if (campaign.status !== 'PAUSED') {
      return NextResponse.json(
        { error: 'Only PAUSED campaigns can be resumed' },
        { status: 400 }
      );
    }

    // Update campaign status to SENDING and set resumedAt
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: {
        status: 'SENDING',
        resumedAt: new Date(),
      },
    });

    // Log CAMPAIGN_RESUMED to AuditLog
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        tenantId: session.tenant.id,
        action: 'CAMPAIGN_RESUMED' as any,
        metadata: {
          campaignId: campaign.id,
          campaignName: campaign.name,
        },
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    });

    // Fetch campaign with recipients for send loop
    const campaignWithRecipients = await prisma.campaign.findFirst({
      where: {
        id: params.id,
        tenantId: session.tenant.id,
      },
      include: {
        account: {
          select: {
            id: true,
            displayName: true,
            businessPhoneNumber: true,
            connectionStatus: true,
          },
        },
        template: {
          select: {
            id: true,
            name: true,
            language: true,
            status: true,
            componentsJson: true, // Needed for send transformation
          },
        },
        recipients: {
          where: { isValid: true },
        },
      },
    });

    if (!campaignWithRecipients) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      );
    }

    // Start the send loop for remaining recipients (synchronous)
    let successCount = 0;
    let failureCount = 0;
    let consecutiveFailures = 0;
    const MAX_CONSECUTIVE_FAILURES = 3;

    // Get WhatsApp account and decrypt token
    const account = await getWhatsAppAccountForTenant(session.tenant.id);
    const accessToken = await decryptWhatsAppTokenSafely(account.encryptedAccessToken);

    for (const recipient of campaignWithRecipients.recipients) {
      try {
        // Check if already sent (skip already sent recipients)
        const existingLog = await prisma.whatsAppMessageLog.findFirst({
          where: {
            campaignId: campaign.id,
            toPhoneNumber: recipient.phoneNumber,
          },
        });

        if (existingLog) {
          continue; // Skip already sent recipients
        }

        // Transform components from GET format to SEND format
        const components = transformComponentsForSend(campaignWithRecipients.template.componentsJson as any[]);

        // Send message to Meta
        const metaMessageId = await sendTemplateMessage(
          account.phoneNumberId,
          recipient.phoneNumber,
          campaignWithRecipients.template.name,
          campaignWithRecipients.template.language,
          components,
          accessToken,
          account.graphApiVersion
        );

        // Record success in WhatsAppMessageLog
        await prisma.whatsAppMessageLog.create({
          data: {
            tenantId: session.tenant.id,
            whatsappAccountId: account.id,
            templateId: campaignWithRecipients.template.id,
            campaignId: campaign.id,
            toPhoneNumber: recipient.phoneNumber,
            messageType: 'TEMPLATE',
            status: 'SENT',
            metaMessageId: metaMessageId,
            requestJson: {},
            errorMessage: null,
            sentAt: new Date(),
          },
        });

        // Update recipient status
        await prisma.campaignRecipient.update({
          where: { id: recipient.id },
          data: {
            status: 'SENT',
            sentAt: new Date(),
          },
        });

        successCount++;
        consecutiveFailures = 0;

        // Add 100ms delay between sends (rate limiting)
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error('[CAMPAIGN_RESUME] Failed to send to recipient:', recipient.phoneNumber, error);

        // Record failure in WhatsAppMessageLog
        await prisma.whatsAppMessageLog.create({
          data: {
            tenantId: session.tenant.id,
            whatsappAccountId: account.id,
            templateId: campaignWithRecipients.template.id,
            campaignId: campaign.id,
            toPhoneNumber: recipient.phoneNumber,
            messageType: 'TEMPLATE',
            status: 'FAILED',
            metaMessageId: null,
            requestJson: {},
            errorMessage: 'Failed to send message via WhatsApp API',
          },
        });

        // Update recipient status
        await prisma.campaignRecipient.update({
          where: { id: recipient.id },
          data: {
            status: 'FAILED',
            errorMessage: 'Failed to send message',
          },
        });

        failureCount++;
        consecutiveFailures++;

        // Auto-pause if 3 consecutive failures
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          await prisma.campaign.update({
            where: { id: params.id },
            data: { status: 'PAUSED' },
          });

          await prisma.auditLog.create({
            data: {
              userId: session.user.id,
              tenantId: session.tenant.id,
              action: 'CAMPAIGN_PAUSED' as any,
              metadata: {
                campaignId: campaign.id,
                campaignName: campaign.name,
                reason: 'Auto-paused due to consecutive failures during resume',
              },
              ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
              userAgent: request.headers.get('user-agent') || 'unknown',
            },
          });

          return NextResponse.json(
            { 
              message: 'Campaign auto-paused due to consecutive failures',
              successCount,
              failureCount,
            },
            { status: 202 }
          );
        }
      }
    }

    // Update campaign status based on results
    const finalStatus = failureCount === 0 ? 'COMPLETED' : 'COMPLETED_WITH_ERRORS';
    const auditAction = failureCount === 0 ? 'CAMPAIGN_SEND_COMPLETED' : 'CAMPAIGN_SEND_FAILED';

    await prisma.campaign.update({
      where: { id: params.id },
      data: { status: finalStatus },
    });

    // Log completion
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        tenantId: session.tenant.id,
        action: auditAction as any,
        metadata: {
          campaignId: campaign.id,
          campaignName: campaign.name,
          successCount,
          failureCount,
        },
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    });

    return NextResponse.json(
      { 
        message: 'Campaign resume completed',
        successCount,
        failureCount,
        status: finalStatus,
      },
      { status: 202 }
    );
  } catch (error) {
    if (error instanceof DatabaseUnavailableError) {
      return NextResponse.json(
        { error: 'Database temporarily unavailable. Please retry.' },
        { status: 503 }
      );
    }

    console.error('Resume campaign error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
