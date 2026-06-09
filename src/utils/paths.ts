import type { NotePathValidation, VaultNote } from '../types';

/**
 * Path separators and characters that are invalid on common filesystems.
 * Based on macOS/Windows restrictions.
 */
const INVALID_PATH_CHARS = /[<>:"\\|?*\x00-\x1f]/;
const MAX_PATH_LENGTH = 240; // Reasonable limit for cross-platform compatibility
const MAX_FILENAME_LENGTH = 100;

/**
 * Normalizes a vault path: converts separators, trims whitespace, ensures .md extension.
 */
export function normalizeVaultPath(input: string): string {
  const normalized = input
    .replace(/\\/g, '/') // Convert backslashes to forward slashes
    .replace(/^\/+|\/+$/g, '') // Trim leading/trailing slashes
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();

  // Ensure .md extension
  return normalized.endsWith('.md') ? normalized : `${normalized}.md`;
}

/**
 * Validates a vault path format.
 * Returns a validation result with normalized path on success, or error message on failure.
 */
export function validateVaultPath(input: string): NotePathValidation {
  const trimmed = input.trim();

  if (!trimmed) {
    return { valid: false, error: 'Path cannot be empty' };
  }

  // Check for invalid characters
  if (INVALID_PATH_CHARS.test(trimmed)) {
    return { valid: false, error: 'Invalid characters in path' };
  }

  // Check for path traversal attempts
  if (trimmed.includes('..')) {
    return { valid: false, error: 'Path traversal not allowed' };
  }

  // Check overall path length
  if (trimmed.length > MAX_PATH_LENGTH) {
    return { valid: false, error: 'Path too long (max 240 characters)' };
  }

  // Get the filename (last segment) and check its length
  const parts = trimmed.split('/').filter(Boolean);
  const fileName = parts[parts.length - 1] ?? '';

  if (fileName.length > MAX_FILENAME_LENGTH) {
    return { valid: false, error: 'Filename too long (max 100 characters)' };
  }

  if (!fileName) {
    return { valid: false, error: 'Path must include a filename' };
  }

  // Ensure .md extension
  const normalizedPath = normalizeVaultPath(trimmed);

  return { valid: true, normalizedPath };
}

/**
 * Converts a title to a default file path.
 * Example: "My Note" -> "My Note.md" or "folder/My Note.md"
 */
export function titleToDefaultPath(title: string, folder?: string): string {
  const safeTitle = title
    .replace(/[/\\:<>":|?*\x00-\x1f]/g, '') // Remove invalid filename chars
    .replace(/^\.+|\.+$/g, '') // Remove leading/trailing dots
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();

  if (!safeTitle) {
    return folder ? `${folder}/Untitled.md` : 'Untitled.md';
  }

  const fileName = `${safeTitle}.md`;
  return folder ? `${folder}/${fileName}` : fileName;
}

/**
 * Case-insensitive path existence check.
 */
export function pathExists(notes: VaultNote[], path: string): boolean {
  const normalizedPath = normalizeVaultPath(path).toLowerCase();
  return notes.some((note) => note.path.toLowerCase() === normalizedPath);
}
