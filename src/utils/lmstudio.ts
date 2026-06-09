/**
 * LM Studio API Integration Utilities
 *
 * Provides utilities for connecting to and interacting with LM Studio's
 * OpenAI-compatible API endpoints.
 */

import type {
  AgentContextItemType,
  ChatMessage,
  ChatRequestResult,
  OpenAITool,
  OpenAIToolCall,
} from '../types';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface LMStudioConfig {
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

export interface LMStudioError {
  code:
    | 'CONNECTION_REFUSED'
    | 'INVALID_RESPONSE'
    | 'TIMEOUT'
    | 'API_ERROR'
    | 'CANCELLED'
    | 'UNKNOWN';
  message: string;
  details?: string;
}

// ============================================================================
// Default Configuration
// ============================================================================

export const defaultLMStudioConfig: LMStudioConfig = {
  baseUrl: '/lms/v1',
  modelName: '',
  streaming: true,
  temperature: 0.7,
  maxTokens: 2048,
};

// ============================================================================
// Connection Functions
// ============================================================================

/**
 * Checks if LM Studio is running and accessible by hitting the /models endpoint.
 * LM Studio does not expose a /health endpoint; the OpenAI-compatible /v1/models
 * route is the canonical liveness probe.
 */
export async function checkConnection(config: LMStudioConfig): Promise<boolean> {
  const modelsUrl = `${config.baseUrl}/models`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(modelsUrl, {
      method: 'GET',
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeout);
    return response.ok;
  } catch {
    clearTimeout(timeout);
    return false;
  }
}

/**
 * Retrieves the list of available models from LM Studio.
 */
export async function getModels(config: LMStudioConfig): Promise<string[]> {
  const url = `${config.baseUrl}/models`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = (await response.json()) as { data?: Array<{ id: string }> };

    if (Array.isArray(data?.data)) {
      return data.data.map((model) => model.id);
    }

    // LM Studio might return models directly as an array
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
      message: 'Failed to connect to LM Studio',
      details: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Tests the connection to LM Studio and returns detailed status.
 */
export async function testConnection(config: LMStudioConfig): Promise<{
  success: boolean;
  error?: string;
  model?: string;
}> {
  try {
    const isConnected = await checkConnection(config);

    if (!isConnected) {
      return {
        success: false,
        error: 'Could not connect to LM Studio. Make sure the application is running.',
      };
    }

    // Try to get models to verify API is working
    const models = await getModels(config);

    if (models.length === 0) {
      return {
        success: true,
        model: config.modelName,
        error: 'Connected but no models loaded in LM Studio',
      };
    }

    // Check if the configured model is available
    const modelAvailable = models.some(
      (m) =>
        m.toLowerCase().includes(config.modelName.toLowerCase()) ||
        config.modelName.toLowerCase().includes(m.toLowerCase()),
    );

    return {
      success: true,
      model: models[0], // Return first available model
      error: modelAvailable
        ? undefined
        : `Configured model "${config.modelName}" not found. Available: ${models.join(', ')}`,
    };
  } catch (err) {
    const error = err as { code?: string; message?: string };
    return {
      success: false,
      error: error.message || 'Unknown error occurred',
    };
  }
}

// ============================================================================
// Chat Functions
// ============================================================================

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

/**
 * Sends a chat message to LM Studio and returns the response.
 * Supports streaming responses via the onChunk callback.
 * Pass an external `externalSignal` to allow the caller to abort (e.g. a Stop button).
 */
export async function sendChatMessage(
  config: LMStudioConfig,
  messages: ChatMessage[],
  onChunk?: (chunk: string) => void,
  externalSignal?: AbortSignal,
): Promise<ChatContentResult> {
  const url = `${config.baseUrl}/chat/completions`;

  const requestBody: Record<string, unknown> = {
    model: config.modelName,
    messages: serializeChatMessages(messages),
    stream: config.streaming,
  };

  if (config.temperature !== undefined) {
    requestBody.temperature = config.temperature;
  }
  if (config.maxTokens !== undefined) {
    requestBody.max_tokens = config.maxTokens;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);

  const onExternalAbort = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener('abort', onExternalAbort, { once: true });
    }
  }

  try {
    if (config.streaming && onChunk) {
      return await handleStreamingResponse(url, requestBody, controller.signal, onChunk);
    } else {
      return await handleNonStreamingResponse(url, requestBody, controller.signal);
    }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      const cancelled = externalSignal?.aborted;
      throw {
        code: cancelled ? ('CANCELLED' as const) : ('TIMEOUT' as const),
        message: cancelled
          ? 'Generation stopped by user'
          : 'Request timed out while generating response',
      };
    }
    throw {
      code: 'API_ERROR' as const,
      message: 'Failed to get response from LM Studio',
      details: err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(timeout);
    if (externalSignal) {
      externalSignal.removeEventListener('abort', onExternalAbort);
    }
  }
}

