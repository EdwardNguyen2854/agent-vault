/**
 * Workspace entity type detection.
 *
 * Determines whether a vault note represents an agent, skill, or tool
 * based on frontmatter type field, path heuristics, and tag signals.
 */
import type { VaultNote } from '../../types';

// ---------------------------------------------------------------------------
// Entity type
// ---------------------------------------------------------------------------

/** The three workspace entity kinds. */
export type WorkspaceEntityType = 'agent' | 'skill' | 'tool';

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

/**
 * Classify a note as an agent, skill, tool, or null.
 *
 * Decision order (highest authority first):
 * 1. Explicit `type` field in frontmatter
 * 2. Path-based heuristics (`/skills/`, `/tools/`, `/agents/`)
 * 3. Tag-based heuristics (`#skill`, `#tool`, `#agent`)
 */
export function getWorkspaceEntityType(note: VaultNote): WorkspaceEntityType | null {
  const type = typeof note.frontmatter.type === 'string' ? note.frontmatter.type.toLowerCase() : '';
  const path = `/${note.path.toLowerCase()}`;
  const tags = note.tags.map((tag) => tag.toLowerCase());

  // ---- 1. Explicit type field (highest authority) ----
  if (type === 'agent') return 'agent';
  if (type === 'skill') return 'skill';
  if (type === 'tool') return 'tool';
  // agent-* sub-types: map the canonical skill/tool variants, ignore the rest
  if (type === 'agent-skills') return 'skill';
  if (type === 'agent-tools') return 'tool';
  // folder-note, agent-memory, agent-soul, agent-user → not a workspace entity
  if (type === 'folder-note' || type.startsWith('agent-')) return null;

  // ---- 2. Path-based heuristics (medium authority) ----
  // Check most specific sub-paths before the broad /agents/ catch-all
  if (path.includes('/skills/')) return 'skill';
  if (path.includes('/tools/')) return 'tool';

  if (path.includes('/agents/')) {
    const segments = path.replace(/\/$/, '').split('/').filter(Boolean);
    const depth = segments.length;
    const stem = segments[depth - 1]?.replace(/\.md$/, '') ?? '';

    // Direct child of /agents/: e.g. /agents/nora.md → treat as agent
    if (depth === 2) {
      const genericNames = ['agents', 'memory', 'user', 'soul', 'skills', 'tools'];
      if (!genericNames.includes(stem)) return 'agent';
      return null;
    }

    // Inside a named subfolder: only agent if filename matches parent folder
    if (depth >= 3) {
      const parentFolder = segments[depth - 2];
      if (stem === parentFolder) return 'agent';
      return null; // support files (SOUL, MEMORY, Skills, Tools) are not agents
    }
  }

  // ---- 3. Tag-based heuristics (lowest authority) ----
  if (['skill', 'skills'].some((t) => tags.includes(t))) return 'skill';
  if (['tool', 'tools'].some((t) => tags.includes(t))) return 'tool';
  if (['agent', 'agents'].some((t) => tags.includes(t))) return 'agent';

  return null;
}

// ---------------------------------------------------------------------------
// Convenience filters
// ---------------------------------------------------------------------------

/** Return only the notes classified as agents. */
export function getAgentNotes(notes: VaultNote[]): VaultNote[] {
  return notes.filter((note) => {
    return getWorkspaceEntityType(note) === 'agent';
  });
}

/** Return notes that have any workspace entity type (agent, skill, or tool). */
export function getWorkspaceEntityNotes(notes: VaultNote[]): VaultNote[] {
  return notes.filter((note) => getWorkspaceEntityType(note) !== null);
}
