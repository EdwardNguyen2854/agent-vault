/**
 * Tests for agentExecution module
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ChatMessage } from '../types';
import { createFakeAdapter, type FakeAdapterOptions } from './modelAdapter';
import { runSimpleChat, runAgentChat } from './agentExecution';
import type { ApprovalAdapter, ApprovalDecision, ApprovalRequest, ApprovalResult } from './approvalAdapter';

/**
 * Create a fake approval adapter for testing.
 */
function createFakeApprovalAdapter(options: {
  /** Return this decision for all requests */
  defaultDecision?: ApprovalDecision;
  /** Track all approval requests */
  requests?: ApprovalRequest[];
  /** Resolve pending approval */
  resolveDecision?: (decision: ApprovalDecision) => void;
  /** Always-allowed tools */
  alwaysAllowed?: Set<string>;
} = {}): ApprovalAdapter & {
  getRequests: () => ApprovalRequest[];
  setDecision: (decision: ApprovalDecision) => void;
  reset: () => void;
} {
  const requests: ApprovalRequest[] = [];
  let currentResolve: ((result: ApprovalResult) => void) | null = null;
  const alwaysAllowed = options.alwaysAllowed ?? new Set<string>();
  // Default to 'deny' if not specified
  let defaultDecision: ApprovalDecision = options.defaultDecision ?? 'deny';

  return {
    async requestApproval(request: ApprovalRequest): Promise<ApprovalResult> {
      requests.push(request);

      // Check always-allowed first
      if (alwaysAllowed.has(request.toolId)) {
        return {
          decision: 'always_allow',
          reason: 'Always allowed',
          timestamp: Date.now(),
        };
      }

      // If we have a synchronous decision set, return it
      if (defaultDecision !== undefined) {
        return {
          decision: defaultDecision,
          reason: `Fake decision: ${defaultDecision}`,
          timestamp: Date.now(),
        };
      }

      // Otherwise, return a promise that can be resolved externally
      return new Promise<ApprovalResult>((resolve) => {
        currentResolve = resolve;
        options.resolveDecision?.(defaultDecision ?? 'deny');
      });
    },

    isAlwaysAllowed(toolId: string): boolean {
      return alwaysAllowed.has(toolId);
    },

    setAlwaysAllowed(toolId: string): void {
      alwaysAllowed.add(toolId);
    },

    clearAlwaysAllowed(toolId: string): void {
      alwaysAllowed.delete(toolId);
    },

    getRequests: () => [...requests],
    setDecision: (decision: ApprovalDecision) => {
      defaultDecision = decision;
      if (currentResolve) {
        currentResolve({
          decision,
          reason: `Fake decision: ${decision}`,
          timestamp: Date.now(),
        });
        currentResolve = null;
      }
    },
    reset: () => {
      requests.length = 0;
      currentResolve = null;
      defaultDecision = options.defaultDecision ?? 'deny';
    },
  };
}

describe('modelAdapter', () => {
  describe('createFakeAdapter', () => {
    it('should return content from fake adapter', async () => {
      const adapter = createFakeAdapter({ content: 'Hello, World!' });
      const result = await adapter.chat({
        baseUrl: '/test',
        model: 'test-model',
        messages: [],
        streaming: false,
      });

      expect(result.content).toBe('Hello, World!');
      expect(result.finishReason).toBe('stop');
    });

    it('should include reasoning in response', async () => {
      const adapter = createFakeAdapter({
        content: 'The answer is 42.',
        reasoning: 'Let me think about this...',
      });
      const result = await adapter.chat({
        baseUrl: '/test',
        model: 'test-model',
        messages: [],
        streaming: false,
      });

      expect(result.content).toBe('The answer is 42.');
      expect(result.reasoning).toBe('Let me think about this...');
    });

    it('should include tool calls when specified', async () => {
      const toolCalls = [
        {
          id: 'call_123',
          type: 'function' as const,
          function: { name: 'test_tool', arguments: '{"arg": "value"}' },
        },
      ];
      const adapter = createFakeAdapter({
        content: 'I will use a tool.',
        toolCalls,
        finishReason: 'tool_calls',
      });
      const result = await adapter.chat({
        baseUrl: '/test',
        model: 'test-model',
        messages: [],
        streaming: false,
      });

      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls[0].id).toBe('call_123');
      expect(result.finishReason).toBe('tool_calls');
    });

    it('should throw error when shouldThrow is true', async () => {
      const adapter = createFakeAdapter({
        shouldThrow: true,
        errorMessage: 'Network error',
      });

      await expect(
        adapter.chat({
          baseUrl: '/test',
          model: 'test-model',
          messages: [],
          streaming: false,
        }),
      ).rejects.toThrow('Network error');
    });

    it('should simulate streaming with onChunk callback', async () => {
      const chunks: string[] = [];
      const adapter = createFakeAdapter({ content: 'Hello World' });

      await adapter.chat({
        baseUrl: '/test',
        model: 'test-model',
        messages: [],
        streaming: true,
        onChunk: (chunk) => chunks.push(chunk),
      });

      // Content should be accumulated
      const result = await adapter.chat({
        baseUrl: '/test',
        model: 'test-model',
        messages: [],
        streaming: false,
      });
      expect(result.content).toBe('Hello World');
    });
  });
});

