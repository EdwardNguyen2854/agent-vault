/**
 * Agent Execution Module
 *
 * Handles the core agent chat execution logic:
 * - Streaming model invocation
 * - Tool dispatch (internal + MCP)
 * - Approval handling
 * - Cancellation
 * - Transcript accumulation
 *
 * This module is extracted from ChatPanel.tsx's runChat function to provide
 * a cleaner, more testable architecture.
 */

import type {
  Agent,
  AgentContextItem,
  AgentRunApproval,
  ChatAttachment,
  ChatMessage,
  ChatRequestResult,
  OpenAITool,
  OpenAIToolCall,
  Tool,
  ToolCallRecord,
  ToolExecutionContext,
  ToolInvocationResult,
  ToolLoopEvent,
  VaultNote,
} from '../types';
import type { ModelAdapter } from './modelAdapter';
import { defaultModelAdapter, lmStudioAdapter } from './modelAdapter';
import { evaluateToolCall } from './permissionGate';
import { dispatchInternalTool } from './internalTools';
import { invokeBridgeTool } from './bridgeClient';
import { getAllTools } from './tools';
import { recordToolCall } from './usageStore';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface AgentExecutionOptions {
  /** LM Studio configuration */
  baseUrl: string;
  modelName: string;
  streaming: boolean;

  /** Agent context */
  agent?: Agent;
  messages: ChatMessage[];
  prompt: string;
  attachments?: ChatAttachment[];
  skillNote?: VaultNote | null;
  contextItems?: AgentContextItem[];

  /** Vault context for tool execution */
  notes?: VaultNote[];
  selectedNote?: VaultNote | null;
  personalRootHandle?: FileSystemDirectoryHandle;
  personalVaultSource?: {
    id: string;
    name: string;
    role: 'agent' | 'personal' | 'shared';
    readOnly: boolean;
  };

  /** Callbacks for UI updates */
  onChunk?: (content: string) => void;
  onReasoning?: (reasoning: string) => void;
  onEvent?: (event: ToolLoopEvent) => void;
  onAsk?: (tool: Tool, input: unknown) => Promise<boolean>;

  /** Cancellation */
  signal?: AbortSignal;

  /** Limits */
  maxIterations?: number;

  /** Injectable model adapter (defaults to LM Studio) */
  modelAdapter?: ModelAdapter;
}

export type AgentExecutionStatus =
  | 'completed'
  | 'cancelled'
  | 'failed'
  | 'iteration-limited';

export interface AgentExecutionResult {
  content: string;
  cancelled: boolean;
  reasoning?: string;
  transcript: ToolCallRecord[];
  approvals: AgentRunApproval[];
  status: AgentExecutionStatus;
  error?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function parseToolArguments(
  raw: string,
):
  | { ok: true; input: Record<string, unknown> }
  | { ok: false; error: string; input: { raw: string } } {
  try {
    const parsed = raw ? JSON.parse(raw) : {};
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return { ok: true, input: parsed as Record<string, unknown> };
    }
    return { ok: false, error: 'Tool arguments must be a JSON object', input: { raw } };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? `Invalid tool arguments JSON: ${err.message}`
          : 'Invalid tool arguments JSON',
      input: { raw },
    };
  }
}

function agentAllowsTool(agent: Agent | null | undefined, tool: Tool): boolean {
  if (!agent?.tools?.length) return true;
  const allowed = new Set(agent.tools.map((t) => t.toLowerCase()));
  if (allowed.has(tool.id.toLowerCase())) return true;
  return allowed.has(tool.name.toLowerCase());
}

function agentAllowReason(agent: Agent | null | undefined, tool: Tool): string {
  if (!agent?.tools?.length)
    return `Agent "${agent?.name ?? 'unknown'}" has no explicit tool list and inherits eligible tools`;
  return `Agent "${agent.name}" explicit tool list does not include "${tool.id}"`;
}

// ============================================================================
// Tool Dispatch
// ============================================================================

