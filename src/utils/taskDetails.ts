/**
 * Persistent task detail storage.
 *
 * Extended task metadata (status, priority, labels, due date/time, assignee,
 * description, threaded comments) cannot be represented safely in the
 * single-line Markdown task syntax. This module reads/writes a per-vault
 * sidecar JSON file at `.agent-vault/tasks.json`.
 *
 * Each task entry is keyed by a stable task id. The Markdown task line may
 * carry a hidden HTML comment marker
 *   <!-- agent-vault:task-id=<id> -->
 * that the parser strips from the visible text; if the marker is absent,
 * the id is generated deterministically and persisted.
 */

export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

export interface TaskComment {
  id: string;
  parentId?: string;
  authorId: string;
  authorName: string;
  createdAt: string;
  updatedAt?: string;
  body: string;
}

export interface TaskDetail {
  taskId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority?: TaskPriority;
  labels: string[];
  assigneeId?: string;
  assigneeName?: string;
  dueAt?: string;
  comments: TaskComment[];
  createdAt: string;
  updatedAt: string;
}

export interface TaskDetailsStore {
  version: 1;
  tasks: Record<string, TaskDetail>;
}

export const TASK_DETAILS_FILENAME = '.agent-vault/tasks.json';
export const TASK_ID_MARKER_REGEX = /<!--\s*agent-vault:task-id=([A-Za-z0-9_-]+)\s*-->/;
export const TASK_ID_MARKER_PLACEHOLDER = '<!-- agent-vault:task-id=__TASK_ID__ -->';

export function emptyTaskDetailsStore(): TaskDetailsStore {
  return { version: 1, tasks: {} };
}

export function defaultTaskDetail(taskId: string): TaskDetail {
  const now = new Date().toISOString();
  return {
    taskId,
    title: '',
    description: '',
    status: 'todo',
    labels: [],
    comments: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function isTaskDetail(value: unknown): value is TaskDetail {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.taskId !== 'string') return false;
  if (typeof candidate.title !== 'string') return false;
  if (typeof candidate.description !== 'string') return false;
  if (
    candidate.status !== 'todo' &&
    candidate.status !== 'in_progress' &&
    candidate.status !== 'done' &&
    candidate.status !== 'cancelled'
  ) {
    return false;
  }
  if (
    candidate.priority !== undefined &&
    candidate.priority !== 'low' &&
    candidate.priority !== 'medium' &&
    candidate.priority !== 'high' &&
    candidate.priority !== 'critical'
  ) {
    return false;
  }
  if (!Array.isArray(candidate.labels)) return false;
  if (!candidate.labels.every((label) => typeof label === 'string')) return false;
  if (candidate.assigneeId !== undefined && typeof candidate.assigneeId !== 'string') return false;
  if (candidate.assigneeName !== undefined && typeof candidate.assigneeName !== 'string') return false;
  if (candidate.dueAt !== undefined && typeof candidate.dueAt !== 'string') return false;
  if (!Array.isArray(candidate.comments)) return false;
  if (typeof candidate.createdAt !== 'string') return false;
  if (typeof candidate.updatedAt !== 'string') return false;
  return true;
}

export function isTaskDetailsStore(value: unknown): value is TaskDetailsStore {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  if (candidate.version !== 1) return false;
  if (!candidate.tasks || typeof candidate.tasks !== 'object' || Array.isArray(candidate.tasks)) {
    return false;
  }
  const tasks = candidate.tasks as Record<string, unknown>;
  return Object.values(tasks).every(isTaskDetail);
}

export function parseTaskDetailsJson(text: string): TaskDetailsStore {
  if (!text.trim()) return emptyTaskDetailsStore();
  try {
    const parsed = JSON.parse(text);
    if (isTaskDetailsStore(parsed)) return parsed;
    // Reset to empty when contents are unrecognized.
    return emptyTaskDetailsStore();
  } catch {
    return emptyTaskDetailsStore();
  }
}

export function serializeTaskDetailsJson(store: TaskDetailsStore): string {
  return JSON.stringify(store, null, 2);
}

/**
 * Generate a short, deterministic-ish task id.
 */
export function generateTaskId(): string {
  const time = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `t_${time}${rand}`;
}

/**
 * Extract a stable task id from a Markdown task line if present.
 */
export function extractTaskIdFromLine(line: string): string | undefined {
  return line.match(TASK_ID_MARKER_REGEX)?.[1];
}

/**
 * Build a Markdown task line including the hidden id marker.
 */
export function buildTaskLine(args: {
  completed: boolean;
  text: string;
  taskId: string;
}): string {
  const checkbox = args.completed ? '[x]' : '[ ]';
  const text = args.text.trim();
  return `- ${checkbox} ${text} ${TASK_ID_MARKER_PLACEHOLDER.replace('__TASK_ID__', args.taskId)}`.trimEnd();
}

/**
 * Ensure a task line carries a stable task id marker. Mutates the line by
 * appending the marker when missing.
 */
export function ensureTaskIdOnLine(line: string, taskId: string): string {
  if (extractTaskIdFromLine(line)) return line;
  const cleaned = line.trimEnd();
  return `${cleaned} ${TASK_ID_MARKER_PLACEHOLDER.replace('__TASK_ID__', taskId)}`.trimEnd();
}

/**
 * Replace a task id marker on a single line with a new id.
 */
export function replaceTaskIdOnLine(line: string, nextId: string): string {
  if (extractTaskIdFromLine(line)) {
    return line.replace(TASK_ID_MARKER_REGEX, `<!-- agent-vault:task-id=${nextId} -->`);
  }
  return ensureTaskIdOnLine(line, nextId);
}

/**
 * Find the index of the task line that owns the given id.
 */
export function findTaskLineIndexById(content: string, taskId: string): number {
  const lines = content.split('\n');
  return lines.findIndex((line) => extractTaskIdFromLine(line) === taskId);
}

export interface TaskDetailsAdapter {
  read(): Promise<TaskDetailsStore>;
  write(store: TaskDetailsStore): Promise<void>;
}

export function createLocalStorageTaskDetailsAdapter(key: string): TaskDetailsAdapter {
  return {
    async read() {
      if (typeof localStorage === 'undefined') return emptyTaskDetailsStore();
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return emptyTaskDetailsStore();
        return parseTaskDetailsJson(raw);
      } catch {
        return emptyTaskDetailsStore();
      }
    },
    async write(store) {
      if (typeof localStorage === 'undefined') return;
      try {
        localStorage.setItem(key, serializeTaskDetailsJson(store));
      } catch {
        // ignore quota errors
      }
    },
  };
}

