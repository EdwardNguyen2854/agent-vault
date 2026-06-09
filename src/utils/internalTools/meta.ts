import type { InternalToolHandler, ToolInvocationResult, ToolExecutionContext } from '../../types';
import { getMemoryMetadata, isMemoryNote, memoryMatchesTarget } from '../memory';
import { isToolNote, loadToolMetadata } from '../tools';
import { clampMaxResults, cleanString, validatePlainPath } from './validation';

const MCP_STORAGE_KEY = 'agent-vault-mcp-config';

function getMcpServerStatuses(): Record<string, string> {
  try {
    const stored = localStorage.getItem(MCP_STORAGE_KEY);
    if (stored) {
      const config = JSON.parse(stored);
      if (Array.isArray(config.servers)) {
        const map: Record<string, string> = {};
        for (const s of config.servers) {
          map[s.name] = s.status ?? 'disconnected';
        }
        return map;
      }
    }
  } catch {}
  return {};
}

export const vaultListNotes: InternalToolHandler = {
  toolId: 'vault.list_notes',
  toolName: 'List Notes',
  description: 'List notes in the vault, optionally filtered by folder path.',
  parameters: {
    type: 'object',
    properties: {
      folder: {
        type: 'string',
        description: 'Optional folder path to list notes under (e.g. Projects/)',
      },
      vault_role: {
        type: 'string',
        enum: ['agent', 'personal', 'shared'],
        description: 'Optional vault role filter',
      },
      max_results: { type: 'number', description: 'Maximum results (default 50)' },
    },
  },
  handler: async (input, ctx): Promise<ToolInvocationResult> => {
    const folderRaw = cleanString(input.folder);
    const pathError = folderRaw ? validatePlainPath(folderRaw, 'folder') : null;
    if (pathError) return { success: false, error: pathError, durationMs: 0 };
    const folder = folderRaw.toLowerCase();
    const vaultRole = input.vault_role ? String(input.vault_role).toLowerCase() : '';
    if (vaultRole && !['agent', 'personal', 'shared'].includes(vaultRole)) {
      return {
        success: false,
        error: 'vault_role must be agent, personal, or shared',
        durationMs: 0,
      };
    }
    const maxResults = clampMaxResults(input.max_results, 50, 200);

    let notes = ctx.notes;
    if (vaultRole === 'agent' || vaultRole === 'personal' || vaultRole === 'shared') {
      notes = notes.filter((n) => n.vaultRole === vaultRole);
    }
    if (folder) {
      const normalizedFolder = folder.replace(/\/+$/, '');
      notes = notes.filter((n) => {
        const path = n.path.toLowerCase();
        return path === normalizedFolder || path.startsWith(normalizedFolder + '/');
      });
    }

    return {
      success: true,
      output: notes.slice(0, maxResults).map((n) => ({
        title: n.title,
        path: n.path,
      })),
      durationMs: 0,
    };
  },
};

