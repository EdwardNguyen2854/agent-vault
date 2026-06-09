export interface MCPServerConfig {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface MCPServerStatus {
  name: string;
  status: 'running' | 'stopped' | 'error';
  toolsCount: number;
  error?: string;
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface MCPToolCallRequest {
  name: string;
  arguments: Record<string, unknown>;
}

export interface MCPToolCallResponse {
  success: boolean;
  output?: unknown;
  error?: string;
}

export interface BridgeHealth {
  ok: boolean;
  version: string;
  servers: string[];
  status: 'connected' | 'disconnected' | 'error';
}

export interface JSONRPCMessage {
  jsonrpc: '2.0';
  id?: number | string;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}
