import type {
  ChatSession,
  TaskConversationAgentState,
  TaskConversationMeta,
  TaskItem,
  TaskSnapshot,
  VaultNote,
} from '../types';
import { createChatSession, loadChatSessions, saveChatSessions } from './chatHistory';
import { buildBacklinks, resolveLinkTarget } from './markdown';
import { getNoteKey } from './noteKey';

const TASK_CONVERSATIONS_KEY = 'agent-vault-task-conversations';

type TaskConversationStore = Record<string, TaskConversationMeta>;

function loadJson<T>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(key);
    if (stored) return JSON.parse(stored) as T;
  } catch {}
  return fallback;
}

function saveJson<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export function taskSnapshotFromTask(task: TaskItem): TaskSnapshot {
  return {
    text: task.text,
    noteKey: task.noteKey,
    notePath: task.notePath,
    noteTitle: task.noteTitle,
    line: task.line,
  };
}

export function loadTaskConversationMeta(): TaskConversationStore {
  return loadJson<TaskConversationStore>(TASK_CONVERSATIONS_KEY, {});
}

export function saveTaskConversationMeta(meta: TaskConversationStore): void {
  saveJson(TASK_CONVERSATIONS_KEY, meta);
}

export function getTaskConversationMeta(taskId: string): TaskConversationMeta | undefined {
  return loadTaskConversationMeta()[taskId];
}

export function buildRelatedFilesForTask(
  task: TaskItem,
  notes: VaultNote[],
  explicitPaths: string[] = [],
): string[] {
  const related = new Set<string>();
  explicitPaths.forEach((path) => {
    if (path.trim()) related.add(path);
  });
  const sourceNote = notes.find((note) => getNoteKey(note) === task.noteKey);
  if (!sourceNote) return Array.from(related);

  related.add(sourceNote.path);
  sourceNote.links.forEach((link) => {
    const target = resolveLinkTarget(notes, link.target);
    if (target) related.add(target.path);
  });
  buildBacklinks(notes, sourceNote).forEach((backlink) => related.add(backlink.sourcePath));
  return Array.from(related).sort((a, b) => a.localeCompare(b));
}

export function pruneTaskConversationMeta(
  tasks: TaskItem[],
  currentMeta = loadTaskConversationMeta(),
): TaskConversationStore {
  const taskIds = new Set(tasks.map((task) => task.id));
  const next: TaskConversationStore = {};
  Object.entries(currentMeta).forEach(([taskId, meta]) => {
    if (taskIds.has(taskId)) next[taskId] = meta;
  });
  if (Object.keys(next).length !== Object.keys(currentMeta).length) {
    saveTaskConversationMeta(next);
  }
  return next;
}

export function ensureTaskConversation(
  task: TaskItem,
  notes: VaultNote[],
  agentKey: string,
  agentName: string,
): { meta: TaskConversationMeta; session: ChatSession } {
  const now = Date.now();
  const currentMeta = loadTaskConversationMeta();
  const sessions = loadChatSessions();
  const existingMeta = currentMeta[task.id];
  const existingSession = existingMeta
    ? sessions.find((session) => session.id === existingMeta.sessionId)
    : sessions.find((session) => session.taskId === task.id);
  const relatedFiles = buildRelatedFilesForTask(task, notes, existingMeta?.relatedFiles);
  const status = task.completed ? 'completed' : 'active';

  if (existingSession) {
    const session: ChatSession = {
      ...existingSession,
      taskId: task.id,
      taskSnapshot: taskSnapshotFromTask(task),
      updatedAt: now,
    };
    const updatedSessions = sessions.map((candidate) =>
      candidate.id === session.id ? session : candidate,
    );
    saveChatSessions(updatedSessions);
    const meta: TaskConversationMeta = {
      taskId: task.id,
      sessionId: session.id,
      status,
      agentState:
        existingMeta?.agentState ?? (session.messages.length > 0 ? 'idle' : 'not_started'),
      relatedFiles,
      createdAt: existingMeta?.createdAt ?? session.createdAt,
      updatedAt: now,
    };
    saveTaskConversationMeta({ ...currentMeta, [task.id]: meta });
    return { meta, session };
  }

  const session = {
    ...createChatSession(agentKey, agentName),
    title: task.text.slice(0, 50) || 'Task chat',
    taskId: task.id,
    taskSnapshot: taskSnapshotFromTask(task),
  };
  saveChatSessions([session, ...sessions]);
  const meta: TaskConversationMeta = {
    taskId: task.id,
    sessionId: session.id,
    status,
    agentState: 'not_started',
    relatedFiles,
    createdAt: now,
    updatedAt: now,
  };
  saveTaskConversationMeta({ ...currentMeta, [task.id]: meta });
  return { meta, session };
}

export function updateTaskConversationAgentState(
  taskId: string,
  agentState: TaskConversationAgentState,
): TaskConversationStore {
  const meta = loadTaskConversationMeta();
  const current = meta[taskId];
  if (!current) return meta;
  const next = {
    ...meta,
    [taskId]: {
      ...current,
      agentState,
      updatedAt: Date.now(),
    },
  };
  saveTaskConversationMeta(next);
  return next;
}

export interface TaskConversationIndexEntry {
  task: TaskItem;
  session: ChatSession;
  meta: TaskConversationMeta;
}

export function buildTaskConversationIndex(
  tasks: TaskItem[],
  meta: TaskConversationStore = loadTaskConversationMeta(),
): TaskConversationIndexEntry[] {
  const result: TaskConversationIndexEntry[] = [];
  tasks.forEach((task) => {
    const entry = meta[task.id];
    if (!entry) return;
    result.push({ task, session: { id: entry.sessionId } as ChatSession, meta: entry });
  });
  return result;
}
