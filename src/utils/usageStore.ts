import type { AgentRun, ChatSession, Tool, VaultNote } from '../types';
import { getAgentRunsFromNotes } from './agentRuns';
import {
  buildGraphData,
  getBrokenLinks,
  getOrphanNotes,
  getWorkspaceEntityNotes,
} from './markdown';
import { loadChatSessions } from './chatHistory';

const SNAPSHOT_KEY = 'agent-vault-usage-snapshots';
const SNAPSHOT_VERSION = 1;
const SNAPSHOT_RETENTION_DAYS = 90;

export interface DailySnapshot {
  date: string;
  notes: number;
  links: number;
  orphans: number;
  broken: number;
  tasks: number;
  completed: number;
  tags: number;
  agents: number;
  skills: number;
  tools: number;
  runs: number;
  runSuccess: number;
  runFailed: number;
  runsCancelled: number;
  runsAwaiting: number;
  runsRunning: number;
  runsPlanned: number;
  toolCalls: number;
  toolSuccesses: number;
  toolErrors: number;
  messagesSent: number;
  messagesReceived: number;
  activeChats: number;
  notesUpdated: number;
  newNotes: number;
  estimatedMinutesSaved: number;
}

export interface StatusMixItem {
  status: AgentRun['status'];
  label: string;
  value: number;
  color: string;
}

export interface TopAgentItem {
  key: string;
  name: string;
  value: number;
  successRate: number;
}

export interface TopToolItem {
  id: string;
  name: string;
  value: number;
  successRate: number;
}

export interface TopSkillItem {
  key: string;
  name: string;
  value: number;
}

export interface UsageSummary {
  totalRuns: number;
  successRate: number;
  runsPerDay: Array<{ date: string; value: number }>;
  messagesPerDay: Array<{ date: string; value: number }>;
  tasksClosedPerDay: Array<{ date: string; value: number }>;
  tasksOpenedPerDay: Array<{ date: string; value: number }>;
  statusMix: StatusMixItem[];
  topAgents: TopAgentItem[];
  topTools: TopToolItem[];
  topSkills: TopSkillItem[];
  totalMessages: number;
  totalTasksClosed: number;
  totalTasksOpened: number;
  estimatedMinutesSaved: number;
  daysOfData: number;
  hasData: boolean;
}

const STATUS_LABELS: Record<AgentRun['status'], string> = {
  planned: 'Planned',
  running: 'Running',
  awaiting_approval: 'Awaiting',
  completed: 'Completed',
  failed: 'Failed',
  cancelled: 'Cancelled',
  skipped: 'Skipped',
};

const STATUS_COLORS: Record<AgentRun['status'], string> = {
  planned: 'var(--muted)',
  running: 'var(--primary)',
  awaiting_approval: 'var(--warning)',
  completed: 'var(--positive)',
  failed: 'var(--danger)',
  cancelled: 'var(--muted)',
  skipped: 'var(--muted)',
};

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed as T;
  } catch {
    return fallback;
  }
}

function saveJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Silently ignore storage errors (quota exceeded, private mode, etc.)
  }
}

function todayKey(): string {
  const d = new Date();
  return formatDayKey(d.getTime());
}