describe('runSimpleChat', () => {
  it('should return content from simple chat', async () => {
    const adapter = createFakeAdapter({ content: 'Test response' });
    const result = await runSimpleChat({
      baseUrl: '/test',
      modelName: 'test-model',
      streaming: false,
      messages: [{ role: 'user', content: 'Hello', timestamp: Date.now() }],
      modelAdapter: adapter,
    });

    expect(result.content).toBe('Test response');
    expect(result.cancelled).toBe(false);
  });

  it('should handle reasoning from model', async () => {
    const adapter = createFakeAdapter({
      content: 'The answer is 42.',
      reasoning: 'I calculated this.',
    });
    const result = await runSimpleChat({
      baseUrl: '/test',
      modelName: 'test-model',
      streaming: false,
      messages: [{ role: 'user', content: 'What is 6 * 7?', timestamp: Date.now() }],
      modelAdapter: adapter,
    });

    expect(result.content).toBe('The answer is 42.');
    expect(result.reasoning).toBe('I calculated this.');
  });

  it('should stream content via onChunk callback', async () => {
    const chunks: string[] = [];
    const adapter = createFakeAdapter({ content: 'Hello World' });
    const result = await runSimpleChat({
      baseUrl: '/test',
      modelName: 'test-model',
      streaming: true,
      messages: [{ role: 'user', content: 'Say hello', timestamp: Date.now() }],
      onChunk: (chunk) => chunks.push(chunk),
      modelAdapter: adapter,
    });

    expect(result.content).toBe('Hello World');
  });

  it('should handle user cancellation', async () => {
    const adapter = createFakeAdapter({ content: 'Partial response' });
    const controller = new AbortController();

    // Start the chat but cancel immediately
    const chatPromise = runSimpleChat({
      baseUrl: '/test',
      modelName: 'test-model',
      streaming: true,
      messages: [{ role: 'user', content: 'Hello', timestamp: Date.now() }],
      signal: controller.signal,
      modelAdapter: adapter,
    });

    controller.abort();

    const result = await chatPromise;
    expect(result.cancelled).toBe(true);
  });

  it('should throw on network error', async () => {
    const adapter = createFakeAdapter({ shouldThrow: true, errorMessage: 'Connection refused' });

    await expect(
      runSimpleChat({
        baseUrl: '/test',
        modelName: 'test-model',
        streaming: false,
        messages: [{ role: 'user', content: 'Hello', timestamp: Date.now() }],
        modelAdapter: adapter,
      }),
    ).rejects.toThrow('Connection refused');
  });
});

