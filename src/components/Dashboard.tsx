import { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Clock,
  Copy,
  Download,
  FileText,
  MessageSquare,
  Network,
  TrendingUp,
} from 'lucide-react';
import type { VaultNote, VaultStats, ViewMode } from '../types';
import { ChartCard } from './charts/ChartCard';
import { LineChart } from './charts/LineChart';
import { BarChart } from './charts/BarChart';
import { DonutChart } from './charts/DonutChart';
import { getBrokenLinks, getOrphanNotes } from '../utils/markdown/graph';
import { getNoteKey } from '../utils/noteKey';
import { formatDate } from '../utils/text';
import { getAgentRunsFromNotes } from '../utils/agentRuns';
import { loadChatSessions } from '../utils/chatHistory';
import { getAllTools } from '../utils/tools';
import { getSkillsFromNotes } from '../utils/skills';
import {
  buildWeeklySummaryMarkdown,
  downloadCsv,
  exportSnapshotsCsv,
  loadSnapshots,
  loadSummary,
} from '../utils/usageStore';

interface DashboardProps {
  notes: VaultNote[];
  stats: VaultStats;
  onSelectNote: (path: string) => void;
  onChangeView: (view: ViewMode) => void;
}

const PERIOD_OPTIONS = [7, 30, 90];

function formatDayLabel(dayKey: string, index: number, total: number): string {
  const d = new Date(`${dayKey}T00:00:00`);
  if (total <= 14) return d.toLocaleDateString(undefined, { weekday: 'short' });
  if (total <= 31) return d.getDate().toString();
  if (index === 0 || index === total - 1 || index % 14 === 0)
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return '';
}

function copyToClipboard(text: string): void {
  try {
    void navigator.clipboard.writeText(text);
  } catch {
    /* ignore */
  }
}

