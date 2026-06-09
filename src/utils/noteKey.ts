import type { VaultNote } from '../types';

export function getNoteKey(note: Pick<VaultNote, 'vaultId' | 'path'>): string {
  return `${note.vaultId}:${note.path}`;
}
