import type { Tool, ToolPermission, ToolRisk, VaultNote } from '../types';
import { getNoteKey } from './noteKey';
import { buildBacklinks } from './markdown/graph';
import { getWorkspaceEntityType } from './markdown/entity';
import { getInternalTools as getRegistryInternalTools } from './internalTools/registry';
import { getCachedBridgeHealth } from './bridgeClient';
import { getToolPermissionOverrides } from './permissions';

/**
 * Tool permission levels
 */
export type ToolPermissionLevel = 'disabled' | 'ask' | 'read-only' | 'vault-only' | 'trusted';

/**
 * Tool risk levels
 */
export type ToolRiskLevel = 'low' | 'medium' | 'high';

/**
 * Check if a note is a tool based on detection logic.
 * Tools are identified by:
 * - frontmatter.type === 'tool'
 * - path includes /Tools/
 * - #tool tag
 */
export function isToolNote(note: VaultNote): boolean {
  const type = typeof note.frontmatter.type === 'string' ? note.frontmatter.type.toLowerCase() : '';
  const path = `/${note.path.toLowerCase()}`;
  const tags = note.tags.map((tag) => tag.toLowerCase());

  return type === 'tool' || path.includes('/tools/') || tags.includes('tool');
}

/**
 * Extract tool permission from note frontmatter.
 * Returns 'ask' as default if not specified.
 */
export function getToolPermission(note: VaultNote): ToolPermission {
  const permission = note.frontmatter.permission;
  if (typeof permission === 'string') {
    const p = permission.toLowerCase();
    if (
      p === 'disabled' ||
      p === 'ask' ||
      p === 'read-only' ||
      p === 'vault-only' ||
      p === 'trusted'
    ) {
      return p as ToolPermission;
    }
  }
  return 'ask';
}

/**
 * Extract tool risk level from note frontmatter.
 * Returns 'medium' as default if not specified.
 */
export function getToolRisk(note: VaultNote): ToolRisk {
  const risk = note.frontmatter.risk;
  if (typeof risk === 'string') {
    const r = risk.toLowerCase();
    if (r === 'low' || r === 'medium' || r === 'high') {
      return r as ToolRisk;
    }
  }
  return 'medium';
}

/**
 * Extract tool_id from note frontmatter.
 */
export function getToolId(note: VaultNote): string {
  if (typeof note.frontmatter.tool_id === 'string' && note.frontmatter.tool_id) {
    return note.frontmatter.tool_id;
  }
  // Fallback: generate from name
  const name = typeof note.frontmatter.name === 'string' ? note.frontmatter.name : note.title;
  return name.toLowerCase().replace(/\s+/g, '.');
}

/**
 * Load tool metadata from a tool note.
 */
export function loadToolMetadata(note: VaultNote): Tool {
  const provider = note.frontmatter.provider === 'mcp' ? 'mcp' : 'internal';
  const hasExplicitToolId =
    typeof note.frontmatter.tool_id === 'string' && note.frontmatter.tool_id.trim().length > 0;
  const toolId = getToolId(note);
  const name =
    typeof note.frontmatter.name === 'string' && note.frontmatter.name
      ? note.frontmatter.name
      : note.title;

  let status = parseToolStatus(note.frontmatter.status);
  if (
    provider === 'mcp' &&
    (!hasExplicitToolId ||
      typeof note.frontmatter.server !== 'string' ||
      !note.frontmatter.server.trim())
  ) {
    status = 'error';
  }
  const permission = getToolPermission(note);
  const risk = getToolRisk(note);

  const description =
    typeof note.frontmatter.description === 'string' && note.frontmatter.description
      ? note.frontmatter.description
      : extractDescription(note.content);

  const installHint =
    typeof note.frontmatter.install_hint === 'string' && note.frontmatter.install_hint
      ? note.frontmatter.install_hint
      : undefined;
  const capabilitiesUrl =
    typeof note.frontmatter.capabilities_url === 'string' && note.frontmatter.capabilities_url
      ? note.frontmatter.capabilities_url
      : undefined;

  return {
    id: toolId,
    name,
    provider,
    server: typeof note.frontmatter.server === 'string' ? note.frontmatter.server : undefined,
    status,
    permission,
    risk,
    description,
    installHint,
    capabilitiesUrl,
    source: 'vault',
    sourceNotePath: note.path,
    updatedAt: note.updatedAt,
  };
}

