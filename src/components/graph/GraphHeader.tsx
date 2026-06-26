import { GitFork, Network, FileX2, Link2, Layers } from 'lucide-react';
import type { GraphStats } from './useGraphStats';

interface GraphHeaderProps {
  stats: GraphStats;
}

export function GraphHeader({ stats }: GraphHeaderProps) {
  return (
    <div className="graph-header-inner">
      <div className="graph-header-titles">
        <span className="eyebrow graph-eyebrow">
          <span className="graph-eyebrow-dot" aria-hidden="true" />
          Knowledge map · live
        </span>
        <h1>
          <GitFork size={20} />
          3D Graph
        </h1>
        <p>Each node is a note. Each edge is a wikilink. Drag, scroll, and click to explore.</p>
      </div>

      <div className="graph-stat-row" role="list" aria-label="Graph statistics">
        <div className="graph-stat-chip" role="listitem">
          <span className="graph-stat-chip-icon graph-stat-chip-icon--primary">
            <Network size={13} />
          </span>
          <div className="graph-stat-chip-body">
            <span className="graph-stat-chip-value">{stats.noteCount}</span>
            <span className="graph-stat-chip-label">Workspaces</span>
          </div>
        </div>
        <div className="graph-stat-chip" role="listitem">
          <span className="graph-stat-chip-icon graph-stat-chip-icon--accent">
            <Link2 size={13} />
          </span>
          <div className="graph-stat-chip-body">
            <span className="graph-stat-chip-value">{stats.linkCount}</span>
            <span className="graph-stat-chip-label">Links</span>
          </div>
        </div>
        <div className="graph-stat-chip" role="listitem">
          <span className="graph-stat-chip-icon graph-stat-chip-icon--warning">
            <FileX2 size={13} />
          </span>
          <div className="graph-stat-chip-body">
            <span className="graph-stat-chip-value">{stats.orphanCount}</span>
            <span className="graph-stat-chip-label">Orphans</span>
          </div>
        </div>
        <div className="graph-stat-chip" role="listitem">
          <span className="graph-stat-chip-icon graph-stat-chip-icon--danger">
            <Link2 size={13} />
          </span>
          <div className="graph-stat-chip-body">
            <span className="graph-stat-chip-value">{stats.missingCount}</span>
            <span className="graph-stat-chip-label">Missing</span>
          </div>
        </div>
        <div className="graph-stat-chip" role="listitem">
          <span className="graph-stat-chip-icon graph-stat-chip-icon--muted">
            <Layers size={13} />
          </span>
          <div className="graph-stat-chip-body">
            <span className="graph-stat-chip-value">{stats.groupCount}</span>
            <span className="graph-stat-chip-label">Groups</span>
          </div>
        </div>
      </div>
    </div>
  );
}