export function Dashboard({ notes, stats, onSelectNote, onChangeView }: DashboardProps) {
  const [days, setDays] = useState<number>(30);

  const agentRuns = useMemo(() => getAgentRunsFromNotes(notes), [notes]);
  const chatSessions = useMemo(() => loadChatSessions(), [notes]);
  const tools = useMemo(() => getAllTools(notes), [notes]);
  const skills = useMemo(() => getSkillsFromNotes(notes), [notes]);

  const snapshots = useMemo(
    () => loadSnapshots(90),
    [notes, agentRuns, chatSessions],
  );
  const summary = useMemo(
    () => loadSummary(notes, days, tools),
    [notes, days, tools, agentRuns, chatSessions],
  );

  const recent = useMemo(
    () => [...notes].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 8),
    [notes],
  );
  const orphanNotes = useMemo(() => getOrphanNotes(notes).slice(0, 5), [notes]);
  const brokenLinks = useMemo(() => getBrokenLinks(notes).slice(0, 5), [notes]);

  const xLabels = useMemo(
    () => summary.runsPerDay.map((p, i) => formatDayLabel(p.date, i, summary.runsPerDay.length)),
    [summary.runsPerDay],
  );

  const runsSeries = useMemo(
    () => [
      {
        label: 'Runs',
        color: 'var(--primary)',
        points: summary.runsPerDay.map((p) => p.value),
      },
    ],
    [summary.runsPerDay],
  );

  const tasksSeries = useMemo(
    () => [
      {
        label: 'Opened',
        color: 'var(--muted)',
        points: summary.tasksOpenedPerDay.map((p) => p.value),
      },
      {
        label: 'Closed',
        color: 'var(--positive)',
        points: summary.tasksClosedPerDay.map((p) => p.value),
      },
    ],
    [summary.tasksOpenedPerDay, summary.tasksClosedPerDay],
  );

  const handleExport = () => {
    const csv = exportSnapshotsCsv(snapshots);
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`agent-vault-analytics-${stamp}.csv`, csv);
  };

  const handleCopySummary = () => {
    const md = buildWeeklySummaryMarkdown(summary, days);
    copyToClipboard(md);
  };

  const handleSelectAgent = (name: string) => {
    const note = notes.find(
      (n) =>
        n.path.toLowerCase().includes('/agents/') &&
        (n.title.toLowerCase() === name.toLowerCase() ||
          n.path.toLowerCase().includes(name.toLowerCase())),
    );
    if (note) onSelectNote(`${note.vaultId}:${note.path}`);
    else onChangeView('agents');
  };

  const handleSelectTool = (name: string) => {
    const note = notes.find(
      (n) =>
        n.path.toLowerCase().includes('/tools/') &&
        (n.title.toLowerCase() === name.toLowerCase() ||
          n.path.toLowerCase().includes(name.toLowerCase())),
    );
    if (note) onSelectNote(`${note.vaultId}:${note.path}`);
    else onChangeView('tools');
  };

  const handleSelectSkill = (name: string) => {
    const note = notes.find(
      (n) =>
        n.path.toLowerCase().includes('/skills/') &&
        (n.title.toLowerCase() === name.toLowerCase() ||
          n.path.toLowerCase().includes(name.toLowerCase())),
    );
    if (note) onSelectNote(`${note.vaultId}:${note.path}`);
    else onChangeView('skills');
  };

  const successRate = summary.successRate;
  const hoursSaved = Math.floor(summary.estimatedMinutesSaved / 60);
  const minutesSaved = summary.estimatedMinutesSaved % 60;

  const periodControl = {
    value: days,
    options: PERIOD_OPTIONS,
    onChange: setDays,
  };

  return (
    <main className="page-scroll view-page dash">
      <div className="page-header">
        <div>
          <span className="eyebrow">Dashboard</span>
          <h1>
            <BarChart3 size={18} />
            Usage analytics
          </h1>
          <p>Agent activity, vault health, and performance metrics.</p>
        </div>
        <div className="page-header-actions">
          <div className="dash-period" role="tablist" aria-label="Time period">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt}
                className={`dash-period-pill ${days === opt ? 'is-active' : ''}`}
                onClick={() => setDays(opt)}
                type="button"
                role="tab"
                aria-selected={days === opt}
              >
                {opt}d
              </button>
            ))}
          </div>
          <button className="dash-action" onClick={handleCopySummary} type="button">
            <Copy size={13} />
            <span>Summary</span>
          </button>
          <button className="dash-action" onClick={handleExport} type="button">
            <Download size={13} />
            <span>CSV</span>
          </button>
        </div>
      </div>

      <div className="dash-metrics">
        <MetricCard
          icon={TrendingUp}
          label="Total runs"
          value={String(summary.totalRuns)}
          sub={`${successRate}% success`}
        />
        <MetricCard
          icon={Activity}
          label="Success rate"
          value={`${successRate}%`}
          sub={`${summary.totalRuns - Math.round(summary.totalRuns * successRate / 100)} failed`}
        />
        <MetricCard
          icon={MessageSquare}
          label="Messages"
          value={String(summary.totalMessages)}
          sub={`Last ${days} days`}
        />
        <MetricCard
          icon={FileText}
          label="Tasks closed"
          value={String(summary.totalTasksClosed)}
          sub="Last 7 days"
        />
        <MetricCard
          icon={Clock}
          label="Time saved"
          value={`${hoursSaved}h ${minutesSaved}m`}
          sub="Est. manual effort"
        />
        <MetricCard
          icon={BarChart3}
          label="Vault notes"
          value={String(stats.noteCount)}
          sub={`${stats.linkCount} links · ${stats.tagCount} tags`}
        />
      </div>

      <div className="dash-charts-primary">
        <div className="dash-chart-wide">
          <ChartCard
            title="Agent runs / day"
            subtitle={`Last ${days} days`}
            period={periodControl}
            onExport={handleExport}
          >
            {summary.hasData ? (
              <LineChart series={runsSeries} xLabels={xLabels} yFormat={(v) => String(v)} />
            ) : (
              <EmptyChart label="Run an agent to see daily activity" />
            )}
          </ChartCard>
        </div>
        <div className="dash-chart-narrow">
          <ChartCard title="Run status" subtitle={`${summary.totalRuns} total runs`}>
            {summary.hasData ? (
              <DonutChart
                data={summary.statusMix}
                centerLabel="success"
                centerValue={`${successRate}%`}
              />
            ) : (
              <EmptyChart label="No runs recorded" />
            )}
          </ChartCard>
        </div>
      </div>

      <div className="dash-bars">
        <ChartCard
          title="Top agents"
          subtitle="By run count"
          onViewAll={() => onChangeView('agents')}
        >
          {summary.topAgents.length > 0 ? (
            <BarChart
              data={summary.topAgents.map((a) => ({
                label: a.name,
                value: a.value,
                subLabel: `${a.successRate}% success`,
                color: 'var(--primary)',
              }))}
              onSelect={handleSelectAgent}
              emptyText="No agent runs yet"
            />
          ) : (
            <EmptyChart label="No agent runs yet" />
          )}
        </ChartCard>
        <ChartCard
          title="Top tools"
          subtitle="By invocations"
          onViewAll={() => onChangeView('tools')}
        >
          {summary.topTools.length > 0 ? (
            <BarChart
              data={summary.topTools.map((t) => ({
                label: t.name,
                value: t.value,
                subLabel: `${t.successRate}% success`,
                color: 'var(--primary)',
              }))}
              onSelect={handleSelectTool}
              emptyText="No tool invocations yet"
            />
          ) : (
            <EmptyChart label="No tool invocations yet" />
          )}
        </ChartCard>
        <ChartCard
          title="Top skills"
          subtitle="By activations"
          onViewAll={() => onChangeView('skills')}
        >
          {summary.topSkills.length > 0 ? (
            <BarChart
              data={summary.topSkills.map((s) => ({
                label: s.name,
                value: s.value,
                color: 'var(--warning)',
              }))}
              onSelect={handleSelectSkill}
              emptyText="No skills activated yet"
            />
          ) : (
            <EmptyChart label="No skills activated yet" />
          )}
        </ChartCard>
      </div>

      <div className="dash-secondary">
        <ChartCard title="Recent notes" subtitle="Last 8 updated">
          {recent.length > 0 ? (
            <div className="dash-note-list">
              {recent.map((note) => (
                <button
                  key={getNoteKey(note)}
                  className="dash-note-row"
                  onClick={() => onSelectNote(getNoteKey(note))}
                >
                  <FileText size={13} />
                  <div className="dash-note-row-body">
                    <strong>{note.title}</strong>
                    <span>{note.path}</span>
                  </div>
                  <time>{formatDate(note.updatedAt)}</time>
                </button>
              ))}
            </div>
          ) : (
            <p className="dash-empty-text">Open a vault folder to begin.</p>
          )}
        </ChartCard>
        <ChartCard title="Vault health" subtitle="Issues needing attention">
          <div className="dash-health">
            <div className="dash-health-section">
              <div className="dash-health-head">
                <AlertTriangle size={13} />
                <span>Broken links</span>
                <span className="dash-health-count">{brokenLinks.length}</span>
              </div>
              {brokenLinks.length > 0 ? (
                <div className="dash-health-list">
                  {brokenLinks.map((item) => (
                    <button
                      key={`${getNoteKey(item.source)}-${item.target}`}
                      className="dash-health-item"
                      onClick={() => onSelectNote(getNoteKey(item.source))}
                    >
                      <span>{item.source.title}</span>
                      <small>→ {item.target}</small>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="dash-empty-text">No broken links detected.</p>
              )}
            </div>
            <div className="dash-health-section">
              <div className="dash-health-head">
                <Network size={13} />
                <span>Orphan notes</span>
                <span className="dash-health-count">{orphanNotes.length}</span>
              </div>
              {orphanNotes.length > 0 ? (
                <div className="dash-health-list">
                  {orphanNotes.map((note) => (
                    <button
                      key={getNoteKey(note)}
                      className="dash-health-item"
                      onClick={() => onSelectNote(getNoteKey(note))}
                    >
                      {note.title}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="dash-empty-text">Every note is connected.</p>
              )}
            </div>
          </div>
        </ChartCard>
      </div>

      <div className="dash-chart-bottom">
        <ChartCard
          title="Tasks opened vs closed"
          subtitle={`Last ${days} days`}
          period={periodControl}
        >
          {summary.hasData ? (
            <LineChart
              series={tasksSeries}
              xLabels={xLabels}
              yFormat={(v) => String(v)}
              showLegend
            />
          ) : (
            <EmptyChart label="Create tasks to see trends" />
          )}
        </ChartCard>
      </div>
    </main>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof TrendingUp;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="dash-metric">
      <div className="dash-metric-icon">
        <Icon size={15} />
      </div>
      <div className="dash-metric-body">
        <span className="dash-metric-label">{label}</span>
        <strong className="dash-metric-value">{value}</strong>
        <span className="dash-metric-sub">{sub}</span>
      </div>
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="dash-chart-empty">
      <span>{label}</span>
    </div>
  );
}
