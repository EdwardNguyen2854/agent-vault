import { FileText, Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { VaultNote } from '../types';
import { getNoteKey } from '../utils/noteKey';
import { searchNotes } from '../utils/search';

interface QuickSwitcherProps {
  open: boolean;
  notes: VaultNote[];
  onClose: () => void;
  onSelectNote: (path: string) => void;
}

const MAX_RESULTS = 10;
const DEBOUNCE_MS = 150;

export function QuickSwitcher({ open, notes, onClose, onSelectNote }: QuickSwitcherProps) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Debounce the query
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  // Search results
  const results = useMemo(() => {
    if (!debouncedQuery.trim()) {
      // Show recent notes when no query (up to 8)
      return notes.slice(0, 8).map((note) => ({
        note,
        score: 0,
        matchType: 'title' as const,
        snippet: note.content.slice(0, 100),
      }));
    }
    return searchNotes(notes, debouncedQuery).slice(0, MAX_RESULTS);
  }, [notes, debouncedQuery]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [results.length]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (results[selectedIndex]) {
          onSelectNote(getNoteKey(results[selectedIndex].note));
          onClose();
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  };

  // Scroll selected into view
  useEffect(() => {
    const container = resultsRef.current;
    const selected = container?.querySelector('.quickswitcher-result.selected');
    selected?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  if (!open) return null;

  return (
    <div
      className="quickswitcher-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="quickswitcher-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Quick switcher"
      >
        <div className="quickswitcher-header">
          <Search size={18} />
          <input
            ref={inputRef}
            className="quickswitcher-input"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search notes..."
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>

        <div className="quickswitcher-results" ref={resultsRef}>
          {results.length === 0 ? (
            <div className="quickswitcher-empty">
              <p>No notes found for "{query}"</p>
            </div>
          ) : (
            results.map((result, index) => (
              <button
                key={getNoteKey(result.note)}
                className={`quickswitcher-result ${index === selectedIndex ? 'selected' : ''}`}
                onClick={() => {
                  onSelectNote(getNoteKey(result.note));
                  onClose();
                }}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <span className="quickswitcher-result-icon">
                  <FileText size={16} />
                </span>
                <span className="quickswitcher-result-content">
                  <span className="quickswitcher-result-title">{result.note.title}</span>
                  <span className="quickswitcher-result-path">{result.note.path}</span>
                  {result.snippet && (
                    <span className="quickswitcher-result-snippet">{result.snippet}</span>
                  )}
                </span>
              </button>
            ))
          )}
        </div>

        <div className="quickswitcher-footer">
          <span className="quickswitcher-hint">
            <kbd>↑</kbd>
            <kbd>↓</kbd> Navigate
          </span>
          <span className="quickswitcher-hint">
            <kbd>↵</kbd> Open
          </span>
          <span className="quickswitcher-hint">
            <kbd>Esc</kbd> Close
          </span>
        </div>
      </div>
    </div>
  );
}
