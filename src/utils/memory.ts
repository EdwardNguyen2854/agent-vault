import type { Memory, MemoryType, VaultNote } from '../types';
import { getNoteKey } from './noteKey';
import { normalizeVaultPath } from './paths';
import type { MemorySettings } from './settings';
import { canWriteVaultNote } from './vault';

const memoryFolderByType: Record<MemoryType, string> = {
  agent: 'Agents',
  team: 'Team',
  project: 'Projects',
  user: 'User',
  skill: 'Skills',
  tool: 'Tools',
  decision: 'Decisions',
  run: 'Runs',
};

const validMemoryTypes: MemoryType[] = [
  'agent',
  'team',
  'project',
  'user',
  'skill',
  'tool',
  'decision',
  'run',
];
const validMemoryStatuses: Array<Memory['status']> = ['active', 'inactive', 'archived'];

export interface MemoryNoteMetadata {
  isMemory: boolean;
  memoryType: MemoryType;
  target?: string;
  status: Memory['status'];
  vaultRole: VaultNote['vaultRole'];
  readOnly: boolean;
  writable: boolean;
}

function getFrontmatterString(note: VaultNote, key: string): string {
  const value = note.frontmatter[key];
  return typeof value === 'string' ? value.trim() : '';
}

export function normalizeMemoryStatus(value: unknown): Memory['status'] {
  const status = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return validMemoryStatuses.includes(status as Memory['status'])
    ? (status as Memory['status'])
    : 'active';
}

export function isActiveMemoryNote(note: VaultNote): boolean {
  return getMemoryMetadata(note).isMemory && getMemoryMetadata(note).status === 'active';
}

/**
 * Detects if a note is a memory note by:
 * - Path contains /Memory/
 * - frontmatter.type === 'memory'
 * - Has #memory tag
 */
export function isMemoryNote(note: VaultNote): boolean {
  const path = `/${note.path.toLowerCase()}`;
  if (
    path.includes('/memory/') ||
    path.includes('/agent-memory') ||
    path.includes('/user-memory') ||
    path.includes('/team-memory')
  )
    return true;

  const type = getFrontmatterString(note, 'type').toLowerCase();
  if (type === 'memory' || type === 'agent-memory' || type === 'agent-user') return true;

  const tags = note.tags.map((t) => t.toLowerCase());
  if (tags.includes('memory')) return true;

  return false;
}

/**
 * Extracts the memory_type from frontmatter.
 * Defaults to 'user' if not specified.
 */
export function getMemoryType(note: VaultNote): MemoryType {
  const memoryType = getFrontmatterString(note, 'memory_type').toLowerCase();
  if (validMemoryTypes.includes(memoryType as MemoryType)) {
    return memoryType as MemoryType;
  }
  const type = getFrontmatterString(note, 'type').toLowerCase();
  const path = `/${note.path.toLowerCase()}`;
  if (type === 'agent-memory') return 'agent';
  if (type === 'agent-user') return 'user';
  if (path.includes('/memory/agents/') || path.includes('/agent-memory')) return 'agent';
  if (path.includes('/memory/team/') || path.includes('/team-memory')) return 'team';
  if (
    path.includes('/memory/projects/') ||
    path.includes('/project-memory') ||
    path.includes('/project memory')
  )
    return 'project';
  if (path.includes('/memory/skills/')) return 'skill';
  if (path.includes('/memory/tools/')) return 'tool';
  if (path.includes('/memory/decisions/')) return 'decision';
  if (path.includes('/memory/runs/')) return 'run';
  if (path.includes('/memory/user/') || path.includes('/user-memory')) return 'user';
  return 'user';
}

/**
 * Gets the target name (agent/project/skill) from frontmatter.
 * Checks frontmatter.target, frontmatter.agent, frontmatter.project, frontmatter.skill.
 */
export function getMemoryTarget(note: VaultNote): string | null {
  const explicitTarget = getFrontmatterString(note, 'target');
  if (explicitTarget) return stripWikiLink(explicitTarget);
  const agent = getFrontmatterString(note, 'agent');
  if (agent) return stripWikiLink(agent);
  const project = getFrontmatterString(note, 'project');
  if (project) return stripWikiLink(project);
  const skill = getFrontmatterString(note, 'skill');
  if (skill) return stripWikiLink(skill);
  return null;
}

export function getMemoryMetadata(note: VaultNote): MemoryNoteMetadata {
  return {
    isMemory: isMemoryNote(note),
    memoryType: getMemoryType(note),
    target: getMemoryTarget(note) ?? undefined,
    status: normalizeMemoryStatus(note.frontmatter.status),
    vaultRole: note.vaultRole,
    readOnly: note.readOnly,
    writable: canWriteVaultNote(note),
  };
}

