import { spawn, ChildProcess } from 'node:child_process';
import type {
  MCPServerConfig,
  MCPServerStatus,
  MCPTool,
  MCPToolCallRequest,
  MCPToolCallResponse,
  JSONRPCMessage,
} from './types.js';

const CRLF_CRLF = Buffer.from('\r\n\r\n');
const REQUEST_TIMEOUT = 30_000;

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

export class MCPClient {
  private processes = new Map<string, ChildProcess>();
  private buffers = new Map<string, Buffer[]>();
  private pendingRequests = new Map<string, Map<number, PendingRequest>>();
  private nextId = new Map<string, number>();
  private toolCaches = new Map<string, MCPTool[]>();
  private statuses = new Map<string, MCPServerStatus>();

  async startServer(config: MCPServerConfig): Promise<void> {
    if (this.processes.has(config.name)) {
      throw new Error(`Server "${config.name}" is already running`);
    }

    const child = spawn(config.command, config.args ?? [], {
      env: { ...process.env, ...config.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.processes.set(config.name, child);
    this.buffers.set(config.name, []);
    this.pendingRequests.set(config.name, new Map());
    this.nextId.set(config.name, 1);
    this.statuses.set(config.name, {
      name: config.name,
      status: 'running',
      toolsCount: 0,
    });

    child.stdout!.on('data', (data: Buffer) => {
      const chunks = this.buffers.get(config.name)!;
      chunks.push(data);
      this.processBuffer(config.name);
    });

    child.stdin!.on('error', () => {});

    child.on('error', (err) => {
      this.statuses.set(config.name, {
        name: config.name,
        status: 'error',
        toolsCount: 0,
        error: err.message,
      });
    });

    child.on('exit', (code, signal) => {
      const reason = signal
        ? `Killed by ${signal}`
        : code !== null
          ? `Exited with code ${code}`
          : 'Exited unexpectedly';
      this.statuses.set(config.name, {
        name: config.name,
        status: 'stopped',
        toolsCount: 0,
        error: reason,
      });
      this.processes.delete(config.name);

      const pending = this.pendingRequests.get(config.name);
      if (pending) {
        for (const [, req] of pending) {
          clearTimeout(req.timeout);
          req.reject(new Error(`Server "${config.name}" exited: ${reason}`));
        }
        pending.clear();
      }
    });

    await this.sendRequest(config.name, 'initialize', {
      protocolVersion: '0.1',
      capabilities: {},
      clientInfo: {
        name: 'agent-vault-bridge',
        version: '0.1.0',
      },
    });

    this.sendNotification(config.name, 'initialized', {});

    const listResult = (await this.sendRequest(config.name, 'tools/list', {})) as {
      tools?: MCPTool[];
    };
    const tools = listResult.tools ?? [];
    this.toolCaches.set(config.name, tools);

    const status = this.statuses.get(config.name)!;
    status.toolsCount = tools.length;
  }

  stopServer(name: string): void {
    const child = this.processes.get(name);
    if (!child) return;

    child.kill('SIGTERM');
    this.cleanupServer(name);
    this.statuses.set(name, {
      name,
      status: 'stopped',
      toolsCount: 0,
    });
  }

  getServerStatus(name: string): MCPServerStatus | undefined {
    return this.statuses.get(name);
  }

  async listTools(name: string): Promise<MCPTool[]> {
    const cached = this.toolCaches.get(name);
    if (cached) return cached;

    const result = (await this.sendRequest(name, 'tools/list', {})) as {
      tools?: MCPTool[];
    };
    const tools = result.tools ?? [];
    this.toolCaches.set(name, tools);
    return tools;
  }

  async callTool(serverName: string, request: MCPToolCallRequest): Promise<MCPToolCallResponse> {
    try {
      const result = (await this.sendRequest(serverName, 'tools/call', {
        name: request.name,
        arguments: request.arguments,
      })) as {
        content?: { type: string; text?: string }[];
        isError?: boolean;
      };

      const textParts =
        result.content?.filter((c) => c.type === 'text').map((c) => c.text ?? '') ?? [];
      const output = textParts.length > 0 ? textParts.join('\n') : result;

      if (result.isError) {
        return {
          success: false,
          error: typeof output === 'string' ? output : JSON.stringify(output),
        };
      }

      return { success: true, output };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  stopAll(): void {
    for (const name of this.processes.keys()) {
      const child = this.processes.get(name);
      if (child) {
        child.kill('SIGTERM');
      }
    }
    const names = [...this.processes.keys()];
    for (const name of names) {
      this.cleanupServer(name);
    }
  }

  private async sendRequest(serverName: string, method: string, params: unknown): Promise<unknown> {
    return new Promise<unknown>((resolve, reject) => {
      const child = this.processes.get(serverName);
      if (!child?.stdin?.writable) {
        return reject(new Error(`Server "${serverName}" is not running`));
      }

      const id = this.nextId.get(serverName)!;
      this.nextId.set(serverName, id + 1);

      const msg: JSONRPCMessage = {
        jsonrpc: '2.0',
        id,
        method,
        params,
      };
      this.writeMessage(serverName, msg);

      const pending = this.pendingRequests.get(serverName)!;
      const timeout = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`Request "${method}" to "${serverName}" timed out`));
      }, REQUEST_TIMEOUT);

      pending.set(id, { resolve, reject, timeout });
    });
  }

  private sendNotification(serverName: string, method: string, params: unknown): void {
    const child = this.processes.get(serverName);
    if (!child?.stdin?.writable) return;

    const msg: JSONRPCMessage = {
      jsonrpc: '2.0',
      method,
      params,
    };
    this.writeMessage(serverName, msg);
  }

  private writeMessage(serverName: string, msg: JSONRPCMessage): void {
    const child = this.processes.get(serverName);
    if (!child?.stdin?.writable) return;

    const body = JSON.stringify(msg);
    const header = `Content-Length: ${Buffer.byteLength(body, 'utf-8')}\r\n\r\n`;
    child.stdin.write(header + body);
  }

  private processBuffer(serverName: string): void {
    const chunks = this.buffers.get(serverName);
    if (!chunks || chunks.length === 0) return;

    const fullBuffer = Buffer.concat(chunks);
    let offset = 0;

    while (true) {
      const headerEnd = fullBuffer.indexOf(CRLF_CRLF, offset);
      if (headerEnd === -1) break;

      const headerBuf = fullBuffer.slice(offset, headerEnd);
      const match = headerBuf.toString('ascii').match(/Content-Length:\s*(\d+)/i);

      if (!match) {
        offset = headerEnd + 4;
        continue;
      }

      const contentLength = parseInt(match[1], 10);
      const bodyStart = headerEnd + 4;
      const totalNeeded = bodyStart + contentLength;

      if (fullBuffer.length < totalNeeded) break;

      const bodyBuf = fullBuffer.slice(bodyStart, totalNeeded);
      offset = totalNeeded;

      try {
        const message = JSON.parse(bodyBuf.toString('utf-8'));
        this.handleMessage(serverName, message);
      } catch {}
    }

    this.buffers.set(serverName, offset < fullBuffer.length ? [fullBuffer.slice(offset)] : []);
  }

  private handleMessage(serverName: string, message: JSONRPCMessage): void {
    if (message.id !== undefined && message.id !== null) {
      const pending = this.pendingRequests.get(serverName);
      if (!pending) return;

      const pendingReq = pending.get(message.id as number);
      if (!pendingReq) return;

      clearTimeout(pendingReq.timeout);
      pending.delete(message.id as number);

      if (message.error) {
        pendingReq.reject(new Error(message.error.message));
      } else {
        pendingReq.resolve(message.result);
      }
    }
  }

  private cleanupServer(name: string): void {
    this.processes.delete(name);
    this.buffers.delete(name);

    const pending = this.pendingRequests.get(name);
    if (pending) {
      for (const [, req] of pending) {
        clearTimeout(req.timeout);
        req.reject(new Error(`Server "${name}" was stopped`));
      }
      pending.clear();
    }

    this.pendingRequests.delete(name);
    this.nextId.delete(name);
    this.toolCaches.delete(name);
  }
}