/**
 * Get all tools from notes array.
 */
export function getToolsFromNotes(notes: VaultNote[]): Tool[] {
  return notes.filter(isToolNote).map(loadToolMetadata);
}

/**
 * Build synthetic Tool entries for MCP servers that are registered in the
 * bridge but do not yet have matching tool notes in the vault. This keeps the
 * Tools view populated the moment a user clicks "Register" (or when the
 * bridge auto-reports the MarkItDown server) instead of requiring a second
 * manual step to seed tool notes.
 */
function getBridgeBackedTools(
  mcpStatuses: Record<string, string>,
  overrides: Record<string, ToolPermission>,
): Tool[] {
  if (typeof localStorage === 'undefined') return [];
  let configured: Array<{ name: string; command: string; args?: string[]; enabled?: boolean }> = [];
  try {
    const stored = localStorage.getItem('agent-vault-mcp-config');
    if (stored) {
      const config = JSON.parse(stored) as { servers?: typeof configured };
      if (Array.isArray(config.servers)) configured = config.servers;
    }
  } catch {
    return [];
  }
  const seen = new Set<string>();
  const out: Tool[] = [];
  for (const server of configured) {
    if (!server?.name) continue;
    if (server.enabled === false) continue;
    const status = mcpStatuses[server.name] ?? 'disconnected';
    const isMarkitdown =
      server.name === 'markitdown' || (server.args ?? []).some((a) => a.includes('markitdown-mcp'));
    if (!isMarkitdown) continue;
    const defaults: Array<Pick<Tool, 'id' | 'name' | 'risk' | 'permission' | 'description'>> = [
      {
        id: 'markitdown.convert',
        name: 'MarkItDown Convert',
        risk: 'medium',
        permission: 'ask',
        description: 'Convert a file or approved URL to Markdown and save it as a sidecar note.',
      },
      {
        id: 'markitdown.list_capabilities',
        name: 'MarkItDown Capabilities',
        risk: 'low',
        permission: 'read-only',
        description: 'List the optional-extras groups currently installed for MarkItDown.',
      },
      {
        id: 'markitdown.install_extras',
        name: 'MarkItDown Install Extras',
        risk: 'high',
        permission: 'ask',
        description: 'pip-install a MarkItDown extras group to enable additional file types.',
      },
    ];
    for (const def of defaults) {
      if (seen.has(def.id)) continue;
      seen.add(def.id);
      const toolStatus: Tool['status'] =
        status === 'connected' ? 'active' : status === 'error' ? 'error' : 'disconnected';
      out.push({
        id: def.id,
        name: def.name,
        provider: 'mcp',
        server: server.name,
        status: toolStatus,
        permission: overrides[def.id] ?? def.permission,
        risk: def.risk,
        description: def.description,
        source: 'system',
        installHint: 'pip install -r servers/markitdown-mcp/requirements.txt',
        capabilitiesUrl: 'https://github.com/microsoft/markitdown',
      });
    }
  }
  return out;
}

/**
 * Get all available tools including internal registry tools.
 * Merges vault tool notes with the built-in internal tool handlers.
 */
export function getAllTools(notes: VaultNote[]): Tool[] {
  const vaultTools = getToolsFromNotes(notes);
  const overrides = getToolPermissionOverrides();
  const internalTools = getRegistryInternalTools().map((tool) => ({
    ...tool,
    permission: overrides[tool.id] ?? tool.permission,
    source: 'system' as const,
    sourceNotePath: vaultTools.find(
      (vaultTool) => vaultTool.id === tool.id && vaultTool.provider === 'internal',
    )?.sourceNotePath,
  }));
  const internalIds = new Set(internalTools.map((tool) => tool.id));
  const mcpStatuses = getMcpServerStatusMap();
  const externalVaultTools = vaultTools
    .filter((tool) => tool.provider === 'mcp' || !internalIds.has(tool.id))
    .map((tool) => {
      const next = { ...tool, permission: overrides[tool.id] ?? tool.permission };
      if (next.provider === 'mcp') {
        if (!next.server || !next.id) {
          next.status = 'error';
        } else if (mcpStatuses[next.server] && mcpStatuses[next.server] !== 'connected') {
          next.status = 'disconnected';
        }
      }
      return next;
    });
  const existingIds = new Set([
    ...internalTools.map((tool) => tool.id),
    ...externalVaultTools.map((tool) => tool.id),
  ]);
  const bridgeBacked = getBridgeBackedTools(mcpStatuses, overrides).filter(
    (tool) => !existingIds.has(tool.id),
  );
  return [...internalTools, ...externalVaultTools, ...bridgeBacked];
}

