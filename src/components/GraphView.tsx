import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { GitFork, Search, X } from 'lucide-react';
import type { GraphFilterState, GraphNode, VaultNote } from '../types';
import { resolveLinkTarget } from '../utils/markdown';
import { getNoteKey } from '../utils/noteKey';
import {
  buildNotesTagsMap,
  filterGraphByTag,
  filterGraphOrphans,
  getWorkspaceEntityNodeIds,
  highlightNodeConnections,
} from '../utils/graph';
import { GraphHeader } from './graph/GraphHeader';
import { GraphToolbar } from './graph/GraphToolbar';
import { GraphFilterRail, type GroupBy } from './graph/GraphFilterRail';
import { GraphInspector } from './graph/GraphInspector';
import { GraphLegend, DEFAULT_LEGEND_ITEMS } from './graph/GraphLegend';
import { GraphCanvas, colorForGroup, colorForNode, getNodeId } from './graph/GraphCanvas';
import { useGraphCamera, type ViewMode } from './graph/useGraphCamera';
import { useFullGraph, useGraphStats } from './graph/useGraphStats';

interface GraphViewProps {
  notes: VaultNote[];
  selectedPath?: string;
  onSelectNote: (path: string) => void;
}

const DEFAULT_FILTERS: GraphFilterState = {
  activeFilter: 'all',
  selectedTag: undefined,
  showOrphans: true,
  showBrokenLinks: true,
  showAgents: true,
};

const COLOR_SELECTED = '#D97706';

