import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Agent, ToolExecutionContext } from '../../types';
import { evaluateToolCall } from '../permissionGate';
import { createDirectory, deleteDirectory } from '../vault';
import { vaultCreateFolder, vaultDeleteFolder } from './folderTools';
import { getInternalTool } from './registry';

vi.mock('../vault', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../vault')>();
  return {
    ...actual,
    createDirectory: vi.fn(),
    deleteDirectory: vi.fn(),
  };
});

const mockCreateDirectory = vi.mocked(createDirectory);
const mockDeleteDirectory = vi.mocked(deleteDirectory);

const personalRootHandle = { kind: 'directory', name: 'Personal' } as FileSystemDirectoryHandle;

function makeCtx(overrides: Partial<ToolExecutionContext> = {}): ToolExecutionContext {
  return {
    notes: [],
    personalRootHandle,
    personalVaultSource: {
      id: 'personal-1',
      name: 'Personal Vault',
      role: 'personal',
      readOnly: false,
    },
    ...overrides,
  };
}

function makeAgent(
  permissions: Agent['permissions'] = { tool_mode: 'ask', write_mode: 'ask' },
): Agent {
  return {
    id: 'agent-1',
    name: 'Folder Agent',
    role: 'operator',
    status: 'active',
    skills: [],
    tools: [],
    memory: [],
    permissions,
  };
}

describe('vault folder lifecycle tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateDirectory.mockResolvedValue(undefined);
    mockDeleteDirectory.mockResolvedValue(undefined);
  });

  it('creates a nested folder through the idempotent vault helper', async () => {
    const result = await vaultCreateFolder.handler({ path: 'Projects/Research' }, makeCtx());

    expect(result.success).toBe(true);
    expect(result.output).toEqual({
      message: 'Folder created',
      path: 'Projects/Research',
    });
    expect(mockCreateDirectory).toHaveBeenCalledWith(personalRootHandle, 'Projects/Research');
  });

  it.each([
    ['../outside', 'path cannot contain path traversal'],
    ['/Projects', 'path must be a vault-relative path'],
    ['Projects:Archive', 'path contains invalid characters'],
  ])('rejects invalid create path %s', async (path, expectedError) => {
    const result = await vaultCreateFolder.handler({ path }, makeCtx());

    expect(result.success).toBe(false);
    expect(result.error).toContain(expectedError);
    expect(mockCreateDirectory).not.toHaveBeenCalled();
  });

  it.each([
    [
      'without a personal root handle',
      { personalRootHandle: undefined },
      'No personal vault root handle available',
    ],
    [
      'without a personal source',
      { personalVaultSource: undefined },
      'No personal vault source available',
    ],
    [
      'with a non-personal source',
      {
        personalVaultSource: {
          id: 'shared-1',
          name: 'Shared Vault',
          role: 'shared' as const,
          readOnly: false,
        },
      },
      'Personal vault source is not writable',
    ],
    [
      'with a read-only personal source',
      {
        personalVaultSource: {
          id: 'personal-1',
          name: 'Personal Vault',
          role: 'personal' as const,
          readOnly: true,
        },
      },
      'Personal vault source is not writable',
    ],
  ])('blocks create %s', async (_label, overrides, expectedError) => {
    const result = await vaultCreateFolder.handler(
      { path: 'Projects' },
      makeCtx(overrides as Partial<ToolExecutionContext>),
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe(expectedError);
    expect(mockCreateDirectory).not.toHaveBeenCalled();
  });

  it('deletes an empty folder with recursive disabled by default', async () => {
    const result = await vaultDeleteFolder.handler({ path: 'Projects/Archive' }, makeCtx());

    expect(result.success).toBe(true);
    expect(result.output).toEqual({
      message: 'Folder deleted',
      path: 'Projects/Archive',
      recursive: false,
    });
    expect(mockDeleteDirectory).toHaveBeenCalledWith(personalRootHandle, 'Projects/Archive', {
      recursive: false,
    });
  });

  it('surfaces non-empty folder failures when recursive is false', async () => {
    mockDeleteDirectory.mockRejectedValueOnce(new Error('Directory is not empty'));

    const result = await vaultDeleteFolder.handler({ path: 'Projects/Archive' }, makeCtx());

    expect(result.success).toBe(false);
    expect(result.error).toBe('Directory is not empty');
  });

  it('deletes recursively when requested', async () => {
    const result = await vaultDeleteFolder.handler(
      { path: 'Projects/Archive', recursive: true },
      makeCtx(),
    );

    expect(result.success).toBe(true);
    expect(result.output).toEqual({
      message: 'Folder deleted',
      path: 'Projects/Archive',
      recursive: true,
    });
    expect(mockDeleteDirectory).toHaveBeenCalledWith(personalRootHandle, 'Projects/Archive', {
      recursive: true,
    });
  });

  it.each(['', '/'])('rejects root delete path %s', async (path) => {
    const result = await vaultDeleteFolder.handler({ path }, makeCtx());

    expect(result.success).toBe(false);
    expect(result.error).toBe('Cannot delete vault root');
    expect(mockDeleteDirectory).not.toHaveBeenCalled();
  });

  it('registers both folder tools as ask permission and medium risk', () => {
    expect(getInternalTool('vault.create_folder')).toMatchObject({
      permission: 'ask',
      risk: 'medium',
    });
    expect(getInternalTool('vault.delete_folder')).toMatchObject({
      permission: 'ask',
      risk: 'medium',
    });
  });

  it('denies folder writes in read-only tool mode before write ask mode can prompt', () => {
    const tool = getInternalTool('vault.create_folder');

    expect(tool).toBeDefined();
    expect(
      evaluateToolCall(tool!, makeAgent({ tool_mode: 'read-only', write_mode: 'ask' }), makeCtx()),
    ).toEqual({
      decision: 'deny',
      reason: 'Agent read-only mode blocks write-capable tools',
    });
  });

  it('asks for folder writes in normal ask mode', () => {
    const tool = getInternalTool('vault.delete_folder');

    expect(tool).toBeDefined();
    expect(evaluateToolCall(tool!, makeAgent(), makeCtx())).toEqual({
      decision: 'ask',
      reason: 'Write tool requires confirmation',
    });
  });
});
