export function clampMaxResults(value: unknown, fallback: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(max, Math.max(1, Math.floor(parsed)));
}

export function cleanString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : String(value ?? '').trim();
}

export function validatePlainPath(value: string, fieldName: string): string | null {
  if (!value) return `${fieldName} is required`;
  if (value.includes('..')) return `${fieldName} cannot contain path traversal`;
  if (/^\w+:\/\//.test(value) || value.startsWith('/') || value.startsWith('~')) {
    return `${fieldName} must be a vault-relative path, not an absolute path or URL`;
  }
  if (/[<>:"\\|?*\x00-\x1f]/.test(value)) return `${fieldName} contains invalid characters`;
  if (value.split('/').some((part) => part.trim() === ''))
    return `${fieldName} contains an empty path segment`;
  return null;
}

export function validateAssignee(value: string): string | null {
  if (!value) return null;
  if (!/^@?[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(value)) {
    return 'assignee must look like @name and contain only letters, numbers, underscores, or hyphens';
  }
  return null;
}

export function normalizeAssignee(value: string): string {
  if (!value) return '';
  return value.startsWith('@') ? value : `@${value}`;
}

export function validateDueDate(value: string): string | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'due must use YYYY-MM-DD';
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    return 'due must be a valid calendar date';
  }
  return null;
}

export function parseTags(value: unknown): { tags: string[]; error?: string } {
  if (value === undefined || value === null || value === '') return { tags: [] };
  const raw = Array.isArray(value) ? value.map(String) : String(value).split(/\s+/);
  const tags = raw.map((tag) => tag.trim()).filter(Boolean);
  for (const tag of tags) {
    if (!/^#?[A-Za-z0-9][A-Za-z0-9_/-]{0,63}$/.test(tag)) {
      return {
        tags: [],
        error:
          'tags must look like #tag and contain only letters, numbers, underscores, hyphens, or slashes',
      };
    }
  }
  return { tags: tags.map((tag) => (tag.startsWith('#') ? tag : `#${tag}`)) };
}
