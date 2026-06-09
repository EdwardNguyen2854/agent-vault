import type { Tool, ToolPermission } from '../types';
import { getToolPermissionOverrides, setToolPermissionOverride } from './permissions';

const MCP_STORAGE_KEY = 'agent-vault-mcp-config';

/**
 * MCP Server configuration
 */
export interface MCPServerConfig {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  enabled: boolean;
  status: 'connected' | 'disconnected' | 'error' | 'connecting';
  lastConnected?: number;
  error?: string;
}

/**
 * MCP Configuration containing all servers
 */
export interface MCPConfig {
  servers: MCPServerConfig[];
  globalEnabled: boolean;
}

/**
 * Tool invocation record for history
 */
export interface ToolInvocation {
  id: string;
  toolId: string;
  toolName: string;
  serverName?: string;
  input: Record<string, unknown>;
  output?: unknown;
  error?: string;
  timestamp: number;
  duration?: number;
  approved: boolean;
}

/**
 * Default empty MCP configuration
 */
function getDefaultConfig(): MCPConfig {
  return {
    servers: [],
    globalEnabled: true,
  };
}

/**
 * Load MCP servers configuration from localStorage.
 */
export function getMcpServers(): MCPConfig {
  try {
    const stored = localStorage.getItem(MCP_STORAGE_KEY);
    if (stored) {
      const config = JSON.parse(stored) as MCPConfig;
      // Validate structure
      if (Array.isArray(config.servers)) {
        return config;
      }
    }
  } catch (e) {
    console.warn('Failed to load MCP config from localStorage:', e);
  }
  return getDefaultConfig();
}

/**
 * Save MCP servers configuration to localStorage.
 */
