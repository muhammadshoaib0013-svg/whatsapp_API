import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { generateApiKey, hashApiKey } from '@/lib/security/api-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/api-keys
 * List all API keys for the current tenant
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const apiKeys = await prisma.apiKey.findMany({
      where: {
        tenantId: session.tenant.id,
        revokedAt: null,
      },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        lastUsedAt: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({ apiKeys });
  } catch (error) {
    console.error('[API_KEYS] Error listing API keys:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/api-keys
 * Generate a new API key for the current tenant
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    // Generate the API key
    const rawKey = generateApiKey();
    const hashedKey = hashApiKey(rawKey);
    const keyPrefix = 'wa_live_';

    // Store the hashed key in the database
    const apiKey = await prisma.apiKey.create({
      data: {
        tenantId: session.tenant.id,
        name,
        keyPrefix,
        hashedKey,
      },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        createdAt: true,
      },
    });

    // Return the raw key ONCE (like Stripe does)
    return NextResponse.json({
      apiKey,
      rawKey,
      message: 'API key generated successfully. Save this key now as it will not be shown again.',
    });
  } catch (error) {
    console.error('[API_KEYS] Error creating API key:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