export function mergeTaskDetail(
  store: TaskDetailsStore,
  next: TaskDetail,
): TaskDetailsStore {
  return {
    version: 1,
    tasks: { ...store.tasks, [next.taskId]: next },
  };
}

export function deleteTaskDetail(store: TaskDetailsStore, taskId: string): TaskDetailsStore {
  if (!(taskId in store.tasks)) return store;
  const { [taskId]: _drop, ...rest } = store.tasks;
  return { version: 1, tasks: rest };
}

export function ensureTaskDetail(
  store: TaskDetailsStore,
  taskId: string,
): TaskDetail {
  return store.tasks[taskId] ?? defaultTaskDetail(taskId);
}

export function createComment(
  authorId: string,
  authorName: string,
  body: string,
  parentId?: string,
): TaskComment {
  return {
    id: `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    parentId,
    authorId,
    authorName,
    createdAt: new Date().toISOString(),
    body,
  };
}

/**
 * Threaded ordering: depth-first, root comments followed by replies indented.
 */
export function buildCommentTree(comments: TaskComment[]): Array<{
  comment: TaskComment;
  replies: TaskComment[];
}> {
  const byParent = new Map<string | undefined, TaskComment[]>();
  for (const comment of comments) {
    const key = comment.parentId;
    const list = byParent.get(key) ?? [];
    list.push(comment);
    byParent.set(key, list);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
  const roots = byParent.get(undefined) ?? [];
  return roots.map((comment) => ({
    comment,
    replies: byParent.get(comment.id) ?? [],
  }));
}

export const TASK_STATUSES: Array<{ id: TaskStatus; label: string }> = [
  { id: 'todo', label: 'Todo' },
  { id: 'in_progress', label: 'In progress' },
  { id: 'done', label: 'Done' },
  { id: 'cancelled', label: 'Cancelled' },
];

export const TASK_PRIORITIES: Array<{ id: TaskPriority; label: string }> = [
  { id: 'low', label: 'Low' },
  { id: 'medium', label: 'Medium' },
  { id: 'high', label: 'High' },
  { id: 'critical', label: 'Critical' },
];

export function loadTaskDetailsStore(adapter: TaskDetailsAdapter): Promise<TaskDetailsStore> {
  return adapter.read();
}

export function saveTaskDetailsStore(
  adapter: TaskDetailsAdapter,
  store: TaskDetailsStore,
): Promise<void> {
  return adapter.write(store);
}