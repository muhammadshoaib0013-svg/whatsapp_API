/**
 * Message Handler Service
 * Phase 10: Basic Chatbot Logic for WhatsApp Automation SaaS
 * 
 * This service handles incoming webhook payloads and implements basic command detection
 * and automated responses via Meta Cloud API while maintaining strict tenant isolation.
 */

import { prisma } from '@/lib/db';
import { decryptWithVersion } from '@/lib/security/secret-rotation';
import { WhatsAppMessageValue, WhatsAppMessage, TenantInfo } from '@/app/api/webhooks/whatsapp/route';
import { handleAiMessage } from '@/lib/services/ai-chatbot-engine';

// TypeScript interfaces for message handling
export interface MessageHandlerContext {
  tenantId: string;
  whatsappAccountId: string;
  chatSessionId: string;
  customerPhoneNumber: string;
}

export interface BotResponse {
  triggered: boolean;
  response?: string;
  messageId?: string;
  error?: string;
}

export interface SendMessageResult {
  success: boolean;
  metaMessageId?: string;
  error?: string;
}

/**
 * Command patterns for basic chatbot logic
 */
const COMMAND_PATTERNS = {
  HI: /^(hi|hello|hey|greetings)/i,
  HELP: /^(help|assist|support)/i,
  MENU: /^(menu|options|commands)/i,
} as const;

/**
 * Predefined bot responses for basic commands
 */
const BOT_RESPONSES = {
  HI: "Hello! Welcome to our WhatsApp service. How can I help you today?",
  HELP: "I'm here to help! You can ask me about our services, check your order status, or speak with a human agent. Just type 'menu' to see all available options.",
  MENU: "📋 **Menu Options:**\n\n" +
        "1. Type 'help' for assistance\n" +
        "2. Type 'hi' to greet me\n" +
        "3. Type 'menu' to see this menu\n" +
        "4. Or just send your message and our team will respond shortly!",
} as const;

/**
 * Main message handler function
 * Takes raw webhook payload and processes it with tenant isolation
 */
export async function handleMessage(
  payload: WhatsAppMessageValue,
  tenantInfo: TenantInfo,
  chatSessionId: string
): Promise<BotResponse> {
  console.log('[MESSAGE_HANDLER] Starting message processing...');
  console.log('[MESSAGE_HANDLER] Tenant context:', {
    tenantId: tenantInfo.tenantId,
    whatsappAccountId: tenantInfo.whatsappAccountId,
    chatSessionId,
  });

  try {
    // Extract messages from payload
    const messages = payload.messages;
    if (!messages || messages.length === 0) {
      console.log('[MESSAGE_HANDLER] No messages in payload');
      return { triggered: false };
    }

    // Process each message
    for (const message of messages) {
      const result = await processSingleMessage(
        message,
        tenantInfo,
        chatSessionId
      );

      if (result.triggered) {
        return result;
      }
    }

    return { triggered: false };
  } catch (error) {
    console.error('[MESSAGE_HANDLER_ERROR]', error instanceof Error ? error.stack : error);
    return {
      triggered: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Process a single message with command detection
 */
async function processSingleMessage(
  message: WhatsAppMessage,
  tenantInfo: TenantInfo,
  chatSessionId: string
): Promise<BotResponse> {
  console.log('[MESSAGE_HANDLER] Processing single message:', message.id);

  // Extract message content
  const content = extractMessageContent(message);
  if (!content) {
    console.log('[MESSAGE_HANDLER] No content extracted from message');
    return { triggered: false };
  }

  console.log('[MESSAGE_HANDLER] Message content:', content.substring(0, 50));

  // Detect command
  const command = detectCommand(content);
  if (!command) {
    console.log('[MESSAGE_HANDLER] No command detected, checking AI fallback');
    
    // Step 2: Check if AI is enabled for this tenant
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantInfo.tenantId },
      select: { aiEnabled: true },
    });

    if (tenant?.aiEnabled) {
      console.log('[MESSAGE_HANDLER] AI enabled, calling AI handler');
      
      // Call AI handler
      const aiResult = await handleAiMessage(
        tenantInfo.tenantId,
        chatSessionId,
        content
      );

      if (aiResult.response) {
        console.log('[MESSAGE_HANDLER] AI response received, sending via WhatsApp API');
        
        // Send AI response via WhatsApp API
        const sendResult = await sendBotMessage(
          tenantInfo.tenantId,
          tenantInfo.whatsappAccountId,
          chatSessionId,
          message.from,
          aiResult.response
        );

        if (sendResult.success) {
          return {
            triggered: true,
            response: aiResult.response,
            messageId: sendResult.metaMessageId,
          };
        } else {
          console.error('[MESSAGE_HANDLER] Failed to send AI response:', sendResult.error);
          return { triggered: false, error: sendResult.error };
        }
      } else {
        console.log('[MESSAGE_HANDLER] AI returned no response or failed:', aiResult.error);
        // Step 3: AI failed or returned null - do nothing, wait for human agent
        return { triggered: false };
      }
    } else {
      console.log('[MESSAGE_HANDLER] AI not enabled for tenant, waiting for human agent');
      return { triggered: false };
    }
  }

  console.log('[MESSAGE_HANDLER] Command detected:', command);

  // Get bot response
  const responseText = BOT_RESPONSES[command];
  if (!responseText) {
    console.log('[MESSAGE_HANDLER] No response for command:', command);
    return { triggered: false };
  }

  // Send bot response via WhatsApp API
  const sendResult = await sendBotMessage(
    tenantInfo.tenantId,
    tenantInfo.whatsappAccountId,
    chatSessionId,
    message.from,
    responseText
  );

  if (!sendResult.success) {
    console.error('[MESSAGE_HANDLER] Failed to send bot response:', sendResult.error);
    return {
      triggered: false,
      error: sendResult.error,
    };
  }

  console.log('[MESSAGE_HANDLER] Bot response sent successfully');

  return {
    triggered: true,
    response: responseText,
    messageId: sendResult.metaMessageId,
  };
}

