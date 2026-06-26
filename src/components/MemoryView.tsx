import {
  Brain,
  Bot,
  Calendar,
  CheckCircle2,
  Clipboard,
  FolderOpen,
  Link2,
  Save,
  Search,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { Memory, MemoryType, VaultNote } from '../types';
import { buildBacklinks } from '../utils/markdown/graph';
import { getNoteKey } from '../utils/noteKey';
import { getMemoriesFromNotes, saveToMemory } from '../utils/memory';

interface MemoryViewProps {
  notes: VaultNote[];
  onSelectNote: (key: string) => void;
  onSaveMemory?: (
    content: string,
    memoryType: MemoryType,
    target?: string,
    existingMemoryId?: string,
  ) => void | Promise<void>;
}

type MemoryFilterType = MemoryType | 'all';

const memoryTypeLabels: Record<MemoryType, string> = {
  agent: 'Agent',
  team: 'Team',
  project: 'Project',
  user: 'User',
  skill: 'Skill',
  tool: 'Tool',
  decision: 'Decision',
  run: 'Run',
};

const memoryTypeIcons: Record<MemoryType, typeof Bot> = {
  agent: Bot,
  team: Users,
  project: FolderOpen,
  user: Brain,
  skill: CheckCircle2,
  tool: Clipboard,
  decision: Search,
  run: Calendar,
};

function getStatusColor(status: Memory['status']): string {
  switch (status) {
    case 'active':
      return 'var(--success, #22c55e)';
    case 'inactive':
      return 'var(--muted, #888)';
    case 'archived':
      return 'var(--warning, #f59e0b)';
    default:
      return 'var(--muted, #888)';
  }
}

function getVaultRoleLabel(role?: Memory['vaultRole']): string {
  if (role === 'personal') return 'Personal';
  if (role === 'agent') return 'Agent vault';
  if (role === 'shared') return 'Shared';
  return 'Vault';
}

export function MemoryView({ notes, onSelectNote, onSaveMemory }: MemoryViewProps) {
  const allMemories = useMemo(() => getMemoriesFromNotes(notes), [notes]);

  const [selectedType, setSelectedType] = useState<MemoryFilterType>('all');
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [saveModalOpen, setSaveModalOpen] = useState(false);

  // Get unique agents for target selector
  const agentNotes = useMemo(
    () => notes.filter((n) => n.path.toLowerCase().includes('/agents/')),
    [notes],
  );

  // Get unique projects for target selector
  const projectNotes = useMemo(() => {
    return notes.filter((n) => {
      const type = n.frontmatter.type;
      return type === 'project' || n.path.toLowerCase().includes('/projects/');
    });
  }, [notes]);

  const filteredMemories = useMemo(() => {
    let filtered =
      selectedType === 'all'
        ? allMemories
        : allMemories.filter((m) => m.memoryType === selectedType);

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (m) =>
          m.title.toLowerCase().includes(query) ||
          (m.target && m.target.toLowerCase().includes(query)) ||
          (m.content && m.content.toLowerCase().includes(query)),
      );
    }

    return filtered.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  }, [allMemories, selectedType, searchQuery]);

  // Group memories by type
  const groupedMemories = useMemo(() => {
    const groups = new Map<MemoryType, Memory[]>();
    for (const memory of filteredMemories) {
      const existing = groups.get(memory.memoryType) ?? [];
      groups.set(memory.memoryType, [...existing, memory]);
    }
    return groups;
  }, [filteredMemories]);

  const memoryCounts = useMemo(() => {
    const counts = new Map<MemoryFilterType, number>();
    counts.set('all', allMemories.length);
    for (const type of Object.keys(memoryTypeLabels) as MemoryType[]) {
      counts.set(type, allMemories.filter((m) => m.memoryType === type).length);
    }
    return counts;
  }, [allMemories]);

  const handleMemoryClick = (memory: Memory) => {
    setSelectedMemory(memory);
  };

  // Get entries for rendering - use Array.from to properly type the Map entries
  const memoryEntries = useMemo((): [MemoryType, Memory[]][] => {
    if (selectedType !== 'all') {
      const memories = groupedMemories.get(selectedType) ?? [];
      return memories.length > 0 ? [[selectedType, memories]] : [];
    }
    return Array.from(groupedMemories.entries()).filter(([, memories]) => memories.length > 0);
  }, [groupedMemories, selectedType]);

  return (
    <main className="page-scroll view-page">
      <div className="page-header">
        <div>
          <span className="eyebrow">Knowledge</span>
          <h1>
            <Brain size={20} /> Memory
          </h1>
          <p>
            Persistent knowledge across sessions — agent memories, decisions, user preferences, and
            more.
          </p>
        </div>
        {onSaveMemory && (
          <button className="primary-button" onClick={() => setSaveModalOpen(true)}>
            <Save size={14} /> Save to Memory
          </button>
        )}
      </div>

      <div className="memory-filter-bar">
        <div className="memory-filter-tabs">
          <button
            type="button"
            className={`memory-filter-tab ${selectedType === 'all' ? 'active' : ''}`}
            onClick={() => setSelectedType('all')}
          >
            All ({memoryCounts.get('all')})
          </button>
          {(Object.keys(memoryTypeLabels) as MemoryType[]).map((type) => (
            <button
              key={type}
              type="button"
              className={`memory-filter-tab ${selectedType === type ? 'active' : ''}`}
              onClick={() => setSelectedType(type)}
            >
              {memoryTypeLabels[type]} ({memoryCounts.get(type)})
            </button>
          ))}
        </div>
        <div className="memory-filter-search">
          <Search size={12} />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search memories…"
            aria-label="Search memories"
          />
          {searchQuery && (
            <button type="button" className="clear-btn" onClick={() => setSearchQuery('')}>
              <X size={10} />
            </button>
          )}
        </div>
      </div>

      {filteredMemories.length === 0 ? (
        <div className="panel-card" style={{ gridColumn: '1 / -1' }}>
          {allMemories.length === 0 ? (
            <>
              <h3>
                <Brain size={16} /> Create your first memory
              </h3>
              <p>
                Add markdown notes under <code>Memory/</code>, or set <code>type: memory</code> in
                frontmatter.
              </p>
              <pre>{`---
type: memory
memory_type: agent
agent: [[Agent Name]]
status: active
---

# Agent Memory

## Role

## Operating Rules
`}</pre>
            </>
          ) : (
            <>
              <h3>
                <X size={16} /> No memories match this filter
              </h3>
              <p>Try selecting a different memory type or clearing your search.</p>
            </>
          )}
        </div>
      ) : (
        <div className="memory-grid">
          {memoryEntries.map(([type, typeMemories]) => (
            <section key={type} className="memory-type-section">
              <h2 className="memory-type-heading">
                {(() => {
                  const Icon = memoryTypeIcons[type];
                  return <Icon size={14} />;
                })()}
                {memoryTypeLabels[type]} Memories
              </h2>
              <div className="memory-cards-grid">
                {typeMemories.map((memory: Memory) => (
                  <MemoryCard
                    key={memory.id}
                    memory={memory}
                    allNotes={notes}
                    onClick={() => handleMemoryClick(memory)}
                    onSelectNote={onSelectNote}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {selectedMemory && (
        <MemoryDetailDrawer
          memory={selectedMemory}
          allNotes={notes}
          onClose={() => setSelectedMemory(null)}
          onSelectNote={(path) => {
            onSelectNote(path);
            setSelectedMemory(null);
          }}
        />
      )}

      {onSaveMemory && (
        <SaveToMemoryModal
          isOpen={saveModalOpen}
          onClose={() => setSaveModalOpen(false)}
          onSave={onSaveMemory}
          agentNotes={agentNotes}
          projectNotes={projectNotes}
          existingMemories={allMemories}
        />
      )}
    </main>
  );
}

interface MemoryCardProps {
  memory: Memory;
  allNotes: VaultNote[];
  onClick: () => void;
  onSelectNote: (key: string) => void;
}

function MemoryCard({ memory, allNotes, onClick, onSelectNote }: MemoryCardProps) {
  const Icon = memoryTypeIcons[memory.memoryType];
  const linkedNotesCount = memory.links.length;

  // Get the vault note for this memory to access full content
  const vaultNote = useMemo(() => {
    return allNotes.find((n) => getNoteKey(n) === memory.id);
  }, [allNotes, memory.id]);

  const backlinks = useMemo(() => {
    if (!vaultNote) return [];
    return buildBacklinks(allNotes, vaultNote);
  }, [allNotes, vaultNote]);

  const description = useMemo(() => {
    if (!memory.content) return '';
    const lines = memory.content.split('\n');
    const descriptionLine = lines.find(
      (line) =>
        !line.startsWith('#') && !line.startsWith('---') && !line.startsWith('**') && line.trim(),
    );
    return descriptionLine?.slice(0, 120) || '';
  }, [memory.content]);

  return (
    <article className="memory-card" onClick={onClick}>
      <div className="memory-card-header">
        <div className="memory-type-badge">
          <Icon size={12} />
          {memoryTypeLabels[memory.memoryType]}
        </div>
        <div className="memory-card-badges">
          <span className={`memory-vault-badge ${memory.vaultRole ?? ''}`}>
            {getVaultRoleLabel(memory.vaultRole)}
          </span>
          {!memory.writable && <span className="memory-vault-badge read-only">Read-only</span>}
        </div>
        <span
          className="memory-status-dot"
          style={{ backgroundColor: getStatusColor(memory.status) }}
          title={memory.status}
        />
      </div>

      <h3 className="memory-card-title">{memory.title}</h3>

      {memory.target && (
        <p className="memory-card-target">
          <Bot size={10} />
          {memory.target}
        </p>
      )}

      {description && <p className="memory-card-description">{description}</p>}

      <div className="memory-card-meta">
        <span className="memory-card-links">
          <Link2 size={10} />
          {linkedNotesCount} linked
        </span>
        <span className="memory-card-date">
          {memory.updatedAt ? new Date(memory.updatedAt).toLocaleDateString() : 'Unknown'}
        </span>
      </div>

      <div className="memory-card-footer">
        <button
          className="ghost-button"
          onClick={(e) => {
            e.stopPropagation();
            if (vaultNote) onSelectNote(getNoteKey(vaultNote));
          }}
        >
          Open
        </button>
      </div>
    </article>
  );
}

interface MemoryDetailDrawerProps {
  memory: Memory;
  allNotes: VaultNote[];
  onClose: () => void;
  onSelectNote: (path: string) => void;
}

function MemoryDetailDrawer({ memory, allNotes, onClose, onSelectNote }: MemoryDetailDrawerProps) {
  const vaultNote = useMemo(() => {
    return allNotes.find((n) => getNoteKey(n) === memory.id);
  }, [allNotes, memory.id]);

  const backlinks = useMemo(() => {
    if (!vaultNote) return [];
    return buildBacklinks(allNotes, vaultNote);
  }, [allNotes, vaultNote]);

  const outgoingLinks = useMemo(() => {
    if (!vaultNote) return [];
    return vaultNote.links
      .map((link) => {
        const target = allNotes.find(
          (n) =>
            n.title.toLowerCase() === link.target.toLowerCase() ||
            n.path.toLowerCase().includes(link.target.toLowerCase()),
        );
        return target ? { raw: link.raw, target: link.target, note: target } : null;
      })
      .filter(Boolean) as { raw: string; target: string; note: VaultNote }[];
  }, [vaultNote, allNotes]);

  const Icon = memoryTypeIcons[memory.memoryType];

  return (
    <>
      <div className="detail-drawer-backdrop" onClick={onClose} aria-hidden="true" />
      <aside className="detail-drawer" role="dialog" aria-label={`${memory.title} details`}>
        <div className="detail-drawer-header">
          <div>
            <div className="memory-type-badge large">
              <Icon size={14} />
              {memoryTypeLabels[memory.memoryType]}
            </div>
            <h3>{memory.title}</h3>
            {memory.target && <p className="detail-drawer-role">{memory.target}</p>}
          </div>
          <button className="detail-drawer-close" onClick={onClose} aria-label="Close">
            <X size={15} />
          </button>
        </div>

        <div className="detail-drawer-body">
          {memory.content && (
            <div className="detail-drawer-content">
              <pre className="memory-content-preview">{memory.content}</pre>
            </div>
          )}

          <div className="detail-drawer-field">
            <span className="detail-drawer-field-label">Status</span>
            <span
              className="detail-drawer-field-value"
              style={{ color: getStatusColor(memory.status) }}
            >
              {memory.status}
            </span>
          </div>

          <div className="detail-drawer-field">
            <span className="detail-drawer-field-label">Vault</span>
            <span className="detail-drawer-field-value">
              {getVaultRoleLabel(memory.vaultRole)}
              {memory.writable ? ' writable' : ' read-only'}
            </span>
          </div>

          {memory.path && (
            <div className="detail-drawer-field">
              <span className="detail-drawer-field-label">Path</span>
              <code className="detail-drawer-path">{memory.path}</code>
            </div>
          )}

          {outgoingLinks.length > 0 && (
            <div className="detail-drawer-section">
              <h4>Outgoing Links ({outgoingLinks.length})</h4>
              <div className="detail-drawer-links">
                {outgoingLinks.map((link) => (
                  <button
                    key={link.target}
                    className="link-pill"
                    onClick={() => onSelectNote(getNoteKey(link.note))}
                  >
                    <Link2 size={11} />
                    {link.note.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          {backlinks.length > 0 && (
            <div className="detail-drawer-section">
              <h4>Backlinks ({backlinks.length})</h4>
              <div className="detail-drawer-links">
                {backlinks.map((bl) => (
                  <button
                    key={bl.sourceKey}
                    className="backlink-card"
                    onClick={() => onSelectNote(bl.sourceKey)}
                  >
                    <strong>{bl.sourceTitle}</strong>
                    <small>{bl.excerpts[0]?.slice(0, 100)}</small>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="detail-drawer-footer">
          {vaultNote && (
            <button className="primary-button" onClick={() => onSelectNote(getNoteKey(vaultNote))}>
              <FolderOpen size={13} /> Open note
            </button>
          )}
        </div>
      </aside>
    </>
  );
}

// =============================================================================
// Save to Memory Modal
// =============================================================================

export interface SaveToMemoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    content: string,
    memoryType: MemoryType,
    target?: string,
    existingMemoryId?: string,
  ) => void;
  prefillContent?: string;
  agentNotes?: VaultNote[];
  projectNotes?: VaultNote[];
  existingMemories?: Memory[];
}

export function SaveToMemoryModal({
  isOpen,
  onClose,
  onSave,
  prefillContent = '',
  agentNotes = [],
  projectNotes = [],
  existingMemories = [],
}: SaveToMemoryModalProps) {
  const [memoryType, setMemoryType] = useState<MemoryType>('agent');
  const [target, setTarget] = useState<string>('');
  const [content, setContent] = useState(prefillContent);
  const [saveMode, setSaveMode] = useState<'new' | 'append'>('new');
  const [existingMemoryId, setExistingMemoryId] = useState<string>('');

  useEffect(() => {
    if (isOpen && prefillContent) {
      setContent(prefillContent);
    }
  }, [isOpen, prefillContent]);

  const showTargetSelector =
    memoryType === 'agent' || memoryType === 'project' || memoryType === 'skill';

  const targetOptions = useMemo(() => {
    if (memoryType === 'agent') {
      return agentNotes.map((n) => n.title);
    }
    if (memoryType === 'project') {
      return projectNotes.map((n) => n.title);
    }
    return [];
  }, [memoryType, agentNotes, projectNotes]);

  const filteredExistingMemories = useMemo(() => {
    return existingMemories.filter((m) => m.memoryType === memoryType);
  }, [existingMemories, memoryType]);

  const selectedExistingMemory = useMemo(() => {
    return filteredExistingMemories.find((m) => m.id === existingMemoryId);
  }, [filteredExistingMemories, existingMemoryId]);

  const canSubmit =
    content.trim() && (saveMode === 'new' || Boolean(selectedExistingMemory?.writable));

  const handleSave = () => {
    if (!canSubmit) return;
    onSave(
      content,
      memoryType,
      target || undefined,
      saveMode === 'append' ? existingMemoryId : undefined,
    );
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="modal-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="modal-container" role="dialog" aria-label="Save to Memory">
        <div className="modal-header">
          <h3>
            <Save size={16} /> Save to Memory
          </h3>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <X size={15} />
          </button>
        </div>

        <div className="modal-body">
          <div className="modal-field">
            <label className="modal-field-label">Memory Type</label>
            <div className="modal-type-selector">
              {(Object.keys(memoryTypeLabels) as MemoryType[]).map((type) => {
                const Icon = memoryTypeIcons[type];
                return (
                  <button
                    key={type}
                    type="button"
                    className={`modal-type-btn ${memoryType === type ? 'active' : ''}`}
                    onClick={() => setMemoryType(type)}
                  >
                    <Icon size={12} />
                    {memoryTypeLabels[type]}
                  </button>
                );
              })}
            </div>
          </div>

          {showTargetSelector && (
            <div className="modal-field">
              <label className="modal-field-label">
                {memoryType === 'agent' ? 'Agent' : memoryType === 'project' ? 'Project' : 'Skill'}
              </label>
              <select
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className="modal-select"
              >
                <option value="">Select {memoryType}…</option>
                {targetOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="modal-field">
            <label className="modal-field-label">Content</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="modal-textarea"
              placeholder="Enter content to save to memory…"
              rows={6}
            />
          </div>

          <div className="modal-field">
            <label className="modal-field-label">Save Mode</label>
            <div className="modal-radio-group">
              <label className="modal-radio">
                <input
                  type="radio"
                  name="saveMode"
                  value="new"
                  checked={saveMode === 'new'}
                  onChange={() => setSaveMode('new')}
                />
                <span>Create new memory note</span>
              </label>
              <label className="modal-radio">
                <input
                  type="radio"
                  name="saveMode"
                  value="append"
                  checked={saveMode === 'append'}
                  onChange={() => setSaveMode('append')}
                />
                <span>Append to existing</span>
              </label>
            </div>
          </div>

          {saveMode === 'append' && filteredExistingMemories.length > 0 && (
            <div className="modal-field">
              <label className="modal-field-label">Existing Memory</label>
              <select
                value={existingMemoryId}
                onChange={(e) => setExistingMemoryId(e.target.value)}
                className="modal-select"
              >
                <option value="">Select memory note…</option>
                {filteredExistingMemories.map((m) => (
                  <option key={m.id} value={m.id} disabled={!m.writable}>
                    {m.title} - {getVaultRoleLabel(m.vaultRole)}
                    {m.writable ? '' : ', read-only'}
                  </option>
                ))}
              </select>
              {filteredExistingMemories.some((m) => !m.writable) && (
                <p className="modal-helper-text">
                  Read-only memories are shown for reference but cannot be append targets.
                </p>
              )}
            </div>
          )}

          <div className="modal-preview">
            <label className="modal-field-label">Preview</label>
            <pre className="modal-preview-content">
              {saveToMemory(
                content,
                memoryType,
                target || undefined,
                saveMode === 'append' ? selectedExistingMemory : undefined,
              )}
            </pre>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="ghost-button" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={handleSave}
            disabled={!canSubmit}
          >
            <Save size={13} /> Save
          </button>
        </div>
      </div>
    </>
  );
}