async function executeToolCall(
  toolCall: OpenAIToolCall,
  tool: Tool,
  parsedArgs: { ok: true; input: Record<string, unknown> } | { ok: false; error: string; input: { raw: string } },
  ctx: ToolExecutionContext,
  options: {
    onEvent?: (event: ToolLoopEvent) => void;
    onAsk?: (tool: Tool, input: unknown) => Promise<boolean>;
    signal?: AbortSignal;
  },
  agent?: Agent,
): Promise<{ record: ToolCallRecord; toolResult: ToolInvocationResult; outputContent: string }> {
  const { onEvent, onAsk, signal } = options;

  // Handle invalid args
  if (!parsedArgs.ok) {
    const startedAt = Date.now();
    onEvent?.({
      id: toolCall.id,
      toolId: tool.id,
      toolName: tool.name,
      input: parsedArgs.input,
      error: parsedArgs.error,
      status: 'failed',
      startedAt,
      completedAt: Date.now(),
    });
    const record: ToolCallRecord = {
      id: toolCall.id,
      toolId: tool.id,
      toolName: tool.name,
      input: parsedArgs.input,
      error: parsedArgs.error,
      decision: 'deny',
      decisionReason: 'Invalid JSON arguments',
      durationMs: 0,
      startedAt,
    };
    const toolResult: ToolInvocationResult = {
      success: false,
      error: parsedArgs.error,
      durationMs: 0,
    };
    return {
      record,
      toolResult,
      outputContent: `Error: ${parsedArgs.error}`,
    };
  }

  const parsedInput = parsedArgs.input;
  const startedAt = Date.now();

  // Check agent allows tool
  if (!agentAllowsTool(agent, tool)) {
    const reason = agentAllowReason(agent, tool);
    onEvent?.({
      id: toolCall.id,
      toolId: tool.id,
      toolName: tool.name,
      input: parsedInput,
      error: reason,
      reason,
      status: 'denied',
      startedAt,
      completedAt: Date.now(),
    });
    const record: ToolCallRecord = {
      id: toolCall.id,
      toolId: tool.id,
      toolName: tool.name,
      input: parsedInput,
      error: reason,
      decision: 'deny',
      decisionReason: 'Agent tool allowlist blocked tool',
      durationMs: 0,
      startedAt,
    };
    const toolResult: ToolInvocationResult = {
      success: false,
      error: reason,
      durationMs: 0,
    };
    return {
      record,
      toolResult,
      outputContent: `Error: Tool "${tool.name}" denied. ${reason}`,
    };
  }

  // Evaluate gate
  const gate = evaluateToolCall(tool, agent, ctx);

  if (gate.decision === 'deny') {
    onEvent?.({
      id: toolCall.id,
      toolId: tool.id,
      toolName: tool.name,
      input: parsedInput,
      error: gate.reason,
      reason: gate.reason,
      status: 'denied',
      startedAt,
      completedAt: Date.now(),
    });
    const record: ToolCallRecord = {
      id: toolCall.id,
      toolId: tool.id,
      toolName: tool.name,
      input: parsedInput,
      error: gate.reason,
      decision: 'deny',
      decisionReason: gate.reason,
      durationMs: 0,
      startedAt,
    };
    const toolResult: ToolInvocationResult = {
      success: false,
      error: gate.reason,
      durationMs: 0,
    };
    return {
      record,
      toolResult,
      outputContent: `Error: Tool "${tool.name}" denied. ${gate.reason}`,
    };
  }

  // Handle ask decision
  if (gate.decision === 'ask' && onAsk) {
    onEvent?.({
      id: toolCall.id,
      toolId: tool.id,
      toolName: tool.name,
      input: parsedInput,
      status: 'awaiting_approval',
      reason: gate.reason,
      startedAt,
    });
    const approved = await onAsk(tool, parsedInput);
    if (!approved) {
      const recordStartedAt = Date.now();
      onEvent?.({
        id: toolCall.id,
        toolId: tool.id,
        toolName: tool.name,
        input: parsedInput,
        error: 'User denied tool call',
        reason: 'User denied',
        status: 'denied',
        startedAt: recordStartedAt,
        completedAt: Date.now(),
      });
      const record: ToolCallRecord = {
        id: toolCall.id,
        toolId: tool.id,
        toolName: tool.name,
        input: parsedInput,
        error: 'User denied tool call',
        decision: 'deny',
        decisionReason: 'User denied',
        durationMs: 0,
        startedAt: recordStartedAt,
      };
      const toolResult: ToolInvocationResult = {
        success: false,
        error: 'User denied',
        durationMs: 0,
      };
      return {
        record,
        toolResult,
        outputContent: `Error: User denied tool "${tool.name}".`,
      };
    }
  } else if (gate.decision === 'ask') {
    const reason = 'Tool requires approval, but no approval handler is available';
    const recordStartedAt = Date.now();
    onEvent?.({
      id: toolCall.id,
      toolId: tool.id,
      toolName: tool.name,
      input: parsedInput,
      error: reason,
      reason,
      status: 'denied',
      startedAt: recordStartedAt,
      completedAt: Date.now(),
    });
    const record: ToolCallRecord = {
      id: toolCall.id,
      toolId: tool.id,
      toolName: tool.name,
      input: parsedInput,
      error: reason,
      decision: 'deny',
      decisionReason: reason,
      durationMs: 0,
      startedAt: recordStartedAt,
    };
    const toolResult: ToolInvocationResult = {
      success: false,
      error: reason,
      durationMs: 0,
    };
    return {
      record,
      toolResult,
      outputContent: `Error: Tool "${tool.name}" denied. ${reason}`,
    };
  }

  // Execute tool
  onEvent?.({
    id: toolCall.id,
    toolId: tool.id,
    toolName: tool.name,
    input: parsedInput,
    status: 'running',
    startedAt,
  });

  let toolResult: ToolInvocationResult;
  try {
    if (tool.provider === 'internal') {
      toolResult = await dispatchInternalTool(tool.id, parsedInput, ctx);
    } else if (tool.server) {
      toolResult = await invokeBridgeTool(tool.server, tool.id, parsedInput, signal);
    } else {
      toolResult = {
        success: false,
        error: `No provider available for tool: ${tool.id}`,
        durationMs: 0,
      };
    }
  } catch (err) {
    toolResult = {
      success: false,
      error: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - startedAt,
    };
  }

  const record: ToolCallRecord = {
    id: toolCall.id,
    toolId: tool.id,
    toolName: tool.name,
    input: parsedInput,
    output: toolResult.output,
    error: toolResult.error,
    decision: gate.decision,
    decisionReason: gate.reason,
    durationMs: toolResult.durationMs,
    startedAt,
  };

  const outputContent = toolResult.success
    ? JSON.stringify(toolResult.output, null, 2)
    : `Error: ${toolResult.error ?? 'Unknown error'}`;

  return { record, toolResult, outputContent };
}

