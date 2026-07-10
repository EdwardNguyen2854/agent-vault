/**
 * Tab session management.
 *
 * Tabs persist the order of open notes and their per-tab drafts in
 * `localStorage`, scoped by the mounted vault set so that tabs belonging
 * to unrelated vaults are filtered out on restore.
 *
 * Dirty state is always derived from `drafts[key] !== note.content`; this
 * module never persists an independent dirty flag.
 */

import type { VaultNote } from '../types';
import { getNoteKey } from './noteKey';

export const TAB_SESSION_STORAGE_KEY = 'agentVault.tabSession.v1';

export interface TabSession {
  version: 1;
  /** Note keys currently mounted in the session, in display order. */
  order: string[];
  /** Currently selected note key, if any. */
  activeKey?: string;
  /** Map of note key to draft content for unsaved edits. */
  drafts: Record<string, string>;
  /** Sorted list of vault IDs that contributed to this session. */
  vaultIds: string[];
}

export interface MountedVault {
  id: string;
  role: 'agent' | 'personal' | 'shared';
}

function isNoteKey(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]+:.+/.test(value);
}

export function isTabSession(value: unknown): value is TabSession {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  if (candidate.version !== 1) return false;
  if (!Array.isArray(candidate.order)) return false;
  if (!candidate.order.every(isNoteKey)) return false;
  if (candidate.activeKey !== undefined && !isNoteKey(candidate.activeKey)) return false;
  if (
    !candidate.drafts ||
    typeof candidate.drafts !== 'object' ||
    Array.isArray(candidate.drafts)
  ) {
    return false;
  }
  const drafts = candidate.drafts as Record<string, unknown>;
  for (const value of Object.values(drafts)) {
    if (typeof value !== 'string') return false;
  }
  if (!Array.isArray(candidate.vaultIds)) return false;
  if (!candidate.vaultIds.every((id) => typeof id === 'string' && id.length > 0)) {
    return false;
  }
  return true;
}

export function loadTabSession(): TabSession | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(TAB_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isTabSession(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveTabSession(session: TabSession): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(TAB_SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // localStorage may be full or unavailable; silently ignore.
  }
}

export function clearTabSession(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(TAB_SESSION_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Build a TabSession for a set of tabs and notes.
 */
export function buildTabSession(input: {
  order: string[];
  activeKey?: string;
  drafts: Record<string, string>;
  notes: VaultNote[];
  mountedVaults: MountedVault[];
}): TabSession {
  const mountedIds = new Set(input.mountedVaults.map((vault) => vault.id));
  const allowedVaults = new Set(input.mountedVaults.map((vault) => vault.id));
  const order = input.order.filter((key) => {
    const vaultId = key.split(':', 1)[0];
    return vaultId && mountedIds.has(vaultId);
  });

  const drafts: Record<string, string> = {};
  for (const key of order) {
    const draft = input.drafts[key];
    if (typeof draft === 'string') drafts[key] = draft;
  }

  return {
    version: 1,
    order,
    activeKey:
      input.activeKey && order.includes(input.activeKey) ? input.activeKey : undefined,
    drafts,
    vaultIds: [...allowedVaults].sort(),
  };
}

/**
 * Determine if a draft differs from the saved note content.
 */
export function isDraftDirty(draft: string | undefined, note?: VaultNote): boolean {
  if (!note) return Boolean(draft && draft.length > 0);
  if (draft === undefined) return false;
  return draft !== note.content;
}

/**
 * Strip tabs whose underlying note no longer exists in the provided notes list.
 */
export function pruneMissingTabs(
  order: string[],
  drafts: Record<string, string>,
  notes: VaultNote[],
): { order: string[]; drafts: Record<string, string> } {
  const valid = new Set(notes.map((note) => getNoteKey(note)));
  const nextOrder = order.filter((key) => valid.has(key));
  const nextDrafts: Record<string, string> = {};
  for (const key of nextOrder) {
    if (drafts[key] !== undefined) nextDrafts[key] = drafts[key];
  }
  return { order: nextOrder, drafts: nextDrafts };
}