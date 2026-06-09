import {
  Bot,
  CheckCircle2,
  ChevronDown,
  Circle,
  FileText,
  LayoutGrid,
  List,
  Loader2,
  MessageCirclePlus,
  Search,
  Tag,
  Table2,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  ChatAgentBusyState,
  TaskConversationMeta,
  TaskFilter,
  TaskItem,
  VaultNote,
} from '../types';
import { updateTaskAssignee, updateTaskCompletion } from '../utils/markdown';
import { getNoteKey } from '../utils/noteKey';
import { canWriteVaultNote, writeNote } from '../utils/vault';
import { loadTasksView, saveTasksView, type TasksViewMode } from '../utils/preferences';

interface TasksViewProps {
  notes: VaultNote[];
  sampleMode: boolean;
  agents: VaultNote[];
  taskConversations: Record<string, TaskConversationMeta>;
  agentBusyState: ChatAgentBusyState;
  activeAgentSessionId: string | null;
  onSelectNote: (path: string) => void;
  onNotesChange: (notes: VaultNote[]) => void;
  onPingAgent: (task: TaskItem, agent: VaultNote) => void;
  onOpenTaskConversation: (task: TaskItem) => void;
  onOpenAgentsView: () => void;
}

type GroupBy = 'none' | 'note' | 'due' | 'assignee' | 'tag';
type QuickFilter = 'overdue' | 'due-today' | 'agent-owned';

type KanbanColumnId = 'overdue' | 'today' | 'this-week' | 'later' | 'no-date' | 'done';
type KanbanColumn = { id: KanbanColumnId; label: string; tasks: TaskItem[] };

type TableSortKey = 'task' | 'note' | 'due' | 'assignee';
type TableSortDir = 'asc' | 'desc';

const KANBAN_COLUMNS: { id: KanbanColumnId; label: string }[] = [
  { id: 'overdue', label: 'Overdue' },
  { id: 'today', label: 'Due today' },
  { id: 'this-week', label: 'This week' },
  { id: 'later', label: 'Later' },
  { id: 'no-date', label: 'No due date' },
  { id: 'done', label: 'Done' },
];

