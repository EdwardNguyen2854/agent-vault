import http from 'node:http';
import { URL } from 'node:url';
import type { MCPServerConfig } from './types.js';
import { Registry } from './registry.js';

const VERSION = '0.1.0';

export function createHttpServer(registry: Registry, port: number): http.Server {
  const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    try {
      const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
      const path = url.pathname;
      const method = req.method ?? 'GET';

      const body = method === 'POST' ? await parseBody(req) : null;

      await route(registry, method, path, body, res);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      sendJSON(res, 400, { success: false, error: message });
    }
  });

  return server;
}

async function route(
  registry: Registry,
  method: string,
  path: string,
  body: unknown,
  res: http.ServerResponse,
): Promise<void> {
  if (path === '/health' && method === 'GET') {
    const statuses = registry.getAllStatuses();
    return sendJSON(res, 200, {
      ok: true,
      version: VERSION,
      servers: registry.getServerNames(),
      status:
        statuses.length > 0
          ? statuses.every((s) => s.status === 'running')
            ? 'connected'
            : 'error'
          : 'disconnected',
    });
  }

  if (path === '/servers' && method === 'GET') {
    return sendJSON(res, 200, registry.getAllStatuses());
  }

  if (path === '/servers' && method === 'POST') {
    const config = body as MCPServerConfig;
    if (!config?.name || !config?.command) {
      return sendJSON(res, 400, {
        success: false,
        error: 'Missing required fields: name, command',
      });
    }
    try {
      await registry.startServer(config);
      return sendJSON(res, 200, { success: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return sendJSON(res, 500, { success: false, error: message });
    }
  }

  const removeMatch = path.match(/^\/servers\/([^/]+)\/remove$/);
  if (removeMatch && method === 'POST') {
    const name = removeMatch[1];
    registry.stopServer(name);
    return sendJSON(res, 200, { success: true });
  }

  const toolsMatch = path.match(/^\/servers\/([^/]+)\/tools$/);
  if (toolsMatch && method === 'GET') {
    const name = toolsMatch[1];
    try {
      const tools = await registry.listTools(name);
      return sendJSON(res, 200, { tools });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return sendJSON(res, 500, { success: false, error: message });
    }
  }

  const invokeMatch = path.match(/^\/servers\/([^/]+)\/invoke$/);
  if (invokeMatch && method === 'POST') {
    const name = invokeMatch[1];
    const req = body as { name: string; arguments: Record<string, unknown> };
    if (!req?.name) {
      return sendJSON(res, 400, {
        success: false,
        error: 'Missing required field: name',
      });
    }
    try {
      const result = await registry.callTool(name, {
        name: req.name,
        arguments: req.arguments ?? {},
      });
      return sendJSON(res, 200, result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return sendJSON(res, 500, { success: false, error: message });
    }
  }

  return sendJSON(res, 404, { success: false, error: 'Not found' });
}

function parseBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf-8');
      if (!raw) {
        resolve(null);
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function sendJSON(res: http.ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}
