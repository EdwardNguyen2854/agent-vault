import {
  Archive,
  ArchiveRestore,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  FolderPlus,
  History,
  Loader2,
  MoreHorizontal,
  Pin,
  PinOff,
  Save,
  Search,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChatGroup, ChatSession, TaskConversationMeta, TaskItem } from '../types';
import { createChatGroup, deleteChatGroup } from '../utils/chatHistory';

export type ChatHistoryView = 'all' | 'pinned' | 'tasks' | 'archived';
export type ChatHistoryGroupBy = 'date' | 'agent' | 'group' | 'tag';

export interface ChatHistoryPanelProps {
  sessions: ChatSession[];
  archivedSessions: ChatSession[];
  activeSessionId: string | null;
  isStreaming: boolean;
  groups: ChatGroup[];
  taskConversations: Record<string, TaskConversationMeta>;
  tasks: TaskItem[];
  onSwitch: (session: ChatSession) => void;
  onNew: () => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onTogglePin: (id: string) => void;
  onArchive: (id: string) => void;
  onUnarchive: (id: string) => void;
  onDuplicate: (id: string) => void;
  onSaveAsNote: (id: string) => void;
  onSetTags: (id: string, tags: string[]) => void;
  onSetGroup: (id: string, groupId: string | undefined) => void;
  onOpenTaskConversation: (task: TaskItem) => void;
  onClose: () => void;
}

function relativeTime(ts: number, now = Date.now()): string {
  const diff = now - ts;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h ago`;
  const days = Math.floor(diff / 86_400_000);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

function dateBucket(ts: number, now = Date.now()): { key: string; label: string; order: number } {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const tsDate = new Date(ts);
  const tsStart = new Date(tsDate);
  tsStart.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((start.getTime() - tsStart.getTime()) / 86_400_000);
  if (diffDays <= 0) return { key: 'today', label: 'Today', order: 0 };
  if (diffDays === 1) return { key: 'yesterday', label: 'Yesterday', order: 1 };
  if (diffDays < 7) return { key: 'this-week', label: 'This week', order: 2 };
  if (diffDays < 30) return { key: 'this-month', label: 'This month', order: 3 };
  return { key: 'older', label: 'Older', order: 4 };
}

function agentBucket(session: ChatSession): { key: string; label: string } {
  return { key: session.agentKey || 'unknown', label: session.agent || 'Unknown agent' };
}

function groupBucket(session: ChatSession, groups: ChatGroup[]): { key: string; label: string } {
  const id = session.groupId ?? '__none__';
  if (id === '__none__') return { key: id, label: 'Ungrouped' };
  const match = groups.find((g) => g.id === id);
  return { key: id, label: match?.name ?? 'Ungrouped' };
}

function tagBucket(session: ChatSession): { key: string; label: string } {
  const first = session.tags?.[0];
  if (!first) return { key: '__untagged__', label: 'Untagged' };
  return { key: first, label: `#${first}` };
}

interface Section {
  key: string;
  label: string;
  items: ChatSession[];
  order?: number;
}

function buildSections(
  source: ChatSession[],
  groupBy: ChatHistoryGroupBy,
  groups: ChatGroup[],
): Section[] {
  const map = new Map<string, Section>();
  source.forEach((session) => {
    let bucket: { key: string; label: string; order?: number };
    if (groupBy === 'date') bucket = dateBucket(session.updatedAt);
    else if (groupBy === 'agent') bucket = agentBucket(session);
    else if (groupBy === 'group') bucket = groupBucket(session, groups);
    else bucket = tagBucket(session);
    if (!map.has(bucket.key)) {
      map.set(bucket.key, {
        key: bucket.key,
        label: bucket.label,
        items: [],
        order: bucket.order,
      });
    }
    map.get(bucket.key)!.items.push(session);
  });
  const sections = Array.from(map.values());
  sections.sort((a, b) => {
    if (groupBy === 'date' && a.order !== undefined && b.order !== undefined) {
      return a.order - b.order;
    }
    return a.label.localeCompare(b.label);
  });
  return sections;
}

