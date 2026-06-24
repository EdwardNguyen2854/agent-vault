import { Bot, Calendar, CheckCircle2, ExternalLink, Flag, Pencil, Play, Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { TaskItem, VaultNote } from '../types';
import { getNoteKey } from '../utils/noteKey';
import { updateTaskLine } from '../utils/markdown';
import { canWriteVaultNote, writeNote } from '../utils/vault';
import { TaskDetailModal } from './TaskDetailModal';

interface TaskQueueProps {
  notes: VaultNote[];
  onSelectNote: (key: string) => void;
  onRunAgent: (task: TaskItem, agent: VaultNote) => void;
  onNotesChange: (notes: VaultNote[]) => void;
}

type StatusFilter = 'all' | 'todo' | 'doing' | 'done';
type PriorityFilter = 'all' | 'high' | 'medium' | 'low';

interface TaskGroupProps {
  agentName: string;
  agentNote: VaultNote | null;
  tasks: TaskItem[];
  notes: VaultNote[];
  onSelectNote: (key: string) => void;
  onRunAgent: (task: TaskItem, agent: VaultNote) => void;
  onNotesChange: (notes: VaultNote[]) => void;
}

function getPriorityValue(priority: string | undefined): number {
  const p = priority?.toLowerCase();
  if (p === 'high') return 3;
  if (p === 'medium') return 2;
  if (p === 'low') return 1;
  return 0;
}

function PriorityBadge({ priority }: { priority: string | undefined }) {
  if (!priority) return null;
  const config = {
    high: { label: 'High', className: 'priority-high' },
    medium: { label: 'Medium', className: 'priority-medium' },
    low: { label: 'Low', className: 'priority-low' },
  }[priority.toLowerCase()] ?? { label: priority, className: 'priority-normal' };

  return (
    <span className={`task-priority-badge ${config.className}`}>
      <Flag size={9} />
      {config.label}
    </span>
  );
}

function StatusIndicator({ completed }: { completed: boolean }) {
  return completed ? (
    <span className="task-status-done">
      <CheckCircle2 size={14} />
    </span>
  ) : (
    <span className="task-status-todo">
      <span className="task-checkbox" />
    </span>
  );
}

function TaskCard({
  task,
  onSelectNote,
  onRunAgent,
  agentNote,
  notes,
  onNotesChange,
}: {
  task: TaskItem;
  onSelectNote: (key: string) => void;
  onRunAgent: (task: TaskItem, agent: VaultNote) => void;
  agentNote: VaultNote | null;
  notes: VaultNote[];
  onNotesChange: (notes: VaultNote[]) => void;
}) {
  const [showDetail, setShowDetail] = useState(false);
  const priorityMatch = task.text.match(/\bpriority:(high|medium|low)\b/i)?.[1];
  const dueMatch = task.text.match(/\bdue:(\d{4}-\d{2}-\d{2})\b/i)?.[1];

  const handleOpenNote = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectNote(task.noteKey);
  };

  const handleRunAgent = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (agentNote) {
      onRunAgent(task, agentNote);
    }
  };

  const handleTaskUpdate = async (
    updatedTask: TaskItem,
    updates: { completed?: boolean; assignee?: string | null; due?: string | null; priority?: string | null },
  ) => {
    const note = notes.find((n) => getNoteKey(n) === updatedTask.noteKey);
    if (!note) return;
    if (!canWriteVaultNote(note)) {
      alert('This task belongs to Agent or Shared content. Only personal vault tasks can be edited.');
      return;
    }
    const nextContent = updateTaskLine(note.content, updatedTask.line, updates, updatedTask.text);
    if (nextContent === note.content) {
      alert('Could not locate the task line to edit. The note may have been edited elsewhere.');
      return;
    }
    try {
      const updated = await writeNote(note, nextContent);
      onNotesChange(notes.map((n) => (getNoteKey(n) === getNoteKey(updated) ? updated : n)));
    } catch (error) {
      console.error('Failed to save task update:', error);
      alert('Failed to save task update. The file may be locked or permissions denied.');
    }
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDetail(true);
  };

  return (
    <>
      <article className={`task-card ${task.completed ? 'task-completed' : ''}`}>
        <div className="task-card-main">
          <StatusIndicator completed={task.completed} />
          <div className="task-content" onClick={handleEditClick}>
            <p className="task-text">{task.text}</p>
            <div className="task-meta">
              {dueMatch && (
                <span className="task-due">
                  <Calendar size={10} />
                  {dueMatch}
                </span>
              )}
              <PriorityBadge priority={priorityMatch} />
              <button className="task-source-link" onClick={handleOpenNote} title={task.notePath}>
                <ExternalLink size={10} />
                {task.noteTitle}
              </button>
            </div>
          </div>
          <button
            className="task-card-edit-btn"
            onClick={handleEditClick}
            title="Edit task properties"
            aria-label="Edit task properties"
          >
            <Pencil size={11} />
          </button>
        </div>
        {agentNote && !task.completed && (
          <div className="task-actions">
            <button
              className="run-agent-btn"
              onClick={handleRunAgent}
              title={`Run ${agentNote.title} on this task`}
            >
              <Play size={11} />
              Run Agent
            </button>
          </div>
        )}
      </article>
      {showDetail && (
        <TaskDetailModal
          task={task}
          onClose={() => setShowDetail(false)}
          onTaskUpdate={handleTaskUpdate}
        />
      )}
    </>
  );
}

