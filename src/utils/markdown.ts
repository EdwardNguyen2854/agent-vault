import DOMPurify from 'dompurify';
import { marked } from 'marked';
import type { BacklinkItem, GraphData, HeadingItem, TaskItem, VaultNote, WikiLink } from '../types';
import {
  basename,
  clampText,
  getFolderGroup,
  normalizeKey,
  removeMdExtension,
  titleFromPath,
  unique,
} from './text';
import { getNoteKey } from './noteKey';

const wikiLinkRegex = /\[\[([^\]|#]+(?:#[^\]|]+)?)(?:\|([^\]]+))?\]\]/g;
const tagRegex = /(^|\s)#([\p{L}\p{N}_/-]+)/gu;
const taskRegex = /^\s*-\s+\[([ xX])\]\s+(.+)$/;
const headingRegex = /^(#{1,6})\s+(.+)$/;

marked.setOptions({
  gfm: true,
  breaks: false,
});

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

export function getMarkdownBody(content: string): string {
  return splitFrontmatter(content).body;
}

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

export function parseHeadings(content: string): HeadingItem[] {
  return content.split('\n').flatMap((line, index) => {
    const match = line.match(headingRegex);
    if (!match) return [];
    return [{ level: match[1].length, text: match[2].replace(/#+$/, '').trim(), line: index + 1 }];
  });
}

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

export function resolveLinkTarget(notes: VaultNote[], target: string): VaultNote | undefined {
  const cleanTarget = target.split('#')[0].trim();
  const key = normalizeKey(cleanTarget);
  return notes.find((note) => {
    const pathKey = normalizeKey(note.path);
    const pathNoExtKey = normalizeKey(removeMdExtension(note.path));
    const fileKey = normalizeKey(basename(removeMdExtension(note.path)));
    const titleKey = normalizeKey(note.title);
    return pathKey === key || pathNoExtKey === key || fileKey === key || titleKey === key;
  });
}

export function buildBacklinks(notes: VaultNote[], current: VaultNote): BacklinkItem[] {
  return notes
    .filter((note) => getNoteKey(note) !== getNoteKey(current))
    .map((note) => {
      const matchesCurrent = note.links.some(
        (link) =>
          resolveLinkTarget([current], link.target)?.path === current.path ||
          normalizeKey(link.target) === normalizeKey(current.title),
      );
      if (!matchesCurrent) return null;

      const excerpts = note.content
        .split('\n')
        .filter((line) => line.includes('[['))
        .filter((line) =>
          note.links.some(
            (link) =>
              line.includes(link.raw) &&
              (normalizeKey(link.target) === normalizeKey(current.title) ||
                normalizeKey(link.target) === normalizeKey(removeMdExtension(current.path)) ||
                normalizeKey(link.target) ===
                  normalizeKey(basename(removeMdExtension(current.path)))),
          ),
        )
        .slice(0, 3)
        .map((line) => clampText(line, 180));

      return {
        sourceKey: getNoteKey(note),
        sourcePath: note.path,
        sourceTitle: note.title,
        excerpts,
      };
    })
    .filter(Boolean) as BacklinkItem[];
}

export function buildUnlinkedMentions(notes: VaultNote[], current: VaultNote): BacklinkItem[] {
  const title = current.title.toLowerCase();
  if (title.length < 3) return [];

  return notes
    .filter((note) => getNoteKey(note) !== getNoteKey(current))
    .map((note) => {
      const linked = note.links.some(
        (link) => normalizeKey(link.target) === normalizeKey(current.title),
      );
      if (linked) return null;
      const excerpts = note.content
        .split('\n')
        .filter((line) => line.toLowerCase().includes(title))
        .slice(0, 3)
        .map((line) => clampText(line, 180));
      if (!excerpts.length) return null;
      return {
        sourceKey: getNoteKey(note),
        sourcePath: note.path,
        sourceTitle: note.title,
        excerpts,
      };
    })
    .filter(Boolean) as BacklinkItem[];
}

export function buildGraphData(notes: VaultNote[]): GraphData {
  const nodesById = new Map<string, GraphData['nodes'][number]>();
  const linkPairs = new Set<string>();
  const links: GraphData['links'] = [];

  for (const note of notes) {
    const noteKey = getNoteKey(note);
    nodesById.set(noteKey, {
      id: noteKey,
      name: note.title,
      title: note.title,
      path: note.path,
      group: note.vaultRole === 'personal' ? getFolderGroup(note.path) : note.vaultName,
      value: 1,
      type: 'note',
    });
  }

  for (const note of notes) {
    for (const link of note.links) {
      const targetNote = resolveLinkTarget(notes, link.target);
      const noteKey = getNoteKey(note);
      const targetId = targetNote ? getNoteKey(targetNote) : `missing:${link.target}`;
      if (!nodesById.has(targetId)) {
        nodesById.set(targetId, {
          id: targetId,
          name: link.target,
          title: link.target,
          path: targetId,
          group: 'Missing',
          value: 1,
          type: 'missing',
        });
      }

      const pair = `${noteKey}->${targetId}`;
      if (linkPairs.has(pair)) continue;
      linkPairs.add(pair);
      links.push({ source: noteKey, target: targetId, label: link.raw });
      const sourceNode = nodesById.get(noteKey);
      const targetNode = nodesById.get(targetId);
      if (sourceNode) sourceNode.value += 1;
      if (targetNode) targetNode.value += 2;
    }
  }

  return { nodes: Array.from(nodesById.values()), links };
}

export function getBrokenLinks(notes: VaultNote[]): { source: VaultNote; target: string }[] {
  return notes.flatMap((note) =>
    note.links
      .filter((link) => !resolveLinkTarget(notes, link.target))
      .map((link) => ({ source: note, target: link.target })),
  );
}

export function getOrphanNotes(notes: VaultNote[]): VaultNote[] {
  const graph = buildGraphData(notes);
  const connected = new Set<string>();
  for (const link of graph.links) {
    connected.add(String(link.source));
    connected.add(String(link.target));
  }
  return notes.filter((note) => !connected.has(getNoteKey(note)));
}

export function getAgentNotes(notes: VaultNote[]): VaultNote[] {
  return notes.filter((note) => {
    return getWorkspaceEntityType(note) === 'agent';
  });
}

export type WorkspaceEntityType = 'agent' | 'skill' | 'tool';

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

export function getWorkspaceEntityNotes(notes: VaultNote[]): VaultNote[] {
  return notes.filter((note) => getWorkspaceEntityType(note) !== null);
}

/**
 * Update task completion state in markdown content.
 * @param content - The full note content
 * @param lineNumber - 1-indexed line number of the task
 * @param completed - Whether the task should be marked complete
 * @param fallbackTaskText - Optional task text for fallback search if line number doesn't match
 * @returns Updated content with the task toggled
 */
export function updateTaskCompletion(
  content: string,
  lineNumber: number,
  completed: boolean,
  fallbackTaskText?: string,
): string {
  const lines = content.split('\n');

  // Try line number first (1-indexed)
  if (lineNumber >= 1 && lineNumber <= lines.length) {
    const line = lines[lineNumber - 1];
    const taskRegex = /^(\s*-\s+\[)([ xX])(\]\s+.+)$/;
    const match = line.match(taskRegex);
    if (match) {
      lines[lineNumber - 1] = `${match[1]}${completed ? 'x' : ' '}${match[3]}`;
      return lines.join('\n');
    }
  }

  // Fallback: search by task text
  if (fallbackTaskText) {
    const taskTextLower = fallbackTaskText.toLowerCase();
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const taskRegex = /^(\s*-\s+\[)([ xX])(\]\s+.+)$/;
      const match = line.match(taskRegex);
      if (match && match[3].toLowerCase().includes(taskTextLower)) {
        lines[i] = `${match[1]}${completed ? 'x' : ' '}${match[3]}`;
        return lines.join('\n');
      }
    }
  }

  // No match found, return original content
  return content;
}

export function updateTaskAssignee(
  content: string,
  lineNumber: number,
  agentName: string | null,
  fallbackTaskText?: string,
): string {
  const lines = content.split('\n');
  const taskLineRegex = /^(\s*-\s+\[[ xX]\]\s+)(.+)$/;
  const assigneeRegex = /(^|\s)@([\p{L}\p{N}_-]+)/u;
  const sanitize = (name: string) => name.replace(/[^\p{L}\p{N}_-]/gu, '').trim();

  const rewrite = (index: number, name: string | null) => {
    const original = lines[index];
    const match = original.match(taskLineRegex);
    if (!match) return false;
    const head = match[1];
    const body = match[2];
    const cleaned = body.replace(assigneeRegex, '').replace(/\s+/g, ' ').trimEnd();
    if (name === null) {
      lines[index] = `${head}${cleaned}`;
    } else {
      const safe = sanitize(name);
      if (!safe) return false;
      lines[index] = `${head}${cleaned} @${safe}`;
    }
    return true;
  };

  if (lineNumber >= 1 && lineNumber <= lines.length) {
    if (rewrite(lineNumber - 1, agentName)) return lines.join('\n');
  }

  if (fallbackTaskText) {
    const taskTextLower = fallbackTaskText.toLowerCase();
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.match(taskLineRegex)) continue;
      if (line.toLowerCase().includes(taskTextLower)) {
        if (rewrite(i, agentName)) return lines.join('\n');
      }
    }
  }

  return content;
}

export function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function renderMarkdownToHtml(content: string): string {
  const withWikiAnchors = content.replace(
    wikiLinkRegex,
    (_match, target: string, alias?: string) => {
      const label = alias || target;
      return `<a class="wiki-link" href="#" data-wikilink="${escapeHtmlAttribute(target)}">${escapeHtmlAttribute(label)}</a>`;
    },
  );
  const html = marked.parse(withWikiAnchors, { async: false }) as string;
  return DOMPurify.sanitize(html, {
    ADD_ATTR: ['target', 'data-wikilink'],
    ADD_TAGS: ['iframe'],
  });
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

/** A single block of markdown content for inline editing. */
export interface MarkdownBlock {
  id: number;
  raw: string;
  type: string;
  isEditable: boolean;
}

/**
 * Split markdown body into blocks using marked.lexer().
 * Space tokens (blank lines) are included but marked non-editable.
 */
export function splitMarkdownBody(body: string): MarkdownBlock[] {
  const tokens = marked.lexer(body, { gfm: true });
  return tokens.map((token, index) => ({
    id: index,
    raw: token.raw,
    type: token.type,
    isEditable: token.type !== 'space',
  }));
}

/**
 * Render a single markdown block to HTML (with wiki link support).
 */
export function renderBlockToHtml(raw: string): string {
  const withWikiAnchors = raw.replace(wikiLinkRegex, (_match, target: string, alias?: string) => {
    const label = alias || target;
    return `<a class="wiki-link" href="#" data-wikilink="${escapeHtmlAttribute(target)}">${escapeHtmlAttribute(label)}</a>`;
  });
  const html = marked.parse(withWikiAnchors, { async: false }) as string;
  return DOMPurify.sanitize(html, {
    ADD_ATTR: ['target', 'data-wikilink'],
    ADD_TAGS: ['iframe'],
  });
}

/**
 * Render markdown to HTML for chat messages. Unlike renderMarkdownToHtml, this
 * does not rewrite [[wiki links]] so chat replies don't trigger navigation.
 * GFM features (tables, task lists, fenced code, autolinks) are enabled, and
 * DOMPurify strips any event handlers, scripts, or iframes.
 */
export function renderChatMarkdownToHtml(content: string): string {
  const html = marked.parse(content, { async: false, gfm: true }) as string;
  return DOMPurify.sanitize(html, {
    ADD_ATTR: ['target', 'rel'],
    FORBID_TAGS: ['style', 'script', 'iframe', 'form'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick'],
  });
}
