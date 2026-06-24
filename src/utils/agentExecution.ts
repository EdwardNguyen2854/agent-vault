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
import {
  type ToolAdapter,
  internalToolAdapter,
  mcpToolAdapter,
  getToolAdapter,
} from './toolAdapter';
import type { ApprovalAdapter } from './approvalAdapter';
import { type ApprovalDecision } from './approvalAdapter';

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

  /** Injectable tool adapter for testing (defaults to internalToolAdapter) */
  toolAdapter?: ToolAdapter;

  /** Approval adapter for gating write-capable tools */
  approvalAdapter?: ApprovalAdapter;

  /** Tools approved for this session (used with ApprovalAdapter) */
  sessionApprovedTools?: Set<string>;
}

export type AgentExecutionStatus =
  | 'completed'
  | 'cancelled'
  | 'failed'
  | 'iteration-limited';

export interface AgentExecutionResult {
  content: string;
  reasoning?: string;
  transcript: ToolCallRecord[];
  approvals: AgentRunApproval[];
  iterations: number;
  status: AgentExecutionStatus;
  error?: string;
  startedAt: number;
  completedAt: number;
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
    toolAdapter?: ToolAdapter;
    approvalAdapter?: ApprovalAdapter;
    sessionApprovedTools?: Set<string>;
  },
  agent?: Agent,
): Promise<{ record: ToolCallRecord; toolResult: ToolInvocationResult; outputContent: string }> {
  const { onEvent, onAsk, signal, toolAdapter, approvalAdapter, sessionApprovedTools } = options;

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

  // Handle ask decision - use approval adapter or fall back to onAsk
  if (gate.decision === 'ask') {
    // Check if already approved (session or always)
    const sessionApproved = sessionApprovedTools?.has(tool.id) ?? false;
    const alwaysAllowed = approvalAdapter?.isAlwaysAllowed(tool.id) ?? false;

    if (sessionApproved || alwaysAllowed) {
      // Already approved for this session or always
      const approvalDecision: ApprovalDecision = alwaysAllowed ? 'always_allow' : 'allow_session';
      onEvent?.({
        id: toolCall.id,
        toolId: tool.id,
        toolName: tool.name,
        input: parsedInput,
        status: 'approved',
        reason: gate.reason,
        startedAt,
        completedAt: Date.now(),
      });
      // Continue to tool execution
    } else if (approvalAdapter) {
      // Use approval adapter to request approval
      onEvent?.({
        id: toolCall.id,
        toolId: tool.id,
        toolName: tool.name,
        input: parsedInput,
        status: 'awaiting_approval',
        reason: gate.reason,
        startedAt,
      });

      const approvalResult = await approvalAdapter.requestApproval({
        toolId: tool.id,
        toolName: tool.name,
        input: parsedInput,
        reason: gate.reason,
        timestamp: Date.now(),
      });

      // Emit approved or denied event
      if (approvalResult.decision === 'deny') {
        onEvent?.({
          id: toolCall.id,
          toolId: tool.id,
          toolName: tool.name,
          input: parsedInput,
          error: 'User denied tool call',
          reason: approvalResult.reason ?? 'User denied',
          status: 'denied',
          startedAt,
          completedAt: Date.now(),
        });
        const record: ToolCallRecord = {
          id: toolCall.id,
          toolId: tool.id,
          toolName: tool.name,
          input: parsedInput,
          error: 'User denied tool call',
          decision: 'deny',
          decisionReason: approvalResult.reason ?? 'User denied',
          durationMs: 0,
          startedAt,
          approval: {
            id: `approval-${toolCall.id}`,
            toolId: tool.id,
            toolName: tool.name,
            input: parsedInput,
            decision: 'deny',
            timestamp: approvalResult.timestamp,
            decisionReason: approvalResult.reason,
          },
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

      // Handle allow_once, allow_session, always_allow
      if (approvalResult.decision === 'allow_session') {
        sessionApprovedTools?.add(tool.id);
      } else if (approvalResult.decision === 'always_allow') {
        approvalAdapter.setAlwaysAllowed(tool.id);
      }

      onEvent?.({
        id: toolCall.id,
        toolId: tool.id,
        toolName: tool.name,
        input: parsedInput,
        status: 'approved',
        reason: approvalResult.reason,
        startedAt,
        completedAt: Date.now(),
      });
    } else if (onAsk) {
      // Fall back to onAsk callback
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
      onEvent?.({
        id: toolCall.id,
        toolId: tool.id,
        toolName: tool.name,
        input: parsedInput,
        status: 'approved',
        reason: gate.reason,
        startedAt,
        completedAt: Date.now(),
      });
    } else {
      // No approval handler available
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
    const adapter = toolAdapter ?? getToolAdapter(tool);
    if (adapter) {
      toolResult = await adapter.execute(tool.id, parsedInput, ctx, signal);
    } else {
      toolResult = {
        success: false,
        error: `No adapter available for tool: ${tool.id}`,
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
    toolAdapter,
    approvalAdapter,
    sessionApprovedTools: externalSessionApprovedTools,
  } = options;

  const startedAt = Date.now();
  let lastContent = '';
  let cancelled = false;
  let reasoning = '';
  const transcript: ToolCallRecord[] = [];
  const approvals: AgentRunApproval[] = [];
  let iterations = 0;

  // Session-approved tools - can be passed in or created locally
  const sessionApprovedTools = externalSessionApprovedTools ?? new Set<string>();

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
            reasoning,
            transcript,
            approvals,
            iterations,
            status: 'failed',
            error: err instanceof Error ? err.message : String(err),
            startedAt,
            completedAt: Date.now(),
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
            { onEvent, onAsk, signal, toolAdapter, approvalAdapter, sessionApprovedTools },
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
          reasoning,
          transcript,
          approvals,
          iterations,
          status: 'iteration-limited',
          startedAt,
          completedAt: Date.now(),
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
      return {
        content: lastContent,
        reasoning,
        transcript,
        approvals,
        iterations,
        status: 'cancelled',
        startedAt,
        completedAt: Date.now(),
      };
    }

    return {
      content: lastContent,
      reasoning,
      transcript,
      approvals,
      iterations,
      status: 'failed',
      error: err instanceof Error ? err.message : String(err),
      startedAt,
      completedAt: Date.now(),
    };
  }

  return {
    content: lastContent,
    reasoning,
    transcript,
    approvals,
    iterations,
    status: cancelled ? 'cancelled' : 'completed',
    startedAt,
    completedAt: Date.now(),
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
