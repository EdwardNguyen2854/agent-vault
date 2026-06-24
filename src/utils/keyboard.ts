type Modifier = 'ctrl' | 'meta' | 'alt';

interface ShortcutEntry {
  key: string;
  modifier: Modifier;
  shift: boolean;
  callback: () => void;
}

const shortcuts: ShortcutEntry[] = [];

/**
 * Register a global keyboard shortcut.
 * Returns an unsubscribe function for cleanup.
 */
export function registerShortcut(
  key: string,
  modifier: Modifier,
  callback: () => void,
  shift?: boolean,
): () => void {
  const entry: ShortcutEntry = { key: key.toLowerCase(), modifier, shift: shift ?? false, callback };
  shortcuts.push(entry);

  return () => {
    const index = shortcuts.indexOf(entry);
    if (index !== -1) {
      shortcuts.splice(index, 1);
    }
  };
}

/**
 * Handle keydown event for registered shortcuts.
 * Returns true if a shortcut was handled.
 */
export function handleKeyboardEvent(event: KeyboardEvent): boolean {
  const key = event.key.toLowerCase();
  const modifier = event.ctrlKey ? 'ctrl' : event.metaKey ? 'meta' : event.altKey ? 'alt' : null;

  if (!modifier) return false;

  for (const shortcut of shortcuts) {
    if (
      shortcut.key === key &&
      shortcut.modifier === modifier &&
      shortcut.shift === event.shiftKey
    ) {
      event.preventDefault();
      shortcut.callback();
      return true;
    }
  }

  return false;
}

/**
 * Unregister all shortcuts. Call on app unmount.
 */
export function unregisterAll(): void {
  shortcuts.length = 0;
}

/**
 * Check if we're on a Mac (for platform-specific shortcut handling).
 */
export function isMac(): boolean {
  return typeof navigator !== 'undefined' && navigator.platform.toLowerCase().includes('mac');
}

/**
 * Get the display label for a modifier key (Ctrl on Windows/Linux, Cmd on Mac).
 */
export function getModifierLabel(): string {
  return isMac() ? 'Cmd' : 'Ctrl';
}
