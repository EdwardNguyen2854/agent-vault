/**
 * Image validation and encoding helpers shared by `vault.read_image` and
 * `vault.save_image`. Centralizes the allowlist, MIME/extension pairing, and
 * path-traversal rules so both tools stay in sync.
 */

export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
export const MAX_VISION_BYTES = 4 * 1024 * 1024;

export const ALLOWED_VISION_EXTENSIONS = new Set([
  'png',
  'jpg',
  'jpeg',
  'webp',
  'gif',
]);

export const ALLOWED_IMAGE_EXTENSIONS = new Set([
  'png',
  'jpg',
  'jpeg',
  'webp',
  'gif',
  'bmp',
  'ico',
]);

const MIME_TYPE_MAP: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
};

export function getImageExtension(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot >= 0 ? filename.slice(dot + 1).toLowerCase() : '';
}

export interface PathValidation {
  ok: boolean;
  error?: string;
  normalized?: string;
}

export function validateImagePath(value: string): PathValidation {
  const trimmed = value.trim();
  if (!trimmed) return { ok: false, error: 'Path is required.' };
  if (trimmed.includes('..')) return { ok: false, error: 'Path traversal is not allowed.' };
  if (trimmed.startsWith('/') || trimmed.startsWith('~')) {
    return { ok: false, error: 'Path must be relative to the vault root.' };
  }
  if (/^\w+:\/\//.test(trimmed)) {
    return { ok: false, error: 'Path must be a local file path, not a URL.' };
  }
  if (/[<>:"\\|?*\x00-\x1f]/.test(trimmed)) {
    return { ok: false, error: 'Path contains invalid characters.' };
  }
  if (trimmed.includes('//')) {
    return { ok: false, error: 'Path contains an empty segment.' };
  }
  return { ok: true, normalized: trimmed };
}

export interface ParsedDataUrl {
  ok: boolean;
  mimeType: string;
  rawBase64: string;
  bytes: Uint8Array;
  error?: string;
}

export function parseImageDataUrl(dataUrl: string): ParsedDataUrl {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    return {
      ok: false,
      mimeType: '',
      rawBase64: '',
      bytes: new Uint8Array(),
      error:
        'Invalid data URL format. Expected data:<mime>;base64,<data>.',
    };
  }
  const mimeType = match[1];
  const rawBase64 = match[2];
  let bytes: Uint8Array;
  try {
    const binary = atob(rawBase64);
    bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
  } catch (err) {
    return {
      ok: false,
      mimeType,
      rawBase64,
      bytes: new Uint8Array(),
      error: err instanceof Error ? `Cannot decode base64: ${err.message}` : 'Cannot decode base64 payload.',
    };
  }
  if (bytes.byteLength > MAX_IMAGE_BYTES) {
    return {
      ok: false,
      mimeType,
      rawBase64,
      bytes,
      error: `Image is too large (${(bytes.byteLength / (1024 * 1024)).toFixed(1)} MB). Maximum is ${MAX_IMAGE_BYTES / (1024 * 1024)} MB.`,
    };
  }
  return { ok: true, mimeType, rawBase64, bytes };
}

export interface ImageValidationResult {
  ok: boolean;
  error?: string;
  extension?: string;
  mimeType?: string;
}

export function validateImageExtension(
  filename: string,
  options: { allowVision?: boolean } = {},
): ImageValidationResult {
  const extension = getImageExtension(filename);
  if (!extension) {
    return {
      ok: false,
      error: 'Filename must include a valid image extension (e.g. .png, .jpg, .webp).',
    };
  }
  const allowList = options.allowVision
    ? ALLOWED_VISION_EXTENSIONS
    : ALLOWED_IMAGE_EXTENSIONS;
  if (!allowList.has(extension)) {
    return {
      ok: false,
      error: `Unsupported image extension: .${extension}. Allowed: ${Array.from(allowList).join(', ')}`,
    };
  }
  return { ok: true, extension, mimeType: MIME_TYPE_MAP[extension] };
}

export function validateMimeMatchesExtension(
  mimeType: string,
  extension: string,
): { ok: boolean; error?: string } {
  const expected = MIME_TYPE_MAP[extension];
  if (!expected) {
    return { ok: false, error: `Unknown extension .${extension}` };
  }
  if (mimeType !== expected) {
    return {
      ok: false,
      error: `MIME type "${mimeType}" does not match extension ".${extension}". Expected "${expected}".`,
    };
  }
  return { ok: true };
}

export function isVisionCapableAdapter(adapterId: string | undefined): boolean {
  // All currently bundled adapters (LM Studio and MiniMax) expose the
  // OpenAI-compatible `image_url` message part. We keep this function
  // centralized so future providers can opt out explicitly.
  if (!adapterId) return false;
  return adapterId === 'lmstudio' || adapterId === 'minimax';
}

/**
 * Convert raw image bytes to a base64 data URL.
 */
export function bytesToDataUrl(bytes: Uint8Array, mimeType: string): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = typeof btoa === 'function' ? btoa(binary) : '';
  return `data:${mimeType};base64,${base64}`;
}

/**
 * Strip the data URL prefix and return only the base64 payload. Useful when
 * we must redact full base64 from chat history or tool transcripts.
 */
export function redactDataUrl(dataUrl: string | undefined): string {
  if (!dataUrl) return '';
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return '';
  return `${match[1]} [base64 ${match[2].length} chars redacted]`;
}