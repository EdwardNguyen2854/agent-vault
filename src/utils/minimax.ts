/**
 * MiniMax API Integration Utilities
 *
 * Provides utilities for connecting to and interacting with MiniMax's
 * OpenAI-compatible API endpoints.
 */

import type {
  AgentContextItemType,
  ChatMessage,
  ChatRequestResult,
  OpenAITool,
  OpenAIToolCall,
} from '../types';

export interface MiniMaxConfig {
  apiKey: string;
  baseUrl: string;
  modelName: string;
  streaming: boolean;
  temperature?: number;
  maxTokens?: number;
}

export interface ContextItem {
  type: AgentContextItemType | 'task' | 'heading';
  title: string;
  content: string;
  path?: string;
}

export interface MiniMaxError {
  code:
    | 'CONNECTION_REFUSED'
    | 'INVALID_RESPONSE'
    | 'TIMEOUT'
    | 'API_ERROR'
    | 'CANCELLED'
    | 'UNAUTHORIZED'
    | 'UNKNOWN';
  message: string;
  details?: string;
}

export const defaultMiniMaxConfig: MiniMaxConfig = {
  apiKey: '',
  baseUrl: 'https://api.minimax.chat/v1',
  modelName: 'MiniMax-Text-01',
  streaming: true,
  temperature: 0.7,
  maxTokens: 2048,
};

export async function checkConnection(config: MiniMaxConfig): Promise<boolean> {
  const url = `${config.baseUrl}/chat/completions`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.modelName,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
        stream: false,
      }),
    });
    clearTimeout(timeout);
    return response.ok;
  } catch {
    clearTimeout(timeout);
    return false;
  }
}

export async function getModels(config: MiniMaxConfig): Promise<string[]> {
  const url = `${config.baseUrl}/models`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = (await response.json()) as { data?: Array<{ id: string }> };

    if (Array.isArray(data?.data)) {
      return data.data.map((model) => model.id);
    }

    if (Array.isArray(data)) {
      return data.map((model) => (typeof model === 'string' ? model : model.id));
    }

    return [];
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw { code: 'TIMEOUT' as const, message: 'Request timed out while fetching models' };
    }
    throw {
      code: 'CONNECTION_REFUSED' as const,
      message: 'Failed to connect to MiniMax',
      details: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function testConnection(config: MiniMaxConfig): Promise<{
  success: boolean;
  error?: string;
  model?: string;
}> {
  try {
    if (!config.apiKey) {
      return {
        success: false,
        error: 'API key is required. Please enter your MiniMax API key.',
      };
    }

    const isConnected = await checkConnection(config);

    if (!isConnected) {
      return {
        success: false,
        error: 'Could not connect to MiniMax. Check your API key and internet connection.',
      };
    }

    return {
      success: true,
      model: config.modelName,
    };
  } catch (err) {
    const error = err as { code?: string; message?: string };
    return {
      success: false,
      error: error.message || 'Unknown error occurred',
    };
  }
}

interface ChatCompletionChunk {
  choices?: Array<{
    delta?: {
      content?: string;
      reasoning?: string;
      reasoning_content?: string;
      tool_calls?: Array<{
        index: number;
        id?: string;
        type?: string;
        function?: { name?: string; arguments?: string };
      }>;
    };
    finish_reason?: string;
  }>;
}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string;
      reasoning?: string;
      reasoning_content?: string;
      tool_calls?: Array<{
        id: string;
        type: 'function';
        function: { name: string; arguments: string };
      }>;
    };
    finish_reason?: string;
  }>;
  error?: {
    message?: string;
    code?: string;
  };
}

type SerializedChatContent =
  | string
  | Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }>;

export interface ChatContentResult {
  content: string;
  reasoning?: string;
}

