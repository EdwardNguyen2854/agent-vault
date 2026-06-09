import type {
  Agent,
  ChatAttachment,
  ChatMessage,
  ChatRequestResult,
  GateResult,
  OpenAITool,
  OpenAIToolCall,
  Tool,
  ToolCallRecord,
  ToolExecutionContext,
  ToolInvocationResult,
  ToolLoopEvent,
  VaultNote,
} from '../types';
import { evaluateToolCall } from './permissionGate';
import { dispatchInternalTool } from './internalTools';
import { invokeBridgeTool } from './bridgeClient';
import { sendChatRequest } from './lmstudio';
import { getAllTools } from './tools';

export interface ToolLoopOptions {
  agent?: Agent | null;
  agentNote?: VaultNote | null;
  notes: VaultNote[];
  selectedNote?: VaultNote | null;
  personalRootHandle?: FileSystemDirectoryHandle;
  personalVaultSource?: {
    id: string;
    name: string;
    role: 'agent' | 'personal' | 'shared';
    readOnly: boolean;
  };
  contextItems: Array<{ type: string; title: string; content: string }>;
  messages: Array<{
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string;
    timestamp: number;
    attachments?: ChatAttachment[];
    toolCalls?: OpenAIToolCall[];
    toolCallId?: string;
    toolName?: string;
    toolInput?: unknown;
    toolOutput?: unknown;
  }>;
  onChunk?: (chunk: string) => void;
  onAsk?: (tool: Tool, input: unknown) => Promise<boolean>;
  onEvent?: (event: ToolLoopEvent) => void;
  signal?: AbortSignal;
  maxIterations?: number;
  baseUrl: string;
  modelName: string;
  streaming: boolean;
}

export interface ToolLoopResult {
  finalContent: string;
  transcript: ToolCallRecord[];
  iterations: number;
  reasoning?: string;
  error?: string;
}

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

function isAdvertisableTool(
  tool: Tool,
  agent: Agent | null | undefined,
  ctx: ToolExecutionContext,
): boolean {
  if (tool.provider === 'mcp' && (!tool.server || tool.status === 'disconnected')) return false;
  if (tool.status !== 'active') return false;
  if (tool.permission === 'disabled') return false;
  if (!agentAllowsTool(agent, tool)) return false;
  return evaluateToolCall(tool, agent ?? undefined, ctx).decision !== 'deny';
}

