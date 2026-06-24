import { X } from 'lucide-react';
import type { VaultNote } from '../types';

interface NoteTabsProps {
  tabs: string[]; // ordered note keys
  activeKey?: string;
  dirtyTabs: Record<string, boolean>; // keys with unsaved changes
  notes: VaultNote[];
  onSelect: (key: string) => void;
  onClose: (key: string) => void;
}

export function NoteTabs({
  tabs,
  activeKey,
  dirtyTabs,
  notes,
  onSelect,
  onClose,
}: NoteTabsProps) {
  if (tabs.length === 0) return null;

  const getNote = (key: string): VaultNote | undefined =>
    notes.find((note) => `${note.vaultId}:${note.path}` === key);

  return (
    <div className="note-tabs" role="tablist" aria-label="Open notes">
      {tabs.map((key) => {
        const note = getNote(key);
        const title = note?.title ?? key.split(':').pop() ?? key;
        const isActive = key === activeKey;
        const isDirty = dirtyTabs[key] ?? false;

        return (
          <div
            key={key}
            className={`note-tab${isActive ? ' active' : ''}`}
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect(key)}
            title={title}
          >
            <span className="note-tab-label">
              {isDirty && <span className="note-tab-dirty-dot" aria-hidden="true" />}
              {title}
            </span>
            <button
              className="note-tab-close"
              onClick={(event) => {
                event.stopPropagation();
                onClose(key);
              }}
              aria-label={`Close ${title}`}
            >
              <X size={10} aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
