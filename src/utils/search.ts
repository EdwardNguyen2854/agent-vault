import type { VaultNote } from '../types';
import { getMarkdownBody } from './markdown';

export interface SearchResult {
  note: VaultNote;
  score: number;
  matchType: 'title' | 'path' | 'tag' | 'content';
  snippet?: string;
}

function extractSnippet(
  content: string,
  query: string,
  maxLength: number = 180,
): string | undefined {
  const lowerContent = content.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = lowerContent.indexOf(lowerQuery);

  if (index === -1) return undefined;

  const start = Math.max(0, index - 60);
  const end = Math.min(content.length, index + query.length + 120);

  let snippet = content.slice(start, end);

  if (start > 0) snippet = '...' + snippet;
  if (end < content.length) snippet = snippet + '...';

  // Clean up newlines for display
  snippet = snippet.replace(/\n+/g, ' ').trim();

  return snippet;
}

export interface SearchNotesOptions {
  contentScope?: 'full' | 'body';
}

export function searchNotes(
  notes: VaultNote[],
  query: string,
  options: SearchNotesOptions = {},
): SearchResult[] {
  if (!query.trim()) return [];

  const lowerQuery = query.toLowerCase();
  const contentScope = options.contentScope ?? 'full';
  const results: SearchResult[] = [];

  for (const note of notes) {
    let bestScore = 0;
    let matchType: SearchResult['matchType'] = 'content';
    let snippet: string | undefined;

    // Exact title match: 100
    if (note.title.toLowerCase() === lowerQuery) {
      bestScore = 100;
      matchType = 'title';
    }
    // Title includes query: 80
    else if (note.title.toLowerCase().includes(lowerQuery)) {
      bestScore = 80;
      matchType = 'title';
    }
    // Path includes query: 60
    else if (note.path.toLowerCase().includes(lowerQuery)) {
      bestScore = 60;
      matchType = 'path';
    }
    // Tag exact or includes: 55
    else {
      const tagMatch = note.tags.some((tag) => {
        const lowerTag = tag.toLowerCase();
        return lowerTag === lowerQuery || lowerTag.includes(lowerQuery);
      });
      if (tagMatch) {
        bestScore = 55;
        matchType = 'tag';
      }
    }

    // Content includes: 25
    const searchableContent =
      contentScope === 'body' ? getMarkdownBody(note.content) : note.content;
    if (bestScore === 0 && searchableContent.toLowerCase().includes(lowerQuery)) {
      bestScore = 25;
      matchType = 'content';
      snippet = extractSnippet(searchableContent, query);
    }

    if (bestScore > 0) {
      results.push({ note, score: bestScore, matchType, snippet });
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

  return results;
}
