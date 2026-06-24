import { Hash } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { VaultFolder, VaultNote } from '../types';
import type { TaggedEntity } from '../utils/entityTags';
import { getNoteKey } from '../utils/noteKey';

interface TagsViewProps {
  notes: VaultNote[];
  onSelectNote: (path: string) => void;
  onFilterByTag?: (tag: string) => void;
  /** Folders that may carry tags (VaultFolder.tags) */
  folders?: VaultFolder[];
  /** Vault-level and file-level tagged entities */
  taggedEntities?: TaggedEntity[];
}

type SortMode = 'usage' | 'alphabetical';
type EntityFilter = 'all' | 'note' | 'folder' | 'vault' | 'file';

interface TagSource {
  type: 'note' | 'folder' | 'vault' | 'file';
  label: string;
  subtitle?: string;
  key: string;
}

export function TagsView({
  notes,
  onSelectNote,
  onFilterByTag,
  folders = [],
  taggedEntities = [],
}: TagsViewProps) {
  const [sortMode, setSortMode] = useState<SortMode>('usage');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [entityFilter, setEntityFilter] = useState<EntityFilter>('all');

  // Build a unified map: tag -> TagSource[]
  const tagSources = useMemo(() => {
    const map = new Map<string, TagSource[]>();

    // 1. Note tags
    if (entityFilter === 'all' || entityFilter === 'note') {
      for (const note of notes) {
        for (const tag of note.tags) {
          const key = tag.toLowerCase();
          const sources = map.get(key) ?? [];
          sources.push({
            type: 'note',
            label: note.title,
            subtitle: note.path,
            key: getNoteKey(note),
          });
          map.set(key, sources);
        }
      }
    }

    // 2. Folder tags (from VaultFolder.tags)
    if (entityFilter === 'all' || entityFilter === 'folder') {
      for (const folder of folders) {
        if (!folder.tags || folder.tags.length === 0) continue;
        for (const tag of folder.tags) {
          const key = tag.toLowerCase();
          const sources = map.get(key) ?? [];
          sources.push({
            type: 'folder',
            label: folder.path || folder.vaultName,
            subtitle: folder.vaultName,
            key: `folder:${folder.vaultId}:${folder.path}`,
          });
          map.set(key, sources);
        }
      }
    }

    // 3. Tagged entities (vault-level and file-level tags)
    if (entityFilter === 'all' || entityFilter === 'vault' || entityFilter === 'file') {
      for (const entity of taggedEntities) {
        if (entity.tags.length === 0) continue;
        if (entityFilter !== 'all' && entity.type !== entityFilter) continue;
        for (const tag of entity.tags) {
          const key = tag.toLowerCase();
          const sources = map.get(key) ?? [];
          sources.push({
            type: entity.type,
            label: entity.name,
            subtitle: entity.type === 'vault' ? 'Vault' : entity.type === 'file' ? 'File' : '',
            key: entity.id,
          });
          map.set(key, sources);
        }
      }
    }

    return map;
  }, [notes, folders, taggedEntities, entityFilter]);

  const entries = useMemo(() => {
    const arr = Array.from(tagSources.entries());
    if (sortMode === 'usage') {
      return arr.sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
    }
    return arr.sort((a, b) => a[0].localeCompare(b[0]));
  }, [tagSources, sortMode]);

  const handleTagClick = (tag: string) => {
    const newTag = selectedTag === tag ? null : tag;
    setSelectedTag(newTag);
    if (onFilterByTag) {
      onFilterByTag(newTag || '');
    }
  };

  const filteredTagSources = selectedTag
    ? tagSources.get(selectedTag) ?? []
    : [];

  return (
    <main className="page-scroll view-page">
      <div className="page-header">
        <div>
          <span className="eyebrow">Taxonomy</span>
          <h1>
            <Hash size={20} /> Tags
          </h1>
          <p>Explore tags from notes, folders, vaults, and files.</p>
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

      {/* Entity type filter */}
      <div className="tag-entity-filter">
        {(['all', 'note', 'folder', 'vault', 'file'] as const).map((filter) => (
          <button
            key={filter}
            className={`ghost-button ${entityFilter === filter ? 'active' : ''}`}
            onClick={() => {
              setEntityFilter(filter);
              setSelectedTag(null);
            }}
          >
            {filter === 'all' && 'All'}
            {filter === 'note' && 'Notes'}
            {filter === 'folder' && 'Folders'}
            {filter === 'vault' && 'Vaults'}
            {filter === 'file' && 'Files'}
          </button>
        ))}
      </div>

      {selectedTag ? (
        <div className="tag-filtered-view">
          <div className="tag-filter-header">
            <h2>
              Tagged <span className="tag-highlight">#{selectedTag}</span>
              <span className="count-badge">{filteredTagSources.length}</span>
            </h2>
            <button className="ghost-button" onClick={() => setSelectedTag(null)}>
              Clear
            </button>
          </div>
          <div className="note-list-cards">
            {filteredTagSources.map((source) => (
              <button
                key={source.key}
                onClick={() => {
                  if (source.type === 'note') {
                    onSelectNote(source.key);
                  }
                }}
                style={{ cursor: source.type === 'note' ? 'pointer' : 'default' }}
              >
                <strong>{source.label}</strong>
                <span className={`entity-type-badge ${source.type}`}>{source.type}</span>
                {source.subtitle && <small>{source.subtitle}</small>}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="tag-cloud-grid">
          {entries.length ? (
            entries.map(([tag, sources]) => (
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
                  <span className="count-badge">{sources.length}</span>
                </h3>
                <div className="tag-note-list">
                  {sources.slice(0, 5).map((source) => (
                    <button
                      key={source.key}
                      onClick={() => {
                        if (source.type === 'note') {
                          onSelectNote(source.key);
                        }
                      }}
                      style={{ cursor: source.type === 'note' ? 'pointer' : 'default' }}
                    >
                      <span className={`entity-type-badge ${source.type}`}>{source.type}</span>
                      <span>{source.label}</span>
                      {source.subtitle && (
                        <span className="entity-name">{source.subtitle}</span>
                      )}
                    </button>
                  ))}
                  {sources.length > 5 && (
                    <button
                      onClick={() => handleTagClick(tag)}
                      style={{ color: 'var(--muted)', fontSize: 11 }}
                    >
                      +{sources.length - 5} more
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
