import type { AgentContext, AgentContextItem, ContextSettings, VaultNote } from '../types';
import type { UIContextSettings } from './settings';
import { getNoteKey } from './noteKey';
import { buildBacklinks, resolveLinkTarget } from './markdown/graph';
import { getMarkdownBody } from './markdown/parse';
import { getWorkspaceEntityType } from './markdown/entity';
import { basename, normalizeKey, removeMdExtension } from './text';
import { getAllTools } from './tools';
import { getMemoryMetadata, isMemoryNote, memoryMatchesTarget } from './memory';

// =============================================================================
// Context Builder
// =============================================================================

export interface ContextBuilder {
  config: ContextSettings;
  currentNote: VaultNote;
  notes: VaultNote[];
  selectedAgent: VaultNote | null;
  selectedSkill: VaultNote | null;
}

const TRUNCATION_MARKER = '\n\n[Context truncated to fit the configured token budget.]';
export const AGENT_CONTEXT_OVERRIDES_KEY = 'agent-vault-agent-context-overrides';

export interface AgentContextOverride {
  disabledItemKeys: string[];
  updatedAt: number;
}

export type AgentContextOverrides = Record<string, AgentContextOverride>;

function estimateItemTokens(
  item: Pick<AgentContextItem, 'type' | 'title' | 'path' | 'content'>,
): number {
  const header = item.path
    ? `## [${item.type.toUpperCase()}] ${item.title} (${item.path})`
    : `## [${item.type.toUpperCase()}] ${item.title}`;
  return Math.ceil((header.length + item.content.length) / 4);
}

export function estimateContextItemTokens(
  item: Pick<AgentContextItem, 'type' | 'title' | 'path' | 'content'>,
): number {
  return estimateItemTokens(item);
}

export function buildContextSettingsFromUI(
  settings: UIContextSettings,
  options: {
    includeCurrentNote?: boolean;
    includeSkill?: boolean;
    maxNotes?: number;
  } = {},
): ContextSettings {
  return {
    include_current_note: Boolean(options.includeCurrentNote),
    include_selected_text: false,
    include_outgoing_links: settings.defaultDepth >= 1,
    include_backlinks: settings.includeBacklinks,
    include_agent_memory: settings.includeMemory,
    include_team_memory: settings.includeMemory,
    include_user_memory: settings.includeMemory,
    include_project_memory: settings.includeMemory,
    include_skill: Boolean(options.includeSkill),
    include_tools: settings.includeTools,
    graph_depth: settings.defaultDepth,
    max_notes: options.maxNotes ?? 20,
    max_tokens: settings.maxContextSize,
    rag_fallback: false,
  };
}

export function getContextItemKey(item: Pick<AgentContextItem, 'type' | 'id'>): string {
  return `${item.type}:${item.id}`;
}

export function loadAgentContextOverrides(): AgentContextOverrides {
  try {
    const raw = localStorage.getItem(AGENT_CONTEXT_OVERRIDES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const overrides: AgentContextOverrides = {};
    for (const [agentKey, value] of Object.entries(parsed)) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
      const record = value as { disabledItemKeys?: unknown; updatedAt?: unknown };
      overrides[agentKey] = {
        disabledItemKeys: Array.isArray(record.disabledItemKeys)
          ? record.disabledItemKeys.filter((key): key is string => typeof key === 'string')
          : [],
        updatedAt: typeof record.updatedAt === 'number' ? record.updatedAt : 0,
      };
    }
    return overrides;
  } catch {
    return {};
  }
}

export function saveAgentContextOverrides(overrides: AgentContextOverrides): void {
  try {
    localStorage.setItem(AGENT_CONTEXT_OVERRIDES_KEY, JSON.stringify(overrides));
  } catch {}
}

export function setAgentContextItemDisabled(
  overrides: AgentContextOverrides,
  agentKey: string,
  itemKey: string,
  disabled: boolean,
): AgentContextOverrides {
  const current = overrides[agentKey]?.disabledItemKeys ?? [];
  const disabledKeys = new Set(current);
  if (disabled) {
    disabledKeys.add(itemKey);
  } else {
    disabledKeys.delete(itemKey);
  }
  return {
    ...overrides,
    [agentKey]: {
      disabledItemKeys: Array.from(disabledKeys).sort(),
      updatedAt: Date.now(),
    },
  };
}

