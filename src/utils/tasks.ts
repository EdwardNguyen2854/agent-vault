/**
 * Task content-string mutators.
 *
 * These functions operate on raw markdown content, finding and rewriting
 * task lines (``- [ ]`` / ``- [x]``). They are triggered by UI interactions
 * (clicking a checkbox, editing task metadata) and mutate the content string
 * directly rather than working through the parse/render pipeline.
 */

import { taskRegex } from './markdown/parse';

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

/**
 * Rebuild a task line in markdown content with updated properties.
 * Strips existing @assignee, due:YYYY-MM-DD, priority:x from the text,
 * preserves the clean description and tags, then appends the new values.
 */
export function updateTaskLine(
  content: string,
  lineNumber: number,
  updates: {
    completed?: boolean;
    assignee?: string | null;
    due?: string | null;
    priority?: string | null;
  },
  fallbackTaskText?: string,
): string {
  const lines = content.split('\n');
  const taskLineRegex = /^(\s*-\s+\[)([ xX])(\]\s+)(.+)$/;
  const assigneeRegex = /(^|\s)@([\p{L}\p{N}_-]+)/u;
  const dueRegex = /\bdue:\d{4}-\d{2}-\d{2}\b/i;
  const priorityRegex = /\bpriority:(high|medium|low)\b/i;

  const rewrite = (index: number): boolean => {
    const original = lines[index];
    const match = original.match(taskLineRegex);
    if (!match) return false;
    const indent = match[1]; // e.g. "- ["
    const checkbox = match[2]; // " " or "x"
    const separator = match[3]; // "] "
    const fullText = match[4];

    const newCheckbox =
      updates.completed !== undefined ? (updates.completed ? 'x' : ' ') : checkbox;

    // Strip existing metadata from text, preserving tags
    let clean = fullText
      .replace(assigneeRegex, '')
      .replace(dueRegex, '')
      .replace(priorityRegex, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Rebuild with new metadata
    const parts: string[] = [clean];

    if (updates.assignee) {
      const safe = updates.assignee.replace(/[^\p{L}\p{N}_-]/gu, '').trim();
      if (safe) parts.push(`@${safe}`);
    }

    if (updates.due) {
      // Validate YYYY-MM-DD format roughly
      if (/^\d{4}-\d{2}-\d{2}$/.test(updates.due)) {
        parts.push(`due:${updates.due}`);
      }
    }

    if (updates.priority) {
      const p = updates.priority.toLowerCase();
      if (p === 'high' || p === 'medium' || p === 'low') {
        parts.push(`priority:${p}`);
      }
    }

    lines[index] = `${indent}${newCheckbox}${separator}${parts.join(' ')}`;
    return true;
  };

  if (lineNumber >= 1 && lineNumber <= lines.length) {
    if (rewrite(lineNumber - 1)) return lines.join('\n');
  }

  if (fallbackTaskText) {
    const taskTextLower = fallbackTaskText.toLowerCase();
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.match(taskLineRegex)) continue;
      if (line.toLowerCase().includes(taskTextLower)) {
        if (rewrite(i)) return lines.join('\n');
      }
    }
  }

  return content;
}

/**
 * Update or remove the @assignee on a task line in markdown content.
 * @param content - The full note content
 * @param lineNumber - 1-indexed line number of the task
 * @param agentName - The assignee name (without @), or null to remove
 * @param fallbackTaskText - Optional task text for fallback search
 * @returns Updated content with the assignee changed
 */
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
