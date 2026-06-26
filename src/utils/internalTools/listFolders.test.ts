import { describe, it, expect } from 'vitest';
import type { Agent, VaultNote, ToolExecutionContext } from '../../types';
import { evaluateToolCall } from '../permissionGate';
import { vaultListFolders } from './listFolders';
import { getInternalTool } from './registry';

function mockNote(overrides: Partial<VaultNote>): VaultNote {
  return {
    vaultId: 'personal-1',
    vaultName: 'Personal Vault',
    vaultRole: 'personal',
    readOnly: false,
    path: 'Untitled.md',
    name: 'Untitled.md',
    extension: 'md',
    isBinary: false,
    handle: {} as FileSystemFileHandle,
    updatedAt: 0,
    size: 0,
    title: 'Untitled',
    content: '',
    links: [],
    tags: [],
    frontmatter: {},
    tasks: [],
    headings: [],
    ...overrides,
  };
}

function makeCtx(notes: VaultNote[]): ToolExecutionContext {
  return {
    notes,
  };
}

describe('vault.list_folders', () => {
  it('returns all folders when called without filters', async () => {
    const notes = [
      mockNote({ path: 'Projects/Research/Paper.md', name: 'Paper.md', vaultRole: 'personal', vaultName: 'Personal Vault', vaultId: 'personal-1' }),
      mockNote({ path: 'Journal/Daily.md', name: 'Daily.md', vaultRole: 'personal', vaultName: 'Personal Vault', vaultId: 'personal-1' }),
    ];
    const result = await vaultListFolders.handler({}, makeCtx(notes));

    expect(result.success).toBe(true);
    const folders = result.output as Array<{ path: string }> | undefined;
    expect(folders).toBeDefined();
    const paths = (folders as Array<{ path: string }>).map((f) => f.path).sort();
    expect(paths).toEqual(['Journal', 'Projects', 'Projects/Research']);
  });

  it('filters folders by vault_role', async () => {
    const notes = [
      mockNote({ path: 'Work/Note.md', name: 'Note.md', vaultRole: 'personal', vaultName: 'Personal Vault', vaultId: 'personal-1' }),
      mockNote({ path: 'Agents/Obra/SOUL.md', name: 'SOUL.md', vaultRole: 'agent', vaultName: 'Agent Vault', vaultId: 'agent-1' }),
    ];
    const result = await vaultListFolders.handler({ vault_role: 'agent' }, makeCtx(notes));

    expect(result.success).toBe(true);
    const folders = result.output as Array<{ path: string; vaultRole: string }> | undefined;
    expect(folders).toBeDefined();
    const paths = (folders as Array<{ path: string }>).map((f) => f.path).sort();
    expect(paths).toEqual(['Agents', 'Agents/Obra']);
    folders!.forEach((f) => expect(f.vaultRole).toBe('agent'));
  });

  it('returns empty array for empty vault', async () => {
    const result = await vaultListFolders.handler({}, makeCtx([]));

    expect(result.success).toBe(true);
    expect(result.output).toEqual([]);
  });

  it('rejects invalid vault_role with error', async () => {
    const notes = [mockNote({ path: 'Note.md', name: 'Note.md' })];
    const result = await vaultListFolders.handler({ vault_role: 'public' }, makeCtx(notes));

    expect(result.success).toBe(false);
    expect(result.error).toContain('vault_role');
  });

  it('rejects invalid parent_path with validation error', async () => {
    const notes = [mockNote({ path: 'Note.md', name: 'Note.md' })];
    const result = await vaultListFolders.handler({ parent_path: '../outside' }, makeCtx(notes));

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error!.toLowerCase()).toContain('path');
  });

  it('filters folders by parent_path', async () => {
    const notes = [
      mockNote({ path: 'Projects/Research/Paper.md', name: 'Paper.md' }),
      mockNote({ path: 'Projects/Budget.md', name: 'Budget.md' }),
      mockNote({ path: 'Journal/Daily.md', name: 'Daily.md' }),
    ];
    const result = await vaultListFolders.handler({ parent_path: 'Projects/' }, makeCtx(notes));

    expect(result.success).toBe(true);
    const folders = result.output as Array<{ path: string }> | undefined;
    expect(folders).toBeDefined();
    const paths = (folders as Array<{ path: string }>).map((f) => f.path).sort();
    expect(paths).toEqual(['Projects', 'Projects/Research']);
  });

  it('rejects root parent_path after trailing slash normalization', async () => {
    const notes = [mockNote({ path: 'Projects/Budget.md', name: 'Budget.md' })];
    const result = await vaultListFolders.handler({ parent_path: '/' }, makeCtx(notes));

    expect(result.success).toBe(false);
    expect(result.error).toBe('parent_path is required');
  });

  it('registers read-only low-risk metadata', () => {
    const tool = getInternalTool('vault.list_folders');

    expect(tool).toBeDefined();
    expect(tool!.permission).toBe('read-only');
    expect(tool!.risk).toBe('low');
  });

  it('is allowed for an agent in read-only tool mode', () => {
    const tool = getInternalTool('vault.list_folders');
    const agent: Agent = {
      id: 'agent-1',
      name: 'Research Agent',
      role: 'researcher',
      status: 'active',
      skills: [],
      tools: ['vault.list_folders'],
      memory: [],
      permissions: {
        tool_mode: 'read-only',
        write_mode: 'disabled',
      },
    };

    expect(tool).toBeDefined();
    expect(evaluateToolCall(tool!, agent, makeCtx([]))).toEqual({
      decision: 'allow',
      reason: 'Read-only gate allows read tools',
    });
  });
});