export function filterContextItemsForAgent(
  items: AgentContextItem[],
  agentKey: string | null | undefined,
  overrides: AgentContextOverrides = loadAgentContextOverrides(),
  requiredItemKeys: Set<string> = new Set(),
): AgentContextItem[] {
  if (!agentKey) return items;
  const disabled = new Set(overrides[agentKey]?.disabledItemKeys ?? []);
  return items.filter((item) => {
    const itemKey = getContextItemKey(item);
    if (requiredItemKeys.has(itemKey)) return true;
    return !disabled.has(itemKey);
  });
}

function createNoteItem(
  type: AgentContextItem['type'],
  note: VaultNote,
  weight: number,
): AgentContextItem {
  return {
    type,
    id: getNoteKey(note),
    title: note.title,
    path: note.path,
    content: getMarkdownBody(note.content),
    weight,
  };
}

function pushUniqueItem(
  items: AgentContextItem[],
  seen: Set<string>,
  item: AgentContextItem,
): boolean {
  const key = `${item.type}:${item.id}`;
  if (seen.has(key)) return false;
  seen.add(key);
  items.push(item);
  return true;
}

function pushUniqueNote(
  notes: VaultNote[],
  seen: Set<string>,
  note: VaultNote,
  maxNotes: number,
): boolean {
  if (notes.length >= maxNotes) return false;
  const key = getNoteKey(note);
  if (seen.has(key)) return false;
  seen.add(key);
  notes.push(note);
  return true;
}

function getFrontmatterString(note: VaultNote, key: string): string {
  const value = note.frontmatter[key];
  return typeof value === 'string' ? value : '';
}

function isDefaultContextMemory(note: VaultNote): boolean {
  const metadata = getMemoryMetadata(note);
  return metadata.isMemory && metadata.status === 'active';
}

function memoryToContextMemory(
  note: VaultNote,
  fallbackType: 'agent' | 'team' | 'project' | 'user',
  fallbackTarget?: string,
) {
  const metadata = getMemoryMetadata(note);
  return {
    id: getNoteKey(note),
    title: note.title,
    memoryType:
      metadata.memoryType === 'agent' ||
      metadata.memoryType === 'team' ||
      metadata.memoryType === 'project' ||
      metadata.memoryType === 'user'
        ? metadata.memoryType
        : fallbackType,
    target: metadata.target ?? fallbackTarget,
    status: metadata.status,
    path: note.path,
    links: note.links.map((l) => l.target),
    content: getMarkdownBody(note.content),
    vaultRole: metadata.vaultRole,
    readOnly: metadata.readOnly,
    writable: metadata.writable,
    createdAt: note.updatedAt,
    updatedAt: note.updatedAt,
  };
}

function getActiveProjectTarget(currentNote: VaultNote | null): string | null {
  if (!currentNote) return null;
  const target =
    getFrontmatterString(currentNote, 'target') || getFrontmatterString(currentNote, 'project');
  if (target) return target;
  if (
    getFrontmatterString(currentNote, 'type').toLowerCase() === 'project' ||
    currentNote.path.toLowerCase().includes('/projects/')
  )
    return currentNote.title;
  return null;
}

function truncateItemToTokens(item: AgentContextItem, maxTokens: number): AgentContextItem | null {
  if (maxTokens <= 0) return null;
  const markerTokens = Math.ceil(TRUNCATION_MARKER.length / 4);
  const headerTokens = estimateItemTokens({ ...item, content: '' });
  const contentTokens = maxTokens - headerTokens - markerTokens;
  if (contentTokens <= 0) return null;
  const maxChars = contentTokens * 4;
  const content =
    item.content.length > maxChars
      ? `${item.content.slice(0, Math.max(0, maxChars)).trimEnd()}${TRUNCATION_MARKER}`
      : item.content;
  return { ...item, content };
}

