export function removeMdExtension(path: string): string {
  return path.replace(/\.md$/i, '');
}

export function basename(path: string): string {
  return path.split('/').pop() ?? path;
}

export function dirname(path: string): string {
  const parts = path.split('/');
  parts.pop();
  return parts.join('/');
}

export function titleFromPath(path: string): string {
  return basename(removeMdExtension(path)).replace(/[-_]+/g, ' ');
}

export function normalizeKey(value: string): string {
  return removeMdExtension(value)
    .replace(/^\.\//, '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export function getFolderGroup(path: string): string {
  const parts = path.split('/');
  return parts.length > 1 ? parts[0] : 'Root';
}

export function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

export function formatDate(timestamp: number): string {
  if (!timestamp) return 'Unknown';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp));
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function clampText(text: string, max = 120): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  return `${flat.slice(0, max - 1)}…`;
}