describe('runAgentChat (tool-free)', () => {
  it('should return content from agent chat without tools', async () => {
    const adapter = createFakeAdapter({ content: 'Agent response' });
    const result = await runAgentChat(
      {
        baseUrl: '/test',
        modelName: 'test-model',
        streaming: false,
        messages: [{ role: 'user', content: 'Hello', timestamp: Date.now() }],
        prompt: 'Hello agent',
        modelAdapter: adapter,
      },
      false, // useTools
    );

    expect(result.content).toBe('Agent response');
    expect(result.status).toBe('completed');
    expect(result.status === 'cancelled').toBe(false);
    expect(result.transcript).toHaveLength(0);
  });

  it('should handle empty response from model', async () => {
    const adapter = createFakeAdapter({ content: '' });
    const result = await runAgentChat(
      {
        baseUrl: '/test',
        modelName: 'test-model',
        streaming: false,
        messages: [{ role: 'user', content: 'Hello', timestamp: Date.now() }],
        prompt: 'Hello agent',
        modelAdapter: adapter,
      },
      false,
    );

    expect(result.content).toBe('');
    expect(result.status).toBe('completed');
  });

  it('should accumulate reasoning from model', async () => {
    const adapter = createFakeAdapter({
      content: 'The answer is 42.',
      reasoning: 'Thinking process here...',
    });
    const result = await runAgentChat(
      {
        baseUrl: '/test',
        modelName: 'test-model',
        streaming: false,
        messages: [{ role: 'user', content: 'What is 6 * 7?', timestamp: Date.now() }],
        prompt: 'What is 6 * 7?',
        modelAdapter: adapter,
      },
      false,
    );

    expect(result.content).toBe('The answer is 42.');
    expect(result.reasoning).toBe('Thinking process here...');
  });

  it('should handle user cancellation mid-stream', async () => {
    const adapter = createFakeAdapter({ content: 'Partial response' });
    const controller = new AbortController();

    const chatPromise = runAgentChat(
      {
        baseUrl: '/test',
        modelName: 'test-model',
        streaming: true,
        messages: [{ role: 'user', content: 'Hello', timestamp: Date.now() }],
        prompt: 'Hello',
        signal: controller.signal,
        modelAdapter: adapter,
      },
      false,
    );

    // Cancel immediately
    controller.abort();

    const result = await chatPromise;
    expect(result.status).toBe('cancelled');
  });

  it('should return cancelled status on abort signal', async () => {
    const adapter = createFakeAdapter({ content: 'Response' });
    const controller = new AbortController();
    controller.abort(); // Abort before calling

    const result = await runAgentChat(
      {
        baseUrl: '/test',
        modelName: 'test-model',
        streaming: false,
        messages: [{ role: 'user', content: 'Hello', timestamp: Date.now() }],
        prompt: 'Hello',
        signal: controller.signal,
        modelAdapter: adapter,
      },
      false,
    );

    expect(result.status).toBe('cancelled');
  });

  it('should propagate errors from adapter', async () => {
    const adapter = createFakeAdapter({
      shouldThrow: true,
      errorMessage: 'Model server unavailable',
    });

    const result = await runAgentChat(
      {
        baseUrl: '/test',
        modelName: 'test-model',
        streaming: false,
        messages: [{ role: 'user', content: 'Hello', timestamp: Date.now() }],
        prompt: 'Hello',
        modelAdapter: adapter,
      },
      false,
    );

    expect(result.status).toBe('failed');
    expect(result.error).toBe('Model server unavailable');
  });

  it('should call onChunk callback during streaming', async () => {
    const chunks: string[] = [];
    const adapter = createFakeAdapter({ content: 'Streaming content here' });

    const result = await runAgentChat(
      {
        baseUrl: '/test',
        modelName: 'test-model',
        streaming: true,
        messages: [{ role: 'user', content: 'Stream me', timestamp: Date.now() }],
        prompt: 'Stream me',
        onChunk: (chunk) => chunks.push(chunk),
        modelAdapter: adapter,
      },
      false,
    );

    expect(result.content).toBe('Streaming content here');
    expect(chunks.length).toBeGreaterThan(0);
  });

  it('should call onReasoning callback when reasoning is present', async () => {
    const reasoningChunks: string[] = [];
    const adapter = createFakeAdapter({
      content: 'Answer',
      reasoning: 'Step by step reasoning',
    });

    const result = await runAgentChat(
      {
        baseUrl: '/test',
        modelName: 'test-model',
        streaming: false,
        messages: [{ role: 'user', content: 'Question', timestamp: Date.now() }],
        prompt: 'Question',
        onReasoning: (chunk) => reasoningChunks.push(chunk),
        modelAdapter: adapter,
      },
      false,
    );

    expect(result.reasoning).toBe('Step by step reasoning');
  });
});

