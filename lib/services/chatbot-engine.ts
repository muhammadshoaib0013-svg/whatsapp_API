import { prisma } from '@/lib/db';
import { decryptWithVersion } from '@/lib/security/secret-rotation';

/**
 * Process chatbot rules for an inbound message
 * This function checks the message against active chatbot rules for the tenant
 * and triggers automatic replies if a keyword match is found.
 *
 * @param tenantId - The tenant ID
 * @param whatsappAccountId - The WhatsApp account ID
 * @param chatSessionId - The chat session ID
 * @param messageContent - The message content to check against rules
 * @returns Object indicating whether a rule was triggered and the response
 */
export async function processChatbotRules(
  tenantId: string,
  whatsappAccountId: string,
  chatSessionId: string,
  messageContent: string
) {
  try {
    // Fetch active chatbot rules for the tenant, ordered by priority (highest first)
    const rules = await prisma.chatbotRule.findMany({
      where: {
        tenantId, // STRICT: Tenant isolation
        whatsappAccountId,
        isActive: true,
      },
      orderBy: {
        priority: 'desc', // Higher priority rules checked first
      },
    });

    if (rules.length === 0) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[CHATBOT_ENGINE] No active rules found for tenant', tenantId);
      }
      return { triggered: false, response: null };
    }

    // Normalize message content for matching (case-insensitive)
    const normalizedContent = messageContent.toLowerCase().trim();

    // Find matching rule
    let matchedRule = null;

    for (const rule of rules) {
      const normalizedKeyword = rule.keyword.toLowerCase().trim();

      let isMatch = false;

      switch (rule.matchType) {
        case 'EXACT':
          isMatch = normalizedContent === normalizedKeyword;
          break;
        case 'CONTAINS':
          isMatch = normalizedContent.includes(normalizedKeyword);
          break;
        case 'STARTS_WITH':
          isMatch = normalizedContent.startsWith(normalizedKeyword);
          break;
      }

      if (isMatch) {
        matchedRule = rule;
        break; // Use the first matching rule (highest priority due to ordering)
      }
    }

    if (!matchedRule) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[CHATBOT_ENGINE] No matching rule found for message:', messageContent);
      }
      return { triggered: false, response: null };
    }

    // Update rule statistics
    await prisma.chatbotRule.update({
      where: { id: matchedRule.id },
      data: {
        responseCount: { increment: 1 },
        lastTriggeredAt: new Date(),
      },
    });

    // Get chat session to retrieve customer phone number
    const chatSession = await prisma.chatSession.findUnique({
      where: { id: chatSessionId },
      select: { customerPhoneNumber: true },
    });

    if (!chatSession) {
      console.error('[CHATBOT_ENGINE] Chat session not found');
      return { triggered: false, response: null, error: 'Chat session not found' };
    }

    // Send message via WhatsApp Cloud API
    console.log('[CHATBOT_ENGINE] Sending message via WhatsApp Cloud API...');
    const sendResult = await sendWhatsAppMessage(
      tenantId,
      whatsappAccountId,
      chatSessionId,
      chatSession.customerPhoneNumber,
      matchedRule.responseText
    );

    if (!sendResult.success) {
      console.error('[CHATBOT_ENGINE] Failed to send message via WhatsApp API:', sendResult.error);
      // Still create the message record even if API send failed
      // This ensures we have a record of the attempted response
    }

    // Log the trigger
    if (process.env.NODE_ENV === 'development') {
      console.log('[CHATBOT_ENGINE] Rule triggered:', {
        tenantId,
        ruleId: matchedRule.id,
        keyword: matchedRule.keyword,
        responseText: matchedRule.responseText.substring(0, 50),
        messageContent: messageContent.substring(0, 50),
        apiSendSuccess: sendResult.success,
      });
    }

    return {
      triggered: true,
      response: matchedRule.responseText,
      messageId: sendResult.messageId,
      ruleId: matchedRule.id,
    };
  } catch (error) {
    console.error('[CHATBOT_ENGINE_ERROR]', error instanceof Error ? error.stack : error);
    return { triggered: false, response: null, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Send message via WhatsApp Cloud API
 * This function handles the actual API call to send messages
 */
async function sendWhatsAppMessage(
  tenantId: string,
  whatsappAccountId: string,
  chatSessionId: string,
  toPhoneNumber: string,
  content: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  console.log('[CHATBOT_SENDER] Sending WhatsApp message...');
  console.log('[CHATBOT_SENDER] Context:', {
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
      console.error('[CHATBOT_SENDER] WhatsApp account not found');
      return { success: false, error: 'WhatsApp account not found' };
    }

    // Decrypt access token securely
    const accessToken = decryptWithVersion(whatsappAccount.encryptedAccessToken);
    console.log('[CHATBOT_SENDER] Access token decrypted successfully');

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

    console.log('[CHATBOT_SENDER] Calling Meta Cloud API...');
    console.log('[CHATBOT_SENDER] URL:', url);

    // Send request to Meta Cloud API
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    console.log('[CHATBOT_SENDER] API response status:', response.status);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
      console.error('[CHATBOT_SENDER] API error response:', errorData);
      const errorMessage = errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`;
      return { success: false, error: errorMessage };
    }

    const responseData = await response.json();
    console.log('[CHATBOT_SENDER] API success response');

    // Extract Meta message ID
    const metaMessageId = responseData.messages?.[0]?.id;
    if (!metaMessageId) {
      console.error('[CHATBOT_SENDER] Invalid response structure - no message ID');
      return { success: false, error: 'Invalid response from Meta API' };
    }

    console.log('[CHATBOT_SENDER] Meta message ID:', metaMessageId);

    // Log outbound message to database (with tenant isolation)
    console.log('[CHATBOT_SENDER] Logging outbound message to database...');
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

    console.log('[CHATBOT_SENDER] Outbound message logged:', botMessage.id);

    // Update chat session
    await prisma.chatSession.update({
      where: { id: chatSessionId },
      data: {
        lastMessageAt: new Date(),
        lastMessagePreview: content.substring(0, 100),
      },
    });

    console.log('[CHATBOT_SENDER] Chat session updated');

    return {
      success: true,
      messageId: botMessage.id,
    };
  } catch (error) {
    console.error('[CHATBOT_SENDER_ERROR]', error instanceof Error ? error.stack : error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
