import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import ForceGraph2D from 'react-force-graph-2d';
import * as THREE from 'three';
import type { GraphData, GraphNode } from '../../types';
import type { ViewMode } from './useGraphCamera';

const COLOR_MISSING = '#DC2626';
const COLOR_ENTITY = '#7C3AED';
const COLOR_SELECTED = '#D97706';
const COLOR_CONNECTED = '#22C55E';

const PALETTE = [
  '#2563EB',
  '#7C3AED',
  '#059669',
  '#D97706',
  '#DC2626',
  '#0891B2',
  '#8B5CF6',
  '#0D9488',
  '#EA580C',
  '#DB2777',
  '#0EA5E9',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#6366F1',
];

export function colorForGroup(group: string): string {
  let hash = 0;
  for (let i = 0; i < group.length; i++) {
    hash = (hash * 31 + group.charCodeAt(i)) | 0;
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

export function colorForNode(
  node: GraphNode,
  focusPath: string | undefined,
  connectedIds: Set<string>,
  entityIds: Set<string>,
): string {
  if (focusPath && node.id === focusPath) return COLOR_SELECTED;
  if (focusPath && connectedIds.has(node.id)) return COLOR_CONNECTED;
  if (node.type === 'missing') return COLOR_MISSING;
  if (entityIds.has(node.id)) return COLOR_ENTITY;
  return colorForGroup(node.group);
}

export function getNodeId(endpoint: unknown): string {
  if (endpoint && typeof endpoint === 'object' && 'id' in (endpoint as Record<string, unknown>)) {
    return String((endpoint as { id: unknown }).id);
  }
  return String(endpoint);
}

export interface GraphCanvasProps {
  graph: GraphData;
  viewMode: ViewMode;
  density: number;
  focusPath?: string;
  connectedNodeIds: Set<string>;
  entityNodeIds: Set<string>;
  ref3d: React.MutableRefObject<any>;
  ref2d: React.MutableRefObject<any>;
  onNodeClick: (node: GraphNode) => void;
  onNodeHover?: (node: GraphNode | null) => void;
  onBackgroundClick: () => void;
}

const SCENE_BG = '#0B1120';

function renderNodeThree({
  node,
  focusPath,
  connectedIds,
  entityIds,
  density,
}: {
  node: GraphNode;
  focusPath?: string;
  connectedIds: Set<string>;
  entityIds: Set<string>;
  density: number;
}) {
  const base = Math.max(2, node.value);
  const isFocus = focusPath && node.id === focusPath;
  const isConnected = focusPath && connectedIds.has(node.id);
  const size = base * (isFocus ? 1.6 : isConnected ? 1.25 : 1) * density;
  const color = colorForNode(node, focusPath, connectedIds, entityIds);
  const group = new THREE.Group();
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(size, 16, 12),
    new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: isFocus ? 0.6 : isConnected ? 0.35 : 0.18,
      roughness: 0.4,
      metalness: 0.1,
      transparent: node.type === 'missing',
      opacity: node.type === 'missing' ? 0.85 : 1,
    }),
  );
  group.add(sphere);

  if (isFocus) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(size * 1.4, size * 1.7, 32),
      new THREE.MeshBasicMaterial({
        color,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.4,
      }),
    );
    ring.lookAt(0, 0, 1);
    group.add(ring);
  }
  return group;
}

