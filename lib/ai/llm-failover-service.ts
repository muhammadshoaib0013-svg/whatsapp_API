import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

// Environment variables
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Primary: Gemini Free (using OpenAI-compatible endpoint)
const geminiClient = GEMINI_API_KEY 
  ? new OpenAI({
      apiKey: GEMINI_API_KEY,
      baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    })
  : null;

// Fallback: OpenAI Standby
const openaiClient = OPENAI_API_KEY
  ? new OpenAI({ apiKey: OPENAI_API_KEY })
  : null;

/**
 * Check if at least one LLM provider is configured
 */
export function isLLMConfigured(): boolean {
  return !!geminiClient || !!openaiClient;
}

interface LLMCompletionOptions {
  messages: ChatCompletionMessageParam[];
  maxTokens?: number;
  temperature?: number;
}

interface LLMCompletionResult {
  content: string | null;
  provider: 'gemini' | 'openai' | 'none';
  error?: string;
}

/**
 * LLM Failover Service
 * Attempts Primary (Gemini) first, falls back to OpenAI on failure
 * Returns consistent response format regardless of provider
 */
export async function getLLMCompletion(
  options: LLMCompletionOptions
): Promise<LLMCompletionResult> {
  const { messages, maxTokens = 500, temperature = 0.7 } = options;

  console.log('[LLM_FAILOVER] Attempting LLM completion...');
  console.log('[LLM_FAILOVER] Gemini configured:', !!geminiClient);
  console.log('[LLM_FAILOVER] OpenAI configured:', !!openaiClient);

  // Try Primary: Gemini Free
  if (geminiClient) {
    try {
      console.log('[LLM_FAILOVER] Primary attempt: Gemini (gemini-1.5-flash)');
      
      const completion = await geminiClient.chat.completions.create({
        model: 'gemini-1.5-flash',
        messages,
        max_tokens: maxTokens,
        temperature,
      });

      const content = completion.choices[0]?.message?.content;

      if (content) {
        console.log('[LLM_FAILOVER] Gemini success:', content.substring(0, 100));
        return { content, provider: 'gemini' };
      } else {
        console.warn('[LLM_FAILOVER] Gemini returned empty response, falling back to OpenAI...');
      }
    } catch (error) {
      console.warn('[LLM_FAILOVER] Gemini failed, falling back to OpenAI...');
      console.warn('[LLM_FAILOVER] Gemini error:', error instanceof Error ? error.message : error);
    }
  } else {
    console.warn('[LLM_FAILOVER] Gemini not configured, skipping to OpenAI...');
  }

  // Fallback: OpenAI Standby
  if (openaiClient) {
    try {
      console.log('[LLM_FAILOVER] Fallback attempt: OpenAI (gpt-4o-mini)');
      
      const completion = await openaiClient.chat.completions.create({
        model: 'gpt-4o-mini',
        messages,
        max_tokens: maxTokens,
        temperature,
      });

      const content = completion.choices[0]?.message?.content;

      if (content) {
        console.log('[LLM_FAILOVER] OpenAI success:', content.substring(0, 100));
        return { content, provider: 'openai' };
      } else {
        console.warn('[LLM_FAILOVER] OpenAI returned empty response');
        return { content: null, provider: 'openai', error: 'Empty response from OpenAI' };
      }
    } catch (error) {
      console.error('[LLM_FAILOVER] OpenAI also failed:', error instanceof Error ? error.message : error);
      return { 
        content: null, 
        provider: 'openai', 
        error: error instanceof Error ? error.message : 'OpenAI API error' 
      };
    }
  }

  // No providers available
  console.error('[LLM_FAILOVER] No LLM providers configured');
  return { 
    content: null, 
    provider: 'none', 
    error: 'No LLM providers configured' 
  };
}
