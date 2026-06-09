import type { InternalToolHandler, ToolInvocationResult, ToolExecutionContext } from '../../types';
import { canAppendToMemoryNote, isMemoryNote } from '../memory';
import { validateVaultPath } from '../paths';
import { canWriteVaultNote, createNote, writeNote } from '../vault';
import {
  cleanString,
  normalizeAssignee,
  parseTags,
  validateAssignee,
  validateDueDate,
  validatePlainPath,
} from './validation';

function replaceNoteSnapshot(
  ctx: ToolExecutionContext,
  previousPath: string,
  updated: import('../../types').VaultNote,
): void {
  const index = ctx.notes.findIndex(
    (n) => n.path.toLowerCase() === previousPath.toLowerCase() && n.vaultId === updated.vaultId,
  );
  if (index >= 0) ctx.notes[index] = updated;
  if (ctx.currentNote?.path.toLowerCase() === previousPath.toLowerCase())
    Object.assign(ctx.currentNote, updated);
}

export const vaultCreateTask: InternalToolHandler = {
  toolId: 'vault.create_task',
  toolName: 'Create Task',
  description: 'Append a task to a note. Requires a writable personal vault note.',
  parameters: {
    type: 'object',
    properties: {
      note_path: { type: 'string', description: 'Path of the note to add the task to' },
      task_text: { type: 'string', description: 'Task description text' },
      assignee: { type: 'string', description: 'Optional assignee (@name)' },
      due: { type: 'string', description: 'Optional due date (YYYY-MM-DD)' },
      tags: { type: 'string', description: 'Optional space-separated tags (#tag1 #tag2)' },
    },
    required: ['note_path', 'task_text'],
  },
  handler: async (input, ctx): Promise<ToolInvocationResult> => {
    const notePath = cleanString(input.note_path);
    const taskText = cleanString(input.task_text);
    if (!notePath || !taskText)
      return { success: false, error: 'note_path and task_text are required', durationMs: 0 };
    const pathError = validatePlainPath(notePath, 'note_path');
    if (pathError) return { success: false, error: pathError, durationMs: 0 };

    const targetNote = ctx.notes.find((n) => n.path.toLowerCase() === notePath.toLowerCase());
    if (!targetNote) return { success: false, error: `Note not found: ${notePath}`, durationMs: 0 };
    if (!canWriteVaultNote(targetNote) || !targetNote.handle) {
      return { success: false, error: 'Target note is not writable', durationMs: 0 };
    }

    const assigneeRaw = cleanString(input.assignee);
    const assigneeError = validateAssignee(assigneeRaw);
    if (assigneeError) return { success: false, error: assigneeError, durationMs: 0 };
    const dueRaw = cleanString(input.due);
    const dueError = validateDueDate(dueRaw);
    if (dueError) return { success: false, error: dueError, durationMs: 0 };
    const parsedTags = parseTags(input.tags);
    if (parsedTags.error) return { success: false, error: parsedTags.error, durationMs: 0 };

    const assignee = assigneeRaw ? ` ${normalizeAssignee(assigneeRaw)}` : '';
    const due = dueRaw ? ` due:${dueRaw}` : '';
    const tags = parsedTags.tags.length ? ` ${parsedTags.tags.join(' ')}` : '';
    const taskLine = `\n- [ ] ${taskText.replace(/\s+/g, ' ')}${assignee}${due}${tags}`;

    try {
      const saved = await writeNote(targetNote, targetNote.content + taskLine);
      replaceNoteSnapshot(ctx, targetNote.path, saved);
      return { success: true, output: { message: 'Task added', note: saved.path }, durationMs: 0 };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        durationMs: 0,
      };
    }
  },
};

