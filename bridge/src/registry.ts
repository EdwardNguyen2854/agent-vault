import type {
  MCPServerConfig,
  MCPServerStatus,
  MCPTool,
  MCPToolCallRequest,
  MCPToolCallResponse,
} from './types.js';
import { MCPClient } from './mcpClient.js';

export class Registry {
  private client: MCPClient;
  private servers = new Map<string, MCPServerConfig>();

  constructor(client: MCPClient) {
    this.client = client;
  }

  async startServer(config: MCPServerConfig): Promise<void> {
    this.servers.set(config.name, config);
    await this.client.startServer(config);
  }

  stopServer(name: string): void {
    this.client.stopServer(name);
    this.servers.delete(name);
  }

  getServerNames(): string[] {
    return [...this.servers.keys()];
  }

  getStatus(name: string): MCPServerStatus | undefined {
    return this.client.getServerStatus(name);
  }

  getAllStatuses(): MCPServerStatus[] {
    return this.getServerNames()
      .map((name) => this.getStatus(name))
      .filter((s): s is MCPServerStatus => s !== undefined);
  }

  listTools(name: string): Promise<MCPTool[]> {
    return this.client.listTools(name);
  }

  callTool(name: string, request: MCPToolCallRequest): Promise<MCPToolCallResponse> {
    return this.client.callTool(name, request);
  }

  stopAll(): void {
    this.client.stopAll();
    this.servers.clear();
  }
}
