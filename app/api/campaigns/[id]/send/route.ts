import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { AuditAction } from '@prisma/client';
import { sendTemplateMessage, decryptWhatsAppTokenSafely, getWhatsAppAccountForTenant } from '@/lib/whatsapp/cloud-api';

export const dynamic = 'force-dynamic';

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

    // Fetch campaign with tenant isolation
    const campaign = await prisma.campaign.findFirst({
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

    if (!campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      );
    }

    // Verify campaign status is READY
    if (campaign.status !== 'READY') {
      return NextResponse.json(
        { error: 'Campaign must be in READY status to send' },
        { status: 400 }
      );
    }

    // Re-run safety check at the moment of send
    const whatsappAccountConnected = campaign.account.connectionStatus === 'CONNECTED';
    const templateApproved = campaign.template.status === 'APPROVED';
    const hasValidRecipients = campaign.validRecipientCount > 0;
    const complianceConfirmed = campaign.complianceConfirmed;
    const allChecksPassed = whatsappAccountConnected && templateApproved && hasValidRecipients && complianceConfirmed;

    if (!allChecksPassed) {
      const failingChecks = [];
      if (!whatsappAccountConnected) failingChecks.push('WhatsApp account not connected');
      if (!templateApproved) failingChecks.push('Template not approved');
      if (!hasValidRecipients) failingChecks.push('No valid recipients');
      if (!complianceConfirmed) failingChecks.push('Compliance not confirmed');

      return NextResponse.json(
        { error: 'Safety check failed', failingChecks },
        { status: 400 }
      );
    }

    // Verify recipient count is between 1 and 50 (safety cap)
    if (campaign.validRecipientCount < 1 || campaign.validRecipientCount > 50) {
      return NextResponse.json(
        { error: 'Recipient count must be between 1 and 50' },
        { status: 400 }
      );
    }

    // Change campaign status to SENDING
    await prisma.campaign.update({
      where: { id: params.id },
      data: {
        status: 'SENDING',
        startedAt: new Date(),
      },
    });

    // Log CAMPAIGN_SEND_STARTED to AuditLog
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        tenantId: session.tenant.id,
        action: 'CAMPAIGN_SEND_STARTED' as any,
        metadata: {
          campaignId: campaign.id,
          campaignName: campaign.name,
          recipientCount: campaign.validRecipientCount,
        },
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    });

    // Start the send loop (synchronous for this phase)
    let successCount = 0;
    let failureCount = 0;
    let consecutiveFailures = 0;
    const MAX_CONSECUTIVE_FAILURES = 3;

    // Get WhatsApp account and decrypt token
    const account = await getWhatsAppAccountForTenant(session.tenant.id);
    const accessToken = await decryptWhatsAppTokenSafely(account.encryptedAccessToken);

    for (const recipient of campaign.recipients) {
      try {
        // Check if already sent (for resume functionality)
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
        const components = transformComponentsForSend(campaign.template.componentsJson as any[]);

        // Send message to Meta
        const metaMessageId = await sendTemplateMessage(
          account.phoneNumberId,
          recipient.phoneNumber,
          campaign.template.name,
          campaign.template.language,
          components,
          accessToken,
          account.graphApiVersion
        );

        // Record success in WhatsAppMessageLog
        await prisma.whatsAppMessageLog.create({
          data: {
            tenantId: session.tenant.id,
            whatsappAccountId: account.id,
            templateId: campaign.template.id,
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
        console.error('[CAMPAIGN_SEND] Failed to send to recipient:', recipient.phoneNumber, error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('[CAMPAIGN_SEND] Error details:', errorMessage);

        // Record failure in WhatsAppMessageLog
        await prisma.whatsAppMessageLog.create({
          data: {
            tenantId: session.tenant.id,
            whatsappAccountId: account.id,
            templateId: campaign.template.id,
            campaignId: campaign.id,
            toPhoneNumber: recipient.phoneNumber,
            messageType: 'TEMPLATE',
            status: 'FAILED',
            metaMessageId: null,
            requestJson: {},
            errorMessage: errorMessage,
          },
        });

        // Update recipient status
        await prisma.campaignRecipient.update({
          where: { id: recipient.id },
          data: {
            status: 'FAILED',
            errorMessage: errorMessage,
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
                reason: 'Auto-paused due to consecutive failures',
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
        message: 'Campaign send completed',
        successCount,
        failureCount,
        status: finalStatus,
      },
      { status: 202 }
    );

  } catch (error) {
    console.error('[CAMPAIGN_SEND_ERROR]', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[CAMPAIGN_SEND_ERROR] Error details:', errorMessage);
    console.error('[CAMPAIGN_SEND_ERROR] Stack:', error instanceof Error ? error.stack : 'No stack');

    // Try to update campaign to failed status
    try {
      await prisma.campaign.update({
        where: { id: params.id },
        data: { status: 'FAILED' },
      });
    } catch (updateError) {
      console.error('[CAMPAIGN_SEND_ERROR] Failed to update status:', updateError);
    }

    return NextResponse.json(
      { error: errorMessage || 'Failed to send campaign' },
      { status: 500 }
    );
  }
}