export function memoryMatchesTarget(note: VaultNote, target?: string | null): boolean {
  if (!target?.trim()) return false;
  const noteTarget = getMemoryTarget(note);
  if (!noteTarget) return false;
  return normalizeMemoryTarget(noteTarget) === normalizeMemoryTarget(target);
}

export function canAppendToMemoryNote(note?: VaultNote | null): boolean {
  return Boolean(note && isMemoryNote(note) && canWriteVaultNote(note));
}

/**
 * Filters and converts vault notes to Memory objects.
 */
export function getMemoriesFromNotes(notes: VaultNote[]): Memory[] {
  return notes.filter(isMemoryNote).map((note) => {
    const metadata = getMemoryMetadata(note);
    const backlinks = notes.filter((n) =>
      n.links.some((link) => {
        const target = link.target.split('#')[0].trim();
        return (
          target.toLowerCase() === note.title.toLowerCase() ||
          target.toLowerCase() === note.path.toLowerCase()
        );
      }),
    );

    return {
      id: getNoteKey(note),
      title: note.title,
      memoryType: metadata.memoryType,
      target: metadata.target,
      status: metadata.status,
      path: note.path,
      links: backlinks.map((n) => getNoteKey(n)),
      content: note.content,
      createdAt: note.frontmatter.created
        ? new Date(note.frontmatter.created as string).getTime()
        : undefined,
      updatedAt: note.updatedAt,
      vaultRole: metadata.vaultRole,
      readOnly: metadata.readOnly,
      writable: metadata.writable,
    };
  });
}

/**
 * Gets memories for a specific agent.
 */
export function getAgentMemory(agentName: string, notes: VaultNote[]): Memory[] {
  const memories = getMemoriesFromNotes(notes);
  return memories.filter((m) => {
    if (m.memoryType !== 'agent') return false;
    if (!m.target) return false;
    return m.target.toLowerCase() === agentName.toLowerCase();
  });
}

/**
 * Gets memories for a specific project.
 */
export function getProjectMemory(projectName: string, notes: VaultNote[]): Memory[] {
  const memories = getMemoriesFromNotes(notes);
  return memories.filter((m) => {
    if (m.memoryType !== 'project') return false;
    if (!m.target) return false;
    return m.target.toLowerCase() === projectName.toLowerCase();
  });
}

/**
 * Gets all user memories.
 */
export function getUserMemories(notes: VaultNote[]): Memory[] {
  const memories = getMemoriesFromNotes(notes);
  return memories.filter((m) => m.memoryType === 'user');
}

/**
 * Gets all team memories.
 */
export function getTeamMemories(notes: VaultNote[]): Memory[] {
  const memories = getMemoriesFromNotes(notes);
  return memories.filter((m) => m.memoryType === 'team');
}

/**
 * Gets memories for a specific skill.
 */
export function getSkillMemories(skillName: string, notes: VaultNote[]): Memory[] {
  const memories = getMemoriesFromNotes(notes);
  return memories.filter((m) => {
    if (m.memoryType !== 'skill') return false;
    if (!m.target) return false;
    return m.target.toLowerCase() === skillName.toLowerCase();
  });
}

/**
 * Gets all decision memories.
 */
export function getDecisionMemories(notes: VaultNote[]): Memory[] {
  const memories = getMemoriesFromNotes(notes);
  return memories.filter((m) => m.memoryType === 'decision');
}

/**
 * Gets all tool memories.
 */
export function getToolMemories(notes: VaultNote[]): Memory[] {
  const memories = getMemoriesFromNotes(notes);
  return memories.filter((m) => m.memoryType === 'tool');
}

/**
 * Gets all run memories.
 */
export function getRunMemories(notes: VaultNote[]): Memory[] {
  const memories = getMemoriesFromNotes(notes);
  return memories.filter((m) => m.memoryType === 'run');
}

/**
 * Generates markdown content for saving to a memory note.
 * If existingMemory is provided, appends to that note's content.
 * Otherwise creates a new note structure.
 */
