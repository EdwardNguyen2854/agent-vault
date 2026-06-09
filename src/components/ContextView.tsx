import {
  Bot,
  Brain,
  Check,
  ChevronDown,
  ChevronRight,
  FileText,
  Hash,
  Search,
  SlidersHorizontal,
  Terminal,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { AgentContextItem, VaultNote } from '../types';
import {
  buildAgentContext,
  buildContextSettingsFromUI,
  estimateContextItemTokens,
  filterContextItemsForAgent,
  getContextItemKey,
  loadAgentContextOverrides,
  saveAgentContextOverrides,
  setAgentContextItemDisabled,
} from '../utils/context';
import { getWorkspaceEntityType, resolveLinkTarget } from '../utils/markdown';
import { getNoteKey } from '../utils/noteKey';
import {
  loadContextSettings,
  saveContextSettings,
  type UIContextSettings,
} from '../utils/settings';
import { MarkdownPreview } from './MarkdownPreview';

type ContextFilter = 'all' | 'enabled' | 'disabled';
type ContextTypeFilter = 'tool' | 'skill' | 'memory';

interface ContextViewProps {
  notes: VaultNote[];
  selectedNote: VaultNote | null;
  onSelectNote: (key: string) => void;
}

function itemIcon(type: AgentContextItem['type']) {
  if (type === 'agent') return <Brain size={13} />;
  if (type === 'skill') return <Hash size={13} />;
  if (type === 'tool') return <Terminal size={13} />;
  if (type === 'memory') return <Bot size={13} />;
  return <FileText size={13} />;
}

function getPreview(content: string): string {
  return content
    .replace(/^---[\s\S]*?---\n?/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 220);
}

export function ContextView({ notes, selectedNote, onSelectNote }: ContextViewProps) {
  const [settings, setSettings] = useState<UIContextSettings>(() => loadContextSettings());
  const [selectedAgentKey, setSelectedAgentKey] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ContextFilter>('all');
  const [typeFilters, setTypeFilters] = useState<Set<ContextTypeFilter>>(new Set());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<AgentContextItem | null>(null);
  const [overrides, setOverrides] = useState(() => loadAgentContextOverrides());

  const agents = useMemo(() => {
    return notes
      .filter((note) => getWorkspaceEntityType(note) === 'agent')
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [notes]);

  useEffect(() => {
    if (selectedAgentKey && agents.some((agent) => getNoteKey(agent) === selectedAgentKey)) return;
    const selectedIsAgent =
      selectedNote && getWorkspaceEntityType(selectedNote) === 'agent' ? selectedNote : null;
    const activeAgent = agents.find((agent) => {
      const status =
        typeof agent.frontmatter.status === 'string'
          ? agent.frontmatter.status.toLowerCase()
          : 'active';
      return status !== 'inactive';
    });
    const fallback = selectedIsAgent ?? activeAgent ?? agents[0] ?? null;
    setSelectedAgentKey(fallback ? getNoteKey(fallback) : '');
  }, [agents, selectedAgentKey, selectedNote]);

  const selectedAgent = useMemo(
    () => agents.find((agent) => getNoteKey(agent) === selectedAgentKey) ?? null,
    [agents, selectedAgentKey],
  );

  const rawItems = useMemo(() => {
    if (!selectedAgent) return [];
    const context = buildAgentContext({
      config: buildContextSettingsFromUI(settings, {
        includeCurrentNote: false,
        includeSkill: false,
      }),
      currentNote: selectedAgent,
      notes,
      selectedAgent,
      selectedSkill: null,
    });
    return context.items;
  }, [notes, selectedAgent, settings]);

  const requiredKeys = useMemo(() => {
    if (!selectedAgent) return new Set<string>();
    return new Set([`agent:${getNoteKey(selectedAgent)}`]);
  }, [selectedAgent]);

  const enabledItems = useMemo(
    () => filterContextItemsForAgent(rawItems, selectedAgentKey, overrides, requiredKeys),
    [rawItems, selectedAgentKey, overrides, requiredKeys],
  );

  const enabledKeys = useMemo(() => new Set(enabledItems.map(getContextItemKey)), [enabledItems]);
  const disabledCount = rawItems.length - enabledItems.length;
  const enabledTokens = enabledItems.reduce(
    (sum, item) => sum + estimateContextItemTokens(item),
    0,
  );
  const totalTokens = rawItems.reduce((sum, item) => sum + estimateContextItemTokens(item), 0);

  const visibleItems = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rawItems.filter((item) => {
      const enabled = enabledKeys.has(getContextItemKey(item));
      if (filter === 'enabled' && !enabled) return false;
      if (filter === 'disabled' && enabled) return false;
      if (typeFilters.size > 0 && !typeFilters.has(item.type as ContextTypeFilter)) return false;
      if (!needle) return true;
      return [item.type, item.title, item.path ?? '', item.content]
        .join(' ')
        .toLowerCase()
        .includes(needle);
    });
  }, [enabledKeys, filter, query, rawItems, typeFilters]);

  const toggleItem = (item: AgentContextItem) => {
    if (!selectedAgentKey) return;
    const itemKey = getContextItemKey(item);
    if (requiredKeys.has(itemKey)) return;
    const next = setAgentContextItemDisabled(
      overrides,
      selectedAgentKey,
      itemKey,
      enabledKeys.has(itemKey),
    );
    setOverrides(next);
    saveAgentContextOverrides(next);
  };

  const openWikiLink = (target: string) => {
    const note = resolveLinkTarget(notes, target);
    if (note) onSelectNote(getNoteKey(note));
  };

  const updateSetting = <K extends keyof UIContextSettings>(
    key: K,
    value: UIContextSettings[K],
  ) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      saveContextSettings(next);
      return next;
    });
  };

  const updateBudget = (raw: string) => {
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed)) return;
    const clamped = Math.max(256, Math.min(32768, parsed));
    updateSetting('maxContextSize', clamped);
  };

  const resetSettings = () => {
    const defaults: UIContextSettings = {
      defaultDepth: 1,
      includeBacklinks: true,
      includeMemory: true,
      includeTools: true,
      maxContextSize: 4096,
    };
    setSettings(defaults);
    saveContextSettings(defaults);
  };

  const toggleTypeFilter = (type: ContextTypeFilter) => {
    setTypeFilters((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  useEffect(() => {
    if (!detailItem) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDetailItem(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [detailItem]);

  return (
    <main className="context-view">
      <header className="context-header">
        <div>
          <h1>
            <Bot size={20} /> Agent Context
          </h1>
          <p>
            Preview each agent's default runtime context and control which optional items are sent
            to chat.
          </p>
        </div>
        <div className="context-summary">
          <span>
            <Check size={13} /> {enabledItems.length} enabled
          </span>
          <span>
            <X size={13} /> {disabledCount} disabled
          </span>
          <span>
            ~{enabledTokens} / {totalTokens} tokens
          </span>
        </div>
      </header>

      <section className="context-toolbar" aria-label="Context controls">
        <div className="context-toolbar-row context-toolbar-row--primary">
          <label className="context-agent-select">
            <span>Agent</span>
            <div className="context-select-wrap">
              <select
                value={selectedAgentKey}
                onChange={(event) => setSelectedAgentKey(event.target.value)}
              >
                {agents.length === 0 ? (
                  <option value="">No agents found</option>
                ) : (
                  agents.map((agent) => (
                    <option key={getNoteKey(agent)} value={getNoteKey(agent)}>
                      {agent.title}
                    </option>
                  ))
                )}
              </select>
              <ChevronDown size={13} />
            </div>
          </label>

          <label className="context-search">
            <Search size={14} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search context"
            />
          </label>
        </div>

        <div className="context-toolbar-row context-toolbar-row--filters">
          <div className="context-filter-cluster">
            <span className="context-filter-caption">Status</span>
            <div className="context-filter-group" role="group" aria-label="Filter by status">
              {(['all', 'enabled', 'disabled'] as ContextFilter[]).map((mode) => (
                <button
                  key={mode}
                  className={`context-chip ${filter === mode ? 'active' : ''}`}
                  type="button"
                  aria-pressed={filter === mode}
                  onClick={() => setFilter(mode)}
                >
                  {mode[0].toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="context-filter-cluster">
            <span className="context-filter-caption">Type</span>
            <div className="context-filter-group" role="group" aria-label="Filter by context type">
              {(['tool', 'skill', 'memory'] as ContextTypeFilter[]).map((type) => (
                <button
                  key={type}
                  className={`context-chip ${typeFilters.has(type) ? 'active' : ''}`}
                  type="button"
                  aria-pressed={typeFilters.has(type)}
                  onClick={() => toggleTypeFilter(type)}
                  title={
                    type === 'tool'
                      ? 'Show only tool context items'
                      : type === 'skill'
                        ? 'Show only skill context items'
                        : 'Show only memory context items'
                  }
                >
                  {itemIcon(type)}{' '}
                  {type === 'memory' ? 'Memory' : type[0].toUpperCase() + type.slice(1) + 's'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <button
        className={`context-settings-disclosure${settingsOpen ? ' open' : ''}`}
        type="button"
        aria-expanded={settingsOpen}
        onClick={() => setSettingsOpen((prev) => !prev)}
      >
        <ChevronRight size={14} />
        <SlidersHorizontal size={14} />
        <span>Context settings</span>
        <span className="context-settings-preview">
          Depth {settings.defaultDepth}
          <span className="context-settings-dot" aria-hidden="true">
            ·
          </span>
          {settings.includeBacklinks ? 'Backlinks' : 'No backlinks'}
          <span className="context-settings-dot" aria-hidden="true">
            ·
          </span>
          {settings.includeMemory ? 'Memory' : 'No memory'}
          <span className="context-settings-dot" aria-hidden="true">
            ·
          </span>
          {settings.includeTools ? 'Tools' : 'No tools'}
          <span className="context-settings-dot" aria-hidden="true">
            ·
          </span>
          ~{settings.maxContextSize} tokens
        </span>
      </button>

      {settingsOpen && (
        <section className="context-settings-panel" aria-label="Edit context settings">
          <div className="context-settings-grid">
            <div className="context-settings-column context-settings-column--toggles">
              <span className="context-settings-column-title">Include in context</span>
              <label className="context-toggle-row">
                <span>
                  <strong>Backlinks</strong>
                  <small>Include notes that link to this agent</small>
                </span>
                <span
                  className={`context-switch${settings.includeBacklinks ? ' active' : ''}`}
                  role="switch"
                  aria-checked={settings.includeBacklinks}
                  tabIndex={0}
                  onClick={() => updateSetting('includeBacklinks', !settings.includeBacklinks)}
                  onKeyDown={(event) => {
                    if (event.key === ' ' || event.key === 'Enter') {
                      event.preventDefault();
                      updateSetting('includeBacklinks', !settings.includeBacklinks);
                    }
                  }}
                >
                  <span className="context-switch-knob" />
                </span>
              </label>

              <label className="context-toggle-row">
                <span>
                  <strong>Memory</strong>
                  <small>Include agent and project memory</small>
                </span>
                <span
                  className={`context-switch${settings.includeMemory ? ' active' : ''}`}
                  role="switch"
                  aria-checked={settings.includeMemory}
                  tabIndex={0}
                  onClick={() => updateSetting('includeMemory', !settings.includeMemory)}
                  onKeyDown={(event) => {
                    if (event.key === ' ' || event.key === 'Enter') {
                      event.preventDefault();
                      updateSetting('includeMemory', !settings.includeMemory);
                    }
                  }}
                >
                  <span className="context-switch-knob" />
                </span>
              </label>

              <label className="context-toggle-row">
                <span>
                  <strong>Tools</strong>
                  <small>Include available tool definitions</small>
                </span>
                <span
                  className={`context-switch${settings.includeTools ? ' active' : ''}`}
                  role="switch"
                  aria-checked={settings.includeTools}
                  tabIndex={0}
                  onClick={() => updateSetting('includeTools', !settings.includeTools)}
                  onKeyDown={(event) => {
                    if (event.key === ' ' || event.key === 'Enter') {
                      event.preventDefault();
                      updateSetting('includeTools', !settings.includeTools);
                    }
                  }}
                >
                  <span className="context-switch-knob" />
                </span>
              </label>
            </div>

            <div className="context-settings-column context-settings-column--controls">
              <div className="context-settings-field">
                <label className="context-settings-label">Graph depth</label>
                <div className="context-seg" role="radiogroup" aria-label="Graph depth">
                  {([1, 2] as const).map((depth) => (
                    <button
                      key={depth}
                      type="button"
                      role="radio"
                      aria-checked={settings.defaultDepth === depth}
                      className={`context-seg-btn${settings.defaultDepth === depth ? ' active' : ''}`}
                      onClick={() => updateSetting('defaultDepth', depth)}
                    >
                      {depth}
                    </button>
                  ))}
                </div>
              </div>

              <div className="context-settings-field">
                <label className="context-settings-label" htmlFor="context-budget">
                  Token budget
                </label>
                <div className="context-budget-wrap">
                  <input
                    id="context-budget"
                    type="number"
                    min={256}
                    max={32768}
                    step={256}
                    value={settings.maxContextSize}
                    onChange={(event) => updateBudget(event.target.value)}
                    className="context-budget-input"
                  />
                  <span className="context-budget-suffix">tokens</span>
                </div>
              </div>
            </div>
          </div>

          <footer className="context-settings-footer">
            <span className="context-settings-hint">Changes apply immediately to all agents.</span>
            <button type="button" className="context-settings-reset" onClick={resetSettings}>
              Reset to defaults
            </button>
          </footer>
        </section>
      )}

      <section className="context-items" aria-label="Context items">
        {!selectedAgent ? (
          <div className="context-empty">
            <Brain size={28} />
            <h3>No agent profiles found</h3>
            <p>
              Add a note with <code>type: agent</code> or a valid agent profile under{' '}
              <code>Agents/</code>.
            </p>
          </div>
        ) : visibleItems.length === 0 ? (
          <div className="context-empty">
            <Search size={28} />
            <h3>No matching context items</h3>
            <p>Adjust the search or filter to view this agent's computed context.</p>
          </div>
        ) : (
          visibleItems.map((item) => {
            const itemKey = getContextItemKey(item);
            const enabled = enabledKeys.has(itemKey);
            const required = requiredKeys.has(itemKey);
            return (
              <article className={`context-item-card${enabled ? '' : ' disabled'}`} key={itemKey}>
                <div className="context-item-main" onClick={() => setDetailItem(item)}>
                  <div className="context-item-meta">
                    <span className="context-item-type">
                      {itemIcon(item.type)} {item.type}
                    </span>
                    <span>~{estimateContextItemTokens(item)} tokens</span>
                    {required && <span>Required</span>}
                  </div>
                  <h3>{item.title}</h3>
                  {item.path && <code>{item.path}</code>}
                  <p>{getPreview(item.content) || 'No preview content.'}</p>
                </div>
                <button
                  className={`context-toggle${enabled ? ' active' : ''}`}
                  type="button"
                  onClick={() => toggleItem(item)}
                  disabled={required}
                  aria-pressed={enabled}
                  title={
                    required
                      ? 'Required context item'
                      : enabled
                        ? 'Disable context item'
                        : 'Enable context item'
                  }
                >
                  <span className="context-toggle-knob" />
                </button>
              </article>
            );
          })
        )}
      </section>

      {detailItem && (
        <>
          <div
            className="detail-drawer-backdrop context-detail-modal-backdrop"
            onClick={() => setDetailItem(null)}
            aria-hidden="true"
          />
          <aside
            className="detail-drawer context-detail-drawer context-detail-modal"
            role="dialog"
            aria-label={`${detailItem.title} context details`}
          >
            <div className="detail-drawer-header">
              <div>
                <h3>{detailItem.title}</h3>
                <p className="detail-drawer-role">
                  {detailItem.type}
                  {detailItem.path ? ` · ${detailItem.path}` : ''}
                </p>
              </div>
              <button
                className="detail-drawer-close"
                onClick={() => setDetailItem(null)}
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
            <div className="detail-drawer-body">
              <MarkdownPreview
                content={detailItem.content}
                showProperties={true}
                onOpenWikiLink={openWikiLink}
              />
            </div>
          </aside>
        </>
      )}
    </main>
  );
}
