import { prisma } from '@/lib/db';
import { decrypt } from '@/lib/security/encryption';

export interface WhatsAppAccount {
  id: string;
  tenantId: string;
  displayName: string;
  wabaId: string;
  phoneNumberId: string;
  businessPhoneNumber: string;
  graphApiVersion: string;
  encryptedAccessToken: string;
  connectionStatus: string;
}

export interface TemplateComponent {
  type: string;
  text?: string;
  format?: string;
}

export interface WhatsAppTemplate {
  id: string;
  tenantId: string;
  whatsappAccountId: string;
  metaTemplateId: string;
  name: string;
  language: string;
  category: string;
  status: string;
  componentsJson: any;
  lastSyncedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface SendMessageRequest {
  templateId: string;
  toPhoneNumber: string;
  language?: string;
  variables?: Record<string, string>;
}

/**
 * Get the WhatsApp account for the current tenant
 * Throws error if account not found
 */
export async function getWhatsAppAccountForTenant(tenantId: string): Promise<WhatsAppAccount> {
  const account = await prisma.whatsappAccount.findFirst({
    where: { tenantId },
  });

  if (!account) {
    throw new Error('No WhatsApp account found for this tenant');
  }

  return account;
}

/**
 * Decrypt the WhatsApp access token safely
 * Returns the decrypted token or throws error
 */
export async function decryptWhatsAppTokenSafely(encryptedAccessToken: string): Promise<string> {
  try {
    return decrypt(encryptedAccessToken);
  } catch (error) {
    console.error('Failed to decrypt WhatsApp access token:', error);
    throw new Error('Failed to decrypt access token. Please re-enter your credentials.');
  }
}

/**
 * Normalize Meta API error to a safe user-facing message
 * Never exposes raw token or sensitive details
 */
export function normalizeMetaError(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    
    if (message.includes('invalid oauth') || message.includes('access token')) {
      return 'Invalid or expired access token. Please update your WhatsApp credentials.';
    }
    
    if (message.includes('permission') || message.includes('unauthorized')) {
      return 'Insufficient permissions. Please check your token permissions.';
    }
    
    if (message.includes('phone number') || message.includes('not found')) {
      return 'Phone number not found or invalid. Please check your configuration.';
    }
    
    if (message.includes('template') || message.includes('not approved')) {
      return 'Template not found or not approved. Please check your template status.';
    }
    
    if (message.includes('rate limit') || message.includes('too many')) {
      return 'Rate limit exceeded. Please try again later.';
    }
    
    return error.message;
  }
  
  return 'An unknown error occurred while communicating with Meta API.';
}

/**
 * Fetch templates from Meta Graph API
 * Returns array of template data from Meta
 * Implements pagination to fetch all templates
 */
export async function fetchTemplatesFromMeta(
  wabaId: string,
  accessToken: string,
  graphApiVersion: string
): Promise<any[]> {
  let allTemplates: any[] = [];
  let nextUrl: string | null = `https://graph.facebook.com/${graphApiVersion}/${wabaId}/message_templates`;

  while (nextUrl) {
    const response: Response = await fetch(nextUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
      throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    const data: { data?: any[]; paging?: { next?: string } } = await response.json();

    // Add templates from this page
    if (data.data && Array.isArray(data.data)) {
      allTemplates = allTemplates.concat(data.data);
    }

    // Check if there's a next page
    nextUrl = data.paging?.next || null;
  }

  return allTemplates;
}

/**
 * Send a template message via Meta Graph API
 * Returns the Meta message ID
 */
export async function sendTemplateMessage(
  phoneNumberId: string,
  toPhoneNumber: string,
  templateName: string,
  languageCode: string,
  components: any[],
  accessToken: string,
  graphApiVersion: string
): Promise<string> {
  const url = `https://graph.facebook.com/${graphApiVersion}/${phoneNumberId}/messages`;

  console.log('[META_API_CALL] Sending request to Meta Graph API');
  console.log('[META_API_CALL] URL:', url);
  console.log('[META_API_CALL] Phone number ID:', phoneNumberId);
  console.log('[META_API_CALL] To:', toPhoneNumber);
  console.log('[META_API_CALL] Template:', templateName);
  console.log('[META_API_CALL] Language:', languageCode);

  const body = {
    messaging_product: 'whatsapp',
    to: toPhoneNumber,
    type: 'template',
    template: {
      name: templateName,
      language: {
        code: languageCode,
      },
      components: components,
    },
  };

  console.log('[META_API_CALL] Request body:', JSON.stringify(body, null, 2));

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  console.log('[META_API_RESPONSE] Response status:', response.status);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
    console.log('[META_API_RESPONSE] Error response:', errorData);
    throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  console.log('[META_API_RESPONSE] Success response:', JSON.stringify(data, null, 2));

  if (!data.messages || !data.messages[0] || !data.messages[0].id) {
    console.log('[META_API_RESPONSE] Invalid response structure');
    throw new Error('Invalid response from Meta API');
  }

  console.log('[META_API_RESPONSE] Meta message ID:', data.messages[0].id);
  return data.messages[0].id;
}