export function saveToMemory(
  content: string,
  memoryType: MemoryType,
  target?: string,
  existingMemory?: Memory,
): string {
  const timestamp = new Date().toISOString().split('T')[0];

  if (existingMemory) {
    // Append to existing memory content
    return `\n\n---\n\n**Saved:** ${timestamp}\n\n${content}`;
  }

  // Generate new memory note content
  const targetField = target ? `\ntarget: ${target}` : '';
  const targetTitle = target ? ` - ${target}` : '';

  const sections: Record<MemoryType, string> = {
    agent: `## Role

## Operating Rules

## User Preferences

## Learned Notes

## Do Not Do

## Related Skills

## Related Tools`,
    project: `## Project Goal

## Key Decisions

## Progress Notes

## Blockers

## Next Steps`,
    user: `## Preferences

## Habits

## Feedback

## Notes`,
    team: `## Shared Preferences

## Working Agreements

## Durable Facts

## Open Questions`,
    skill: `## What Works

## Gotchas

## Examples

## Related Tools`,
    tool: `## Purpose

## Usage Patterns

## Limitations

## Alternatives`,
    decision: `## Context

## Options Considered

## Decision

## Rationale

## Consequences`,
    run: `## Summary

## What Happened

## What Went Well

## What Could Improve

## Next Steps`,
  };

  return `---
type: memory
memory_type: ${memoryType}${targetField}
status: active
created: ${timestamp}
---

# ${memoryType.charAt(0).toUpperCase() + memoryType.slice(1)} Memory${targetTitle}

${sections[memoryType]}

---

**Saved:** ${timestamp}

${content}`;
}

/**
 * Gets the folder path for a memory type.
 */
export function getMemoryFolder(memoryType: MemoryType): string {
  return `Memory/${memoryFolderByType[memoryType]}`;
}

export function getConfiguredMemoryFolder(
  memoryType: MemoryType,
  settings?: Pick<MemorySettings, 'saveLocation' | 'folderPath'>,
): string {
  const raw = settings?.saveLocation?.trim() || settings?.folderPath?.trim();
  if (!raw) return getMemoryFolder(memoryType);
  const normalized = normalizeVaultPath(raw);
  if (
    !normalized ||
    normalized === '.' ||
    normalized.startsWith('../') ||
    normalized.includes('/../')
  ) {
    return getMemoryFolder(memoryType);
  }
  return normalized;
}

/**
 * Gets the suggested filename for a new memory note.
 */
export function getMemoryFileName(memoryType: MemoryType, target?: string): string {
  const timestamp = new Date().toISOString().split('T')[0];
  if (target) {
    return `${sanitizeFileName(target)} Memory ${timestamp}.md`;
  }
  return `${memoryType.charAt(0).toUpperCase() + memoryType.slice(1)} Memory ${timestamp}.md`;
}

/**
 * Builds the full path for a memory note.
 */
export function getMemoryPath(memoryType: MemoryType, target?: string): string {
  const folder = getMemoryFolder(memoryType);
  const fileName = getMemoryFileName(memoryType, target);
  return `${folder}/${fileName}`;
}

export function getConfiguredMemoryPath(
  memoryType: MemoryType,
  target?: string,
  settings?: Pick<MemorySettings, 'saveLocation' | 'folderPath'>,
): string {
  return `${getConfiguredMemoryFolder(memoryType, settings)}/${getMemoryFileName(memoryType, target)}`;
}

export function getUniqueMemoryPath(
  notes: VaultNote[],
  memoryType: MemoryType,
  target?: string,
  settings?: Pick<MemorySettings, 'saveLocation' | 'folderPath'>,
): string {
  const folder = getConfiguredMemoryFolder(memoryType, settings);
  const fileName = getMemoryFileName(memoryType, target);
  const dotIndex = fileName.toLowerCase().endsWith('.md') ? fileName.length - 3 : fileName.length;
  const baseName = fileName.slice(0, dotIndex);
  const extension = fileName.slice(dotIndex) || '.md';
  const existingPaths = new Set(notes.map((note) => normalizeVaultPath(note.path).toLowerCase()));
  let candidate = normalizeVaultPath(`${folder}/${fileName}`);
  let index = 2;
  while (existingPaths.has(candidate.toLowerCase())) {
    candidate = normalizeVaultPath(`${folder}/${baseName} ${index}${extension}`);
    index += 1;
  }
  return candidate;
}

/**
 * Gets memory note template content for a specific type.
 */
export function getMemoryTemplate(memoryType: MemoryType, target?: string): string {
  return saveToMemory('', memoryType, target);
}

function sanitizeFileName(input: string): string {
  return (
    input
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80) || 'Memory'
  );
}

function stripWikiLink(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/^\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|([^\]]+))?\]\]$/);
  return (match?.[2] ?? match?.[1] ?? trimmed).trim();
}

function normalizeMemoryTarget(input: string): string {
  return stripWikiLink(input).replace(/\.md$/i, '').trim().toLowerCase();
}
