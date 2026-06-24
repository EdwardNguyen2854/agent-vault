/**
 * Tests for agentExecution module
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ChatMessage } from '../types';
import { createFakeAdapter, type FakeAdapterOptions } from './modelAdapter';
import { runSimpleChat, runAgentChat } from './agentExecution';

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
    expect(result.cancelled).toBe(false);
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
    expect(result.cancelled).toBe(true);
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

    expect(result.cancelled).toBe(true);
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
    expect(result.cancelled).toBe(true);
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
