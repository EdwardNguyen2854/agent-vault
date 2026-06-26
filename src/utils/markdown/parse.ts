/**
 * Markdown parsing utilities — frontmatter, wikilinks, tags, tasks, headings.
 *
 * This module handles all text-level parsing of vault markdown content.
 * It has no dependencies on other markdown sub-modules.
 */
import type { HeadingItem, TaskItem, VaultNote, WikiLink } from '../../types';
import { getNoteKey } from '../noteKey';
import { titleFromPath, unique } from '../text';

// ---------------------------------------------------------------------------
// Internal regex helpers
// ---------------------------------------------------------------------------

/** Matches inline tags like `#tag`, `#nested/tag`, `#tag-with-dash`. */
const tagRegex = /(^|\s)#([\p{L}\p{N}_/-]+)/gu;

/** Matches ATX headings: `# H1`, `## H2`, …, `###### H6`. */
const headingRegex = /^(#{1,6})\s+(.+)$/;

// ---------------------------------------------------------------------------
// Exported regex (used by render.ts in addition to this module)
// ---------------------------------------------------------------------------

/** Matches [[wiki links]] with optional alias and optional section fragment. */
export const wikiLinkRegex = /\[\[([^\]|#]+(?:#[^\]|]+)?)(?:\|([^\]]+))?\]\]/g;

/** Matches markdown task list items: `- [ ]` or `- [x]` or `- [X]`. */
export const taskRegex = /^\s*-\s+\[([ xX])\]\s+(.+)$/;

// ---------------------------------------------------------------------------
// Frontmatter
// ---------------------------------------------------------------------------

/**
 * Parse YAML frontmatter from markdown content.
 * Returns structured frontmatter (scalars as strings, arrays for YAML lists)
 * and the body text after the frontmatter block.
 */
export function splitFrontmatter(content: string): {
  frontmatter: Record<string, string | string[]>;
  body: string;
} {
  if (!content.startsWith('---\n')) {
    return { frontmatter: {}, body: content };
  }

  const end = content.indexOf('\n---', 4);
  if (end === -1) {
    return { frontmatter: {}, body: content };
  }

  const raw = content.slice(4, end).trim();
  const body = content.slice(end + 4).replace(/^\n/, '');
  const frontmatter: Record<string, string | string[]> = {};

  for (const line of raw.split('\n')) {
    const [key, ...rest] = line.split(':');
    if (!key || rest.length === 0) continue;
    const value = rest.join(':').trim();
    if (value.startsWith('[') && value.endsWith(']')) {
      frontmatter[key.trim()] = value
        .slice(1, -1)
        .split(',')
        .map((item) => item.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean);
    } else {
      frontmatter[key.trim()] = value.replace(/^['"]|['"]$/g, '');
    }
  }

  return { frontmatter, body };
}

/**
 * Convenience: return just the body after frontmatter.
 */
export function getMarkdownBody(content: string): string {
  return splitFrontmatter(content).body;
}

/**
 * Split content into raw frontmatter text and body.
 * Unlike splitFrontmatter, this preserves the raw frontmatter text for reconstruction.
 */
export function splitRawFrontmatter(content: string): {
  rawFrontmatter: string | null;
  body: string;
} {
  if (!content.startsWith('---\n')) {
    return { rawFrontmatter: null, body: content };
  }
  const end = content.indexOf('\n---', 4);
  if (end === -1) {
    return { rawFrontmatter: null, body: content };
  }
  return {
    rawFrontmatter: content.slice(0, end + 4),
    body: content.slice(end + 4),
  };
}

/**
 * Update a single frontmatter field in markdown content.
 * Reconstructs the YAML block so the specified field is set to the given value.
 */
export function updateFrontmatterField(
  content: string,
  field: string,
  value: string | string[] | undefined | null,
): string {
  const { rawFrontmatter, body } = splitRawFrontmatter(content);
  if (!rawFrontmatter) return content;

  const lines = rawFrontmatter.split('\n');
  const fieldKey = field.toLowerCase();
  let found = false;
  const out: string[] = [];

  for (const line of lines) {
    const trimmed = line.trimStart();
    // Skip the opening/closing ---
    if (trimmed === '---') {
      out.push(line);
      continue;
    }
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx !== -1) {
      const key = trimmed.slice(0, colonIdx).trim().toLowerCase();
      if (key === fieldKey) {
        found = true;
        if (value === undefined || value === null) continue; // remove line
        if (Array.isArray(value)) {
          out.push(line.slice(0, line.length - trimmed.length) + `${field}: [${value.join(', ')}]`);
        } else {
          out.push(line.slice(0, line.length - trimmed.length) + `${field}: ${value}`);
        }
        continue;
      }
    }
    out.push(line);
  }

  // Field not found — add it before the closing ---
  if (!found && value !== undefined && value !== null) {
    const closingIdx = out.length - 1;
    if (Array.isArray(value)) {
      out.splice(closingIdx, 0, `${field}: [${value.join(', ')}]`);
    } else {
      out.splice(closingIdx, 0, `${field}: ${value}`);
    }
  }

  return out.join('\n') + body;
}

// ---------------------------------------------------------------------------
// Wiki links
// ---------------------------------------------------------------------------

/**
 * Extract all [[wiki links]] from markdown content.
 */
export function parseWikiLinks(content: string): WikiLink[] {
  const links: WikiLink[] = [];
  for (const match of content.matchAll(wikiLinkRegex)) {
    const rawTarget = match[1]?.trim();
    if (!rawTarget) continue;
    const target = rawTarget.split('#')[0].trim();
    links.push({ raw: match[0], target, alias: match[2]?.trim() });
  }
  return links;
}

// ---------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------

/**
 * Extract tags from both frontmatter and inline `#tag` syntax.
 * Returns a sorted, deduplicated list.
 */
export function parseTags(
  content: string,
  frontmatter: Record<string, string | string[]>,
): string[] {
  const tags: string[] = [];
  const fmTags = frontmatter.tags;

  if (Array.isArray(fmTags)) tags.push(...fmTags);
  if (typeof fmTags === 'string') {
    tags.push(
      ...fmTags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
    );
  }

  for (const match of content.matchAll(tagRegex)) {
    tags.push(match[2]);
  }

  return unique(tags.map((tag) => tag.replace(/^#/, '').trim()).filter(Boolean)).sort((a, b) =>
    a.localeCompare(b),
  );
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

/**
 * Extract task items from markdown content.
 */
export function parseTasks(
  content: string,
  noteKey: string,
  notePath: string,
  noteTitle: string,
): TaskItem[] {
  return content.split('\n').flatMap((line, index) => {
    const match = line.match(taskRegex);
    if (!match) return [];
    const text = match[2].trim();
    const due = text.match(/\bdue:(\d{4}-\d{2}-\d{2})\b/i)?.[1];
    const assignee = text.match(/(^|\s)@([\p{L}\p{N}_-]+)/u)?.[2];
    const tags = Array.from(text.matchAll(tagRegex), (tag) => tag[2]);
    return [
      {
        id: `${noteKey}:${index + 1}`,
        noteKey,
        notePath,
        noteTitle,
        text,
        completed: match[1].toLowerCase() === 'x',
        line: index + 1,
        due,
        assignee,
        tags,
      },
    ];
  });
}

// ---------------------------------------------------------------------------
// Headings
// ---------------------------------------------------------------------------

/**
 * Extract ATX headings from markdown content.
 */
export function parseHeadings(content: string): HeadingItem[] {
  return content.split('\n').flatMap((line, index) => {
    const match = line.match(headingRegex);
    if (!match) return [];
    return [{ level: match[1].length, text: match[2].replace(/#+$/, '').trim(), line: index + 1 }];
  });
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

/**
 * Parse a raw vault note into its full VaultNote shape.
 * Extracts frontmatter, title, wiki links, tags, tasks, and headings.
 */
export function parseNoteContent(
  note: Omit<VaultNote, 'title' | 'links' | 'tags' | 'frontmatter' | 'tasks' | 'headings'>,
): VaultNote {
  const { frontmatter, body } = splitFrontmatter(note.content);
  const firstHeading = body.match(/^#\s+(.+)$/m)?.[1]?.trim();
  const title =
    typeof frontmatter.title === 'string' && frontmatter.title.trim()
      ? frontmatter.title.trim()
      : firstHeading || titleFromPath(note.path);

  return {
    ...note,
    title,
    links: parseWikiLinks(note.content),
    tags: parseTags(note.content, frontmatter),
    frontmatter,
    tasks: parseTasks(note.content, getNoteKey(note), note.path, title),
    headings: parseHeadings(note.content),
  };
}
