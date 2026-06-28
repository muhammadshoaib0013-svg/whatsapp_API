import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { encrypt, maskToken } from '@/lib/security/encryption';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// Validation schema for WhatsApp account creation
const createAccountSchema = z.object({
  displayName: z.string().min(1, 'Display name is required'),
  wabaId: z.string().min(1, 'WABA ID is required'),
  phoneNumberId: z.string().min(1, 'Phone Number ID is required'),
  businessPhoneNumber: z.string().min(1, 'Business phone number is required'),
  graphApiVersion: z.string().min(1, 'Graph API version is required'),
  accessToken: z.string().min(1, 'Access token is required'),
});

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

    // Parse and validate request body
    const body = await request.json();
    const validationResult = createAccountSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validationResult.error.errors },
        { status: 400 }
      );
    }

    const {
      displayName,
      wabaId,
      phoneNumberId,
      businessPhoneNumber,
      graphApiVersion,
      accessToken,
    } = validationResult.data;

    // Encrypt the access token before storing
    const encryptedAccessToken = encrypt(accessToken);
    const tokenLastFour = accessToken.slice(-4);

    // Check if tenant already has a WhatsApp account
    const existingAccount = await prisma.whatsappAccount.findFirst({
      where: { tenantId: session.tenant.id },
    });

    if (existingAccount) {
      // Update existing account
      const updatedAccount = await prisma.whatsappAccount.update({
        where: { id: existingAccount.id },
        data: {
          displayName,
          wabaId,
          phoneNumberId,
          businessPhoneNumber,
          graphApiVersion,
          encryptedAccessToken,
          tokenLastFour,
          connectionStatus: 'NOT_CONNECTED',
          lastError: null,
          updatedAt: new Date(),
        },
      });

      // Create audit log
      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          tenantId: session.tenant.id,
          action: 'WHATSAPP_ACCOUNT_UPDATED',
          metadata: {
            whatsappAccountId: updatedAccount.id,
            displayName,
            wabaId,
          },
        },
      });

      return NextResponse.json(
        {
          message: 'WhatsApp account updated successfully',
          account: {
            id: updatedAccount.id,
            displayName: updatedAccount.displayName,
            wabaId: updatedAccount.wabaId,
            phoneNumberId: updatedAccount.phoneNumberId,
            businessPhoneNumber: updatedAccount.businessPhoneNumber,
            graphApiVersion: updatedAccount.graphApiVersion,
            tokenLastFour: updatedAccount.tokenLastFour,
            connectionStatus: updatedAccount.connectionStatus,
            lastTestedAt: updatedAccount.lastTestedAt,
            lastError: updatedAccount.lastError,
            createdAt: updatedAccount.createdAt,
            updatedAt: updatedAccount.updatedAt,
          },
        },
        { status: 200 }
      );
    }

    // Create new WhatsApp account
    const newAccount = await prisma.whatsappAccount.create({
      data: {
        tenantId: session.tenant.id,
        displayName,
        wabaId,
        phoneNumberId,
        businessPhoneNumber,
        graphApiVersion,
        encryptedAccessToken,
        tokenLastFour,
        connectionStatus: 'NOT_CONNECTED',
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        tenantId: session.tenant.id,
        action: 'WHATSAPP_ACCOUNT_CREATED',
        metadata: {
          whatsappAccountId: newAccount.id,
          displayName,
          wabaId,
        },
      },
    });

    return NextResponse.json(
      {
        message: 'WhatsApp account created successfully',
        account: {
          id: newAccount.id,
          displayName: newAccount.displayName,
          wabaId: newAccount.wabaId,
          phoneNumberId: newAccount.phoneNumberId,
          businessPhoneNumber: newAccount.businessPhoneNumber,
          graphApiVersion: newAccount.graphApiVersion,
          tokenLastFour: newAccount.tokenLastFour,
          connectionStatus: newAccount.connectionStatus,
          lastTestedAt: newAccount.lastTestedAt,
          lastError: newAccount.lastError,
          createdAt: newAccount.createdAt,
          updatedAt: newAccount.updatedAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[WHATSAPP_ACCOUNTS_ROUTE_ERROR] Create account:', error instanceof Error ? error.stack : error);

    // Check if error is related to encryption key configuration
    if (error instanceof Error && error.message.includes('TOKEN_ENCRYPTION_KEY')) {
      return NextResponse.json(
        { error: 'Server encryption configuration is invalid. Please check TOKEN_ENCRYPTION_KEY.', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

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

    // Get tenant's WhatsApp account
    const account = await prisma.whatsappAccount.findFirst({
      where: { tenantId: session.tenant.id },
      select: {
        id: true,
        displayName: true,
        wabaId: true,
        phoneNumberId: true,
        businessPhoneNumber: true,
        graphApiVersion: true,
        tokenLastFour: true,
        connectionStatus: true,
        lastTestedAt: true,
        lastError: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!account) {
      return NextResponse.json(
        { account: null, accounts: [] },
        { status: 200 }
      );
    }

    // Return account without raw access token
    // Return both formats for backward compatibility
    const accountData = {
      id: account.id,
      displayName: account.displayName,
      wabaId: account.wabaId,
      phoneNumberId: account.phoneNumberId,
      businessPhoneNumber: account.businessPhoneNumber,
      graphApiVersion: account.graphApiVersion,
      tokenLastFour: account.tokenLastFour,
      connectionStatus: account.connectionStatus,
      lastTestedAt: account.lastTestedAt,
      lastError: account.lastError,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    };

    return NextResponse.json(
      {
        account: accountData,
        accounts: [accountData],
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[WHATSAPP_ACCOUNTS_ROUTE_ERROR] Get account:', error instanceof Error ? error.stack : error);

    // Check if error is related to encryption key configuration
    if (error instanceof Error && error.message.includes('TOKEN_ENCRYPTION_KEY')) {
      return NextResponse.json(
        { error: 'Server encryption configuration is invalid. Please check TOKEN_ENCRYPTION_KEY.', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
