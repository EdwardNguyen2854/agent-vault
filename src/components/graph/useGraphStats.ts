import { useMemo } from 'react';
import type { GraphData, GraphNode, VaultNote } from '../../types';
import { buildGraphData, getOrphanNotes } from '../../utils/markdown/graph';
import { getNoteKey } from '../../utils/noteKey';

export interface GraphStats {
  noteCount: number;
  linkCount: number;
  orphanCount: number;
  missingCount: number;
  groupCount: number;
  topGroups: { name: string; count: number }[];
}

export function useGraphStats(notes: VaultNote[], graph: GraphData): GraphStats {
  return useMemo(() => {
    const orphans = new Set(getOrphanNotes(notes).map((note) => getNoteKey(note)));
    let missingCount = 0;
    const groupCounts = new Map<string, number>();
    for (const node of graph.nodes as GraphNode[]) {
      if (node.type === 'missing') {
        missingCount += 1;
        continue;
      }
      if (orphans.has(node.id)) continue;
      groupCounts.set(node.group, (groupCounts.get(node.group) ?? 0) + 1);
    }
    const topGroups = Array.from(groupCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, count]) => ({ name, count }));

    return {
      noteCount: graph.nodes.filter((n) => n.type === 'note').length,
      linkCount: graph.links.length,
      orphanCount: orphans.size,
      missingCount,
      groupCount: groupCounts.size,
      topGroups,
    };
  }, [notes, graph]);
}

export function useFullGraph(notes: VaultNote[]): GraphData {
  return useMemo(() => buildGraphData(notes), [notes]);
}
