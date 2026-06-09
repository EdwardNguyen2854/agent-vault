import type { KeyboardEvent as ReactKeyboardEvent } from 'react';

type MarkdownShortcutEvent = ReactKeyboardEvent<HTMLTextAreaElement>;

interface ShortcutFormat {
  prefix: string;
  suffix: string;
  placeholder: string;
}

const shortcutFormats: Record<string, ShortcutFormat> = {
  b: { prefix: '**', suffix: '**', placeholder: 'bold text' },
  i: { prefix: '*', suffix: '*', placeholder: 'italic text' },
  '`': { prefix: '`', suffix: '`', placeholder: 'code' },
  x: { prefix: '~~', suffix: '~~', placeholder: 'strikethrough' },
};

function isMacModifier(event: MarkdownShortcutEvent): boolean {
  return event.metaKey && !event.ctrlKey;
}

function isControlModifier(event: MarkdownShortcutEvent): boolean {
  return event.ctrlKey && !event.metaKey;
}

function unwrapSelection(selection: string, format: ShortcutFormat): string | null {
  if (format.prefix === '*' && (selection.startsWith('**') || selection.endsWith('**')))
    return null;
  if (selection.startsWith(format.prefix) && selection.endsWith(format.suffix)) {
    return selection.slice(format.prefix.length, selection.length - format.suffix.length);
  }
  return null;
}

function hasSurroundingDelimiters(
  value: string,
  start: number,
  end: number,
  format: ShortcutFormat,
): boolean {
  return (
    value.slice(start - format.prefix.length, start) === format.prefix &&
    value.slice(end, end + format.suffix.length) === format.suffix
  );
}

export function handleMarkdownShortcut(
  event: MarkdownShortcutEvent,
  value: string,
  onChange: (nextValue: string) => void,
): boolean {
  const usesModifier = isMacModifier(event) || isControlModifier(event);
  if (!usesModifier || event.altKey) return false;

  const key = event.key.toLowerCase();
  if (key === 'x' && !event.shiftKey) return false;
  if (key !== 'x' && event.shiftKey) return false;

  const format = shortcutFormats[key];
  if (!format) return false;

  const textarea = event.currentTarget;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selection = value.slice(start, end);

  if (selection && hasSurroundingDelimiters(value, start, end, format)) {
    const replacementStart = start - format.prefix.length;
    const replacementEnd = end + format.suffix.length;
    const nextValue = `${value.slice(0, replacementStart)}${selection}${value.slice(replacementEnd)}`;

    event.preventDefault();
    onChange(nextValue);

    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(replacementStart, replacementStart + selection.length);
    });

    return true;
  }

  const unwrapped = selection ? unwrapSelection(selection, format) : null;
  const replacement =
    unwrapped ?? `${format.prefix}${selection || format.placeholder}${format.suffix}`;
  const nextValue = `${value.slice(0, start)}${replacement}${value.slice(end)}`;
  const nextSelectionStart = unwrapped === null ? start + format.prefix.length : start;
  const nextSelectionEnd =
    unwrapped === null
      ? nextSelectionStart + (selection || format.placeholder).length
      : start + replacement.length;

  event.preventDefault();
  onChange(nextValue);

  requestAnimationFrame(() => {
    textarea.focus();
    textarea.setSelectionRange(nextSelectionStart, nextSelectionEnd);
  });

  return true;
}