export const memoryAppend: InternalToolHandler = {
  toolId: 'memory.append',
  toolName: 'Append to Memory',
  description: 'Append content to a memory note. Requires a writable personal vault.',
  parameters: {
    type: 'object',
    properties: {
      memory_path: { type: 'string', description: 'Path of the memory note to append to' },
      content: { type: 'string', description: 'Content to append' },
    },
    required: ['memory_path', 'content'],
  },
  handler: async (input, ctx): Promise<ToolInvocationResult> => {
    const memoryPath = cleanString(input.memory_path);
    const content = cleanString(input.content);
    if (!memoryPath || !content)
      return { success: false, error: 'memory_path and content are required', durationMs: 0 };
    const pathError = validatePlainPath(memoryPath, 'memory_path');
    if (pathError) return { success: false, error: pathError, durationMs: 0 };

    const targetNote = ctx.notes.find((n) => n.path.toLowerCase() === memoryPath.toLowerCase());
    if (!targetNote)
      return { success: false, error: `Memory note not found: ${memoryPath}`, durationMs: 0 };
    if (!isMemoryNote(targetNote)) {
      return {
        success: false,
        error: `Target note is not a detected memory note: ${memoryPath}`,
        durationMs: 0,
      };
    }
    if (!canAppendToMemoryNote(targetNote) || !targetNote.handle) {
      if (targetNote.vaultRole === 'agent') {
        return {
          success: false,
          error: 'Agent vault memory is read-only. Choose a writable personal memory note.',
          durationMs: 0,
        };
      }
      if (targetNote.vaultRole === 'shared') {
        return {
          success: false,
          error: 'Shared vault memory is read-only. Choose a writable personal memory note.',
          durationMs: 0,
        };
      }
      return {
        success: false,
        error: 'Memory note must be in a writable personal vault',
        durationMs: 0,
      };
    }

    const timestamp = new Date().toISOString().split('T')[0];
    const newContent = targetNote.content + `\n\n---\n**Saved:** ${timestamp}\n\n${content}`;

    try {
      const saved = await writeNote(targetNote, newContent);
      replaceNoteSnapshot(ctx, targetNote.path, saved);
      return {
        success: true,
        output: { message: 'Memory appended', path: saved.path },
        durationMs: 0,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        durationMs: 0,
      };
    }
  },
};

export const noteCreate: InternalToolHandler = {
  toolId: 'note.create',
  toolName: 'Create Note',
  description:
    'Create a new note in the personal vault. Requires vault-only or trusted permission.',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Target path for the new note (e.g. Projects/My Note)' },
      content: { type: 'string', description: 'Initial markdown content' },
      frontmatter: { type: 'object', description: 'Optional frontmatter key-value pairs' },
    },
    required: ['path', 'content'],
  },
  handler: async (input, ctx): Promise<ToolInvocationResult> => {
    const path = cleanString(input.path);
    const content = cleanString(input.content);
    if (!path || !content)
      return { success: false, error: 'path and content are required', durationMs: 0 };
    const validation = validateVaultPath(path);
    if (!validation.valid || !validation.normalizedPath) {
      return { success: false, error: validation.error ?? 'Invalid note path', durationMs: 0 };
    }

    if (!ctx.personalRootHandle) {
      return { success: false, error: 'No personal vault root handle available', durationMs: 0 };
    }
    if (!ctx.personalVaultSource) {
      return { success: false, error: 'No personal vault source available', durationMs: 0 };
    }
    if (ctx.personalVaultSource.role !== 'personal' || ctx.personalVaultSource.readOnly) {
      return { success: false, error: 'Personal vault source is not writable', durationMs: 0 };
    }

    try {
      const frontmatter = input.frontmatter as Record<string, string | string[]> | undefined;
      let noteContent = content;
      if (frontmatter && typeof frontmatter === 'object') {
        const fmLines: string[] = [];
        for (const [k, v] of Object.entries(frontmatter)) {
          if (!/^[A-Za-z0-9_-]+$/.test(k)) {
            return { success: false, error: `Invalid frontmatter key: ${k}`, durationMs: 0 };
          }
          if (Array.isArray(v)) {
            fmLines.push(`${k}: [${v.map(String).join(', ')}]`);
          } else if (typeof v === 'string') {
            fmLines.push(`${k}: ${v}`);
          }
        }
        noteContent = `---\n${fmLines.join('\n')}\n---\n\n${content}`;
      }
      const note = await createNote(
        ctx.personalRootHandle,
        ctx.personalVaultSource,
        validation.normalizedPath,
        noteContent,
      );
      ctx.notes.push(note);
      return {
        success: true,
        output: { message: 'Note created', path: note.path, title: note.title },
        durationMs: 0,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        durationMs: 0,
      };
    }
  },
};

export const vaultUpdateNote: InternalToolHandler = {
  toolId: 'vault.update_note',
  toolName: 'Update Note',
  description: 'Replace the full content of an existing writable personal vault note.',
  parameters: {
    type: 'object',
    properties: {
      note_path: { type: 'string', description: 'Exact path of the note to replace' },
      content: { type: 'string', description: 'Full replacement markdown content' },
    },
    required: ['note_path', 'content'],
  },
  handler: async (input, ctx): Promise<ToolInvocationResult> => {
    const notePath = cleanString(input.note_path);
    const content = typeof input.content === 'string' ? input.content : '';
    if (!notePath || content === '')
      return { success: false, error: 'note_path and content are required', durationMs: 0 };
    const pathError = validatePlainPath(notePath, 'note_path');
    if (pathError) return { success: false, error: pathError, durationMs: 0 };

    const targetNote = ctx.notes.find((n) => n.path.toLowerCase() === notePath.toLowerCase());
    if (!targetNote) return { success: false, error: `Note not found: ${notePath}`, durationMs: 0 };
    if (!canWriteVaultNote(targetNote) || !targetNote.handle) {
      return { success: false, error: 'Target note is not writable', durationMs: 0 };
    }

    try {
      const saved = await writeNote(targetNote, content);
      replaceNoteSnapshot(ctx, targetNote.path, saved);
      return {
        success: true,
        output: { message: 'Note updated', path: saved.path, size: saved.size },
        durationMs: 0,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        durationMs: 0,
      };
    }
  },
};