/**
 * Detect command from message content using pattern matching
 */
function detectCommand(content: string): keyof typeof BOT_RESPONSES | null {
  const normalizedContent = content.toLowerCase().trim();

  if (COMMAND_PATTERNS.HI.test(normalizedContent)) {
    return 'HI';
  }

  if (COMMAND_PATTERNS.HELP.test(normalizedContent)) {
    return 'HELP';
  }

  if (COMMAND_PATTERNS.MENU.test(normalizedContent)) {
    return 'MENU';
  }

  return null;
}

/**
 * Extract text content from WhatsApp message
 */
function extractMessageContent(message: WhatsAppMessage): string | null {
  if (message.text?.body) {
    return message.text.body;
  }
  return null;
}

/**
 * Send bot message via Meta Cloud API
 * This function handles the actual API call to send messages
 */
async function sendBotMessage(
  tenantId: string,
  whatsappAccountId: string,
  chatSessionId: string,
  toPhoneNumber: string,
  content: string
): Promise<SendMessageResult> {
  console.log('[BOT_SENDER] Sending bot message...');
  console.log('[BOT_SENDER] Context:', {
    tenantId,
    whatsappAccountId,
    chatSessionId,
    to: toPhoneNumber,
    contentLength: content.length,
  });

  try {
    // Get WhatsApp account details (with tenant isolation)
    const whatsappAccount = await prisma.whatsappAccount.findFirst({
      where: {
        id: whatsappAccountId,
        tenantId, // STRICT: Tenant isolation
      },
    });

    if (!whatsappAccount) {
      console.error('[BOT_SENDER] WhatsApp account not found');
      return { success: false, error: 'WhatsApp account not found' };
    }

    // Decrypt access token securely
    const accessToken = decryptWithVersion(whatsappAccount.encryptedAccessToken);
    console.log('[BOT_SENDER] Access token decrypted successfully');

    // Prepare API request
    const url = `https://graph.facebook.com/${whatsappAccount.graphApiVersion}/${whatsappAccount.phoneNumberId}/messages`;
    
    const requestBody = {
      messaging_product: 'whatsapp',
      to: toPhoneNumber,
      type: 'text',
      text: {
        body: content,
      },
    };

    console.log('[BOT_SENDER] Calling Meta Cloud API...');
    console.log('[BOT_SENDER] URL:', url);
    console.log('[BOT_SENDER] Request body:', JSON.stringify(requestBody, null, 2));

    // Send request to Meta Cloud API
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    console.log('[BOT_SENDER] API response status:', response.status);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
      console.error('[BOT_SENDER] API error response:', errorData);
      const errorMessage = errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`;
      return { success: false, error: errorMessage };
    }

    const responseData = await response.json();
    console.log('[BOT_SENDER] API success response:', JSON.stringify(responseData, null, 2));

    // Extract Meta message ID
    const metaMessageId = responseData.messages?.[0]?.id;
    if (!metaMessageId) {
      console.error('[BOT_SENDER] Invalid response structure - no message ID');
      return { success: false, error: 'Invalid response from Meta API' };
    }

    console.log('[BOT_SENDER] Meta message ID:', metaMessageId);

    // Log outbound message to database (with tenant isolation)
    console.log('[BOT_SENDER] Logging outbound message to database...');
    const botMessage = await prisma.message.create({
      data: {
        tenantId, // STRICT: Tenant isolation
        whatsappAccountId,
        chatSessionId,
        direction: 'OUTBOUND',
        content: content,
        messageType: 'TEXT',
        status: 'SENT',
        metaMessageId: metaMessageId,
        sentAt: new Date(),
      },
    });

    console.log('[BOT_SENDER] Outbound message logged:', botMessage.id);

    // Update chat session
    await prisma.chatSession.update({
      where: { id: chatSessionId },
      data: {
        lastMessageAt: new Date(),
        lastMessagePreview: content.substring(0, 100),
      },
    });

    console.log('[BOT_SENDER] Chat session updated');

    return {
      success: true,
      metaMessageId,
    };
  } catch (error) {
    console.error('[BOT_SENDER_ERROR]', error instanceof Error ? error.stack : error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Alternative strategy pattern for command handling
 * This can be extended for more complex command logic
 */
export class CommandStrategy {
  private strategies: Map<string, () => string> = new Map();

  constructor() {
    // Register default strategies
    this.registerStrategy('HI', () => BOT_RESPONSES.HI);
    this.registerStrategy('HELP', () => BOT_RESPONSES.HELP);
    this.registerStrategy('MENU', () => BOT_RESPONSES.MENU);
  }

  registerStrategy(command: string, handler: () => string): void {
    this.strategies.set(command.toUpperCase(), handler);
  }

  execute(command: string): string | null {
    const handler = this.strategies.get(command.toUpperCase());
    return handler ? handler() : null;
  }

  hasStrategy(command: string): boolean {
    return this.strategies.has(command.toUpperCase());
  }
}

// Export singleton instance
export const commandStrategy = new CommandStrategy();