export function extractReasoningFromContent(
  content: string,
  existingReasoning = '',
): ChatContentResult {
  const reasoningParts: string[] = [];
  if (existingReasoning.trim()) {
    reasoningParts.push(existingReasoning.trim());
  }

  const cleaned = content
    .replace(/<think>([\s\S]*?)<\/think>/gi, (_match, thought: string) => {
      const trimmed = thought.trim();
      if (trimmed) reasoningParts.push(trimmed);
      return '';
    })
    .trim();

  return {
    content: cleaned,
    reasoning: reasoningParts.length > 0 ? reasoningParts.join('\n\n') : undefined,
  };
}

export interface SendChatRequestParams {
  apiKey: string;
  baseUrl: string;
  modelName: string;
  streaming: boolean;
  messages: ChatMessage[];
  tools?: OpenAITool[];
  onChunk?: (chunk: string) => void;
  signal?: AbortSignal;
  temperature?: number;
  maxTokens?: number;
}

export async function sendChatRequest(params: SendChatRequestParams): Promise<ChatRequestResult> {
  const {
    apiKey,
    baseUrl,
    modelName,
    streaming,
    messages,
    tools,
    onChunk,
    signal,
    temperature,
    maxTokens,
  } = params;
  const url = `${baseUrl}/chat/completions`;

  const requestBody: Record<string, unknown> = {
    model: modelName,
    messages: serializeToolAwareMessages(messages),
    stream: streaming,
  };

  if (temperature !== undefined) requestBody.temperature = temperature;
  if (maxTokens !== undefined) requestBody.max_tokens = maxTokens;

  if (tools && tools.length > 0) {
    requestBody.tools = tools;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);

  const combinedSignal = signal
    ? combineAbortSignals(controller.signal, signal)
    : controller.signal;

  try {
    if (streaming && onChunk) {
      return await handleStreamingToolResponse(url, requestBody, combinedSignal, onChunk, apiKey);
    } else {
      return await handleNonStreamingToolResponse(url, requestBody, combinedSignal, apiKey);
    }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      const cancelled = signal?.aborted;
      return {
        content: '',
        reasoning: undefined,
        toolCalls: [],
        finishReason: cancelled ? 'error' : 'error',
      };
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

function serializeToolAwareMessages(messages: ChatMessage[]): Array<Record<string, unknown>> {
  return serializeChatMessages(messages);
}

function serializeChatContent(message: ChatMessage): SerializedChatContent {
  const imageAttachments = [
    ...(message.attachments ?? []).filter((attachment) => attachment.kind === 'image'),
    ...(message.imageAttachments ?? []).filter((attachment) => attachment.kind === 'image'),
  ];
  if (imageAttachments.length === 0) {
    return message.content;
  }

  const parts: SerializedChatContent = [];
  if (message.content.trim()) {
    parts.push({ type: 'text', text: message.content });
  }
  for (const attachment of imageAttachments) {
    parts.push({ type: 'image_url', image_url: { url: attachment.dataUrl } });
  }
  return parts;
}

function serializeChatMessages(messages: ChatMessage[]): Array<Record<string, unknown>> {
  return messages.map((message) => {
    if (message.role === 'tool') {
      return {
        role: 'tool',
        content: message.content,
        tool_call_id: message.toolCallId,
        name: message.toolName,
      };
    }

    const serialized: Record<string, unknown> = {
      role: message.role,
      content: serializeChatContent(message),
    };

    if (message.role === 'assistant' && message.toolCalls?.length) {
      serialized.tool_calls = message.toolCalls.map((toolCall) => ({
        id: toolCall.id,
        type: toolCall.type,
        function: {
          name: toolCall.function.name,
          arguments: toolCall.function.arguments,
        },
      }));
    }

    return serialized;
  });
}

function combineAbortSignals(...signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();
  for (const sig of signals) {
    if (sig.aborted) {
      controller.abort();
      return controller.signal;
    }
    sig.addEventListener('abort', () => controller.abort(), { once: true });
  }
  return controller.signal;
}

async function handleStreamingToolResponse(
  url: string,
  body: Record<string, unknown>,
  signal: AbortSignal,
  onChunk: (chunk: string) => void,
  apiKey: string,
): Promise<ChatRequestResult> {
  const response = await fetch(url, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({ ...body, stream: true }),
  });

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as ChatCompletionResponse;
    throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Response body is not readable');
  }

  const decoder = new TextDecoder();
  let fullContent = '';
  let reasoning = '';
  let buffer = '';
  const toolCalls: OpenAIToolCall[] = [];
  const partialToolCalls = new Map<
    number,
    { id?: string; type?: string; name?: string; argumentsBuffer: string }
  >();

  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
      if (done) buffer += '\n';
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;

        const data = trimmed.slice(6).trim();
        if (data === '[DONE]') continue;

        try {
          const chunk = JSON.parse(data) as ChatCompletionChunk;
          const choice = chunk.choices?.[0];
          if (!choice) continue;

          const contentDelta = choice.delta?.content;
          const reasoningDelta = choice.delta?.reasoning_content ?? choice.delta?.reasoning;
          if (reasoningDelta) {
            reasoning += reasoningDelta;
          }
          if (contentDelta) {
            fullContent += contentDelta;
            onChunk(contentDelta);
          }

          const toolCallDeltas = choice.delta?.tool_calls;
          if (toolCallDeltas) {
            for (const delta of toolCallDeltas) {
              let partial = partialToolCalls.get(delta.index);
              if (!partial) {
                partial = { argumentsBuffer: '' };
                partialToolCalls.set(delta.index, partial);
              }
              if (delta.id) partial.id = delta.id;
              if (delta.type) partial.type = delta.type;
              if (delta.function?.name) partial.name = delta.function.name;
              if (delta.function?.arguments) partial.argumentsBuffer += delta.function.arguments;
            }
          }

          if (choice.finish_reason === 'tool_calls') {
            for (const [index, partial] of partialToolCalls) {
              toolCalls.push({
                id: partial.id ?? `call_${index}`,
                type: 'function',
                function: {
                  name: partial.name ?? '',
                  arguments: partial.argumentsBuffer,
                },
              });
            }
            partialToolCalls.clear();
          }
        } catch {
          // Skip malformed JSON lines
        }
      }

      if (done) break;
    }
  } finally {
    reader.releaseLock();
  }

  const parsedContent = extractReasoningFromContent(fullContent, reasoning);
  return {
    content: parsedContent.content,
    reasoning: parsedContent.reasoning,
    toolCalls,
    finishReason: toolCalls.length > 0 ? 'tool_calls' : 'stop',
  };
}

