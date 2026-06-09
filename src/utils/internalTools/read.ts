import { searchNotes } from '../search';
import { getMarkdownBody } from '../markdown';
import type { InternalToolHandler, ToolInvocationResult, ToolExecutionContext } from '../../types';
import { clampMaxResults, cleanString, validateAssignee } from './validation';

export const vaultReadNote: InternalToolHandler = {
  toolId: 'vault.read_note',
  toolName: 'Read Note',
  description: 'Read the body content of a note by its title or path.',
  parameters: {
    type: 'object',
    properties: {
      target: { type: 'string', description: 'Title or path of the note to read' },
    },
    required: ['target'],
  },
  handler: async (input, ctx): Promise<ToolInvocationResult> => {
    const target = cleanString(input.target);
    if (!target) return { success: false, error: 'target is required', durationMs: 0 };

    const lower = target.toLowerCase().replace(/\.md$/i, '');
    const candidates = ctx.notes.filter((n) => {
      const pathLower = n.path.toLowerCase();
      const pathWithoutExt = pathLower.replace(/\.md$/i, '');
      const basename = pathWithoutExt.split('/').pop() ?? pathWithoutExt;
      return (
        n.title.toLowerCase() === lower ||
        pathLower === target.toLowerCase() ||
        pathWithoutExt === lower ||
        basename === lower
      );
    });

    if (candidates.length > 1) {
      return {
        success: false,
        error: `Ambiguous note target: ${target}`,
        output: {
          candidates: candidates.slice(0, 20).map((n) => ({ title: n.title, path: n.path })),
        },
        durationMs: 0,
      };
    }

    const note = candidates[0];
    if (!note) {
      return { success: false, error: `Note not found: ${target}`, durationMs: 0 };
    }

    return {
      success: true,
      output: {
        title: note.title,
        path: note.path,
        content: getMarkdownBody(note.content),
      },
      durationMs: 0,
    };
  },
};

export const vaultSearch: InternalToolHandler = {
  toolId: 'vault.search',
  toolName: 'Search Vault',
  description:
    'Search all notes in the vault by a query string. Returns ranked results with title, path, and snippet.',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query' },
      max_results: {
        type: 'number',
        description: 'Maximum number of results to return (default 10)',
      },
    },
    required: ['query'],
  },
  handler: async (input, ctx): Promise<ToolInvocationResult> => {
    const query = cleanString(input.query);
    if (!query) return { success: false, error: 'query is required', durationMs: 0 };
    const maxResults = clampMaxResults(input.max_results, 10, 50);

    const results = searchNotes(ctx.notes, query, { contentScope: 'body' }).slice(0, maxResults);

    return {
      success: true,
      output: results.map((r) => ({
        title: r.note.title,
        path: r.note.path,
        matchType: r.matchType,
        score: r.score,
        snippet: r.snippet,
      })),
      durationMs: 0,
    };
  },
};

export const vaultListTasks: InternalToolHandler = {
  toolId: 'vault.list_tasks',
  toolName: 'List Tasks',
  description: 'List all tasks across the vault, optionally filtered by status, assignee, or tag.',
  parameters: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        enum: ['all', 'active', 'completed'],
        description: 'Filter by task status (default: active)',
      },
      assignee: { type: 'string', description: 'Filter by assignee (@name)' },
      tag: { type: 'string', description: 'Filter by task tag' },
      max_results: { type: 'number', description: 'Maximum results (default 20)' },
    },
  },
  handler: async (input, ctx): Promise<ToolInvocationResult> => {
    const status = String(input.status ?? 'active');
    if (!['all', 'active', 'completed'].includes(status)) {
      return { success: false, error: 'status must be all, active, or completed', durationMs: 0 };
    }
    const assigneeRaw = cleanString(input.assignee);
    const assigneeError = validateAssignee(assigneeRaw);
    if (assigneeError) return { success: false, error: assigneeError, durationMs: 0 };
    const assignee = assigneeRaw.toLowerCase();
    const tag = cleanString(input.tag).replace(/^#/, '').toLowerCase();
    if (tag && !/^[a-z0-9][a-z0-9_/-]{0,63}$/.test(tag)) {
      return {
        success: false,
        error: 'tag must contain only letters, numbers, underscores, hyphens, or slashes',
        durationMs: 0,
      };
    }
    const maxResults = clampMaxResults(input.max_results, 20, 100);

    let tasks: Array<{
      text: string;
      completed: boolean;
      noteTitle: string;
      notePath: string;
      due?: string;
      assignee?: string;
      tags: string[];
    }> = [];

    for (const note of ctx.notes) {
      for (const t of note.tasks) {
        tasks.push({
          text: t.text,
          completed: t.completed,
          noteTitle: note.title,
          notePath: note.path,
          due: t.due,
          assignee: t.assignee,
          tags: t.tags,
        });
      }
    }

    if (status === 'active') tasks = tasks.filter((t) => !t.completed);
    else if (status === 'completed') tasks = tasks.filter((t) => t.completed);

    if (assignee)
      tasks = tasks.filter(
        (t) =>
          t.assignee?.toLowerCase() === assignee || t.assignee?.toLowerCase().includes(assignee),
      );
    if (tag)
      tasks = tasks.filter((t) =>
        t.tags.some((tg) => tg.toLowerCase() === tag || tg.toLowerCase().includes(tag)),
      );

    return {
      success: true,
      output: tasks.slice(0, maxResults),
      durationMs: 0,
    };
  },
};
