import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
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
            status: true,
          },
        },
      },
    });

    if (!campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      );
    }

    // Check if WhatsApp account is connected
    const whatsappAccountConnected = campaign.account.connectionStatus === 'CONNECTED';

    // Check if template is approved
    const templateApproved = campaign.template.status === 'APPROVED';

    // Check if campaign has valid recipients
    const hasValidRecipients = campaign.validRecipientCount > 0;

    // Check if compliance was confirmed
    const complianceConfirmed = campaign.complianceConfirmed;

    // Estimated message count
    const estimatedMessageCount = campaign.validRecipientCount;

    // Estimated cost (rough estimate)
    const estimatedCost = `~${estimatedMessageCount} messages, review Meta pricing for exact cost`;

    // All checks passed
    const allChecksPassed = 
      whatsappAccountConnected && 
      templateApproved && 
      hasValidRecipients && 
      complianceConfirmed;

    return NextResponse.json({
      whatsappAccountConnected,
      templateApproved,
      hasValidRecipients,
      complianceConfirmed,
      estimatedMessageCount,
      estimatedCost,
      allChecksPassed,
    });
  } catch (error) {
    console.error('[SAFETY_CHECK] Error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[SAFETY_CHECK] Error details:', errorMessage);
    console.error('[SAFETY_CHECK] Stack:', error instanceof Error ? error.stack : 'No stack');
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
