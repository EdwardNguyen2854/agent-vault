import { useMemo, useState } from 'react';
import { Download, LineChart as LineChartIcon, Sparkles } from 'lucide-react';
import type { AgentRun, ChatSession, Skill, Tool, VaultNote, ViewMode } from '../types';
import { ChartCard } from './charts/ChartCard';
import { LineChart } from './charts/LineChart';
import { BarChart } from './charts/BarChart';
import { DonutChart } from './charts/DonutChart';
import {
  buildWeeklySummaryMarkdown,
  downloadCsv,
  exportSnapshotsCsv,
  loadSnapshots,
  loadSummary,
} from '../utils/usageStore';

interface UsageAnalyticsProps {
  notes: VaultNote[];
  agentRuns: AgentRun[];
  chatSessions: ChatSession[];
  skills: Skill[];
  tools: Tool[];
  onChangeView: (view: ViewMode) => void;
  onSelectNote: (key: string) => void;
}

const PERIOD_OPTIONS = [7, 30, 90];

function formatDayLabel(dayKey: string, index: number, total: number): string {
  const d = new Date(`${dayKey}T00:00:00`);
  if (total <= 14) {
    return d.toLocaleDateString(undefined, { weekday: 'short' });
  }
  if (total <= 31) {
    return d.getDate().toString();
  }
  if (index === 0 || index === total - 1 || index % 14 === 0) {
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  return '';
}

function copyToClipboard(text: string): void {
  try {
    void navigator.clipboard.writeText(text);
  } catch {
    // Silently ignore
  }
}

export function UsageAnalytics({
  notes,
  agentRuns,
  chatSessions,
  skills,
  tools,
  onChangeView,
  onSelectNote,
}: UsageAnalyticsProps) {
  const [days, setDays] = useState<number>(30);
  const snapshots = useMemo(() => loadSnapshots(90), [notes, agentRuns, chatSessions]);
  const summary = useMemo(
    () => loadSummary(notes, days, tools),
    [notes, days, tools, agentRuns, chatSessions],
  );

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

  const messagesSeries = useMemo(
    () => [
      {
        label: 'Messages',
        color: 'var(--accent)',
        points: summary.messagesPerDay.map((p) => p.value),
      },
    ],
    [summary.messagesPerDay],
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

  if (!summary.hasData) {
    return (
      <section className="dashboard-analytics">
        <header className="dashboard-analytics-header">
          <div>
            <span className="eyebrow">
              <LineChartIcon size={12} /> Usage & analytics
            </span>
            <h2>Usage & analytics</h2>
            <p>Local-only. Nothing leaves your machine.</p>
          </div>
        </header>
        <div className="analytics-empty">
          <Sparkles size={28} />
          <h3>No analytics data yet</h3>
          <p>
            Run an agent, write a note, or send a chat message to start collecting daily analytics.
            Your data stays on this device.
          </p>
        </div>
      </section>
    );
  }

  const periodControl = {
    value: days,
    options: PERIOD_OPTIONS,
    onChange: setDays,
  };

  const successRate = summary.successRate;
  const hoursSaved = Math.floor(summary.estimatedMinutesSaved / 60);
  const minutesSaved = summary.estimatedMinutesSaved % 60;

  return (
    <section className="dashboard-analytics">
      <header className="dashboard-analytics-header">
        <div>
          <span className="eyebrow">
            <LineChartIcon size={12} /> Usage & analytics
          </span>
          <h2>Usage & analytics</h2>
          <p>Local-only. Nothing leaves your machine.</p>
        </div>
        <div className="dashboard-analytics-actions">
          <button className="ghost-button" onClick={handleCopySummary} type="button">
            Copy summary
          </button>
          <button className="ghost-button" onClick={handleExport} type="button">
            <Download size={13} /> Export CSV
          </button>
        </div>
      </header>

      <div className="analytics-summary-row">
        <div className="analytics-summary-card">
          <span className="analytics-summary-label">Total runs</span>
          <strong>{summary.totalRuns}</strong>
          <small>{successRate}% success</small>
        </div>
        <div className="analytics-summary-card">
          <span className="analytics-summary-label">Messages</span>
          <strong>{summary.totalMessages}</strong>
          <small>Last {days} days</small>
        </div>
        <div className="analytics-summary-card">
          <span className="analytics-summary-label">Tasks closed</span>
          <strong>{summary.totalTasksClosed}</strong>
          <small>Last 7 days</small>
        </div>
        <div className="analytics-summary-card">
          <span className="analytics-summary-label">Time saved (est.)</span>
          <strong>
            {hoursSaved}h {minutesSaved}m
          </strong>
          <small>Based on median run duration</small>
        </div>
      </div>

      <div className="analytics-strip">
        <ChartCard
          title="Agent runs / day"
          subtitle={`Last ${days} days`}
          period={periodControl}
          onExport={handleExport}
        >
          <LineChart series={runsSeries} xLabels={xLabels} yFormat={(v) => String(v)} />
        </ChartCard>
        <ChartCard title="Run status" subtitle={`All time, ${summary.totalRuns} runs`}>
          <DonutChart
            data={summary.statusMix}
            centerLabel="success"
            centerValue={`${successRate}%`}
          />
        </ChartCard>
        <ChartCard
          title="Chat messages / day"
          subtitle={`Last ${days} days`}
          period={periodControl}
        >
          <LineChart series={messagesSeries} xLabels={xLabels} yFormat={(v) => String(v)} />
        </ChartCard>
      </div>

      <div className="analytics-bars">
        <ChartCard
          title="Top agents"
          subtitle="By run count"
          onViewAll={() => onChangeView('agents')}
        >
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
        </ChartCard>
        <ChartCard
          title="Top tools"
          subtitle="By invocations"
          onViewAll={() => onChangeView('tools')}
        >
          <BarChart
            data={summary.topTools.map((t) => ({
              label: t.name,
              value: t.value,
              subLabel: `${t.successRate}% success`,
              color: 'var(--accent)',
            }))}
            onSelect={handleSelectTool}
            emptyText="No tool invocations yet"
          />
        </ChartCard>
        <ChartCard
          title="Top skills"
          subtitle="By activations"
          onViewAll={() => onChangeView('skills')}
        >
          <BarChart
            data={summary.topSkills.map((s) => ({
              label: s.name,
              value: s.value,
              color: 'var(--warning)',
            }))}
            onSelect={handleSelectSkill}
            emptyText="No skills activated yet"
          />
        </ChartCard>
      </div>

      <div className="analytics-strip analytics-strip-secondary">
        <ChartCard
          title="Tasks opened vs closed"
          subtitle={`Last ${days} days`}
          period={periodControl}
        >
          <LineChart series={tasksSeries} xLabels={xLabels} yFormat={(v) => String(v)} showLegend />
        </ChartCard>
      </div>
    </section>
  );
}