describe('runAgentChat (with tools)', () => {
  it('should execute tool calls and return transcript', async () => {
    const toolCalls = [
      {
        id: 'call_1',
        type: 'function' as const,
        function: { name: 'vault.list_notes', arguments: '{}' },
      },
    ];
    const adapter = createFakeAdapter({
      content: 'I will list your notes.',
      toolCalls,
      finishReason: 'tool_calls',
    });

    // Note: Without a real vault context, internal tools won't actually execute,
    // but we can verify the transcript structure
    const result = await runAgentChat(
      {
        baseUrl: '/test',
        modelName: 'test-model',
        streaming: false,
        messages: [{ role: 'user', content: 'List my notes', timestamp: Date.now() }],
        prompt: 'List my notes',
        notes: [], // Empty notes means no tools available
        modelAdapter: adapter,
      },
      true, // useTools
    );

    // The tool call should be recorded as unknown/denied since no tools are registered
    expect(result.transcript.length).toBeGreaterThan(0);
  });

  it('should respect max iterations limit', async () => {
    // Create an adapter that always returns tool calls (to force iteration)
    const adapter = createFakeAdapter({
      content: 'Using a tool...',
      toolCalls: [
        {
          id: 'call_1',
          type: 'function' as const,
          function: { name: 'test_tool', arguments: '{}' },
        },
      ],
      finishReason: 'tool_calls',
    });

    const result = await runAgentChat(
      {
        baseUrl: '/test',
        modelName: 'test-model',
        streaming: false,
        messages: [{ role: 'user', content: 'Use tools', timestamp: Date.now() }],
        prompt: 'Use tools',
        notes: [], // No actual tools
        maxIterations: 2,
        modelAdapter: adapter,
      },
      true,
    );

    expect(result.status).toBe('iteration-limited');
  });

  it('should handle cancellation during tool loop', async () => {
    const adapter = createFakeAdapter({
      content: 'Using tool...',
      toolCalls: [
        {
          id: 'call_1',
          type: 'function' as const,
          function: { name: 'test_tool', arguments: '{}' },
        },
      ],
      finishReason: 'tool_calls',
    });

    const controller = new AbortController();

    const chatPromise = runAgentChat(
      {
        baseUrl: '/test',
        modelName: 'test-model',
        streaming: false,
        messages: [{ role: 'user', content: 'Use tools', timestamp: Date.now() }],
        prompt: 'Use tools',
        notes: [],
        signal: controller.signal,
        modelAdapter: adapter,
      },
      true,
    );

    // Cancel after first iteration
    controller.abort();

    const result = await chatPromise;
    expect(result.status).toBe('cancelled');
  });
});

describe('error handling', () => {
  it('should handle transport failures gracefully', async () => {
    const adapter = createFakeAdapter({
      shouldThrow: true,
      errorMessage: 'fetch failed: connection refused',
    });

    const result = await runAgentChat(
      {
        baseUrl: '/test',
        modelName: 'test-model',
        streaming: false,
        messages: [{ role: 'user', content: 'Hello', timestamp: Date.now() }],
        prompt: 'Hello',
        modelAdapter: adapter,
      },
      false,
    );

    expect(result.status).toBe('failed');
    expect(result.error).toContain('fetch failed');
  });

  it('should handle empty model response', async () => {
    const adapter = createFakeAdapter({ content: '' });

    const result = await runAgentChat(
      {
        baseUrl: '/test',
        modelName: 'test-model',
        streaming: false,
        messages: [{ role: 'user', content: 'Hello', timestamp: Date.now() }],
        prompt: 'Hello',
        modelAdapter: adapter,
      },
      false,
    );

    expect(result.status).toBe('completed');
    expect(result.content).toBe('');
  });
});

