import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    // Get authenticated session
    const session = await getSession();
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get templates for the current tenant only
    const templates = await prisma.whatsAppTemplate.findMany({
      where: { tenantId: session.tenant.id },
      orderBy: { lastSyncedAt: 'desc' },
    });

    // Return templates without exposing sensitive data
    return NextResponse.json(
      {
        templates: templates.map((template) => ({
          id: template.id,
          metaTemplateId: template.metaTemplateId,
          name: template.name,
          language: template.language,
          category: template.category,
          status: template.status,
          componentsJson: template.componentsJson,
          lastSyncedAt: template.lastSyncedAt,
          createdAt: template.createdAt,
          updatedAt: template.updatedAt,
        })),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Get templates error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
