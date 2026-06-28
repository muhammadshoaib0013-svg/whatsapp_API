import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { DatabaseUnavailableError } from '@/lib/auth/session';
import { maskPhoneNumber } from '@/lib/campaigns/validation';
import { AuditAction } from '@prisma/client';
import { checkRateLimit } from '@/lib/rate-limit';

export async function GET(
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

    // Get pagination parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const skip = (page - 1) * limit;
    const cursor = searchParams.get('cursor');

    const campaign = await prisma.campaign.findFirst({
      where: {
        id: params.id,
        tenantId: session.tenant.id,
      },
      include: {
        template: {
          select: {
            id: true,
            name: true,
            language: true,
            status: true,
          },
        },
        account: {
          select: {
            id: true,
            displayName: true,
            businessPhoneNumber: true,
            connectionStatus: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        recipients: {
          select: {
            id: true,
            phoneNumber: true,
            isValid: true,
            validationError: true,
            status: true,
            sentAt: true,
            deliveredAt: true,
            readAt: true,
            errorMessage: true,
          },
          orderBy: {
            createdAt: 'asc',
          },
          take: limit,
          skip: skip,
          // Cursor-based pagination support
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        },
      },
    });

    if (!campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      );
    }

    // Get total recipient count for pagination
    const totalRecipients = await prisma.campaignRecipient.count({
      where: {
        campaignId: campaign.id,
      },
    });

    // Mask phone numbers in response
    const campaignWithMaskedNumbers = {
      ...campaign,
      recipients: campaign.recipients.map((recipient) => ({
        ...recipient,
        phoneNumber: maskPhoneNumber(recipient.phoneNumber),
      })),
      pagination: {
        page,
        limit,
        total: totalRecipients,
        totalPages: Math.ceil(totalRecipients / limit),
      },
    };

    return NextResponse.json({ campaign: campaignWithMaskedNumbers });
  } catch (error) {
    if (error instanceof DatabaseUnavailableError) {
      return NextResponse.json(
        { error: 'Database temporarily unavailable. Please retry.' },
        { status: 503 }
      );
    }

    console.error('Get campaign error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
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

    // Rate limit: 20 campaign updates per minute per tenant
    const rateLimitResult = await checkRateLimit('campaign_update', session.tenant.id, {
      tenantLimit: 20,
      windowSeconds: 60,
    });

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { 
          error: 'Too many requests',
          retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000),
        },
        { status: 429 }
      );
    }

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

    const body = await request.json();
    const {
      name,
      whatsappAccountId,
      templateId,
      recipients: recipientsText,
      complianceConfirmed,
      status,
    } = body;

    // Only allow editing DRAFT campaigns (unless reverting from READY)
    if (campaign.status !== 'DRAFT' && status !== 'DRAFT') {
      return NextResponse.json(
        { error: 'Only DRAFT campaigns can be edited' },
        { status: 400 }
      );
    }

    // Allow reverting from READY to DRAFT
    if (campaign.status === 'READY' && status === 'DRAFT') {
      // Allow this transition
    }

    // Validate WhatsApp account if provided
    if (whatsappAccountId) {
      const whatsappAccount = await prisma.whatsappAccount.findFirst({
        where: {
          id: whatsappAccountId,
          tenantId: session.tenant.id,
        },
      });

      if (!whatsappAccount) {
        return NextResponse.json(
          { error: 'WhatsApp account not found or does not belong to your tenant' },
          { status: 404 }
        );
      }

      if (whatsappAccount.connectionStatus !== 'CONNECTED') {
        return NextResponse.json(
          { error: 'WhatsApp account must be connected' },
          { status: 400 }
        );
      }
    }

    // Validate template if provided
    if (templateId) {
      const template = await prisma.whatsAppTemplate.findFirst({
        where: {
          id: templateId,
          tenantId: session.tenant.id,
        },
      });

      if (!template) {
        return NextResponse.json(
          { error: 'Template not found or does not belong to your tenant' },
          { status: 404 }
        );
      }

      if (template.status !== 'APPROVED') {
        return NextResponse.json(
          { error: 'Only approved templates can be used' },
          { status: 400 }
        );
      }
    }

    // Validate and update recipients if provided
    let validRecipientCount = campaign.validRecipientCount;
    let invalidRecipientCount = campaign.invalidRecipientCount;
    let recipientCount = campaign.recipientCount;

    if (recipientsText !== undefined) {
      const { validateRecipientList } = await import('@/lib/campaigns/validation');
      const validation = validateRecipientList(recipientsText);

      if (validation.validRecipients.length === 0) {
        return NextResponse.json(
          { error: 'At least one valid recipient is required' },
          { status: 400 }
        );
      }

      // Delete existing recipients
      await prisma.campaignRecipient.deleteMany({
        where: { campaignId: campaign.id },
      });

      // Create new recipients
      const recipientData = validation.validRecipients.map((phoneNumber) => ({
        campaignId: campaign.id,
        tenantId: session.tenant.id,
        phoneNumber,
        isValid: true,
      }));

      const invalidRecipientData = validation.invalidRecipients.map((result) => ({
        campaignId: campaign.id,
        tenantId: session.tenant.id,
        phoneNumber: result.phoneNumber,
        isValid: false,
        validationError: result.validationError,
      }));

      await prisma.campaignRecipient.createMany({
        data: [...recipientData, ...invalidRecipientData],
      });

      validRecipientCount = validation.validRecipients.length;
      invalidRecipientCount = validation.invalidRecipients.length;
      recipientCount = validation.totalUnique;
    }

    // Update campaign
    const updatedCampaign = await prisma.campaign.update({
      where: { id: campaign.id },
      data: {
        ...(name && { name }),
        ...(whatsappAccountId && { whatsappAccountId }),
        ...(templateId && { templateId }),
        ...(complianceConfirmed !== undefined && { complianceConfirmed }),
        ...(status && { status }),
        recipientCount,
        validRecipientCount,
        invalidRecipientCount,
      },
      select: {
        id: true,
        name: true,
        status: true,
        whatsappAccountId: true,
        templateId: true,
        complianceConfirmed: true,
        recipientCount: true,
        validRecipientCount: true,
        invalidRecipientCount: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Create audit log based on action
    let auditAction: 'CAMPAIGN_UPDATED' | 'CAMPAIGN_READY' | 'CAMPAIGN_REVERTED_TO_DRAFT' = 'CAMPAIGN_UPDATED';
    if (status === 'READY' && campaign.status === 'DRAFT') {
      auditAction = 'CAMPAIGN_READY';
    } else if (status === 'DRAFT' && campaign.status === 'READY') {
      auditAction = 'CAMPAIGN_REVERTED_TO_DRAFT';
    }

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        tenantId: session.tenant.id,
        action: auditAction as any,
        metadata: {
          campaignId: campaign.id,
          campaignName: name || campaign.name,
          recipientCount,
          previousStatus: campaign.status,
          newStatus: status || campaign.status,
        },
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    });

    return NextResponse.json({ campaign: updatedCampaign });
  } catch (error) {
    if (error instanceof DatabaseUnavailableError) {
      return NextResponse.json(
        { error: 'Database temporarily unavailable. Please retry.' },
        { status: 503 }
      );
    }

    console.error('Update campaign error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    // Only allow deleting DRAFT campaigns
    if (campaign.status !== 'DRAFT') {
      return NextResponse.json(
        { error: 'Only DRAFT campaigns can be deleted' },
        { status: 400 }
      );
    }

    // Create audit log before deletion
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        tenantId: session.tenant.id,
        action: 'CAMPAIGN_DELETED',
        metadata: {
          campaignId: campaign.id,
          campaignName: campaign.name,
        },
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    });

    // Delete campaign (cascade will delete recipients)
    await prisma.campaign.delete({
      where: { id: campaign.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof DatabaseUnavailableError) {
      return NextResponse.json(
        { error: 'Database temporarily unavailable. Please retry.' },
        { status: 503 }
      );
    }

    console.error('Delete campaign error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