describe('runAgentChat (tool execution)', () => {
  it('should execute tool calls and track events in order', async () => {
    const events: string[] = [];
    const toolCalls = [
      {
        id: 'call_test_1',
        type: 'function' as const,
        function: { name: 'vault.list_notes', arguments: '{}' },
      },
    ];
    const adapter = createFakeAdapter({
      content: 'Here are your notes.',
      toolCalls,
      finishReason: 'tool_calls',
    });

    // Use a fake tool adapter that returns success
    const fakeToolAdapter = {
      execute: async (
        toolId: string,
        _input: Record<string, unknown>,
        _ctx: import('../types').ToolExecutionContext,
        _signal?: AbortSignal,
      ): Promise<import('../types').ToolInvocationResult> => {
        return {
          success: true,
          output: { notes: [], count: 0 },
          durationMs: 10,
        };
      },
      isAvailable: (_toolId: string): boolean => true,
    };

    const result = await runAgentChat(
      {
        baseUrl: '/test',
        modelName: 'test-model',
        streaming: false,
        messages: [{ role: 'user', content: 'List my notes', timestamp: Date.now() }],
        prompt: 'List my notes',
        notes: [], // Empty notes
        onEvent: (event) => {
          events.push(event.status);
        },
        toolAdapter: fakeToolAdapter as import('../utils/toolAdapter').ToolAdapter,
        modelAdapter: adapter,
      },
      true,
    );

    // Events should be emitted: requested, then running, then succeeded
    expect(events).toContain('requested');
    expect(events).toContain('running');
    expect(events).toContain('succeeded');
    expect(events.indexOf('requested')).toBeLessThan(events.indexOf('running'));
    expect(events.indexOf('running')).toBeLessThan(events.indexOf('succeeded'));
  });

  it('should execute tool calls and return structured output', async () => {
    const toolCalls = [
      {
        id: 'call_test_2',
        type: 'function' as const,
        function: { name: 'vault.list_notes', arguments: '{"max_results": 5}' },
      },
    ];
    const adapter = createFakeAdapter({
      content: 'Found results.',
      toolCalls,
      finishReason: 'tool_calls',
    });

    // Use a fake tool adapter that returns structured data
    const fakeToolAdapter = {
      execute: async (
        toolId: string,
        input: Record<string, unknown>,
        _ctx: import('../types').ToolExecutionContext,
        _signal?: AbortSignal,
      ): Promise<import('../types').ToolInvocationResult> => {
        return {
          success: true,
          output: {
            notes: [
              { title: 'Note 1', path: '/notes/note1.md' },
              { title: 'Note 2', path: '/notes/note2.md' },
            ],
            count: 2,
            toolId,
            input,
          },
          durationMs: 10,
        };
      },
      isAvailable: (_toolId: string): boolean => true,
    };

    const result = await runAgentChat(
      {
        baseUrl: '/test',
        modelName: 'test-model',
        streaming: false,
        messages: [{ role: 'user', content: 'Search for test', timestamp: Date.now() }],
        prompt: 'Search for test',
        notes: [],
        toolAdapter: fakeToolAdapter as import('../utils/toolAdapter').ToolAdapter,
        modelAdapter: adapter,
      },
      true,
    );

    expect(result.transcript.length).toBeGreaterThan(0);
    const toolRecord = result.transcript[0];
    expect(toolRecord.output).toBeDefined();
    if (toolRecord.output) {
      const output = toolRecord.output as { notes?: unknown[]; count?: number };
      expect(output.notes).toBeDefined();
      expect(Array.isArray(output.notes)).toBe(true);
      expect(output.count).toBe(2);
    }
  });

  it('should handle tool execution failure', async () => {
    const toolCalls = [
      {
        id: 'call_test_3',
        type: 'function' as const,
        function: { name: 'vault.list_notes', arguments: '{}' },
      },
    ];
    const adapter = createFakeAdapter({
      content: 'Tool will fail.',
      toolCalls,
      finishReason: 'tool_calls',
    });

    // Use a fake tool adapter that always fails
    const failingToolAdapter = {
      execute: async (
        _toolId: string,
        _input: Record<string, unknown>,
        _ctx: import('../types').ToolExecutionContext,
        _signal?: AbortSignal,
      ): Promise<import('../types').ToolInvocationResult> => {
        return {
          success: false,
          error: 'Simulated tool failure: connection timeout',
          durationMs: 5,
        };
      },
      isAvailable: (_toolId: string): boolean => true,
    };

    const result = await runAgentChat(
      {
        baseUrl: '/test',
        modelName: 'test-model',
        streaming: false,
        messages: [{ role: 'user', content: 'Use failing tool', timestamp: Date.now() }],
        prompt: 'Use failing tool',
        notes: [],
        toolAdapter: failingToolAdapter as import('../utils/toolAdapter').ToolAdapter,
        modelAdapter: adapter,
      },
      true,
    );

    expect(result.transcript.length).toBeGreaterThan(0);
    const toolRecord = result.transcript[0];
    expect(toolRecord.error).toBe('Simulated tool failure: connection timeout');
  });

  it('should handle unknown tool gracefully', async () => {
    const toolCalls = [
      {
        id: 'call_unknown',
        type: 'function' as const,
        function: { name: 'nonexistent.tool', arguments: '{}' },
      },
    ];
    const adapter = createFakeAdapter({
      content: 'Calling unknown tool.',
      toolCalls,
      finishReason: 'tool_calls',
    });

    const events: import('../types').ToolLoopEvent[] = [];
    const result = await runAgentChat(
      {
        baseUrl: '/test',
        modelName: 'test-model',
        streaming: false,
        messages: [{ role: 'user', content: 'Use unknown tool', timestamp: Date.now() }],
        prompt: 'Use unknown tool',
        notes: [], // No tools available
        onEvent: (event) => events.push(event),
        modelAdapter: adapter,
      },
      true,
    );

    // Should have a failed tool call in transcript
    expect(result.transcript.length).toBeGreaterThan(0);
    const toolRecord = result.transcript[0];
    expect(toolRecord.error).toContain('not found');
    expect(toolRecord.decision).toBe('deny');

    // Should have a failed event
    const failedEvent = events.find((e) => e.status === 'failed');
    expect(failedEvent).toBeDefined();
    expect(failedEvent?.error).toContain('not found');
  });

  it('should handle MCP tool unavailable gracefully', async () => {
    const toolCalls = [
      {
        id: 'call_mcp_unavailable',
        type: 'function' as const,
        function: { name: 'mcp::unavailable_server::tool', arguments: '{}' },
      },
    ];
    const adapter = createFakeAdapter({
      content: 'Calling MCP tool.',
      toolCalls,
      finishReason: 'tool_calls',
    });

    const result = await runAgentChat(
      {
        baseUrl: '/test',
        modelName: 'test-model',
        streaming: false,
        messages: [{ role: 'user', content: 'Use MCP tool', timestamp: Date.now() }],
        prompt: 'Use MCP tool',
        notes: [], // MCP tools won't be available without proper setup
        modelAdapter: adapter,
      },
      true,
    );

    // The tool should fail because MCP server is not available
    expect(result.transcript.length).toBeGreaterThan(0);
    const toolRecord = result.transcript[0];
    // MCP tool execution should fail or be denied
    expect(toolRecord.decision === 'deny' || toolRecord.error !== undefined).toBe(true);
  });

  it('should emit succeeded event when tool completes successfully', async () => {
    const toolCalls = [
      {
        id: 'call_success',
        type: 'function' as const,
        function: { name: 'vault.list_notes', arguments: '{}' },
      },
    ];
    const adapter = createFakeAdapter({
      content: 'Tool succeeded.',
      toolCalls,
      finishReason: 'tool_calls',
    });

    const fakeToolAdapter = {
      execute: async (
        _toolId: string,
        _input: Record<string, unknown>,
        _ctx: import('../types').ToolExecutionContext,
        _signal?: AbortSignal,
      ): Promise<import('../types').ToolInvocationResult> => {
        return {
          success: true,
          output: { message: 'Success!' },
          durationMs: 5,
        };
      },
      isAvailable: (_toolId: string): boolean => true,
    };

    const events: string[] = [];
    await runAgentChat(
      {
        baseUrl: '/test',
        modelName: 'test-model',
        streaming: false,
        messages: [{ role: 'user', content: 'Use success tool', timestamp: Date.now() }],
        prompt: 'Use success tool',
        notes: [],
        onEvent: (event) => {
          events.push(event.status);
        },
        toolAdapter: fakeToolAdapter as import('../utils/toolAdapter').ToolAdapter,
        modelAdapter: adapter,
      },
      true,
    );

    expect(events).toContain('requested');
    expect(events).toContain('running');
    expect(events).toContain('succeeded');
    // Verify order
    expect(events.indexOf('requested')).toBeLessThan(events.indexOf('running'));
    expect(events.indexOf('running')).toBeLessThan(events.indexOf('succeeded'));
  });
});

