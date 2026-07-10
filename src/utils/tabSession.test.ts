import { describe, expect, it } from 'vitest';
import type { VaultNote } from '../types';
import {
  buildTabSession,
  isDraftDirty,
  isTabSession,
  pruneMissingTabs,
} from './tabSession';

function note(id: string): VaultNote {
  const [vaultId, ...rest] = id.split(':');
  return {
    vaultId,
    vaultName: vaultId,
    vaultRole: 'personal',
    readOnly: false,
    path: rest.join(':'),
    name: rest.join(':'),
    extension: 'md',
    isBinary: false,
    handle: {} as FileSystemFileHandle,
    updatedAt: 0,
    size: 0,
    title: rest.join(':'),
    content: 'content-' + id,
    links: [],
    tags: [],
    frontmatter: {},
    tasks: [],
    headings: [],
  };
}

describe('tabSession', () => {
  it('builds a session scoped to mounted vaults only', () => {
    const session = buildTabSession({
      order: ['personal-a:a.md', 'agent-b:b.md'],
      activeKey: 'personal-a:a.md',
      drafts: { 'personal-a:a.md': 'edited', 'agent-b:b.md': 'edited-b' },
      notes: [note('personal-a:a.md'), note('agent-b:b.md')],
      mountedVaults: [
        { id: 'personal-a', role: 'personal' },
        { id: 'agent-b', role: 'agent' },
      ],
    });
    expect(session.version).toBe(1);
    expect(session.order).toEqual(['personal-a:a.md', 'agent-b:b.md']);
    expect(session.activeKey).toBe('personal-a:a.md');
    expect(session.vaultIds).toEqual(['agent-b', 'personal-a']);
  });

  it('drops tabs whose vault is no longer mounted', () => {
    const session = buildTabSession({
      order: ['personal-a:a.md', 'agent-b:b.md'],
      drafts: { 'personal-a:a.md': 'edited', 'agent-b:b.md': 'edited-b' },
      notes: [note('personal-a:a.md'), note('agent-b:b.md')],
      mountedVaults: [{ id: 'personal-a', role: 'personal' }],
    });
    expect(session.order).toEqual(['personal-a:a.md']);
    expect(session.drafts).toEqual({ 'personal-a:a.md': 'edited' });
    expect(session.activeKey).toBeUndefined();
  });

  it('pruneMissingTabs strips dangling drafts', () => {
    const notes = [note('personal-a:a.md')];
    const result = pruneMissingTabs(
      ['personal-a:a.md', 'personal-a:gone.md'],
      {
        'personal-a:a.md': 'edit-a',
        'personal-a:gone.md': 'edit-gone',
      },
      notes,
    );
    expect(result.order).toEqual(['personal-a:a.md']);
    expect(result.drafts).toEqual({ 'personal-a:a.md': 'edit-a' });
  });

  it('isDraftDirty compares draft to saved content', () => {
    const saved = note('personal-a:a.md');
    expect(isDraftDirty(undefined, saved)).toBe(false);
    expect(isDraftDirty('content-personal-a:a.md', saved)).toBe(false);
    expect(isDraftDirty('changed', saved)).toBe(true);
  });

  it('isTabSession rejects malformed payloads', () => {
    expect(isTabSession(null)).toBe(false);
    expect(isTabSession({ version: 1, order: [], drafts: {}, vaultIds: [] })).toBe(true);
    expect(isTabSession({ version: 2, order: [], drafts: {}, vaultIds: [] })).toBe(false);
    expect(isTabSession({ version: 1, order: 'not-array', drafts: {}, vaultIds: [] })).toBe(
      false,
    );
    expect(isTabSession({ version: 1, order: ['bad-key'], drafts: {}, vaultIds: [] })).toBe(
      false,
    );
  });
});