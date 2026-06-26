import {
  Bot,
  Brain,
  CheckCircle2,
  Copy,
  ExternalLink,
  Link2,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { VaultNote } from '../types';
import { buildBacklinks } from '../utils/markdown/graph';
import { getWorkspaceEntityType } from '../utils/markdown/entity';
import { getNoteKey } from '../utils/noteKey';
import { getModels } from '../utils/lmstudio';
import { loadAIProviderConfig } from '../utils/settings';
import { loadAgentModels, saveAgentModel } from '../utils/preferences';

interface AgentsViewProps {
  notes: VaultNote[];
  onSelectNote: (path: string) => void;
}

function computeReadiness(note: VaultNote, backlinkCount: number): { score: number; max: number } {
  let score = 0;
  const max = 5;
  // role / description
  if (
    (typeof note.frontmatter.role === 'string' && note.frontmatter.role) ||
    (typeof note.frontmatter.description === 'string' && note.frontmatter.description)
  )
    score += 1;
  // model
  if (typeof note.frontmatter.model === 'string' && note.frontmatter.model) score += 1;
  // skills (or tools, which also indicates configuration)
  if (
    (Array.isArray(note.frontmatter.skills) && note.frontmatter.skills.length > 0) ||
    (Array.isArray(note.frontmatter.tools) && note.frontmatter.tools.length > 0)
  )
    score += 1;
  // owner / provider / responsibilities
  if (
    (typeof note.frontmatter.owner === 'string' && note.frontmatter.owner) ||
    (typeof note.frontmatter.provider === 'string' && note.frontmatter.provider) ||
    (Array.isArray(note.frontmatter.responsibilities) &&
      note.frontmatter.responsibilities.length > 0)
  )
    score += 1;
  if (backlinkCount > 0) score += 1;
  return { score, max };
}

function getStatusValue(note: VaultNote): string {
  const s =
    typeof note.frontmatter.status === 'string' ? note.frontmatter.status.toLowerCase() : '';
  return s === 'inactive' ? 'inactive' : 'active';
}

export function AgentsView({ notes, onSelectNote }: AgentsViewProps) {
  const entities = notes.filter((n) => getWorkspaceEntityType(n) === 'agent');

  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [roleQuery, setRoleQuery] = useState('');
  const [modelQuery, setModelQuery] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [detailNote, setDetailNote] = useState<VaultNote | null>(null);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelOverrides, setModelOverrides] = useState<Record<string, string>>(() =>
    loadAgentModels(),
  );

  // Fetch available models from LM Studio
  const refreshModels = useCallback(async () => {
    const config = loadAIProviderConfig();
    if (config.provider !== 'lmstudio' || !config.lmStudio.baseUrl) return;
    setModelsLoading(true);
    try {
      const models = await getModels(config.lmStudio);
      setAvailableModels(models);
    } catch {
      setAvailableModels([]);
    } finally {
      setModelsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshModels();
  }, [refreshModels]);

  const allTags = useMemo(() => {
    const s = new Set<string>();
    entities.forEach((a) => a.tags.forEach((t) => s.add(t)));
    return Array.from(s).sort();
  }, [entities]);

  const filtered = useMemo(() => {
    return entities.filter((note) => {
      if (statusFilter !== 'all' && getStatusValue(note) !== statusFilter) return false;
      const role = typeof note.frontmatter.role === 'string' ? note.frontmatter.role : '';
      if (roleQuery && !role.toLowerCase().includes(roleQuery.toLowerCase())) return false;
      const model = typeof note.frontmatter.model === 'string' ? note.frontmatter.model : '';
      if (modelQuery && !model.toLowerCase().includes(modelQuery.toLowerCase())) return false;
      if (tagFilter && !note.tags.includes(tagFilter)) return false;
      return true;
    });
  }, [entities, statusFilter, roleQuery, modelQuery, tagFilter]);

  const hasFilters = statusFilter !== 'all' || roleQuery || modelQuery || tagFilter;
  const clearFilters = () => {
    setStatusFilter('all');
    setRoleQuery('');
    setModelQuery('');
    setTagFilter('');
  };

  const agentTasks = useMemo(() => {
    const byPath = new Map<string, number>();
    notes.forEach((n) => {
      const cnt = n.tasks.filter((t) => !t.completed).length;
      if (cnt > 0) byPath.set(getNoteKey(n), cnt);
    });
    return byPath;
  }, [notes]);

  return (
    <main className="page-scroll view-page">
      <div className="page-header">
        <div>
          <span className="eyebrow">Agent-ready workspace</span>
          <h1>
            <Bot size={20} /> Agents
          </h1>
          <p>Track agent profiles, model choices, and ownership metadata.</p>
        </div>
      </div>

      <div className="agents-filter-bar">
        <div className="agents-filter-group">
          <button
            type="button"
            className={`agents-filter-btn ${statusFilter === 'all' ? 'active' : ''}`}
            onClick={() => setStatusFilter('all')}
          >
            All ({entities.length})
          </button>
          <button
            type="button"
            className={`agents-filter-btn ${statusFilter === 'active' ? 'active' : ''}`}
            onClick={() => setStatusFilter('active')}
          >
            Active
          </button>
          <button
            type="button"
            className={`agents-filter-btn ${statusFilter === 'inactive' ? 'active' : ''}`}
            onClick={() => setStatusFilter('inactive')}
          >
            Inactive
          </button>
        </div>
        <div className="agents-filter-fields">
          <label className="agents-filter-field">
            <Search size={12} />
            <input
              value={roleQuery}
              onChange={(e) => setRoleQuery(e.target.value)}
              placeholder="Role…"
              aria-label="Filter by role"
            />
          </label>
          <label className="agents-filter-field">
            <Search size={12} />
            <input
              value={modelQuery}
              onChange={(e) => setModelQuery(e.target.value)}
              placeholder="Model…"
              aria-label="Filter by model"
            />
          </label>
          <select
            className="agents-filter-select"
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            aria-label="Filter by tag"
          >
            <option value="">All tags</option>
            {allTags.map((tag) => (
              <option key={tag} value={tag}>
                #{tag}
              </option>
            ))}
          </select>
          {hasFilters && (
            <button type="button" className="agents-filter-clear" onClick={clearFilters}>
              <X size={10} /> Clear
            </button>
          )}
        </div>
      </div>

      <div className="agent-rich-grid">
        {filtered.length ? (
          filtered.map((note) => {
            const backlinks = buildBacklinks(notes, note);
            const readiness = computeReadiness(note, backlinks.length);
            return (
              <AgentRichCard
                key={getNoteKey(note)}
                note={note}
                allNotes={notes}
                onSelectNote={onSelectNote}
                readiness={readiness}
                onOpenDetail={() => setDetailNote(note)}
                activeTaskCount={agentTasks.get(getNoteKey(note)) ?? 0}
                availableModels={availableModels}
                modelsLoading={modelsLoading}
                onRefreshModels={refreshModels}
                modelOverrides={modelOverrides}
                onModelOverride={(key, model) => {
                  saveAgentModel(key, model);
                  setModelOverrides((prev) => ({ ...prev, [key]: model }));
                }}
              />
            );
          })
        ) : (
          <div className="panel-card" style={{ gridColumn: '1 / -1' }}>
            {entities.length === 0 ? (
              <>
                <h3>
                  <CheckCircle2 size={16} /> Create your first workspace entity
                </h3>
                <p>
                  Add markdown notes under <code>Agents/</code>, <code>Skills/</code>, or{' '}
                  <code>Tools/</code>, or set <code>type: agent</code>, <code>type: skill</code>, or{' '}
                  <code>type: tool</code>.
                </p>
                <pre>{`---\ntype: skill\ntags: [skill, research]\n---\n# Literature Review`}</pre>
              </>
            ) : (
              <>
                <h3>
                  <X size={16} /> No entities match these filters
                </h3>
                <p>Try adjusting your filter criteria.</p>
              </>
            )}
          </div>
        )}
      </div>

      {detailNote && (
        <AgentDetailDrawer
          note={detailNote}
          allNotes={notes}
          onClose={() => setDetailNote(null)}
          onSelectNote={(path) => {
            onSelectNote(path);
            setDetailNote(null);
          }}
        />
      )}
    </main>
  );
}

interface AgentRichCardProps {
  note: VaultNote;
  allNotes: VaultNote[];
  onSelectNote: (path: string) => void;
  readiness: { score: number; max: number };
  onOpenDetail: () => void;
  activeTaskCount: number;
  availableModels: string[];
  modelsLoading: boolean;
  onRefreshModels: () => void;
  modelOverrides: Record<string, string>;
  onModelOverride: (noteKey: string, model: string) => void;
}

function AgentRichCard({
  note,
  allNotes,
  onSelectNote,
  readiness,
  onOpenDetail,
  activeTaskCount,
  availableModels,
  modelsLoading,
  onRefreshModels,
  modelOverrides,
  onModelOverride,
}: AgentRichCardProps) {
  const backlinks = useMemo(() => buildBacklinks(allNotes, note), [allNotes, note]);
  const outgoingLinks = useMemo(() => {
    return note.links
      .map((link) => {
        const target = allNotes.find(
          (n) =>
            n.title.toLowerCase() === link.target.toLowerCase() ||
            n.path.toLowerCase().includes(link.target.toLowerCase()),
        );
        return target ? { raw: link.raw, target: link.target, note: target } : null;
      })
      .filter(Boolean) as { raw: string; target: string; note: VaultNote }[];
  }, [note, allNotes]);

  const role = typeof note.frontmatter.role === 'string' ? note.frontmatter.role : null;
  const entityType = getWorkspaceEntityType(note) ?? 'agent';
  const status =
    typeof note.frontmatter.status === 'string'
      ? note.frontmatter.status.toLowerCase()
      : 'inactive';
  const skills = Array.isArray(note.frontmatter.skills) ? note.frontmatter.skills : [];
  const noteKey = getNoteKey(note);
  const model =
    modelOverrides[noteKey] ||
    (typeof note.frontmatter.model === 'string' ? note.frontmatter.model : null);
  const description =
    note.content
      .split('\n')
      .find((line) => !line.startsWith('#') && !line.startsWith('---') && line.trim()) || '';

  const copyLink = () => {
    void navigator.clipboard.writeText(note.path);
  };

  const pct = readiness.max > 0 ? Math.round((readiness.score / readiness.max) * 100) : 0;

  return (
    <article className="agent-rich-card">
      <div className="agent-card-header">
        <div className="agent-avatar large">
          <Brain size={24} />
        </div>
        <div className="agent-identity">
          <h3>{note.title}</h3>
          <p className="agent-role">{role || entityType}</p>
          <span className={`agent-status ${status}`}>
            {status === 'active' ? 'Active' : 'Inactive'}
          </span>
        </div>
        <div className="agent-actions">
          <button
            className="icon-btn"
            onClick={() => onSelectNote(getNoteKey(note))}
            title="Open note"
            aria-label="Open note"
          >
            <ExternalLink size={14} />
          </button>
        </div>
      </div>

      <div className="agent-readiness-bar" title={`Readiness: ${readiness.score}/${readiness.max}`}>
        <div className="agent-readiness-fill" style={{ width: `${pct}%` }} />
        <span className="agent-readiness-label">
          {readiness.score}/{readiness.max}
        </span>
      </div>

      <div className="agent-card-body" onClick={onOpenDetail} style={{ cursor: 'pointer' }}>
        {description && <p className="agent-description">{description}</p>}

        {skills.length > 0 && (
          <div className="agent-skills">
            {skills.map((skill) => (
              <em key={skill}>#{skill}</em>
            ))}
          </div>
        )}

        <div className="agent-metadata">
          <div className="agent-model-selector">
            <span>Model</span>
            <div className="agent-model-select-row">
              <select
                value={model ?? ''}
                onChange={(e) => {
                  const selected = e.target.value;
                  if (selected) onModelOverride(noteKey, selected);
                }}
              >
                <option value="" disabled>
                  {model ? model : 'Select model...'}
                </option>
                {availableModels.length === 0 && model && <option value={model}>{model}</option>}
                {availableModels.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <button
                className="icon-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onRefreshModels();
                }}
                title="Refresh model list"
                aria-label="Refresh model list"
              >
                <RefreshCw size={12} className={modelsLoading ? 'spin' : ''} />
              </button>
            </div>
            {modelsLoading && <small className="agent-model-loading">Loading models…</small>}
          </div>
          <div>
            <span>Tasks</span>
            <strong>{activeTaskCount} active</strong>
          </div>
        </div>

        <div className="agent-card-actions-row">
          <button
            className="ghost-button"
            onClick={(e) => {
              e.stopPropagation();
              onSelectNote(getNoteKey(note));
            }}
          >
            <ExternalLink size={11} /> Open
          </button>
          <button
            className="ghost-button"
            onClick={(e) => {
              e.stopPropagation();
              copyLink();
            }}
            title="Copy note path"
          >
            <Copy size={11} /> Copy link
          </button>
        </div>

        {(backlinks.length > 0 || outgoingLinks.length > 0) && (
          <div className="agent-links-section">
            {backlinks.length > 0 && (
              <div className="agent-links-subsection">
                <h4>Backlinks ({backlinks.length})</h4>
                {backlinks.slice(0, 3).map((bl) => (
                  <button
                    key={bl.sourceKey}
                    className="backlink-card"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectNote(bl.sourceKey);
                    }}
                  >
                    <strong>{bl.sourceTitle}</strong>
                  </button>
                ))}
              </div>
            )}
            {outgoingLinks.length > 0 && (
              <div className="agent-links-subsection">
                <h4>Outgoing ({outgoingLinks.length})</h4>
                {outgoingLinks.slice(0, 3).map((link) => (
                  <button
                    key={link.target}
                    className="link-pill"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectNote(getNoteKey(link.note));
                    }}
                  >
                    <Link2 size={11} />
                    {link.note.title}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="agent-card-footer">
        <span>{note.path}</span>
        <span>Updated {new Date(note.updatedAt).toLocaleDateString()}</span>
      </div>
    </article>
  );
}

function AgentDetailDrawer({
  note,
  allNotes,
  onClose,
  onSelectNote,
}: {
  note: VaultNote;
  allNotes: VaultNote[];
  onClose: () => void;
  onSelectNote: (path: string) => void;
}) {
  const backlinks = useMemo(() => buildBacklinks(allNotes, note), [allNotes, note]);
  const outgoingLinks = useMemo(() => {
    return note.links
      .map((link) => {
        const target = allNotes.find(
          (n) =>
            n.title.toLowerCase() === link.target.toLowerCase() ||
            n.path.toLowerCase().includes(link.target.toLowerCase()),
        );
        return target ? { raw: link.raw, target: link.target, note: target } : null;
      })
      .filter(Boolean) as { raw: string; target: string; note: VaultNote }[];
  }, [note, allNotes]);

  const skills = Array.isArray(note.frontmatter.skills) ? note.frontmatter.skills : [];
  const model = typeof note.frontmatter.model === 'string' ? note.frontmatter.model : null;
  const role = typeof note.frontmatter.role === 'string' ? note.frontmatter.role : null;
  const entityType = getWorkspaceEntityType(note) ?? 'agent';
  const description =
    note.content
      .split('\n')
      .find((line) => !line.startsWith('#') && !line.startsWith('---') && line.trim()) || '';

  const otherFrontmatter = Object.entries(note.frontmatter).filter(
    ([k]) => !['role', 'status', 'model', 'skills', 'type', 'tags'].includes(k),
  );

  return (
    <>
      <div className="detail-drawer-backdrop" onClick={onClose} aria-hidden="true" />
      <aside className="detail-drawer" role="dialog" aria-label={`${note.title} details`}>
        <div className="detail-drawer-header">
          <div>
            <h3>{note.title}</h3>
            <p className="detail-drawer-role">{role || entityType}</p>
          </div>
          <button className="detail-drawer-close" onClick={onClose} aria-label="Close">
            <X size={15} />
          </button>
        </div>

        <div className="detail-drawer-body">
          {description && <p className="detail-drawer-description">{description}</p>}

          {model && (
            <div className="detail-drawer-field">
              <span className="detail-drawer-field-label">Model</span>
              <span className="detail-drawer-field-value">{model}</span>
            </div>
          )}

          {skills.length > 0 && (
            <div className="detail-drawer-field">
              <span className="detail-drawer-field-label">Skills</span>
              <div className="agent-skills">
                {skills.map((s) => (
                  <em key={s}>#{s}</em>
                ))}
              </div>
            </div>
          )}

          {otherFrontmatter.map(([key, value]) => (
            <div key={key} className="detail-drawer-field">
              <span className="detail-drawer-field-label">{key}</span>
              <span className="detail-drawer-field-value">
                {Array.isArray(value) ? value.join(', ') : String(value)}
              </span>
            </div>
          ))}

          <div className="detail-drawer-field">
            <span className="detail-drawer-field-label">Path</span>
            <code className="detail-drawer-path">{note.path}</code>
          </div>

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
          <button className="primary-button" onClick={() => onSelectNote(getNoteKey(note))}>
            <ExternalLink size={13} /> Open note
          </button>
        </div>
      </aside>
    </>
  );
}
