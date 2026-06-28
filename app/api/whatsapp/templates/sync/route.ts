import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import {
  getWhatsAppAccountForTenant,
  decryptWhatsAppTokenSafely,
  fetchTemplatesFromMeta,
  normalizeMetaError,
} from '@/lib/whatsapp/cloud-api';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    // Get authenticated session
    const session = await getSession();
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get WhatsApp account for current tenant
    const account = await getWhatsAppAccountForTenant(session.tenant.id);

    // Decrypt access token server-side only
    let accessToken: string;
    try {
      accessToken = await decryptWhatsAppTokenSafely(account.encryptedAccessToken);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Failed to decrypt access token' },
        { status: 500 }
      );
    }

    // Fetch templates from Meta Graph API
    let metaTemplates: any[];
    try {
      metaTemplates = await fetchTemplatesFromMeta(
        account.wabaId,
        accessToken,
        account.graphApiVersion
      );
    } catch (error) {
      const safeError = normalizeMetaError(error);
      console.error('Fetch templates from Meta error:', error);

      // Update account with error
      await prisma.whatsappAccount.update({
        where: { id: account.id },
        data: {
          lastError: safeError,
          lastTestedAt: new Date(),
        },
      });

      return NextResponse.json(
        { error: safeError },
        { status: 400 }
      );
    }

    // Sync templates to database
    const syncedTemplates = [];
    for (const metaTemplate of metaTemplates) {
      // Map Meta status to our enum
      let status: 'APPROVED' | 'PENDING' | 'REJECTED' | 'DISABLED' | 'PAUSED' = 'PENDING';
      const metaStatus = (metaTemplate.status || 'PENDING').toUpperCase();

      // Meta API returns various status values including APPROVED, PENDING, REJECTED, DISABLED, PAUSED
      // Also handle potential variations like 'ACTIVE' which may map to APPROVED
      if (metaStatus === 'APPROVED' || metaStatus === 'ACTIVE') status = 'APPROVED';
      else if (metaStatus === 'PENDING') status = 'PENDING';
      else if (metaStatus === 'REJECTED') status = 'REJECTED';
      else if (metaStatus === 'DISABLED') status = 'DISABLED';
      else if (metaStatus === 'PAUSED') status = 'PAUSED';
      else status = 'PENDING';

      // Upsert template
      const template = await prisma.whatsAppTemplate.upsert({
        where: {
          tenantId_metaTemplateId: {
            tenantId: session.tenant.id,
            metaTemplateId: metaTemplate.id,
          },
        },
        update: {
          name: metaTemplate.name,
          language: metaTemplate.language,
          category: metaTemplate.category,
          status: status,
          componentsJson: metaTemplate.components || [],
          lastSyncedAt: new Date(),
          updatedAt: new Date(),
        },
        create: {
          tenantId: session.tenant.id,
          whatsappAccountId: account.id,
          metaTemplateId: metaTemplate.id,
          name: metaTemplate.name,
          language: metaTemplate.language,
          category: metaTemplate.category,
          status: status,
          componentsJson: metaTemplate.components || [],
          lastSyncedAt: new Date(),
        },
      });

      syncedTemplates.push(template);
    }

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        tenantId: session.tenant.id,
        action: 'TEMPLATE_SYNCED',
        whatsappAccountId: account.id,
        metadata: {
          templatesSynced: syncedTemplates.length,
        },
      },
    });

    // Update account with success
    await prisma.whatsappAccount.update({
      where: { id: account.id },
      data: {
        lastError: null,
        lastTestedAt: new Date(),
      },
    });

    return NextResponse.json(
      {
        message: 'Templates synced successfully',
        templatesSynced: syncedTemplates.length,
        templates: syncedTemplates.map((template) => ({
          id: template.id,
          metaTemplateId: template.metaTemplateId,
          name: template.name,
          language: template.language,
          category: template.category,
          status: template.status,
          lastSyncedAt: template.lastSyncedAt,
        })),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Sync templates error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
