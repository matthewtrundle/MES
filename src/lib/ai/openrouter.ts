import OpenAI from 'openai';

// OpenRouter client using OpenAI SDK
// OpenRouter is compatible with OpenAI's API

const globalForOpenRouter = globalThis as unknown as {
  openrouter: OpenAI | undefined;
};

function createOpenRouterClient() {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    console.warn('OPENROUTER_API_KEY not set - AI features will be disabled');
    return null;
  }

  return new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey,
    defaultHeaders: {
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'X-Title': 'MES MVP - AI Monitor',
    },
  });
}

export const openrouter = globalForOpenRouter.openrouter ?? createOpenRouterClient();

if (process.env.NODE_ENV !== 'production' && openrouter) {
  globalForOpenRouter.openrouter = openrouter;
}

// Types for chat messages
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

// Default model - Claude 3.5 Sonnet via OpenRouter
const DEFAULT_MODEL = 'anthropic/claude-3.5-sonnet';

/**
 * Send a chat completion request to OpenRouter
 */
export async function chat(
  messages: ChatMessage[],
  options?: ChatOptions
): Promise<string | null> {
  if (!openrouter) {
    console.error('OpenRouter client not initialized');
    return null;
  }

  try {
    const response = await openrouter.chat.completions.create({
      model: options?.model || process.env.AI_MODEL || DEFAULT_MODEL,
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 2000,
    });

    return response.choices[0]?.message?.content ?? null;
  } catch (error) {
    console.error('OpenRouter API error:', error);
    throw error;
  }
}

/**
 * Send a streaming chat completion request
 */
export async function* chatStream(
  messages: ChatMessage[],
  options?: ChatOptions
): AsyncGenerator<string, void, unknown> {
  if (!openrouter) {
    throw new Error('OpenRouter client not initialized');
  }

  const stream = await openrouter.chat.completions.create({
    model: options?.model || process.env.AI_MODEL || DEFAULT_MODEL,
    messages,
    temperature: options?.temperature ?? 0.7,
    max_tokens: options?.maxTokens ?? 2000,
    stream: true,
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      yield content;
    }
  }
}

/**
 * Check if AI features are enabled
 */
export function isAIEnabled(): boolean {
  return !!openrouter && process.env.AI_ANALYSIS_ENABLED !== 'false';
}