async function handleStreamingResponse(
  url: string,
  body: Record<string, unknown>,
  signal: AbortSignal,
  onChunk: (chunk: string) => void,
): Promise<ChatContentResult> {
  const response = await fetch(url, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
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

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;

        const data = trimmed.slice(6).trim();
        if (data === '[DONE]') continue;

        try {
          const chunk = JSON.parse(data) as ChatCompletionChunk;
          const content = chunk.choices?.[0]?.delta?.content;
          const reasoningDelta =
            chunk.choices?.[0]?.delta?.reasoning_content ?? chunk.choices?.[0]?.delta?.reasoning;
          if (reasoningDelta) {
            reasoning += reasoningDelta;
          }
          if (content) {
            fullContent += content;
            onChunk(content);
          }
        } catch {
          // Skip malformed JSON lines
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return extractReasoningFromContent(fullContent, reasoning);
}

async function handleNonStreamingResponse(
  url: string,
  body: Record<string, unknown>,
  signal: AbortSignal,
): Promise<ChatContentResult> {
  const response = await fetch(url, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ ...body, stream: false }),
  });

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as ChatCompletionResponse;
    throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`);
  }

  const data = (await response.json()) as ChatCompletionResponse;
  const message = data.choices?.[0]?.message;
  const content = message?.content;

  if (!content) {
    throw new Error('No content in response');
  }

  return extractReasoningFromContent(
    content,
    message?.reasoning_content ?? message?.reasoning ?? '',
  );
}

// ============================================================================
// Tool-Aware Chat Request
// ============================================================================

export interface SendChatRequestParams {
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

/**
 * Sends a chat request that supports OpenAI-compatible tool_calls.
 * Returns content, toolCalls, and finishReason.
 */
export async function sendChatRequest(params: SendChatRequestParams): Promise<ChatRequestResult> {
  const {
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
      return await handleStreamingToolResponse(url, requestBody, combinedSignal, onChunk);
    } else {
      return await handleNonStreamingToolResponse(url, requestBody, combinedSignal);
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
  const imageAttachments = (message.attachments ?? []).filter(
    (attachment) => attachment.kind === 'image',
  );
  if (message.role !== 'user' || imageAttachments.length === 0) {
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
): Promise<ChatRequestResult> {
  const response = await fetch(url, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
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
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
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

          // Content delta
          const contentDelta = choice.delta?.content;
          const reasoningDelta = choice.delta?.reasoning_content ?? choice.delta?.reasoning;
          if (reasoningDelta) {
            reasoning += reasoningDelta;
          }
          if (contentDelta) {
            fullContent += contentDelta;
            onChunk(contentDelta);
          }

          // Tool call deltas
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

          // Finish reason
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
): Promise<ChatRequestResult> {
  const response = await fetch(url, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
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

// ============================================================================
// Context Building Functions
// ============================================================================

/**
 * Estimates the number of tokens in a text string.
 * Uses a rough approximation: ~4 characters per token for English.
 * This is a rough estimate and actual token counts may vary by model.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;

  // Remove extra whitespace for counting
  const cleaned = text.replace(/\s+/g, ' ').trim();

  // Rough approximation: average English word is ~4-5 characters including spaces
  // and average token is ~4 characters. This is a conservative estimate.
  return Math.ceil(cleaned.length / 4);
}

/**
 * Builds a context string from an array of context items.
 * Formats each item with its type, title, and content.
 */
export function buildContextString(items: ContextItem[]): string {
  if (items.length === 0) return '';

  const sections: string[] = [];

  for (const item of items) {
    const header = item.path
      ? `## [${item.type.toUpperCase()}] ${item.title} (${item.path})`
      : `## [${item.type.toUpperCase()}] ${item.title}`;

    sections.push(`${header}\n\n${item.content.trim()}`);
  }

  return sections.join('\n\n---\n\n');
}

