/**
 * Excalidraw diagram renderer.
 *
 * Scans a container for `<pre><code class="language-excalidraw">` blocks and replaces
 * them with rendered Excalidraw diagrams in view-only mode.
 *
 * The public entry point is `renderExcalidrawDiagrams(container)`.
 *
 * Follows the same pattern as MermaidRenderer.tsx but renders React components
 * imperatively via createRoot since Excalidraw is a React component.
 */

interface ExcalidrawSceneData {
  type?: string;
  version?: number;
  source?: string;
  elements?: unknown[];
  appState?: Record<string, unknown>;
}

/**
 * Check if a string looks like valid Excalidraw JSON.
 */
function isValidExcalidrawJson(text: string): boolean {
  try {
    const data = JSON.parse(text) as ExcalidrawSceneData;
    return (
      typeof data === 'object' &&
      data !== null &&
      (Array.isArray(data.elements) || data.type === 'excalidraw')
    );
  } catch {
    return false;
  }
}

/**
 * Parse Excalidraw JSON from a code block's text content.
 */
function parseExcalidrawJson(text: string): ExcalidrawSceneData | null {
  try {
    return JSON.parse(text) as ExcalidrawSceneData;
  } catch {
    return null;
  }
}

/**
 * Dynamically render the Excalidraw component into a DOM container.
 * Uses lazy dynamic imports so the Excalidraw bundle is only loaded when needed.
 */
async function renderExcalidrawIntoContainer(
  container: HTMLElement,
  sceneData: ExcalidrawSceneData,
): Promise<void> {
  try {
    const [{ Excalidraw }, { createRoot }] = await Promise.all([
      import('@excalidraw/excalidraw') as Promise<typeof import('@excalidraw/excalidraw')>,
      import('react-dom/client'),
    ]);

    const React = await import('react');

    const isDark = document.documentElement.dataset.theme === 'dark';
    const theme = isDark ? 'dark' : 'light';

    const root = createRoot(container);
    root.render(
      React.createElement(Excalidraw, {
        initialData: {
          elements: sceneData.elements as never,
          appState: {
            ...(sceneData.appState || {}),
            viewModeEnabled: true,
          } as Record<string, unknown>,
          scrollToContent: true,
        } as never,
        viewModeEnabled: true,
        theme,
        UIOptions: {
          canvasActions: {
            changeViewBackgroundColor: false,
            clearCanvas: false,
            export: false,
            loadScene: false,
            saveToActiveFile: false,
            toggleTheme: false,
            saveAsImage: false,
          },
        } as never,
      }),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    container.innerHTML = `<div class="excalidraw-error">Excalidraw render error: ${escapeHtml(message)}</div>`;
  }
}

/**
 * Find all un-rendered excalidraw code blocks inside `container` and replace
 * them with rendered view-only Excalidraw diagrams.
 *
 * Blocks that have already been rendered (marked with `data-excalidraw-rendered`)
 * are skipped, making this safe to call repeatedly as the DOM updates.
 *
 * @param container - The DOM element to scan for excalidraw blocks.
 */
export async function renderExcalidrawDiagrams(container: HTMLElement): Promise<void> {
  const blocks = container.querySelectorAll<HTMLElement>('pre code.language-excalidraw');
  const promises: Promise<void>[] = [];

  for (const block of blocks) {
    const pre = block.closest('pre');
    if (!pre || pre.dataset.excalidrawRendered === 'true') continue;

    const code = block.textContent || '';
    if (!isValidExcalidrawJson(code)) continue;

    // Mark immediately so concurrent calls don't double-render
    pre.dataset.excalidrawRendered = 'true';

    // Create a container div for the Excalidraw component
    const renderContainer = document.createElement('div');
    renderContainer.className = 'excalidraw-container rendered';
    renderContainer.dataset.excalidrawRendered = 'true';
    renderContainer.style.minHeight = '300px';

    // Replace the pre element with our container
    pre.parentNode?.replaceChild(renderContainer, pre);

    const sceneData = parseExcalidrawJson(code);
    if (sceneData) {
      promises.push(renderExcalidrawIntoContainer(renderContainer, sceneData));
    }
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