function TaskGroup({ agentName, agentNote, tasks, onSelectNote, onRunAgent, notes, onNotesChange }: TaskGroupProps) {
  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      const aPriority = getPriorityValue(a.text.match(/\bpriority:(high|medium|low)\b/i)?.[1]);
      const bPriority = getPriorityValue(b.text.match(/\bpriority:(high|medium|low)\b/i)?.[1]);
      if (aPriority !== bPriority) return bPriority - aPriority;
      if (a.due && b.due) return a.due.localeCompare(b.due);
      if (a.due) return -1;
      if (b.due) return 1;
      return 0;
    });
  }, [tasks]);

  return (
    <section className="task-group">
      <div className="task-group-header">
        <div className="task-group-agent">
          <Bot size={14} />
          <h3>{agentName}</h3>
          <span className="task-count">{tasks.length}</span>
        </div>
        {agentNote && (
          <button
            className="ghost-button small"
            onClick={() => onSelectNote(getNoteKey(agentNote))}
          >
            <ExternalLink size={10} />
            Profile
          </button>
        )}
      </div>
      <div className="task-group-tasks">
          {sortedTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onSelectNote={onSelectNote}
              onRunAgent={onRunAgent}
              agentNote={agentNote}
              notes={notes}
              onNotesChange={onNotesChange}
            />
          ))}
      </div>
    </section>
  );
}

