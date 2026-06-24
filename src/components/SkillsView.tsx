import {
  Bot,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  FolderOpen,
  Grid,
  List,
  Search,
  Settings,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Skill, VaultNote } from '../types';
import { getNoteKey } from '../utils/noteKey';
import { getSkillUsage } from '../utils/usageStore';
import {
  getRelatedAgentsForSkill,
  getRelatedToolsForSkill,
  getSkillLastUsed,
  getSkillsFromNotes,
  isSkillNote,
  loadSkillMetadata,
  validateSkillStructure,
} from '../utils/skills';

interface SkillsViewProps {
  notes: VaultNote[];
  onSelectNote: (noteKey: string) => void;
  onEditSkill: (skill: VaultNote) => void;
}

type SortMode = 'usage' | 'alphabetical' | 'recent';

export function SkillsView({ notes, onSelectNote, onEditSkill }: SkillsViewProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<SortMode>('usage');
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<VaultNote | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const skills = useMemo(() => getSkillsFromNotes(notes), [notes]);

  // Load skill usage stats
  const skillUsageStats = useMemo(() => {
    const stats = getSkillUsage();
    return stats;
  }, [notes]);

  const skillUsageMap = useMemo(() => {
    const map = new Map<string, { totalUses: number; lastUsed: number | null }>();
    for (const stat of skillUsageStats) {
      map.set(stat.skillId, { totalUses: stat.totalUses, lastUsed: stat.lastUsed });
    }
    return map;
  }, [skillUsageStats]);

  const allTags = useMemo(() => {
    const s = new Set<string>();
    skills.forEach((skill) => skill.tags.forEach((t) => s.add(t)));
    return Array.from(s).sort();
  }, [skills]);

  const filteredSkills = useMemo(() => {
    let result = skills;

    if (filterTag) {
      result = result.filter((skill) => skill.tags.includes(filterTag));
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (skill) =>
          skill.name.toLowerCase().includes(query) ||
          skill.description.toLowerCase().includes(query),
      );
    }

    return result.sort((a, b) => {
      if (sortBy === 'alphabetical') {
        return a.name.localeCompare(b.name);
      }
      if (sortBy === 'recent') {
        const aTime = a.updatedAt ?? 0;
        const bTime = b.updatedAt ?? 0;
        return bTime - aTime;
      }
      // 'usage' - sort by number of related agents
      const aAgents = getRelatedAgentsForSkill(a, notes).length;
      const bAgents = getRelatedAgentsForSkill(b, notes).length;
      return bAgents - aAgents || a.name.localeCompare(b.name);
    });
  }, [skills, filterTag, searchQuery, sortBy, notes]);

  const hasFilters = filterTag !== null || searchQuery !== '';
  const clearFilters = () => {
    setFilterTag(null);
    setSearchQuery('');
  };

  return (
    <main className="page-scroll view-page">
      <div className="page-header">
        <div>
          <span className="eyebrow">Reusable capabilities</span>
          <h1>
            <Settings size={20} /> Skills
          </h1>
          <p>Browse reusable skills that agents can use to accomplish tasks.</p>
        </div>
        <div className="graph-toolbar">
          <button
            className={`icon-btn ${viewMode === 'grid' ? 'active' : ''}`}
            onClick={() => setViewMode('grid')}
            title="Grid view"
          >
            <Grid size={14} />
          </button>
          <button
            className={`icon-btn ${viewMode === 'list' ? 'active' : ''}`}
            onClick={() => setViewMode('list')}
            title="List view"
          >
            <List size={14} />
          </button>
        </div>
      </div>

      <div className="agents-filter-bar">
        <div className="agents-filter-group">
          <button
            type="button"
            className={`agents-filter-btn ${sortBy === 'usage' ? 'active' : ''}`}
            onClick={() => setSortBy('usage')}
          >
            By Usage
          </button>
          <button
            type="button"
            className={`agents-filter-btn ${sortBy === 'alphabetical' ? 'active' : ''}`}
            onClick={() => setSortBy('alphabetical')}
          >
            A-Z
          </button>
          <button
            type="button"
            className={`agents-filter-btn ${sortBy === 'recent' ? 'active' : ''}`}
            onClick={() => setSortBy('recent')}
          >
            Recent
          </button>
        </div>
        <div className="agents-filter-fields">
          <label className="agents-filter-field">
            <Search size={12} />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search skills…"
              aria-label="Search skills"
            />
          </label>
          {allTags.length > 0 && (
            <select
              className="agents-filter-select"
              value={filterTag ?? ''}
              onChange={(e) => setFilterTag(e.target.value || null)}
              aria-label="Filter by tag"
            >
              <option value="">All tags</option>
              {allTags.map((tag) => (
                <option key={tag} value={tag}>
                  #{tag}
                </option>
              ))}
            </select>
          )}
          {hasFilters && (
            <button type="button" className="agents-filter-clear" onClick={clearFilters}>
              <X size={10} /> Clear
            </button>
          )}
        </div>
      </div>

      {filteredSkills.length > 0 ? (
        <div className={viewMode === 'grid' ? 'agent-rich-grid' : 'note-list-cards'}>
          {filteredSkills.map((skill) => {
            const skillNote = notes.find(
              (n) => n.path.toLowerCase() === skill.skillFilePath.toLowerCase(),
            );
            if (!skillNote) return null;

            return (
              <SkillCard
                key={skill.id}
                skill={skill}
                skillNote={skillNote}
                allNotes={notes}
                viewMode={viewMode}
                onSelectNote={onSelectNote}
                onOpenDetail={() => setSelectedSkill(skillNote)}
                onEditSkill={onEditSkill}
                skillUsage={skillUsageMap.get(skill.id)}
              />
            );
          })}
        </div>
      ) : (
        <div className="panel-card" style={{ gridColumn: '1 / -1' }}>
          {skills.length === 0 ? (
            <>
              <h3>
                <CheckCircle2 size={16} /> Create your first skill
              </h3>
              <p>
                Add markdown notes under <code>Skills/</code>, or set <code>type: skill</code>.
              </p>
              <pre>{`---\ntype: skill\nname: Literature Review\ndescription: Use when researching a topic.\ntags: [research, analysis]\n---\n# Literature Review`}</pre>
            </>
          ) : (
            <>
              <h3>
                <X size={16} /> No skills match these filters
              </h3>
              <p>Try adjusting your filter criteria.</p>
            </>
          )}
        </div>
      )}

      {selectedSkill && (
        <SkillDetailDrawer
          skill={loadSkillMetadata(selectedSkill)}
          skillNote={selectedSkill}
          allNotes={notes}
          onClose={() => setSelectedSkill(null)}
          onSelectNote={(path) => {
            onSelectNote(path);
            setSelectedSkill(null);
          }}
          onEditSkill={onEditSkill}
          skillUsage={skillUsageMap.get(loadSkillMetadata(selectedSkill).id)}
        />
      )}
    </main>
  );
}