export function saveMcpServers(config: MCPConfig): void {
  try {
    localStorage.setItem(MCP_STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.error('Failed to save MCP config to localStorage:', e);
  }
}

/**
 * Add or update an MCP server configuration.
 */
export function addMcpServer(server: MCPServerConfig): void {
  const config = getMcpServers();
  const existingIndex = config.servers.findIndex((s) => s.name === server.name);
  if (existingIndex >= 0) {
    config.servers[existingIndex] = server;
  } else {
    config.servers.push(server);
  }
  saveMcpServers(config);
}

/**
 * Remove an MCP server configuration.
 */
export function removeMcpServer(serverName: string): void {
  const config = getMcpServers();
  config.servers = config.servers.filter((s) => s.name !== serverName);
  saveMcpServers(config);
}

/**
 * Update MCP server status.
 */
export function updateMcpServerStatus(
  serverName: string,
  status: MCPServerConfig['status'],
  error?: string,
): void {
  const config = getMcpServers();
  const server = config.servers.find((s) => s.name === serverName);
  if (server) {
    server.status = status;
    server.error = error;
    if (status === 'connected') {
      server.lastConnected = Date.now();
    }
    saveMcpServers(config);
  }
}

/**
 * Enable or disable the MCP global toggle.
 */
export function setMcpGlobalEnabled(enabled: boolean): void {
  const config = getMcpServers();
  config.globalEnabled = enabled;
  saveMcpServers(config);
}

/**
 * Default MarkItDown MCP server config. The bridge will spawn the stdio
 * server in `servers/markitdown-mcp/server.py` on demand.
 */
export const MARKITDOWN_SERVER_NAME = 'markitdown';

export interface MarkitdownServerConfig {
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  installHint: string;
  capabilitiesUrl: string;
}

export function getMarkitdownServerConfig(): MarkitdownServerConfig {
  return {
    name: MARKITDOWN_SERVER_NAME,
    command: 'python3',
    args: ['servers/markitdown-mcp/server.py'],
    env: { PYTHONUNBUFFERED: '1' },
    installHint: 'pip install -r servers/markitdown-mcp/requirements.txt',
    capabilitiesUrl: 'https://github.com/microsoft/markitdown',
  };
}

/**
 * Register the MarkItDown MCP server with the local registry. Returns true if
 * the server was newly added, false if it was already registered.
 */
export function seedMarkitdownServer(): boolean {
  const config = getMcpServers();
  if (config.servers.some((s) => s.name === MARKITDOWN_SERVER_NAME)) {
    return false;
  }
  const def = getMarkitdownServerConfig();
  config.servers.push({
    name: def.name,
    command: def.command,
    args: def.args,
    env: def.env,
    enabled: true,
    status: 'disconnected',
  });
  saveMcpServers(config);
  return true;
}

/**
 * Get enabled MCP servers.
 */
export function getEnabledMcpServers(): MCPServerConfig[] {
  const config = getMcpServers();
  if (!config.globalEnabled) return [];
  return config.servers.filter((s) => s.enabled);
}

/**
 * Discover tools from an MCP server.
 * This is a placeholder - actual implementation would communicate with the MCP server
 * via stdio or HTTP to list available tools.
 */
export function discoverMcpTools(serverName: string): Tool[] {
  // Placeholder: In a real implementation, this would:
  // 1. Start or connect to the MCP server process
  // 2. Send a list_tools request
  // 3. Parse the response and convert to Tool objects
  // For now, return empty array
  console.info(`[MCP] Discovering tools from server: ${serverName}`);
  return [];
}

/**
 * Discover tools from all enabled MCP servers.
 */
export function discoverAllMcpTools(): Tool[] {
  const servers = getEnabledMcpServers();
  return servers.flatMap((server) => discoverMcpTools(server.name));
}

/**
 * Test connection to an MCP server.
 * Browser v0.1.0 keeps MCP bridge execution local sidecar/dev-capable.
 */
export async function testMcpConnection(serverName: string): Promise<boolean> {
  const config = getMcpServers();
  const server = config.servers.find((s) => s.name === serverName);

  if (!server) {
    console.warn(`[MCP] Server not found: ${serverName}`);
    return false;
  }

  console.info(`[MCP] Browser v0.1.0 cannot connect to MCP server directly: ${serverName}`);
  updateMcpServerStatus(serverName, 'disconnected', 'Not connected directly in browser v0.1.0');
  return false;
}

/**
 * Invoke a tool from an MCP server.
 * This is a placeholder - actual implementation would:
 * 1. Route to the correct MCP server
 * 2. Send the tool request
 * 3. Return the response or throw on error
 */
export async function invokeMcpTool(
  toolId: string,
  serverName: string,
  input: Record<string, unknown>,
): Promise<unknown> {
  const config = getMcpServers();
  const server = config.servers.find((s) => s.name === serverName);

  if (!server) {
    throw new Error(`MCP server not found: ${serverName}`);
  }

  if (!server.enabled || server.status !== 'connected') {
    throw new Error(`MCP server not connected: ${serverName}`);
  }

  console.info(`[MCP] Invoking tool ${toolId} on server ${serverName}:`, input);

  // Placeholder: In a real implementation, this would:
  // 1. Serialize the request and send to the server
  // 2. Parse the response and return
  // For now, return a placeholder response
  await new Promise((resolve) => setTimeout(resolve, 200));

  return {
    success: true,
    toolId,
    serverName,
    input,
    timestamp: Date.now(),
  };
}

/**
 * Check if a tool requires user confirmation before execution.
 * Tools with 'ask' permission always require confirmation.
 */
export function toolRequiresConfirmation(tool: Tool): boolean {
  return tool.permission === 'ask';
}

/**
 * Get tool invocation history from localStorage.
 */
export function getToolInvocationHistory(): ToolInvocation[] {
  try {
    const stored = localStorage.getItem(`${MCP_STORAGE_KEY}-history`);
    if (stored) {
      return JSON.parse(stored) as ToolInvocation[];
    }
  } catch (e) {
    console.warn('Failed to load tool invocation history:', e);
  }
  return [];
}

/**
 * Add a tool invocation to history.
 */
export function addToolInvocation(invocation: ToolInvocation): void {
  try {
    const history = getToolInvocationHistory();
    history.unshift(invocation);
    // Keep only last 100 invocations
    const trimmed = history.slice(0, 100);
    localStorage.setItem(`${MCP_STORAGE_KEY}-history`, JSON.stringify(trimmed));
  } catch (e) {
    console.error('Failed to save tool invocation history:', e);
  }
}

/**
 * Clear tool invocation history.
 */
export function clearToolInvocationHistory(): void {
  try {
    localStorage.removeItem(`${MCP_STORAGE_KEY}-history`);
  } catch (e) {
    console.error('Failed to clear tool invocation history:', e);
  }
}

export function getMcpToolPermissions(): Record<string, ToolPermission> {
  return getToolPermissionOverrides();
}

export function setMcpToolPermission(toolId: string, permission: ToolPermission): void {
  setToolPermissionOverride(toolId, permission);
}

export function getMcpToolPermission(toolId: string): ToolPermission | null {
  const permissions = getMcpToolPermissions();
  return permissions[toolId] ?? null;
}