export const vaultAppendToNote: InternalToolHandler = {
  toolId: 'vault.append_to_note',
  toolName: 'Append to Note',
  description: 'Append markdown content to an existing writable personal vault note.',
  parameters: {
    type: 'object',
    properties: {
      note_path: { type: 'string', description: 'Exact path of the note to append to' },
      content: { type: 'string', description: 'Markdown content to append' },
      separator: { type: 'string', description: 'Optional separator inserted before content' },
    },
    required: ['note_path', 'content'],
  },
  handler: async (input, ctx): Promise<ToolInvocationResult> => {
    const notePath = cleanString(input.note_path);
    const content = typeof input.content === 'string' ? input.content : '';
    const separator = typeof input.separator === 'string' ? input.separator : '\n\n';
    if (!notePath || content === '')
      return { success: false, error: 'note_path and content are required', durationMs: 0 };
    const pathError = validatePlainPath(notePath, 'note_path');
    if (pathError) return { success: false, error: pathError, durationMs: 0 };

    const targetNote = ctx.notes.find((n) => n.path.toLowerCase() === notePath.toLowerCase());
    if (!targetNote) return { success: false, error: `Note not found: ${notePath}`, durationMs: 0 };
    if (!canWriteVaultNote(targetNote) || !targetNote.handle) {
      return { success: false, error: 'Target note is not writable', durationMs: 0 };
    }

    try {
      const saved = await writeNote(targetNote, `${targetNote.content}${separator}${content}`);
      replaceNoteSnapshot(ctx, targetNote.path, saved);
      return {
        success: true,
        output: { message: 'Content appended', path: saved.path, size: saved.size },
        durationMs: 0,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        durationMs: 0,
      };
    }
  },
};

export const vaultCompleteTask: InternalToolHandler = {
  toolId: 'vault.complete_task',
  toolName: 'Complete Task',
  description: 'Mark a markdown task complete by exact note path and task line number or task id.',
  parameters: {
    type: 'object',
    properties: {
      note_path: { type: 'string', description: 'Exact path of the task note' },
      task_line: { type: 'number', description: 'Zero-based line number of the task' },
      task_id: { type: 'string', description: 'Optional parsed task id' },
    },
    required: ['note_path'],
  },
  handler: async (input, ctx): Promise<ToolInvocationResult> => {
    const notePath = cleanString(input.note_path);
    const taskId = cleanString(input.task_id);
    if (!notePath) return { success: false, error: 'note_path is required', durationMs: 0 };
    const pathError = validatePlainPath(notePath, 'note_path');
    if (pathError) return { success: false, error: pathError, durationMs: 0 };

    const targetNote = ctx.notes.find((n) => n.path.toLowerCase() === notePath.toLowerCase());
    if (!targetNote) return { success: false, error: `Note not found: ${notePath}`, durationMs: 0 };
    if (!canWriteVaultNote(targetNote) || !targetNote.handle) {
      return { success: false, error: 'Target note is not writable', durationMs: 0 };
    }

    const lineInput = typeof input.task_line === 'number' ? input.task_line : Number.NaN;
    const task = taskId
      ? targetNote.tasks.find((t) => t.id === taskId)
      : targetNote.tasks.find((t) => t.line === lineInput);
    if (!task)
      return { success: false, error: 'Task not found by task_id or task_line', durationMs: 0 };
    if (task.completed)
      return {
        success: true,
        output: { message: 'Task already completed', path: targetNote.path, line: task.line },
        durationMs: 0,
      };

    const lines = targetNote.content.split('\n');
    const line = lines[task.line];
    if (line === undefined || !/^\s*[-*]\s+\[[ xX]\]/.test(line)) {
      return { success: false, error: `Line ${task.line} is not a markdown task`, durationMs: 0 };
    }
    lines[task.line] = line.replace(/^(\s*[-*]\s+\[)[ xX](\])/, '$1x$2');

    try {
      const saved = await writeNote(targetNote, lines.join('\n'));
      replaceNoteSnapshot(ctx, targetNote.path, saved);
      return {
        success: true,
        output: { message: 'Task completed', path: saved.path, line: task.line, task: task.text },
        durationMs: 0,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        durationMs: 0,
      };
    }
  },
};
