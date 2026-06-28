import OpenAI from 'openai';

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  console.warn('[OPENAI_CLIENT] OPENAI_API_KEY not configured');
}

// Initialize OpenAI client
export const openai = apiKey ? new OpenAI({ apiKey }) : null;

/**
 * Check if OpenAI client is configured
 */
export function isOpenAIConfigured(): boolean {
  return !!openai;
}
