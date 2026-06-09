import type { Skill, VaultNote } from '../types';
import { getNoteKey } from './noteKey';
import { buildBacklinks, getWorkspaceEntityType } from './markdown';
import { basename, titleFromPath } from './text';

/**
 * Check if a note is a skill based on detection logic.
 */
export function isSkillNote(note: VaultNote): boolean {
  const type = typeof note.frontmatter.type === 'string' ? note.frontmatter.type.toLowerCase() : '';
  const path = `/${note.path.toLowerCase()}`;
  const tags = note.tags.map((tag) => tag.toLowerCase());

  return type === 'skill' || path.includes('/skills/') || tags.includes('skill');
}

/**
 * Parse a skill folder path to extract the skill name.
 * Expected format: /path/to/Skills/<skill-name>/SKILL.md
 */
export function parseSkillFolder(skillPath: string): Skill | null {
  const path = skillPath.toLowerCase();
  const skillsMatch = path.match(/\/skills\/([^\/]+)/);
  if (!skillsMatch) return null;

  const folderName = skillsMatch[1];
  const folderPath = skillPath.substring(
    0,
    skillPath.lastIndexOf('/' + folderName) + (folderName.length + 1),
  );

  return {
    id: folderName,
    name: folderName,
    description: '',
    folderPath,
    skillFilePath: skillPath,
    status: 'inactive',
    tools: [],
    memory: [],
    tags: [],
  };
}

/**
 * Load skill metadata from a skill note.
 */
export function loadSkillMetadata(skillNote: VaultNote): Skill {
  const path = skillNote.path;
  const pathLower = path.toLowerCase();
  const skillsMatch = pathLower.match(/\/skills\/([^\/]+)/);
  const folderName = skillsMatch?.[1] || titleFromPath(path);

  const name =
    typeof skillNote.frontmatter.name === 'string' && skillNote.frontmatter.name
      ? skillNote.frontmatter.name
      : folderName;

  const description =
    typeof skillNote.frontmatter.description === 'string' && skillNote.frontmatter.description
      ? skillNote.frontmatter.description
      : extractDescription(skillNote.content);

  const status = parseStatus(skillNote.frontmatter.status);

  const tools = Array.isArray(skillNote.frontmatter.tools)
    ? skillNote.frontmatter.tools
    : typeof skillNote.frontmatter.tools === 'string'
      ? skillNote.frontmatter.tools.split(',').map((t: string) => t.trim())
      : [];

  const memory = Array.isArray(skillNote.frontmatter.memory)
    ? skillNote.frontmatter.memory
    : typeof skillNote.frontmatter.memory === 'string'
      ? skillNote.frontmatter.memory.split(',').map((m: string) => m.trim())
      : [];

  const tags = Array.isArray(skillNote.frontmatter.tags)
    ? skillNote.frontmatter.tags
    : typeof skillNote.frontmatter.tags === 'string'
      ? skillNote.frontmatter.tags.split(',').map((t: string) => t.trim())
      : [...skillNote.tags];

  const version =
    typeof skillNote.frontmatter.version === 'string' ? skillNote.frontmatter.version : undefined;
  const author =
    typeof skillNote.frontmatter.author === 'string' ? skillNote.frontmatter.author : undefined;

  const folderPath = path.substring(
    0,
    path.lastIndexOf('/' + folderName) + (folderName.length + 1),
  );

  return {
    id: folderName,
    name,
    description,
    folderPath,
    skillFilePath: path,
    status,
    tools,
    memory,
    tags,
    version,
    author,
    updatedAt: skillNote.updatedAt,
  };
}

/**
 * Validate skill structure.
 */
export function validateSkillStructure(skill: Skill): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!skill.name || skill.name.trim() === '') {
    errors.push('Skill name is required');
  }

  if (!skill.folderPath || !skill.folderPath.toLowerCase().includes('/skills/')) {
    errors.push('Skill must be in a /Skills/ folder');
  }

  if (!skill.skillFilePath.endsWith('/SKILL.md') && !skill.skillFilePath.endsWith('\\SKILL.md')) {
    errors.push('Skill must have a SKILL.md file');
  }

  if (skill.status === 'error') {
    errors.push('Skill has error status');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get all skills from notes array.
 */
export function getSkillsFromNotes(notes: VaultNote[]): Skill[] {
  return notes.filter(isSkillNote).map(loadSkillMetadata);
}

/**
 * Get notes that link to a skill (related agents).
 */
export function getRelatedAgentsForSkill(skill: Skill, notes: VaultNote[]): VaultNote[] {
  const skillTitle = skill.name.toLowerCase();
  const skillPath = skill.folderPath.toLowerCase();

  return notes.filter((note) => {
    if (getWorkspaceEntityType(note) !== 'agent') return false;

    // Check if the note links to this skill
    const linksToSkill = note.links.some((link) => {
      const target = link.target.toLowerCase();
      return (
        target === skillTitle ||
        target === skill.id.toLowerCase() ||
        note.path.toLowerCase().includes(skillPath)
      );
    });

    if (linksToSkill) return true;

    // Check backlinks
    const backlinks = buildBacklinks(notes, note);
    return backlinks.some(
      (bl) =>
        bl.sourceTitle.toLowerCase().includes(skillTitle) ||
        bl.sourcePath.toLowerCase().includes(skillPath),
    );
  });
}

/**
 * Get notes that represent tools related to a skill.
 */
export function getRelatedToolsForSkill(skill: Skill, notes: VaultNote[]): VaultNote[] {
  const skillTools = skill.tools.map((t) => t.toLowerCase());

  return notes.filter((note) => {
    if (getWorkspaceEntityType(note) !== 'tool') return false;

    // Check if tool is in skill's tools list
    const toolName = ((note.frontmatter.name as string) || note.title || '').toLowerCase();
    if (skillTools.some((st) => toolName.includes(st) || st.includes(toolName))) {
      return true;
    }

    // Check if note links to this skill
    return note.links.some((link) => {
      const target = link.target.toLowerCase();
      return target === skill.name.toLowerCase() || target === skill.id.toLowerCase();
    });
  });
}

/**
 * Extract description from note content (first non-heading, non-empty line).
 */
function extractDescription(content: string): string {
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (
      trimmed &&
      !trimmed.startsWith('#') &&
      !trimmed.startsWith('---') &&
      !trimmed.startsWith('[[')
    ) {
      return trimmed;
    }
  }
  return '';
}

/**
 * Parse status from frontmatter value.
 */
function parseStatus(status: string | string[] | undefined): 'active' | 'inactive' | 'error' {
  if (!status) return 'inactive';
  const s = typeof status === 'string' ? status.toLowerCase() : '';
  if (s === 'active') return 'active';
  if (s === 'error') return 'error';
  return 'inactive';
}

/**
 * Get the last used date for a skill based on related notes.
 */
export function getSkillLastUsed(skill: Skill, notes: VaultNote[]): Date | null {
  const relatedAgents = getRelatedAgentsForSkill(skill, notes);
  if (relatedAgents.length === 0) return null;

  let latestDate: Date | null = null;
  for (const agent of relatedAgents) {
    const agentDate = new Date(agent.updatedAt);
    if (!latestDate || agentDate > latestDate) {
      latestDate = agentDate;
    }
  }
  return latestDate;
}