/**
 * Get tools filtered by permission level.
 */
export function getToolsByPermission(notes: VaultNote[], permission: ToolPermission): Tool[] {
  return getToolsFromNotes(notes).filter((tool) => tool.permission === permission);
}

/**
 * Get tools filtered by provider (internal or mcp).
 */
export function getToolsByProvider(notes: VaultNote[], provider: 'internal' | 'mcp'): Tool[] {
  return getToolsFromNotes(notes).filter((tool) => tool.provider === provider);
}

/**
 * Get tools filtered by status.
 */
export function getToolsByStatus(notes: VaultNote[], status: Tool['status']): Tool[] {
  return getToolsFromNotes(notes).filter((tool) => tool.status === status);
}

/**
 * Get tools filtered by risk level.
 */
export function getToolsByRisk(notes: VaultNote[], risk: ToolRisk): Tool[] {
  return getToolsFromNotes(notes).filter((tool) => tool.risk === risk);
}

/**
 * Get disabled tools.
 */
export function getDisabledTools(notes: VaultNote[]): Tool[] {
  return getToolsByPermission(notes, 'disabled');
}

/**
 * Get internal tools (not from MCP servers).
 */
export function getInternalTools(notes: VaultNote[]): Tool[] {
  return getToolsByProvider(notes, 'internal');
}

/**
 * Get MCP tools (from external servers).
 */
export function getMcpTools(): Tool[] {
  // Chat runtime does not use this placeholder. Live MCP listing is bridge-backed
  // through bridgeClient.listBridgeServers/listBridgeTools and registered tool notes
  // must include provider: mcp, server, and tool_id to be callable.
  return [];
}

/**
 * Get active tools (non-disabled, non-inactive).
 */
export function getActiveTools(notes: VaultNote[]): Tool[] {
  return getToolsFromNotes(notes).filter(
    (tool) => tool.status === 'active' && tool.permission !== 'disabled',
  );
}

/**
 * Validate tool note structure.
 */
