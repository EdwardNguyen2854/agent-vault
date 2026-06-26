import { Check, ChevronRight, PencilLine, X } from 'lucide-react';
import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { splitRawFrontmatter, splitFrontmatter } from '../utils/markdown/parse';
import { renderMarkdownToHtml, splitMarkdownBody, renderBlockToHtml } from '../utils/markdown/render';
import { handleMarkdownShortcut } from '../utils/markdownShortcuts';
import { renderMermaidDiagrams } from './MermaidRenderer';
import { renderExcalidrawDiagrams } from './ExcalidrawRenderer';

interface MarkdownPreviewProps {
  content: string;
  showProperties?: boolean;
  onOpenWikiLink: (target: string) => void;
  /** If provided, enables inline block editing (double-click block → edit in place) */
  onDraftChange?: (value: string) => void;
}

interface RenderedBlock {
  id: number;
  raw: string;
  type: string;
  html: string;
  isEditable: boolean;
}

function propertyLabel(key: string): string {
  return key.replace(/[-_]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function getRawPropertyBody(raw: string): string {
  return raw
    .replace(/^---\n?/, '')
    .replace(/\n?---\s*$/, '')
    .trim();
}

function parsePropertyRows(raw: string): {
  rows: { key: string; values: string[] }[];
  rawBody: string;
  complex: boolean;
} {
  const rawBody = getRawPropertyBody(raw);
  const complex = rawBody.split('\n').some((line) => {
    if (!line.trim()) return false;
    if (/^\s/.test(line)) return true;
    const value = line.split(':').slice(1).join(':').trim();
    return value === '|' || value === '>';
  });

  if (complex) return { rows: [], rawBody, complex: true };

  const { frontmatter } = splitFrontmatter(`${raw}\n`);
  const rows = Object.entries(frontmatter)
    .map(([key, value]) => ({
      key,
      values: Array.isArray(value) ? value : [value],
    }))
    .filter((row) => row.values.some((value) => value.trim().length > 0));
  return { rows, rawBody, complex: false };
}

function PropertiesBlock({ raw, showProperties }: { raw: string; showProperties?: boolean }) {
  const { rows, rawBody, complex } = parsePropertyRows(raw);
  const [hidden, setHidden] = useState(!showProperties);
  if (!rows.length && !rawBody) return null;

  return (
    <section
      className={`properties-disclosure${hidden ? ' properties-hidden' : ''}`}
      aria-label="Note properties"
    >
      <button
        className="properties-disclosure-header"
        type="button"
        onClick={() => setHidden((v) => !v)}
      >
        <ChevronRight
          className={`properties-chevron${hidden ? '' : ' is-open'}`}
          size={12}
          aria-hidden="true"
        />
        <span>Properties</span>
      </button>
      {!hidden &&
        (complex ? (
          <pre className="properties-raw">
            <code>{rawBody}</code>
          </pre>
        ) : (
          <dl className="properties-grid">
            {rows.map((row) => (
              <div className="property-row" key={row.key}>
                <dt>{propertyLabel(row.key)}</dt>
                <dd>
                  {row.values.length > 1 ? (
                    row.values.map((value, index) => (
                      <span className="property-chip" key={`${row.key}-${index}-${value}`}>
                        {value}
                      </span>
                    ))
                  ) : (
                    <span className="property-value">{row.values[0]}</span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        ))}
    </section>
  );
}

/**
 * Parse full markdown content into an array of rendered blocks.
 * First block is frontmatter (if present), followed by body blocks from marked.lexer().
 */
function parseBlocks(content: string): RenderedBlock[] {
  const { rawFrontmatter, body } = splitRawFrontmatter(content);
  const bodyBlocks = splitMarkdownBody(body);
  const blocks: RenderedBlock[] = [];
  let id = 0;

  // Frontmatter block
  if (rawFrontmatter) {
    blocks.push({
      id: id++,
      raw: rawFrontmatter,
      type: 'frontmatter',
      html: renderBlockToHtml(rawFrontmatter),
      isEditable: false,
    });
  }

  // Body blocks
  for (const b of bodyBlocks) {
    blocks.push({
      id: id++,
      raw: b.raw,
      type: b.type,
      html: renderBlockToHtml(b.raw),
      isEditable: b.isEditable,
    });
  }

  return blocks;
}

export function MarkdownPreview({
  content,
  showProperties = true,
  onOpenWikiLink,
  onDraftChange,
}: MarkdownPreviewProps) {
  const canEdit = typeof onDraftChange === 'function';

  // Parse content into blocks (memoized on content)
  const blocks = useMemo<RenderedBlock[]>(() => {
    if (!canEdit) {
      // Fallback: single monolithic block
      return [
        {
          id: 0,
          raw: content,
          type: 'full',
          html: renderMarkdownToHtml(content),
          isEditable: false,
        },
      ];
    }
    return parseBlocks(content);
  }, [content, canEdit]);

  // --- Inline editing state ---
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Reset editing when content changes externally
  useEffect(() => {
    setEditingId(null);
  }, [content]);

  // Auto-focus and place cursor at end
  useEffect(() => {
    if (editingId !== null && textareaRef.current) {
      textareaRef.current.focus();
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
    }
  }, [editingId]);

  useEffect(() => {
    if (editingId === null || !textareaRef.current) return;
    textareaRef.current.style.height = 'auto';
    textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
  }, [editingId, editValue]);

  const startEditing = useCallback((block: RenderedBlock) => {
    if (!block.isEditable) return;
    setEditingId(block.id);
    setEditValue(block.raw);
  }, []);

  const finishEditing = useCallback(() => {
    if (editingId === null) return;
    const block = blocks.find((b) => b.id === editingId);
    if (!block) {
      setEditingId(null);
      return;
    }

    // Only propagate if content actually changed
    if (editValue !== block.raw) {
      // Reconstruct full content from all blocks
      const newContent = blocks
        .map((b) => (b.id === editingId ? { ...b, raw: editValue } : b))
        .map((b) => b.raw)
        .join('');
      onDraftChange!(newContent);
    }
    setEditingId(null);
  }, [editingId, editValue, blocks, onDraftChange]);

  const cancelEditing = useCallback(() => {
    setEditingId(null);
  }, []);

  const handleTextareaKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (handleMarkdownShortcut(event, editValue, setEditValue)) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        cancelEditing();
      }
      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        finishEditing();
      }
    },
    [cancelEditing, finishEditing],
  );

  const handleTextareaBlur = useCallback(
    (event: React.FocusEvent<HTMLTextAreaElement>) => {
      const nextFocus = event.relatedTarget as Node | null;
      if (nextFocus && event.currentTarget.parentElement?.contains(nextFocus)) return;
      finishEditing();
    },
    [finishEditing],
  );

  const handleBlockClick = useCallback(
    (event: React.MouseEvent, block: RenderedBlock) => {
      // Handle wiki link clicks (single click navigates)
      const element = event.target as HTMLElement;
      const link = element.closest('[data-wikilink]') as HTMLElement | null;
      if (link) {
        event.preventDefault();
        const target = link.dataset.wikilink;
        if (target) onOpenWikiLink(target);
      }
    },
    [onOpenWikiLink],
  );

  const handleBlockDoubleClick = useCallback(
    (event: React.MouseEvent, block: RenderedBlock) => {
      if (!block.isEditable) return;
      const element = event.target as HTMLElement;
      // Don't trigger if user double-clicked a wiki link or interactive element
      if (element.closest('[data-wikilink]')) return;
      const tag = (element.tagName || '').toLowerCase();
      if (['a', 'button', 'input', 'select', 'textarea'].includes(tag)) return;
      startEditing(block);
    },
    [startEditing],
  );

  const handleBlockKeyDown = useCallback(
    (event: React.KeyboardEvent, block: RenderedBlock) => {
      if (event.key !== 'Enter' && event.key !== 'F2') return;
      event.preventDefault();
      startEditing(block);
    },
    [startEditing],
  );

  // --- Mermaid diagram rendering ---
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const isDark = document.documentElement.dataset.theme === 'dark';
    const raf = requestAnimationFrame(() => {
      renderMermaidDiagrams(el, isDark ? 'dark' : 'light');
    });
    return () => cancelAnimationFrame(raf);
  }, [content]);

  // --- Excalidraw diagram rendering ---
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const raf = requestAnimationFrame(() => {
      renderExcalidrawDiagrams(el);
    });
    return () => cancelAnimationFrame(raf);
  }, [content]);

  // --- Fallback: non-editable mode (render full HTML) ---
  if (!canEdit) {
    return (
      <div ref={containerRef}>
        <article
          className="markdown-preview"
          onClick={(e) => {
            void handleBlockClick(e, blocks[0]);
          }}
          dangerouslySetInnerHTML={{ __html: blocks[0]?.html ?? '' }}
        />
      </div>
    );
  }

  // --- Inline block editing mode ---
  return (
    <div ref={containerRef} className="markdown-preview markdown-preview-blocks">
      {blocks.map((block) => {
        // Block being edited → show textarea
        if (block.id === editingId) {
          return (
            <div key={block.id} className="md-block md-block-editing">
              <div className="inline-edit-toolbar">
                <span>
                  <PencilLine size={13} /> Editing block
                </span>
                <div className="inline-edit-actions">
                  <button
                    type="button"
                    className="inline-edit-action"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={cancelEditing}
                    aria-label="Cancel block edit"
                    title="Cancel edit"
                  >
                    <X size={12} />
                  </button>
                  <button
                    type="button"
                    className="inline-edit-action primary"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={finishEditing}
                    aria-label="Save block edit"
                    title="Save edit"
                  >
                    <Check size={12} />
                  </button>
                </div>
              </div>
              <textarea
                ref={textareaRef}
                className="markdown-editor markdown-editor-inline"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={handleTextareaBlur}
                onKeyDown={handleTextareaKeyDown}
                spellCheck={false}
                placeholder="Write markdown..."
                aria-label="Edit block"
              />
              <div className="inline-edit-hint">
                <kbd>Esc</kbd> cancel · <kbd>Ctrl+Enter</kbd> save
              </div>
            </div>
          );
        }

        // Non-editable block (space separators)
        if (!block.isEditable && block.type === 'space') {
          return <div key={block.id} className="md-block md-block-space" />;
        }

        // Non-editable rendered block (frontmatter)
        if (!block.isEditable) {
          if (block.type === 'frontmatter') {
            return (
              <div key={block.id} className="md-block md-block-frontmatter">
                <PropertiesBlock raw={block.raw} showProperties={showProperties} />
              </div>
            );
          }

          return (
            <div
              key={block.id}
              className={`md-block md-block-${block.type}`}
              dangerouslySetInnerHTML={{ __html: block.html }}
            />
          );
        }

        // Editable rendered block
        return (
          <div
            key={block.id}
            className={`md-block md-block-${block.type} is-editable`}
            role="button"
            tabIndex={0}
            aria-label={`Edit ${block.type} block`}
            onClick={(e) => handleBlockClick(e, block)}
            onDoubleClick={(e) => handleBlockDoubleClick(e, block)}
            onKeyDown={(e) => handleBlockKeyDown(e, block)}
          >
            <div className="md-block-content" dangerouslySetInnerHTML={{ __html: block.html }} />
            <span className="md-block-edit-hint" aria-hidden="true">
              <PencilLine size={12} />
            </span>
          </div>
        );
      })}
    </div>
  );
}
