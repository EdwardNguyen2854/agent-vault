import type { BridgeHealth, BridgeStatus, ToolInvocationResult } from '../types';

const DEFAULT_BRIDGE_URL = '/mcp-bridge';

let bridgeUrl = DEFAULT_BRIDGE_URL;
let cachedStatus: BridgeStatus = 'disconnected';
let cachedHealth: BridgeHealth | null = null;

export function setBridgeUrl(url: string): void {
  bridgeUrl = url;
}

export function getBridgeUrl(): string {
  return bridgeUrl;
}

function getBaseUrl(): string {
  return bridgeUrl.replace(/\/+$/, '');
}

async function apiPost<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${getBaseUrl()}${path}`, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Bridge API error ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${getBaseUrl()}${path}`);
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Bridge API error ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export async function checkBridgeHealth(): Promise<BridgeHealth> {
  try {
    const health = await apiGet<BridgeHealth>('/health');
    cachedStatus = health.status;
    cachedHealth = health;
    return health;
  } catch {
    cachedStatus = 'disconnected';
    cachedHealth = { ok: false, servers: [], status: 'disconnected' };
    return cachedHealth;
  }
}

export function getCachedBridgeStatus(): BridgeStatus {
  return cachedStatus;
}

export function getCachedBridgeHealth(): BridgeHealth | null {
  return cachedHealth;
}

export interface BridgeServerConfig {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export async function addBridgeServer(config: BridgeServerConfig): Promise<void> {
  await apiPost('/servers', config);
}

export async function removeBridgeServer(name: string): Promise<void> {
  await apiPost(`/servers/${encodeURIComponent(name)}/remove`, {});
}

export async function listBridgeServers(): Promise<
  Array<{ name: string; status: string; toolsCount: number }>
> {
  return apiGet('/servers');
}

export async function listBridgeTools(
  serverName: string,
): Promise<Array<{ name: string; description: string; inputSchema: Record<string, unknown> }>> {
  const result = await apiGet<
    | { tools?: Array<{ name: string; description: string; inputSchema: Record<string, unknown> }> }
    | Array<{ name: string; description: string; inputSchema: Record<string, unknown> }>
  >(`/servers/${encodeURIComponent(serverName)}/tools`);
  return Array.isArray(result) ? result : (result.tools ?? []);
}

export async function invokeBridgeTool(
  serverName: string,
  toolName: string,
  arguments_: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<ToolInvocationResult> {
  const start = performance.now();
  try {
    const result = await apiPost<{ success: boolean; output?: unknown; error?: string }>(
      `/servers/${encodeURIComponent(serverName)}/invoke`,
      { name: toolName, arguments: arguments_ },
      signal,
    );
    return {
      success: result.success,
      output: result.output,
      error: result.error,
      durationMs: performance.now() - start,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
      durationMs: performance.now() - start,
    };
  }
}
