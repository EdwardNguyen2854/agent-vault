/**
 * Markdown HTML rendering — converts vault markdown (with [[wiki links]])
 * and chat messages to sanitized HTML.
 *
 * Depends on `./parse` for `wikiLinkRegex`.
 */
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { wikiLinkRegex } from './parse';

// ---------------------------------------------------------------------------
// HTML attribute escaping
// ---------------------------------------------------------------------------

/**
 * Escape a string for safe insertion into an HTML attribute value.
 */
export function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ---------------------------------------------------------------------------
// Markdown → HTML (full note)
// ---------------------------------------------------------------------------

/**
 * Render a full note's markdown body to sanitized HTML.
 *
 * [[wiki links]] are rewritten to `<a class="wiki-link">` elements with a
 * `data-wikilink` attribute for client-side navigation.
 *
 * Security: DOMPurify strips script, style, iframe, form, object, embed tags
 * and all event-handler attributes.
 */
export function renderMarkdownToHtml(content: string): string {
  const withWikiAnchors = content.replace(
    wikiLinkRegex,
    (_match, target: string, alias?: string) => {
      const label = alias || target;
      return `<a class="wiki-link" href="#" data-wikilink="${escapeHtmlAttribute(target)}">${escapeHtmlAttribute(label)}</a>`;
    },
  );
  const html = marked.parse(withWikiAnchors, { async: false }) as string;
  // Security: deliberately does NOT add iframe to ALLOWED_TAGS — iframes introduce
  // clickjacking risk and are not needed for vault note rendering.
  return DOMPurify.sanitize(html, {
    ADD_ATTR: ['target', 'data-wikilink'],
    FORBID_TAGS: ['script', 'style', 'iframe', 'form', 'object', 'embed'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur'],
  });
}

// ---------------------------------------------------------------------------
// Block-level rendering (for inline block editing)
// ---------------------------------------------------------------------------

/** A single block of markdown content for inline editing. */
export interface MarkdownBlock {
  id: number;
  raw: string;
  type: string;
  isEditable: boolean;
}

/**
 * Split markdown body into blocks using marked.lexer().
 * Space tokens (blank lines) are included but marked non-editable.
 */
export function splitMarkdownBody(body: string): MarkdownBlock[] {
  const tokens = marked.lexer(body, { gfm: true });
  return tokens.map((token, index) => ({
    id: index,
    raw: token.raw,
    type: token.type,
    isEditable: token.type !== 'space',
  }));
}

/**
 * Render a single markdown block to HTML (with wiki link support).
 */
export function renderBlockToHtml(raw: string): string {
  const withWikiAnchors = raw.replace(wikiLinkRegex, (_match, target: string, alias?: string) => {
    const label = alias || target;
    return `<a class="wiki-link" href="#" data-wikilink="${escapeHtmlAttribute(target)}">${escapeHtmlAttribute(label)}</a>`;
  });
  const html = marked.parse(withWikiAnchors, { async: false }) as string;
  // Security: same restrictions as renderMarkdownToHtml — no iframe, no event handlers.
  return DOMPurify.sanitize(html, {
    ADD_ATTR: ['target', 'data-wikilink'],
    FORBID_TAGS: ['script', 'style', 'iframe', 'form', 'object', 'embed'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur'],
  });
}

// ---------------------------------------------------------------------------
// Chat markdown rendering
// ---------------------------------------------------------------------------

/**
 * Render markdown to HTML for chat messages.
 *
 * Unlike renderMarkdownToHtml, this does NOT rewrite [[wiki links]],
 * so chat replies don't trigger navigation. GFM features are enabled.
 */
export function renderChatMarkdownToHtml(content: string): string {
  const html = marked.parse(content, { async: false, gfm: true }) as string;
  return DOMPurify.sanitize(html, {
    ADD_ATTR: ['target', 'rel', 'src', 'alt'],
    FORBID_TAGS: ['style', 'script', 'iframe', 'form'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick'],
  });
}