function GraphCanvasInner({
  graph,
  viewMode,
  density,
  focusPath,
  connectedNodeIds,
  entityNodeIds,
  ref3d,
  ref2d,
  onNodeClick,
  onNodeHover,
  onBackgroundClick,
}: GraphCanvasProps) {
  const [, setHover] = useState<GraphNode | null>(null);

  useEffect(() => {
    if (viewMode !== '3d') return;
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    const tryConfigure = (attempt = 0) => {
      if (cancelled) return;
      const fg = ref3d.current;
      if (!fg || typeof (fg as any).controls !== 'function') {
        if (attempt < 20) setTimeout(() => tryConfigure(attempt + 1), 100);
        return;
      }
      const controls = (fg as any).controls();
      if (!controls) {
        if (attempt < 20) setTimeout(() => tryConfigure(attempt + 1), 100);
        return;
      }
      const mb = (controls as any).mouseButtons;
      if (mb) {
        mb.LEFT = (THREE as any).MOUSE?.ROTATE ?? 0;
        mb.MIDDLE = (THREE as any).MOUSE?.PAN ?? 2;
        mb.RIGHT = (THREE as any).MOUSE?.ROTATE ?? 0;
      }
      (controls as any).enableRotate = true;
      (controls as any).enablePan = true;
      (controls as any).enableZoom = true;
      (controls as any).panSpeed = 0.05;
      (controls as any).rotateSpeed = 0.2;
      (controls as any).zoomSpeed = 0.2;
      (controls as any).update?.();

      const canvas: HTMLCanvasElement | undefined = (fg as any).renderer?.()?.domElement;
      const onContext = (event: MouseEvent) => event.preventDefault();
      if (canvas) canvas.addEventListener('contextmenu', onContext);

      cleanup = () => {
        if (canvas) canvas.removeEventListener('contextmenu', onContext);
      };
    };

    const id = window.setTimeout(() => tryConfigure(), 50);

    return () => {
      cancelled = true;
      window.clearTimeout(id);
      cleanup?.();
    };
  }, [viewMode, ref3d]);

  const nodeVal = useCallback(
    (node: any) => {
      const base = Math.max(2, node.value || 1);
      if (focusPath && node.id === focusPath) return base * 4 * density;
      if (focusPath && connectedNodeIds.has(node.id)) return base * 2.5 * density;
      return base * density;
    },
    [focusPath, connectedNodeIds, density],
  );

  const nodeColor = useCallback(
    (node: any) => colorForNode(node, focusPath, connectedNodeIds, entityNodeIds),
    [focusPath, connectedNodeIds, entityNodeIds],
  );

  const linkColor = useCallback(
    (link: any) => {
      if (!focusPath) return 'rgba(148, 163, 184, 0.35)';
      const source = getNodeId(link.source);
      const target = getNodeId(link.target);
      if (source === focusPath || target === focusPath) return COLOR_SELECTED;
      return 'rgba(148, 163, 184, 0.12)';
    },
    [focusPath],
  );

  const linkOpacity = useCallback(
    (link: any) => {
      if (!focusPath) return 0.35;
      const source = getNodeId(link.source);
      const target = getNodeId(link.target);
      if (source === focusPath || target === focusPath) return 0.95;
      return 0.08;
    },
    [focusPath],
  );

  const linkWidth = useCallback(
    (link: any) => {
      if (!focusPath) return 0.6;
      const source = getNodeId(link.source);
      const target = getNodeId(link.target);
      if (source === focusPath || target === focusPath) return 1.6;
      return 0.4;
    },
    [focusPath],
  );

  const linkDirectionalParticles = useCallback(
    (link: any) => {
      if (!focusPath) return 0;
      const source = getNodeId(link.source);
      const target = getNodeId(link.target);
      if (source === focusPath || target === focusPath) return 3;
      return 0;
    },
    [focusPath],
  );

  const nodeLabel = useCallback(
    (node: any) =>
      `<div class="graph-tooltip"><strong>${escapeHtml(node.title)}</strong><code>${escapeHtml(node.path)}</code></div>`,
    [],
  );

  const handle3dClick = useCallback(
    (node: any) => {
      onNodeClick(node as GraphNode);
    },
    [onNodeClick],
  );

  const handle3dHover = useCallback(
    (node: any) => {
      setHover((node as GraphNode) || null);
      onNodeHover?.(node ? (node as GraphNode) : null);
    },
    [onNodeHover],
  );

  const renderNode = useCallback(
    (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const color = colorForNode(node, focusPath, connectedNodeIds, entityNodeIds);
      const base = Math.max(3, node.value || 1);
      const isFocus = focusPath && node.id === focusPath;
      const isConnected = focusPath && connectedNodeIds.has(node.id);
      const radius = base * (isFocus ? 1.8 : isConnected ? 1.3 : 1) * density * 0.9;
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
      ctx.fillStyle = color;
      ctx.globalAlpha = node.type === 'missing' ? 0.7 : 1;
      ctx.fill();
      ctx.globalAlpha = 1;
      if (isFocus) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius * 1.6, 0, 2 * Math.PI, false);
        ctx.strokeStyle = `${color}55`;
        ctx.lineWidth = 2 / globalScale;
        ctx.stroke();
      }
      if (globalScale > 1.4 || isFocus) {
        const label = node.title || '';
        const fontSize = Math.max(3, 11 / globalScale);
        ctx.font = `${isFocus ? '600 ' : ''}${fontSize}px 'Plus Jakarta Sans', sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = isFocus ? COLOR_SELECTED : 'rgba(15, 23, 42, 0.78)';
        ctx.fillText(label, node.x, node.y + radius + 1.5);
      }
    },
    [focusPath, connectedNodeIds, entityNodeIds, density],
  );

  const renderNodePointerArea = useCallback(
    (node: any, color: string, ctx: CanvasRenderingContext2D) => {
      const base = Math.max(3, node.value || 1);
      const radius = base * density * 1.6;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
      ctx.fill();
    },
    [density],
  );

  const memoGraph = useMemo(() => graph, [graph]);

  return (
    <div className="graph-canvas-inner" data-mode={viewMode}>
      {viewMode === '3d' ? (
        <ForceGraph3D
          ref={ref3d as any}
          graphData={memoGraph}
          backgroundColor={SCENE_BG}
          nodeRelSize={4}
          nodeVal={nodeVal as any}
          nodeColor={nodeColor as any}
          nodeLabel={nodeLabel as any}
          nodeThreeObject={
            ((node: any) =>
              renderNodeThree({
                node,
                focusPath,
                connectedIds: connectedNodeIds,
                entityIds: entityNodeIds,
                density,
              })) as any
          }
          nodeThreeObjectExtend={false as any}
          linkColor={linkColor as any}
          linkOpacity={linkOpacity as any}
          linkWidth={linkWidth as any}
          linkDirectionalParticles={linkDirectionalParticles as any}
          linkDirectionalParticleSpeed={0.005}
          linkDirectionalParticleColor={() => COLOR_SELECTED}
          linkDirectionalParticleWidth={1.5}
          enableNodeDrag
          enableZoomInteraction
          enablePanInteraction
          enableRotationInteraction
          showNavInfo={false}
          d3AlphaDecay={0.022}
          d3VelocityDecay={0.32}
          onNodeClick={handle3dClick}
          onNodeHover={handle3dHover}
          onBackgroundClick={onBackgroundClick}
        />
      ) : (
        <ForceGraph2D
          ref={ref2d as any}
          graphData={memoGraph}
          backgroundColor="rgba(11, 17, 32, 0)"
          nodeRelSize={4}
          nodeVal={nodeVal as any}
          nodeColor={nodeColor as any}
          nodeLabel={nodeLabel as any}
          linkColor={linkColor as any}
          linkWidth={linkWidth as any}
          linkDirectionalParticles={linkDirectionalParticles as any}
          linkDirectionalParticleSpeed={0.004}
          linkDirectionalParticleColor={() => COLOR_SELECTED}
          enableNodeDrag
          enableZoomInteraction
          enablePanInteraction
          d3AlphaDecay={0.022}
          d3VelocityDecay={0.32}
          nodeCanvasObjectMode={() => 'replace'}
          nodeCanvasObject={renderNode as any}
          nodePointerAreaPaint={renderNodePointerArea as any}
          onNodeClick={handle3dClick as any}
          onNodeHover={handle3dHover as any}
          onBackgroundClick={onBackgroundClick}
        />
      )}
    </div>
  );
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const GraphCanvas = memo(GraphCanvasInner);
