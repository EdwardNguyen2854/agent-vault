import type { EditorMode, ViewMode } from '../types';

const PREFS_KEY = 'agent-vault-preferences';
const LAST_VAULT_KEY = 'agent-vault-last-vault';
const THEME_KEY = 'agent-vault-theme';
const AGENT_MODEL_KEY = 'agent-vault-agent-models';
const TASKS_VIEW_KEY = 'agent-vault-tasks-view';

export type TasksViewMode = 'kanban' | 'list' | 'table';

export type ThemeMode = 'light' | 'dark' | 'system';

const VALID_VIEWS: ViewMode[] = [
  'dashboard',
  'editor',
  'graph',
  'tasks',
  'tags',
  'agents',
  'context',
  'docs',
  'roadmap',
  'release',
  'about',
  'settings',
  'chat',
  'skills',
  'memory',
  'tools',
  'agent-runs',
];

export function loadPreferences(): { editorMode: EditorMode; view: ViewMode } {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return { editorMode: 'split', view: 'dashboard' };
    const parsed = JSON.parse(raw);
    return {
      editorMode:
        parsed.editorMode === 'edit' ||
        parsed.editorMode === 'preview' ||
        parsed.editorMode === 'split'
          ? parsed.editorMode
          : 'split',
      view: VALID_VIEWS.includes(parsed.view) ? parsed.view : 'dashboard',
    };
  } catch {
    return { editorMode: 'split', view: 'dashboard' };
  }
}

export function savePreferences(prefs: { editorMode: EditorMode; view: ViewMode }): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Silently ignore storage errors (quota exceeded, private mode, etc.)
  }
}

export function loadTheme(): ThemeMode {
  try {
    const raw = localStorage.getItem(THEME_KEY);
    if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
    return 'system';
  } catch {
    return 'system';
  }
}

export function saveTheme(theme: ThemeMode): void {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Silently ignore storage errors
  }
}

export function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function loadLastVaultName(): string | null {
  try {
    return localStorage.getItem(LAST_VAULT_KEY);
  } catch {
    return null;
  }
}

export function saveLastVaultName(name: string): void {
  try {
    localStorage.setItem(LAST_VAULT_KEY, name);
  } catch {
    // Silently ignore storage errors
  }
}

export function clearLastVaultName(): void {
  try {
    localStorage.removeItem(LAST_VAULT_KEY);
  } catch {
    // Silently ignore storage errors
  }
}

export function loadAgentModels(): Record<string, string> {
  try {
    const raw = localStorage.getItem(AGENT_MODEL_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function saveAgentModel(noteKey: string, model: string): void {
  try {
    const all = loadAgentModels();
    all[noteKey] = model;
    localStorage.setItem(AGENT_MODEL_KEY, JSON.stringify(all));
  } catch {
    // Silently ignore storage errors
  }
}

export function loadTasksView(): TasksViewMode {
  try {
    const raw = localStorage.getItem(TASKS_VIEW_KEY);
    if (raw === 'kanban' || raw === 'list' || raw === 'table') return raw;
    return 'list';
  } catch {
    return 'list';
  }
}

export function saveTasksView(mode: TasksViewMode): void {
  try {
    localStorage.setItem(TASKS_VIEW_KEY, mode);
  } catch {
    // Silently ignore storage errors
  }
}
