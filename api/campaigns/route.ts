import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { DatabaseUnavailableError } from '@/lib/auth/session';
import { AuditAction } from '@prisma/client';
import { checkRateLimit } from '@/lib/rate-limit';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const campaigns = await prisma.campaign.findMany({
      where: { tenantId: session.tenant.id },
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
        _count: {
          select: {
            recipients: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ campaigns });
  } catch (error) {
    if (error instanceof DatabaseUnavailableError) {
      return NextResponse.json(
        { error: 'Database temporarily unavailable. Please retry.' },
        { status: 503 }
      );
    }

    console.error('Get campaigns error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Rate limit: 10 campaign creations per minute per tenant
    const rateLimitResult = await checkRateLimit('campaign_create', session.tenant.id, {
      tenantLimit: 10,
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

    const body = await request.json();
    const {
      name,
      whatsappAccountId,
      templateId,
      recipients: recipientsText,
      complianceConfirmed,
    } = body;

    // Validate required fields
    if (!name || typeof name !== 'string') {
      return NextResponse.json(
        { error: 'Campaign name is required' },
        { status: 400 }
      );
    }

    if (!whatsappAccountId || typeof whatsappAccountId !== 'string') {
      return NextResponse.json(
        { error: 'WhatsApp account is required' },
        { status: 400 }
      );
    }

    if (!templateId || typeof templateId !== 'string') {
      return NextResponse.json(
        { error: 'Template is required' },
        { status: 400 }
      );
    }

    if (!recipientsText || typeof recipientsText !== 'string') {
      return NextResponse.json(
        { error: 'Recipients are required' },
        { status: 400 }
      );
    }

    if (!complianceConfirmed || typeof complianceConfirmed !== 'boolean') {
      return NextResponse.json(
        { error: 'Compliance confirmation is required' },
        { status: 400 }
      );
    }

    // Validate WhatsApp account belongs to tenant and is connected
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
        { error: 'WhatsApp account must be connected to create a campaign' },
        { status: 400 }
      );
    }

    // Validate template belongs to tenant and is approved
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
        { error: 'Only approved templates can be used for campaigns' },
        { status: 400 }
      );
    }

    // Validate recipients
    const { validateRecipientList } = await import('@/lib/campaigns/validation');
    const validation = validateRecipientList(recipientsText);

    if (validation.validRecipients.length === 0) {
      return NextResponse.json(
        { error: 'At least one valid recipient is required' },
        { status: 400 }
      );
    }

    // Create campaign
    const campaign = await prisma.campaign.create({
      data: {
        tenantId: session.tenant.id,
        whatsappAccountId,
        templateId,
        name,
        status: 'DRAFT',
        complianceConfirmed,
        recipientCount: validation.totalUnique,
        validRecipientCount: validation.validRecipients.length,
        invalidRecipientCount: validation.invalidRecipients.length,
        createdByUserId: session.user.id,
      },
    });

    // Create campaign recipients
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

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        tenantId: session.tenant.id,
        action: 'CAMPAIGN_CREATED',
        metadata: {
          campaignId: campaign.id,
          campaignName: name,
          recipientCount: validation.totalUnique,
        },
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    });

    // Return campaign summary
    const campaignSummary = await prisma.campaign.findUnique({
      where: { id: campaign.id },
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
          },
        },
      },
    });

    return NextResponse.json({
      campaign: campaignSummary,
      validation: {
        validCount: validation.validRecipients.length,
        invalidCount: validation.invalidRecipients.length,
        duplicateCount: validation.duplicateCount,
        totalUnique: validation.totalUnique,
      },
    }, { status: 201 });
  } catch (error) {
    if (error instanceof DatabaseUnavailableError) {
      return NextResponse.json(
        { error: 'Database temporarily unavailable. Please retry.' },
        { status: 503 }
      );
    }

    console.error('Create campaign error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
