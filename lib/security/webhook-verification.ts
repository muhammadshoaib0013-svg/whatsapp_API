/**
 * Hardened Webhook Signature Verification
 * Provides timing-safe signature verification, replay protection, and security monitoring
 */

import crypto from 'crypto';

/**
 * Timing-safe string comparison to prevent timing attacks
 * @param a - First string
 * @param b - Second string
 * @returns True if strings are equal
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  const aBuffer = Buffer.from(a, 'utf-8');
  const bBuffer = Buffer.from(b, 'utf-8');

  return crypto.timingSafeEqual(aBuffer, bBuffer);
}

/**
 * Verify webhook signature with timing-safe comparison
 * @param signature - X-Hub-Signature-256 header value
 * @param body - Raw request body as string
 * @param appSecret - Meta App Secret
 * @returns True if signature is valid
 */
export function verifyWebhookSignature(
  signature: string | null,
  body: string,
  appSecret: string
): { valid: boolean; error?: string } {
  console.log('[WEBHOOK_SIGNATURE_DEBUG] Starting signature verification...');
  console.log('[WEBHOOK_SIGNATURE_DEBUG] Signature present:', !!signature);
  console.log('[WEBHOOK_SIGNATURE_DEBUG] App secret present:', !!appSecret);
  console.log('[WEBHOOK_SIGNATURE_DEBUG] Body length:', body.length);

  if (!signature) {
    console.log('[WEBHOOK_SIGNATURE_DEBUG] FAILED: Signature header missing');
    return { valid: false, error: 'Signature header missing' };
  }

  if (!appSecret) {
    console.log('[WEBHOOK_SIGNATURE_DEBUG] FAILED: App secret not configured');
    return { valid: false, error: 'App secret not configured' };
  }

  // Calculate expected signature
  const expectedSignature = 'sha256=' + crypto
    .createHmac('sha256', appSecret)
    .update(body, 'utf-8')
    .digest('hex');

  console.log('[WEBHOOK_SIGNATURE_DEBUG] Expected signature (first 20 chars):', expectedSignature.substring(0, 20));
  console.log('[WEBHOOK_SIGNATURE_DEBUG] Received signature (first 20 chars):', signature.substring(0, 20));

  // Use timing-safe comparison to prevent timing attacks
  const isValid = timingSafeEqual(signature, expectedSignature);

  if (!isValid) {
    console.log('[WEBHOOK_SIGNATURE_DEBUG] FAILED: Signature mismatch');
    return { valid: false, error: 'Invalid signature' };
  }

  console.log('[WEBHOOK_SIGNATURE_DEBUG] SUCCESS: Signature verified');
  return { valid: true };
}

/**
 * Generate a unique webhook request ID for replay protection
 * @returns Unique request ID
 */
export function generateWebhookRequestId(): string {
  return crypto.randomUUID();
}

/**
 * Check if a webhook request has been processed (replay protection)
 * @param requestId - Unique request ID
 * @param ttl - Time-to-live in seconds (default: 300 = 5 minutes)
 * @returns True if request has been processed
 */
export async function isWebhookProcessed(
  requestId: string,
  ttl: number = 300
): Promise<boolean> {
  // In production, this would check Redis or a database
  // For now, we'll use a simple in-memory cache
  const { getCache, setCache } = await import('@/lib/cache/redis');
  
  const cacheKey = `webhook:processed:${requestId}`;
  const cached = await getCache(cacheKey);
  
  if (cached) {
    return true;
  }
  
  // Mark as processed
  await setCache(cacheKey, { processed: true }, ttl);
  
  return false;
}

/**
 * Log webhook verification attempt for security monitoring
 * @param requestId - Unique request ID
 * @param valid - Whether signature was valid
 * @param error - Error message if invalid
 * @param tenantId - Tenant ID (if available)
 */
export function logWebhookVerification(
  requestId: string,
  valid: boolean,
  error?: string,
  tenantId?: string
): void {
  const logEntry = {
    timestamp: new Date().toISOString(),
    requestId,
    valid,
    error,
    tenantId,
  };

  if (valid) {
    console.log('[WEBHOOK_VERIFICATION] Success:', JSON.stringify(logEntry));
  } else {
    console.error('[WEBHOOK_VERIFICATION] Failed:', JSON.stringify(logEntry));
  }
}

/**
 * Extract webhook metadata for security monitoring
 * @param request - Next.js request object
 * @returns Metadata object
 */
export function extractWebhookMetadata(request: Request): {
  requestId: string;
  timestamp: string;
  ip: string;
  userAgent: string;
} {
  const requestId = generateWebhookRequestId();
  const timestamp = new Date().toISOString();
  
  // Extract IP (note: in production, you may need to handle proxy headers)
  const ip = request.headers.get('x-forwarded-for') || 
             request.headers.get('x-real-ip') || 
             'unknown';
  
  const userAgent = request.headers.get('user-agent') || 'unknown';

  return {
    requestId,
    timestamp,
    ip,
    userAgent,
  };
}

/**
 * Validate webhook payload structure
 * @param payload - Parsed JSON payload
 * @returns True if payload structure is valid
 */
export function validateWebhookPayload(payload: any): { valid: boolean; error?: string } {
  if (!payload) {
    return { valid: false, error: 'Payload is empty' };
  }

  if (!payload.entry || !Array.isArray(payload.entry)) {
    return { valid: false, error: 'Invalid payload structure: missing or invalid entry array' };
  }

  if (payload.entry.length === 0) {
    return { valid: false, error: 'Invalid payload structure: empty entry array' };
  }

  return { valid: true };
}

/**
 * Sanitize webhook payload for logging (remove sensitive data)
 * @param payload - Raw webhook payload
 * @returns Sanitized payload
 */
export function sanitizeWebhookPayload(payload: any): any {
  const sanitized = { ...payload };

  // Remove any potentially sensitive fields
  if (sanitized.entry) {
    sanitized.entry = sanitized.entry.map((entry: any) => ({
      ...entry,
      changes: entry.changes?.map((change: any) => ({
        ...change,
        value: change.value ? {
          ...change.value,
          // Remove phone numbers from logs
          statuses: change.value.statuses?.map((status: any) => ({
            ...status,
            recipient_id: status.recipient_id ? '[REDACTED]' : undefined,
          })),
        } : undefined,
      })),
    }));
  }

  return sanitized;
}
