import type { InternalToolHandler, ToolExecutionContext, ToolInvocationResult } from '../../types';
import { createDirectory, deleteDirectory } from '../vault';
import { cleanString, validatePlainPath } from './validation';

function requireWritablePersonalVault(ctx: ToolExecutionContext): ToolInvocationResult | null {
  if (!ctx.personalRootHandle) {
    return { success: false, error: 'No personal vault root handle available', durationMs: 0 };
  }
  if (!ctx.personalVaultSource) {
    return { success: false, error: 'No personal vault source available', durationMs: 0 };
  }
  if (ctx.personalVaultSource.role !== 'personal' || ctx.personalVaultSource.readOnly) {
    return { success: false, error: 'Personal vault source is not writable', durationMs: 0 };
  }
  return null;
}

function validateFolderPath(path: string, fieldName = 'path'): string | null {
  return validatePlainPath(path.replace(/\/+$/, ''), fieldName);
}

function isRootFolderPath(path: string): boolean {
  return !path || path.replace(/\//g, '').trim() === '';
}

export const vaultCreateFolder: InternalToolHandler = {
  toolId: 'vault.create_folder',
  toolName: 'Create Folder',
  description: 'Create a folder in the writable personal vault.',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Vault-relative folder path to create' },
    },
    required: ['path'],
  },
  handler: async (input, ctx): Promise<ToolInvocationResult> => {
    const path = cleanString(input.path).replace(/\/+$/, '');
    const pathError = validateFolderPath(path);
    if (pathError) return { success: false, error: pathError, durationMs: 0 };

    const vaultError = requireWritablePersonalVault(ctx);
    if (vaultError) return vaultError;
    const rootHandle = ctx.personalRootHandle;
    if (!rootHandle) {
      return { success: false, error: 'No personal vault root handle available', durationMs: 0 };
    }

    try {
      await createDirectory(rootHandle, path);
      return {
        success: true,
        output: { message: 'Folder created', path },
        durationMs: 0,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        durationMs: 0,
      };
    }
  },
};

export const vaultDeleteFolder: InternalToolHandler = {
  toolId: 'vault.delete_folder',
  toolName: 'Delete Folder',
  description: 'Delete a folder from the writable personal vault.',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Vault-relative folder path to delete' },
      recursive: {
        type: 'boolean',
        description: 'Delete non-empty folders when true. Defaults to false.',
      },
    },
    required: ['path'],
  },
  handler: async (input, ctx): Promise<ToolInvocationResult> => {
    const path = cleanString(input.path).replace(/\/+$/, '');
    if (isRootFolderPath(path)) {
      return { success: false, error: 'Cannot delete vault root', durationMs: 0 };
    }
    const pathError = validateFolderPath(path);
    if (pathError) return { success: false, error: pathError, durationMs: 0 };

    const vaultError = requireWritablePersonalVault(ctx);
    if (vaultError) return vaultError;
    const rootHandle = ctx.personalRootHandle;
    if (!rootHandle) {
      return { success: false, error: 'No personal vault root handle available', durationMs: 0 };
    }

    const recursive = input.recursive === true;
    try {
      await deleteDirectory(rootHandle, path, { recursive });
      return {
        success: true,
        output: { message: 'Folder deleted', path, recursive },
        durationMs: 0,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        durationMs: 0,
      };
    }
  },
};
