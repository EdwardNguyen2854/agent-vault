import type { GraphData, GraphLink, GraphNode } from '../types';
import { getNoteKey } from './noteKey';

/**
 * Filter graph nodes and links to show only notes with a specific tag.
 */
export function filterGraphByTag(
  nodes: GraphNode[],
  links: GraphLink[],
  tag: string,
  notesTags: Map<string, string[]>,
): { nodes: GraphNode[]; links: GraphLink[] } {
  const tagLower = tag.toLowerCase();
  const matchingNodeIds = new Set<string>();

  for (const node of nodes) {
    const nodeTags = notesTags.get(node.id) || [];
    if (nodeTags.some((t) => t.toLowerCase() === tagLower)) {
      matchingNodeIds.add(node.id);
    }
  }

  const filteredNodes = nodes.filter((node) => matchingNodeIds.has(node.id));
  const filteredLinks = links.filter(
    (link) => matchingNodeIds.has(String(link.source)) && matchingNodeIds.has(String(link.target)),
  );

  return { nodes: filteredNodes, links: filteredLinks };
}

/**
 * Filter graph to show only matching entity nodes and their connections.
 */
export function filterGraphByEntity(
  nodes: GraphNode[],
  links: GraphLink[],
  entityNodeIds: Set<string>,
): { nodes: GraphNode[]; links: GraphLink[] } {
  const filteredNodes = nodes.filter((node) => entityNodeIds.has(node.id));
  const filteredLinks = links.filter(
    (link) => entityNodeIds.has(String(link.source)) || entityNodeIds.has(String(link.target)),
  );

  return { nodes: filteredNodes, links: filteredLinks };
}

/**
 * Show or hide orphan nodes (notes with no links).
 */
export function filterGraphOrphans(
  nodes: GraphNode[],
  links: GraphLink[],
  showOrphans: boolean,
): { nodes: GraphNode[]; links: GraphLink[] } {
  if (showOrphans) {
    return { nodes, links };
  }

  const connected = new Set<string>();
  for (const link of links) {
    connected.add(String(link.source));
    connected.add(String(link.target));
  }

  const filteredNodes = nodes.filter((node) => connected.has(node.id));
  const filteredLinks = links.filter(
    (link) => connected.has(String(link.source)) && connected.has(String(link.target)),
  );

  return { nodes: filteredNodes, links: filteredLinks };
}

/**
 * Get connections for a specific node - returns links and connected node IDs.
 */
export function highlightNodeConnections(
  nodeId: string,
  nodes: GraphNode[],
  links: GraphLink[],
): { highlightedLinks: GraphLink[]; connectedNodeIds: Set<string> } {
  const connectedNodeIds = new Set<string>();
  const highlightedLinks: GraphLink[] = [];

  for (const link of links) {
    const source = String(link.source);
    const target = String(link.target);
    if (source === nodeId) {
      highlightedLinks.push(link);
      connectedNodeIds.add(target);
    } else if (target === nodeId) {
      highlightedLinks.push(link);
      connectedNodeIds.add(source);
    }
  }

  return { highlightedLinks, connectedNodeIds };
}

/**
 * Build a map of note path to tags for quick lookup.
 */
export function buildNotesTagsMap(
  notes: { vaultId: string; path: string; tags: string[] }[],
): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const note of notes) {
    map.set(getNoteKey(note), note.tags);
  }
  return map;
}

/**
 * Get agent, skill, and tool node IDs from notes.
 */
export function getWorkspaceEntityNodeIds(
  notes: {
    vaultId: string;
    path: string;
    frontmatter: Record<string, string | string[]>;
    tags: string[];
  }[],
): Set<string> {
  const ids = new Set<string>();
  for (const note of notes) {
    const type =
      typeof note.frontmatter.type === 'string' ? note.frontmatter.type.toLowerCase() : '';
    const path = `/${note.path.toLowerCase()}`;
    const tags = note.tags.map((tag) => tag.toLowerCase());
    if (
      type === 'agent' ||
      path.includes('/agents/') ||
      tags.includes('agent') ||
      type === 'skill' ||
      path.includes('/skills/') ||
      tags.includes('skill') ||
      type === 'tool' ||
      path.includes('/tools/') ||
      tags.includes('tool')
    ) {
      ids.add(getNoteKey(note));
    }
  }
  return ids;
}
