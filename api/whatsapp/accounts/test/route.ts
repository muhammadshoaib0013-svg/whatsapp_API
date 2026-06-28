import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { decrypt } from '@/lib/security/encryption';
import { normalizeMetaError } from '@/lib/whatsapp/cloud-api';

const PHONE_NUMBER_FIELDS = [
  'id',
  'display_phone_number',
  'verified_name',
  'quality_rating',
] as const;

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

    // Get tenant's WhatsApp account
    const account = await prisma.whatsappAccount.findFirst({
      where: { tenantId: session.tenant.id },
    });

    if (!account) {
      return NextResponse.json(
        { error: 'No WhatsApp account found. Please connect your account first.' },
        { status: 404 }
      );
    }

    // Decrypt the access token
    let accessToken: string;
    try {
      accessToken = decrypt(account.encryptedAccessToken);
    } catch (error) {
      console.error('Failed to decrypt access token:', error);
      return NextResponse.json(
        { error: 'Failed to decrypt access token. Please re-enter your credentials.' },
        { status: 500 }
      );
    }

    // Test the connection by calling Meta Graph API
    const fields = PHONE_NUMBER_FIELDS.join(',');
    const testUrl = `https://graph.facebook.com/${account.graphApiVersion}/${account.phoneNumberId}?fields=${fields}`;
    
    let testResult;
    try {
      const response = await fetch(testUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      testResult = await response.json();
    } catch (error) {
      const errorMessage = normalizeMetaError(error);

      // Update account with error
      await prisma.whatsappAccount.update({
        where: { id: account.id },
        data: {
          connectionStatus: 'FAILED',
          lastError: errorMessage,
          lastTestedAt: new Date(),
        },
      });

      // Create audit log
      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          tenantId: session.tenant.id,
          action: 'WHATSAPP_ACCOUNT_TESTED',
          whatsappAccountId: account.id,
          metadata: {
            success: false,
            error: errorMessage,
          },
        },
      });

      return NextResponse.json(
        { 
          error: 'Connection test failed',
          message: errorMessage,
          connectionStatus: 'FAILED',
        },
        { status: 400 }
      );
    }

    // Update account with success
    const updatedAccount = await prisma.whatsappAccount.update({
      where: { id: account.id },
      data: {
        connectionStatus: 'CONNECTED',
        lastError: null,
        lastTestedAt: new Date(),
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        tenantId: session.tenant.id,
        action: 'WHATSAPP_ACCOUNT_TESTED',
        whatsappAccountId: account.id,
        metadata: {
          success: true,
          phoneNumber: testResult.display_phone_number,
        },
      },
    });

    return NextResponse.json(
      {
        message: 'Connection test successful',
        connectionStatus: 'CONNECTED',
        phoneNumber: testResult.display_phone_number,
        accountName: testResult.verified_name,
        qualityRating: testResult.quality_rating,
        lastTestedAt: updatedAccount.lastTestedAt,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Test WhatsApp connection error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
