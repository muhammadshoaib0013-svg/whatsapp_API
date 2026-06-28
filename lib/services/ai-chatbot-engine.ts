import { prisma } from '@/lib/db';
import { openai, isOpenAIConfigured } from '@/lib/ai/openai-client';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

const SYSTEM_PROMPT = 'You are a helpful customer support assistant. Keep answers short and precise.';
const MODEL = 'gpt-4o-mini';
const CONTEXT_MESSAGE_COUNT = 10;

interface AiMessageResult {
  response: string | null;
  error?: string;
}

/**
 * Handle AI message processing
 * Fetches conversation context and calls OpenAI Chat Completions API
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

  // Check if OpenAI is configured
  if (!isOpenAIConfigured()) {
    console.warn('[AI_CHATBOT] OpenAI not configured');
    return { response: null, error: 'OpenAI not configured' };
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

    // Build conversation history for OpenAI
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

    console.log('[AI_CHATBOT] Calling OpenAI API with', apiMessages.length, 'messages');

    // Call OpenAI Chat Completions API
    const completion = await openai!.chat.completions.create({
      model: MODEL,
      messages: apiMessages,
      max_tokens: 500,
      temperature: 0.7,
    });

    const aiResponse = completion.choices[0]?.message?.content;

    if (!aiResponse) {
      console.warn('[AI_CHATBOT] OpenAI returned empty response');
      return { response: null, error: 'Empty response from AI' };
    }

    console.log('[AI_CHATBOT] AI response generated:', aiResponse.substring(0, 100));

    return { response: aiResponse };
  } catch (error) {
    console.error('[AI_CHATBOT] OpenAI API error:', error);
    
    // Return null to trigger human handoff on any error
    return {
      response: null,
      error: error instanceof Error ? error.message : 'Unknown AI error',
    };
  }
}