export function TaskQueue({ notes, onSelectNote, onRunAgent, onNotesChange }: TaskQueueProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Group tasks by @agent assignee
  const tasksByAgent = useMemo(() => {
    const agentTasksMap = new Map<string, { tasks: TaskItem[]; agentNote: VaultNote | null }>();

    for (const note of notes) {
      for (const task of note.tasks) {
        // Parse @agent from task text
        const agentMatch = task.text.match(/(^|\s)@([\p{L}\p{N}_-]+)/u);
        const agentName = agentMatch?.[2];

        if (!agentName) continue;

        if (!agentTasksMap.has(agentName)) {
          // Find the agent note
          const agentNote =
            notes.find(
              (n) =>
                n.title.toLowerCase() === agentName.toLowerCase() ||
                n.path.toLowerCase().includes(`/agents/${agentName.toLowerCase()}/`),
            ) ?? null;
          agentTasksMap.set(agentName, { tasks: [], agentNote });
        }

        agentTasksMap.get(agentName)!.tasks.push(task);
      }
    }

    return agentTasksMap;
  }, [notes]);

  // Apply filters
  const filteredTasksByAgent = useMemo(() => {
    const filtered = new Map(tasksByAgent);

    for (const [agentName, { tasks, agentNote }] of filtered) {
      const filteredTasks = tasks.filter((task) => {
        // Status filter
        if (statusFilter === 'todo' && task.completed) return false;
        if (statusFilter === 'done' && !task.completed) return false;
        if (statusFilter === 'doing') return false; // No in-progress state yet

        // Priority filter
        if (priorityFilter !== 'all') {
          const priorityMatch = task.text
            .match(/\bpriority:(high|medium|low)\b/i)?.[1]
            ?.toLowerCase();
          if (priorityMatch !== priorityFilter) return false;
        }

        // Search filter
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          return (
            task.text.toLowerCase().includes(query) || task.noteTitle.toLowerCase().includes(query)
          );
        }

        return true;
      });

      filtered.set(agentName, { tasks: filteredTasks, agentNote });
    }

    // Remove empty groups
    for (const [agentName, { tasks }] of filtered) {
      if (tasks.length === 0) {
        filtered.delete(agentName);
      }
    }

    return filtered;
  }, [tasksByAgent, statusFilter, priorityFilter, searchQuery]);

  const hasFilters = statusFilter !== 'all' || priorityFilter !== 'all' || searchQuery !== '';
  const clearFilters = () => {
    setStatusFilter('all');
    setPriorityFilter('all');
    setSearchQuery('');
  };

  const totalTaskCount = useMemo(() => {
    let count = 0;
    for (const { tasks } of tasksByAgent.values()) {
      count += tasks.length;
    }
    return count;
  }, [tasksByAgent]);

  const filteredTaskCount = useMemo(() => {
    let count = 0;
    for (const { tasks } of filteredTasksByAgent.values()) {
      count += tasks.length;
    }
    return count;
  }, [filteredTasksByAgent]);

  const agentEntries = useMemo(() => {
    return Array.from(filteredTasksByAgent.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredTasksByAgent]);

  return (
    <main className="page-scroll view-page">
      <div className="page-header">
        <div>
          <span className="eyebrow">Agent collaboration</span>
          <h1>
            <Bot size={20} /> Task Queue
          </h1>
          <p>Tasks assigned to agents, ready for execution.</p>
        </div>
      </div>

      {totalTaskCount > 0 ? (
        <>
          <div className="agents-filter-bar">
            <div className="agents-filter-group">
              <button
                type="button"
                className={`agents-filter-btn ${statusFilter === 'all' ? 'active' : ''}`}
                onClick={() => setStatusFilter('all')}
              >
                All
              </button>
              <button
                type="button"
                className={`agents-filter-btn ${statusFilter === 'todo' ? 'active' : ''}`}
                onClick={() => setStatusFilter('todo')}
              >
                Open
              </button>
              <button
                type="button"
                className={`agents-filter-btn ${statusFilter === 'done' ? 'active' : ''}`}
                onClick={() => setStatusFilter('done')}
              >
                Done
              </button>
            </div>
            <div className="agents-filter-fields">
              <label className="agents-filter-field">
                <Flag size={12} />
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value as PriorityFilter)}
                  aria-label="Filter by priority"
                >
                  <option value="all">All Priorities</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </label>
              <label className="agents-filter-field">
                <Search size={12} />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search tasks..."
                  aria-label="Search tasks"
                />
              </label>
              {hasFilters && (
                <button type="button" className="agents-filter-clear" onClick={clearFilters}>
                  <X size={10} /> Clear
                </button>
              )}
            </div>
          </div>

          <div className="task-queue-info">
            <span>
              {filteredTaskCount} of {totalTaskCount} tasks
            </span>
          </div>

          <div className="task-groups-list">
            {agentEntries.map(([agentName, { tasks, agentNote }]) => (
              <TaskGroup
                key={agentName}
                agentName={agentName}
                agentNote={agentNote}
                tasks={tasks}
                notes={notes}
                onSelectNote={onSelectNote}
                onRunAgent={onRunAgent}
                onNotesChange={onNotesChange}
              />
            ))}
          </div>
        </>
      ) : (
        <div className="panel-card" style={{ gridColumn: '1 / -1' }}>
          <h3>
            <Bot size={16} /> No agent tasks found
          </h3>
          <p>
            Tasks with @agent mentions will appear here. Use the format <code>@AgentName</code> in
            your task text to assign it to an agent.
          </p>
          <pre>{`- [ ] Fix the login bug @Nora priority:high due:2026-06-20`}</pre>
        </div>
      )}
    </main>
  );
}
