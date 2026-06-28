import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { encryptWithVersion } from '@/lib/security/secret-rotation';
import { createTraceContext } from '@/lib/tracing/trace-id';

// Force dynamic route to avoid static generation issues
export const dynamic = 'force-dynamic';

/**
 * Meta Callback Endpoint
 * Receives the temporary Access Code from Meta's Embedded Signup flow
 * Exchanges it for a Long-Lived Permanent Access Token
 * Encrypts and stores the token securely
 */
export async function POST(request: NextRequest) {
  const traceContext = createTraceContext();

  try {
    // Get authenticated session
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { code } = body;

    if (!code) {
      return NextResponse.json(
        { error: 'Missing required parameter: code' },
        { status: 400 }
      );
    }

    // Get Meta App credentials from environment
    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;
    const redirectUri = process.env.META_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL}/api/onboarding/meta-callback`;

    if (!appId || !appSecret) {
      return NextResponse.json(
        { error: 'Meta App credentials not configured' },
        { status: 500 }
      );
    }

    // Exchange temporary code for long-lived access token
    const tokenResponse = await exchangeCodeForToken(code, appId, appSecret, redirectUri);

    if (!tokenResponse.success) {
      return NextResponse.json(
        { error: 'Failed to exchange code for token' },
        { status: 500 }
      );
    }

    // Extract WABA ID and phone number details from the token response
    const wabaId = tokenResponse.data?.whatsapp_business_account_id;
    const phoneNumberId = tokenResponse.data?.phone_number_id;
    const displayPhoneNumber = tokenResponse.data?.display_phone_number;
    const accessToken = tokenResponse.data?.access_token;

    if (!wabaId || !phoneNumberId || !displayPhoneNumber || !accessToken) {
      return NextResponse.json(
        { error: 'Incomplete data received from Meta' },
        { status: 500 }
      );
    }

    // Encrypt the access token using our security layer
    const encryptedToken = encryptWithVersion(accessToken);

    // Check if WABA account already exists for this tenant
    const existingAccount = await prisma.whatsappAccount.findFirst({
      where: {
        tenantId: session.tenant.id,
        wabaId,
      },
    });

    if (existingAccount) {
      // Update existing account

      await prisma.whatsappAccount.update({
        where: { id: existingAccount.id },
        data: {
          encryptedAccessToken: encryptedToken,
          tokenLastFour: accessToken.slice(-4),
          phoneNumberId,
          businessPhoneNumber: displayPhoneNumber,
          connectionStatus: 'CONNECTED',
          lastError: null,
          lastTestedAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        accountId: existingAccount.id,
        wabaId,
        phoneNumberId,
        displayPhoneNumber,
        message: 'WABA account updated successfully',
      });
    }

    // Create new WABA account

    const newAccount = await prisma.whatsappAccount.create({
      data: {
        tenantId: session.tenant.id,
        displayName: `WhatsApp Business (${displayPhoneNumber})`,
        wabaId,
        phoneNumberId,
        businessPhoneNumber: displayPhoneNumber,
        graphApiVersion: 'v19.0',
        encryptedAccessToken: encryptedToken,
        tokenLastFour: accessToken.slice(-4),
        connectionStatus: 'CONNECTED',
        lastTestedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      accountId: newAccount.id,
      wabaId,
      phoneNumberId,
      displayPhoneNumber,
      message: 'WABA account created successfully',
    });

  } catch (error) {
    console.error('[META_CALLBACK] Error processing callback', { 
      traceId: traceContext.traceId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Exchange temporary code for long-lived access token
 * Uses Meta's OAuth Graph API
 */
async function exchangeCodeForToken(
  code: string,
  appId: string,
  appSecret: string,
  redirectUri: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const response = await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token?` +
      `client_id=${appId}&` +
      `client_secret=${appSecret}&` +
      `code=${code}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[META_CALLBACK] Token exchange API error', {
        status: response.status,
        error: errorText,
      });
      return {
        success: false,
        error: `Token exchange failed: ${response.status}`,
      };
    }

    const data = await response.json();

    if (data.error) {
      console.error('[META_CALLBACK] Token exchange error in response', data.error);
      return {
        success: false,
        error: data.error.message || 'Token exchange failed',
      };
    }

    // Fetch WABA details using the access token
    const wabaResponse = await fetch(
      `https://graph.facebook.com/v19.0/debug_token?input_token=${data.access_token}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${data.access_token}`,
        },
      }
    );

    if (!wabaResponse.ok) {
      console.error('[META_CALLBACK] Failed to fetch WABA details');
      return {
        success: false,
        error: 'Failed to fetch WABA details',
      };
    }

    const wabaData = await wabaResponse.json();

    // Extract phone number details
    const phoneNumbersResponse = await fetch(
      `https://graph.facebook.com/v19.0/${wabaData.data.granular_scopes[0]?.target_ids[0]}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${data.access_token}`,
        },
      }
    );

    let phoneNumberId = '';
    let displayPhoneNumber = '';

    if (phoneNumbersResponse.ok) {
      const phoneData = await phoneNumbersResponse.json();
      phoneNumberId = phoneData.id || '';
      displayPhoneNumber = phoneData.display_phone_number || '';
    }

    return {
      success: true,
      data: {
        access_token: data.access_token,
        whatsapp_business_account_id: wabaData.data.granular_scopes[0]?.target_ids[0] || '',
        phone_number_id: phoneNumberId,
        display_phone_number: displayPhoneNumber,
      },
    };

  } catch (error) {
    console.error('[META_CALLBACK] Exception during token exchange', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