function formatDayKey(timestamp: number): string {
  const d = new Date(timestamp);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function dayKeyToStart(dayKey: string): number {
  return new Date(`${dayKey}T00:00:00`).getTime();
}

function emptySnapshot(date: string): DailySnapshot {
  return {
    date,
    notes: 0,
    links: 0,
    orphans: 0,
    broken: 0,
    tasks: 0,
    completed: 0,
    tags: 0,
    agents: 0,
    skills: 0,
    tools: 0,
    runs: 0,
    runSuccess: 0,
    runFailed: 0,
    runsCancelled: 0,
    runsAwaiting: 0,
    runsRunning: 0,
    runsPlanned: 0,
    toolCalls: 0,
    toolSuccesses: 0,
    toolErrors: 0,
    messagesSent: 0,
    messagesReceived: 0,
    activeChats: 0,
    notesUpdated: 0,
    newNotes: 0,
    estimatedMinutesSaved: 0,
  };
}

function loadRaw(): { version: number; snapshots: Record<string, DailySnapshot> } {
  const raw = loadJson<{ version: number; snapshots: Record<string, DailySnapshot> } | null>(
    SNAPSHOT_KEY,
    null,
  );
  if (!raw || typeof raw !== 'object' || !raw.snapshots) {
    return { version: SNAPSHOT_VERSION, snapshots: {} };
  }
  if (raw.version !== SNAPSHOT_VERSION) {
    return { version: SNAPSHOT_VERSION, snapshots: {} };
  }
  return raw;
}

function saveRaw(data: { version: number; snapshots: Record<string, DailySnapshot> }): void {
  saveJson(SNAPSHOT_KEY, data);
}

function trimSnapshots(snapshots: Record<string, DailySnapshot>): Record<string, DailySnapshot> {
  const cutoff = Date.now() - SNAPSHOT_RETENTION_DAYS * 86_400_000;
  const cutoffKey = formatDayKey(cutoff);
  const trimmed: Record<string, DailySnapshot> = {};
  for (const key of Object.keys(snapshots)) {
    if (key >= cutoffKey) {
      trimmed[key] = snapshots[key];
    }
  }
  return trimmed;
}

function computeSnapshotForDate(
  date: string,
  notes: VaultNote[],
  runs: AgentRun[],
  sessions: ChatSession[],
): DailySnapshot {
  const snap = emptySnapshot(date);

  // Vault-level counts
  const graph = buildGraphData(notes);
  const orphans = getOrphanNotes(notes);
  const broken = getBrokenLinks(notes);
  const allTasks = notes.flatMap((n) => n.tasks);
  const completedTasks = allTasks.filter((t) => t.completed);
  const tags = new Set<string>();
  for (const n of notes) {
    for (const t of n.tags) tags.add(t.toLowerCase());
  }

  const dayStart = dayKeyToStart(date);
  const dayEnd = dayStart + 86_400_000;

  snap.notes = notes.length;
  snap.links = graph.links.length;
  snap.orphans = orphans.length;
  snap.broken = broken.length;
  snap.tasks = allTasks.length;
  snap.completed = completedTasks.length;
  snap.tags = tags.size;
  snap.agents = getWorkspaceEntityNotes(notes).filter((n) =>
    n.path.toLowerCase().includes('/agents/'),
  ).length;
  snap.skills = getWorkspaceEntityNotes(notes).filter((n) =>
    n.path.toLowerCase().includes('/skills/'),
  ).length;
  snap.tools = getWorkspaceEntityNotes(notes).filter((n) =>
    n.path.toLowerCase().includes('/tools/'),
  ).length;

  // Notes updated today / new notes today
  for (const n of notes) {
    if (n.updatedAt >= dayStart && n.updatedAt < dayEnd) {
      snap.notesUpdated += 1;
    }
  }
  // We can't reliably know "created" without a file-system birthtime, so treat
  // notes whose updatedAt falls in the same day as their createdAt heuristic:
  // use the earliest updatedAt we've seen for that note. For simplicity we
  // approximate "new" as notes with updatedAt on a day where the snapshot has
  // not previously seen a non-zero notesUpdated.
  const earliestForDate = (() => {
    const matches = notes.filter((n) => n.updatedAt >= dayStart && n.updatedAt < dayEnd);
    if (matches.length === 0) return 0;
    // Heuristic: consider "new" the notes whose updatedAt is the only update
    // we have a record of (i.e., not present in older snapshots). We compute
    // this by checking if the note's updatedAt is within 60 seconds of a
    // created-like marker, which we don't have. Skip — leave newNotes=0.
    return 0;
  })();
  snap.newNotes = earliestForDate;

  // Runs that occurred on this day (createdAt in day window)
  const todaysRuns = runs.filter((r) => r.createdAt >= dayStart && r.createdAt < dayEnd);
  snap.runs = todaysRuns.length;
  for (const r of todaysRuns) {
    if (r.status === 'completed') snap.runSuccess += 1;
    else if (r.status === 'failed') snap.runFailed += 1;
    else if (r.status === 'cancelled') snap.runsCancelled += 1;
    else if (r.status === 'awaiting_approval') snap.runsAwaiting += 1;
    else if (r.status === 'running') snap.runsRunning += 1;
    else if (r.status === 'planned') snap.runsPlanned += 1;
  }

  // Tool calls across all runs in this day
  for (const r of todaysRuns) {
    snap.toolCalls += r.toolTranscript.length;
    for (const t of r.toolTranscript) {
      if (t.error) snap.toolErrors += 1;
      else snap.toolSuccesses += 1;
    }
  }

  // Chat sessions active on this day (createdAt or updatedAt falls in window)
  const todaysSessions = sessions.filter(
    (s) =>
      (s.createdAt >= dayStart && s.createdAt < dayEnd) ||
      (s.updatedAt >= dayStart && s.updatedAt < dayEnd),
  );
  snap.activeChats = todaysSessions.length;
  for (const s of todaysSessions) {
    for (const m of s.messages) {
      if (m.timestamp >= dayStart && m.timestamp < dayEnd) {
        if (m.role === 'user') snap.messagesSent += 1;
        else if (m.role === 'assistant') snap.messagesReceived += 1;
      }
    }
  }

  // Estimated time saved: completed runs * median run duration, floored at 2 min
  const completedToday = todaysRuns.filter((r) => r.status === 'completed' && r.completedAt);
  if (completedToday.length > 0) {
    const durations = completedToday
      .map((r) => ((r.completedAt ?? 0) - r.createdAt) / 60000)
      .filter((d) => d > 0)
      .sort((a, b) => a - b);
    const median = durations[Math.floor(durations.length / 2)] || 0;
    const perRun = Math.max(2, Math.round(median));
    snap.estimatedMinutesSaved = perRun * completedToday.length;
  }

  return snap;
}

export function recordDailySnapshot(
  notes: VaultNote[],
  runsInput?: AgentRun[],
  sessionsInput?: ChatSession[],
): DailySnapshot {
  const date = todayKey();
  const runs = runsInput ?? getAgentRunsFromNotes(notes);
  const sessions = sessionsInput ?? loadChatSessions();
  const computed = computeSnapshotForDate(date, notes, runs, sessions);

  const raw = loadRaw();
  raw.snapshots[date] = computed;
  raw.snapshots = trimSnapshots(raw.snapshots);
  saveRaw(raw);

  return computed;
}

export function loadSnapshots(days = SNAPSHOT_RETENTION_DAYS): DailySnapshot[] {
  const raw = loadRaw();
  const cutoff = Date.now() - days * 86_400_000;
  const cutoffKey = formatDayKey(cutoff);
  const keys = Object.keys(raw.snapshots)
    .filter((k) => k >= cutoffKey)
    .sort();
  return keys.map((k) => raw.snapshots[k]);
}

export function resetSnapshots(): void {
  try {
    localStorage.removeItem(SNAPSHOT_KEY);
  } catch {
    // Silently ignore
  }
}

function buildStatusMix(snapshots: DailySnapshot[]): StatusMixItem[] {
  const totals: Record<AgentRun['status'], number> = {
    completed: 0,
    failed: 0,
    cancelled: 0,
    awaiting_approval: 0,
    running: 0,
    planned: 0,
    skipped: 0,
  };
  for (const s of snapshots) {
    totals.completed += s.runSuccess;
    totals.failed += s.runFailed;
    totals.cancelled += s.runsCancelled;
    totals.awaiting_approval += s.runsAwaiting;
    totals.running += s.runsRunning;
    totals.planned += s.runsPlanned;
  }
  const order: AgentRun['status'][] = [
    'completed',
    'failed',
    'cancelled',
    'awaiting_approval',
    'running',
    'planned',
    'skipped',
  ];
  return order
    .filter((status) => totals[status] > 0)
    .map((status) => ({
      status,
      label: STATUS_LABELS[status],
      value: totals[status],
      color: STATUS_COLORS[status],
    }));
}

function dayKeyNDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return formatDayKey(d.getTime());
}