async function handleNonStreamingToolResponse(
  url: string,
  body: Record<string, unknown>,
  signal: AbortSignal,
  apiKey: string,
): Promise<ChatRequestResult> {
  const response = await fetch(url, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
    },
    body: JSON.stringify({ ...body, stream: false }),
  });

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as ChatCompletionResponse;
    throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`);
  }

  const data = (await response.json()) as ChatCompletionResponse;
  const choice = data.choices?.[0];
  const message = choice?.message;
  const parsedContent = extractReasoningFromContent(
    message?.content ?? '',
    message?.reasoning_content ?? message?.reasoning ?? '',
  );
  const content = parsedContent.content;

  if (choice?.finish_reason === 'tool_calls' && message?.tool_calls) {
    return {
      content,
      reasoning: parsedContent.reasoning,
      toolCalls: message.tool_calls.map((tc) => ({
        id: tc.id,
        type: 'function' as const,
        function: {
          name: tc.function.name,
          arguments: tc.function.arguments,
        },
      })),
      finishReason: 'tool_calls',
    };
  }

  if (!content && !message?.tool_calls?.length) {
    throw new Error('No content in response');
  }

  return {
    content,
    reasoning: parsedContent.reasoning,
    toolCalls: [],
    finishReason: 'stop',
  };
}