function filterByQuery(sessions: ChatSession[], query: string): ChatSession[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return sessions;
  return sessions.filter((session) => {
    if (session.title.toLowerCase().includes(trimmed)) return true;
    if (session.agent.toLowerCase().includes(trimmed)) return true;
    if (session.tags?.some((t) => t.toLowerCase().includes(trimmed))) return true;
    return session.messages.some((m) => m.content.toLowerCase().includes(trimmed));
  });
}

function highlightTitle(title: string, query: string) {
  const trimmed = query.trim();
  if (!trimmed) return title;
  const lower = title.toLowerCase();
  const idx = lower.indexOf(trimmed.toLowerCase());
  if (idx < 0) return title;
  return (
    <>
      {title.slice(0, idx)}
      <mark className="chat-history-highlight">{title.slice(idx, idx + trimmed.length)}</mark>
      {title.slice(idx + trimmed.length)}
    </>
  );
}

export function ChatHistoryPanel({
  sessions,
  archivedSessions,
  activeSessionId,
  isStreaming,
  groups,
  taskConversations,
  tasks,
  onSwitch,
  onNew,
  onRename,
  onDelete,
  onTogglePin,
  onArchive,
  onUnarchive,
  onDuplicate,
  onSaveAsNote,
  onSetTags,
  onSetGroup,
  onOpenTaskConversation,
  onClose,
}: ChatHistoryPanelProps) {
  const [view, setView] = useState<ChatHistoryView>('all');
  const [groupBy, setGroupBy] = useState<ChatHistoryGroupBy>('date');
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renamingValue, setRenamingValue] = useState('');
  const [taggingId, setTaggingId] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState('');
  const [movingId, setMovingId] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    searchRef.current?.focus();
  }, [view]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (query) {
          setQuery('');
        } else {
          onClose();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [query, onClose]);

  useEffect(() => {
    if (!menuOpenId) return;
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('.chat-history-row-menu, .chat-history-row-menu-trigger')) return;
      setMenuOpenId(null);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [menuOpenId]);

  const baseList = useMemo(() => {
    if (view === 'archived') return archivedSessions;
    if (view === 'pinned') return sessions.filter((s) => s.pinned);
    if (view === 'tasks') return sessions.filter((s) => Boolean(s.taskId));
    return sessions;
  }, [view, sessions, archivedSessions]);

  const sortedList = useMemo(() => {
    const list = [...baseList];
    list.sort((a, b) => {
      if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
      return b.updatedAt - a.updatedAt;
    });
    return list;
  }, [baseList]);

  const filteredList = useMemo(() => filterByQuery(sortedList, query), [sortedList, query]);
  const sections = useMemo(
    () => buildSections(filteredList, groupBy, groups),
    [filteredList, groupBy, groups],
  );
  const totalCount = sortedList.length;

  const taskLookup = useMemo(() => {
    const map = new Map<string, TaskItem>();
    tasks.forEach((task) => map.set(task.id, task));
    return map;
  }, [tasks]);

  const handleFinishRename = () => {
    if (renamingId && renamingValue.trim()) {
      onRename(renamingId, renamingValue.trim());
    }
    setRenamingId(null);
    setRenamingValue('');
  };

  const handleSaveTags = (sessionId: string) => {
    const tags = tagInput
      .split(',')
      .map((t) => t.trim().replace(/^#/, ''))
      .filter(Boolean);
    onSetTags(sessionId, tags);
    setTaggingId(null);
    setTagInput('');
  };

  const handleAddGroup = () => {
    const name = window.prompt('Group name');
    if (name && name.trim()) {
      createChatGroup(name.trim());
    }
  };

  const handleDeleteGroup = (groupId: string) => {
    if (window.confirm('Delete this group? Sessions will be moved to Ungrouped.')) {
      deleteChatGroup(groupId);
    }
  };

  const handleSwitch = (session: ChatSession) => {
    if (isStreaming) return;
    onSwitch(session);
  };

  const renderRow = (session: ChatSession) => {
    const isActive = session.id === activeSessionId;
    const disabled = isStreaming && !isActive;
    const isArchivedView = view === 'archived';
    const meta = session.taskId ? taskConversations[session.taskId] : undefined;
    const task = session.taskId ? taskLookup.get(session.taskId) : undefined;
    return (
      <div
        key={session.id}
        className={`chat-history-row${isActive ? ' active' : ''}${disabled ? ' disabled' : ''}`}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-selected={isActive}
        onClick={() => handleSwitch(session)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            handleSwitch(session);
          }
        }}
      >
        <button
          type="button"
          className={`chat-history-pin${session.pinned ? ' pinned' : ''}`}
          onClick={(event) => {
            event.stopPropagation();
            onTogglePin(session.id);
          }}
          title={session.pinned ? 'Unpin' : 'Pin to top'}
          aria-label={session.pinned ? 'Unpin session' : 'Pin session to top'}
          aria-pressed={session.pinned}
        >
          {session.pinned ? <Pin size={12} /> : <PinOff size={12} />}
        </button>
        <div className="chat-history-row-main">
          {renamingId === session.id ? (
            <input
              className="chat-history-rename-input"
              autoFocus
              value={renamingValue}
              onClick={(event) => event.stopPropagation()}
              onChange={(event) => setRenamingValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  handleFinishRename();
                } else if (event.key === 'Escape') {
                  event.preventDefault();
                  setRenamingId(null);
                  setRenamingValue('');
                }
              }}
              onBlur={handleFinishRename}
            />
          ) : (
            <div
              className="chat-history-row-title"
              onDoubleClick={(event) => {
                event.stopPropagation();
                if (isArchivedView) return;
                setRenamingId(session.id);
                setRenamingValue(session.title);
              }}
              title={session.title}
            >
              {highlightTitle(session.title, query)}
            </div>
          )}
          <div className="chat-history-row-meta">
            <span className="chat-history-row-agent" title={session.agent}>
              {session.agent || 'Agent'}
            </span>
            <span className="chat-history-row-dot">·</span>
            <span>{relativeTime(session.updatedAt)}</span>
            <span className="chat-history-row-dot">·</span>
            <span>{session.messages.length} msg</span>
            {session.savedNotePath && (
              <span className="chat-history-row-saved" title={`Saved to ${session.savedNotePath}`}>
                <Save size={10} /> saved
              </span>
            )}
          </div>
          <div className="chat-history-row-tags">
            {session.taskId && (
              <span
                className="chat-history-row-badge task"
                title={task?.text ?? 'Task conversation'}
              >
                <Check size={9} /> Task
              </span>
            )}
            {meta && session.taskId && (
              <span className={`chat-history-row-badge state task-agent-state--${meta.agentState}`}>
                {meta.agentState === 'busy' || meta.agentState === 'awaiting_approval' ? (
                  <Loader2 size={9} className="spinning" />
                ) : null}
                {meta.agentState.replace('_', ' ')}
              </span>
            )}
            {(session.tags ?? []).map((tag) => (
              <span key={tag} className="chat-history-row-badge tag">
                #{tag}
              </span>
            ))}
            {session.groupId && (
              <span className="chat-history-row-badge group">
                {groups.find((g) => g.id === session.groupId)?.name ?? 'Group'}
              </span>
            )}
            {isArchivedView && (
              <span className="chat-history-row-badge archived">
                <Archive size={9} /> archived
              </span>
            )}
          </div>
        </div>
        <div className="chat-history-row-menu">
          <button
            type="button"
            className="chat-history-row-menu-trigger"
            onClick={(event) => {
              event.stopPropagation();
              setMenuOpenId((current) => (current === session.id ? null : session.id));
            }}
            aria-haspopup="menu"
            aria-expanded={menuOpenId === session.id}
            aria-label="Session actions"
            title="More actions"
          >
            <MoreHorizontal size={14} />
          </button>
          {menuOpenId === session.id && (
            <div
              className="chat-history-row-menu-panel"
              role="menu"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpenId(null);
                  handleSwitch(session);
                }}
              >
                <ChevronRight size={12} /> Open
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpenId(null);
                  setRenamingId(session.id);
                  setRenamingValue(session.title);
                }}
                disabled={isArchivedView}
              >
                <Check size={12} /> Rename
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpenId(null);
                  onSaveAsNote(session.id);
                }}
              >
                <Save size={12} /> Save as note…
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpenId(null);
                  onDuplicate(session.id);
                }}
              >
                <Copy size={12} /> Duplicate
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpenId(null);
                  onTogglePin(session.id);
                }}
              >
                {session.pinned ? <PinOff size={12} /> : <Pin size={12} />}
                {session.pinned ? 'Unpin' : 'Pin to top'}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpenId(null);
                  setTaggingId(session.id);
                  setTagInput((session.tags ?? []).join(', '));
                }}
                disabled={isArchivedView}
              >
                <Tag size={12} /> Tags…
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpenId(null);
                  setMovingId(session.id);
                }}
                disabled={isArchivedView}
              >
                <FolderPlus size={12} /> Move to group…
              </button>
              {isArchivedView ? (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpenId(null);
                    onUnarchive(session.id);
                  }}
                >
                  <ArchiveRestore size={12} /> Restore
                </button>
              ) : (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpenId(null);
                    onArchive(session.id);
                  }}
                >
                  <Archive size={12} /> Archive
                </button>
              )}
              <button
                type="button"
                role="menuitem"
                className="danger"
                onClick={() => {
                  setMenuOpenId(null);
                  onDelete(session.id);
                }}
              >
                <Trash2 size={12} /> Delete
              </button>
              {session.taskId && task && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpenId(null);
                    onOpenTaskConversation(task);
                  }}
                >
                  <History size={12} /> Open task conversation
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="chat-history-panel" ref={panelRef}>
      <div className="chat-history-header">
        <div className="chat-history-title">
          <History size={14} />
          <span>History</span>
          <span className="chat-history-count">{totalCount}</span>
        </div>
        <div className="chat-history-header-actions">
          <button
            type="button"
            className="chat-history-icon-btn primary"
            onClick={onNew}
            title="New chat"
            aria-label="New chat"
            disabled={isStreaming}
          >
            <History size={13} /> New
          </button>
          <button
            type="button"
            className="chat-history-icon-btn"
            onClick={onClose}
            title="Close history (Esc)"
            aria-label="Close history"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      <div className="chat-history-search">
        <Search size={12} aria-hidden="true" />
        <input
          ref={searchRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search title, agent, messages…"
          aria-label="Search chat history"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="chat-history-search-clear"
            aria-label="Clear search"
            title="Clear search"
          >
            <X size={11} />
          </button>
        )}
      </div>

      <div className="chat-history-tabs" role="tablist">
        {(['all', 'pinned', 'tasks', 'archived'] as ChatHistoryView[]).map((tab) => {
          const count =
            tab === 'all'
              ? sessions.length
              : tab === 'pinned'
                ? sessions.filter((s) => s.pinned).length
                : tab === 'tasks'
                  ? sessions.filter((s) => Boolean(s.taskId)).length
                  : archivedSessions.length;
          return (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={view === tab}
              className={`chat-history-tab${view === tab ? ' active' : ''}`}
              onClick={() => setView(tab)}
            >
              {tab === 'all' && 'All'}
              {tab === 'pinned' && (
                <>
                  <Pin size={11} /> Pinned
                </>
              )}
              {tab === 'tasks' && (
                <>
                  <Check size={11} /> Tasks
                </>
              )}
              {tab === 'archived' && (
                <>
                  <Archive size={11} /> Archived
                </>
              )}
              <span className="chat-history-tab-count">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="chat-history-toolbar">
        <label className="chat-history-groupby">
          <span>Group by</span>
          <select
            value={groupBy}
            onChange={(event) => setGroupBy(event.target.value as ChatHistoryGroupBy)}
            aria-label="Group by"
          >
            <option value="date">Date</option>
            <option value="agent">Agent</option>
            <option value="group">Group</option>
            <option value="tag">Tag</option>
          </select>
        </label>
        <button
          type="button"
          className="chat-history-icon-btn"
          onClick={handleAddGroup}
          title="New group"
          aria-label="New group"
        >
          <FolderPlus size={12} /> Group
        </button>
      </div>

      <div className="chat-history-body" role="listbox" aria-label="Chat sessions">
        {totalCount === 0 ? (
          <div className="chat-history-empty">
            {view === 'pinned' && (
              <>
                <Pin size={18} />
                <h3>No pinned chats</h3>
                <p>Pin a conversation to keep it at the top of your history.</p>
              </>
            )}
            {view === 'tasks' && (
              <>
                <Check size={18} />
                <h3>No task conversations</h3>
                <p>Open the Tasks view and click a task to start a focused conversation.</p>
              </>
            )}
            {view === 'archived' && (
              <>
                <Archive size={18} />
                <h3>Nothing archived</h3>
                <p>Archived chats appear here so you can restore them later.</p>
              </>
            )}
            {view === 'all' && (
              <>
                <History size={18} />
                <h3>No conversations yet</h3>
                <p>Start a new chat and your history will appear here.</p>
              </>
            )}
          </div>
        ) : filteredList.length === 0 ? (
          <div className="chat-history-empty">
            <Search size={18} />
            <h3>No matches</h3>
            <p>Try a different search term or change the group filter.</p>
          </div>
        ) : (
          sections.map((section) => {
            const isCollapsed = collapsed[section.key];
            return (
              <div key={section.key} className="chat-history-section">
                {section.label && (
                  <button
                    type="button"
                    className="chat-history-section-header"
                    onClick={() =>
                      setCollapsed((prev) => ({ ...prev, [section.key]: !prev[section.key] }))
                    }
                    aria-expanded={!isCollapsed}
                  >
                    {isCollapsed ? <ChevronRight size={11} /> : <ChevronDown size={11} />}
                    <span>{section.label}</span>
                    <span className="chat-history-section-count">{section.items.length}</span>
                  </button>
                )}
                {!isCollapsed && (
                  <div className="chat-history-section-body">{section.items.map(renderRow)}</div>
                )}
              </div>
            );
          })
        )}
      </div>

      {taggingId && (
        <div className="chat-history-popover" role="dialog" aria-label="Edit tags">
          <div className="chat-history-popover-header">
            <Tag size={12} /> Edit tags
          </div>
          <input
            autoFocus
            value={tagInput}
            onChange={(event) => setTagInput(event.target.value)}
            placeholder="comma, separated, tags"
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                handleSaveTags(taggingId);
              } else if (event.key === 'Escape') {
                setTaggingId(null);
                setTagInput('');
              }
            }}
          />
          <div className="chat-history-popover-actions">
            <button
              type="button"
              onClick={() => {
                setTaggingId(null);
                setTagInput('');
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={() => handleSaveTags(taggingId)}
            >
              Save
            </button>
          </div>
        </div>
      )}

      {movingId && (
        <div className="chat-history-popover" role="dialog" aria-label="Move to group">
          <div className="chat-history-popover-header">
            <FolderPlus size={12} /> Move to group
          </div>
          <div className="chat-history-group-list">
            <button
              type="button"
              onClick={() => {
                onSetGroup(movingId, undefined);
                setMovingId(null);
              }}
            >
              <X size={11} /> Ungrouped
            </button>
            {groups.length === 0 && (
              <div className="chat-history-group-empty">
                No groups yet. Create one with the Group button.
              </div>
            )}
            {groups.map((group) => (
              <div key={group.id} className="chat-history-group-item">
                <button
                  type="button"
                  onClick={() => {
                    onSetGroup(movingId, group.id);
                    setMovingId(null);
                  }}
                >
                  {group.name}
                </button>
                <button
                  type="button"
                  className="danger"
                  title="Delete group"
                  aria-label={`Delete group ${group.name}`}
                  onClick={() => handleDeleteGroup(group.id)}
                >
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
          </div>
          <div className="chat-history-popover-actions">
            <button type="button" onClick={() => setMovingId(null)}>
              Close
            </button>
          </div>
        </div>
      )}

      {baseList.length > 0 && filteredList.length !== baseList.length && (
        <div className="chat-history-filter-note">
          Showing {filteredList.length} of {baseList.length} sessions.
          <button type="button" onClick={() => setQuery('')}>
            Clear search
          </button>
        </div>
      )}
    </div>
  );
}