function fillDateRange(snapshots: DailySnapshot[], days: number): DailySnapshot[] {
  const map = new Map<string, DailySnapshot>();
  for (const s of snapshots) map.set(s.date, s);
  const out: DailySnapshot[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const key = dayKeyNDaysAgo(i);
    out.push(map.get(key) ?? emptySnapshot(key));
  }
  return out;
}

function buildTopAgents(notes: VaultNote[], days: number): TopAgentItem[] {
  const runs = getAgentRunsFromNotes(notes);
  const cutoff = Date.now() - days * 86_400_000;
  const recent = runs.filter((r) => r.createdAt >= cutoff);
  const map = new Map<string, { name: string; value: number; success: number; failed: number }>();
  for (const r of recent) {
    const key = r.agentKey || r.agent;
    const entry = map.get(key) ?? { name: r.agent, value: 0, success: 0, failed: 0 };
    entry.value += 1;
    if (r.status === 'completed') entry.success += 1;
    else if (r.status === 'failed') entry.failed += 1;
    map.set(key, entry);
  }
  return Array.from(map.entries())
    .map(([key, v]) => ({
      key,
      name: v.name,
      value: v.value,
      successRate: v.value > 0 ? Math.round((v.success / v.value) * 100) : 0,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);
}

function buildTopTools(notes: VaultNote[], tools: Tool[], days: number): TopToolItem[] {
  const runs = getAgentRunsFromNotes(notes);
  const cutoff = Date.now() - days * 86_400_000;
  const recent = runs.filter((r) => r.createdAt >= cutoff);
  const names = new Map<string, string>();
  for (const t of tools) names.set(t.id, t.name);
  const map = new Map<string, { name: string; value: number; success: number; failed: number }>();
  for (const r of recent) {
    const ids = new Set<string>();
    for (const id of r.toolsUsed) {
      const cleaned = id.replace(/^\[\[/, '').replace(/\]\]$/, '').trim();
      if (cleaned && cleaned !== '(none)') ids.add(cleaned);
    }
    for (const t of r.toolTranscript) {
      if (t.toolId) {
        ids.add(t.toolId);
        if (t.toolName && !names.has(t.toolId)) names.set(t.toolId, t.toolName);
      }
    }
    for (const id of ids) {
      const entry = map.get(id) ?? { name: names.get(id) ?? id, value: 0, success: 0, failed: 0 };
      entry.value += 1;
      map.set(id, entry);
    }
    for (const t of r.toolTranscript) {
      if (!t.toolId) continue;
      const entry = map.get(t.toolId) ?? {
        name: names.get(t.toolId) ?? t.toolId,
        value: 0,
        success: 0,
        failed: 0,
      };
      if (t.error) entry.failed += 1;
      else entry.success += 1;
      map.set(t.toolId, entry);
    }
  }
  return Array.from(map.entries())
    .map(([id, v]) => ({
      id,
      name: v.name,
      value: v.value,
      successRate: v.value > 0 ? Math.round((v.success / v.value) * 100) : 0,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);
}

function buildTopSkills(notes: VaultNote[], days: number): TopSkillItem[] {
  const runs = getAgentRunsFromNotes(notes);
  const cutoff = Date.now() - days * 86_400_000;
  const recent = runs.filter((r) => r.createdAt >= cutoff);
  const map = new Map<string, { name: string; value: number }>();
  for (const r of recent) {
    const rawKey = r.skillKey ?? r.skill ?? '';
    const key = rawKey.replace(/^\[\[/, '').replace(/\]\]$/, '').trim().toLowerCase();
    if (!key) continue;
    const entry = map.get(key) ?? { name: r.skill ?? rawKey, value: 0 };
    entry.value += 1;
    map.set(key, entry);
  }
  return Array.from(map.entries())
    .map(([key, v]) => ({ key, name: v.name, value: v.value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);
}

export function loadSummary(notes: VaultNote[], days = 30, tools: Tool[] = []): UsageSummary {
  const raw = loadSnapshots(SNAPSHOT_RETENTION_DAYS);
  const filled = fillDateRange(raw, days);

  const totalRuns = filled.reduce((s, x) => s + x.runs, 0);
  const totalSuccess = filled.reduce((s, x) => s + x.runSuccess, 0);
  const totalFailed = filled.reduce((s, x) => s + x.runFailed, 0);
  const totalMessages = filled.reduce((s, x) => s + x.messagesSent + x.messagesReceived, 0);
  const totalMinutes = filled.reduce((s, x) => s + x.estimatedMinutesSaved, 0);

  // Tasks closed this week
  const last7 = fillDateRange(raw, 7);
  const totalTasksClosed = last7.reduce((s, x) => s + x.completed, 0);
  const totalTasksOpened = last7.reduce((s, x) => s + x.tasks, 0);

  const hasData = filled.some(
    (s) => s.runs > 0 || s.toolCalls > 0 || s.messagesSent > 0 || s.notesUpdated > 0,
  );

  return {
    totalRuns,
    successRate: totalRuns > 0 ? Math.round((totalSuccess / totalRuns) * 100) : 0,
    runsPerDay: filled.map((s) => ({ date: s.date, value: s.runs })),
    messagesPerDay: filled.map((s) => ({
      date: s.date,
      value: s.messagesSent + s.messagesReceived,
    })),
    tasksClosedPerDay: filled.map((s) => ({ date: s.date, value: s.completed })),
    tasksOpenedPerDay: filled.map((s) => ({ date: s.date, value: s.tasks })),
    statusMix: buildStatusMix(filled),
    topAgents: buildTopAgents(notes, days),
    topTools: buildTopTools(notes, tools, days),
    topSkills: buildTopSkills(notes, days),
    totalMessages,
    totalTasksClosed,
    totalTasksOpened,
    estimatedMinutesSaved: totalMinutes,
    daysOfData: days,
    hasData,
  };
}

export function exportSnapshotsCsv(snapshots: DailySnapshot[]): string {
  const headers = [
    'date',
    'notes',
    'links',
    'orphans',
    'broken',
    'tasks',
    'completed',
    'tags',
    'agents',
    'skills',
    'tools',
    'runs',
    'runSuccess',
    'runFailed',
    'runsCancelled',
    'runsAwaiting',
    'runsRunning',
    'runsPlanned',
    'toolCalls',
    'toolSuccesses',
    'toolErrors',
    'messagesSent',
    'messagesReceived',
    'activeChats',
    'notesUpdated',
    'estimatedMinutesSaved',
  ];
  const lines: string[] = [headers.join(',')];
  for (const s of snapshots) {
    lines.push(
      headers.map((h) => String((s as unknown as Record<string, unknown>)[h] ?? 0)).join(','),
    );
  }
  return lines.join('\n');
}

export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function buildWeeklySummaryMarkdown(summary: UsageSummary, days = 7): string {
  if (!summary.hasData) {
    return '_No analytics data yet. Run an agent or edit a note to start collecting._';
  }
  const lines: string[] = [];
  lines.push(`**Agent Vault — last ${days} days**`);
  lines.push('');
  lines.push(`- Agent runs: **${summary.totalRuns}** (${summary.successRate}% success)`);
  lines.push(`- Messages exchanged: **${summary.totalMessages}**`);
  lines.push(`- Tasks completed (latest snapshot): **${summary.totalTasksClosed}**`);
  lines.push(
    `- Estimated time saved: **${Math.round(summary.estimatedMinutesSaved / 60)} h ${summary.estimatedMinutesSaved % 60} m**`,
  );
  if (summary.topAgents.length > 0) {
    lines.push('');
    lines.push('**Top agents**');
    for (const a of summary.topAgents) {
      lines.push(`- ${a.name} — ${a.value} runs (${a.successRate}% success)`);
    }
  }
  if (summary.topTools.length > 0) {
    lines.push('');
    lines.push('**Top tools**');
    for (const t of summary.topTools) {
      lines.push(`- ${t.name} — ${t.value} invocations (${t.successRate}% success)`);
    }
  }
  return lines.join('\n');
}