export function GraphView({ notes, selectedPath, onSelectNote }: GraphViewProps) {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [localOnly, setLocalOnly] = useState(false);
  const [hideMissing, setHideMissing] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);
  const [density, setDensity] = useState(1);
  const [viewMode, setViewMode] = useState<ViewMode>('3d');
  const [filterRailOpen, setFilterRailOpen] = useState(true);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [filterState, setFilterState] = useState<GraphFilterState>(DEFAULT_FILTERS);
  const [groupBy, setGroupBy] = useState<GroupBy>('vault');
  const [activeGroup, setActiveGroup] = useState<string | null>(null);

  const [browsePath, setBrowsePath] = useState<string | undefined>(selectedPath);

  const ref3d = useRef<any>(undefined);
  const ref2d = useRef<any>(undefined);
  const graphRef = viewMode === '3d' ? (ref3d as any) : (ref2d as any);
  const camera = useGraphCamera(graphRef, viewMode, setViewMode);

  const notesTagsMap = useMemo(() => buildNotesTagsMap(notes), [notes]);
  const entityNodeIds = useMemo(() => getWorkspaceEntityNodeIds(notes), [notes]);
  const fullGraph = useFullGraph(notes);

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    notes.forEach((note) => note.tags.forEach((tag) => tagSet.add(tag)));
    return Array.from(tagSet).sort((a, b) => a.localeCompare(b));
  }, [notes]);

  const groupByTag = useMemo(() => {
    const map = new Map<string, string>();
    notes.forEach((note) => {
      const key = getNoteKey(note);
      if (note.tags.length > 0) {
        map.set(key, note.tags[0]);
      } else {
        map.set(key, 'Untagged');
      }
    });
    return map;
  }, [notes]);

  const groupByFolder = useMemo(() => {
    const map = new Map<string, string>();
    notes.forEach((note) => {
      const key = getNoteKey(note);
      const parts = note.path.split('/').filter(Boolean);
      map.set(key, parts.length > 1 ? parts.slice(0, -1).join('/') : 'root');
    });
    return map;
  }, [notes]);

  const groupByEntity = useMemo(() => {
    const map = new Map<string, string>();
    notes.forEach((note) => {
      const key = getNoteKey(note);
      const type =
        typeof note.frontmatter.type === 'string' ? note.frontmatter.type.toLowerCase() : '';
      if (type) {
        map.set(key, type);
        return;
      }
      const path = `/${note.path.toLowerCase()}`;
      if (path.includes('/agents/')) {
        map.set(key, 'agent');
      } else if (path.includes('/skills/')) {
        map.set(key, 'skill');
      } else if (path.includes('/tools/')) {
        map.set(key, 'tool');
      } else {
        map.set(key, 'note');
      }
    });
    return map;
  }, [notes]);

  const enrichedGraph = useMemo(() => {
    if (groupBy === 'vault') return fullGraph;
    const byTag = groupByTag;
    const byFolder = groupByFolder;
    const byEntity = groupByEntity;
    return {
      ...fullGraph,
      nodes: fullGraph.nodes.map((node) => {
        if (node.type === 'missing') return node;
        let group = node.group;
        if (groupBy === 'tag') group = byTag.get(node.id) || 'Untagged';
        else if (groupBy === 'folder') group = byFolder.get(node.id) || 'root';
        else if (groupBy === 'entity') group = byEntity.get(node.id) || 'note';
        return { ...node, group };
      }),
    };
  }, [fullGraph, groupBy, groupByTag, groupByFolder, groupByEntity]);

  const focusPath = browsePath ?? selectedPath;

  const { highlightedLinks, connectedNodeIds } = useMemo(() => {
    if (!focusPath) return { highlightedLinks: [], connectedNodeIds: new Set<string>() };
    return highlightNodeConnections(focusPath, enrichedGraph.nodes, enrichedGraph.links);
  }, [enrichedGraph, focusPath]);

  const graph = useMemo(() => {
    let nodes = enrichedGraph.nodes;
    let links = enrichedGraph.links;

    if (!filterState.showOrphans) {
      const result = filterGraphOrphans(nodes, links, false);
      nodes = result.nodes;
      links = result.links;
    }

    if (!filterState.showAgents) {
      nodes = nodes.filter((node) => !entityNodeIds.has(node.id));
      const ids = new Set(nodes.map((node) => node.id));
      links = links.filter(
        (link) => ids.has(getNodeId(link.source)) && ids.has(getNodeId(link.target)),
      );
    }

    if (filterState.selectedTag) {
      const result = filterGraphByTag(nodes, links, filterState.selectedTag, notesTagsMap);
      nodes = result.nodes;
      links = result.links;
    }

    if (hideMissing) {
      nodes = nodes.filter((node) => node.type !== 'missing');
      const ids = new Set(nodes.map((node) => node.id));
      links = links.filter(
        (link) => ids.has(getNodeId(link.source)) && ids.has(getNodeId(link.target)),
      );
    }

    if (activeGroup) {
      nodes = nodes.filter((node) => node.group === activeGroup);
      const ids = new Set(nodes.map((node) => node.id));
      links = links.filter(
        (link) => ids.has(getNodeId(link.source)) && ids.has(getNodeId(link.target)),
      );
    }

    if (localOnly && focusPath) {
      const connected = new Set([focusPath]);
      links.forEach((link) => {
        const source = getNodeId(link.source);
        const target = getNodeId(link.target);
        if (source === focusPath) connected.add(target);
        if (target === focusPath) connected.add(source);
      });
      nodes = nodes.filter((node) => connected.has(node.id));
      links = links.filter(
        (link) => connected.has(getNodeId(link.source)) && connected.has(getNodeId(link.target)),
      );
    }

    if (deferredQuery.trim()) {
      const normalized = deferredQuery.toLowerCase();
      nodes = nodes.filter((node) =>
        [node.title, node.path, node.group].join(' ').toLowerCase().includes(normalized),
      );
      const ids = new Set(nodes.map((node) => node.id));
      links = links.filter(
        (link) => ids.has(getNodeId(link.source)) && ids.has(getNodeId(link.target)),
      );
    }

    return { nodes, links };
  }, [
    enrichedGraph,
    focusPath,
    deferredQuery,
    localOnly,
    hideMissing,
    filterState,
    entityNodeIds,
    notesTagsMap,
    activeGroup,
  ]);

  const focusedNode = useMemo(() => {
    if (!browsePath) return null;
    return enrichedGraph.nodes.find((node) => node.id === browsePath) ?? null;
  }, [enrichedGraph.nodes, browsePath]);

  const focusedNote = useMemo(() => {
    if (!browsePath || browsePath.startsWith('missing:')) return null;
    return notes.find((note) => getNoteKey(note) === browsePath) ?? null;
  }, [notes, browsePath]);

  const { incomingCount, outgoingCount } = useMemo(() => {
    if (!browsePath) return { incomingCount: 0, outgoingCount: 0 };
    let incoming = 0;
    let outgoing = 0;
    for (const link of enrichedGraph.links) {
      const source = getNodeId(link.source);
      const target = getNodeId(link.target);
      if (target === browsePath) incoming += 1;
      if (source === browsePath) outgoing += 1;
    }
    return { incomingCount: incoming, outgoingCount: outgoing };
  }, [enrichedGraph.links, browsePath]);

  const stats = useGraphStats(notes, enrichedGraph);

  const groupSummaries = useMemo(() => {
    const counts = new Map<string, number>();
    for (const node of enrichedGraph.nodes) {
      if (node.type === 'missing') continue;
      counts.set(node.group, (counts.get(node.group) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count, color: colorForGroup(name) }));
  }, [enrichedGraph]);

  const handleNodeClick = useCallback(
    (node: GraphNode) => {
      if (node.type === 'missing') {
        const maybeTarget = node.id.replace(/^missing:/, '');
        const target = resolveLinkTarget(notes, maybeTarget);
        if (target) {
          setBrowsePath(getNoteKey(target));
          setInspectorOpen(true);
          return;
        }
        setBrowsePath(node.id);
        setInspectorOpen(true);
        return;
      }
      setBrowsePath(node.id);
      setInspectorOpen(true);
    },
    [notes],
  );

  const openInEditor = useCallback(() => {
    if (!browsePath) return;
    if (browsePath.startsWith('missing:')) {
      const maybeTarget = browsePath.replace(/^missing:/, '');
      const target = resolveLinkTarget(notes, maybeTarget);
      if (target) onSelectNote(getNoteKey(target));
      return;
    }
    onSelectNote(browsePath);
  }, [browsePath, notes, onSelectNote]);

  const showLocalNeighborhood = useCallback(() => {
    setLocalOnly(true);
  }, []);

  const closeDetails = useCallback(() => {
    setInspectorOpen(false);
    setBrowsePath(undefined);
  }, []);

  const resetFilters = useCallback(() => {
    setFilterState(DEFAULT_FILTERS);
    setActiveGroup(null);
  }, []);

  const clearAllFilters = useCallback(() => {
    resetFilters();
    setQuery('');
    setHideMissing(false);
    setLocalOnly(false);
    setActiveGroup(null);
  }, [resetFilters]);

  const onAutoRotateToggle = useCallback(() => {
    setAutoRotate((value) => {
      const next = !value;
      camera.setAutoRotate(next);
      return next;
    });
  }, [camera]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      if (event.key === '/' && !isTyping) {
        event.preventDefault();
        const input = document.querySelector<HTMLInputElement>('.graph-mini-search input');
        input?.focus();
        return;
      }
      if (isTyping) return;

      if (event.key === 'f' || event.key === 'F') {
        camera.zoomToFit(500, 80);
      } else if (event.key === 'r' || event.key === 'R') {
        onAutoRotateToggle();
      } else if (event.key === '2') {
        setViewMode('2d');
      } else if (event.key === '3') {
        setViewMode('3d');
      } else if (event.key === 'Escape') {
        closeDetails();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [camera, onAutoRotateToggle, closeDetails]);

  const accentColor = useMemo(() => {
    if (!focusedNode) return COLOR_SELECTED;
    return colorForNode(focusedNode, focusPath, connectedNodeIds, entityNodeIds);
  }, [focusedNode, focusPath, connectedNodeIds, entityNodeIds]);

  const activeChips: { key: string; label: string; onRemove: () => void }[] = [];
  if (filterState.selectedTag) {
    activeChips.push({
      key: `tag-${filterState.selectedTag}`,
      label: `#${filterState.selectedTag}`,
      onRemove: () =>
        setFilterState((prev) => ({ ...prev, selectedTag: undefined, activeFilter: 'all' })),
    });
  }
  if (activeGroup) {
    activeChips.push({
      key: `group-${activeGroup}`,
      label: `Group: ${activeGroup}`,
      onRemove: () => setActiveGroup(null),
    });
  }
  if (localOnly) {
    activeChips.push({ key: 'local', label: 'Local', onRemove: () => setLocalOnly(false) });
  }
  if (hideMissing) {
    activeChips.push({
      key: 'hide-missing',
      label: 'Hide missing',
      onRemove: () => setHideMissing(false),
    });
  }
  if (!filterState.showOrphans) {
    activeChips.push({
      key: 'no-orphans',
      label: 'No orphans',
      onRemove: () => setFilterState((prev) => ({ ...prev, showOrphans: true })),
    });
  }
  if (!filterState.showAgents) {
    activeChips.push({
      key: 'hide-entities',
      label: 'Hide agents/skills/tools',
      onRemove: () => setFilterState((prev) => ({ ...prev, showAgents: true })),
    });
  }
  if (deferredQuery.trim()) {
    activeChips.push({
      key: 'query',
      label: `Search: ${deferredQuery.trim()}`,
      onRemove: () => setQuery(''),
    });
  }

  return (
    <main className="graph-page graph-page-v2">
      <header className="page-header graph-header">
        <GraphHeader stats={stats} />
        <GraphToolbar
          query={query}
          onQueryChange={setQuery}
          viewMode={viewMode}
          onViewModeChange={(mode) => {
            setViewMode(mode);
            if (mode === '2d') camera.setAutoRotate(false);
          }}
          localOnly={localOnly}
          onToggleLocal={() => setLocalOnly((v) => !v)}
          hideMissing={hideMissing}
          onToggleHideMissing={() => setHideMissing((v) => !v)}
          autoRotate={autoRotate}
          onToggleAutoRotate={onAutoRotateToggle}
          filterRailOpen={filterRailOpen}
          onToggleFilterRail={() => setFilterRailOpen((v) => !v)}
          inspectorOpen={inspectorOpen}
          onToggleInspector={() => setInspectorOpen((v) => !v)}
          onFit={() => camera.zoomToFit(500, 80)}
          onReset={() => camera.resetView()}
        />
      </header>

      {activeChips.length > 0 && (
        <div className="filter-chips graph-active-chips">
          {activeChips.map((chip) => (
            <button
              key={chip.key}
              className="filter-chip"
              onClick={chip.onRemove}
              type="button"
              aria-label={`Remove filter: ${chip.label}`}
            >
              <span>{chip.label}</span>
              <X size={10} className="filter-chip-remove" />
            </button>
          ))}
          {activeChips.length > 1 && (
            <button
              className="filter-chip filter-chip-clear"
              onClick={clearAllFilters}
              type="button"
            >
              Clear all
            </button>
          )}
        </div>
      )}

      <div className="graph-stage">
        <GraphFilterRail
          open={filterRailOpen}
          allTags={allTags}
          filterState={filterState}
          onFilterStateChange={setFilterState}
          activeGroup={activeGroup}
          onSelectGroup={setActiveGroup}
          groupSummaries={groupSummaries}
          extras={{
            density,
            onDensityChange: setDensity,
            groupBy,
            onGroupByChange: setGroupBy,
            onReset: () => {
              resetFilters();
              setDensity(1);
              setActiveGroup(null);
            },
          }}
        />

        <div className="graph-canvas">
          {graph.nodes.length ? (
            <GraphCanvas
              graph={graph}
              viewMode={viewMode}
              density={density}
              focusPath={focusPath}
              connectedNodeIds={connectedNodeIds}
              entityNodeIds={entityNodeIds}
              ref3d={ref3d}
              ref2d={ref2d}
              onNodeClick={handleNodeClick}
              onBackgroundClick={closeDetails}
            />
          ) : (
            <div className="compact-empty graph-empty">
              <GitFork size={28} />
              <h2>No graph nodes</h2>
              <p>
                Add notes with links like <code>[[Project Overview]]</code> to generate the graph.
              </p>
              <div className="graph-empty-tip">
                <Search size={11} /> Try removing some filters above
              </div>
            </div>
          )}

          <GraphLegend items={DEFAULT_LEGEND_ITEMS} />

          <GraphInspector
            open={inspectorOpen}
            node={focusedNode}
            note={focusedNote}
            notes={notes}
            incomingCount={incomingCount}
            outgoingCount={outgoingCount}
            localOnly={localOnly}
            accentColor={accentColor}
            onClose={closeDetails}
            onOpenInEditor={openInEditor}
            onShowLocal={showLocalNeighborhood}
            onJumpTo={(path) => {
              setBrowsePath(path);
              setInspectorOpen(true);
            }}
          />
        </div>
      </div>
    </main>
  );
}
