import { X } from 'lucide-react';
import { useCallback, useRef } from 'react';
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
  const tabRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const setTabRef = useCallback(
    (key: string) => (node: HTMLDivElement | null) => {
      if (node) {
        tabRefs.current[key] = node;
      } else {
        delete tabRefs.current[key];
      }
    },
    [],
  );

  if (tabs.length === 0) return null;

  const getNote = (key: string): VaultNote | undefined =>
    notes.find((note) => `${note.vaultId}:${note.path}` === key);

  const focusTab = (key: string) => {
    tabRefs.current[key]?.focus();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>, index: number) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    let nextIndex = index;
    switch (event.key) {
      case 'ArrowRight':
        nextIndex = (index + 1) % tabs.length;
        break;
      case 'ArrowLeft':
        nextIndex = (index - 1 + tabs.length) % tabs.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = tabs.length - 1;
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        onSelect(tabs[index]);
        return;
      default:
        return;
    }
    event.preventDefault();
    const nextKey = tabs[nextIndex];
    if (nextKey) {
      focusTab(nextKey);
      onSelect(nextKey);
    }
  };

  return (
    <div className="note-tabs" role="tablist" aria-label="Open notes">
      {tabs.map((key, index) => {
        const note = getNote(key);
        const title = note?.title ?? key.split(':').pop() ?? key;
        const isActive = key === activeKey;
        const isDirty = dirtyTabs[key] ?? false;

        return (
          <div
            key={key}
            ref={setTabRef(key)}
            className={`note-tab${isActive ? ' active' : ''}${isDirty ? ' dirty' : ''}`}
            role="tab"
            tabIndex={isActive ? 0 : -1}
            aria-selected={isActive}
            onClick={() => onSelect(key)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            title={title}
          >
            <span className="note-tab-label">
              {isDirty && (
                <span className="note-tab-dirty-dot" aria-label="Unsaved changes" />
              )}
              <span className="note-tab-title">{title}</span>
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