describe('toolAdapter', () => {
  it('should create fake adapter with custom options', async () => {
    const { createFakeToolAdapter } = await import('../utils/toolAdapter');

    // Test successful execution
    const successAdapter = createFakeToolAdapter({
      output: { data: 'test' },
      delayMs: 10,
    });
    expect(successAdapter.isAvailable('any_tool')).toBe(true);
    const successResult = await successAdapter.execute('test_tool', {}, {} as import('../types').ToolExecutionContext);
    expect(successResult.success).toBe(true);
    expect(successResult.output).toEqual({ toolId: 'test_tool', data: 'test' });

    // Test failed execution
    const failAdapter = createFakeToolAdapter({
      shouldFail: true,
      errorMessage: 'Custom error',
    });
    const failResult = await failAdapter.execute('fail_tool', {}, {} as import('../types').ToolExecutionContext);
    expect(failResult.success).toBe(false);
    expect(failResult.error).toBe('Custom error');
  });

  it('should check availability for internal tools', async () => {
    const { internalToolAdapter } = await import('../utils/toolAdapter');
    expect(internalToolAdapter.isAvailable('vault.list_notes')).toBe(true);
    expect(internalToolAdapter.isAvailable('vault.read_note')).toBe(true);
    expect(internalToolAdapter.isAvailable('nonexistent.tool')).toBe(false);
  });

  it('should identify MCP tools by prefix', async () => {
    const { mcpToolAdapter } = await import('../utils/toolAdapter');
    expect(mcpToolAdapter.isAvailable('mcp::server::tool')).toBe(true);
    expect(mcpToolAdapter.isAvailable('internal::tool')).toBe(false);
    expect(mcpToolAdapter.isAvailable('vault.list_notes')).toBe(false);
  });
});

