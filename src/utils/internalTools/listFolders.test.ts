import { describe, it, expect } from 'vitest';
import type { VaultNote, ToolExecutionContext } from '../../types';
import { vaultListFolders } from './listFolders';

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
    const result = await vaultListFolders.handler({ parent_path: 'Projects' }, makeCtx(notes));

    expect(result.success).toBe(true);
    const folders = result.output as Array<{ path: string }> | undefined;
    expect(folders).toBeDefined();
    const paths = (folders as Array<{ path: string }>).map((f) => f.path).sort();
    expect(paths).toEqual(['Projects', 'Projects/Research']);
  });
});
