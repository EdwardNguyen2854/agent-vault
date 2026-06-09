import type { ToolPermission } from '../types';

const ALWAYS_ALLOW_KEY = 'agent-vault-always-allow';
const PERMISSION_LOG_KEY = 'agent-vault-permission-log';
const TOOL_PERMISSION_OVERRIDES_KEY = 'agent-vault-tool-permission-overrides';
const LEGACY_MCP_TOOL_PERMISSIONS_KEY = 'agent-vault-tool-permissions';

export interface PermissionLogEntry {
  timestamp: number;
  toolId: string;
  toolName: string;
  decision: 'allow_once' | 'allow_session' | 'always_allow';
}

export function getAlwaysAllowIds(): Set<string> {
  try {
    const stored = localStorage.getItem(ALWAYS_ALLOW_KEY);
    if (stored) {
      const arr = JSON.parse(stored) as string[];
      return new Set(arr);
    }
  } catch {
    // ignore
  }
  return new Set();
}

export function setAlwaysAllowId(toolId: string): void {
  try {
    const ids = getAlwaysAllowIds();
    ids.add(toolId);
    localStorage.setItem(ALWAYS_ALLOW_KEY, JSON.stringify([...ids]));
  } catch {
    // ignore
  }
}

export function removeAlwaysAllowId(toolId: string): void {
  try {
    const ids = getAlwaysAllowIds();
    ids.delete(toolId);
    localStorage.setItem(ALWAYS_ALLOW_KEY, JSON.stringify([...ids]));
  } catch {
    // ignore
  }
}

export function logPermissionGrant(entry: PermissionLogEntry): void {
  try {
    const stored = localStorage.getItem(PERMISSION_LOG_KEY);
    const log: PermissionLogEntry[] = stored ? JSON.parse(stored) : [];
    const last = log[log.length - 1];
    if (
      last &&
      last.toolId === entry.toolId &&
      last.decision === entry.decision &&
      Math.abs(last.timestamp - entry.timestamp) < 1000
    ) {
      return;
    }
    log.push(entry);
    if (log.length > 200) {
      log.splice(0, log.length - 200);
    }
    localStorage.setItem(PERMISSION_LOG_KEY, JSON.stringify(log));
  } catch {
    // ignore
  }
}

export function getPermissionLog(): PermissionLogEntry[] {
  try {
    const stored = localStorage.getItem(PERMISSION_LOG_KEY);
    if (stored) return JSON.parse(stored) as PermissionLogEntry[];
  } catch {
    // ignore
  }
  return [];
}

function loadPermissionRecord(key: string): Record<string, ToolPermission> {
  try {
    const stored = localStorage.getItem(key);
    if (stored) return JSON.parse(stored) as Record<string, ToolPermission>;
  } catch {
    // ignore
  }
  return {};
}

export function getToolPermissionOverrides(): Record<string, ToolPermission> {
  const legacy = loadPermissionRecord(LEGACY_MCP_TOOL_PERMISSIONS_KEY);
  const current = loadPermissionRecord(TOOL_PERMISSION_OVERRIDES_KEY);
  const merged = { ...legacy, ...current };
  if (Object.keys(legacy).length > 0 && Object.keys(current).length === 0) {
    try {
      localStorage.setItem(TOOL_PERMISSION_OVERRIDES_KEY, JSON.stringify(merged));
    } catch {
      // ignore
    }
  }
  return merged;
}

export function setToolPermissionOverride(toolId: string, permission: ToolPermission): void {
  try {
    const overrides = getToolPermissionOverrides();
    overrides[toolId] = permission;
    localStorage.setItem(TOOL_PERMISSION_OVERRIDES_KEY, JSON.stringify(overrides));
    const legacy = loadPermissionRecord(LEGACY_MCP_TOOL_PERMISSIONS_KEY);
    if (Object.prototype.hasOwnProperty.call(legacy, toolId)) {
      delete legacy[toolId];
      localStorage.setItem(LEGACY_MCP_TOOL_PERMISSIONS_KEY, JSON.stringify(legacy));
    }
  } catch {
    // ignore
  }
}