export async function runToolLoop(options: ToolLoopOptions): Promise<ToolLoopResult> {
  const {
    agent,
    agentNote,
    notes,
    selectedNote,
    personalRootHandle,
    personalVaultSource,
    contextItems,
    messages: chatMessages,
    onChunk,
    onAsk,
    onEvent,
    signal,
    maxIterations = 12,
    baseUrl,
    modelName,
    streaming,
  } = options;

  const transcript: ToolCallRecord[] = [];
  let iterations = 0;
  let finalContent = '';
  const reasoningParts: string[] = [];

  const ctx: ToolExecutionContext = {
    notes,
    currentNote: selectedNote ?? undefined,
    selectedAgent: agentNote ?? undefined,
    agent: agent ?? undefined,
    personalRootHandle,
    personalVaultSource,
  };

  const allTools: Tool[] = getAllTools(notes);
  const advertisedTools = allTools.filter((tool) => isAdvertisableTool(tool, agent, ctx));

  const openAiTools: OpenAITool[] = advertisedTools.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.id,
      description: t.description ?? '',
      parameters: (t.inputSchema as Record<string, unknown>) ?? { type: 'object', properties: {} },
    },
  }));

  function convertMessages(): ChatMessage[] {
    return chatMessages.map((m) => ({
      role: m.role as ChatMessage['role'],
      content: m.content,
      attachments: m.attachments,
      toolCallId: m.toolCallId,
      toolName: m.toolName,
      toolInput: m.toolInput as Record<string, unknown> | undefined,
      toolOutput: m.toolOutput,
      toolCalls: m.toolCalls,
      timestamp: m.timestamp,
    }));
  }

  let loopMessages = convertMessages();

  while (iterations < maxIterations) {
    if (signal?.aborted) {
      finalContent = 'Tool execution aborted.';
      break;
    }

    iterations++;

    let result: ChatRequestResult;
    try {
      result = await sendChatRequest({
        baseUrl,
        modelName,
        streaming: false,
        messages: loopMessages,
        tools: openAiTools,
        onChunk: undefined,
        signal,
      });
    } catch (err) {
      return {
        finalContent: '',
        transcript,
        iterations,
        error: err instanceof Error ? err.message : String(err),
      };
    }

    finalContent = result.content;
    if (result.reasoning?.trim()) {
      reasoningParts.push(result.reasoning.trim());
    }

    if (result.finishReason !== 'tool_calls' || !result.toolCalls.length) {
      break;
    }

    loopMessages.push({
      role: 'assistant',
      content: result.content,
      toolCalls: result.toolCalls,
      timestamp: Date.now(),
    });

    for (const toolCall of result.toolCalls) {
      if (signal?.aborted) break;

      const toolName = toolCall.function.name;
      let tool = allTools.find((t) => t.id === toolName);
      if (!tool) {
        tool = allTools.find((t) => t.name.toLowerCase() === toolName.toLowerCase());
      }
      const toolId = tool?.id ?? toolName;
      const parsedArgs = parseToolArguments(toolCall.function.arguments);
      const requestedAt = Date.now();

      onEvent?.({
        id: toolCall.id,
        toolId,
        toolName: tool?.name ?? toolName,
        input: parsedArgs.input,
        status: 'requested',
        startedAt: requestedAt,
      });

      if (!tool) {
        const recordStartedAt = Date.now();
        const error = `Tool not found in registry: ${toolName}`;
        onEvent?.({
          id: toolCall.id,
          toolId: toolName,
          toolName,
          input: parsedArgs.input,
          error,
          status: 'failed',
          startedAt: recordStartedAt,
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
          startedAt: recordStartedAt,
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

      if (!agentAllowsTool(agent, tool)) {
        const reason = agentAllowReason(agent, tool);
        const recordStartedAt = Date.now();
        onEvent?.({
          id: toolCall.id,
          toolId: tool.id,
          toolName: tool.name,
          input: parsedArgs.input,
          error: reason,
          reason,
          status: 'denied',
          startedAt: recordStartedAt,
          completedAt: Date.now(),
        });
        transcript.push({
          id: toolCall.id,
          toolId: tool.id,
          toolName: tool.name,
          input: parsedArgs.input,
          error: reason,
          decision: 'deny',
          decisionReason: 'Agent tool allowlist blocked tool',
          durationMs: 0,
          startedAt: recordStartedAt,
        });
        loopMessages.push({
          role: 'tool',
          content: `Error: Tool "${tool.name}" denied. ${reason}`,
          toolCallId: toolCall.id,
          toolName: tool.id,
          toolInput: parsedArgs.input,
          toolOutput: null,
          timestamp: Date.now(),
        });
        continue;
      }

      if (!parsedArgs.ok) {
        const recordStartedAt = Date.now();
        onEvent?.({
          id: toolCall.id,
          toolId: tool.id,
          toolName: tool.name,
          input: parsedArgs.input,
          error: parsedArgs.error,
          status: 'failed',
          startedAt: recordStartedAt,
          completedAt: Date.now(),
        });
        transcript.push({
          id: toolCall.id,
          toolId: tool.id,
          toolName: tool.name,
          input: parsedArgs.input,
          error: parsedArgs.error,
          decision: 'deny',
          decisionReason: 'Invalid JSON arguments',
          durationMs: 0,
          startedAt: recordStartedAt,
        });
        loopMessages.push({
          role: 'tool',
          content: `Error: ${parsedArgs.error}`,
          toolCallId: toolCall.id,
          toolName: tool.id,
          toolInput: parsedArgs.input,
          toolOutput: null,
          timestamp: Date.now(),
        });
        continue;
      }

      const gate: GateResult = evaluateToolCall(tool, agent ?? undefined, ctx);

      if (gate.decision === 'deny') {
        const recordStartedAt = Date.now();
        onEvent?.({
          id: toolCall.id,
          toolId: tool.id,
          toolName: tool.name,
          input: parsedArgs.input,
          error: gate.reason,
          reason: gate.reason,
          status: 'denied',
          startedAt: recordStartedAt,
          completedAt: Date.now(),
        });
        transcript.push({
          id: toolCall.id,
          toolId: tool.id,
          toolName: tool.name,
          input: parsedArgs.input,
          error: gate.reason,
          decision: 'deny',
          decisionReason: gate.reason,
          durationMs: 0,
          startedAt: recordStartedAt,
        });
        loopMessages.push({
          role: 'tool',
          content: `Error: Tool "${tool.name}" denied. ${gate.reason}`,
          toolCallId: toolCall.id,
          toolName: tool.id,
          toolInput: parsedArgs.input,
          toolOutput: null,
          timestamp: Date.now(),
        });
        continue;
      }

      if (gate.decision === 'ask' && onAsk) {
        onEvent?.({
          id: toolCall.id,
          toolId: tool.id,
          toolName: tool.name,
          input: parsedArgs.input,
          status: 'awaiting_approval',
          reason: gate.reason,
          startedAt: requestedAt,
        });
        const approved = await onAsk(tool, parsedArgs.input);
        if (!approved) {
          const recordStartedAt = Date.now();
          onEvent?.({
            id: toolCall.id,
            toolId: tool.id,
            toolName: tool.name,
            input: parsedArgs.input,
            error: 'User denied tool call',
            reason: 'User denied',
            status: 'denied',
            startedAt: recordStartedAt,
            completedAt: Date.now(),
          });
          transcript.push({
            id: toolCall.id,
            toolId: tool.id,
            toolName: tool.name,
            input: parsedArgs.input,
            error: 'User denied tool call',
            decision: 'deny',
            decisionReason: 'User denied',
            durationMs: 0,
            startedAt: recordStartedAt,
          });
          loopMessages.push({
            role: 'tool',
            content: `Error: User denied tool "${tool.name}".`,
            toolCallId: toolCall.id,
            toolName: tool.id,
            toolInput: parsedArgs.input,
            toolOutput: null,
            timestamp: Date.now(),
          });
          continue;
        }
      } else if (gate.decision === 'ask') {
        const reason = 'Tool requires approval, but no approval handler is available';
        const recordStartedAt = Date.now();
        onEvent?.({
          id: toolCall.id,
          toolId: tool.id,
          toolName: tool.name,
          input: parsedArgs.input,
          error: reason,
          reason,
          status: 'denied',
          startedAt: recordStartedAt,
          completedAt: Date.now(),
        });
        transcript.push({
          id: toolCall.id,
          toolId: tool.id,
          toolName: tool.name,
          input: parsedArgs.input,
          error: reason,
          decision: 'deny',
          decisionReason: reason,
          durationMs: 0,
          startedAt: recordStartedAt,
        });
        loopMessages.push({
          role: 'tool',
          content: `Error: Tool "${tool.name}" denied. ${reason}`,
          toolCallId: toolCall.id,
          toolName: tool.id,
          toolInput: parsedArgs.input,
          toolOutput: null,
          timestamp: Date.now(),
        });
        continue;
      }

      let toolResult: ToolInvocationResult;
      const parsedInput = parsedArgs.input;

      const startedAt = Date.now();
      onEvent?.({
        id: toolCall.id,
        toolId: tool.id,
        toolName: tool.name,
        input: parsedInput,
        status: 'running',
        startedAt,
      });

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
      transcript.push(record);
      onEvent?.({
        id: toolCall.id,
        toolId: tool.id,
        toolName: tool.name,
        input: parsedInput,
        output: toolResult.output,
        error: toolResult.error,
        status: toolResult.success ? 'succeeded' : 'failed',
        startedAt,
        completedAt: Date.now(),
      });

      const toolOutputContent = toolResult.success
        ? JSON.stringify(toolResult.output, null, 2)
        : `Error: ${toolResult.error ?? 'Unknown error'}`;

      loopMessages.push({
        role: 'tool',
        content: toolOutputContent,
        toolCallId: toolCall.id,
        toolName: tool.id,
        toolInput: parsedInput,
        toolOutput: toolResult.output ?? toolResult.error,
        timestamp: Date.now(),
      });
    }

    if (signal?.aborted) {
      finalContent = 'Tool execution aborted.';
      break;
    }
  }

  return {
    finalContent,
    transcript,
    iterations,
    reasoning: reasoningParts.length > 0 ? reasoningParts.join('\n\n') : undefined,
  };
}