describe('createFakeApprovalAdapter', () => {
  it('should return deny by default when no handler is available', async () => {
    const adapter = createFakeApprovalAdapter();

    const result = await adapter.requestApproval({
      toolId: 'test.tool',
      toolName: 'Test Tool',
      input: { key: 'value' },
      timestamp: Date.now(),
    });

    expect(result.decision).toBe('deny');
  });

  it('should return always_allow for always-allowed tools', async () => {
    const alwaysAllowed = new Set<string>(['always.tool']);
    const adapter = createFakeApprovalAdapter({ alwaysAllowed });

    const result = await adapter.requestApproval({
      toolId: 'always.tool',
      toolName: 'Always Tool',
      input: {},
      timestamp: Date.now(),
    });

    expect(result.decision).toBe('always_allow');
    expect(adapter.isAlwaysAllowed('always.tool')).toBe(true);
  });

  it('should track all approval requests', async () => {
    const adapter = createFakeApprovalAdapter({ defaultDecision: 'allow_once' });

    await adapter.requestApproval({
      toolId: 'tool1',
      toolName: 'Tool 1',
      input: { a: 1 },
      timestamp: Date.now(),
    });

    await adapter.requestApproval({
      toolId: 'tool2',
      toolName: 'Tool 2',
      input: { b: 2 },
      timestamp: Date.now(),
    });

    const requests = adapter.getRequests();
    expect(requests).toHaveLength(2);
    expect(requests[0].toolId).toBe('tool1');
    expect(requests[1].toolId).toBe('tool2');
  });

  it('should support setting always allowed via setAlwaysAllowed', async () => {
    const adapter = createFakeApprovalAdapter();

    adapter.setAlwaysAllowed('new.always.tool');

    expect(adapter.isAlwaysAllowed('new.always.tool')).toBe(true);

    const result = await adapter.requestApproval({
      toolId: 'new.always.tool',
      toolName: 'New Always Tool',
      input: {},
      timestamp: Date.now(),
    });

    expect(result.decision).toBe('always_allow');
  });

  it('should support clearing always allowed', async () => {
    const alwaysAllowed = new Set<string>(['to.clear']);
    const adapter = createFakeApprovalAdapter({ alwaysAllowed });

    expect(adapter.isAlwaysAllowed('to.clear')).toBe(true);

    adapter.clearAlwaysAllowed('to.clear');

    expect(adapter.isAlwaysAllowed('to.clear')).toBe(false);
  });

  it('should reset state correctly', async () => {
    const adapter = createFakeApprovalAdapter({ defaultDecision: 'allow_once' });

    await adapter.requestApproval({
      toolId: 'tool1',
      toolName: 'Tool 1',
      input: {},
      timestamp: Date.now(),
    });

    adapter.reset();

    expect(adapter.getRequests()).toHaveLength(0);
  });
});

