import { prisma } from '@/lib/db';
import { isLLMConfigured, getLLMCompletion } from '@/lib/ai/llm-failover-service';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

const SYSTEM_PROMPT = 'You are a helpful customer support assistant. Keep answers short and precise.';
const CONTEXT_MESSAGE_COUNT = 10;

interface AiMessageResult {
  response: string | null;
  error?: string;
}

/**
 * Handle AI message processing
 * Fetches conversation context and calls LLM with failover (Gemini Primary, OpenAI Fallback)
 * Returns null if AI fails or confidence is low (to trigger human handoff)
 */
export async function handleAiMessage(
  tenantId: string,
  chatSessionId: string,
  customerMessage: string
): Promise<AiMessageResult> {
  console.log('[AI_CHATBOT] Processing message for tenant:', tenantId);
  console.log('[AI_CHATBOT] Chat session:', chatSessionId);
  console.log('[AI_CHATBOT] Customer message:', customerMessage);

  // Check if LLM is configured
  if (!isLLMConfigured()) {
    console.warn('[AI_CHATBOT] LLM not configured');
    return { response: null, error: 'LLM not configured' };
  }

  try {
    // Fetch last N messages for context (tenant-isolated)
    const messages = await prisma.message.findMany({
      where: {
        tenantId: tenantId,
        chatSessionId: chatSessionId,
      },
      orderBy: {
        createdAt: 'asc',
      },
      take: CONTEXT_MESSAGE_COUNT,
      select: {
        direction: true,
        content: true,
        createdAt: true,
      },
    });

    console.log('[AI_CHATBOT] Fetched', messages.length, 'messages for context');

    // Build conversation history for LLM
    const conversationHistory: ChatCompletionMessageParam[] = messages.map((msg) => ({
      role: msg.direction === 'INBOUND' ? 'user' : 'assistant',
      content: msg.content,
    }));

    // Add current customer message
    conversationHistory.push({
      role: 'user',
      content: customerMessage,
    });

    // Add system prompt at the beginning
    const apiMessages: ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: SYSTEM_PROMPT,
      },
      ...conversationHistory,
    ];

    console.log('[AI_CHATBOT] Calling LLM with failover (Gemini Primary, OpenAI Fallback) with', apiMessages.length, 'messages');

    // Call LLM with failover mechanism
    const result = await getLLMCompletion({
      messages: apiMessages,
      maxTokens: 500,
      temperature: 0.7,
    });

    if (!result.content) {
      console.warn('[AI_CHATBOT] LLM returned empty response. Provider:', result.provider, 'Error:', result.error);
      return { response: null, error: result.error || 'Empty response from LLM' };
    }

    console.log('[AI_CHATBOT] AI response generated from provider:', result.provider);
    console.log('[AI_CHATBOT] Response:', result.content.substring(0, 100));

    return { response: result.content };
  } catch (error) {
    console.error('[AI_CHATBOT] LLM processing error:', error);
    
    // Return null to trigger human handoff on any error
    return {
      response: null,
      error: error instanceof Error ? error.message : 'Unknown AI error',
    };
  }
}
