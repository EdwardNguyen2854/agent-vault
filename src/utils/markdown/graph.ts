/**
 * Graph & link analysis — backlinks, unlinked mentions, graph data, orphan/broken-link detection.
 *
 * Depends on `parse.ts` for wiki-link parsing (used indirectly via VaultNote.links).
 */
import type { BacklinkItem, GraphData, VaultNote } from '../../types';
import { getNoteKey } from '../noteKey';
import { basename, clampText, getFolderGroup, normalizeKey, removeMdExtension } from '../text';

// ---------------------------------------------------------------------------
// Link resolution
// ---------------------------------------------------------------------------

/**
 * Resolve a [[wiki link]] target string to a VaultNote.
 *
 * Matching is case-insensitive and tries several keys derived from each note:
 * the full path, the path without `.md`, the filename without `.md`, and the title.
 */
export function resolveLinkTarget(notes: VaultNote[], target: string): VaultNote | undefined {
  const cleanTarget = target.split('#')[0].trim();
  const key = normalizeKey(cleanTarget);
  return notes.find((note) => {
    const pathKey = normalizeKey(note.path);
    const pathNoExtKey = normalizeKey(removeMdExtension(note.path));
    const fileKey = normalizeKey(basename(removeMdExtension(note.path)));
    const titleKey = normalizeKey(note.title);
    return pathKey === key || pathNoExtKey === key || fileKey === key || titleKey === key;
  });
}

// ---------------------------------------------------------------------------
// Backlinks
// ---------------------------------------------------------------------------

/**
 * Build a list of notes that link *to* the current note.
 * Also collects contextual excerpts around the linking wikilink.
 */
export function buildBacklinks(notes: VaultNote[], current: VaultNote): BacklinkItem[] {
  return notes
    .filter((note) => getNoteKey(note) !== getNoteKey(current))
    .map((note) => {
      const matchesCurrent = note.links.some(
        (link) =>
          resolveLinkTarget([current], link.target)?.path === current.path ||
          normalizeKey(link.target) === normalizeKey(current.title),
      );
      if (!matchesCurrent) return null;

      const excerpts = note.content
        .split('\n')
        .filter((line) => line.includes('[['))
        .filter((line) =>
          note.links.some(
            (link) =>
              line.includes(link.raw) &&
              (normalizeKey(link.target) === normalizeKey(current.title) ||
                normalizeKey(link.target) === normalizeKey(removeMdExtension(current.path)) ||
                normalizeKey(link.target) ===
                  normalizeKey(basename(removeMdExtension(current.path)))),
          ),
        )
        .slice(0, 3)
        .map((line) => clampText(line, 180));

      return {
        sourceKey: getNoteKey(note),
        sourcePath: note.path,
        sourceTitle: note.title,
        excerpts,
      };
    })
    .filter(Boolean) as BacklinkItem[];
}

/**
 * Build a list of notes that mention the current note's title in body text
 * but do NOT have an explicit [[wiki link]] to it.
 */
export function buildUnlinkedMentions(notes: VaultNote[], current: VaultNote): BacklinkItem[] {
  const title = current.title.toLowerCase();
  if (title.length < 3) return [];

  return notes
    .filter((note) => getNoteKey(note) !== getNoteKey(current))
    .map((note) => {
      const linked = note.links.some(
        (link) => normalizeKey(link.target) === normalizeKey(current.title),
      );
      if (linked) return null;
      const excerpts = note.content
        .split('\n')
        .filter((line) => line.toLowerCase().includes(title))
        .slice(0, 3)
        .map((line) => clampText(line, 180));
      if (!excerpts.length) return null;
      return {
        sourceKey: getNoteKey(note),
        sourcePath: note.path,
        sourceTitle: note.title,
        excerpts,
      };
    })
    .filter(Boolean) as BacklinkItem[];
}

// ---------------------------------------------------------------------------
// Graph data (force-directed graph nodes & links)
// ---------------------------------------------------------------------------

/**
 * Build a full graph data structure from a set of notes and their wiki links.
 * Missing link targets are included as placeholder "missing" nodes.
 */
export function buildGraphData(notes: VaultNote[]): GraphData {
  const nodesById = new Map<string, GraphData['nodes'][number]>();
  const linkPairs = new Set<string>();
  const links: GraphData['links'] = [];

  for (const note of notes) {
    const noteKey = getNoteKey(note);
    nodesById.set(noteKey, {
      id: noteKey,
      name: note.title,
      title: note.title,
      path: note.path,
      group: note.vaultRole === 'personal' ? getFolderGroup(note.path) : note.vaultName,
      value: 1,
      type: 'note',
    });
  }

  for (const note of notes) {
    for (const link of note.links) {
      const targetNote = resolveLinkTarget(notes, link.target);
      const noteKey = getNoteKey(note);
      const targetId = targetNote ? getNoteKey(targetNote) : `missing:${link.target}`;
      if (!nodesById.has(targetId)) {
        nodesById.set(targetId, {
          id: targetId,
          name: link.target,
          title: link.target,
          path: targetId,
          group: 'Missing',
          value: 1,
          type: 'missing',
        });
      }

      const pair = `${noteKey}->${targetId}`;
      if (linkPairs.has(pair)) continue;
      linkPairs.add(pair);
      links.push({ source: noteKey, target: targetId, label: link.raw });
      const sourceNode = nodesById.get(noteKey);
      const targetNode = nodesById.get(targetId);
      if (sourceNode) sourceNode.value += 1;
      if (targetNode) targetNode.value += 2;
    }
  }

  return { nodes: Array.from(nodesById.values()), links };
}

// ---------------------------------------------------------------------------
// Analysis helpers
// ---------------------------------------------------------------------------

/**
 * Find all broken wiki links — links whose target does not exist in the note set.
 */
export function getBrokenLinks(notes: VaultNote[]): { source: VaultNote; target: string }[] {
  return notes.flatMap((note) =>
    note.links
      .filter((link) => !resolveLinkTarget(notes, link.target))
      .map((link) => ({ source: note, target: link.target })),
  );
}

/**
 * Find orphan notes — notes that are not connected to any other note in the graph.
 */
export function getOrphanNotes(notes: VaultNote[]): VaultNote[] {
  const graph = buildGraphData(notes);
  const connected = new Set<string>();
  for (const link of graph.links) {
    connected.add(String(link.source));
    connected.add(String(link.target));
  }
  return notes.filter((note) => !connected.has(getNoteKey(note)));
}
