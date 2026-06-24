/**
 * Mermaid diagram renderer.
 *
 * Scans a container for `<pre><code class="language-mermaid">` blocks and replaces
 * them with rendered SVG diagrams using the mermaid library.
 *
 * The public entry point is `renderMermaidDiagrams(container, theme)`.
 */

import mermaid from 'mermaid';

/** Track the last theme we initialized mermaid with to avoid redundant calls. */
let lastTheme: string | null = null;

/**
 * Initialize mermaid with the given theme if it has changed since last init.
 * Uses `startOnLoad: false` because we trigger rendering manually.
 */
function initMermaid(theme: 'dark' | 'light'): void {
  const mermaidTheme = theme === 'dark' ? 'dark' : 'default';
  if (lastTheme === mermaidTheme) return;

  mermaid.initialize({
    startOnLoad: false,
    theme: mermaidTheme,
  });
  lastTheme = mermaidTheme;
}

/**
 * Find all un-rendered mermaid code blocks inside `container` and replace
 * them with rendered SVG diagrams.
 *
 * Blocks that have already been rendered (marked with `data-mermaid-rendered`)
 * are skipped, making this safe to call repeatedly as the DOM updates.
 *
 * @param container - The DOM element to scan for mermaid blocks.
 * @param theme     - Resolved theme (`'dark'` or `'light'`).
 */
export async function renderMermaidDiagrams(
  container: HTMLElement,
  theme: 'dark' | 'light',
): Promise<void> {
  initMermaid(theme);

  const blocks = container.querySelectorAll<HTMLElement>('pre code.language-mermaid');
  const promises: Promise<void>[] = [];

  for (const block of blocks) {
    const pre = block.closest('pre');
    if (!pre || pre.dataset.mermaidRendered === 'true') continue;

    // Mark immediately so concurrent calls don't double-render
    pre.dataset.mermaidRendered = 'true';

    const code = block.textContent || '';
    // Unique id per diagram required by mermaid
    const id = `av-mermaid-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    const promise = mermaid
      .render(id, code)
      .then(({ svg }) => {
        pre!.innerHTML = svg;
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        pre!.innerHTML = `<div class="mermaid-error">Mermaid diagram error: ${escapeHtml(message)}</div>`;
      });

    promises.push(promise);
  }

  await Promise.all(promises);
}

/** Minimal HTML-entity escaping for error messages shown in the DOM. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
