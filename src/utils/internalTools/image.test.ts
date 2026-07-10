import { describe, expect, it } from 'vitest';
import {
  ALLOWED_VISION_EXTENSIONS,
  bytesToDataUrl,
  getImageExtension,
  isVisionCapableAdapter,
  parseImageDataUrl,
  redactDataUrl,
  validateImageExtension,
  validateImagePath,
  validateMimeMatchesExtension,
} from './image';

describe('internalTools/image', () => {
  it('extracts file extensions case-insensitively', () => {
    expect(getImageExtension('diagram.PNG')).toBe('png');
    expect(getImageExtension('photo.jpeg')).toBe('jpeg');
    expect(getImageExtension('README')).toBe('');
  });

  it('rejects empty or traversal paths', () => {
    expect(validateImagePath('').ok).toBe(false);
    expect(validateImagePath('../etc/passwd').ok).toBe(false);
    expect(validateImagePath('/absolute.png').ok).toBe(false);
    expect(validateImagePath('assets//nested.png').ok).toBe(false);
    expect(validateImagePath('assets/nested.png').ok).toBe(true);
  });

  it('validates image extensions against the right allowlist', () => {
    expect(validateImageExtension('foo.png').ok).toBe(true);
    expect(validateImageExtension('foo.svg').ok).toBe(false);
    expect(validateImageExtension('foo.svg', { allowVision: true }).ok).toBe(false);
    expect(ALLOWED_VISION_EXTENSIONS.has('svg')).toBe(false);
  });

  it('requires MIME to match the extension', () => {
    expect(validateMimeMatchesExtension('image/png', 'png').ok).toBe(true);
    expect(validateMimeMatchesExtension('image/jpeg', 'jpg').ok).toBe(true);
    expect(validateMimeMatchesExtension('image/png', 'jpg').ok).toBe(false);
  });

  it('parses and re-emits data URLs', () => {
    const original = bytesToDataUrl(new Uint8Array([1, 2, 3, 4]), 'image/png');
    const parsed = parseImageDataUrl(original);
    expect(parsed.ok).toBe(true);
    expect(parsed.mimeType).toBe('image/png');
    expect(Array.from(parsed.bytes)).toEqual([1, 2, 3, 4]);
  });

  it('rejects malformed data URLs', () => {
    expect(parseImageDataUrl('not-a-url').ok).toBe(false);
    expect(parseImageDataUrl('data:image/png;base64,###').ok).toBe(false);
  });

  it('redacts base64 payloads', () => {
    expect(redactDataUrl('data:image/png;base64,AAAA')).toContain('base64');
    expect(redactDataUrl('data:image/png;base64,AAAA')).not.toContain('AAAA');
    expect(redactDataUrl(undefined)).toBe('');
    expect(redactDataUrl('plain-string')).toBe('');
  });

  it('marks bundled providers as vision-capable', () => {
    expect(isVisionCapableAdapter('lmstudio')).toBe(true);
    expect(isVisionCapableAdapter('minimax')).toBe(true);
    expect(isVisionCapableAdapter('unknown')).toBe(false);
    expect(isVisionCapableAdapter(undefined)).toBe(false);
  });
});