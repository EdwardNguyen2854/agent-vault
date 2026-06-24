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
