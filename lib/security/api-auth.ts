import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import crypto from 'crypto';

/**
 * Hash an API key for storage
 */
export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

/**
 * Generate a random API key
 */
export function generateApiKey(): string {
  const prefix = 'wa_live_';
  const randomBytes = crypto.randomBytes(32).toString('hex');
  return `${prefix}${randomBytes}`;
}

/**
 * Validate API key from Authorization header
 * Returns the tenantId if valid, null otherwise
 */
export async function validateApiKey(request: NextRequest): Promise<string | null> {
  try {
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const apiKey = authHeader.substring(7); // Remove 'Bearer ' prefix
    const hashedKey = hashApiKey(apiKey);

    // Find the API key in the database
    const apiKeyRecord = await prisma.apiKey.findUnique({
      where: { hashedKey },
      select: {
        tenantId: true,
        revokedAt: true,
      },
    });

    if (!apiKeyRecord) {
      return null;
    }

    // Check if the key has been revoked
    if (apiKeyRecord.revokedAt) {
      return null;
    }

    // Update last used timestamp
    await prisma.apiKey.update({
      where: { id: apiKeyRecord.tenantId },
      data: { lastUsedAt: new Date() },
    }).catch(() => {
      // Ignore update errors
    });

    return apiKeyRecord.tenantId;
  } catch (error) {
    console.error('[API_AUTH] Error validating API key:', error);
    return null;
  }
}

/**
 * Middleware helper to protect API routes with API key authentication
 */
export async function requireApiKey(request: NextRequest): Promise<{ tenantId: string } | never> {
  const tenantId = await validateApiKey(request);
  
  if (!tenantId) {
    throw new Error('Invalid or missing API key');
  }
  
  return { tenantId };
}
