import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  FileText,
  GitFork,
  Hash,
  Link2,
  Network,
  Sparkles,
} from 'lucide-react';
import type { VaultNote, VaultStats } from '../types';
import { getBrokenLinks, getOrphanNotes, getWorkspaceEntityNotes } from '../utils/markdown';
import { getNoteKey } from '../utils/noteKey';
import { formatDate } from '../utils/text';

interface DashboardProps {
  notes: VaultNote[];
  stats: VaultStats;
  onSelectNote: (path: string) => void;
  onChangeView: (view: 'graph' | 'tasks' | 'tags' | 'agents') => void;
}

export function Dashboard({ notes, stats, onSelectNote, onChangeView }: DashboardProps) {
  const recent = [...notes].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 8);
  const orphanNotes = getOrphanNotes(notes).slice(0, 5);
  const brokenLinks = getBrokenLinks(notes).slice(0, 5);
  const workspaceEntities = getWorkspaceEntityNotes(notes).slice(0, 5);

  return (
    <main className="dashboard">
      <div className="hero-card">
        <div>
          <span className="eyebrow">Agent Vault</span>
          <h1>Build a connected knowledge base for humans and agents.</h1>
          <p>
            Open markdown notes, edit them, link ideas with backlinks, and explore the vault as a 3D
            graph.
          </p>
        </div>
        <div className="hero-orb">
          <Sparkles size={36} />
        </div>
      </div>

      <div className="stats-grid">
        <Stat icon={FileText} label="Notes" value={stats.noteCount} />
        <Stat
          icon={Link2}
          label="Links"
          value={stats.linkCount}
          onClick={() => onChangeView('graph')}
        />
        <Stat icon={Network} label="Orphans" value={stats.orphanCount} />
        <Stat icon={AlertTriangle} label="Broken" value={stats.brokenLinkCount} />
        <Stat
          icon={CheckCircle2}
          label="Tasks"
          value={`${stats.completedTaskCount}/${stats.taskCount}`}
          onClick={() => onChangeView('tasks')}
        />
        <Stat
          icon={Hash}
          label="Tags"
          value={stats.tagCount}
          onClick={() => onChangeView('tags')}
        />
        <Stat
          icon={Bot}
          label="Agents/Skills/Tools"
          value={stats.agentCount}
          onClick={() => onChangeView('agents')}
        />
        <Stat icon={GitFork} label="Graph" value="3D" onClick={() => onChangeView('graph')} />
      </div>

      <div className="dashboard-grid">
        <section className="panel-card large-card">
          <h3>
            <FileText size={15} /> Recent notes
          </h3>
          <div className="note-list-cards">
            {recent.length ? (
              recent.map((note) => (
                <button key={getNoteKey(note)} onClick={() => onSelectNote(getNoteKey(note))}>
                  <strong>{note.title}</strong>
                  <span>{note.path}</span>
                  <small>{formatDate(note.updatedAt)}</small>
                </button>
              ))
            ) : (
              <p className="muted">Open a vault folder to begin.</p>
            )}
          </div>
        </section>

        <section className="panel-card">
          <h3>
            <AlertTriangle size={15} /> Vault health
          </h3>
          {brokenLinks.length ? (
            brokenLinks.map((item) => (
              <button
                key={`${getNoteKey(item.source)}-${item.target}`}
                className="health-row"
                onClick={() => onSelectNote(getNoteKey(item.source))}
              >
                <AlertTriangle size={13} />
                <div>
                  <span>{item.source.title}</span>
                  <small>Missing: {item.target}</small>
                </div>
              </button>
            ))
          ) : (
            <p className="positive-message">No broken links detected.</p>
          )}
        </section>

        <section className="panel-card">
          <h3>
            <Network size={15} /> Orphan notes
          </h3>
          {orphanNotes.length ? (
            orphanNotes.map((note) => (
              <button
                key={getNoteKey(note)}
                className="simple-row"
                onClick={() => onSelectNote(getNoteKey(note))}
              >
                {note.title}
              </button>
            ))
          ) : (
            <p className="positive-message">Every note is connected.</p>
          )}
        </section>

        <section className="panel-card">
          <h3>
            <Bot size={15} /> Agents, skills, and tools
          </h3>
          {workspaceEntities.length ? (
            workspaceEntities.map((note) => (
              <button
                key={getNoteKey(note)}
                className="simple-row"
                onClick={() => onSelectNote(getNoteKey(note))}
              >
                {note.title}
              </button>
            ))
          ) : (
            <p className="muted">
              Create notes in <code>Agents/</code>, <code>Skills/</code>, or <code>Tools/</code> to
              track workspace entities.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  onClick,
}: {
  icon: typeof FileText;
  label: string;
  value: string | number;
  onClick?: () => void;
}) {
  const Wrapper = onClick ? 'button' : 'div';
  return (
    <Wrapper
      className="stat-card"
      onClick={onClick as any}
      type={onClick ? 'button' : undefined}
      aria-label={onClick ? `Open ${label}: ${value}` : undefined}
    >
      <Icon size={16} />
      <span>{label}</span>
      <strong>{value}</strong>
    </Wrapper>
  );
}