// ============================================================================
// Main Execution Function
// ============================================================================

/**
 * Run a single chat turn with the agent, optionally with tool support.
 *
 * This function handles:
 * - Building the full message context (system prompt + history + new prompt)
 * - Streaming the model response
 * - Handling tool calls if useTools is true
 * - Managing approvals via the onAsk callback
 * - Handling cancellation
 * - Returning the result with transcript and approvals
 */
export async function runAgentChat(
  options: AgentExecutionOptions,
  useTools: boolean = false,
): Promise<AgentExecutionResult> {
  const {
    baseUrl,
    modelName,
    streaming,
    agent,
    messages,
    prompt,
    attachments = [],
    notes = [],
    selectedNote,
    personalRootHandle,
    personalVaultSource,
    onChunk,
    onReasoning,
    onEvent,
    onAsk,
    signal,
    maxIterations = 12,
    modelAdapter = defaultModelAdapter,
  } = options;

  let lastContent = '';
  let cancelled = false;
  let reasoning = '';
  const transcript: ToolCallRecord[] = [];
  const approvals: AgentRunApproval[] = [];

  // Build the execution context for tool calls
  const ctx: ToolExecutionContext = {
    notes,
    currentNote: selectedNote ?? undefined,
    selectedAgent: undefined, // Would be passed from agent note if needed
    agent,
    personalRootHandle,
    personalVaultSource,
  };

  // Build messages for the model
  // System prompt is already in messages[0] if it exists
  const providerMessages: ChatMessage[] = [
    ...messages,
    {
      role: 'user',
      content: prompt,
      timestamp: Date.now(),
      attachments,
    },
  ];

  try {
    if (useTools) {
      // Tool-aware execution loop
      const allTools = getAllTools(notes);
      let iterations = 0;
      let loopMessages = [...providerMessages];

      while (iterations < maxIterations) {
        if (signal?.aborted) {
          cancelled = true;
          break;
        }

        iterations++;

        let result: ChatRequestResult;
        try {
          result = await modelAdapter.chat({
            baseUrl,
            model: modelName,
            messages: loopMessages,
            streaming: false, // Tool loops use non-streaming
            signal,
          });
        } catch (err) {
          return {
            content: lastContent,
            cancelled: signal?.aborted ?? false,
            reasoning,
            transcript,
            approvals,
            status: 'failed',
            error: err instanceof Error ? err.message : String(err),
          };
        }

        lastContent = result.content;
        if (result.reasoning?.trim()) {
          reasoning = result.reasoning;
          onReasoning?.(result.reasoning);
        }

        // If no tool calls, we're done
        if (result.finishReason !== 'tool_calls' || !result.toolCalls.length) {
          break;
        }

        // Add assistant message with tool calls
        loopMessages.push({
          role: 'assistant',
          content: result.content,
          toolCalls: result.toolCalls,
          timestamp: Date.now(),
        });

        // Process each tool call
        for (const toolCall of result.toolCalls) {
          if (signal?.aborted) {
            cancelled = true;
            break;
          }

          const toolName = toolCall.function.name;
          let tool = allTools.find((t) => t.id === toolName);
          if (!tool) {
            tool = allTools.find((t) => t.name.toLowerCase() === toolName.toLowerCase());
          }
          const toolId = tool?.id ?? toolName;
          const parsedArgs = parseToolArguments(toolCall.function.arguments);

          // Emit requested event
          onEvent?.({
            id: toolCall.id,
            toolId,
            toolName: tool?.name ?? toolName,
            input: parsedArgs.input,
            status: 'requested',
            startedAt: Date.now(),
          });

          // Handle unknown tool
          if (!tool) {
            const startedAt = Date.now();
            const error = `Tool not found in registry: ${toolName}`;
            onEvent?.({
              id: toolCall.id,
              toolId: toolName,
              toolName,
              input: parsedArgs.input,
              error,
              status: 'failed',
              startedAt,
              completedAt: Date.now(),
            });
            transcript.push({
              id: toolCall.id,
              toolId: toolName,
              toolName,
              input: parsedArgs.input,
              error,
              decision: 'deny',
              decisionReason: 'Unknown tool',
              durationMs: 0,
              startedAt,
            });
            loopMessages.push({
              role: 'tool',
              content: `Error: Tool "${toolName}" is not registered in the vault.`,
              toolCallId: toolCall.id,
              toolName,
              toolInput: parsedArgs.input,
              toolOutput: null,
              timestamp: Date.now(),
            });
            continue;
          }

          // Execute the tool
          const { record, toolResult, outputContent } = await executeToolCall(
            toolCall,
            tool,
            parsedArgs,
            ctx,
            { onEvent, onAsk, signal },
            agent,
          );

          transcript.push(record);

          // Track usage
          recordToolCall({
            toolId: tool.id,
            toolName: tool.name,
            input: record.input,
            output: record.output,
            error: record.error,
            durationMs: record.durationMs,
          });

          // Emit completion event
          onEvent?.({
            id: toolCall.id,
            toolId: tool.id,
            toolName: tool.name,
            input: record.input,
            output: record.output,
            error: record.error,
            status: toolResult.success ? 'succeeded' : 'failed',
            startedAt: record.startedAt,
            completedAt: Date.now(),
          });

          // Add tool result message
          loopMessages.push({
            role: 'tool',
            content: outputContent,
            toolCallId: toolCall.id,
            toolName: tool.id,
            toolInput: record.input,
            toolOutput: record.output ?? record.error,
            timestamp: Date.now(),
          });
        }

        if (signal?.aborted) {
          cancelled = true;
          break;
        }
      }

      if (iterations >= maxIterations) {
        return {
          content: lastContent,
          cancelled: false,
          reasoning,
          transcript,
          approvals,
          status: 'iteration-limited',
        };
      }
    } else {
      // Simple streaming chat (no tools)
      const result = await modelAdapter.chat({
        baseUrl,
        model: modelName,
        messages: providerMessages,
        streaming,
        signal,
        onChunk: (chunk) => {
          lastContent += chunk;
          onChunk?.(chunk);
        },
        onReasoning: (chunk) => {
          reasoning += chunk;
          onReasoning?.(chunk);
        },
      });

      lastContent = result.content;
      if (result.reasoning?.trim()) {
        reasoning = result.reasoning;
      }
    }
  } catch (err) {
    // Check if it was a cancellation
    if (signal?.aborted || (err instanceof Error && err.name === 'AbortError')) {
      cancelled = true;
      return {
        content: lastContent,
        cancelled: true,
        reasoning,
        transcript,
        approvals,
        status: 'cancelled',
      };
    }

    return {
      content: lastContent,
      cancelled: false,
      reasoning,
      transcript,
      approvals,
      status: 'failed',
      error: err instanceof Error ? err.message : String(err),
    };
  }

  return {
    content: lastContent,
    cancelled,
    reasoning,
    transcript,
    approvals,
    status: cancelled ? 'cancelled' : 'completed',
  };
}