export const vaultGetMetadata: InternalToolHandler = {
  toolId: 'vault.get_metadata',
  toolName: 'Get Metadata',
  description: 'Get vault-level statistics and metadata counts.',
  parameters: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: ['vault', 'tools', 'agents', 'memory'],
        description: 'Type of metadata to retrieve (default: vault)',
      },
    },
  },
  handler: async (input, ctx): Promise<ToolInvocationResult> => {
    const type = String(input.type ?? 'vault');

    if (type === 'tools') {
      const tools = ctx.notes.filter((n) => isToolNote(n)).map(loadToolMetadata);
      const mcpStatuses = getMcpServerStatuses();
      return {
        success: true,
        output: {
          total: tools.length,
          internal: tools.filter((t) => t.provider === 'internal').length,
          mcp: tools.filter((t) => t.provider === 'mcp').length,
          disabled: tools.filter((t) => t.permission === 'disabled').length,
          active: tools.filter((t) => t.status === 'active').length,
          mcpServers: mcpStatuses,
        },
        durationMs: 0,
      };
    }

    if (type === 'agents') {
      const agents = ctx.notes.filter((n) => {
        const p = n.path.toLowerCase();
        return n.frontmatter.type === 'agent' || p.includes('/agents/') || n.tags.includes('agent');
      });
      return {
        success: true,
        output: agents.map((a) => ({
          name: a.title,
          role: a.frontmatter.role ?? '',
          status: a.frontmatter.status ?? 'inactive',
        })),
        durationMs: 0,
      };
    }

    if (type === 'memory') {
      const memoryNotes = ctx.notes.filter(isMemoryNote);
      return {
        success: true,
        output: {
          total: memoryNotes.length,
          notes: memoryNotes.map((n) => {
            const metadata = getMemoryMetadata(n);
            return {
              title: n.title,
              path: n.path,
              memory_type: metadata.memoryType,
              target: metadata.target ?? null,
              status: metadata.status,
              vault_role: metadata.vaultRole,
              read_only: metadata.readOnly,
              writable: metadata.writable,
            };
          }),
        },
        durationMs: 0,
      };
    }

    const tags = new Map<string, number>();
    for (const note of ctx.notes) {
      for (const tag of note.tags) {
        tags.set(tag, (tags.get(tag) ?? 0) + 1);
      }
    }

    const tagArray = Array.from(tags.entries()).sort((a, b) => b[1] - a[1]);

    return {
      success: true,
      output: {
        noteCount: ctx.notes.length,
        tagCount: tags.size,
        topTags: tagArray.slice(0, 20).map(([name, count]) => ({ name, count })),
      },
      durationMs: 0,
    };
  },
};

export const memoryList: InternalToolHandler = {
  toolId: 'memory.list',
  toolName: 'List Memory',
  description:
    'List memory notes, optionally filtered by type, target, vault role, or writeability.',
  parameters: {
    type: 'object',
    properties: {
      memory_type: {
        type: 'string',
        enum: ['agent', 'team', 'project', 'user', 'skill', 'tool', 'decision', 'run', ''],
        description: 'Optional memory type filter',
      },
      target: { type: 'string', description: 'Optional exact target filter' },
      vault_role: {
        type: 'string',
        enum: ['agent', 'personal', 'shared', ''],
        description: 'Optional vault role filter',
      },
      writable: { type: 'boolean', description: 'Optional writeability filter' },
      max_results: { type: 'number', description: 'Maximum results (default 20)' },
    },
  },
  handler: async (input, ctx): Promise<ToolInvocationResult> => {
    const memoryType = input.memory_type ? String(input.memory_type).toLowerCase() : '';
    if (
      memoryType &&
      !['agent', 'team', 'project', 'user', 'skill', 'tool', 'decision', 'run'].includes(memoryType)
    ) {
      return { success: false, error: 'memory_type is invalid', durationMs: 0 };
    }
    const target = cleanString(input.target);
    const vaultRole = input.vault_role ? String(input.vault_role).toLowerCase() : '';
    if (vaultRole && !['agent', 'personal', 'shared'].includes(vaultRole)) {
      return {
        success: false,
        error: 'vault_role must be agent, personal, or shared',
        durationMs: 0,
      };
    }
    const writable = typeof input.writable === 'boolean' ? input.writable : null;
    const maxResults = clampMaxResults(input.max_results, 20, 100);

    let memoryNotes = ctx.notes.filter(isMemoryNote);

    if (memoryType) {
      memoryNotes = memoryNotes.filter((n) => getMemoryMetadata(n).memoryType === memoryType);
    }
    if (target) {
      memoryNotes = memoryNotes.filter((n) => memoryMatchesTarget(n, target));
    }
    if (vaultRole) {
      memoryNotes = memoryNotes.filter((n) => getMemoryMetadata(n).vaultRole === vaultRole);
    }
    if (writable !== null) {
      memoryNotes = memoryNotes.filter((n) => getMemoryMetadata(n).writable === writable);
    }

    return {
      success: true,
      output: memoryNotes.slice(0, maxResults).map((n) => {
        const metadata = getMemoryMetadata(n);
        return {
          title: n.title,
          path: n.path,
          memory_type: metadata.memoryType,
          target: metadata.target ?? null,
          status: metadata.status,
          vault_role: metadata.vaultRole,
          read_only: metadata.readOnly,
          writable: metadata.writable,
        };
      }),
      durationMs: 0,
    };
  },
};
