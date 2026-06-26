import type { InternalToolHandler, ToolExecutionContext, ToolInvocationResult } from '../../types';
import { deriveVaultFolders } from '../vault';
import { cleanString, validatePlainPath } from './validation';

export const vaultListFolders: InternalToolHandler = {
  toolId: 'vault.list_folders',
  toolName: 'List Folders',
  description: 'List folders in the vault, optionally filtered by parent path or vault role.',
  parameters: {
    type: 'object',
    properties: {
      parent_path: { type: 'string', description: 'Optional folder path to list folders under' },
      vault_role: {
        type: 'string',
        enum: ['agent', 'personal', 'shared'],
        description: 'Optional vault role filter',
      },
    },
  },
  handler: async (input, ctx): Promise<ToolInvocationResult> => {
    let notes = ctx.notes;

    const parentPathRaw = cleanString(input.parent_path);
    if (parentPathRaw) {
      const pathError = validatePlainPath(parentPathRaw, 'parent_path');
      if (pathError) return { success: false, error: pathError, durationMs: 0 };
    }

    const vaultRole = input.vault_role;
    if (vaultRole) {
      const role = String(vaultRole).toLowerCase();
      if (!['agent', 'personal', 'shared'].includes(role)) {
        return { success: false, error: 'vault_role must be agent, personal, or shared', durationMs: 0 };
      }
      notes = notes.filter((n) => n.vaultRole === role);
    }

    let folders = deriveVaultFolders(notes);
    if (parentPathRaw) {
      const normalized = parentPathRaw.replace(/\/+$/, '');
      folders = folders.filter(
        (f) => f.path === normalized || f.path.startsWith(normalized + '/'),
      );
    }

    return {
      success: true,
      output: folders,
      durationMs: 0,
    };
  },
};