// ============================================================================
// Simplified Export for Tool-Free Chat
// ============================================================================

export interface SimpleChatOptions {
  baseUrl: string;
  modelName: string;
  streaming: boolean;
  messages: ChatMessage[];
  signal?: AbortSignal;
  onChunk?: (content: string) => void;
  onReasoning?: (reasoning: string) => void;
  modelAdapter?: ModelAdapter;
}

export async function runSimpleChat(options: SimpleChatOptions): Promise<{
  content: string;
  reasoning?: string;
  cancelled: boolean;
}> {
  const { baseUrl, modelName, streaming, messages, signal, onChunk, onReasoning, modelAdapter = defaultModelAdapter } = options;

  let content = '';
  let reasoning = '';

  try {
    const result = await modelAdapter.chat({
      baseUrl,
      model: modelName,
      messages,
      streaming,
      signal,
      onChunk: (chunk) => {
        content += chunk;
        onChunk?.(chunk);
      },
      onReasoning: (chunk) => {
        reasoning += chunk;
        onReasoning?.(chunk);
      },
    });

    return {
      content: result.content,
      reasoning: result.reasoning,
      cancelled: signal?.aborted ?? false,
    };
  } catch (err) {
    if (signal?.aborted || (err instanceof Error && err.name === 'AbortError')) {
      return { content, reasoning, cancelled: true };
    }
    throw err;
  }
}
