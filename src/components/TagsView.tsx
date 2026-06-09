import { Hash } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { VaultNote } from '../types';
import { getNoteKey } from '../utils/noteKey';

interface TagsViewProps {
  notes: VaultNote[];
  onSelectNote: (path: string) => void;
  onFilterByTag?: (tag: string) => void;
}

type SortMode = 'usage' | 'alphabetical';

export function TagsView({ notes, onSelectNote, onFilterByTag }: TagsViewProps) {
  const [sortMode, setSortMode] = useState<SortMode>('usage');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const tags = useMemo(() => {
    const map = new Map<string, VaultNote[]>();
    for (const note of notes) {
      for (const tag of note.tags) {
        const key = tag.toLowerCase();
        map.set(key, [...(map.get(key) ?? []), note]);
      }
    }
    const entries = Array.from(map.entries());
    if (sortMode === 'usage') {
      return entries.sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
    }
    return entries.sort((a, b) => a[0].localeCompare(b[0]));
  }, [notes, sortMode]);

  const handleTagClick = (tag: string) => {
    const newTag = selectedTag === tag ? null : tag;
    setSelectedTag(newTag);
    if (onFilterByTag) {
      onFilterByTag(newTag || '');
    }
  };

  const filteredNotes = selectedTag
    ? notes.filter((note) => note.tags.some((t) => t.toLowerCase() === selectedTag))
    : [];

  return (
    <main className="page-scroll view-page">
      <div className="page-header">
        <div>
          <span className="eyebrow">Taxonomy</span>
          <h1>
            <Hash size={20} /> Tags
          </h1>
          <p>Explore tags from inline hashtags and YAML frontmatter.</p>
        </div>
        <div className="graph-toolbar">
          <button
            className={`ghost-button ${sortMode === 'usage' ? 'active' : ''}`}
            onClick={() => setSortMode('usage')}
            title="Sort by usage"
          >
            By Usage
          </button>
          <button
            className={`ghost-button ${sortMode === 'alphabetical' ? 'active' : ''}`}
            onClick={() => setSortMode('alphabetical')}
            title="Sort alphabetically"
          >
            A-Z
          </button>
        </div>
      </div>

      {selectedTag ? (
        <div className="tag-filtered-view">
          <div className="tag-filter-header">
            <h2>
              Notes tagged <span className="tag-highlight">#{selectedTag}</span>
            </h2>
            <button className="ghost-button" onClick={() => setSelectedTag(null)}>
              Clear
            </button>
          </div>
          <div className="note-list-cards">
            {filteredNotes.map((note) => (
              <button key={getNoteKey(note)} onClick={() => onSelectNote(getNoteKey(note))}>
                <strong>{note.title}</strong>
                <small>{note.path}</small>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="tag-cloud-grid">
          {tags.length ? (
            tags.map(([tag, tagNotes]) => (
              <section className="panel-card" key={tag}>
                <h3
                  className="tag-item"
                  onClick={() => handleTagClick(tag)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && handleTagClick(tag)}
                >
                  <span>
                    #<strong>{tag}</strong>
                  </span>
                  <span className="count-badge">{tagNotes.length}</span>
                </h3>
                <div className="tag-note-list">
                  {tagNotes.slice(0, 5).map((note) => (
                    <button key={getNoteKey(note)} onClick={() => onSelectNote(getNoteKey(note))}>
                      {note.title}
                    </button>
                  ))}
                  {tagNotes.length > 5 && (
                    <button
                      onClick={() => handleTagClick(tag)}
                      style={{ color: 'var(--muted)', fontSize: 11 }}
                    >
                      +{tagNotes.length - 5} more
                    </button>
                  )}
                </div>
              </section>
            ))
          ) : (
            <p className="muted">No tags found.</p>
          )}
        </div>
      )}
    </main>
  );
}