export function validateToolNote(note: VaultNote): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check required frontmatter fields
  if (!note.title || note.title.trim() === '') {
    errors.push('Tool name is required');
  }

  const toolId = getToolId(note);
  if (!toolId || toolId.trim() === '') {
    errors.push('tool_id is required in frontmatter');
  }

  // Validate permission level
  const permission = getToolPermission(note);
  const validPermissions: ToolPermission[] = [
    'disabled',
    'ask',
    'read-only',
    'vault-only',
    'trusted',
  ];
  if (!validPermissions.includes(permission)) {
    errors.push(`Invalid permission level: ${permission}`);
  }

  // Validate risk level
  const risk = getToolRisk(note);
  const validRisks: ToolRisk[] = ['low', 'medium', 'high'];
  if (!validRisks.includes(risk)) {
    errors.push(`Invalid risk level: ${risk}`);
  }

  // Validate provider
  const provider = note.frontmatter.provider;
  if (provider && typeof provider === 'string' && provider !== 'internal' && provider !== 'mcp') {
    errors.push(`Invalid provider: ${provider}. Must be 'internal' or 'mcp'`);
  }
  if (provider === 'mcp') {
    if (typeof note.frontmatter.server !== 'string' || !note.frontmatter.server.trim()) {
      errors.push('MCP tools require server in frontmatter');
    }
    if (typeof note.frontmatter.tool_id !== 'string' || !note.frontmatter.tool_id.trim()) {
      errors.push('MCP tools require exact tool_id in frontmatter');
    }
  }

  // Validate status
  const status = parseToolStatus(note.frontmatter.status);
  if (status === 'error') {
    errors.push('Tool has error status');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

function getMcpServerStatusMap(): Record<string, string> {
  const health = getCachedBridgeHealth();
  try {
    const stored = localStorage.getItem('agent-vault-mcp-config');
    if (!stored) return {};
    const config = JSON.parse(stored);
    if (!Array.isArray(config.servers)) return {};
    const configured = Object.fromEntries(
      config.servers.map((server: { name: string; status?: string }) => [
        server.name,
        server.status ?? 'disconnected',
      ]),
    );
    if (health?.status === 'connected' && Array.isArray(health.servers)) {
      for (const serverName of health.servers) {
        if (!configured[serverName]) configured[serverName] = 'connected';
      }
    }
    return configured;
  } catch {
    return {};
  }
}

/**
 * Get notes that link to a tool (related agents or skills).
 */
export function getRelatedNotesForTool(tool: Tool, notes: VaultNote[]): VaultNote[] {
  const toolTitle = tool.name.toLowerCase();
  const toolId = tool.id.toLowerCase();

  return notes.filter((note) => {
    // Skip tool notes themselves
    if (isToolNote(note)) return false;

    // Check if the note links to this tool
    const linksToTool = note.links.some((link) => {
      const target = link.target.toLowerCase();
      return target === toolTitle || target === toolId || target.includes(toolId);
    });

    if (linksToTool) return true;

    // Check backlinks
    const backlinks = buildBacklinks(notes, note);
    return backlinks.some(
      (bl) =>
        bl.sourceTitle.toLowerCase().includes(toolTitle) ||
        bl.sourcePath.toLowerCase().includes(toolId),
    );
  });
}

/**
 * Get related skills for a tool.
 */
export function getRelatedSkillsForTool(tool: Tool, notes: VaultNote[]): VaultNote[] {
  return getRelatedNotesForTool(tool, notes).filter((note) => {
    const type = getWorkspaceEntityType(note);
    return type === 'skill';
  });
}

/**
 * Get related agents for a tool.
 */
export function getRelatedAgentsForTool(tool: Tool, notes: VaultNote[]): VaultNote[] {
  return getRelatedNotesForTool(tool, notes).filter((note) => {
    const type = getWorkspaceEntityType(note);
    return type === 'agent';
  });
}

/**
 * Extract description from note content (first non-heading, non-empty line).
 */
function extractDescription(content: string): string {
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (
      trimmed &&
      !trimmed.startsWith('#') &&
      !trimmed.startsWith('---') &&
      !trimmed.startsWith('[[')
    ) {
      return trimmed;
    }
  }
  return '';
}

/**
 * Parse tool status from frontmatter value.
 */
function parseToolStatus(status: string | string[] | undefined): Tool['status'] {
  if (!status) return 'inactive';
  const s = typeof status === 'string' ? status.toLowerCase() : '';
  if (s === 'active') return 'active';
  if (s === 'error') return 'error';
  if (s === 'disconnected') return 'disconnected';
  return 'inactive';
}

/**
 * Format permission level for display.
 */
export function formatPermission(permission: ToolPermission): string {
  const labels: Record<ToolPermission, string> = {
    disabled: 'Disabled',
    ask: 'Ask',
    'read-only': 'Read-only',
    'vault-only': 'Vault-only',
    trusted: 'Trusted',
  };
  return labels[permission] || permission;
}

/**
 * Format risk level for display.
 */
export function formatRisk(risk: ToolRisk): string {
  const labels: Record<ToolRisk, string> = {
    low: 'Low Risk',
    medium: 'Medium Risk',
    high: 'High Risk',
  };
  return labels[risk] || risk;
}

/**
 * Get risk color class for styling.
 */
export function getRiskColorClass(risk: ToolRisk): string {
  const classes: Record<ToolRisk, string> = {
    low: 'risk-low',
    medium: 'risk-medium',
    high: 'risk-high',
  };
  return classes[risk] || 'risk-medium';
}

/**
 * Get permission color class for styling.
 */
export function getPermissionColorClass(permission: ToolPermission): string {
  const classes: Record<ToolPermission, string> = {
    disabled: 'permission-disabled',
    ask: 'permission-ask',
    'read-only': 'permission-read-only',
    'vault-only': 'permission-vault-only',
    trusted: 'permission-trusted',
  };
  return classes[permission] || 'permission-ask';
}
