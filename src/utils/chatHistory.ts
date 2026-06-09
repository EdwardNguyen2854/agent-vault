import type { ChatMessage, ChatGroup, ChatSession, ToolCallRecord } from '../types';

const CHAT_HISTORY_KEY = 'agent-vault-chat-history';
const CHAT_ARCHIVE_KEY = 'agent-vault-chat-history-archived';
const CHAT_GROUPS_KEY = 'agent-vault-chat-groups';
const MAX_SESSIONS = 50;
const MAX_ARCHIVED_SESSIONS = 200;

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
  } catch {
    // localStorage full or unavailable — silently fail
  }
}

export function loadChatSessions(): ChatSession[] {
  return loadJson<ChatSession[]>(CHAT_HISTORY_KEY, []);
}

export function loadArchivedChatSessions(): ChatSession[] {
  return loadJson<ChatSession[]>(CHAT_ARCHIVE_KEY, []);
}

export function saveChatSessions(sessions: ChatSession[]): void {
  saveJson(CHAT_HISTORY_KEY, sessions);
}

export function saveArchivedChatSessions(sessions: ChatSession[]): void {
  saveJson(CHAT_ARCHIVE_KEY, sessions);
}

export function saveChatSession(session: ChatSession): void {
  const sessions = loadChatSessions();
  const index = sessions.findIndex((s) => s.id === session.id);
  const updated = { ...session, updatedAt: Date.now() };
  if (index >= 0) {
    sessions[index] = updated;
  } else {
    sessions.unshift(updated);
  }
  if (sessions.length > MAX_SESSIONS) {
    sessions.splice(MAX_SESSIONS);
  }
  saveJson(CHAT_HISTORY_KEY, sessions);
}

export function deleteChatSession(id: string): void {
  const sessions = loadChatSessions();
  const filtered = sessions.filter((s) => s.id !== id);
  saveJson(CHAT_HISTORY_KEY, filtered);
  const archived = loadArchivedChatSessions();
  saveArchivedChatSessions(archived.filter((s) => s.id !== id));
}

export function renameChatSession(id: string, title: string): void {
  const sessions = loadChatSessions();
  const session = sessions.find((s) => s.id === id);
  if (session) {
    session.title = title;
    session.updatedAt = Date.now();
    saveJson(CHAT_HISTORY_KEY, sessions);
    return;
  }
  const archived = loadArchivedChatSessions();
  const archivedSession = archived.find((s) => s.id === id);
  if (archivedSession) {
    archivedSession.title = title;
    archivedSession.updatedAt = Date.now();
    saveArchivedChatSessions(archived);
  }
}

function patchSessionInList(
  list: ChatSession[],
  id: string,
  patch: (s: ChatSession) => ChatSession,
): ChatSession[] {
  return list.map((s) => (s.id === id ? patch(s) : s));
}

export function pinChatSession(id: string, pinned: boolean): void {
  const sessions = loadChatSessions();
  saveChatSessions(patchSessionInList(sessions, id, (s) => ({ ...s, pinned })));
}

export function togglePinChatSession(id: string): boolean {
  const sessions = loadChatSessions();
  const target = sessions.find((s) => s.id === id);
  if (!target) return false;
  const next = !target.pinned;
  saveChatSessions(patchSessionInList(sessions, id, (s) => ({ ...s, pinned: next })));
  return next;
}

export function archiveChatSession(id: string): void {
  const sessions = loadChatSessions();
  const target = sessions.find((s) => s.id === id);
  if (!target) return;
  const archivedAt = Date.now();
  const archivedEntry: ChatSession = { ...target, archivedAt };
  const nextActive = sessions.filter((s) => s.id !== id);
  saveChatSessions(nextActive);
  const archived = loadArchivedChatSessions();
  const existingIndex = archived.findIndex((s) => s.id === id);
  if (existingIndex >= 0) {
    archived[existingIndex] = archivedEntry;
  } else {
    archived.unshift(archivedEntry);
  }
  if (archived.length > MAX_ARCHIVED_SESSIONS) {
    archived.splice(MAX_ARCHIVED_SESSIONS);
  }
  saveArchivedChatSessions(archived);
}