function isOverdue(due?: string, completed?: boolean): boolean {
  if (!due || completed) return false;
  const d = new Date(due);
  if (isNaN(d.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d.getTime() < today.getTime();
}

function isDueToday(due?: string, completed?: boolean): boolean {
  if (!due || completed) return false;
  const d = new Date(due);
  if (isNaN(d.getTime())) return false;
  const today = new Date();
  return (
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  );
}

function isDueThisWeek(due?: string, completed?: boolean): boolean {
  if (!due || completed) return false;
  const d = new Date(due);
  if (isNaN(d.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const weekEnd = new Date(today);
  weekEnd.setDate(today.getDate() + 7);
  return d.getTime() >= tomorrow.getTime() && d.getTime() < weekEnd.getTime();
}

function resolveAgentForTask(agents: VaultNote[], task: TaskItem): VaultNote | null {
  if (!task.assignee) return null;
  const needle = task.assignee.toLowerCase();
  return (
    agents.find(
      (agent) =>
        agent.title.toLowerCase() === needle ||
        agent.path.toLowerCase().includes(`/agents/${needle}/`),
    ) ?? null
  );
}

function bucketKanbanColumn(task: TaskItem): KanbanColumnId {
  if (task.completed) return 'done';
  if (isOverdue(task.due, task.completed)) return 'overdue';
  if (isDueToday(task.due, task.completed)) return 'today';
  if (isDueThisWeek(task.due, task.completed)) return 'this-week';
  if (task.due) return 'later';
  return 'no-date';
}

function dueDateLabel(due?: string): {
  text: string;
  tone: 'overdue' | 'today' | 'future' | 'none';
} {
  if (!due) return { text: '—', tone: 'none' };
  if (isOverdue(due)) return { text: `Due ${due}`, tone: 'overdue' };
  if (isDueToday(due)) return { text: `Due ${due}`, tone: 'today' };
  return { text: `Due ${due}`, tone: 'future' };
}

function getConversationState(
  meta: TaskConversationMeta | undefined,
): TaskConversationMeta['agentState'] {
  return meta?.agentState ?? 'not_started';
}

function conversationStateLabel(state: TaskConversationMeta['agentState']): string {
  if (state === 'not_started') return 'Not started';
  if (state === 'awaiting_approval') return 'Awaiting approval';
  return state.charAt(0).toUpperCase() + state.slice(1);
}

function conversationStateClass(state: TaskConversationMeta['agentState']): string {
  if (state === 'busy' || state === 'awaiting_approval') return 'busy';
  if (state === 'error') return 'error';
  if (state === 'idle') return 'idle';
  return 'not-started';
}

function compareNullableDate(a?: string, b?: string): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a.localeCompare(b);
}

export function TasksView({
  notes,
  sampleMode,
  agents,
  taskConversations,
  agentBusyState,
  activeAgentSessionId,
  onSelectNote,
  onNotesChange,
  onPingAgent,
  onOpenTaskConversation,
  onOpenAgentsView,
}: TasksViewProps) {
  const [filter, setFilter] = useState<TaskFilter>('all');
  const [query, setQuery] = useState('');
  const [togglingTask, setTogglingTask] = useState<string | null>(null);
  const [assigningTask, setAssigningTask] = useState<string | null>(null);
  const [savingAssignTask, setSavingAssignTask] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState<GroupBy>('none');
  const [quickFilters, setQuickFilters] = useState<Set<QuickFilter>>(new Set());
  const [viewMode, setViewMode] = useState<TasksViewMode>(() => loadTasksView());
  const [tableSort, setTableSort] = useState<{ key: TableSortKey; dir: TableSortDir }>({
    key: 'due',
    dir: 'asc',
  });

  useEffect(() => {
    saveTasksView(viewMode);
  }, [viewMode]);

  const tasks = useMemo(() => notes.flatMap((note) => note.tasks), [notes]);

  const agentNotePaths = useMemo(() => {
    const set = new Set<string>();
    notes.forEach((note) => {
      if (note.tags.includes('agent') || note.frontmatter.type === 'agent') {
        set.add(getNoteKey(note));
      }
    });
    return set;
  }, [notes]);

  const sortedAgents = useMemo(
    () => [...agents].sort((a, b) => a.title.localeCompare(b.title)),
    [agents],
  );

  const visible = useMemo(() => {
    return tasks.filter((task) => {
      if (filter === 'active' && task.completed) return false;
      if (filter === 'completed' && !task.completed) return false;
      if (
        query.trim() &&
        ![task.text, task.noteTitle, task.assignee, task.tags.join(' ')]
          .join(' ')
          .toLowerCase()
          .includes(query.toLowerCase())
      )
        return false;
      if (quickFilters.has('overdue') && !isOverdue(task.due, task.completed)) return false;
      if (quickFilters.has('due-today') && !isDueToday(task.due, task.completed)) return false;
      if (quickFilters.has('agent-owned') && !agentNotePaths.has(task.noteKey)) return false;
      return true;
    });
  }, [tasks, filter, query, quickFilters, agentNotePaths]);

  const grouped = useMemo(() => {
    if (groupBy === 'none') return [{ key: 'all', label: 'All tasks', items: visible }];
    const map = new Map<string, { key: string; label: string; items: typeof visible }>();
    visible.forEach((task) => {
      let key = 'other';
      let label = 'Ungrouped';
      if (groupBy === 'note') {
        key = task.noteKey;
        label = task.noteTitle;
      } else if (groupBy === 'due') {
        key = task.due || 'no-date';
        label = task.due ? `Due ${task.due}` : 'No due date';
      } else if (groupBy === 'assignee') {
        key = task.assignee || 'unassigned';
        label = task.assignee ? `@${task.assignee}` : 'Unassigned';
      } else if (groupBy === 'tag') {
        key = task.tags[0] || 'untagged';
        label = task.tags[0] ? `#${task.tags[0]}` : 'Untagged';
      }
      if (!map.has(key)) map.set(key, { key, label, items: [] as typeof visible });
      map.get(key)!.items.push(task);
    });
    return Array.from(map.values());
  }, [visible, groupBy]);

  const kanbanColumns = useMemo<KanbanColumn[]>(() => {
    const buckets = new Map<KanbanColumnId, TaskItem[]>();
    KANBAN_COLUMNS.forEach((c) => buckets.set(c.id, []));
    visible.forEach((task) => {
      buckets.get(bucketKanbanColumn(task))!.push(task);
    });
    return KANBAN_COLUMNS.map((c) => ({ id: c.id, label: c.label, tasks: buckets.get(c.id)! }));
  }, [visible]);

  const sortedTableRows = useMemo(() => {
    const rows = [...visible];
    rows.sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      const dir = tableSort.dir === 'asc' ? 1 : -1;
      switch (tableSort.key) {
        case 'task':
          return a.text.localeCompare(b.text) * dir;
        case 'note':
          return a.noteTitle.localeCompare(b.noteTitle) * dir;
        case 'due':
          return compareNullableDate(a.due, b.due) * dir;
        case 'assignee':
          return (a.assignee ?? '').localeCompare(b.assignee ?? '') * dir;
      }
    });
    return rows;
  }, [visible, tableSort]);

  const writeTaskMutation = async (
    task: TaskItem,
    nextContent: string,
    busyKey: 'toggle' | 'assign',
    onError: string,
  ) => {
    const note = notes.find((n) => getNoteKey(n) === task.noteKey);
    if (!note) return;
    if (busyKey === 'toggle') setTogglingTask(task.id);
    else setSavingAssignTask(task.id);
    try {
      const updated = await writeNote(note, nextContent);
      onNotesChange(notes.map((n) => (getNoteKey(n) === getNoteKey(updated) ? updated : n)));
    } catch (error) {
      console.error(onError, error);
      alert(`${onError} The file may be locked or permissions denied.`);
    } finally {
      if (busyKey === 'toggle') setTogglingTask(null);
      else setSavingAssignTask(null);
    }
  };

  const handleTaskToggle = async (task: TaskItem, currentCompleted: boolean) => {
    const note = notes.find((n) => getNoteKey(n) === task.noteKey);
    if (!note) return;
    if (!canWriteVaultNote(note)) {
      alert(
        'This task belongs to Agent or Shared content. Only personal vault tasks can be toggled.',
      );
      return;
    }
    const nextContent = updateTaskCompletion(note.content, task.line, !currentCompleted, task.text);
    await writeTaskMutation(task, nextContent, 'toggle', 'Failed to save task toggle.');
  };

  const handleAssign = async (task: TaskItem, agentName: string | null) => {
    const note = notes.find((n) => getNoteKey(n) === task.noteKey);
    if (!note) return;
    if (!canWriteVaultNote(note)) {
      alert(
        'This task belongs to Agent or Shared content. Only personal vault tasks can be assigned.',
      );
      return;
    }
    const nextContent = updateTaskAssignee(note.content, task.line, agentName, task.text);
    if (nextContent === note.content) {
      alert('Could not locate the task line to assign. The note may have been edited elsewhere.');
      return;
    }
    setAssigningTask(null);
    await writeTaskMutation(task, nextContent, 'assign', 'Failed to save task assignment.');
  };

  const toggleQuickFilter = (qf: QuickFilter) => {
    setQuickFilters((prev) => {
      const next = new Set(prev);
      if (next.has(qf)) next.delete(qf);
      else next.add(qf);
      return next;
    });
  };

  const setView = (next: TasksViewMode) => {
    setViewMode(next);
    if (next !== 'list' && groupBy !== 'none') setGroupBy('none');
  };

  const cycleTableSort = (key: TableSortKey) => {
    setTableSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' },
    );
  };

  const completedCount = tasks.filter((t) => t.completed).length;
  const progress = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;
  const currentNote = notes[0];

  const renderRow = (task: TaskItem) => (
    <TaskRow
      key={task.id}
      task={task}
      note={notes.find((n) => getNoteKey(n) === task.noteKey) ?? null}
      agents={sortedAgents}
      toggling={togglingTask === task.id}
      savingAssign={savingAssignTask === task.id}
      pickerOpen={assigningTask === task.id}
      onToggle={handleTaskToggle}
      onAssign={handleAssign}
      onOpenPicker={(open) => setAssigningTask(open ? task.id : null)}
      onPing={onPingAgent}
      onOpenConversation={onOpenTaskConversation}
      onSelect={onSelectNote}
      onOpenAgentsView={onOpenAgentsView}
      conversation={taskConversations[task.id]}
      globalBusyState={agentBusyState}
      activeAgentSessionId={activeAgentSessionId}
    />
  );

  return (
    <main className="page-scroll view-page">
      <div className="page-header">
        <div>
          <span className="eyebrow">Markdown tasks</span>
          <h1>
            <CheckCircle2 size={20} /> Tasks
          </h1>
          <p>
            {tasks.length === 0 ? (
              <>
                Collected from <code>- [ ]</code> and <code>- [x]</code> lines across your vault.
              </>
            ) : (
              <>
                {completedCount} of {tasks.length} complete ({progress}%)
              </>
            )}
          </p>
          {tasks.length > 0 && (
            <div
              className="tasks-progress-bar"
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className="tasks-progress-fill" style={{ width: `${progress}%` }} />
            </div>
          )}
        </div>
        <div className="graph-toolbar">
          <label className="mini-search">
            <Search size={13} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search tasks..."
            />
          </label>
          <button
            className={`ghost-button ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All
          </button>
          <button
            className={`ghost-button ${filter === 'active' ? 'active' : ''}`}
            onClick={() => setFilter('active')}
          >
            Active
          </button>
          <button
            className={`ghost-button ${filter === 'completed' ? 'active' : ''}`}
            onClick={() => setFilter('completed')}
          >
            Completed
          </button>
          <div className="tasks-view-toggle" role="group" aria-label="Tasks view mode">
            <button
              type="button"
              className={`icon-btn ${viewMode === 'kanban' ? 'active' : ''}`}
              onClick={() => setView('kanban')}
              title="Kanban view"
              aria-label="Kanban view"
              aria-pressed={viewMode === 'kanban'}
            >
              <LayoutGrid size={14} />
            </button>
            <button
              type="button"
              className={`icon-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setView('list')}
              title="List view"
              aria-label="List view"
              aria-pressed={viewMode === 'list'}
            >
              <List size={14} />
            </button>
            <button
              type="button"
              className={`icon-btn ${viewMode === 'table' ? 'active' : ''}`}
              onClick={() => setView('table')}
              title="Table view"
              aria-label="Table view"
              aria-pressed={viewMode === 'table'}
            >
              <Table2 size={14} />
            </button>
          </div>
        </div>
      </div>

      <div className="tasks-secondary-toolbar">
        {viewMode === 'list' && (
          <div className="tasks-group-control">
            <label htmlFor="tasks-group-by">Group by:</label>
            <select
              id="tasks-group-by"
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as GroupBy)}
              className="tasks-group-select"
            >
              <option value="none">None</option>
              <option value="note">Note</option>
              <option value="due">Due date</option>
              <option value="assignee">Assignee</option>
              <option value="tag">Tag</option>
            </select>
          </div>
        )}
        <div className="tasks-quick-filters">
          <button
            type="button"
            className={`quick-filter-chip ${quickFilters.has('overdue') ? 'active' : ''}`}
            onClick={() => toggleQuickFilter('overdue')}
          >
            Overdue
          </button>
          <button
            type="button"
            className={`quick-filter-chip ${quickFilters.has('due-today') ? 'active' : ''}`}
            onClick={() => toggleQuickFilter('due-today')}
          >
            Due today
          </button>
          <button
            type="button"
            className={`quick-filter-chip ${quickFilters.has('agent-owned') ? 'active' : ''}`}
            onClick={() => toggleQuickFilter('agent-owned')}
          >
            Agent-owned
          </button>
          {quickFilters.size > 0 && (
            <button
              type="button"
              className="quick-filter-clear"
              onClick={() => setQuickFilters(new Set())}
            >
              <X size={10} /> Clear
            </button>
          )}
        </div>
      </div>

      {taskConversations && Object.keys(taskConversations).length > 0 && (
        <div className="tasks-conversations-drawer">
          <div className="tasks-conversations-header">
            <h3>
              <MessageCirclePlus size={14} /> Task conversations
              <span className="count-badge">{Object.keys(taskConversations).length}</span>
            </h3>
            <p>Click a task to open its focused conversation in the chat panel.</p>
          </div>
          <div className="tasks-conversations-grid">
            {Object.entries(taskConversations)
              .map(([taskId, meta]) => {
                const task = tasks.find((t) => t.id === taskId);
                if (!task) return null;
                return { task, meta };
              })
              .filter(
                (entry): entry is { task: TaskItem; meta: TaskConversationMeta } => entry !== null,
              )
              .sort((a, b) => b.meta.updatedAt - a.meta.updatedAt)
              .slice(0, 6)
              .map(({ task, meta }) => {
                const conversationState = getConversationState(meta);
                return (
                  <div key={task.id} className="task-conversation-card">
                    <button
                      type="button"
                      className="task-conversation-card-main"
                      onClick={() => onOpenTaskConversation(task)}
                      title={task.text}
                    >
                      <span className="task-conversation-card-text">{task.text}</span>
                      <span className="task-conversation-card-meta">
                        <FileText size={11} /> {task.noteTitle}
                      </span>
                    </button>
                    <div className="task-conversation-card-actions">
                      <span
                        className={`task-agent-state task-agent-state--${conversationStateClass(conversationState)}`}
                      >
                        {(conversationState === 'busy' ||
                          conversationState === 'awaiting_approval') && (
                          <Loader2 size={10} className="spinning" />
                        )}
                        {conversationStateLabel(conversationState)}
                      </span>
                      <button
                        type="button"
                        className="task-conversation-card-link"
                        onClick={() => onSelectNote(task.noteKey)}
                        title="Open source note"
                        aria-label={`Open source note ${task.noteTitle}`}
                      >
                        Jump to note
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {visible.length === 0 ? (
        <div className="tasks-empty-state">
          <CheckCircle2 size={28} />
          <h3>No tasks match this filter</h3>
          <p>
            {tasks.length === 0 ? (
              <>
                Create a task by adding <code>- [ ] task text</code> to any note.
              </>
            ) : (
              'Try adjusting your filter or quick filters.'
            )}
          </p>
          {tasks.length === 0 && currentNote && (
            <button
              className="primary-button"
              onClick={() => onSelectNote(getNoteKey(currentNote))}
            >
              Open first note
            </button>
          )}
        </div>
      ) : viewMode === 'kanban' ? (
        <div className="task-kanban-board">
          {kanbanColumns.map((column) => (
            <div key={column.id} className="task-kanban-column">
              <div className="task-kanban-column-header">
                <span className="task-kanban-column-label">{column.label}</span>
                <span className="count-badge">{column.tasks.length}</span>
              </div>
              <div className="task-kanban-column-body">
                {column.tasks.length === 0 ? (
                  <div className="task-kanban-empty">No tasks</div>
                ) : (
                  column.tasks.map((task) => (
                    <KanbanCard
                      key={task.id}
                      task={task}
                      note={notes.find((n) => getNoteKey(n) === task.noteKey) ?? null}
                      agents={sortedAgents}
                      toggling={togglingTask === task.id}
                      savingAssign={savingAssignTask === task.id}
                      pickerOpen={assigningTask === task.id}
                      onToggle={handleTaskToggle}
                      onAssign={handleAssign}
                      onOpenPicker={(open) => setAssigningTask(open ? task.id : null)}
                      onPing={onPingAgent}
                      onOpenConversation={onOpenTaskConversation}
                      onSelect={onSelectNote}
                      onOpenAgentsView={onOpenAgentsView}
                      conversation={taskConversations[task.id]}
                      globalBusyState={agentBusyState}
                      activeAgentSessionId={activeAgentSessionId}
                    />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      ) : viewMode === 'table' ? (
        <div className="task-table-wrap">
          <table className="task-table" role="grid">
            <thead>
              <tr>
                <th scope="col" className="task-table-col-status">
                  Status
                </th>
                <th scope="col" className="task-table-col-task">
                  <button
                    type="button"
                    className={`task-table-sort ${tableSort.key === 'task' ? 'active' : ''}`}
                    onClick={() => cycleTableSort('task')}
                  >
                    Task {tableSort.key === 'task' ? (tableSort.dir === 'asc' ? '↑' : '↓') : ''}
                  </button>
                </th>
                <th scope="col" className="task-table-col-note">
                  <button
                    type="button"
                    className={`task-table-sort ${tableSort.key === 'note' ? 'active' : ''}`}
                    onClick={() => cycleTableSort('note')}
                  >
                    Note {tableSort.key === 'note' ? (tableSort.dir === 'asc' ? '↑' : '↓') : ''}
                  </button>
                </th>
                <th scope="col" className="task-table-col-due">
                  <button
                    type="button"
                    className={`task-table-sort ${tableSort.key === 'due' ? 'active' : ''}`}
                    onClick={() => cycleTableSort('due')}
                  >
                    Due {tableSort.key === 'due' ? (tableSort.dir === 'asc' ? '↑' : '↓') : ''}
                  </button>
                </th>
                <th scope="col" className="task-table-col-assignee">
                  <button
                    type="button"
                    className={`task-table-sort ${tableSort.key === 'assignee' ? 'active' : ''}`}
                    onClick={() => cycleTableSort('assignee')}
                  >
                    Assignee{' '}
                    {tableSort.key === 'assignee' ? (tableSort.dir === 'asc' ? '↑' : '↓') : ''}
                  </button>
                </th>
                <th scope="col" className="task-table-col-tags">
                  Tags
                </th>
                <th scope="col" className="task-table-col-conversation">
                  Conversation
                </th>
                <th scope="col" className="task-table-col-related">
                  Files
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedTableRows.map((task) => {
                const note = notes.find((n) => getNoteKey(n) === task.noteKey) ?? null;
                const writable = note ? canWriteVaultNote(note) : false;
                const due = dueDateLabel(task.due);
                const conversation = taskConversations[task.id];
                const conversationState = getConversationState(conversation);
                const relatedCount = conversation?.relatedFiles.length ?? (note ? 1 : 0);
                const otherTaskBusy =
                  agentBusyState !== 'idle' &&
                  agentBusyState !== 'error' &&
                  Boolean(activeAgentSessionId) &&
                  conversation?.sessionId !== activeAgentSessionId;
                return (
                  <tr
                    key={task.id}
                    className={`task-table-row ${task.completed ? 'completed' : ''} ${togglingTask === task.id ? 'saving' : ''}`}
                  >
                    <td className="task-table-col-status">
                      <button
                        type="button"
                        className={`task-checkbox ${task.completed ? 'checked' : ''}`}
                        onClick={() => void handleTaskToggle(task, task.completed)}
                        disabled={togglingTask === task.id || !writable}
                        aria-label={task.completed ? 'Mark as incomplete' : 'Mark as complete'}
                      >
                        <span className="task-checkbox-icon">
                          {togglingTask === task.id ? (
                            <Circle size={16} className="spinning" />
                          ) : task.completed ? (
                            <CheckCircle2 size={16} />
                          ) : (
                            <Circle size={16} />
                          )}
                        </span>
                      </button>
                    </td>
                    <td className="task-table-col-task">
                      <button
                        type="button"
                        className="task-table-task-cell"
                        onClick={() => onOpenTaskConversation(task)}
                      >
                        {task.text}
                      </button>
                    </td>
                    <td className="task-table-col-note">
                      <button
                        type="button"
                        className="task-source-btn"
                        onClick={() => onSelectNote(task.noteKey)}
                        title={task.notePath}
                        aria-label={`Open source note ${task.noteTitle}`}
                      >
                        <FileText size={12} />
                        <span>{task.noteTitle}</span>
                      </button>
                    </td>
                    <td className="task-table-col-due">
                      {task.due ? (
                        <span className={`task-due-pill task-due-pill--${due.tone}`}>
                          {due.text}
                        </span>
                      ) : (
                        <span className="task-due-pill task-due-pill--none">No date</span>
                      )}
                    </td>
                    <td className="task-table-col-assignee">
                      {task.assignee ? (
                        <span className="task-assign-chip assigned">
                          <Bot size={11} />
                          <span>@{task.assignee}</span>
                        </span>
                      ) : (
                        <span className="task-assign-chip unassigned">
                          <Tag size={11} />
                          <span>Unassigned</span>
                        </span>
                      )}
                    </td>
                    <td className="task-table-col-tags">
                      {task.tags.length > 0 ? (
                        <div className="task-table-tags">
                          {task.tags.map((tag) => (
                            <span key={tag} className="task-tag-pill">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="task-table-muted">—</span>
                      )}
                    </td>
                    <td className="task-table-col-conversation">
                      <span
                        className={`task-agent-state task-agent-state--${conversationStateClass(otherTaskBusy ? 'busy' : conversationState)}`}
                      >
                        {(otherTaskBusy ||
                          conversationState === 'busy' ||
                          conversationState === 'awaiting_approval') && (
                          <Loader2 size={10} className="spinning" />
                        )}
                        {otherTaskBusy ? 'Agent busy' : conversationStateLabel(conversationState)}
                      </span>
                    </td>
                    <td className="task-table-col-related">
                      <span className="task-related-count">{relatedCount}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : groupBy === 'none' ? (
        <div className="task-board">{visible.map(renderRow)}</div>
      ) : (
        <div className="task-board">
          {grouped.map((group) => (
            <div key={group.key} className="task-group">
              <h4 className="task-group-label">
                {group.label} <span className="count-badge">{group.items.length}</span>
              </h4>
              {group.items.map(renderRow)}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

interface TaskRowProps {
  task: TaskItem;
  note: VaultNote | null;
  agents: VaultNote[];
  toggling: boolean;
  savingAssign: boolean;
  pickerOpen: boolean;
  onToggle: (task: TaskItem, currentCompleted: boolean) => void | Promise<void>;
  onAssign: (task: TaskItem, agentName: string | null) => void | Promise<void>;
  onOpenPicker: (open: boolean) => void;
  onPing: (task: TaskItem, agent: VaultNote) => void;
  onOpenConversation: (task: TaskItem) => void;
  onSelect: (path: string) => void;
  onOpenAgentsView: () => void;
  conversation?: TaskConversationMeta;
  globalBusyState: ChatAgentBusyState;
  activeAgentSessionId: string | null;
}

function TaskRow({
  task,
  note,
  agents,
  toggling,
  savingAssign,
  pickerOpen,
  onToggle,
  onAssign,
  onOpenPicker,
  onPing,
  onOpenConversation,
  onSelect,
  onOpenAgentsView,
  conversation,
  globalBusyState,
  activeAgentSessionId,
}: TaskRowProps) {
  return (
    <TaskCard
      task={task}
      note={note}
      agents={agents}
      toggling={toggling}
      savingAssign={savingAssign}
      pickerOpen={pickerOpen}
      onToggle={onToggle}
      onAssign={onAssign}
      onOpenPicker={onOpenPicker}
      onPing={onPing}
      onOpenConversation={onOpenConversation}
      onSelect={onSelect}
      onOpenAgentsView={onOpenAgentsView}
      conversation={conversation}
      globalBusyState={globalBusyState}
      activeAgentSessionId={activeAgentSessionId}
      variant="row"
    />
  );
}

function KanbanCard(props: TaskRowProps) {
  return <TaskCard {...props} variant="kanban" />;
}

interface TaskCardProps extends TaskRowProps {
  variant: 'row' | 'kanban';
}

function TaskCard({
  task,
  note,
  agents,
  toggling,
  savingAssign,
  pickerOpen,
  onToggle,
  onAssign,
  onOpenPicker,
  onPing,
  onOpenConversation,
  onSelect,
  onOpenAgentsView,
  conversation,
  globalBusyState,
  activeAgentSessionId,
  variant,
}: TaskCardProps) {
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const resolvedAgent = useMemo(() => resolveAgentForTask(agents, task), [agents, task]);
  const writable = note ? canWriteVaultNote(note) : false;
  const due = dueDateLabel(task.due);
  const conversationState = getConversationState(conversation);
  const relatedCount = conversation?.relatedFiles.length ?? (note ? 1 : 0);
  const otherTaskBusy =
    globalBusyState !== 'idle' &&
    globalBusyState !== 'error' &&
    Boolean(activeAgentSessionId) &&
    conversation?.sessionId !== activeAgentSessionId;

  useEffect(() => {
    if (!pickerOpen) return;
    const onDocClick = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        onOpenPicker(false);
      }
    };
    const onEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOpenPicker(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [pickerOpen, onOpenPicker]);

  const handleAssignPick = (agent: VaultNote) => {
    void onAssign(task, agent.title);
  };

  const handleUnassign = () => {
    void onAssign(task, null);
  };

  const handlePing = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (resolvedAgent) onPing(task, resolvedAgent);
  };

  const cardClass = variant === 'kanban' ? 'task-card task-card--kanban' : 'task-row';

  return (
    <div
      className={`${cardClass} ${task.completed ? 'completed' : ''} ${toggling || savingAssign ? 'saving' : ''}`}
      onClick={() => onOpenConversation(task)}
    >
      <button
        className={`task-checkbox ${task.completed ? 'checked' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          void onToggle(task, task.completed);
        }}
        disabled={toggling}
        aria-label={task.completed ? 'Mark as incomplete' : 'Mark as complete'}
      >
        <span className="task-checkbox-icon">
          {toggling ? (
            <Circle size={16} className="spinning" />
          ) : task.completed ? (
            <CheckCircle2 size={16} />
          ) : (
            <Circle size={16} />
          )}
        </span>
      </button>
      <div className="task-card-body">
        <button
          className="task-content"
          onClick={(e) => {
            e.stopPropagation();
            onOpenConversation(task);
          }}
        >
          <strong>{task.text}</strong>
          <small>
            {task.noteTitle} · line {task.line}
            {task.due ? ` · due ${task.due}` : ''}
          </small>
        </button>
        <div className="task-card-meta">
          <span className={`task-status-pill ${task.completed ? 'completed' : 'active'}`}>
            {task.completed ? 'Completed' : 'Active'}
          </span>
          <span
            className={`task-agent-state task-agent-state--${conversationStateClass(otherTaskBusy ? 'busy' : conversationState)}`}
          >
            {(otherTaskBusy ||
              conversationState === 'busy' ||
              conversationState === 'awaiting_approval') && (
              <Loader2 size={10} className="spinning" />
            )}
            {otherTaskBusy ? 'Agent busy' : conversationStateLabel(conversationState)}
          </span>
          <span className="task-related-count">
            {relatedCount} file{relatedCount === 1 ? '' : 's'}
          </span>
          {task.due ? (
            <span className={`task-due-pill task-due-pill--${due.tone}`}>{due.text}</span>
          ) : (
            <span className="task-due-pill task-due-pill--none">No date</span>
          )}
          {task.tags.length > 0 && (
            <div className="task-card-tags">
              {task.tags.map((tag) => (
                <span key={tag} className="task-tag-pill">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
        {variant === 'row' && (
          <button
            type="button"
            className="task-source-btn compact"
            onClick={(event) => {
              event.stopPropagation();
              onSelect(task.noteKey);
            }}
            title={task.notePath}
            aria-label={`Open source note ${task.noteTitle}`}
          >
            <FileText size={12} />
            <span>{task.noteTitle}</span>
          </button>
        )}
        {variant === 'kanban' && (
          <button
            type="button"
            className="task-source-btn compact"
            onClick={(event) => {
              event.stopPropagation();
              onSelect(task.noteKey);
            }}
            title={task.notePath}
            aria-label={`Open source note ${task.noteTitle}`}
          >
            <FileText size={12} />
            <span>{task.noteTitle}</span>
          </button>
        )}
      </div>
      <div className="task-row-actions" onClick={(e) => e.stopPropagation()}>
        <div className="task-assign-wrap" ref={popoverRef}>
          <button
            type="button"
            className={`task-assign-chip ${task.assignee ? 'assigned' : 'unassigned'} ${!writable ? 'disabled' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              if (!writable) return;
              onOpenPicker(!pickerOpen);
            }}
            disabled={!writable}
            title={
              !writable
                ? 'Personal vault only'
                : task.assignee
                  ? `Assigned to @${task.assignee}. Click to change.`
                  : 'Assign an agent'
            }
            aria-haspopup="listbox"
            aria-expanded={pickerOpen}
          >
            {task.assignee ? <Bot size={11} /> : <Tag size={11} />}
            <span>{task.assignee ? `@${task.assignee}` : 'Assign'}</span>
            <ChevronDown size={10} />
          </button>
          {pickerOpen && (
            <div className="assign-popover" role="listbox">
              <div className="assign-popover-header">Assign agent</div>
              {agents.length === 0 ? (
                <div className="assign-popover-empty">
                  <p>No agent notes found yet.</p>
                  <button
                    type="button"
                    className="ghost-button small"
                    onClick={() => {
                      onOpenPicker(false);
                      onOpenAgentsView();
                    }}
                  >
                    Open Agents view
                  </button>
                </div>
              ) : (
                <>
                  <ul className="assign-popover-list">
                    {agents.map((agent) => {
                      const role =
                        typeof agent.frontmatter.role === 'string' ? agent.frontmatter.role : '';
                      const isCurrent = task.assignee?.toLowerCase() === agent.title.toLowerCase();
                      return (
                        <li key={getNoteKey(agent)}>
                          <button
                            type="button"
                            className={`assign-popover-item ${isCurrent ? 'active' : ''}`}
                            onClick={() => handleAssignPick(agent)}
                            role="option"
                            aria-selected={isCurrent}
                          >
                            <Bot size={12} />
                            <span className="assign-popover-item-name">{agent.title}</span>
                            {role && <span className="assign-popover-item-role">{role}</span>}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  {task.assignee && (
                    <button
                      type="button"
                      className="assign-popover-unassign"
                      onClick={handleUnassign}
                    >
                      <X size={11} /> Unassign
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
        <button
          type="button"
          className="task-ping-btn"
          onClick={handlePing}
          disabled={!resolvedAgent || task.completed}
          title={
            !resolvedAgent
              ? 'Assign an agent first'
              : task.completed
                ? 'Task is complete'
                : `Ping @${task.assignee} with this task`
          }
          aria-label={resolvedAgent ? `Ping @${task.assignee}` : 'Ping agent'}
        >
          <MessageCirclePlus size={12} />
          <span>Ping</span>
        </button>
      </div>
    </div>
  );
}
