import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultMiniMaxConfig, getModels, sendChatRequest, testConnection } from './minimax';

const config = {
  ...defaultMiniMaxConfig,
  apiKey: 'test-api-key',
  baseUrl: 'https://api.example.test/v1',
  modelName: 'MiniMax-Test',
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('MiniMax provider', () => {
  it('rejects connection tests without an API key', async () => {
    const result = await testConnection({ ...config, apiKey: '' });

    expect(result.success).toBe(false);
    expect(result.error).toContain('API key is required');
  });

  it('reports API connection errors without leaking the key', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { message: 'Unauthorized' } }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await testConnection(config);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Could not connect to MiniMax');
    expect(result.error).not.toContain(config.apiKey);
    expect(fetchMock).toHaveBeenCalledWith(
      `${config.baseUrl}/chat/completions`,
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: `Bearer ${config.apiKey}` }),
      }),
    );
  });

  it('loads available models with authenticated model discovery', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: [{ id: 'MiniMax-M2' }, { id: 'MiniMax-Text-01' }] }), {
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(getModels(config)).resolves.toEqual(['MiniMax-M2', 'MiniMax-Text-01']);
    expect(fetchMock).toHaveBeenCalledWith(
      `${config.baseUrl}/models`,
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: `Bearer ${config.apiKey}` }),
      }),
    );
  });

  it('sends tool definitions and parses non-streaming tool calls', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              finish_reason: 'tool_calls',
              message: {
                content: 'I will inspect the note.',
                tool_calls: [
                  {
                    id: 'call_1',
                    type: 'function',
                    function: { name: 'vault.read_note', arguments: '{"path":"Home.md"}' },
                  },
                ],
              },
            },
          ],
        }),
        { headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await sendChatRequest({
      ...config,
      streaming: false,
      messages: [{ role: 'user', content: 'Read Home.md', timestamp: Date.now() }],
      tools: [
        {
          type: 'function',
          function: {
            name: 'vault.read_note',
            description: 'Read a note',
            parameters: { type: 'object', properties: {} },
          },
        },
      ],
    });

    expect(result.finishReason).toBe('tool_calls');
    expect(result.toolCalls[0].function.name).toBe('vault.read_note');
    expect(fetchMock).toHaveBeenCalledWith(
      `${config.baseUrl}/chat/completions`,
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: `Bearer ${config.apiKey}` }),
        body: expect.stringContaining('vault.read_note'),
      }),
    );
  });

  it('parses streaming content and tool calls', async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ choices: [{ delta: { content: 'Reading ' } }] })}\n`,
          ),
        );
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              choices: [{
                delta: {
                  tool_calls: [{
                    index: 0,
                    id: 'call_2',
                    type: 'function',
                    function: { name: 'vault.read_note', arguments: '{"path":' },
                  }],
                },
              }],
            })}\n`,
          ),
        );
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              choices: [{
                delta: {
                  tool_calls: [{ index: 0, function: { arguments: '"Home.md"}' } }],
                },
                finish_reason: 'tool_calls',
              }],
            })}`,
          ),
        );
        controller.close();
      },
    });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const chunks: string[] = [];
    const result = await sendChatRequest({
      ...config,
      streaming: true,
      messages: [{ role: 'user', content: 'Read Home.md', timestamp: Date.now() }],
      onChunk: (chunk) => chunks.push(chunk),
    });

    expect(chunks).toEqual(['Reading ']);
    expect(result.toolCalls[0].function.arguments).toBe('{"path":"Home.md"}');
    expect(result.finishReason).toBe('tool_calls');
  });
});
