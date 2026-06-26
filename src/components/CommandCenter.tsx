import {
  Bot,
  CheckSquare,
  Command,
  FilePlus2,
  FileText,
  GitFork,
  Hash,
  Home,
  Info,
  Map,
  RefreshCw,
  Rocket,
  Save,
  Search,
  Settings,
  Tags,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { VaultNote, ViewMode } from '../types';
import { getWorkspaceEntityNotes, getWorkspaceEntityType } from '../utils/markdown/entity';
import { getNoteKey } from '../utils/noteKey';
import { searchNotes } from '../utils/search';

interface CommandCenterProps {
  open: boolean;
  notes: VaultNote[];
  onClose: () => void;
  onSelectNote: (path: string) => void;
  onChangeView: (view: ViewMode) => void;
  onCreateNote: () => void;
  onSave: () => void;
  onRefresh: () => void;
  onRenameNote: () => void;
  onDeleteNote: () => void;
  canMutateSelectedNote: boolean;
}

type ResultGroup = 'notes' | 'commands' | 'tasks' | 'tags' | 'agents';

interface CommandItem {
  id: string;
  label: string;
  detail?: string;
  icon: typeof Command;
  group: ResultGroup;
  action: () => void;
  disabled?: boolean;
}

const MAX_RESULTS = 12;
const DEBOUNCE_MS = 120;

export function CommandCenter({
  open,
  notes,
  onClose,
  onSelectNote,
  onChangeView,
  onCreateNote,
  onSave,
  onRefresh,
  onRenameNote,
  onDeleteNote,
  canMutateSelectedNote,
}: CommandCenterProps) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const queryType = useMemo(() => {
    const q = query.trim();
    if (q.startsWith('>')) return { type: 'command' as const, value: q.slice(1).trim() };
    if (q.startsWith('#')) return { type: 'tag' as const, value: q.slice(1).trim() };
    if (q.startsWith('@')) return { type: 'agent' as const, value: q.slice(1).trim() };
    if (q.startsWith('?')) return { type: 'health' as const, value: q.slice(1).trim() };
    return { type: 'all' as const, value: q };
  }, [query]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  const commands = useMemo<CommandItem[]>(() => {
    const core: CommandItem[] = [
      {
        id: 'nav-dashboard',
        label: 'Go to Dashboard',
        icon: Home,
        group: 'commands',
        action: () => onChangeView('dashboard'),
      },
      {
        id: 'nav-graph',
        label: 'Open 3D Graph',
        icon: GitFork,
        group: 'commands',
        action: () => onChangeView('graph'),
      },
      {
        id: 'nav-tasks',
        label: 'Open Tasks',
        icon: CheckSquare,
        group: 'commands',
        action: () => onChangeView('tasks'),
      },
      {
        id: 'nav-tags',
        label: 'Open Tags',
        icon: Tags,
        group: 'commands',
        action: () => onChangeView('tags'),
      },
      {
        id: 'nav-agents',
        label: 'Open Agents',
        icon: Users,
        group: 'commands',
        action: () => onChangeView('agents'),
      },
      {
        id: 'nav-context',
        label: 'Open Context',
        icon: FileText,
        group: 'commands',
        action: () => onChangeView('context'),
      },
      {
        id: 'nav-docs',
        label: 'Open Documentation',
        icon: FileText,
        group: 'commands',
        action: () => onChangeView('docs'),
      },
      {
        id: 'nav-roadmap',
        label: 'Open Roadmap',
        icon: Map,
        group: 'commands',
        action: () => onChangeView('roadmap'),
      },
      {
        id: 'nav-release',
        label: 'Open Release',
        icon: Rocket,
        group: 'commands',
        action: () => onChangeView('release'),
      },
      {
        id: 'nav-about',
        label: 'Open About',
        icon: Info,
        group: 'commands',
        action: () => onChangeView('about'),
      },
      {
        id: 'nav-settings',
        label: 'Open Settings',
        icon: Settings,
        group: 'commands',
        action: () => onChangeView('settings'),
      },
      {
        id: 'create-note',
        label: 'Create new note',
        icon: FilePlus2,
        group: 'commands',
        action: onCreateNote,
      },
      {
        id: 'save-note',
        label: 'Save current note',
        icon: Save,
        group: 'commands',
        action: onSave,
        disabled: !canMutateSelectedNote,
      },
      {
        id: 'refresh-vault',
        label: 'Refresh vault',
        icon: RefreshCw,
        group: 'commands',
        action: onRefresh,
      },
      {
        id: 'rename-note',
        label: 'Rename current note',
        icon: Command,
        group: 'commands',
        action: onRenameNote,
        disabled: !canMutateSelectedNote,
      },
      {
        id: 'delete-note',
        label: 'Delete current note',
        icon: Trash2,
        group: 'commands',
        action: onDeleteNote,
        disabled: !canMutateSelectedNote,
      },
    ];
    return core;
  }, [
    onChangeView,
    onCreateNote,
    onSave,
    onRefresh,
    onRenameNote,
    onDeleteNote,
    canMutateSelectedNote,
  ]);

  const tasks = useMemo(() => {
    return notes.flatMap((note) => note.tasks).slice(0, 30);
  }, [notes]);

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    notes.forEach((n) => n.tags.forEach((t) => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [notes]);

  const workspaceEntities = useMemo(() => getWorkspaceEntityNotes(notes), [notes]);

  const results = useMemo<CommandItem[]>(() => {
    const q = debouncedQuery.trim();
    const qt = queryType;

    if (!q && qt.type === 'all') {
      const recentNotes = notes.slice(0, 5).map((note) => ({
        id: `note:${getNoteKey(note)}`,
        label: note.title,
        detail: note.path,
        icon: FileText,
        group: 'notes' as ResultGroup,
        action: () => onSelectNote(getNoteKey(note)),
      }));
      const keyCommands = commands.slice(0, 5);
      return [...keyCommands, ...recentNotes];
    }

    const items: CommandItem[] = [];

    if (qt.type === 'all' || qt.type === 'tag' || qt.type === 'agent') {
      const noteResults = searchNotes(notes, qt.type === 'all' ? q : '').slice(0, 6);
      noteResults.forEach((r) => {
        items.push({
          id: `note:${getNoteKey(r.note)}`,
          label: r.note.title,
          detail: r.snippet || r.note.path,
          icon: FileText,
          group: 'notes',
          action: () => onSelectNote(getNoteKey(r.note)),
        });
      });
    }

    if (qt.type === 'all' || qt.type === 'tag') {
      const tagResults = allTags
        .filter((t) => !qt.value || t.toLowerCase().includes(qt.value.toLowerCase()))
        .slice(0, 5);
      tagResults.forEach((tag) => {
        items.push({
          id: `tag:${tag}`,
          label: `#${tag}`,
          detail: `${notes.filter((n) => n.tags.includes(tag)).length} notes`,
          icon: Hash,
          group: 'tags',
          action: () => onChangeView('tags'),
        });
      });
    }

    if (qt.type === 'all' || qt.type === 'agent') {
      const agentResults = workspaceEntities
        .filter((a) => !qt.value || a.title.toLowerCase().includes(qt.value.toLowerCase()))
        .slice(0, 4);
      agentResults.forEach((agent) => {
        const entityType = getWorkspaceEntityType(agent) ?? 'agent';
        items.push({
          id: `agent:${getNoteKey(agent)}`,
          label: agent.title,
          detail: Array.isArray(agent.frontmatter.role)
            ? agent.frontmatter.role[0]
            : agent.frontmatter.role || entityType,
          icon: Bot,
          group: 'agents',
          action: () => onSelectNote(getNoteKey(agent)),
        });
      });
    }

    if (qt.type === 'all' || qt.type === 'command') {
      const commandResults = commands
        .filter((c) => !qt.value || c.label.toLowerCase().includes(qt.value.toLowerCase()))
        .slice(0, 6);
      commandResults.forEach((cmd) => items.push(cmd));
    }

    if (qt.type === 'all' && q) {
      const taskResults = tasks
        .filter((t) => t.text.toLowerCase().includes(q.toLowerCase()))
        .slice(0, 4);
      taskResults.forEach((task) => {
        items.push({
          id: `task:${task.id}`,
          label: task.text,
          detail: `${task.noteTitle} · line ${task.line}`,
          icon: CheckSquare,
          group: 'tasks',
          action: () => onSelectNote(task.noteKey),
        });
      });
    }

    if (qt.type === 'health') {
      const healthNotes = notes
        .filter((n) => n.links.length === 0 && n.tags.length === 0)
        .slice(0, 5);
      healthNotes.forEach((note) => {
        items.push({
          id: `health:${getNoteKey(note)}`,
          label: `Orphan: ${note.title}`,
          detail: 'No connections to other notes',
          icon: Users,
          group: 'notes',
          action: () => onSelectNote(getNoteKey(note)),
        });
      });
    }

    return items.slice(0, MAX_RESULTS);
  }, [
    debouncedQuery,
    queryType,
    notes,
    commands,
    tasks,
    allTags,
    workspaceEntities,
    onSelectNote,
    onChangeView,
  ]);

  const groupedResults = useMemo(() => {
    const groups: Array<{ id: ResultGroup; label: string; items: CommandItem[] }> = [
      { id: 'notes', label: 'Files', items: [] },
      { id: 'commands', label: 'Commands', items: [] },
      { id: 'tasks', label: 'Tasks', items: [] },
      { id: 'tags', label: 'Tags', items: [] },
      { id: 'agents', label: 'Agents, Skills & Tools', items: [] },
    ];
    results.forEach((item) => {
      const g = groups.find((g) => g.id === item.group);
      if (g) g.items.push(item);
    });
    return groups.filter((g) => g.items.length > 0);
  }, [results]);

  const flatResults = useMemo(() => results, [results]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [results.length]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, flatResults.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (flatResults[selectedIndex] && !flatResults[selectedIndex].disabled) {
          flatResults[selectedIndex].action();
          onClose();
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  };

  useEffect(() => {
    const container = resultsRef.current;
    const selected = container?.querySelector('.cc-result.selected');
    selected?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  if (!open) return null;

  const getPlaceholder = () => {
    if (!query) return 'Search notes, commands, tags, agents…';
    if (query.startsWith('>')) return 'Type a command name…';
    if (query.startsWith('#')) return 'Type a tag name…';
    if (query.startsWith('@')) return 'Type an agent name…';
    if (query.startsWith('?')) return 'Type a health query…';
    return 'Search notes, commands, tags, agents…';
  };

  return (
    <div
      className="palette-backdrop visible"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="command-center"
        role="dialog"
        aria-modal="true"
        aria-label="Command center"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="cc-header">
          <div className="cc-search-icon">
            <Search size={16} />
          </div>
          <input
            ref={inputRef}
            className="cc-input"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={getPlaceholder()}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            aria-label="Search"
          />
          {query && (
            <button
              className="cc-clear-btn icon-btn"
              onClick={() => setQuery('')}
              aria-label="Clear search"
            >
              <X size={13} />
            </button>
          )}
          <button className="cc-close-btn" onClick={onClose} aria-label="Close">
            <kbd>Esc</kbd>
          </button>
        </div>

        <div className="cc-results" ref={resultsRef} role="listbox">
          {flatResults.length === 0 ? (
            <div className="cc-empty">
              <Search size={24} aria-hidden="true" />
              <p>
                No results for <strong>"{query}"</strong>
              </p>
              <small>Try searching for notes, commands, tags, or agents</small>
            </div>
          ) : (
            groupedResults.map((group) => (
              <div key={group.id} className="cc-group">
                <div className="cc-group-label">{group.label}</div>
                {group.items.map((item) => {
                  const flatIdx = flatResults.indexOf(item);
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      role="option"
                      aria-selected={flatIdx === selectedIndex}
                      className={`cc-result${flatIdx === selectedIndex ? ' selected' : ''}${item.disabled ? ' disabled' : ''}`}
                      onClick={() => {
                        if (!item.disabled) {
                          item.action();
                          onClose();
                        }
                      }}
                      onMouseEnter={() => setSelectedIndex(flatIdx)}
                      disabled={item.disabled}
                    >
                      <span className="cc-result-icon">
                        <Icon size={14} aria-hidden="true" />
                      </span>
                      <span className="cc-result-content">
                        <span className="cc-result-label">{item.label}</span>
                        {item.detail && <span className="cc-result-detail">{item.detail}</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="cc-footer">
          <span className="cc-hint">
            <kbd>↑</kbd>
            <kbd>↓</kbd> Navigate
          </span>
          <span className="cc-hint">
            <kbd>↵</kbd> Select
          </span>
          <span className="cc-hint">
            <kbd>&gt;</kbd> Commands
          </span>
          <span className="cc-hint">
            <kbd>#</kbd> Tags
          </span>
          <span className="cc-hint">
            <kbd>@</kbd> Agents
          </span>
        </div>
      </div>
    </div>
  );
}
