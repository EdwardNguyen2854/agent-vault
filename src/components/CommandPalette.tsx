import {
  Command,
  FilePlus2,
  FileText,
  GitFork,
  Home,
  Search,
  Tags,
  CheckSquare,
  Users,
  Save,
  RefreshCw,
  Edit2,
  Trash2,
  Settings,
  Map,
  Rocket,
  Info,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { VaultNote, ViewMode } from '../types';
import { getNoteKey } from '../utils/noteKey';
import { searchNotes } from '../utils/search';

interface CommandPaletteProps {
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

type CommandItem = {
  id: string;
  label: string;
  detail?: string;
  icon: typeof Command;
  action: () => void;
  disabled?: boolean;
};

export function CommandPalette({
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
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open) return;
    setQuery('');
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const commands = useMemo<CommandItem[]>(() => {
    const core: CommandItem[] = [
      {
        id: 'dashboard',
        label: 'Go to dashboard',
        icon: Home,
        action: () => onChangeView('dashboard'),
      },
      { id: 'graph', label: 'Open 3D graph', icon: GitFork, action: () => onChangeView('graph') },
      {
        id: 'tasks',
        label: 'Open task view',
        icon: CheckSquare,
        action: () => onChangeView('tasks'),
      },
      { id: 'tags', label: 'Open tags', icon: Tags, action: () => onChangeView('tags') },
      { id: 'agents', label: 'Open agents', icon: Users, action: () => onChangeView('agents') },
      {
        id: 'context',
        label: 'Open context',
        icon: FileText,
        action: () => onChangeView('context'),
      },
      { id: 'docs', label: 'Open documentation', icon: Search, action: () => onChangeView('docs') },
      { id: 'roadmap', label: 'Open roadmap', icon: Map, action: () => onChangeView('roadmap') },
      { id: 'release', label: 'Open release', icon: Rocket, action: () => onChangeView('release') },
      { id: 'about', label: 'Open about', icon: Info, action: () => onChangeView('about') },
      {
        id: 'settings',
        label: 'Open settings',
        icon: Settings,
        action: () => onChangeView('settings'),
      },
      { id: 'create-note', label: 'Create new note', icon: FilePlus2, action: onCreateNote },
      {
        id: 'save-note',
        label: 'Save current note',
        icon: Save,
        action: onSave,
        disabled: !canMutateSelectedNote,
      },
      { id: 'refresh-vault', label: 'Refresh vault', icon: RefreshCw, action: onRefresh },
      {
        id: 'rename-note',
        label: 'Rename current note',
        icon: Edit2,
        action: onRenameNote,
        disabled: !canMutateSelectedNote,
      },
      {
        id: 'delete-note',
        label: 'Delete current note',
        icon: Trash2,
        action: onDeleteNote,
        disabled: !canMutateSelectedNote,
      },
    ];
    const noteCommands: CommandItem[] = searchNotes(notes, query).map((result) => ({
      id: `note:${getNoteKey(result.note)}`,
      label: result.note.title,
      detail: result.snippet || result.note.path,
      icon: Search,
      action: () => onSelectNote(getNoteKey(result.note)),
    }));
    return [...core, ...noteCommands];
  }, [
    notes,
    onChangeView,
    onCreateNote,
    onSelectNote,
    onSave,
    onRefresh,
    onRenameNote,
    onDeleteNote,
    canMutateSelectedNote,
  ]);

  const visible = commands
    .filter((item) =>
      [item.label, item.detail].join(' ').toLowerCase().includes(query.toLowerCase()),
    )
    .slice(0, 12);

  if (!open) return null;

  return (
    <div className="palette-backdrop" onMouseDown={onClose}>
      <div className="command-palette" onMouseDown={(event) => event.stopPropagation()}>
        <label>
          <Command size={18} />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search notes and commands..."
          />
        </label>
        <div className="palette-results">
          {visible.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => {
                  if (!item.disabled) {
                    item.action();
                    onClose();
                  }
                }}
                disabled={item.disabled}
              >
                <Icon size={16} />
                <span>
                  <strong>{item.label}</strong>
                  {item.detail ? <small>{item.detail}</small> : null}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