/**
 * Truncates text to fit within a maximum token limit.
 * Attempts to cut at sentence or paragraph boundaries when possible.
 */
export function truncateToTokenLimit(text: string, maxTokens: number): string {
  const currentTokens = estimateTokens(text);

  if (currentTokens <= maxTokens) return text;

  // Target character count based on token ratio (4 chars per token)
  const targetChars = Math.floor(maxTokens * 4);

  // Try to truncate at a paragraph boundary first
  const paragraphs = text.split(/\n\n+/);
  let result = '';

  for (const para of paragraphs) {
    const testResult = result ? `${result}\n\n${para}` : para;
    if (estimateTokens(testResult) <= maxTokens) {
      result = testResult;
    } else {
      // If first paragraph already exceeds limit, truncate it directly
      if (!result) {
        result = truncateAtBoundary(para, targetChars);
      }
      break;
    }
  }

  return result || truncateAtBoundary(text, targetChars);
}

function truncateAtBoundary(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;

  // Try to cut at sentence boundary
  const truncated = text.slice(0, maxChars);
  const lastPeriod = truncated.lastIndexOf('.');
  const lastNewline = truncated.lastIndexOf('\n');

  const boundary = Math.max(lastPeriod, lastNewline);
  if (boundary > maxChars * 0.5) {
    return truncated.slice(0, boundary + 1);
  }

  return truncated.trim() + '...';
}

// ============================================================================
// Error Handling Utilities
// ============================================================================

/**
 * Parses an error object into a standardized LMStudioError.
 */
export function parseLMStudioError(err: unknown): LMStudioError {
  if (typeof err === 'object' && err !== null && 'code' in err) {
    const error = err as { code: LMStudioError['code']; message: string; details?: string };
    return {
      code: error.code,
      message: error.message,
      details: error.details,
    };
  }

  if (err instanceof Error) {
    if (err.name === 'AbortError') {
      return { code: 'TIMEOUT', message: 'Request timed out' };
    }

    // Detect connection refused errors
    if (
      err.message.includes('fetch') ||
      err.message.includes('network') ||
      err.message.includes('connection')
    ) {
      return {
        code: 'CONNECTION_REFUSED',
        message: 'Could not connect to LM Studio',
        details: err.message,
      };
    }

    return { code: 'UNKNOWN', message: err.message };
  }

  return { code: 'UNKNOWN', message: String(err) };
}

/**
 * Formats an LMStudioError for user display.
 */
export function formatLMStudioError(error: LMStudioError): string {
  let message = error.message;

  switch (error.code) {
    case 'CONNECTION_REFUSED':
      message = `Connection failed: ${error.message}. Make sure LM Studio is running and the server is enabled.`;
      break;
    case 'TIMEOUT':
      message = `Request timed out: ${error.message}. Try again or reduce the response length.`;
      break;
    case 'CANCELLED':
      message = error.message;
      break;
    case 'API_ERROR':
      message = `API Error: ${error.message}`;
      if (error.details) message += `\nDetails: ${error.details}`;
      break;
    case 'INVALID_RESPONSE':
      message = `Invalid response: ${error.message}`;
      break;
    default:
      if (error.details) message += `\n${error.details}`;
  }

  return message;
}