export function unarchiveChatSession(id: string): void {
  const archived = loadArchivedChatSessions();
  const target = archived.find((s) => s.id === id);
  if (!target) return;
  const restored: ChatSession = { ...target };
  delete (restored as { archivedAt?: number }).archivedAt;
  const nextArchived = archived.filter((s) => s.id !== id);
  saveArchivedChatSessions(nextArchived);
  const sessions = loadChatSessions();
  if (!sessions.some((s) => s.id === id)) {
    sessions.unshift(restored);
    if (sessions.length > MAX_SESSIONS) {
      sessions.splice(MAX_SESSIONS);
    }
    saveChatSessions(sessions);
  }
}

export function updateSessionTags(id: string, tags: string[]): void {
  const sessions = loadChatSessions();
  const patched = patchSessionInList(sessions, id, (s) => ({ ...s, tags }));
  if (patched !== sessions) {
    saveChatSessions(patched);
    return;
  }
  const archived = loadArchivedChatSessions();
  saveArchivedChatSessions(patchSessionInList(archived, id, (s) => ({ ...s, tags })));
}

export function updateSessionGroup(id: string, groupId: string | undefined): void {
  const sessions = loadChatSessions();
  const patched = patchSessionInList(sessions, id, (s) => ({ ...s, groupId }));
  if (patched !== sessions) {
    saveChatSessions(patched);
    return;
  }
  const archived = loadArchivedChatSessions();
  saveArchivedChatSessions(patchSessionInList(archived, id, (s) => ({ ...s, groupId })));
}

export function duplicateChatSession(id: string): ChatSession | null {
  const sessions = loadChatSessions();
  const archived = loadArchivedChatSessions();
  const source = sessions.find((s) => s.id === id) ?? archived.find((s) => s.id === id);
  if (!source) return null;
  const now = Date.now();
  const copy: ChatSession = {
    ...source,
    id: `chat_${now}_${Math.random().toString(36).slice(2, 8)}`,
    title: `${source.title} (copy)`,
    messages: source.messages.map((m) => ({ ...m })),
    createdAt: now,
    updatedAt: now,
    pinned: false,
    archivedAt: undefined,
    lastSavedAt: undefined,
    savedNotePath: undefined,
  };
  delete (copy as { archivedAt?: number }).archivedAt;
  const next = [copy, ...sessions];
  if (next.length > MAX_SESSIONS) next.splice(MAX_SESSIONS);
  saveChatSessions(next);
  return copy;
}

export function markSessionSaved(id: string, notePath: string): void {
  const sessions = loadChatSessions();
  saveChatSessions(
    patchSessionInList(sessions, id, (s) => ({
      ...s,
      lastSavedAt: Date.now(),
      savedNotePath: notePath,
    })),
  );
}

export function loadChatGroups(): ChatGroup[] {
  return loadJson<ChatGroup[]>(CHAT_GROUPS_KEY, []);
}

export function saveChatGroups(groups: ChatGroup[]): void {
  saveJson(CHAT_GROUPS_KEY, groups);
}

export function createChatGroup(name: string, color?: string): ChatGroup {
  const groups = loadChatGroups();
  const now = Date.now();
  const group: ChatGroup = {
    id: `grp_${now}_${Math.random().toString(36).slice(2, 6)}`,
    name: name.trim() || 'New group',
    color,
    order: groups.length,
    createdAt: now,
  };
  saveChatGroups([...groups, group]);
  return group;
}

export function deleteChatGroup(id: string): void {
  const groups = loadChatGroups().filter((g) => g.id !== id);
  saveChatGroups(groups);
  const sessions = loadChatSessions();
  const next = patchSessionInList(sessions, id, (s) => {
    const copy: ChatSession = { ...s };
    if (copy.groupId === id) delete copy.groupId;
    return copy;
  });
  if (next !== sessions) saveChatSessions(next);
  const archived = loadArchivedChatSessions();
  const nextArchived = patchSessionInList(archived, id, (s) => {
    const copy: ChatSession = { ...s };
    if (copy.groupId === id) delete copy.groupId;
    return copy;
  });
  if (nextArchived !== archived) saveArchivedChatSessions(nextArchived);
}

export function generateSessionTitle(messages: ChatMessage[]): string {
  if (messages.length === 0) return 'New Chat';
  const firstUser = messages.find((m) => m.role === 'user');
  if (!firstUser) return 'New Chat';
  const cleaned = firstUser.content.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= 50) return cleaned;
  return cleaned.slice(0, 47).trim() + '...';
}

let idCounter = 0;

