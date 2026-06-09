import {
  Bot,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  ExternalLink,
  FileText,
  HelpCircle,
  MessageSquare,
  Play,
  Search,
  Settings as SettingsIcon,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import type { AgentRun, VaultNote, ViewMode } from '../types';
import { getAgentRunsFromNotes } from '../utils/agentRuns';
import { getNoteKey } from '../utils/noteKey';

interface AgentRunsViewProps {
  notes: VaultNote[];
  onSelectNote: (key: string) => void;
  onChangeView?: (view: ViewMode) => void;
}

interface RunCardProps {
  run: AgentRun;
  notes: VaultNote[];
  runKey: string;
  onSelectNote: (key: string) => void;
  onOpenDetail: (run: AgentRun) => void;
}

const STATUS_OPTIONS: { value: AgentRun['status'] | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'planned', label: 'Planned' },
  { value: 'running', label: 'Running' },
  { value: 'awaiting_approval', label: 'Awaiting' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const LEGEND: { status: AgentRun['status']; label: string }[] = [
  { status: 'completed', label: 'Completed successfully' },
  { status: 'failed', label: 'Failed with an error' },
  { status: 'cancelled', label: 'Cancelled by user or system' },
  { status: 'skipped', label: 'Skipped a planned step' },
  { status: 'running', label: 'Currently running' },
  { status: 'planned', label: 'Planned, not yet started' },
  { status: 'awaiting_approval', label: 'Paused for an approval' },
];

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function truncate(text: string, max: number): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 1).trimEnd()}…`;
}

function formatDayKey(timestamp: number): string {
  const d = new Date(timestamp);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDayLabel(timestamp: number, todayKey: string, yesterdayKey: string): string {
  const key = formatDayKey(timestamp);
  if (key === todayKey) return 'Today';
  if (key === yesterdayKey) return 'Yesterday';
  return new Date(timestamp).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function computeDayKeys(): { todayKey: string; yesterdayKey: string } {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  return { todayKey: formatDayKey(now.getTime()), yesterdayKey: formatDayKey(yesterday.getTime()) };
}

function StatusBadge({ status }: { status: AgentRun['status'] }) {
  const config = {
    planned: { label: 'Planned' },
    completed: { label: 'Completed' },
    failed: { label: 'Failed' },
    cancelled: { label: 'Cancelled' },
    running: { label: 'Running' },
    awaiting_approval: { label: 'Awaiting approval' },
    skipped: { label: 'Skipped' },
  }[status];

  return (
    <span className={`run-status-badge status-${status}`}>
      {status === 'completed' && <CheckCircle2 size={10} />}
      {status === 'running' && <Play size={10} />}
      {config.label}
    </span>
  );
}

function resolveRunNote(notes: VaultNote[], target?: string): VaultNote | undefined {
  if (!target) return undefined;
  const cleanTarget = target.replace(/^\[\[/, '').replace(/\]\]$/, '').trim();
  return notes.find(
    (note) =>
      note.path.toLowerCase() === cleanTarget.toLowerCase() ||
      note.title.toLowerCase() === cleanTarget.toLowerCase() ||
      note.path.toLowerCase().endsWith(`/${cleanTarget.toLowerCase()}.md`) ||
      note.path.toLowerCase().includes(cleanTarget.toLowerCase()),
  );
}

function RunCard({ run, notes, runKey, onSelectNote, onOpenDetail }: RunCardProps) {
  const outputNote = useMemo(() => resolveRunNote(notes, run.outputPath), [notes, run.outputPath]);
  const sourceNote = useMemo(() => resolveRunNote(notes, run.sourceNote), [notes, run.sourceNote]);

  const isOutputDifferent = outputNote ? getNoteKey(outputNote) !== runKey : false;

  const handleOpenSource = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (sourceNote) {
      onSelectNote(getNoteKey(sourceNote));
    }
  };

  return (
    <article className="run-card" onClick={() => onOpenDetail(run)}>
      <div className="run-card-header">
        <div className="run-agent-avatar">
          <Bot size={16} />
        </div>
        <div className="run-agent-info">
          <h3 className="run-agent-name">{run.agent}</h3>
          {run.skill && <span className="run-skill-name">{run.skill}</span>}
        </div>
        <StatusBadge status={run.status} />
      </div>

      {run.goal && <p className="run-card-goal">{truncate(run.goal, 160)}</p>}

      <div className="run-card-meta">
        <span className="run-meta-item">
          <Calendar size={11} />
          {formatDate(run.createdAt)}
        </span>
        <span className="run-meta-item">
          <Clock size={11} />
          {formatTime(run.createdAt)}
        </span>
        <span className="run-meta-item run-model" title={run.model}>
          {run.model}
        </span>
        {isOutputDifferent && (
          <span className="run-output-indicator" title="This run produced a note">
            <FileText size={10} /> Output
          </span>
        )}
      </div>

      {run.sourceNote && sourceNote && (
        <div className="run-source-note">
          <FileText size={11} />
          <button onClick={handleOpenSource} className="run-source-link" title={run.sourceNote}>
            {truncate(run.sourceNote, 60)}
          </button>
        </div>
      )}

      {run.toolsUsed.length > 0 && (
        <div className="run-tools-used">
          {run.toolsUsed.slice(0, 3).map((tool) => (
            <span key={tool} className="run-tool-tag">
              {tool}
            </span>
          ))}
          {run.toolsUsed.length > 3 && (
            <span className="run-tool-more">+{run.toolsUsed.length - 3}</span>
          )}
        </div>
      )}

      <div className="run-card-footer">
        <button
          className="ghost-button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenDetail(run);
          }}
        >
          Open Run <ChevronRight size={11} />
        </button>
        {sourceNote && (
          <button
            className="ghost-button"
            onClick={(e) => {
              e.stopPropagation();
              onSelectNote(getNoteKey(sourceNote));
            }}
            title={`Open ${sourceNote.title}`}
          >
            <ExternalLink size={11} /> Open Source Note
          </button>
        )}
      </div>
    </article>
  );
}

function RunDetailDrawer({
  run,
  runKey,
  allNotes,
  onClose,
  onSelectNote,
}: {
  run: AgentRun;
  runKey: string;
  allNotes: VaultNote[];
  onClose: () => void;
  onSelectNote: (key: string) => void;
}) {
  const sourceNoteObj = useMemo(() => {
    return resolveRunNote(allNotes, run.sourceNote) ?? null;
  }, [run.sourceNote, allNotes]);

  const outputNoteObj = useMemo(() => {
    return resolveRunNote(allNotes, run.outputPath) ?? null;
  }, [run.outputPath, allNotes]);

  const contextNotes = useMemo(() => {
    return run.contextItems
      .map((item) => {
        const cleanItem = item.replace(/^\[\[|\]]$/g, '');
        return allNotes.find(
          (n) =>
            n.title.toLowerCase() === cleanItem.toLowerCase() ||
            n.path.toLowerCase().includes(cleanItem.toLowerCase()),
        );
      })
      .filter(Boolean) as VaultNote[];
  }, [run.contextItems, allNotes]);

  const isOutputDifferent = outputNoteObj ? getNoteKey(outputNoteObj) !== runKey : false;

  return (
    <>
      <div className="detail-drawer-backdrop" onClick={onClose} aria-hidden="true" />
      <aside
        className="detail-drawer run-detail-drawer"
        role="dialog"
        aria-label="Agent Run Details"
      >
        <div className="detail-drawer-header">
          <div>
            <h3>Agent Run</h3>
            <p className="detail-drawer-role">
              {run.agent}
              {run.skill && <span className="run-skill-badge">{run.skill}</span>}
            </p>
          </div>
          <button className="detail-drawer-close" onClick={onClose} aria-label="Close">
            <X size={15} />
          </button>
        </div>

        <div className="detail-drawer-body">
          <div className="run-detail-status">
            <StatusBadge status={run.status} />
            <span className="run-detail-date">
              {formatDate(run.createdAt)} at {formatTime(run.createdAt)}
            </span>
          </div>

          {run.goal && (
            <div className="detail-drawer-section">
              <h4>Goal</h4>
              <p className="detail-drawer-description">{run.goal}</p>
            </div>
          )}

          <div className="run-detail-grid">
            <div className="run-detail-field">
              <span className="run-detail-label">Agent</span>
              <span className="run-detail-value">{run.agent}</span>
            </div>
            {run.skill && (
              <div className="run-detail-field">
                <span className="run-detail-label">Skill</span>
                <span className="run-detail-value">{run.skill}</span>
              </div>
            )}
            <div className="run-detail-field">
              <span className="run-detail-label">Model</span>
              <span className="run-detail-value">{run.model}</span>
            </div>
            <div className="run-detail-field">
              <span className="run-detail-label">Provider</span>
              <span className="run-detail-value">{run.provider}</span>
            </div>
          </div>

          {sourceNoteObj && (
            <div className="detail-drawer-section">
              <h4>Source Note</h4>
              <button
                className="backlink-card"
                onClick={() => onSelectNote(getNoteKey(sourceNoteObj))}
              >
                <strong>{sourceNoteObj.title}</strong>
                <small>{sourceNoteObj.path}</small>
              </button>
            </div>
          )}

          {contextNotes.length > 0 && (
            <div className="detail-drawer-section">
              <h4>Context Used ({contextNotes.length})</h4>
              <div className="detail-drawer-links">
                {contextNotes.map((note) => (
                  <button
                    key={getNoteKey(note)}
                    className="link-pill"
                    onClick={() => onSelectNote(getNoteKey(note))}
                  >
                    <FileText size={11} />
                    {note.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          {run.toolsUsed.length > 0 && (
            <div className="detail-drawer-section">
              <h4>Tools Used ({run.toolsUsed.length})</h4>
              <div className="run-tools-list">
                {run.toolsUsed.map((tool) => (
                  <span key={tool} className="run-tool-item">
                    {tool}
                  </span>
                ))}
              </div>
            </div>
          )}

          {run.steps.length > 0 && (
            <div className="detail-drawer-section">
              <h4>Step Timeline ({run.steps.length})</h4>
              <div className="run-step-list">
                {run.steps.map((step) => (
                  <div key={step.id} className={`run-step-item ${step.status}`}>
                    <span className="run-step-dot" />
                    <div>
                      <strong>{step.title}</strong>
                      <small>{step.status.replace('_', ' ')}</small>
                      {step.summary && <p>{step.summary}</p>}
                      {step.error && <pre>{step.error}</pre>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {run.status === 'awaiting_approval' && run.approvals.length === 0 && (
            <div className="detail-drawer-section pending-approval-card">
              <h4>Pending Approval</h4>
              <p className="detail-drawer-description">
                This run is paused until a tool decision is made in chat.
              </p>
            </div>
          )}

          {run.approvals.length > 0 && (
            <div className="detail-drawer-section">
              <h4>Approval Decisions ({run.approvals.length})</h4>
              <div className="run-tool-records">
                {run.approvals.map((approval) => (
                  <div key={approval.id} className="run-tool-record">
                    <strong>{approval.toolName}</strong>
                    <small>
                      {approval.decision.replace('_', ' ')} at {formatTime(approval.timestamp)}
                    </small>
                    {approval.decisionReason && <p>{approval.decisionReason}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {run.toolTranscript.length > 0 && (
            <div className="detail-drawer-section">
              <h4>Tool Records ({run.toolTranscript.length})</h4>
              <div className="run-tool-records">
                {run.toolTranscript.map((record) => (
                  <details
                    key={record.id}
                    className={`run-tool-record ${record.error ? 'error' : 'success'}`}
                  >
                    <summary>
                      <strong>{record.toolName}</strong>
                      <small>
                        {record.error ? 'failed' : 'completed'} · {Math.round(record.durationMs)}ms
                      </small>
                    </summary>
                    <pre>
                      {JSON.stringify(
                        {
                          input: record.input,
                          output: record.output,
                          error: record.error,
                          decision: record.decision,
                          decisionReason: record.decisionReason,
                        },
                        null,
                        2,
                      )}
                    </pre>
                  </details>
                ))}
              </div>
            </div>
          )}

          {run.reasoningSummary && (
            <div className="detail-drawer-section">
              <h4>Reasoning Summary</h4>
              <pre className="run-output-block">{run.reasoningSummary}</pre>
            </div>
          )}

          {run.finalAnswer && (
            <div className="detail-drawer-section">
              <h4>Final Output</h4>
              <pre className="run-output-block">{run.finalAnswer}</pre>
            </div>
          )}

          {run.error && (
            <div className="run-detail-error">
              <h4>Error</h4>
              <pre>{run.error}</pre>
            </div>
          )}
        </div>

        <div className="detail-drawer-footer">
          {outputNoteObj && (
            <button
              className="primary-button"
              onClick={() => onSelectNote(getNoteKey(outputNoteObj))}
            >
              <ExternalLink size={13} /> {isOutputDifferent ? 'Open Output Note' : 'Open Full Log'}
            </button>
          )}
        </div>
      </aside>
    </>
  );
}

export function AgentRunsView({ notes, onSelectNote, onChangeView }: AgentRunsViewProps) {
  const allRuns = useMemo(() => getAgentRunsFromNotes(notes), [notes]);

  const [filterAgent, setFilterAgent] = useState<string | null>(null);
  const [filterSkill, setFilterSkill] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<AgentRun['status'] | 'all'>('all');
  const [search, setSearch] = useState('');
  const [showLegend, setShowLegend] = useState(false);
  const [selectedRun, setSelectedRun] = useState<AgentRun | null>(null);

  const agents = useMemo(() => {
    const s = new Set<string>();
    allRuns.forEach((r) => s.add(r.agent));
    return Array.from(s).sort();
  }, [allRuns]);

  const skills = useMemo(() => {
    const s = new Set<string>();
    allRuns.forEach((r) => {
      if (r.skill) s.add(r.skill);
    });
    return Array.from(s).sort();
  }, [allRuns]);

  const dayKeys = useMemo(computeDayKeys, []);

  const filteredRuns = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allRuns.filter((run) => {
      if (filterAgent && run.agent !== filterAgent) return false;
      if (filterSkill && run.skill !== filterSkill) return false;
      if (filterStatus !== 'all' && run.status !== filterStatus) return false;
      if (q) {
        const haystack =
          `${run.goal} ${run.finalAnswer ?? ''} ${run.agent} ${run.skill ?? ''}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [allRuns, filterAgent, filterSkill, filterStatus, search]);

  const groupedRuns = useMemo(() => {
    const groups = new Map<string, { label: string; runs: AgentRun[] }>();
    for (const run of filteredRuns) {
      const key = formatDayKey(run.createdAt);
      if (!groups.has(key)) {
        groups.set(key, {
          label: formatDayLabel(run.createdAt, dayKeys.todayKey, dayKeys.yesterdayKey),
          runs: [],
        });
      }
      groups.get(key)!.runs.push(run);
    }
    return Array.from(groups.entries());
  }, [filteredRuns, dayKeys]);

  const hasFilters =
    filterAgent !== null ||
    filterSkill !== null ||
    filterStatus !== 'all' ||
    search.trim().length > 0;
  const clearFilters = () => {
    setFilterAgent(null);
    setFilterSkill(null);
    setFilterStatus('all');
    setSearch('');
  };

  return (
    <main className="page-scroll view-page">
      <div className="page-header runs-view-header">
        <div>
          <span className="eyebrow">Agent activity</span>
          <h1>
            <Bot size={20} /> Agent Runs
          </h1>
          <p>View history of agent executions, context used, and outputs.</p>
        </div>
        <div className="runs-view-header-actions">
          <button
            type="button"
            className="runs-legend-toggle"
            aria-label="Status legend"
            aria-expanded={showLegend}
            onClick={() => setShowLegend((v) => !v)}
            title="Status legend"
          >
            <HelpCircle size={13} />
          </button>
          {showLegend && (
            <div className="runs-legend-popover" role="dialog" aria-label="Status legend">
              <span className="runs-legend-title">Status legend</span>
              {LEGEND.map((entry) => (
                <div key={entry.status} className="runs-legend-row">
                  <StatusBadge status={entry.status} />
                  <span>{entry.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {allRuns.length > 0 ? (
        <>
          <div className="agents-filter-bar">
            <label className="agents-filter-field runs-search">
              <Search size={12} />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search goal, output, agent…"
                aria-label="Search runs"
              />
            </label>
            <div className="runs-status-chips" role="group" aria-label="Filter by status">
              {STATUS_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`runs-status-chip${filterStatus === option.value ? ' active' : ''}`}
                  onClick={() => setFilterStatus(option.value)}
                  aria-pressed={filterStatus === option.value}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="agents-filter-fields">
              <label className="agents-filter-field">
                <Bot size={12} />
                <select
                  value={filterAgent ?? ''}
                  onChange={(e) => setFilterAgent(e.target.value || null)}
                  aria-label="Filter by agent"
                >
                  <option value="">All Agents</option>
                  {agents.map((agent) => (
                    <option key={agent} value={agent}>
                      {agent}
                    </option>
                  ))}
                </select>
              </label>
              <label className="agents-filter-field">
                <FileText size={12} />
                <select
                  value={filterSkill ?? ''}
                  onChange={(e) => setFilterSkill(e.target.value || null)}
                  aria-label="Filter by skill"
                >
                  <option value="">All Skills</option>
                  {skills.map((skill) => (
                    <option key={skill} value={skill}>
                      {skill}
                    </option>
                  ))}
                </select>
              </label>
              {hasFilters && (
                <button type="button" className="agents-filter-clear" onClick={clearFilters}>
                  <X size={10} /> Clear
                </button>
              )}
            </div>
            <span className="runs-count">
              {filteredRuns.length} {filteredRuns.length === 1 ? 'run' : 'runs'}
            </span>
          </div>

          {filteredRuns.length > 0 ? (
            <div className="run-day-groups">
              {groupedRuns.map(([key, group]) => (
                <div key={key} className="run-day-group">
                  <div className="run-day-header">
                    <span>{group.label}</span>
                    <span className="run-day-header-line" />
                    <span>{group.runs.length}</span>
                  </div>
                  <div className="run-cards-grid">
                    {group.runs.map((run) => (
                      <RunCard
                        key={run.id}
                        run={run}
                        notes={notes}
                        runKey={run.id}
                        onSelectNote={onSelectNote}
                        onOpenDetail={setSelectedRun}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="panel-card">
              <h3>
                <Search size={16} /> No runs match your filters
              </h3>
              <p>Try clearing the search or status filter to see more results.</p>
              <div className="runs-empty-actions">
                <button type="button" className="ghost-button" onClick={clearFilters}>
                  <X size={12} /> Clear filters
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="panel-card" style={{ gridColumn: '1 / -1' }}>
          <h3>
            <Bot size={16} /> No agent runs yet
          </h3>
          <p>
            Agent runs will appear here when agents execute tasks. Runs are created automatically
            when an agent completes a task and logs its work.
          </p>
          <div className="runs-empty-actions">
            {onChangeView && (
              <>
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => onChangeView('chat')}
                >
                  <MessageSquare size={13} /> Open Chat
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => onChangeView('settings')}
                >
                  <SettingsIcon size={13} /> Open Settings
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {selectedRun && (
        <RunDetailDrawer
          run={selectedRun}
          runKey={selectedRun.id}
          allNotes={notes}
          onClose={() => setSelectedRun(null)}
          onSelectNote={(key) => {
            onSelectNote(key);
            setSelectedRun(null);
          }}
        />
      )}
    </main>
  );
}
