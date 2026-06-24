/**
 * Model Adapter - Abstraction for model providers
 *
 * Allows swapping between real (LM Studio) and fake (testing) adapters
 * without changing the calling code.
 */

import type {
  ChatMessage,
  ChatRequestResult,
  OpenAITool,
} from '../types';
import { sendChatRequest } from './lmstudio';

export interface ModelAdapterChatOptions {
  baseUrl: string;
  model: string;
  messages: ChatMessage[];
  tools?: OpenAITool[];
  streaming: boolean;
  signal?: AbortSignal;
  onChunk?: (chunk: string) => void;
  onReasoning?: (chunk: string) => void;
}

export interface ModelAdapter {
  chat(options: ModelAdapterChatOptions): Promise<ChatRequestResult>;
}

/**
 * LM Studio adapter - wraps sendChatRequest from lmstudio.ts
 */
export const lmStudioAdapter: ModelAdapter = {
  async chat(options: ModelAdapterChatOptions): Promise<ChatRequestResult> {
    return sendChatRequest({
      baseUrl: options.baseUrl,
      modelName: options.model,
      streaming: options.streaming,
      messages: options.messages,
      tools: options.tools,
      signal: options.signal,
      onChunk: options.onChunk,
    });
  },
};

/**
 * Fake adapter for testing - returns configurable fake responses
 */
export interface FakeAdapterOptions {
  content?: string;
  reasoning?: string;
  toolCalls?: ChatRequestResult['toolCalls'];
  finishReason?: ChatRequestResult['finishReason'];
  delayMs?: number;
  shouldThrow?: boolean;
  errorMessage?: string;
}

export function createFakeAdapter(fakeOptions: FakeAdapterOptions): ModelAdapter {
  return {
    async chat(chatOptions: ModelAdapterChatOptions): Promise<ChatRequestResult> {
      const { delayMs = 0, shouldThrow = false, errorMessage = 'Fake error', content = '', reasoning, toolCalls = [], finishReason } = fakeOptions;

      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }

      if (shouldThrow) {
        throw new Error(errorMessage);
      }

      // Check abort signal before starting
      if (chatOptions.signal?.aborted) {
        const error = new Error('Aborted');
        error.name = 'AbortError';
        throw error;
      }

      let streamedContent = '';

      // Simulate streaming by calling onChunk with the content
      if (chatOptions.streaming && chatOptions.onChunk && content) {
        // Split content into chunks to simulate streaming
        const chunkSize = Math.max(1, Math.floor(content.length / 10));
        for (let i = 0; i < content.length; i += chunkSize) {
          // Check abort signal during streaming
          if (chatOptions.signal?.aborted) {
            const error = new Error('Aborted');
            error.name = 'AbortError';
            throw error;
          }
          const chunk = content.slice(i, i + chunkSize);
          streamedContent += chunk;
          chatOptions.onChunk(chunk);
          // Small delay between chunks
          await new Promise((resolve) => setTimeout(resolve, 5));
        }
      }

      // Simulate reasoning streaming
      if (chatOptions.streaming && chatOptions.onReasoning && reasoning) {
        for (const part of reasoning.split(' ')) {
          // Check abort signal during streaming
          if (chatOptions.signal?.aborted) {
            const error = new Error('Aborted');
            error.name = 'AbortError';
            throw error;
          }
          chatOptions.onReasoning(part + ' ');
        }
      }

      return {
        content: streamedContent || content,
        reasoning,
        toolCalls,
        finishReason: finishReason ?? (toolCalls.length ? 'tool_calls' : 'stop'),
      };
    },
  };
}

/**
 * Default adapter is LM Studio
 */
export const defaultModelAdapter: ModelAdapter = lmStudioAdapter;