export function createChatSession(
  agentKey: string,
  agentName: string,
  skillKey?: string,
): ChatSession {
  const now = Date.now();
  return {
    id: `chat_${now}_${++idCounter}`,
    title: 'New Chat',
    agent: agentName,
    agentKey,
    skillKey,
    messages: [],
    status: 'active',
    createdAt: now,
    updatedAt: now,
  };
}

function formatDate(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

function escapeYamlString(value: string): string {
  if (/[":#'\n]/.test(value) || /^\s|\s$/.test(value)) {
    return `"${value.replace(/"/g, '\\"')}"`;
  }
  return value;
}

interface ExtendedChatMessageFields {
  thinking?: string;
  toolTranscript?: ToolCallRecord[];
}

function isExtendedChatMessage(
  message: ChatMessage,
): message is ChatMessage & ExtendedChatMessageFields {
  return (
    (message as ChatMessage & ExtendedChatMessageFields).thinking !== undefined ||
    (message as ChatMessage & ExtendedChatMessageFields).toolTranscript !== undefined
  );
}

export interface SerializeSessionOptions {
  includeToolTranscript?: boolean;
  includeThinking?: boolean;
}

export function serializeSessionAsMarkdown(
  session: ChatSession,
  options: SerializeSessionOptions = {},
): string {
  const includeToolTranscript = options.includeToolTranscript !== false;
  const includeThinking = options.includeThinking !== false;
  const lines: string[] = [];
  const tags = (session.tags ?? []).map((t) => `"${t.replace(/"/g, '\\"')}"`).join(', ');
  const fmLines = [
    '---',
    'type: chat-export',
    `title: ${escapeYamlString(session.title)}`,
    `agent: ${escapeYamlString(session.agent)}`,
    `created: ${new Date(session.createdAt).toISOString()}`,
    `updated: ${new Date(session.updatedAt).toISOString()}`,
  ];
  if (session.taskSnapshot) {
    fmLines.push(`task_note: ${escapeYamlString(session.taskSnapshot.notePath)}`);
  }
  if (session.skillKey) fmLines.push(`skill: ${escapeYamlString(session.skillKey)}`);
  if (tags) fmLines.push(`tags: [${tags}]`);
  fmLines.push('---');
  lines.push(fmLines.join('\n'));
  lines.push('');
  lines.push(`# ${session.title}`);
  lines.push('');
  if (session.taskSnapshot) {
    lines.push(`> Task: ${session.taskSnapshot.text}`);
    lines.push(`> Note: [[${session.taskSnapshot.noteTitle}]]`);
    lines.push('');
  }
  if (session.messages.length === 0) {
    lines.push('_(No messages in this conversation.)_');
    return lines.join('\n');
  }
  session.messages.forEach((message) => {
    const stamp = new Date(message.timestamp).toLocaleString();
    const role = message.role.charAt(0).toUpperCase() + message.role.slice(1);
    lines.push(`## ${role} · ${stamp}`);
    lines.push('');
    if (includeThinking && isExtendedChatMessage(message) && message.thinking) {
      lines.push('<details><summary>Thinking</summary>');
      lines.push('');
      lines.push('```');
      lines.push(message.thinking);
      lines.push('```');
      lines.push('');
      lines.push('</details>');
      lines.push('');
    }
    if (message.content) {
      lines.push(message.content);
      lines.push('');
    }
    if (Array.isArray(message.attachments) && message.attachments.length > 0) {
      message.attachments.forEach((att) => {
        lines.push(`_Attachment: ${att.name}_`);
      });
      lines.push('');
    }
    if (
      includeToolTranscript &&
      isExtendedChatMessage(message) &&
      message.toolTranscript &&
      message.toolTranscript.length > 0
    ) {
      lines.push('<details><summary>Tool calls</summary>');
      lines.push('');
      lines.push('| Tool | Decision | Duration | Error |');
      lines.push('| --- | --- | --- | --- |');
      message.toolTranscript.forEach((record) => {
        const err = record.error ? `\`${record.error.replace(/\|/g, '\\|')}\`` : '';
        lines.push(
          `| ${record.toolName} | ${record.decision} | ${Math.round(record.durationMs)}ms | ${err} |`,
        );
      });
      lines.push('');
      lines.push('</details>');
      lines.push('');
    }
  });
  lines.push('---');
  lines.push(`_Exported ${formatDate(Date.now())} from Agent Vault_`);
  return lines.join('\n');
}