interface SkillCardProps {
  skill: Skill;
  skillNote: VaultNote;
  allNotes: VaultNote[];
  viewMode: 'grid' | 'list';
  onSelectNote: (path: string) => void;
  onOpenDetail: () => void;
  onEditSkill: (skill: VaultNote) => void;
  skillUsage?: { totalUses: number; lastUsed: number | null };
}

function SkillCard({
  skill,
  skillNote,
  allNotes,
  viewMode,
  onSelectNote,
  onOpenDetail,
  onEditSkill,
  skillUsage,
}: SkillCardProps) {
  const relatedAgents = useMemo(() => getRelatedAgentsForSkill(skill, allNotes), [skill, allNotes]);
  const relatedTools = useMemo(() => getRelatedToolsForSkill(skill, allNotes), [skill, allNotes]);
  const lastUsed = useMemo(() => getSkillLastUsed(skill, allNotes), [skill, allNotes]);

  const copyLink = () => {
    void navigator.clipboard.writeText(skill.skillFilePath);
  };

  if (viewMode === 'list') {
    return (
      <article className="panel-card skill-list-card" onClick={onOpenDetail}>
        <div className="skill-list-header">
          <div>
            <h3>{skill.name}</h3>
            <span className={`agent-status ${skill.status}`}>
              {skill.status === 'active'
                ? 'Active'
                : skill.status === 'error'
                  ? 'Error'
                  : 'Inactive'}
            </span>
          </div>
          <div className="agent-actions">
            <button
              className="icon-btn"
              onClick={(e) => {
                e.stopPropagation();
                onSelectNote(getNoteKey(skillNote));
              }}
              title="Open note"
              aria-label="Open note"
            >
              <ExternalLink size={14} />
            </button>
          </div>
        </div>
        {skill.description && <p className="agent-description">{skill.description}</p>}
        <div className="skill-list-meta">
          {relatedAgents.length > 0 && (
            <span>Used by: {relatedAgents.map((a) => a.title).join(', ')}</span>
          )}
          {skillUsage && skillUsage.totalUses > 0 && (
            <span>
              <Clock size={10} style={{ display: 'inline', verticalAlign: 'middle' }} />{' '}
              {skillUsage.totalUses} invocations
            </span>
          )}
          {skillUsage && skillUsage.lastUsed && (
            <span>Last used: {new Date(skillUsage.lastUsed).toLocaleDateString()}</span>
          )}
          {!skillUsage?.lastUsed && lastUsed && <span>Last used: {lastUsed.toLocaleDateString()}</span>}
        </div>
      </article>
    );
  }

  return (
    <article className="agent-rich-card">
      <div className="agent-card-header">
        <div className="agent-avatar large">
          <Settings size={24} />
        </div>
        <div className="agent-identity">
          <h3>{skill.name}</h3>
          <p className="agent-role">Skill</p>
          <span className={`agent-status ${skill.status}`}>
            {skill.status === 'active' ? 'Active' : skill.status === 'error' ? 'Error' : 'Inactive'}
          </span>
        </div>
        <div className="agent-actions">
          <button
            className="icon-btn"
            onClick={() => onSelectNote(getNoteKey(skillNote))}
            title="Open note"
            aria-label="Open note"
          >
            <ExternalLink size={14} />
          </button>
        </div>
      </div>

      <div className="agent-card-body" onClick={onOpenDetail} style={{ cursor: 'pointer' }}>
        {skill.description && <p className="agent-description">{skill.description}</p>}

        {skill.tags.length > 0 && (
          <div className="agent-skills">
            {skill.tags.map((tag) => (
              <em key={tag}>#{tag}</em>
            ))}
          </div>
        )}

        <div className="agent-metadata">
          <div>
            <span>Used by</span>
            <strong>
              {relatedAgents.length} agent{relatedAgents.length !== 1 ? 's' : ''}
            </strong>
          </div>
          <div>
            <span>Tools</span>
            <strong>{relatedTools.length}</strong>
          </div>
          {skillUsage && skillUsage.totalUses > 0 && (
            <div>
              <span>Invocations</span>
              <strong>{skillUsage.totalUses}</strong>
            </div>
          )}
        </div>

        <div className="agent-card-actions-row">
          <button
            className="ghost-button"
            onClick={(e) => {
              e.stopPropagation();
              onSelectNote(getNoteKey(skillNote));
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
            title="Copy skill path"
          >
            <Copy size={11} /> Copy link
          </button>
        </div>

        {relatedAgents.length > 0 && (
          <div className="agent-links-section">
            <div className="agent-links-subsection">
              <h4>Used by ({relatedAgents.length})</h4>
              {relatedAgents.slice(0, 3).map((agent) => (
                <button
                  key={getNoteKey(agent)}
                  className="backlink-card"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectNote(getNoteKey(agent));
                  }}
                >
                  <strong>{agent.title}</strong>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="agent-card-footer">
        <span>{skill.folderPath}</span>
        {skillUsage && skillUsage.lastUsed && (
          <span title="From usage tracking">
            <Clock size={10} /> {new Date(skillUsage.lastUsed).toLocaleDateString()}
          </span>
        )}
        {!skillUsage?.lastUsed && lastUsed && (
          <span>Last used {lastUsed.toLocaleDateString()}</span>
        )}
      </div>
    </article>
  );
}

interface SkillDetailDrawerProps {
  skill: Skill;
  skillNote: VaultNote;
  allNotes: VaultNote[];
  onClose: () => void;
  onSelectNote: (path: string) => void;
  onEditSkill: (skill: VaultNote) => void;
  skillUsage?: { totalUses: number; lastUsed: number | null };
}

function SkillDetailDrawer({
  skill,
  skillNote,
  allNotes,
  onClose,
  onSelectNote,
  onEditSkill,
  skillUsage,
}: SkillDetailDrawerProps) {
  const relatedAgents = useMemo(() => getRelatedAgentsForSkill(skill, allNotes), [skill, allNotes]);
  const relatedTools = useMemo(() => getRelatedToolsForSkill(skill, allNotes), [skill, allNotes]);
  const lastUsed = useMemo(() => getSkillLastUsed(skill, allNotes), [skill, allNotes]);
  const validation = useMemo(() => validateSkillStructure(skill), [skill]);

  const otherFrontmatter = Object.entries(skillNote.frontmatter).filter(
    ([k]) =>
      ![
        'name',
        'description',
        'status',
        'type',
        'tags',
        'tools',
        'memory',
        'version',
        'author',
      ].includes(k),
  );

  return (
    <>
      <div className="detail-drawer-backdrop" onClick={onClose} aria-hidden="true" />
      <aside className="detail-drawer" role="dialog" aria-label={`${skill.name} details`}>
        <div className="detail-drawer-header">
          <div>
            <h3>{skill.name}</h3>
            <p className="detail-drawer-role">Skill</p>
          </div>
          <button className="detail-drawer-close" onClick={onClose} aria-label="Close">
            <X size={15} />
          </button>
        </div>

        <div className="detail-drawer-body">
          {skill.description && <p className="detail-drawer-description">{skill.description}</p>}

          <div className="detail-drawer-field">
            <span className="detail-drawer-field-label">Status</span>
            <span className={`agent-status ${skill.status}`}>
              {skill.status === 'active'
                ? 'Active'
                : skill.status === 'error'
                  ? 'Error'
                  : 'Inactive'}
            </span>
          </div>

          {skill.version && (
            <div className="detail-drawer-field">
              <span className="detail-drawer-field-label">Version</span>
              <span className="detail-drawer-field-value">{skill.version}</span>
            </div>
          )}

          {skill.author && (
            <div className="detail-drawer-field">
              <span className="detail-drawer-field-label">Author</span>
              <span className="detail-drawer-field-value">{skill.author}</span>
            </div>
          )}

          {skill.tags.length > 0 && (
            <div className="detail-drawer-field">
              <span className="detail-drawer-field-label">Tags</span>
              <div className="agent-skills">
                {skill.tags.map((t) => (
                  <em key={t}>#{t}</em>
                ))}
              </div>
            </div>
          )}

          {skill.tools.length > 0 && (
            <div className="detail-drawer-field">
              <span className="detail-drawer-field-label">Tools</span>
              <div className="agent-skills">
                {skill.tools.map((t) => (
                  <em key={t}>{t}</em>
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
            <code className="detail-drawer-path">{skill.folderPath}</code>
          </div>

          {lastUsed && (
            <div className="detail-drawer-field">
              <span className="detail-drawer-field-label">Last Used</span>
              <span className="detail-drawer-field-value">{lastUsed.toLocaleDateString()}</span>
            </div>
          )}

          {skillUsage && skillUsage.totalUses > 0 && (
            <>
              <div className="detail-drawer-field">
                <span className="detail-drawer-field-label">Total Invocations</span>
                <span className="detail-drawer-field-value">{skillUsage.totalUses}</span>
              </div>
              {skillUsage.lastUsed && (
                <div className="detail-drawer-field">
                  <span className="detail-drawer-field-label">Last Invoked</span>
                  <span className="detail-drawer-field-value">
                    {new Date(skillUsage.lastUsed).toLocaleDateString()}
                  </span>
                </div>
              )}
            </>
          )}

          {!validation.valid && (
            <div className="detail-drawer-field">
              <span className="detail-drawer-field-label">Issues</span>
              <ul style={{ color: 'var(--error)', margin: '4px 0', paddingLeft: '16px' }}>
                {validation.errors.map((err, i) => (
                  <li key={i} style={{ fontSize: '12px' }}>
                    {err}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {relatedAgents.length > 0 && (
            <div className="detail-drawer-section">
              <h4>Used by ({relatedAgents.length})</h4>
              <div className="detail-drawer-links">
                {relatedAgents.map((agent) => (
                  <button
                    key={getNoteKey(agent)}
                    className="backlink-card"
                    onClick={() => onSelectNote(getNoteKey(agent))}
                  >
                    <strong>{agent.title}</strong>
                    <small>{(agent.frontmatter.role as string) || 'Agent'}</small>
                  </button>
                ))}
              </div>
            </div>
          )}

          {relatedTools.length > 0 && (
            <div className="detail-drawer-section">
              <h4>Related Tools ({relatedTools.length})</h4>
              <div className="detail-drawer-links">
                {relatedTools.map((tool) => (
                  <button
                    key={getNoteKey(tool)}
                    className="link-pill"
                    onClick={() => onSelectNote(getNoteKey(tool))}
                  >
                    <Settings size={11} />
                    {tool.title}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="detail-drawer-footer">
          <button className="primary-button" onClick={() => onSelectNote(getNoteKey(skillNote))}>
            <ExternalLink size={13} /> Open note
          </button>
          <button className="ghost-button" onClick={() => onEditSkill(skillNote)}>
            <Settings size={13} /> Edit SKILL.md
          </button>
        </div>
      </aside>
    </>
  );
}