function applyContextBudget(items: AgentContextItem[], maxTokens: number): AgentContextItem[] {
  if (maxTokens <= 0) return items;

  const ordered = [...items].sort((a, b) => b.weight - a.weight);
  const finalItems: AgentContextItem[] = [];
  let usedTokens = 0;

  for (const item of ordered) {
    const itemTokens = estimateItemTokens(item);
    if (usedTokens + itemTokens <= maxTokens) {
      finalItems.push(item);
      usedTokens += itemTokens;
      continue;
    }

    const remaining = maxTokens - usedTokens;
    const highPriority = item.type === 'agent' || item.type === 'skill' || item.type === 'note';
    if (highPriority && remaining > 0) {
      const truncated = truncateItemToTokens(item, remaining);
      if (truncated) {
        finalItems.push(truncated);
        usedTokens += estimateItemTokens(truncated);
      }
    }
  }

  return finalItems;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Resolve outgoing wiki links from a note to actual VaultNote objects.
 */
export function getOutgoingLinks(note: VaultNote, allNotes: VaultNote[]): VaultNote[] {
  const links: VaultNote[] = [];
  for (const wikiLink of note.links) {
    const resolved = resolveLinkTarget(allNotes, wikiLink.target);
    if (resolved) {
      links.push(resolved);
    }
  }
  return links;
}

/**
 * Find all notes that link to the given note (backlinks).
 */
export function getBacklinks(note: VaultNote, allNotes: VaultNote[]): VaultNote[] {
  const backlinkItems = buildBacklinks(allNotes, note);
  return backlinkItems
    .map((item) => allNotes.find((n) => getNoteKey(n) === item.sourceKey))
    .filter((n): n is VaultNote => n !== undefined);
}

/**
 * Get tags that appear in notes sharing outgoing links or backlinks with the given note.
 */
export function getRelatedTags(note: VaultNote, allNotes: VaultNote[]): string[] {
  const relatedNoteKeys = new Set<string>();

  // Include tags from outgoing links
  for (const linked of getOutgoingLinks(note, allNotes)) {
    relatedNoteKeys.add(getNoteKey(linked));
  }

  // Include tags from backlinks
  for (const linked of getBacklinks(note, allNotes)) {
    relatedNoteKeys.add(getNoteKey(linked));
  }

  // Collect all unique tags from related notes
  const tagSet = new Set<string>();
  for (const key of relatedNoteKeys) {
    const relatedNote = allNotes.find((n) => getNoteKey(n) === key);
    if (relatedNote) {
      for (const tag of relatedNote.tags) {
        tagSet.add(tag);
      }
    }
  }

  // Remove tags already present in the current note
  for (const tag of note.tags) {
    tagSet.delete(tag);
  }

  return Array.from(tagSet).sort((a, b) => a.localeCompare(b));
}

/**
 * Get memory notes associated with an agent.
 */
export function getAgentMemory(agent: VaultNote, allNotes: VaultNote[]): VaultNote[] {
  const memoryLinks: VaultNote[] = [];

  // Check frontmatter memory array
  const memoryFrontmatter = agent.frontmatter.memory;
  if (Array.isArray(memoryFrontmatter)) {
    for (const memRef of memoryFrontmatter) {
      const resolved = resolveMemoryNote(memRef, allNotes);
      if (resolved) memoryLinks.push(resolved);
    }
  }

  // Also find canonical and legacy memory notes associated with this agent.
  const agentKey = normalizeKey(agent.title);
  for (const note of allNotes) {
    if (!isDefaultContextMemory(note)) continue;
    const path = `/${note.path.toLowerCase()}`;
    const metadata = getMemoryMetadata(note);

    if (metadata.memoryType === 'agent') {
      if (metadata.target && normalizeKey(metadata.target) === agentKey) {
        memoryLinks.push(note);
      }
      continue;
    }

    if (path.includes(`/agents/${agentKey}/`)) {
      memoryLinks.push(note);
    }
  }

  return memoryLinks;
}

/**
 * Get project memory notes (memory notes not tied to a specific agent).
 */
export function getProjectMemory(projectName: string, allNotes: VaultNote[]): VaultNote[] {
  if (!projectName) return [];

  return allNotes.filter((note) => {
    if (!isDefaultContextMemory(note)) return false;
    const metadata = getMemoryMetadata(note);
    return metadata.memoryType === 'project' && memoryMatchesTarget(note, projectName);
  });
}

/**
 * Get team memory notes.
 */
export function getTeamMemory(allNotes: VaultNote[]): VaultNote[] {
  return allNotes.filter((note) => {
    if (!isDefaultContextMemory(note)) return false;
    return getMemoryMetadata(note).memoryType === 'team';
  });
}

/**
 * Get user memory notes.
 */
export function getUserMemory(allNotes: VaultNote[]): VaultNote[] {
  return allNotes.filter((note) => {
    if (!isDefaultContextMemory(note)) return false;
    return getMemoryMetadata(note).memoryType === 'user';
  });
}

/**
 * Get skill instructions from a skill note.
 */
export function getSkillInstructions(skill: VaultNote): string {
  // Extract instructions from skill note content
  // Look for an instructions section or return the full content
  const skillBody = getMarkdownBody(skill.content);
  const lines = skillBody.split('\n');
  let inInstructions = false;
  const instructions: string[] = [];

  for (const line of lines) {
    if (line.match(/^#+\s*instructions/i)) {
      inInstructions = true;
      continue;
    }
    if (inInstructions && line.match(/^#\s/)) {
      // Stop at next heading
      break;
    }
    if (inInstructions) {
      instructions.push(line);
    }
  }

  // If no instructions section found, fall back to the first body paragraph.
  if (instructions.length === 0) {
    const firstParagraph = skillBody.split('\n\n')[0]?.trim();
    return firstParagraph || '';
  }

  return instructions.join('\n').trim();
}

/**
 * Get tool notes related to an agent.
 */
export function getRelatedTools(agent: VaultNote, allNotes: VaultNote[]): VaultNote[] {
  const toolLinks: VaultNote[] = [];

  // Check frontmatter tools array
  const toolsFrontmatter = agent.frontmatter.tools;
  if (Array.isArray(toolsFrontmatter)) {
    for (const toolRef of toolsFrontmatter) {
      const resolved = resolveToolNote(toolRef, allNotes);
      if (resolved) toolLinks.push(resolved);
    }
  }

  // Also find notes in /tools/ folder or with type: tool
  for (const note of allNotes) {
    const type = getWorkspaceEntityType(note);
    if (type === 'tool') {
      toolLinks.push(note);
    }
  }

  return toolLinks;
}

/**
 * Resolve a memory reference to a VaultNote.
 */
function resolveMemoryNote(ref: string, allNotes: VaultNote[]): VaultNote | undefined {
  // Try to resolve by title, path, or id
  const cleanRef = ref.trim();
  return allNotes.find((note) => {
    if (!isDefaultContextMemory(note) || !isMemoryNote(note)) {
      return false;
    }
    return (
      normalizeKey(note.title) === normalizeKey(cleanRef) ||
      normalizeKey(basename(removeMdExtension(note.path))) === normalizeKey(cleanRef) ||
      note.path.toLowerCase().includes(cleanRef.toLowerCase())
    );
  });
}

/**
 * Resolve a tool reference to a VaultNote.
 */
function resolveToolNote(ref: string, allNotes: VaultNote[]): VaultNote | undefined {
  const cleanRef = ref.trim();
  return allNotes.find((note) => {
    const type = getWorkspaceEntityType(note);
    if (type !== 'tool') return false;
    return (
      normalizeKey(note.title) === normalizeKey(cleanRef) ||
      normalizeKey(basename(removeMdExtension(note.path))) === normalizeKey(cleanRef) ||
      note.path.toLowerCase().includes(cleanRef.toLowerCase())
    );
  });
}

// =============================================================================
// Build Context
// =============================================================================

/**
 * Build a complete agent context from the context builder.
 */
export function buildAgentContext(builder: ContextBuilder): AgentContext {
  const { config, currentNote, notes, selectedAgent, selectedSkill } = builder;

  const context: AgentContext = {
    outgoingLinks: [],
    backlinks: [],
    agentMemory: [],
    teamMemory: [],
    userMemory: [],
    projectMemory: [],
    tools: [],
    items: [],
    estimatedTokens: 0,
  };

  const contextItems: AgentContextItem[] = [];
  const seenItems = new Set<string>();
  const excludedLinkedKeys = new Set<string>(
    [
      currentNote ? getNoteKey(currentNote) : '',
      selectedAgent ? getNoteKey(selectedAgent) : '',
      selectedSkill ? getNoteKey(selectedSkill) : '',
    ].filter(Boolean),
  );
  const selectedInstructionKeys = new Set<string>(
    [
      selectedAgent ? getNoteKey(selectedAgent) : '',
      selectedSkill ? getNoteKey(selectedSkill) : '',
    ].filter(Boolean),
  );
  const maxLinkedNotes = Math.max(0, config.max_notes);
  const graphDepth = Math.min(2, Math.max(1, config.graph_depth || 1));

  // 1. Assigned agent profile
  if (selectedAgent) {
    pushUniqueItem(contextItems, seenItems, createNoteItem('agent', selectedAgent, 1.0));
  }

  // 2. Selected skill
  if (config.include_skill && selectedSkill) {
    const skillInstructions = getSkillInstructions(selectedSkill);
    context.skill = {
      id: getNoteKey(selectedSkill),
      name: selectedSkill.title,
      description: skillInstructions,
      folderPath: '',
      skillFilePath: selectedSkill.path,
      status: 'active',
      tools: Array.isArray(selectedSkill.frontmatter.tools) ? selectedSkill.frontmatter.tools : [],
      memory: Array.isArray(selectedSkill.frontmatter.memory)
        ? selectedSkill.frontmatter.memory
        : [],
      tags: selectedSkill.tags,
      version:
        typeof selectedSkill.frontmatter.version === 'string'
          ? selectedSkill.frontmatter.version
          : undefined,
      author:
        typeof selectedSkill.frontmatter.author === 'string'
          ? selectedSkill.frontmatter.author
          : undefined,
      createdAt: selectedSkill.updatedAt,
      updatedAt: selectedSkill.updatedAt,
    };
    pushUniqueItem(contextItems, seenItems, {
      type: 'skill',
      id: getNoteKey(selectedSkill),
      title: selectedSkill.title,
      path: selectedSkill.path,
      content: skillInstructions,
      weight: 0.95,
    });
  }

  // 3. Current note
  if (config.include_current_note && currentNote) {
    context.currentNote = currentNote;
    if (!selectedInstructionKeys.has(getNoteKey(currentNote))) {
      pushUniqueItem(contextItems, seenItems, createNoteItem('note', currentNote, 0.9));
    }
  }

  // 4. Selected text (future - placeholder)
  // This would be implemented when text selection is added

  // 5. Related tags (context metadata, not added as items)
  // Tags are used for RAG fallback search, not included as context items

  // 6. Outgoing links and backlinks, with optional second-hop notes.
  const linkedNotes: VaultNote[] = [];
  const linkedSeen = new Set<string>(excludedLinkedKeys);
  const directLinkedNotes: VaultNote[] = [];

  if (config.include_outgoing_links) {
    const outgoing = getOutgoingLinks(currentNote, notes);
    for (const note of outgoing) {
      if (pushUniqueNote(linkedNotes, linkedSeen, note, maxLinkedNotes)) {
        directLinkedNotes.push(note);
      }
    }
    context.outgoingLinks = linkedNotes.filter((note) =>
      outgoing.some((outgoingNote) => getNoteKey(outgoingNote) === getNoteKey(note)),
    );
  }

  if (config.include_backlinks) {
    const backlinks = getBacklinks(currentNote, notes);
    const directBacklinks: VaultNote[] = [];
    for (const note of backlinks) {
      if (pushUniqueNote(linkedNotes, linkedSeen, note, maxLinkedNotes)) {
        directLinkedNotes.push(note);
        directBacklinks.push(note);
      }
    }
    context.backlinks = directBacklinks;
  }

  if (graphDepth >= 2 && linkedNotes.length < maxLinkedNotes) {
    const firstHop = [...directLinkedNotes];
    for (const note of firstHop) {
      if (linkedNotes.length >= maxLinkedNotes) break;
      if (config.include_outgoing_links) {
        for (const secondHop of getOutgoingLinks(note, notes)) {
          if (linkedNotes.length >= maxLinkedNotes) break;
          pushUniqueNote(linkedNotes, linkedSeen, secondHop, maxLinkedNotes);
        }
      }
      if (config.include_backlinks) {
        for (const secondHop of getBacklinks(note, notes)) {
          if (linkedNotes.length >= maxLinkedNotes) break;
          pushUniqueNote(linkedNotes, linkedSeen, secondHop, maxLinkedNotes);
        }
      }
    }
  }

  for (const linkedNote of linkedNotes) {
    pushUniqueItem(contextItems, seenItems, createNoteItem('link', linkedNote, 0.65));
  }

  // 7. Agent memory
  if (config.include_agent_memory && selectedAgent) {
    const agentMemory = getAgentMemory(selectedAgent, notes);
    context.agentMemory = agentMemory.map((note) =>
      memoryToContextMemory(note, 'agent', selectedAgent.title),
    );
    for (const memNote of agentMemory) {
      pushUniqueItem(contextItems, seenItems, {
        type: 'memory',
        id: getNoteKey(memNote),
        title: memNote.title,
        path: memNote.path,
        content: getMarkdownBody(memNote.content),
        weight: 0.6,
      });
    }
  }

  // 8. Team memory
  if (config.include_team_memory) {
    const teamMemory = getTeamMemory(notes);
    context.teamMemory = teamMemory.map((note) => memoryToContextMemory(note, 'team'));
    for (const memNote of teamMemory) {
      pushUniqueItem(contextItems, seenItems, {
        type: 'memory',
        id: getNoteKey(memNote),
        title: memNote.title,
        path: memNote.path,
        content: getMarkdownBody(memNote.content),
        weight: 0.55,
      });
    }
  }

  // 9. User memory
  if (config.include_user_memory) {
    const userMemory = getUserMemory(notes);
    context.userMemory = userMemory.map((note) => memoryToContextMemory(note, 'user'));
    for (const memNote of userMemory) {
      pushUniqueItem(contextItems, seenItems, {
        type: 'memory',
        id: getNoteKey(memNote),
        title: memNote.title,
        path: memNote.path,
        content: getMarkdownBody(memNote.content),
        weight: 0.55,
      });
    }
  }

  // 10. Project memory
  if (config.include_project_memory) {
    const projectTarget = getActiveProjectTarget(currentNote);
    const projectMemory = projectTarget ? getProjectMemory(projectTarget, notes) : [];
    context.projectMemory = projectMemory.map((note) =>
      memoryToContextMemory(note, 'project', projectTarget ?? undefined),
    );
    for (const memNote of projectMemory) {
      pushUniqueItem(contextItems, seenItems, {
        type: 'memory',
        id: getNoteKey(memNote),
        title: memNote.title,
        path: memNote.path,
        content: getMarkdownBody(memNote.content),
        weight: 0.5,
      });
    }
  }

  // 11. Related tools
  if (config.include_tools) {
    const allTools = getAllTools(notes);
    context.tools = allTools;
    for (const tool of allTools) {
      const toolNote = notes.find((n) => getNoteKey(n) === tool.id || n.title === tool.name);
      pushUniqueItem(contextItems, seenItems, {
        type: 'tool',
        id: tool.id,
        title: tool.name,
        path: tool.sourceNotePath,
        content: toolNote ? getMarkdownBody(toolNote.content) : (tool.description ?? ''),
        weight: 0.4,
      });
    }
  }

  // 12. Recent agent runs (placeholder - would require run history)
  // This would be implemented when agent run tracking is added

  context.items = applyContextBudget(contextItems, config.max_tokens);
  context.estimatedTokens = estimateContextTokens(context);

  return context;
}

// =============================================================================
// Token Estimation
// =============================================================================

/**
 * Estimate token count for a context.
 * Uses a rough approximation: ~4 characters per token for English text.
 */
export function estimateContextTokens(context: AgentContext): number {
  return context.items.reduce((sum, item) => sum + estimateItemTokens(item), 0);
}

/**
 * Truncate context items if token count exceeds maximum.
 */
export function truncateContextIfNeeded(context: AgentContext, maxTokens: number): AgentContext {
  const truncated = { ...context, items: applyContextBudget(context.items, maxTokens) };
  truncated.estimatedTokens = estimateContextTokens(truncated);
  return truncated;
}

// =============================================================================
// Context Preview
// =============================================================================

/**
 * Format agent context as a human-readable preview string.
 */
export function formatContextPreview(context: AgentContext): string {
  const lines: string[] = [];

  lines.push('# Agent Context Preview\n');
  for (const item of context.items) {
    lines.push(`## ${item.type}: ${item.title}`);
    if (item.path) lines.push(`- Path: ${item.path}`);
    lines.push(`- Tokens: ~${estimateItemTokens(item)}`);
    lines.push('');
  }

  lines.push('---');
  lines.push(`**Total Estimated Tokens:** ~${context.estimatedTokens}`);

  return lines.join('\n');
}