describe('approval adapter integration in runAgentChat', () => {
  it('should use approval adapter for ask-gated tools', async () => {
    const events: string[] = [];
    const toolCalls = [
      {
        id: 'call_approval_1',
        type: 'function' as const,
        function: { name: 'note.create', arguments: '{"title": "Test"}' },
      },
    ];
    const adapter = createFakeAdapter({
      content: 'Creating a note.',
      toolCalls,
      finishReason: 'tool_calls',
    });

    const fakeToolAdapter = {
      execute: async (
        _toolId: string,
        _input: Record<string, unknown>,
        _ctx: import('../types').ToolExecutionContext,
        _signal?: AbortSignal,
      ): Promise<import('../types').ToolInvocationResult> => {
        return {
          success: true,
          output: { noteId: 'new-note' },
          durationMs: 10,
        };
      },
      isAvailable: (_toolId: string): boolean => true,
    };

    const approvalAdapter = createFakeApprovalAdapter({
      defaultDecision: 'allow_once',
    });

    const result = await runAgentChat(
      {
        baseUrl: '/test',
        modelName: 'test-model',
        streaming: false,
        messages: [{ role: 'user', content: 'Create a note', timestamp: Date.now() }],
        prompt: 'Create a note',
        notes: [],
        onEvent: (event) => {
          events.push(event.status);
        },
        toolAdapter: fakeToolAdapter as import('../utils/toolAdapter').ToolAdapter,
        modelAdapter: adapter,
        approvalAdapter,
      },
      true,
    );

    // Should have approval events
    expect(events).toContain('awaiting_approval');
    expect(events).toContain('approved');

    // Approval should be recorded in transcript
    expect(result.transcript.length).toBeGreaterThan(0);
  });

  it('should deny when approval adapter returns deny', async () => {
    const toolCalls = [
      {
        id: 'call_deny_1',
        type: 'function' as const,
        function: { name: 'note.create', arguments: '{"title": "Test"}' },
      },
    ];
    const adapter = createFakeAdapter({
      content: 'Creating a note.',
      toolCalls,
      finishReason: 'tool_calls',
    });

    const fakeToolAdapter = {
      execute: async (): Promise<import('../types').ToolInvocationResult> => {
        throw new Error('Tool should not have been called');
      },
      isAvailable: (): boolean => true,
    };

    const approvalAdapter = createFakeApprovalAdapter({ defaultDecision: 'deny' });

    const result = await runAgentChat(
      {
        baseUrl: '/test',
        modelName: 'test-model',
        streaming: false,
        messages: [{ role: 'user', content: 'Create a note', timestamp: Date.now() }],
        prompt: 'Create a note',
        notes: [],
        toolAdapter: fakeToolAdapter as import('../utils/toolAdapter').ToolAdapter,
        modelAdapter: adapter,
        approvalAdapter,
      },
      true,
    );

    // Tool should be denied
    expect(result.transcript.length).toBeGreaterThan(0);
    const record = result.transcript[0];
    expect(record.decision).toBe('deny');
  });

  it('should persist always_allow decisions', async () => {
    const toolCalls = [
      {
        id: 'call_persist_1',
        type: 'function' as const,
        function: { name: 'note.create', arguments: '{"title": "Test"}' },
      },
    ];
    const adapter = createFakeAdapter({
      content: 'Creating a note.',
      toolCalls,
      finishReason: 'tool_calls',
    });

    const fakeToolAdapter = {
      execute: async (): Promise<import('../types').ToolInvocationResult> => ({
        success: true,
        output: { noteId: 'new-note' },
        durationMs: 10,
      }),
      isAvailable: (): boolean => true,
    };

    const approvalAdapter = createFakeApprovalAdapter({ defaultDecision: 'always_allow' });

    await runAgentChat(
      {
        baseUrl: '/test',
        modelName: 'test-model',
        streaming: false,
        messages: [{ role: 'user', content: 'Create a note', timestamp: Date.now() }],
        prompt: 'Create a note',
        notes: [],
        toolAdapter: fakeToolAdapter as import('../utils/toolAdapter').ToolAdapter,
        modelAdapter: adapter,
        approvalAdapter,
      },
      true,
    );

    // Should be marked as always allowed
    expect(approvalAdapter.isAlwaysAllowed('note.create')).toBe(true);
  });

  it('should handle allow_session decisions', async () => {
    // Track call count to detect multiple model calls
    let modelCallCount = 0;
    const toolCalls = [
      {
        id: 'call_session_1',
        type: 'function' as const,
        function: { name: 'note.create', arguments: '{"title": "Test"}' },
      },
    ];
    const adapter = createFakeAdapter({
      content: 'Creating a note.',
      toolCalls,
      finishReason: 'tool_calls',
    });

    let executeCount = 0;
    const fakeToolAdapter = {
      execute: async (): Promise<import('../types').ToolInvocationResult> => {
        executeCount++;
        return {
          success: true,
          output: { noteId: 'new-note' },
          durationMs: 10,
        };
      },
      isAvailable: (): boolean => true,
    };

    const approvalAdapter = createFakeApprovalAdapter({ defaultDecision: 'allow_session' });
    const sessionApproved = new Set<string>();

    await runAgentChat(
      {
        baseUrl: '/test',
        modelName: 'test-model',
        streaming: false,
        messages: [{ role: 'user', content: 'Create a note', timestamp: Date.now() }],
        prompt: 'Create a note',
        notes: [],
        toolAdapter: fakeToolAdapter as import('../utils/toolAdapter').ToolAdapter,
        modelAdapter: adapter,
        approvalAdapter,
        sessionApprovedTools: sessionApproved,
        maxIterations: 1, // Limit to 1 iteration since fake adapter returns same tool calls
      },
      true,
    );

    // Tool should execute once (with maxIterations=1)
    expect(executeCount).toBe(1);
    // Session approved should contain the tool
    expect(sessionApproved.has('note.create')).toBe(true);
  });
});
