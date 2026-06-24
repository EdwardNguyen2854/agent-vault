import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { FolderOpen, Lock, Sparkles } from 'lucide-react';
import { NoteTabs } from './components/NoteTabs';
import type {
  ChatAgentBusyState,
  EditorMode,
  MemoryType,
  TaskConversationMeta,
  TaskItem,
  VaultFolder,
  VaultNote,
  VaultStats,
  ViewMode,
} from './types';
import {
  buildBacklinks,
  buildGraphData,
  getBrokenLinks,
  getOrphanNotes,
  getWorkspaceEntityNotes,
  parseNoteContent,
  resolveLinkTarget,
} from './utils/markdown';
import {
  clearLastVaultName,
  loadPreferences,
  savePreferences,
  saveLastVaultName,
  loadTheme,
  saveTheme,
  getSystemTheme,
} from './utils/preferences';
import type { ThemeMode } from './utils/preferences';
import { pathExists, validateVaultPath } from './utils/paths';
import {
  agentVaultSource,
  appendToMemoryNote,
  canWriteVaultNote,
  compareVaultPaths,
  createDirectory,
  createNote,
  deleteDirectory,
  deleteNote,
  deriveVaultFolders,
  findAgentFolderNoteFiles,
  getStarterVaultTemplates,
  loadNotes,
  queryReadPermission,
  queryWritePermission,
  renameNote,
  saveMemoryNote,
  verifyPermission,
  writeNote,
  writeStarterVault,
} from './utils/vault';
import type { StarterVaultTemplate, VaultSource } from './utils/vault';
import {
  clearSavedVaults,
  getDefaultPersonalVault,
  getSavedVault,
  listSavedVaults,
  reconcileDefaultPersonalVault,
  saveVaultHandle,
  savedVaultToSource,
  setDefaultPersonalVault,
} from './utils/vaultRegistry';
import type { SavedVault } from './utils/vaultRegistry';
import { getNoteKey } from './utils/noteKey';
import {
  loadEntityTags,
  saveEntityTags,
  applyFolderTags,
  getVaultTaggedEntities,
  getFileTaggedEntities,
  emptyManifest,
} from './utils/entityTags';
import type { EntityTagsManifest, TaggedEntity } from './utils/entityTags';
import { Supergraphic } from './components/Supergraphic';
import { CommandCenter } from './components/CommandCenter';
import { Dashboard } from './components/Dashboard';
import { EditorPane } from './components/EditorPane';
import { EmptyState } from './components/EmptyState';
import { FileTree } from './components/FileTree';
import { GraphView } from './components/GraphView';
import { NoteActionDialog } from './components/NoteActionDialog';
import { SettingsView } from './components/SettingsView';
import { Sidebar } from './components/Sidebar';
import { TagsView } from './components/TagsView';
import { TasksView } from './components/TasksView';
import { TopBar } from './components/TopBar';
import { AgentsView } from './components/AgentsView';
import { ContextView } from './components/ContextView';
import { AboutPage, DocumentationPage, ReleasePage, RoadmapPage } from './components/ProductPages';
import { registerShortcut, unregisterAll, handleKeyboardEvent, isMac } from './utils/keyboard';
import type { ToolPermission } from './types';
import { ChatPanel } from './components/ChatPanel';
import { SkillsView } from './components/SkillsView';
import { MemoryView } from './components/MemoryView';
import { ToolsView } from './components/ToolsView';
import { AgentRunsView } from './components/AgentRunsView';
import { addBridgeServer, invokeBridgeTool } from './utils/bridgeClient';
import {
  MARKITDOWN_SERVER_NAME,
  getMarkitdownServerConfig,
  seedMarkitdownServer,
} from './utils/mcp';
import { TaskQueue } from './components/TaskQueue';
import {
  canAppendToMemoryNote,
  getMemoryMetadata,
  getUniqueMemoryPath,
  isMemoryNote,
  memoryMatchesTarget,
  saveToMemory,
} from './utils/memory';
import { isToolNote, loadToolMetadata } from './utils/tools';
import { createAgentRun } from './utils/agentRuns';
import {
  ensureTaskConversation,
  loadTaskConversationMeta,
  pruneTaskConversationMeta,
  updateTaskConversationAgentState,
} from './utils/taskConversations';
import {
  loadChatSessions,
  markSessionSaved,
  serializeSessionAsMarkdown,
} from './utils/chatHistory';
import {
  clampChatDockedWidth,
  loadAgentRunsSettings,
  loadChatSettings,
  loadMemorySettings,
  loadPropertiesSettings,
  saveChatSettings,
  savePropertiesSettings,
} from './utils/settings';
import { setToolPermissionOverride } from './utils/permissions';
import type { ChatLayout, ChatSettings } from './utils/settings';
import './styles.css';

interface MountedVault {
  handle: FileSystemDirectoryHandle;
  source: VaultSource;
  writeGranted: boolean;
}

function normalizeFolderPath(input: string): string {
  return input
    .replace(/\\/g, '/')
    .replace(/^\/+|\/+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function validateFolderPath(input: string): { valid: boolean; path?: string; error?: string } {
  const normalized = normalizeFolderPath(input);
  if (!normalized) return { valid: false, error: 'Folder path cannot be empty.' };
  if (normalized.includes('..')) return { valid: false, error: 'Path traversal is not allowed.' };
  if (/[<>:"|?*\x00-\x1f]/.test(normalized))
    return { valid: false, error: 'Folder path contains invalid characters.' };
  if (normalized.split('/').some((part) => !part.trim()))
    return { valid: false, error: 'Folder path contains an empty segment.' };
  return { valid: true, path: normalized };
}

function getVaultRoleLabel(role: VaultNote['vaultRole']): string {
  if (role === 'agent') return 'Agent Vault';
  if (role === 'personal') return 'Personal vault';
  return 'Shared vault';
}

async function isSameDirectoryHandle(
  a: FileSystemDirectoryHandle,
  b: FileSystemDirectoryHandle,
): Promise<boolean> {
  if (a.isSameEntry) {
    try {
      return await a.isSameEntry(b);
    } catch {
      return false;
    }
  }
  return a.name === b.name;
}

function replaceFrontmatterValue(content: string, key: string, value: string): string {
  const line = `${key}: ${value}`;
  if (!content.startsWith('---\n')) return `---\n${line}\n---\n\n${content}`;
  const end = content.indexOf('\n---', 4);
  if (end === -1) return `---\n${line}\n---\n\n${content}`;
  const raw = content.slice(4, end);
  const body = content.slice(end);
  const lines = raw.split('\n');
  const index = lines.findIndex((frontmatterLine) => frontmatterLine.split(':')[0].trim() === key);
  if (index >= 0) lines[index] = line;
  else lines.push(line);
  return `---\n${lines.join('\n').trim()}\n${body}`;
}

function sanitizePathSegment(input: string): string {
  return (
    input
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80) || 'Untitled'
  );
}

function ensureMdExtension(path: string): string {
  return /\.md$/i.test(path) ? path : `${path}.md`;
}

function deriveTitleFromUri(uri: string): string {
  try {
    if (/^https?:\/\//i.test(uri)) {
      const url = new URL(uri);
      const last = url.pathname.split('/').filter(Boolean).pop();
      if (last) return decodeURIComponent(last);
      return url.hostname;
    }
    if (uri.startsWith('file://')) {
      uri = uri.slice('file://'.length);
    }
    const segments = uri.split(/[\\/]/).filter(Boolean);
    const last = segments[segments.length - 1];
    return last ? last.replace(/\.[^.]+$/, '') : 'Converted';
  } catch {
    return 'Converted';
  }
}

function inferFolderFromUri(uri: string): string | null {
  try {
    if (/^https?:\/\//i.test(uri)) {
      const url = new URL(uri);
      const segments = url.pathname.split('/').filter(Boolean);
      if (segments.length <= 1) return null;
      segments.pop();
      return `Inbox/Imports/${url.hostname}/${segments.join('/')}`;
    }
    let path = uri.startsWith('file://') ? uri.slice('file://'.length) : uri;
    path = path.replace(/^\/+/, '');
    const segments = path.split(/[\\/]/).filter(Boolean);
    if (segments.length <= 1) return null;
    const file = segments.pop();
    if (!file) return null;
    const folder = segments.join('/');
    if (!folder) return null;
    if (/(^|\/)starter-kit($|\/)/i.test(folder)) return folder;
    if (/(^|\/)starter kit($|\/)/i.test(folder)) return folder;
    return folder;
  } catch {
    return null;
  }
}

function getUniqueNotePath(existingNotes: VaultNote[], requestedPath: string): string {
  const normalized = ensureMdExtension(requestedPath.replace(/^\/+/, ''));
  if (!pathExists(existingNotes, normalized)) return normalized;
  const dot = normalized.lastIndexOf('.');
  const base = dot >= 0 ? normalized.slice(0, dot) : normalized;
  const ext = dot >= 0 ? normalized.slice(dot) : '.md';
  for (let index = 2; index < 10_000; index += 1) {
    const candidate = `${base} ${index}${ext}`;
    if (!pathExists(existingNotes, candidate)) return candidate;
  }
  return `${base} ${Date.now()}${ext}`;
}

export default function App() {
  const [personalVaults, setPersonalVaults] = useState<MountedVault[]>([]);
  const [sharedVaults, setSharedVaults] = useState<MountedVault[]>([]);
  const [agentVaults, setAgentVaults] = useState<MountedVault[]>([]);
  const APP_VERSION = '0.1.0';
  const [savedVaults, setSavedVaults] = useState<SavedVault[]>([]);
  const starterVaults = useMemo<StarterVaultTemplate[]>(() => getStarterVaultTemplates(), []);
  const [notes, setNotes] = useState<VaultNote[]>([]);
  const [folders, setFolders] = useState<VaultFolder[]>([]);
  const [entityTagsData, setEntityTagsData] = useState<Record<string, EntityTagsManifest>>({});
  const [selectedKey, setSelectedKey] = useState<string | undefined>();
  const [view, setView] = useState<ViewMode>(() => loadPreferences().view);
  const [editorMode, setEditorMode] = useState<EditorMode>(() => loadPreferences().editorMode);
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState('');
  const [dirty, setDirty] = useState(false);
  const [openTabs, setOpenTabs] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('openTabs');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [draftsMap, setDraftsMap] = useState<Record<string, string>>({});
  const [dirtyTabsMap, setDirtyTabsMap] = useState<Record<string, boolean>>({});
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [noteActionDialog, setNoteActionDialog] = useState<{
    mode: 'create' | 'rename' | 'delete';
    open: boolean;
  }>({ mode: 'create', open: false });
  const [noteActionTarget, setNoteActionTarget] = useState<VaultNote | undefined>();
  const [tagEditorState, setTagEditorState] = useState<{
    open: boolean;
    vaultId: string;
    folderPath: string;
    currentTags: string[];
  }>({ open: false, vaultId: '', folderPath: '', currentTags: [] });
  const [createNoteFolder, setCreateNoteFolder] = useState('');
  const [pendingCreateVaultId, setPendingCreateVaultId] = useState<string | null>(null);
  const [pendingRenameVaultId, setPendingRenameVaultId] = useState<string | null>(null);
  const [pendingDeleteVaultId, setPendingDeleteVaultId] = useState<string | null>(null);
  const [pendingFolderActionVaultId, setPendingFolderActionVaultId] = useState<string | null>(null);
  const [pendingFolderParentPath, setPendingFolderParentPath] = useState<string>('');
  const [personalPickerOpen, setPersonalPickerOpen] = useState<{
    mode: 'create-note' | 'create-folder';
  } | null>(null);
  const [status, setStatus] = useState('Open a local folder to start editing real markdown files.');
  const [sidebarMinimized, setSidebarMinimized] = useState(false);
  const [fileTreeVisible, setFileTreeVisible] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<ThemeMode>(() => loadTheme());
  const [showProperties, setShowProperties] = useState(
    () => loadPropertiesSettings().showProperties,
  );
  const [expandFileTree, setExpandFileTree] = useState(
    () => loadPropertiesSettings().expandFileTree,
  );
  const [chatSettings, setChatSettings] = useState<ChatSettings>(() => loadChatSettings());

  // v2 State: Tool permissions
  const [toolPermissions, setToolPermissions] = useState<Record<string, ToolPermission>>({});

  // v2 State: Chat panel output handling
  const [chatContextNote, setChatContextNote] = useState<VaultNote | null>(null);
  const [chatPrefill, setChatPrefill] = useState<{ agentKey: string; prompt: string } | null>(null);
  const [taskConversationMeta, setTaskConversationMeta] = useState<
    Record<string, TaskConversationMeta>
  >(() => loadTaskConversationMeta());
  const [activeTaskConversationRequest, setActiveTaskConversationRequest] = useState<{
    sessionId: string;
    task: TaskItem;
    agentKey: string;
    agentName: string;
    requestId: number;
  } | null>(null);
  const [agentBusyState, setAgentBusyState] = useState<ChatAgentBusyState>('idle');
  const [activeAgentSessionId, setActiveAgentSessionId] = useState<string | null>(null);

  // v2 State: Vault needs write grant (read-only mounted, awaiting user gesture)
  const [needsWriteGrant, setNeedsWriteGrant] = useState<{ id: string; name: string } | null>(null);
  const [grantingWrite, setGrantingWrite] = useState(false);
  const markitdownSeedRef = useRef(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const changeTheme = useCallback((theme: ThemeMode) => {
    saveTheme(theme);
    setCurrentTheme(theme);
    const resolved: 'light' | 'dark' = theme === 'system' ? getSystemTheme() : theme;
    document.documentElement.dataset.theme = resolved;
  }, []);

  const cycleTheme = useCallback(() => {
    const order: ThemeMode[] = ['light', 'dark', 'system'];
    const currentIndex = order.indexOf(currentTheme);
    const nextTheme = order[(currentIndex + 1) % order.length];
    changeTheme(nextTheme);
  }, [currentTheme, changeTheme]);

  const handleShowPropertiesChange = useCallback(
    (value: boolean) => {
      savePropertiesSettings({ showProperties: value, expandFileTree });
      setShowProperties(value);
    },
    [expandFileTree],
  );

  const handleExpandFileTreeChange = useCallback(
    (value: boolean) => {
      savePropertiesSettings({ showProperties, expandFileTree: value });
      setExpandFileTree(value);
    },
    [showProperties],
  );

  const updateChatSettings = useCallback((updater: (settings: ChatSettings) => ChatSettings) => {
    setChatSettings((current) => {
      const next = updater(current);
      saveChatSettings(next);
      return next;
    });
  }, []);

  const toggleChat = useCallback(() => {
    const nextOpen = !chatSettings.open;
    updateChatSettings((current) => ({ ...current, open: nextOpen }));
    if (nextOpen) {
      setView(chatSettings.layout === 'fullpage' ? 'chat' : 'editor');
    } else if (view === 'chat') {
      setView('editor');
    }
  }, [chatSettings.layout, chatSettings.open, updateChatSettings, view]);

  const setChatLayoutPreference = useCallback(
    (layout: ChatLayout) => {
      updateChatSettings((current) => ({ ...current, layout }));
    },
    [updateChatSettings],
  );

  const changeChatLayout = useCallback(
    (layout: ChatLayout) => {
      updateChatSettings((current) => ({ ...current, layout, open: true }));
      if (layout === 'fullpage') setView('chat');
      else setView('editor');
    },
    [updateChatSettings],
  );

  const closeChat = useCallback(() => {
    updateChatSettings((current) => ({ ...current, open: false }));
    if (view === 'chat') setView('editor');
  }, [updateChatSettings, view]);

  const changeChatDockedWidth = useCallback(
    (width: number) => {
      updateChatSettings((current) => ({ ...current, dockedWidth: clampChatDockedWidth(width) }));
    },
    [updateChatSettings],
  );

  useEffect(() => {
    const syncDocsHash = () => {
      if (typeof window === 'undefined') return;
      const hash = window.location.hash;
      if (hash.startsWith('#/docs') || hash.startsWith('#docs')) {
        if (view !== 'docs') setView('docs');
      }
    };
    syncDocsHash();
    window.addEventListener('hashchange', syncDocsHash);
    return () => window.removeEventListener('hashchange', syncDocsHash);
  }, [view]);

  useEffect(() => {
    const syncAppHeight = () => {
      const height = Math.max(
        window.innerHeight,
        document.documentElement.clientHeight,
        window.visualViewport?.height ?? 0,
      );
      document.documentElement.style.setProperty('--app-height', `${height}px`);
    };

    syncAppHeight();
    window.addEventListener('resize', syncAppHeight);
    window.visualViewport?.addEventListener('resize', syncAppHeight);

    return () => {
      window.removeEventListener('resize', syncAppHeight);
      window.visualViewport?.removeEventListener('resize', syncAppHeight);
    };
  }, []);

  const refreshSavedVaults = useCallback(async () => {
    try {
      setSavedVaults(await listSavedVaults());
    } catch (error) {
      console.error(error);
    }
  }, []);

  const getMountedVault = useCallback(
    (vaultId: string): MountedVault | null => {
      return (
        personalVaults.find((vault) => vault.source.id === vaultId) ??
        sharedVaults.find((vault) => vault.source.id === vaultId) ??
        agentVaults.find((vault) => vault.source.id === vaultId) ??
        null
      );
    },
    [personalVaults, sharedVaults, agentVaults],
  );

  const mountPersonalVault = useCallback(
    async (
      handle: FileSystemDirectoryHandle,
      source: VaultSource,
      options: { makeDefault?: boolean; statusPrefix?: string } = {},
    ) => {
      const loadedNotes = await loadNotes(handle, source);
      const mounted: MountedVault = { handle, source, writeGranted: true };
      setPersonalVaults((current) => {
        if (current.some((vault) => vault.source.id === source.id)) {
          return current;
        }
        return [...current, mounted];
      });
      setNotes((current) => {
        const filtered = current.filter(
          (note) => !(note.vaultRole === 'personal' && note.vaultId === source.id),
        );
        return [...filtered, ...loadedNotes].sort((a, b) => compareVaultPaths(a.path, b.path));
      });
      setSelectedKey((current) => {
        if (current && loadedNotes.some((note) => getNoteKey(note) === current)) return current;
        return loadedNotes[0] ? getNoteKey(loadedNotes[0]) : current;
      });
      saveLastVaultName(handle.name);
      const isFirstPersonal = personalVaults.length === 0;
      await saveVaultHandle(handle, 'personal', {
        defaultPersonal: options.makeDefault ?? isFirstPersonal,
      });
      await refreshSavedVaults();
      setStatus(
        `${options.statusPrefix ?? 'Opened personal vault'} ${handle.name} with ${loadedNotes.length} markdown notes.`,
      );
    },
    [personalVaults.length, refreshSavedVaults],
  );

  const ensureWritePermission = useCallback(
    async (vaultId: string): Promise<boolean> => {
      const mounted = getMountedVault(vaultId);
      if (!mounted) return false;
      if (mounted.writeGranted) return true;
      if (!mounted.handle.requestPermission) return false;
      let result: PermissionState;
      try {
        result = await mounted.handle.requestPermission({ mode: 'readwrite' });
      } catch (error) {
        console.error(error);
        return false;
      }
      if (result !== 'granted') return false;
      const promoted: MountedVault = { ...mounted, writeGranted: true };
      if (mounted.source.role === 'personal') {
        setPersonalVaults((current) =>
          current.map((vault) => (vault.source.id === vaultId ? promoted : vault)),
        );
      } else if (mounted.source.role === 'shared') {
        setSharedVaults((current) =>
          current.map((vault) => (vault.source.id === vaultId ? promoted : vault)),
        );
      } else {
        setAgentVaults((current) =>
          current.map((vault) => (vault.source.id === vaultId ? promoted : vault)),
        );
      }
      return true;
    },
    [getMountedVault],
  );

  const requestWriteGrant = useCallback(async () => {
    if (!needsWriteGrant || grantingWrite) return;
    setGrantingWrite(true);
    try {
      const granted = await ensureWritePermission(needsWriteGrant.id);
      if (granted) {
        setStatus(`Write access granted for ${needsWriteGrant.name}.`);
        setNeedsWriteGrant(null);
      } else {
        setStatus(`Write access denied for ${needsWriteGrant.name}. Edit a note to retry.`);
      }
    } finally {
      setGrantingWrite(false);
    }
  }, [needsWriteGrant, grantingWrite, ensureWritePermission]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const allSaved = await listSavedVaults();
      if (cancelled) return;
      setSavedVaults(allSaved);
      if (!allSaved.length) {
        setStatus('Choose a starter vault or open a personal folder to begin.');
        return;
      }

      const mountedPersonal: MountedVault[] = [];
      const mountedShared: MountedVault[] = [];
      const mountedAgent: MountedVault[] = [];
      const skipped: string[] = [];
      const loadedNotes: VaultNote[] = [];
      const personalNeedingWrite: MountedVault[] = [];

      for (const saved of allSaved) {
        if (cancelled) return;
        const record = await getSavedVault(saved.id);
        if (!record) {
          skipped.push(saved.name);
          continue;
        }
        const readState = await queryReadPermission(record.handle);
        if (readState !== 'granted') {
          skipped.push(saved.name);
          continue;
        }
        const source = savedVaultToSource(record);
        const writableRole = source.role === 'personal';
        const writeState = writableRole ? await queryWritePermission(record.handle) : 'denied';
        const writeGranted = writableRole && writeState === 'granted';
        const mounted: MountedVault = { handle: record.handle, source, writeGranted };

        try {
          const notes = await loadNotes(record.handle, source);
          loadedNotes.push(...notes);
        } catch (error) {
          console.error(`Could not read saved vault ${saved.name}:`, error);
          skipped.push(saved.name);
          continue;
        }

        if (source.role === 'personal') {
          mountedPersonal.push(mounted);
          if (!writeGranted) personalNeedingWrite.push(mounted);
        } else if (source.role === 'shared') {
          mountedShared.push(mounted);
        } else {
          mountedAgent.push(mounted);
        }
      }

      if (cancelled) return;
      if (mountedPersonal.length) setPersonalVaults(mountedPersonal);
      if (mountedShared.length) setSharedVaults(mountedShared);
      if (mountedAgent.length) setAgentVaults(mountedAgent);
      if (loadedNotes.length) {
        setNotes(loadedNotes);
        const first = loadedNotes[0];
        setSelectedKey(getNoteKey(first));
        setView('editor');
      }

      const restoredCount = mountedPersonal.length + mountedShared.length + mountedAgent.length;
      if (restoredCount) {
        const firstNeedingWrite = personalNeedingWrite[0];
        if (firstNeedingWrite) {
          setNeedsWriteGrant({
            id: firstNeedingWrite.source.id,
            name: firstNeedingWrite.source.name,
          });
        }
        const skippedMsg = skipped.length ? ` Skipped: ${skipped.join(', ')}.` : '';
        const writeNote = firstNeedingWrite ? ' Grant write access to enable saving.' : '';
        const personalLabel = mountedPersonal.length === 1 ? 'personal vault' : 'personal vaults';
        const personalSummary = mountedPersonal.length
          ? `${mountedPersonal.length} ${personalLabel}`
          : '';
        const otherSummary =
          mountedShared.length + mountedAgent.length > 0
            ? `${mountedShared.length + mountedAgent.length} other vault${mountedShared.length + mountedAgent.length === 1 ? '' : 's'}`
            : '';
        const vaultSummary = [personalSummary, otherSummary].filter(Boolean).join(' + ');
        setStatus(
          `Restored ${restoredCount} vault${restoredCount === 1 ? '' : 's'} (${loadedNotes.length} notes): ${vaultSummary}.${writeNote}${skippedMsg}`,
        );
      } else if (skipped.length) {
        setStatus(
          `Saved vaults need permission to mount: ${skipped.join(', ')}. Open them from the Vault menu.`,
        );
      }
    })().catch((error) => {
      console.error(error);
      if (!cancelled) setStatus('Choose a starter vault or open a personal folder to begin.');
    });
    return () => {
      cancelled = true;
    };
  }, [refreshSavedVaults]);

  useEffect(() => {
    setFolders(
      deriveVaultFolders(notes, [
        agentVaultSource,
        ...personalVaults.map((vault) => vault.source),
        ...sharedVaults.map((vault) => vault.source),
        ...agentVaults.map((vault) => vault.source),
      ]),
    );
  }, [notes, personalVaults, sharedVaults, agentVaults]);

  // Apply theme on mount and listen for system changes
  useEffect(() => {
    const applyTheme = () => {
      const saved = loadTheme();
      const resolved: 'light' | 'dark' = saved === 'system' ? getSystemTheme() : saved;
      document.documentElement.dataset.theme = resolved;
    };
    applyTheme();
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      if (loadTheme() === 'system') applyTheme();
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const selectedNote = useMemo(
    () => notes.find((note) => getNoteKey(note) === selectedKey),
    [notes, selectedKey],
  );
  const sampleMode = personalVaults.length === 0;
  const vaultName = useMemo(() => {
    if (selectedNote && selectedNote.vaultRole === 'personal') {
      const owner = personalVaults.find((vault) => vault.source.id === selectedNote.vaultId);
      if (owner) return owner.source.name;
    }
    if (personalVaults.length === 1) return personalVaults[0].source.name;
    if (personalVaults.length > 1)
      return `${personalVaults[0].source.name} +${personalVaults.length - 1}`;
    return agentVaultSource.name;
  }, [selectedNote, personalVaults]);

  // Track previous selectedKey for draft save/load on tab switches
  const prevKeyRef = useRef<string | undefined>(undefined);
  const draftRef = useRef(draft);
  const dirtyRef = useRef(dirty);
  const openTabsRef = useRef(openTabs);
  const closeTabRef = useRef<(key: string) => void>(() => {});
  // Keep refs in sync for use in effects
  draftRef.current = draft;
  dirtyRef.current = dirty;
  openTabsRef.current = openTabs;

  useEffect(() => {
    // Save current draft for the previous tab before it changes
    const prev = prevKeyRef.current;
    if (prev !== undefined && prev !== selectedKey) {
      setDraftsMap((current) => ({ ...current, [prev]: draftRef.current }));
      setDirtyTabsMap((current) => ({ ...current, [prev]: dirtyRef.current }));
    }

    // Load draft for the newly selected tab
    if (!selectedNote) {
      setDraft('');
      setDirty(false);
    } else {
      const key = getNoteKey(selectedNote);
      // Use functional updater to read latest draftsMap
      setDraftsMap((current) => {
        const saved = current[key];
        if (saved !== undefined) {
          // Need to also read dirtyTabsMap — use another functional setter
          setDirtyTabsMap((dirtyCurrent) => {
            setDraft(saved);
            const isDirty = dirtyCurrent[key] ?? false;
            setDirty(isDirty);
            draftRef.current = saved;
            dirtyRef.current = isDirty;
            return dirtyCurrent;
          });
        } else {
          setDraft(selectedNote.content);
          setDirty(false);
          draftRef.current = selectedNote.content;
          dirtyRef.current = false;
        }
        return current;
      });
    }

    prevKeyRef.current = selectedKey;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey]);

  // Auto-add selectedKey to openTabs when it changes (covers initial loads, vault ops, etc.)
  useEffect(() => {
    if (selectedKey !== undefined && !openTabs.includes(selectedKey)) {
      setOpenTabs((prev) => (prev.includes(selectedKey!) ? prev : [...prev, selectedKey!]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey]);

  // Register keyboard shortcuts
  useEffect(() => {
    const modifier = isMac() ? 'meta' : 'ctrl';

    // Ctrl/Cmd+K - Command Center
    const unregisterCommandCenter = registerShortcut('k', modifier, () => {
      setPaletteOpen(true);
    });

    // Ctrl/Cmd+N - Create new note
    const unregisterNewNote = registerShortcut('n', modifier, () => {
      if (view === 'editor' || view === 'dashboard') {
        void createNewNote();
      }
    });

    // Ctrl/Cmd+, - Settings
    const unregisterSettings = registerShortcut(',', modifier, () => {
      setView('settings');
    });

    // Ctrl/Cmd+D — Cycle theme: light → dark → system → light
    const unregisterTheme = registerShortcut('d', modifier, () => {
      cycleTheme();
    });

    // Ctrl/Cmd+W — Close current tab
    const unregisterCloseNote = registerShortcut('w', modifier, () => {
      if (selectedKey) {
        closeTabRef.current(selectedKey);
      }
    });

    // Ctrl/Cmd+P — Toggle properties panel
    const unregisterProperties = registerShortcut('p', modifier, () => {
      handleShowPropertiesChange(!showProperties);
    });

    // Ctrl/Cmd+B — Toggle sidebar
    const unregisterSidebar = registerShortcut('b', modifier, () => {
      if (window.innerWidth <= 899) {
        setMobileNavOpen((v) => !v);
        if (sidebarMinimized) setSidebarMinimized(false);
      } else {
        setSidebarMinimized((v) => !v);
      }
    });

    // Ctrl/Cmd+Shift+F — Focus file tree search
    const unregisterSearchFocus = registerShortcut('f', modifier, () => {
      searchInputRef.current?.focus();
    }, true);

    // Ctrl/Cmd+Shift+E — Toggle focus mode
    const unregisterFocusMode = registerShortcut('e', modifier, () => {
      setFocusMode((v) => !v);
    }, true);

    // Ctrl/Cmd+Shift+T — Switch to Tasks view
    const unregisterTasks = registerShortcut('t', modifier, () => {
      setView('tasks');
    }, true);

    // Ctrl/Cmd+Shift+D — Switch to Dashboard view
    const unregisterDashboard = registerShortcut('d', modifier, () => {
      setView('dashboard');
    }, true);

    // Wire up global keydown listener so registered shortcuts fire
    const onKeyDown = (event: KeyboardEvent) => {
      handleKeyboardEvent(event);
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      unregisterCommandCenter();
      unregisterNewNote();
      unregisterSettings();
      unregisterTheme();
      unregisterCloseNote();
      unregisterProperties();
      unregisterSidebar();
      unregisterSearchFocus();
      unregisterFocusMode();
      unregisterTasks();
      unregisterDashboard();
      unregisterAll();
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [view, selectedNote, cycleTheme, showProperties, handleShowPropertiesChange, sidebarMinimized]);

  // Legacy keyboard handler for save
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const modifier = event.ctrlKey || event.metaKey;
      if (!modifier) return;
      if (event.key.toLowerCase() === 's') {
        event.preventDefault();
        void saveSelectedNote();
      } else if (event.shiftKey && event.key.toLowerCase() === 'c') {
        event.preventDefault();
        toggleChat();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleChat]);

  // Escape to close modals
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && paletteOpen) {
        setPaletteOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [paletteOpen]);

  useEffect(() => {
    savePreferences({ editorMode, view });
  }, [editorMode, view]);

  // Persist open tabs to localStorage
  useEffect(() => {
    localStorage.setItem('openTabs', JSON.stringify(openTabs));
  }, [openTabs]);

  useEffect(() => {
    if (!chatSettings.open && chatContextNote) {
      setChatContextNote(null);
    }
  }, [chatSettings.open, chatContextNote]);

  const stats = useMemo<VaultStats>(() => {
    const graph = buildGraphData(notes);
    const tasks = notes.flatMap((note) => note.tasks);
    return {
      noteCount: notes.length,
      linkCount: graph.links.length,
      backlinkCount: graph.links.length,
      orphanCount: getOrphanNotes(notes).length,
      brokenLinkCount: getBrokenLinks(notes).length,
      taskCount: tasks.length,
      completedTaskCount: tasks.filter((task) => task.completed).length,
      tagCount: new Set(notes.flatMap((note) => note.tags.map((tag) => tag.toLowerCase()))).size,
      agentCount: getWorkspaceEntityNotes(notes).length,
    };
  }, [notes]);

  useEffect(() => {
    const tasks = notes.flatMap((note) => note.tasks);
    setTaskConversationMeta(pruneTaskConversationMeta(tasks));
  }, [notes]);

  const allTasks = useMemo(() => notes.flatMap((note) => note.tasks), [notes]);

  const refreshVault = useCallback(async () => {
    const previousSelectedKey = selectedKey;
    const personalResults = await Promise.all(
      personalVaults.map(async (vault) => {
        try {
          return await loadNotes(vault.handle, vault.source);
        } catch (error) {
          console.error(`Could not refresh personal vault ${vault.source.name}:`, error);
          return [];
        }
      }),
    );
    const personalNotes = personalResults.flat();
    const sharedNotes = (
      await Promise.all(sharedVaults.map((vault) => loadNotes(vault.handle, vault.source)))
    ).flat();
    const agentNotes = (
      await Promise.all(agentVaults.map((vault) => loadNotes(vault.handle, vault.source)))
    ).flat();
    const reloadedNotes = [...personalNotes, ...sharedNotes, ...agentNotes];
    setNotes(reloadedNotes);
    if (
      previousSelectedKey &&
      reloadedNotes.some((note) => getNoteKey(note) === previousSelectedKey)
    ) {
      setSelectedKey(previousSelectedKey);
    } else {
      setSelectedKey(reloadedNotes[0] ? getNoteKey(reloadedNotes[0]) : undefined);
    }
    setStatus(
      `Refreshed ${reloadedNotes.length} notes across ${personalVaults.length + sharedVaults.length + agentVaults.length} vaults.`,
    );
  }, [personalVaults, sharedVaults, agentVaults, selectedKey]);

  const openVault = useCallback(async () => {
    if (!window.showDirectoryPicker) {
      alert('Your browser does not support local folder access. Use Chrome or Microsoft Edge.');
      return;
    }

    try {
      const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
      const allowed = await verifyPermission(handle, true);
      if (!allowed) {
        setStatus('Permission denied. Agent Vault needs read/write access to save markdown files.');
        return;
      }
      const source: VaultSource = {
        id: `personal:${handle.name}`,
        name: handle.name,
        role: 'personal',
        readOnly: false,
      };
      await mountPersonalVault(handle, source, { makeDefault: true });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      console.error(error);
      setStatus('Could not open vault folder.');
    }
  }, [mountPersonalVault]);

  const openSharedVault = useCallback(async () => {
    if (!window.showDirectoryPicker) {
      alert('Your browser does not support local folder access. Use Chrome or Microsoft Edge.');
      return;
    }

    try {
      const handle = await window.showDirectoryPicker({ mode: 'read' });
      const allowed = await verifyPermission(handle, false);
      if (!allowed) {
        setStatus('Permission denied. Shared vaults only need read access.');
        return;
      }
      const mountedVaults = [...personalVaults, ...sharedVaults];
      for (const mounted of mountedVaults) {
        if (await isSameDirectoryHandle(handle, mounted.handle)) {
          setStatus(
            `${handle.name} is already mounted as ${mounted.source.role === 'personal' ? 'a personal vault' : 'a shared vault'}.`,
          );
          return;
        }
        if (!handle.isSameEntry && mounted.handle.name === handle.name) {
          setStatus(
            `A vault named ${handle.name} is already mounted. Choose a different shared vault.`,
          );
          return;
        }
      }
      const source: VaultSource = {
        id: `shared:${handle.name}:${Date.now()}`,
        name: handle.name,
        role: 'shared',
        readOnly: true,
      };
      const loadedNotes = await loadNotes(handle, source);
      setSharedVaults((current) => [...current, { handle, source, writeGranted: false }]);
      setNotes((current) => [...current, ...loadedNotes]);
      if (!selectedKey && loadedNotes[0]) setSelectedKey(getNoteKey(loadedNotes[0]));
      await saveVaultHandle(handle, 'shared');
      await refreshSavedVaults();
      setStatus(
        `Added shared vault ${handle.name} read-only with ${loadedNotes.length} markdown notes.`,
      );
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      console.error(error);
      setStatus('Could not open shared vault folder.');
    }
  }, [selectedKey, personalVaults, sharedVaults, refreshSavedVaults]);

  const openSavedVault = useCallback(
    async (id: string) => {
      try {
        const saved = await getSavedVault(id);
        if (!saved) {
          setStatus('Saved vault not found.');
          await refreshSavedVaults();
          return;
        }
        setStatus(`Opening saved vault ${saved.name}...`);
        const writable = saved.role !== 'shared';
        const allowed = await verifyPermission(saved.handle, writable);
        if (!allowed) {
          setStatus(
            `${saved.name} needs browser permission again. Use Open personal vault to reselect it.`,
          );
          return;
        }
        if (saved.role === 'personal') {
          if (personalVaults.some((vault) => vault.source.id === saved.id)) {
            setStatus(`${saved.name} is already mounted as a personal vault.`);
            return;
          }
          await mountPersonalVault(saved.handle, savedVaultToSource(saved), {
            makeDefault: saved.defaultPersonal,
          });
          return;
        }
        if (saved.role === 'agent') {
          const alreadyMounted = agentVaults.some((vault) => vault.source.id === saved.id);
          if (alreadyMounted) {
            setStatus(`${saved.name} is already mounted.`);
            return;
          }
          const source = savedVaultToSource(saved);
          const loadedNotes = await loadNotes(saved.handle, source);
          setAgentVaults((current) => [
            ...current,
            { handle: saved.handle, source, writeGranted: source.readOnly ? false : true },
          ]);
          setNotes((current) => [...current, ...loadedNotes]);
          if (!selectedKey && loadedNotes[0]) setSelectedKey(getNoteKey(loadedNotes[0]));
          setStatus(`Added agent vault ${saved.name} with ${loadedNotes.length} markdown notes.`);
          return;
        }
        const alreadyMounted = sharedVaults.some((vault) => vault.source.id === saved.id);
        if (alreadyMounted) {
          setStatus(`${saved.name} is already mounted.`);
          return;
        }
        const source = savedVaultToSource(saved);
        const loadedNotes = await loadNotes(saved.handle, source);
        setSharedVaults((current) => [
          ...current,
          { handle: saved.handle, source, writeGranted: false },
        ]);
        setNotes((current) => [...current, ...loadedNotes]);
        if (!selectedKey && loadedNotes[0]) setSelectedKey(getNoteKey(loadedNotes[0]));
        setStatus(
          `Added shared vault ${saved.name} read-only with ${loadedNotes.length} markdown notes.`,
        );
      } catch (error) {
        console.error(error);
        setStatus('Could not open saved vault.');
      }
    },
    [
      mountPersonalVault,
      refreshSavedVaults,
      selectedKey,
      personalVaults,
      sharedVaults,
      agentVaults,
    ],
  );

  const importAgentVault = useCallback(async () => {
    if (!window.showDirectoryPicker) {
      alert('Your browser does not support local folder access. Use Chrome or Microsoft Edge.');
      return;
    }

    try {
      const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
      const allowed = await verifyPermission(handle, true);
      if (!allowed) {
        setStatus('Permission denied. Agent vaults need read/write access to save edits.');
        return;
      }
      const mountedVaults = [...personalVaults, ...sharedVaults, ...agentVaults];
      for (const mounted of mountedVaults) {
        if (await isSameDirectoryHandle(handle, mounted.handle)) {
          setStatus(
            `${handle.name} is already mounted as ${mounted.source.role === 'personal' ? 'a personal vault' : `a ${mounted.source.role} vault`}.`,
          );
          return;
        }
        if (!handle.isSameEntry && mounted.handle.name === handle.name) {
          setStatus(`A vault named ${handle.name} is already mounted. Choose a different folder.`);
          return;
        }
      }
      const source: VaultSource = {
        id: `agent:${handle.name}:${Date.now()}`,
        name: handle.name,
        role: 'agent',
        readOnly: false,
      };
      const loadedNotes = await loadNotes(handle, source);
      const folderNoteFiles = findAgentFolderNoteFiles(loadedNotes);
      setAgentVaults((current) => [
        ...current,
        { handle, source, writeGranted: source.readOnly ? false : true },
      ]);
      setNotes((current) => [...current, ...loadedNotes]);
      if (!selectedKey && loadedNotes[0]) setSelectedKey(getNoteKey(loadedNotes[0]));
      await saveVaultHandle(handle, 'agent');
      await refreshSavedVaults();
      const folderNoteSummary = folderNoteFiles.length
        ? ` Detected ${folderNoteFiles.length} folder note file${folderNoteFiles.length === 1 ? '' : 's'}: ${folderNoteFiles.map((f) => f.filename).join(', ')}.`
        : ' No folder note files (SOUL.md, SKILLS.md, TOOLS.md, AGENTS.md) were detected in this folder.';
      setStatus(
        `Imported agent vault ${handle.name} with ${loadedNotes.length} markdown notes.${folderNoteSummary}`,
      );
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      console.error(error);
      setStatus('Could not import agent vault.');
    }
  }, [selectedKey, personalVaults, sharedVaults, agentVaults, refreshSavedVaults]);

  const makeDefaultVault = useCallback(
    async (id: string) => {
      try {
        await setDefaultPersonalVault(id);
        await refreshSavedVaults();
        setStatus('Default personal vault updated.');
      } catch (error) {
        console.error(error);
        setStatus('Could not update default personal vault.');
      }
    },
    [refreshSavedVaults],
  );

  const resetVaultRegistry = useCallback(async () => {
    try {
      await clearSavedVaults();
      clearLastVaultName();
      await refreshSavedVaults();
      setPersonalVaults([]);
      setSharedVaults([]);
      setAgentVaults([]);
      setNotes([]);
      setFolders([]);
      setSelectedKey(undefined);
      setOpenTabs([]);
      setDraftsMap({});
      setDirtyTabsMap({});
      setDraft('');
      setDirty(false);
      setChatContextNote(null);
      setView('dashboard');
      setStatus(
        'Vault registrations reset and all vaults unplugged. Open vault folders again to register them.',
      );
    } catch (error) {
      console.error(error);
      setStatus('Could not reset vault registrations.');
    }
  }, [refreshSavedVaults]);

  const unplugVault = useCallback(
    async (id: string) => {
      const mounted = getMountedVault(id);
      if (!mounted) {
        setStatus('Vault is not currently mounted.');
        return;
      }
      const roleLabel =
        mounted.source.role === 'personal'
          ? 'personal vault'
          : mounted.source.role === 'shared'
            ? 'shared vault'
            : 'agent vault';
      if (mounted.source.role === 'personal') {
        setPersonalVaults((current) => current.filter((vault) => vault.source.id !== id));
      } else if (mounted.source.role === 'shared') {
        setSharedVaults((current) => current.filter((vault) => vault.source.id !== id));
      } else {
        setAgentVaults((current) => current.filter((vault) => vault.source.id !== id));
      }
      setNotes((current) => current.filter((note) => note.vaultId !== id));
      setSelectedKey((current) => {
        if (!current) return current;
        const isFromThisVault = current.startsWith(`${id}:`);
        if (!isFromThisVault) return current;
        const remaining = notes.filter(
          (note) => getNoteKey(note) !== current && note.vaultId !== id,
        );
        const fallback = remaining[0];
        return fallback ? getNoteKey(fallback) : undefined;
      });
      setNeedsWriteGrant((current) => (current && current.id === id ? null : current));
      if (mounted.source.role === 'personal') {
        const remainingPersonal = personalVaults
          .filter((vault) => vault.source.id !== id)
          .map((vault) => vault.source.id);
        try {
          await reconcileDefaultPersonalVault(remainingPersonal);
          await refreshSavedVaults();
        } catch (error) {
          console.error('Could not reconcile default personal vault:', error);
        }
      }
      setStatus(`Unplugged ${roleLabel} ${mounted.source.name}. Files on disk are untouched.`);
    },
    [getMountedVault, notes, personalVaults, refreshSavedVaults],
  );

  const useStarterVault = useCallback(
    async (templateId: string) => {
      if (!window.showDirectoryPicker) {
        alert('Your browser does not support local folder access. Use Chrome or Microsoft Edge.');
        return;
      }

      const template = starterVaults.find((starter) => starter.id === templateId);
      const isPersonal = template?.recommendedRole === 'personal';
      const isAgent = template?.recommendedRole === 'agent';

      let handle: FileSystemDirectoryHandle | null = null;
      if (isPersonal) {
        try {
          const savedDefault = await getDefaultPersonalVault();
          if (savedDefault) {
            const allowed = await verifyPermission(savedDefault.handle, true);
            if (allowed) handle = savedDefault.handle;
          }
        } catch (error) {
          console.error(error);
        }
      }

      try {
        if (!handle) {
          handle = await window.showDirectoryPicker({ mode: 'readwrite' });
          const allowed = await verifyPermission(handle, true);
          if (!allowed) {
            setStatus(
              'Permission denied. Starter vaults need read/write access to create markdown files.',
            );
            return;
          }
        }
        if (!handle) return;
        const targetHandle = handle;
        const count = await writeStarterVault(targetHandle, templateId, { overwrite: true });
        if (isPersonal) {
          const source: VaultSource = {
            id: `personal:${targetHandle.name}`,
            name: targetHandle.name,
            role: 'personal',
            readOnly: false,
          };
          await mountPersonalVault(targetHandle, source, {
            makeDefault: true,
            statusPrefix: `Created ${template?.name ?? 'starter vault'} in`,
          });
          setStatus(
            `Created ${count} starter files in ${targetHandle.name}. Set as default personal vault.`,
          );
        } else if (isAgent) {
          const source: VaultSource = {
            id: `agent:${templateId}:${targetHandle.name}`,
            name: targetHandle.name,
            role: 'agent',
            readOnly: true,
          };
          const alreadyMounted = agentVaults.some((vault) => vault.source.id === source.id);
          if (!alreadyMounted) {
            const loadedNotes = await loadNotes(targetHandle, source);
            setAgentVaults((current) => [
              ...current,
              { handle: targetHandle, source, writeGranted: source.readOnly ? false : true },
            ]);
            setNotes((current) => [...current, ...loadedNotes]);
            if (!selectedKey && loadedNotes[0]) setSelectedKey(getNoteKey(loadedNotes[0]));
            await saveVaultHandle(targetHandle, 'agent');
            await refreshSavedVaults();
          }
          setStatus(
            `Created ${count} starter files in ${targetHandle.name}. Mounted as an agent vault.`,
          );
        } else {
          const source: VaultSource = {
            id: `shared:${templateId}:${targetHandle.name}`,
            name: targetHandle.name,
            role: 'shared',
            readOnly: true,
          };
          const alreadyMounted = sharedVaults.some((vault) => vault.source.id === source.id);
          if (!alreadyMounted) {
            const loadedNotes = await loadNotes(targetHandle, source);
            setSharedVaults((current) => [
              ...current,
              { handle: targetHandle, source, writeGranted: false },
            ]);
            setNotes((current) => [...current, ...loadedNotes]);
            if (!selectedKey && loadedNotes[0]) setSelectedKey(getNoteKey(loadedNotes[0]));
            await saveVaultHandle(targetHandle, 'shared');
            await refreshSavedVaults();
          }
          setStatus(
            `Created ${count} starter files in ${targetHandle.name}. Mounted as a read-only shared vault.`,
          );
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        console.error(error);
        setStatus(
          error instanceof Error && error.message.startsWith('Path already exists:')
            ? `${error.message}. Choose an empty folder or remove the existing starter file.`
            : 'Could not create starter vault.',
        );
      }
    },
    [agentVaults, mountPersonalVault, refreshSavedVaults, selectedKey, sharedVaults, starterVaults],
  );

  const useAllStarterVaults = useCallback(async () => {
    if (!window.showDirectoryPicker) {
      alert('Your browser does not support local folder access. Use Chrome or Microsoft Edge.');
      return;
    }

    const mounted: string[] = [];
    let loadedFiles = 0;

    for (const template of starterVaults) {
      const isPersonal = template.recommendedRole === 'personal';
      const isAgent = template.recommendedRole === 'agent';
      let handle: FileSystemDirectoryHandle | null = null;

      if (isPersonal) {
        try {
          const savedDefault = await getDefaultPersonalVault();
          if (savedDefault) {
            const allowed = await verifyPermission(savedDefault.handle, true);
            if (allowed) handle = savedDefault.handle;
          }
        } catch (error) {
          console.error(error);
        }
      }

      try {
        if (!handle) {
          handle = await window.showDirectoryPicker({ mode: 'readwrite' });
          const allowed = await verifyPermission(handle, true);
          if (!allowed) {
            setStatus(`Permission denied for ${template.name}. Skipped.`);
            continue;
          }
        }
        if (!handle) continue;
        const targetHandle = handle;
        const count = await writeStarterVault(targetHandle, template.id, { overwrite: true });
        loadedFiles += count;

        if (isPersonal) {
          const source: VaultSource = {
            id: `personal:${targetHandle.name}`,
            name: targetHandle.name,
            role: 'personal',
            readOnly: false,
          };
          await mountPersonalVault(targetHandle, source, {
            makeDefault: true,
            statusPrefix: `Created ${template.name} in`,
          });
          mounted.push(`${template.name} → ${targetHandle.name} (personal)`);
        } else if (isAgent) {
          const source: VaultSource = {
            id: `agent:${template.id}:${targetHandle.name}`,
            name: targetHandle.name,
            role: 'agent',
            readOnly: true,
          };
          const alreadyMounted = agentVaults.some((vault) => vault.source.id === source.id);
          if (!alreadyMounted) {
            const loadedNotes = await loadNotes(targetHandle, source);
            setAgentVaults((current) => [
              ...current,
              { handle: targetHandle, source, writeGranted: source.readOnly ? false : true },
            ]);
            setNotes((current) => [...current, ...loadedNotes]);
            if (!selectedKey && loadedNotes[0]) setSelectedKey(getNoteKey(loadedNotes[0]));
            await saveVaultHandle(targetHandle, 'agent');
            await refreshSavedVaults();
          }
          mounted.push(`${template.name} → ${targetHandle.name} (agent)`);
        } else {
          const source: VaultSource = {
            id: `shared:${template.id}:${targetHandle.name}`,
            name: targetHandle.name,
            role: 'shared',
            readOnly: true,
          };
          const alreadyMounted = sharedVaults.some((vault) => vault.source.id === source.id);
          if (!alreadyMounted) {
            const loadedNotes = await loadNotes(targetHandle, source);
            setSharedVaults((current) => [
              ...current,
              { handle: targetHandle, source, writeGranted: false },
            ]);
            setNotes((current) => [...current, ...loadedNotes]);
            if (!selectedKey && loadedNotes[0]) setSelectedKey(getNoteKey(loadedNotes[0]));
            await saveVaultHandle(targetHandle, 'shared');
            await refreshSavedVaults();
          }
          mounted.push(`${template.name} → ${targetHandle.name} (shared)`);
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          setStatus(
            `Cancelled loading starter vaults after ${mounted.length} of ${starterVaults.length}.`,
          );
          return;
        }
        console.error(error);
        setStatus(`Could not load ${template.name}. Continuing with the rest.`);
      }
    }

    setStatus(
      `Loaded ${mounted.length} starter vaults (${loadedFiles} files): ${mounted.join('; ')}`,
    );
  }, [
    agentVaults,
    mountPersonalVault,
    refreshSavedVaults,
    selectedKey,
    sharedVaults,
    starterVaults,
  ]);

  const selectNote = useCallback(
    (key: string) => {
      // Save current draft for the current tab before switching
      if (selectedKey && selectedKey !== key) {
        setDraftsMap((prev) => ({ ...prev, [selectedKey]: draftRef.current }));
        setDirtyTabsMap((prev) => ({ ...prev, [selectedKey]: dirtyRef.current }));
      }
      // Add to open tabs if not already present
      setOpenTabs((prev) => (prev.includes(key) ? prev : [...prev, key]));
      setSelectedKey(key);
      setView('editor');
    },
    [selectedKey],
  );

  const handleCloseTab = useCallback(
    (closeKey: string) => {
      // Find index before removal using the ref for latest value
      const currentTabs = openTabsRef.current;
      const closeIdx = currentTabs.indexOf(closeKey);
      if (closeIdx === -1) return;

      // Clean up stored draft/dirty for the closed tab
      setDraftsMap((prev) => {
        const next = { ...prev };
        delete next[closeKey];
        return next;
      });
      setDirtyTabsMap((prev) => {
        const next = { ...prev };
        delete next[closeKey];
        return next;
      });

      const isActiveTab = closeKey === selectedKey;

      setOpenTabs((prev) => {
        const idx = prev.indexOf(closeKey);
        if (idx === -1) return prev;
        const next = [...prev];
        next.splice(idx, 1);
        return next;
      });

      // If closing the active tab, select an adjacent one
      if (isActiveTab) {
        // Compute remaining tabs based on pre-removal state
        const remaining = [...currentTabs];
        remaining.splice(closeIdx, 1);
        if (remaining.length > 0) {
          const adjacentIdx = Math.min(closeIdx, remaining.length - 1);
          setSelectedKey(remaining[adjacentIdx]);
        } else {
          setSelectedKey(undefined);
          setView('dashboard');
        }
      }
    },
    [selectedKey],
  );
  // Sync ref for use in keyboard shortcuts (declared earlier in component)
  closeTabRef.current = handleCloseTab;

  const saveSelectedNote = useCallback(async () => {
    if (!selectedNote || !dirty) return;
    if (!canWriteVaultNote(selectedNote)) {
      alert(
        `${getVaultRoleLabel(selectedNote.vaultRole)} content is read-only here. Select a personal vault note to save edits.`,
      );
      return;
    }
    const writeOk = await ensureWritePermission(selectedNote.vaultId);
    if (!writeOk) {
      setStatus('Write permission required to save. Click "Grant write access" in the banner.');
      setNeedsWriteGrant({ id: selectedNote.vaultId, name: selectedNote.vaultName });
      return;
    }

    try {
      const saved = await writeNote(selectedNote, draft);
      setNotes((current) =>
        current.map((note) => (getNoteKey(note) === getNoteKey(saved) ? saved : note)),
      );
      setDirty(false);
      setStatus(`Saved ${saved.title}.`);
    } catch (error) {
      console.error(error);
      setStatus('Save failed. Check browser permissions for the selected folder.');
    }
  }, [selectedNote, dirty, draft, ensureWritePermission]);

  const createNewNote = useCallback(
    async (folderPath = '') => {
      if (personalVaults.length === 0) {
        alert('Open a personal vault first to create notes.');
        return;
      }
      const normalized = normalizeFolderPath(folderPath);
      if (personalVaults.length === 1) {
        setPendingCreateVaultId(personalVaults[0].source.id);
        setNoteActionTarget(undefined);
        setCreateNoteFolder(normalized);
        setNoteActionDialog({ mode: 'create', open: true });
        return;
      }
      setPersonalPickerOpen({ mode: 'create-note' });
      setCreateNoteFolder(normalized);
    },
    [personalVaults],
  );

  const pickPersonalVaultForCreate = useCallback(
    (vaultId: string) => {
      if (!personalVaults.some((vault) => vault.source.id === vaultId)) return;
      setPendingCreateVaultId(vaultId);
      setPersonalPickerOpen(null);
      setNoteActionTarget(undefined);
      setNoteActionDialog({ mode: 'create', open: true });
    },
    [personalVaults],
  );

  const getInboundBacklinks = useCallback(
    (note: VaultNote) => buildBacklinks(notes, note).length,
    [notes],
  );

  const confirmCreateNote = useCallback(
    async (result: { path: string; title?: string }) => {
      const targetVaultId =
        pendingCreateVaultId ?? (personalVaults.length === 1 ? personalVaults[0].source.id : null);
      if (!targetVaultId) {
        if (personalVaults.length > 1) {
          setStatus('Pick a personal vault to create this note in.');
        } else {
          alert('Open a personal vault to create notes.');
        }
        return;
      }
      const targetVault = personalVaults.find((vault) => vault.source.id === targetVaultId) ?? null;
      if (!targetVault) {
        alert('That personal vault is no longer mounted. Pick another one.');
        return;
      }
      const writeOk = await ensureWritePermission(targetVault.source.id);
      if (!writeOk) {
        setStatus(
          `Write permission required to create notes in ${targetVault.source.name}. Click "Grant write access" in the banner.`,
        );
        setNeedsWriteGrant({ id: targetVault.source.id, name: targetVault.source.name });
        return;
      }
      const validation = validateVaultPath(result.path);
      if (!validation.valid || !validation.normalizedPath) {
        alert(validation.error || 'Invalid path');
        return;
      }
      const personalNotes = notes.filter((note) => note.vaultId === targetVault.source.id);
      if (pathExists(personalNotes, validation.normalizedPath)) {
        alert('A note with this path already exists in that vault.');
        return;
      }
      try {
        const created = await createNote(
          targetVault.handle,
          targetVault.source,
          validation.normalizedPath,
        );
        setNotes((current) =>
          [...current, created].sort((a, b) => compareVaultPaths(a.path, b.path)),
        );
        setSelectedKey(getNoteKey(created));
        setCreateNoteFolder('');
        setPendingCreateVaultId(null);
        setView('editor');
        setStatus(`Created ${created.path} in ${targetVault.source.name}.`);
      } catch (error) {
        console.error(error);
        setStatus('Could not create note.');
      }
    },
    [pendingCreateVaultId, personalVaults, notes, ensureWritePermission],
  );

  const requestRenameNote = useCallback(
    (note = selectedNote) => {
      if (!note) return;
      if (!canWriteVaultNote(note)) {
        alert(
          `${getVaultRoleLabel(note.vaultRole)} content cannot be renamed. Only personal vault notes can be renamed.`,
        );
        return;
      }
      setNoteActionTarget(note);
      setPendingRenameVaultId(note.vaultId);
      if (dirty) {
        const save = window.confirm('Save changes before renaming?');
        if (save) {
          void saveSelectedNote().then(() => {
            setNoteActionDialog({ mode: 'rename', open: true });
          });
        } else {
          setDraft(note.content);
          setDirty(false);
          setNoteActionDialog({ mode: 'rename', open: true });
        }
      } else {
        setNoteActionDialog({ mode: 'rename', open: true });
      }
    },
    [selectedNote, dirty, saveSelectedNote],
  );

  const confirmRenameNote = useCallback(
    async (result: { path: string }) => {
      const targetNote = noteActionTarget ?? selectedNote;
      if (!targetNote || !canWriteVaultNote(targetNote)) return;
      const targetVault =
        personalVaults.find((vault) => vault.source.id === targetNote.vaultId) ??
        (pendingRenameVaultId
          ? (personalVaults.find((vault) => vault.source.id === pendingRenameVaultId) ?? null)
          : null);
      if (!targetVault) {
        alert('That personal vault is no longer mounted. Mount it again to rename this note.');
        return;
      }
      const writeOk = await ensureWritePermission(targetVault.source.id);
      if (!writeOk) {
        setStatus(
          `Write permission required to rename notes in ${targetVault.source.name}. Click "Grant write access" in the banner.`,
        );
        setNeedsWriteGrant({ id: targetVault.source.id, name: targetVault.source.name });
        return;
      }
      const validation = validateVaultPath(result.path);
      if (!validation.valid || !validation.normalizedPath) {
        alert(validation.error || 'Invalid path');
        return;
      }
      const isConflict = notes.some(
        (note) =>
          note.vaultId === targetVault.source.id &&
          getNoteKey(note) !== getNoteKey(targetNote) &&
          note.path.toLowerCase() === validation.normalizedPath!.toLowerCase(),
      );
      if (isConflict) {
        alert('A note with this path already exists in that vault.');
        return;
      }
      try {
        const renamed = await renameNote(targetVault.handle, targetNote, validation.normalizedPath);
        setNotes((current) =>
          current.map((note) => (getNoteKey(note) === getNoteKey(targetNote) ? renamed : note)),
        );
        setSelectedKey(getNoteKey(renamed));
        setDraft(renamed.content);
        setDirty(false);
        setStatus(`Renamed to ${renamed.path} in ${targetVault.source.name}.`);
      } catch (error) {
        console.error(error);
        setStatus('Could not rename note.');
      }
    },
    [
      selectedNote,
      noteActionTarget,
      pendingRenameVaultId,
      personalVaults,
      notes,
      ensureWritePermission,
    ],
  );

  const requestDeleteNote = useCallback(
    (note = selectedNote) => {
      if (!note) return;
      if (!canWriteVaultNote(note)) {
        alert(
          `${getVaultRoleLabel(note.vaultRole)} content cannot be deleted. Only personal vault notes can be deleted.`,
        );
        return;
      }
      setNoteActionTarget(note);
      setPendingDeleteVaultId(note.vaultId);
      if (dirty) {
        const save = window.confirm('Save changes before deleting?');
        if (save) {
          void saveSelectedNote().then(() => {
            setNoteActionDialog({ mode: 'delete', open: true });
          });
        } else {
          alert('Save your changes first, then try deleting again.');
        }
        return;
      }
      setNoteActionDialog({ mode: 'delete', open: true });
    },
    [selectedNote, dirty, saveSelectedNote],
  );

  const copyNotePath = useCallback(
    (note = selectedNote) => {
      if (!note) return;
      void navigator.clipboard.writeText(note.path);
      setStatus(`Copied path: ${note.path}`);
    },
    [selectedNote],
  );

  const createFolderFromTree = useCallback(
    async (parentPath: string) => {
      if (personalVaults.length === 0) {
        alert('Open a personal vault first to create folders.');
        return;
      }
      setPendingFolderParentPath(normalizeFolderPath(parentPath));
      const doCreate = async (vault: MountedVault) => {
        setPendingFolderActionVaultId(vault.source.id);
        const name = window.prompt(`Folder name in ${vault.source.name}`);
        if (!name) return;
        const requestedPath = normalizeFolderPath(parentPath ? `${parentPath}/${name}` : name);
        const validation = validateFolderPath(requestedPath);
        if (!validation.valid || !validation.path) {
          alert(validation.error || 'Invalid folder path.');
          return;
        }
        try {
          await createDirectory(vault.handle, validation.path);
          setStatus(`Created folder ${validation.path} in ${vault.source.name}.`);
        } catch (error) {
          console.error(error);
          setStatus('Could not create folder.');
        }
      };
      if (personalVaults.length === 1) {
        await doCreate(personalVaults[0]);
        return;
      }
      setPersonalPickerOpen({ mode: 'create-folder' });
    },
    [personalVaults],
  );

  const pickPersonalVaultForFolder = useCallback(
    (vaultId: string) => {
      const vault = personalVaults.find((candidate) => candidate.source.id === vaultId);
      if (!vault) return;
      setPersonalPickerOpen(null);
      void (async () => {
        const name = window.prompt(`Folder name in ${vault.source.name}`);
        if (!name) return;
        const parent = pendingFolderParentPath;
        const requestedPath = normalizeFolderPath(parent ? `${parent}/${name}` : name);
        const validation = validateFolderPath(requestedPath);
        if (!validation.valid || !validation.path) {
          alert(validation.error || 'Invalid folder path.');
          return;
        }
        try {
          await createDirectory(vault.handle, validation.path);
          setStatus(`Created folder ${validation.path} in ${vault.source.name}.`);
          setPendingFolderActionVaultId(vault.source.id);
        } catch (error) {
          console.error(error);
          setStatus('Could not create folder.');
        }
      })();
    },
    [personalVaults, pendingFolderParentPath],
  );

  const renameFolderFromTree = useCallback(
    async (folderPath: string) => {
      if (personalVaults.length === 0) {
        alert('Open a personal vault first to rename folders.');
        return;
      }
      const oldPath = normalizeFolderPath(folderPath);
      if (!oldPath) return;
      const folderNotes = notes.filter(
        (note) => note.vaultRole === 'personal' && note.path.startsWith(`${oldPath}/`),
      );
      if (!folderNotes.length) {
        alert('No notes found in this folder.');
        return;
      }
      const targetVaultId = folderNotes[0].vaultId;
      const targetVault = personalVaults.find((vault) => vault.source.id === targetVaultId);
      if (!targetVault) {
        alert('That folder belongs to a personal vault that is no longer mounted.');
        return;
      }
      const nextPathInput = window.prompt(`New folder path in ${targetVault.source.name}`, oldPath);
      if (!nextPathInput || nextPathInput === oldPath) return;
      const validation = validateFolderPath(nextPathInput);
      if (!validation.valid || !validation.path) {
        alert(validation.error || 'Invalid folder path.');
        return;
      }
      const nextPath = validation.path;
      const personalNotes = notes.filter((note) => note.vaultId === targetVault.source.id);
      if (personalNotes.some((note) => note.path.startsWith(`${nextPath}/`))) {
        alert('A folder with that path already contains notes in that vault.');
        return;
      }
      try {
        for (const note of folderNotes) {
          await renameNote(
            targetVault.handle,
            note,
            `${nextPath}/${note.path.slice(oldPath.length + 1)}`,
          );
        }
        const reloaded = await loadNotes(targetVault.handle, targetVault.source);
        setNotes((current) => {
          const filtered = current.filter((note) => note.vaultId !== targetVault.source.id);
          return [...filtered, ...reloaded];
        });
        if (
          selectedNote?.vaultId === targetVault.source.id &&
          selectedNote.path.startsWith(`${oldPath}/`)
        ) {
          const nextSelected = reloaded.find(
            (note) => note.path === `${nextPath}/${selectedNote.path.slice(oldPath.length + 1)}`,
          );
          setSelectedKey(nextSelected ? getNoteKey(nextSelected) : undefined);
        }
        setStatus(`Renamed folder ${oldPath} to ${nextPath} in ${targetVault.source.name}.`);
      } catch (error) {
        console.error(error);
        setStatus('Could not rename folder.');
      }
    },
    [personalVaults, notes, selectedNote],
  );

  const deleteFolderFromTree = useCallback(
    async (folderPath: string) => {
      if (personalVaults.length === 0) {
        alert('Open a personal vault first to delete folders.');
        return;
      }
      const targetPath = normalizeFolderPath(folderPath);
      if (!targetPath) return;
      const folderNotes = notes.filter(
        (note) => note.vaultRole === 'personal' && note.path.startsWith(`${targetPath}/`),
      );
      if (!folderNotes.length) {
        alert('No notes found in this folder.');
        return;
      }
      const targetVaultId = folderNotes[0].vaultId;
      const targetVault = personalVaults.find((vault) => vault.source.id === targetVaultId);
      if (!targetVault) {
        alert('That folder belongs to a personal vault that is no longer mounted.');
        return;
      }
      if (
        !window.confirm(
          `Delete folder "${targetPath}" in ${targetVault.source.name} and ${folderNotes.length} note${folderNotes.length === 1 ? '' : 's'}? This cannot be undone.`,
        )
      )
        return;
      try {
        await deleteDirectory(targetVault.handle, targetPath);
        const remaining = notes.filter(
          (note) =>
            !(note.vaultId === targetVault.source.id && note.path.startsWith(`${targetPath}/`)),
        );
        setNotes(remaining);
        if (
          selectedNote?.vaultId === targetVault.source.id &&
          selectedNote.path.startsWith(`${targetPath}/`)
        ) {
          setSelectedKey(remaining[0] ? getNoteKey(remaining[0]) : undefined);
        }
        setStatus(`Deleted folder ${targetPath} from ${targetVault.source.name}.`);
      } catch (error) {
        console.error(error);
        setStatus('Could not delete folder.');
      }
    },
    [personalVaults, notes, selectedNote],
  );

  const handleEditFolderTags = useCallback(
    (vaultId: string, folderPath: string, currentTags: string[]) => {
      setTagEditorState({ open: true, vaultId, folderPath, currentTags });
    },
    [],
  );

  const handleSaveFolderTags = useCallback(
    async (tags: string[]) => {
      const { vaultId, folderPath } = tagEditorState;
      if (!vaultId) return;
      setTagEditorState((prev) => ({ ...prev, open: false }));

      const mounted = getMountedVault(vaultId);
      if (!mounted) return;

      const manifest = entityTagsData[vaultId] ?? emptyManifest();
      const cleaned = tags.map((t) => t.trim()).filter(Boolean);

      if (cleaned.length > 0) {
        manifest.folders[folderPath] = cleaned;
      } else {
        delete manifest.folders[folderPath];
      }

      try {
        await saveEntityTags(mounted.handle, manifest);
        setEntityTagsData((prev) => ({ ...prev, [vaultId]: manifest }));
        setStatus(`Updated tags for folder "${folderPath}".`);
      } catch (error) {
        console.error('Failed to save folder tags:', error);
        setStatus('Could not save folder tags.');
      }
    },
    [tagEditorState, entityTagsData, getMountedVault],
  );

  const openNoteInDefaultApp = useCallback(async (note: VaultNote) => {
    try {
      const file = await note.handle.getFile();
      const url = URL.createObjectURL(file);
      const opened = window.open(url, '_blank', 'noopener,noreferrer');
      if (!opened) {
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.click();
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setStatus(`Opened ${note.path}.`);
    } catch (error) {
      console.error(error);
      setStatus('Could not open note. Check browser permissions for the selected folder.');
    }
  }, []);

  // v2 Handlers: Tool permissions
  const handleToolPermissionChange = useCallback(
    async (toolId: string, permission: ToolPermission) => {
      setToolPermissionOverride(toolId, permission);
      setToolPermissions((prev) => ({ ...prev, [toolId]: permission }));
      const sourceNote = notes.find(
        (note) => isToolNote(note) && loadToolMetadata(note).id === toolId,
      );
      if (!sourceNote || loadToolMetadata(sourceNote).provider === 'internal') {
        setStatus(`Updated system tool ${toolId} permission to ${permission}.`);
        return;
      }
      if (!canWriteVaultNote(sourceNote)) {
        setStatus(
          `Updated local permission override for ${sourceNote.title}. ${getVaultRoleLabel(sourceNote.vaultRole)} tool metadata is read-only.`,
        );
        return;
      }
      const targetVault = getMountedVault(sourceNote.vaultId) ?? personalVaults[0] ?? null;
      if (!targetVault) {
        setStatus(
          `Updated local permission override. Mount the personal vault that owns ${sourceNote.title} to mirror it into the note.`,
        );
        return;
      }
      const writeOk = await ensureWritePermission(targetVault.source.id);
      if (!writeOk) {
        setStatus(
          `Updated local permission override. Grant write access to ${targetVault.source.name} to mirror it into the tool note.`,
        );
        setNeedsWriteGrant({ id: targetVault.source.id, name: targetVault.source.name });
        return;
      }
      try {
        const updatedContent = replaceFrontmatterValue(
          sourceNote.content,
          'permission',
          permission,
        );
        const saved = await writeNote(sourceNote, updatedContent);
        setNotes((current) =>
          current.map((note) => (getNoteKey(note) === getNoteKey(saved) ? saved : note)),
        );
        setStatus(`Updated ${sourceNote.title} permission to ${permission}.`);
      } catch (error) {
        console.error(error);
        setStatus('Could not update tool permission. Check personal vault permissions.');
      }
    },
    [notes, getMountedVault, personalVaults, ensureWritePermission],
  );

  const handleRegisterMcpTool = useCallback(
    async (tool: {
      server: string;
      name: string;
      toolId: string;
      description: string;
      permission: ToolPermission;
      risk: 'low' | 'medium' | 'high';
    }) => {
      const targetVault = personalVaults[0] ?? null;
      if (!targetVault) {
        alert('Open a personal vault before registering MCP tool notes.');
        return;
      }
      const writeOk = await ensureWritePermission(targetVault.source.id);
      if (!writeOk) {
        setStatus(
          `Write permission required to register MCP tool in ${targetVault.source.name}. Click "Grant write access" in the banner.`,
        );
        setNeedsWriteGrant({ id: targetVault.source.id, name: targetVault.source.name });
        return;
      }
      const server = sanitizePathSegment(tool.server);
      const name = sanitizePathSegment(tool.name);
      const path = `Tools/MCP/${server}/${name}.md`;
      const content = `---
type: tool
provider: mcp
server: ${tool.server.trim()}
tool_id: ${tool.toolId.trim()}
status: inactive
permission: ${tool.permission}
risk: ${tool.risk}
description: ${tool.description.trim()}
---

# ${tool.name.trim()}

${tool.description.trim()}

This is registered metadata. Browser v0.1.0 treats MCP bridge execution as local sidecar/dev-capable; internal browser tools remain the dependable path.
`;
      try {
        const created = await createNote(targetVault.handle, targetVault.source, path, content);
        setNotes((current) =>
          [...current, created].sort((a, b) => compareVaultPaths(a.path, b.path)),
        );
        setSelectedKey(getNoteKey(created));
        setView('tools');
        setStatus(`Registered MCP tool metadata at ${created.path} in ${targetVault.source.name}.`);
      } catch (error) {
        console.error(error);
        setStatus(
          'Could not register MCP tool note. Check for duplicate paths or browser permissions.',
        );
      }
    },
    [personalVaults, ensureWritePermission],
  );

  const ensureMarkitdownNotes = useCallback(async () => {
    if (personalVaults.length === 0) return false;
    const targetVault = personalVaults[0];
    const writeOk = await ensureWritePermission(targetVault.source.id);
    if (!writeOk) return false;
    const def = getMarkitdownServerConfig();
    const existing = new Set(notes.map((note) => note.path.toLowerCase()));
    const seeds: Array<{
      path: string;
      toolId: string;
      name: string;
      risk: 'low' | 'medium' | 'high';
      permission: ToolPermission;
      description: string;
    }> = [
      {
        path: 'Tools/MCP/markitdown/convert.md',
        toolId: 'markitdown.convert',
        name: 'MarkItDown Convert',
        risk: 'medium',
        permission: 'ask',
        description:
          'Convert a file or approved URL to Markdown using Microsoft MarkItDown. Saves a sidecar .md note next to the source.',
      },
      {
        path: 'Tools/MCP/markitdown/list-capabilities.md',
        toolId: 'markitdown.list_capabilities',
        name: 'MarkItDown Capabilities',
        risk: 'low',
        permission: 'read-only',
        description: 'List the optional-extras groups currently installed for MarkItDown.',
      },
      {
        path: 'Tools/MCP/markitdown/install-extras.md',
        toolId: 'markitdown.install_extras',
        name: 'MarkItDown Install Extras',
        risk: 'high',
        permission: 'ask',
        description:
          'pip-install a MarkItDown extras group to enable additional file types. Requires explicit confirmation.',
      },
    ];
    const created: VaultNote[] = [];
    for (const seed of seeds) {
      if (existing.has(seed.path.toLowerCase())) continue;
      const content = `---
type: tool
provider: mcp
server: ${MARKITDOWN_SERVER_NAME}
tool_id: ${seed.toolId}
status: active
permission: ${seed.permission}
risk: ${seed.risk}
description: ${seed.description}
install_hint: ${def.installHint}
capabilities_url: ${def.capabilitiesUrl}
---

# ${seed.name}

${seed.description}

The bridge spawns \`${def.command} ${def.args.join(' ')}\` and proxies the \`${seed.toolId}\` tool.
`;
      try {
        const note = await createNote(targetVault.handle, targetVault.source, seed.path, content);
        created.push(note);
      } catch (error) {
        console.error(error);
      }
    }
    if (created.length > 0) {
      setNotes((current) => {
        const known = new Set(current.map((n) => n.path));
        const additions = created.filter((n) => !known.has(n.path));
        if (additions.length === 0) return current;
        return [...current, ...additions].sort((a, b) => compareVaultPaths(a.path, b.path));
      });
    }
    return true;
  }, [personalVaults, ensureWritePermission, notes]);

  const handleRegisterMarkitdown = useCallback(async () => {
    const targetVault = personalVaults[0] ?? null;
    if (!targetVault) {
      alert('Open a personal vault before registering MarkItDown.');
      return;
    }
    const writeOk = await ensureWritePermission(targetVault.source.id);
    if (!writeOk) {
      setStatus(
        `Write permission required to register MarkItDown tools in ${targetVault.source.name}. Click "Grant write access" in the banner.`,
      );
      setNeedsWriteGrant({ id: targetVault.source.id, name: targetVault.source.name });
      return;
    }
    const def = getMarkitdownServerConfig();
    seedMarkitdownServer();
    try {
      await addBridgeServer({ name: def.name, command: def.command, args: def.args, env: def.env });
      setStatus(
        `MarkItDown server registered. Start the bridge with \`npm run bridge:dev\` if it is not already running.`,
      );
    } catch (error) {
      console.error(error);
      setStatus(
        'MarkItDown config saved, but the bridge could not start it. Make sure the bridge is running and Python has markitdown installed.',
      );
    }

    await ensureMarkitdownNotes();
    setView('tools');
  }, [personalVaults, ensureWritePermission, ensureMarkitdownNotes]);

  // One-shot auto-seed of MarkItDown tool notes once a personal vault is
  // mounted and writable. This makes the Tools page show MarkItDown entries
  // without requiring the user to click "Register MarkItDown" first.
  useEffect(() => {
    if (markitdownSeedRef.current) return;
    const targetVault = personalVaults[0];
    if (!targetVault || targetVault.source.readOnly) return;
    if (!targetVault.writeGranted) return;
    markitdownSeedRef.current = true;
    void ensureMarkitdownNotes();
  }, [personalVaults, ensureMarkitdownNotes]);

  // Seed the local bridge config so `getAllTools` can synthesize MarkItDown
  // cards from the bridge listing even before the bridge is reachable. This
  // makes the Tools page populate the moment the app loads.
  useEffect(() => {
    seedMarkitdownServer();
  }, []);

  const handleMarkitdownConvert = useCallback(
    async (request: { uri: string; fileType?: string; suggestedTitle?: string }) => {
      const targetVault = personalVaults[0] ?? null;
      if (!targetVault) {
        return { success: false, error: 'Open a personal vault before converting files.' };
      }
      const writeOk = await ensureWritePermission(targetVault.source.id);
      if (!writeOk) {
        setStatus(
          `Write permission required to save converted notes in ${targetVault.source.name}. Click "Grant write access" in the banner.`,
        );
        setNeedsWriteGrant({ id: targetVault.source.id, name: targetVault.source.name });
        return { success: false, error: 'Write permission required' };
      }
      const invocation = await invokeBridgeTool(MARKITDOWN_SERVER_NAME, 'markitdown.convert', {
        uri: request.uri,
        file_type: request.fileType,
      });
      if (!invocation.success || invocation.output === undefined) {
        const message = invocation.error ?? 'MarkItDown returned no output.';
        setStatus(`MarkItDown failed: ${message}`);
        return { success: false, error: message };
      }
      let payload: { markdown?: string; suggested_title?: string; source?: string } = {};
      const raw = invocation.output;
      if (typeof raw === 'string') {
        try {
          payload = JSON.parse(raw) as typeof payload;
        } catch {
          payload = { markdown: raw };
        }
      } else if (raw && typeof raw === 'object') {
        const candidates = (raw as { content?: Array<{ type: string; text?: string }> }).content;
        if (Array.isArray(candidates)) {
          const text = candidates
            .filter((c) => c.type === 'text' && typeof c.text === 'string')
            .map((c) => c.text ?? '')
            .join('\n');
          try {
            payload = JSON.parse(text) as typeof payload;
          } catch {
            payload = { markdown: text };
          }
        } else {
          payload = raw as typeof payload;
        }
      }
      const markdown = typeof payload.markdown === 'string' ? payload.markdown : '';
      if (!markdown) {
        const message = 'MarkItDown returned an empty document.';
        setStatus(message);
        return { success: false, error: message };
      }
      const baseTitle = (
        request.suggestedTitle ||
        payload.suggested_title ||
        deriveTitleFromUri(request.uri) ||
        'Converted'
      ).trim();
      const safeTitle = sanitizePathSegment(baseTitle) || 'Converted';
      const folder = inferFolderFromUri(request.uri) || 'Inbox/Imports';
      const normalizedFolder = folder.replace(/^\/+/, '').replace(/\/+$/, '');
      const path = `${normalizedFolder ? `${normalizedFolder}/` : ''}${safeTitle}.md`;
      const frontmatter = `---
type: import
source: ${payload.source ?? request.uri}
tool: markitdown
imported: ${new Date().toISOString()}
---

`;
      const body = `${frontmatter}${markdown}\n`;
      if (pathExists(notes, path)) {
        const message = `A note already exists at ${path}. Rename or remove it first.`;
        setStatus(message);
        return { success: false, error: message };
      }
      try {
        const created = await createNote(targetVault.handle, targetVault.source, path, body);
        setNotes((current) =>
          [...current, created].sort((a, b) => compareVaultPaths(a.path, b.path)),
        );
        setSelectedKey(getNoteKey(created));
        setView('editor');
        setStatus(`Converted to ${created.path} in ${targetVault.source.name}.`);
        return { success: true, path: created.path };
      } catch (error) {
        console.error(error);
        const message = error instanceof Error ? error.message : 'Could not save converted note.';
        setStatus(message);
        return { success: false, error: message };
      }
    },
    [personalVaults, notes, ensureWritePermission],
  );

  const handleSaveMemory = useCallback(
    async (content: string, memoryType: MemoryType, target?: string, existingMemoryId?: string) => {
      const memorySettings = loadMemorySettings();
      if (memorySettings.requireApproval && !window.confirm('Save this content to memory?')) {
        setStatus('Memory save cancelled.');
        return;
      }
      if (personalVaults.length === 0) {
        alert('Open a personal vault before saving memory notes.');
        return;
      }
      const targetVault = personalVaults[0];
      const writeOk = await ensureWritePermission(targetVault.source.id);
      if (!writeOk) {
        setStatus(
          `Write permission required to save memory in ${targetVault.source.name}. Click "Grant write access" in the banner.`,
        );
        setNeedsWriteGrant({ id: targetVault.source.id, name: targetVault.source.name });
        return;
      }
      try {
        if (existingMemoryId) {
          const memoryNote = notes.find((note) => getNoteKey(note) === existingMemoryId);
          if (!memoryNote) {
            setStatus('Could not find the selected memory note.');
            return;
          }
          if (!isMemoryNote(memoryNote)) {
            setStatus('Append target is not a detected memory note.');
            return;
          }
          if (!canAppendToMemoryNote(memoryNote)) {
            setStatus(
              `${getVaultRoleLabel(memoryNote.vaultRole)} memory notes are read-only. Choose a writable personal memory note.`,
            );
            return;
          }
          const noteVault = getMountedVault(memoryNote.vaultId) ?? targetVault;
          const saved = await appendToMemoryNote(noteVault.handle, memoryNote, content);
          setNotes((current) =>
            current.map((note) => (getNoteKey(note) === getNoteKey(saved) ? saved : note)),
          );
          setStatus(`Appended memory to ${saved.title}.`);
          return;
        }

        const memoryContent = saveToMemory(content, memoryType, target);
        const memoryPath = getUniqueMemoryPath(notes, memoryType, target, memorySettings);
        const created = await saveMemoryNote(
          targetVault.handle,
          targetVault.source,
          memoryContent,
          memoryType,
          target,
          memoryPath,
        );
        setNotes((current) =>
          [...current, created].sort((a, b) => compareVaultPaths(a.path, b.path)),
        );
        setSelectedKey(getNoteKey(created));
        setStatus(`Saved memory note ${created.path} in ${targetVault.source.name}.`);
      } catch (error) {
        console.error(error);
        setStatus('Could not save memory note. Check for duplicate paths or browser permissions.');
      }
    },
    [notes, personalVaults, getMountedVault, ensureWritePermission],
  );

  const handleSaveMemoryReflection = useCallback(
    async (params: {
      agentName: string;
      content: string;
    }): Promise<{ ok: boolean; path?: string; error?: string }> => {
      const content = params.content.trim();
      if (!content) return { ok: false, error: 'Memory reflection is empty.' };
      if (personalVaults.length === 0) {
        const error = 'Open a personal vault before saving agent memory.';
        setStatus(error);
        return { ok: false, error };
      }
      const targetVault = personalVaults[0];
      const writeOk = await ensureWritePermission(targetVault.source.id);
      if (!writeOk) {
        const error = `Write permission required to save agent memory in ${targetVault.source.name}.`;
        setStatus(`${error} Click "Grant write access" in the banner.`);
        setNeedsWriteGrant({ id: targetVault.source.id, name: targetVault.source.name });
        return { ok: false, error };
      }

      const writableAgentMemory = notes.find((note) => {
        const metadata = getMemoryMetadata(note);
        return (
          metadata.isMemory &&
          metadata.memoryType === 'agent' &&
          note.vaultRole === 'personal' &&
          canAppendToMemoryNote(note) &&
          memoryMatchesTarget(note, params.agentName)
        );
      });

      try {
        if (writableAgentMemory) {
          const noteVault = getMountedVault(writableAgentMemory.vaultId) ?? targetVault;
          const saved = await appendToMemoryNote(noteVault.handle, writableAgentMemory, content);
          setNotes((current) =>
            current.map((note) => (getNoteKey(note) === getNoteKey(saved) ? saved : note)),
          );
          setStatus(`Saved memory reflection to ${saved.path}.`);
          return { ok: true, path: saved.path };
        }

        const memorySettings = loadMemorySettings();
        const memoryContent = saveToMemory(content, 'agent', params.agentName);
        const memoryPath = getUniqueMemoryPath(notes, 'agent', params.agentName, memorySettings);
        const created = await saveMemoryNote(
          targetVault.handle,
          targetVault.source,
          memoryContent,
          'agent',
          params.agentName,
          memoryPath,
        );
        setNotes((current) =>
          [...current, created].sort((a, b) => compareVaultPaths(a.path, b.path)),
        );
        setStatus(`Created agent memory note ${created.path} in ${targetVault.source.name}.`);
        return { ok: true, path: created.path };
      } catch (error) {
        console.error(error);
        const message =
          error instanceof Error ? error.message : 'Could not save memory reflection.';
        setStatus('Could not save memory reflection. Check personal vault permissions.');
        return { ok: false, error: message };
      }
    },
    [notes, personalVaults, getMountedVault, ensureWritePermission],
  );

  // v2 Handlers: Task assignment and agent ping
  const agentNotesForTasks = useMemo<VaultNote[]>(() => {
    return notes.filter((note) => {
      const isAgentPath = note.path.toLowerCase().includes('/agents/');
      const isAgentType = note.frontmatter.type === 'agent';
      const hasAgentTag = note.tags.includes('agent');
      return isAgentPath || isAgentType || hasAgentTag;
    });
  }, [notes]);

  const handlePingAgent = useCallback(
    (task: TaskItem, agent: VaultNote) => {
      setChatPrefill({ agentKey: getNoteKey(agent), prompt: task.text });
      updateChatSettings((current) => ({ ...current, open: true }));
      setView((current) =>
        chatSettings.layout === 'fullpage' ? 'chat' : current === 'chat' ? current : 'editor',
      );
    },
    [chatSettings.layout, updateChatSettings],
  );

  const handleOpenTaskConversation = useCallback(
    (task: TaskItem) => {
      const taskNote = notes.find((note) => getNoteKey(note) === task.noteKey) ?? null;
      const assignedAgent = task.assignee
        ? agentNotesForTasks.find(
            (agent) => agent.title.toLowerCase() === task.assignee?.toLowerCase(),
          )
        : null;
      const fallbackAgent = agentNotesForTasks[0] ?? null;
      const agent = assignedAgent ?? fallbackAgent;
      const agentKey = agent ? getNoteKey(agent) : '';
      const agentName = agent?.title ?? 'Assistant';
      const { meta, session } = ensureTaskConversation(task, notes, agentKey, agentName);
      setTaskConversationMeta((current) => ({ ...current, [task.id]: meta }));
      setChatContextNote(taskNote);
      setActiveTaskConversationRequest({
        sessionId: session.id,
        task,
        agentKey,
        agentName,
        requestId: Date.now(),
      });
      updateChatSettings((current) => ({
        ...current,
        open: true,
        layout: current.layout === 'fullpage' ? current.layout : 'docked',
      }));
      setView((current) =>
        chatSettings.layout === 'fullpage' || current === 'chat' ? 'chat' : 'editor',
      );
      setStatus(
        `Opened task conversation: ${task.text.slice(0, 60)}${task.text.length > 60 ? '...' : ''}`,
      );
    },
    [agentNotesForTasks, chatSettings.layout, notes, updateChatSettings],
  );

  const handleTaskSessionReady = useCallback((params: { taskId: string; sessionId: string }) => {
    setTaskConversationMeta((current) => {
      const existing = current[params.taskId];
      if (!existing) return current;
      const next = {
        ...current,
        [params.taskId]: {
          ...existing,
          sessionId: params.sessionId,
          updatedAt: Date.now(),
        },
      };
      return next;
    });
  }, []);

  const handleAgentBusyStateChange = useCallback(
    (params: { state: ChatAgentBusyState; sessionId: string | null; taskId?: string }) => {
      setAgentBusyState(params.state);
      setActiveAgentSessionId(params.sessionId);
      if (!params.taskId) return;
      const taskState = params.state === 'running' ? 'busy' : params.state;
      setTaskConversationMeta(updateTaskConversationAgentState(params.taskId, taskState));
    },
    [],
  );

  const consumeChatPrefill = useCallback(() => {
    setChatPrefill(null);
  }, []);

  // v2 Handlers: Chat output
  const handleSaveChatSession = useCallback(
    async (sessionId: string): Promise<{ ok: boolean; path?: string; error?: string }> => {
      const session = loadChatSessions().find((candidate) => candidate.id === sessionId);
      if (!session) {
        return { ok: false, error: 'Chat session not found.' };
      }
      if (session.messages.length === 0) {
        return { ok: false, error: 'This conversation has no messages to save.' };
      }
      const targetVault = personalVaults[0] ?? null;
      if (!targetVault) {
        alert('Open a personal vault first to save conversations.');
        return { ok: false, error: 'No personal vault open.' };
      }
      const writeOk = await ensureWritePermission(targetVault.source.id);
      if (!writeOk) {
        setStatus(
          `Write permission required to save conversation in ${targetVault.source.name}. Click "Grant write access" in the banner.`,
        );
        setNeedsWriteGrant({ id: targetVault.source.id, name: targetVault.source.name });
        return { ok: false, error: 'Write permission required.' };
      }
      const markdown = serializeSessionAsMarkdown(session, {
        includeToolTranscript: true,
        includeThinking: true,
      });
      const today = new Date().toISOString().slice(0, 10);
      const safeTitle = sanitizePathSegment(session.title || 'Chat') || 'Chat';
      const personalNotes = notes.filter((note) => note.vaultId === targetVault.source.id);
      const requested = `Agent Chats/${today} - ${safeTitle}.md`;
      const path = getUniqueNotePath(personalNotes, requested);
      try {
        const created = await createNote(targetVault.handle, targetVault.source, path, markdown);
        setNotes((current) =>
          [...current, created].sort((a, b) => compareVaultPaths(a.path, b.path)),
        );
        markSessionSaved(session.id, created.path);
        setSelectedKey(getNoteKey(created));
        setView('editor');
        setStatus(`Saved conversation to ${created.path} in ${targetVault.source.name}`);
        return { ok: true, path: created.path };
      } catch (error) {
        console.error(error);
        setStatus('Could not save conversation.');
        return { ok: false, error: error instanceof Error ? error.message : 'Unknown error.' };
      }
    },
    [notes, personalVaults, ensureWritePermission],
  );

  const handleSaveChatOutput = useCallback(
    async (
      content: string,
      destination: 'note' | 'new' | 'memory',
      agentName = 'Assistant',
    ): Promise<boolean> => {
      if (destination === 'note' && selectedNote) {
        if (!canWriteVaultNote(selectedNote)) {
          alert(
            `${getVaultRoleLabel(selectedNote.vaultRole)} content is read-only here. Select a personal vault note before inserting chat output.`,
          );
          return false;
        }
        // Append to current note
        const updatedContent = selectedNote.content + '\n\n---\n\n' + content;
        setDraft(updatedContent);
        setDirty(true);
        setStatus('Response inserted into note.');
        return true;
      } else if (destination === 'new') {
        // Create new note with content
        const targetVault = personalVaults[0] ?? null;
        if (!targetVault) {
          alert('Open a personal vault first to create notes.');
          return false;
        }
        const writeOk = await ensureWritePermission(targetVault.source.id);
        if (!writeOk) {
          setStatus(
            `Write permission required to create note in ${targetVault.source.name}. Click "Grant write access" in the banner.`,
          );
          setNeedsWriteGrant({ id: targetVault.source.id, name: targetVault.source.name });
          return false;
        }
        const title = content.slice(0, 50).replace(/[^a-zA-Z0-9\s]/g, '') || 'Chat Response';
        const personalNotes = notes.filter((note) => note.vaultId === targetVault.source.id);
        const path = getUniqueNotePath(
          personalNotes,
          `Agent Responses/${sanitizePathSegment(title)}.md`,
        );
        try {
          const created = await createNote(targetVault.handle, targetVault.source, path, content);
          setNotes((current) =>
            [...current, created].sort((a, b) => compareVaultPaths(a.path, b.path)),
          );
          setSelectedKey(getNoteKey(created));
          setView('editor');
          setStatus(`Created note from response in ${targetVault.source.name}: ${created.path}`);
          return true;
        } catch (error) {
          console.error(error);
          setStatus('Could not create note from response.');
          return false;
        }
      } else if (destination === 'memory') {
        await handleSaveMemory(content, 'run', agentName);
        return true;
      }
      return false;
    },
    [selectedNote, personalVaults, notes, handleSaveMemory, ensureWritePermission],
  );

  const handleCreateTaskFromChat = useCallback(
    async (taskText: string, agentName: string): Promise<boolean> => {
      if (!selectedNote) {
        alert('Select a note to add a task to.');
        return false;
      }
      if (!canWriteVaultNote(selectedNote)) {
        alert(
          `${getVaultRoleLabel(selectedNote.vaultRole)} content is read-only here. Select a personal vault note before creating tasks.`,
        );
        return false;
      }
      // Add task to current note
      const taskLine = `- [ ] ${taskText} @${agentName}`;
      const updatedContent = selectedNote.content + '\n' + taskLine;
      setDraft(updatedContent);
      setDirty(true);
      setStatus(`Task created and assigned to ${agentName}.`);
      return true;
    },
    [selectedNote],
  );

  const handleAutoSaveAgentRun = useCallback(
    async (params: {
      userPrompt: string;
      response: string;
      agentName: string;
      skillName?: string;
      model: string;
      provider: string;
      sourceNote?: string;
      contextItems: string[];
      transcript?: import('./types').ToolCallRecord[];
      toolsUsed?: string[];
      approvals?: import('./types').AgentRunApproval[];
      reasoningSummary?: string;
    }) => {
      const settings = loadAgentRunsSettings();
      if (!settings.autoSaveRuns) return;
      const targetVault = personalVaults[0] ?? null;
      if (!targetVault) {
        setStatus('Agent response completed. Open a personal vault to auto-save run logs.');
        return;
      }
      const writeOk = await ensureWritePermission(targetVault.source.id);
      if (!writeOk) {
        setStatus(
          `Write permission required to auto-save run logs in ${targetVault.source.name}. Click "Grant write access" in the banner.`,
        );
        setNeedsWriteGrant({ id: targetVault.source.id, name: targetVault.source.name });
        return;
      }
      const logFolder = normalizeFolderPath(settings.logFolderPath || 'Agent Runs') || 'Agent Runs';
      const date = new Date().toISOString().split('T')[0];
      const title = sanitizePathSegment(params.userPrompt.slice(0, 48) || 'Chat Response');
      const personalNotes = notes.filter((note) => note.vaultId === targetVault.source.id);
      const path = getUniqueNotePath(
        personalNotes,
        `${logFolder}/${date} - ${sanitizePathSegment(params.agentName)} - ${title}.md`,
      );
      const transcript = settings.includeToolOutput
        ? (params.transcript ?? [])
        : (params.transcript ?? []).map((record) => {
            const sanitized = { ...record };
            delete sanitized.output;
            return sanitized;
          });
      const content = createAgentRun({
        id: `run-${Date.now()}`,
        status: 'completed',
        goal: params.userPrompt,
        agentKey: params.agentName,
        skillKey: params.skillName,
        agent: params.agentName,
        skill: params.skillName,
        model: params.model,
        provider: params.provider,
        sourceNote: params.sourceNote,
        contextItems: params.contextItems,
        toolsUsed: params.toolsUsed ?? [],
        userRequest: params.userPrompt,
        output: params.response,
        steps: [
          {
            id: 'plan',
            title: 'Understand goal and gather context',
            status: 'completed',
            summary: `Prepared a supervised run for: ${params.userPrompt}`,
            startedAt: Date.now(),
            completedAt: Date.now(),
          },
          {
            id: 'tools',
            title: 'Run permitted tools',
            status: 'completed',
            summary: params.transcript?.length
              ? `Executed ${params.transcript.length} tool call(s).`
              : 'No tool calls were needed.',
            startedAt: Date.now(),
            completedAt: Date.now(),
          },
          {
            id: 'final',
            title: 'Produce final response',
            status: 'completed',
            summary: 'Generated the visible response.',
            startedAt: Date.now(),
            completedAt: Date.now(),
          },
        ],
        messages: [
          { role: 'user', content: params.userPrompt, timestamp: Date.now() },
          { role: 'assistant', content: params.response, timestamp: Date.now() },
        ],
        transcript,
        approvals: params.approvals ?? [],
        reasoningSummary: params.reasoningSummary,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        completedAt: Date.now(),
        maxIterations: 12,
      });
      try {
        const created = await createNote(targetVault.handle, targetVault.source, path, content);
        setNotes((current) =>
          [...current, created].sort((a, b) => compareVaultPaths(a.path, b.path)),
        );
        setStatus(`Saved agent run log ${created.path} in ${targetVault.source.name}.`);
      } catch (error) {
        console.error(error);
        setStatus('Agent response completed, but the run log could not be saved.');
      }
    },
    [notes, personalVaults, ensureWritePermission],
  );

  // v2 Handlers: Run agent (opens chat with context)
  const handleRunAgent = useCallback(
    (task: { id: string; text: string; noteKey: string }, agent: VaultNote) => {
      // Find the note for this task
      const taskNote = notes.find((n) => getNoteKey(n) === task.noteKey) ?? null;
      setChatContextNote(taskNote);
      updateChatSettings((current) => ({
        ...current,
        open: true,
        layout: current.layout === 'fullpage' ? 'docked' : current.layout,
      }));
      setView('editor');
      setStatus(`Opened chat with ${agent.title} for task: ${task.text.slice(0, 50)}...`);
    },
    [notes, updateChatSettings],
  );

  // v2 Handlers: Edit skill
  const handleEditSkill = useCallback(
    (skillNote: VaultNote) => {
      selectNote(getNoteKey(skillNote));
      setView('editor');
      setStatus(`Editing skill: ${skillNote.title}`);
    },
    [selectNote],
  );

  const confirmDeleteNote = useCallback(async () => {
    const targetNote = noteActionTarget ?? selectedNote;
    if (!targetNote || !canWriteVaultNote(targetNote)) return;
    const targetVault =
      personalVaults.find((vault) => vault.source.id === targetNote.vaultId) ??
      (pendingDeleteVaultId
        ? (personalVaults.find((vault) => vault.source.id === pendingDeleteVaultId) ?? null)
        : null);
    if (!targetVault) {
      alert('That personal vault is no longer mounted. Mount it again to delete this note.');
      return;
    }
    const writeOk = await ensureWritePermission(targetVault.source.id);
    if (!writeOk) {
      setStatus(
        `Write permission required to delete notes in ${targetVault.source.name}. Click "Grant write access" in the banner.`,
      );
      setNeedsWriteGrant({ id: targetVault.source.id, name: targetVault.source.name });
      return;
    }
    try {
      await deleteNote(targetVault.handle, targetNote);
      const deletedKey = getNoteKey(targetNote);
      // Remove from tabs and clean up draft
      setOpenTabs((prev) => prev.filter((k) => k !== deletedKey));
      setDraftsMap((prev) => {
        const next = { ...prev };
        delete next[deletedKey];
        return next;
      });
      setDirtyTabsMap((prev) => {
        const next = { ...prev };
        delete next[deletedKey];
        return next;
      });
      const sortedBeforeDelete = [...notes].sort((a, b) =>
        getNoteKey(a).localeCompare(getNoteKey(b)),
      );
      const deletedIndex = sortedBeforeDelete.findIndex((note) => getNoteKey(note) === deletedKey);
      const remaining = notes.filter((note) => getNoteKey(note) !== deletedKey);
      setNotes(remaining);
      if (remaining.length === 0) {
        setView('dashboard');
        setSelectedKey(undefined);
      } else {
        const sortedRemaining = [...remaining].sort((a, b) =>
          getNoteKey(a).localeCompare(getNoteKey(b)),
        );
        const nextNote =
          sortedRemaining[Math.min(Math.max(deletedIndex, 0), sortedRemaining.length - 1)];
        setSelectedKey(getNoteKey(nextNote));
      }
      setStatus(`Deleted ${targetNote.path} from ${targetVault.source.name}.`);
    } catch (error) {
      console.error(error);
      setStatus('Could not delete note.');
    }
  }, [
    selectedNote,
    noteActionTarget,
    pendingDeleteVaultId,
    personalVaults,
    notes,
    ensureWritePermission,
  ]);

  const openWikiLink = useCallback(
    async (target: string) => {
      const note = resolveLinkTarget(notes, target);
      if (note) {
        selectNote(getNoteKey(note));
        return;
      }
      const targetVault = personalVaults[0] ?? null;
      if (!targetVault) {
        alert(`Missing note: ${target}. Open a personal vault to create it.`);
        return;
      }
      const writeOk = await ensureWritePermission(targetVault.source.id);
      if (!writeOk) {
        setStatus(
          `Write permission required to create note in ${targetVault.source.name}. Click "Grant write access" in the banner.`,
        );
        setNeedsWriteGrant({ id: targetVault.source.id, name: targetVault.source.name });
        return;
      }
      if (!window.confirm(`Create missing note "${target}"?`)) return;
      const created = await createNote(
        targetVault.handle,
        targetVault.source,
        `${target}.md`,
        `# ${target}\n\n`,
      );
      setNotes((current) =>
        [...current, created].sort((a, b) => compareVaultPaths(a.path, b.path)),
      );
      setSelectedKey(getNoteKey(created));
      setView('editor');
    },
    [notes, personalVaults, selectNote, ensureWritePermission],
  );

  const updateDraft = (value: string) => {
    setDraft(value);
    const isDirty = value !== selectedNote?.content;
    setDirty(isDirty);
    // Sync refs immediately for tab-switch save
    draftRef.current = value;
    dirtyRef.current = isDirty;
    // Update the per-tab dirty state in the map
    if (selectedKey) {
      setDirtyTabsMap((prev) => ({ ...prev, [selectedKey]: isDirty }));
      setDraftsMap((prev) => ({ ...prev, [selectedKey]: value }));
    }
    if (selectedNote) {
      const parsed = parseNoteContent({ ...selectedNote, content: value });
      setNotes((current) =>
        current.map((note) => (getNoteKey(note) === getNoteKey(selectedNote) ? parsed : note)),
      );
    }
  };

  const mainContent = () => {
    if (
      !notes.length &&
      view !== 'settings' &&
      view !== 'docs' &&
      view !== 'roadmap' &&
      view !== 'release' &&
      view !== 'about'
    ) {
      return (
        <EmptyState
          icon={<Sparkles size={32} />}
          title="Start with a vault"
          description="Create a starter vault in a local folder, or open an existing markdown folder. Saving to local folders requires Chrome or Microsoft Edge."
          action={
            <div className="starter-empty-actions">
              <div className="starter-vault-grid compact">
                {starterVaults.map((starter) => (
                  <button
                    key={starter.id}
                    className="starter-vault-card"
                    onClick={() => useStarterVault(starter.id)}
                  >
                    <strong>{starter.name}</strong>
                    <span>
                      {starter.fileCount} files ·{' '}
                      {starter.recommendedRole === 'personal'
                        ? 'Personal'
                        : starter.recommendedRole === 'agent'
                          ? 'Agent'
                          : 'Shared'}{' '}
                      starter
                    </span>
                  </button>
                ))}
              </div>
              <button className="primary-button" onClick={useAllStarterVaults}>
                <Sparkles size={14} /> Load starter kit
              </button>
              <button className="ghost-button" onClick={openVault}>
                <FolderOpen size={14} /> Open existing vault
              </button>
            </div>
          }
        />
      );
    }

    if (view === 'dashboard')
      return (
        <Dashboard notes={notes} stats={stats} onSelectNote={selectNote} onChangeView={setView} />
      );
    if (view === 'graph')
      return <GraphView notes={notes} selectedPath={selectedKey} onSelectNote={selectNote} />;
    if (view === 'tasks')
      return (
        <TasksView
          notes={notes}
          sampleMode={sampleMode}
          agents={agentNotesForTasks}
          taskConversations={taskConversationMeta}
          agentBusyState={agentBusyState}
          activeAgentSessionId={activeAgentSessionId}
          onSelectNote={selectNote}
          onNotesChange={setNotes}
          onPingAgent={handlePingAgent}
          onOpenTaskConversation={handleOpenTaskConversation}
          onOpenAgentsView={() => setView('agents')}
        />
      );
    if (view === 'tags') return <TagsView notes={notes} onSelectNote={selectNote} />;
    if (view === 'agents') return <AgentsView notes={notes} onSelectNote={selectNote} />;
    if (view === 'context')
      return (
        <ContextView notes={notes} selectedNote={selectedNote ?? null} onSelectNote={selectNote} />
      );
    if (view === 'docs') return <DocumentationPage />;
    if (view === 'roadmap') return <RoadmapPage />;
    if (view === 'release') return <ReleasePage version={APP_VERSION} />;
    if (view === 'about') return <AboutPage version={APP_VERSION} onChangeView={setView} />;
    if (view === 'settings')
      return (
        <SettingsView
          vaultName={vaultName}
          sampleMode={sampleMode}
          personalVaultCount={personalVaults.length}
          personalVaultIds={personalVaults.map((vault) => vault.source.id)}
          sharedVaultCount={sharedVaults.length}
          sharedVaultIds={sharedVaults.map((vault) => vault.source.id)}
          agentVaultCount={agentVaults.length}
          agentVaultIds={agentVaults.map((vault) => vault.source.id)}
          savedVaults={savedVaults}
          onOpenVault={openVault}
          onOpenSharedVault={openSharedVault}
          onImportAgentVault={importAgentVault}
          onOpenSavedVault={openSavedVault}
          onMakeDefaultVault={makeDefaultVault}
          onUnplugVault={unplugVault}
          onResetVaultRegistry={resetVaultRegistry}
          currentTheme={currentTheme}
          onChangeTheme={changeTheme}
          showProperties={showProperties}
          onShowPropertiesChange={handleShowPropertiesChange}
          expandFileTree={expandFileTree}
          onExpandFileTreeChange={handleExpandFileTreeChange}
          chatLayout={chatSettings.layout}
          onChatLayoutChange={setChatLayoutPreference}
          appVersion={APP_VERSION}
          onChangeView={setView}
        />
      );
    if (view === 'skills')
      return <SkillsView notes={notes} onSelectNote={selectNote} onEditSkill={handleEditSkill} />;
    if (view === 'memory')
      return <MemoryView notes={notes} onSelectNote={selectNote} onSaveMemory={handleSaveMemory} />;
    if (view === 'tools')
      return (
        <ToolsView
          notes={notes}
          onSelectNote={selectNote}
          onToolPermissionChange={handleToolPermissionChange}
          onRegisterMcpTool={handleRegisterMcpTool}
          onRegisterMarkitdown={handleRegisterMarkitdown}
          onMarkitdownConvert={handleMarkitdownConvert}
        />
      );
    if (view === 'agent-runs')
      return <AgentRunsView notes={notes} onSelectNote={selectNote} onChangeView={setView} />;
    return (
      <div className="editor-view-container">
        <NoteTabs
          tabs={openTabs}
          activeKey={selectedKey}
          dirtyTabs={dirtyTabsMap}
          notes={notes}
          onSelect={selectNote}
          onClose={handleCloseTab}
        />
        <EditorPane
          note={selectedNote}
          draft={draft}
          dirty={dirty}
          mode={editorMode}
          showProperties={showProperties}
          onDraftChange={updateDraft}
          onModeChange={setEditorMode}
          onOpenWikiLink={openWikiLink}
          onRenameNote={requestRenameNote}
          onDeleteNote={requestDeleteNote}
          onCopyPath={copyNotePath}
          onFocusMode={() => setFocusMode((v) => !v)}
        />
      </div>
    );
  };

  const chatAvailable =
    view === 'editor' ||
    view === 'chat' ||
    (chatSettings.open && chatSettings.layout === 'fullpage');
  const chatVisible = chatSettings.open && chatAvailable;

  return (
    <div
      className={`app-shell${chatVisible && chatSettings.layout === 'docked' && view === 'editor' ? ' chat-docked-open' : ''}`}
      style={{ '--chat-width': `${chatSettings.dockedWidth}px` } as CSSProperties}
    >
      <Supergraphic />
      <TopBar
        vaultName={vaultName}
        dirty={dirty}
        canSave={Boolean(selectedNote) && !selectedNote?.readOnly}
        sampleMode={sampleMode}
        onOpenCommandPalette={() => setPaletteOpen(true)}
        onOpenVault={openVault}
        onOpenSharedVault={openSharedVault}
        onImportAgentVault={importAgentVault}
        savedVaults={savedVaults}
        onOpenSavedVault={openSavedVault}
        onCreateNote={createNewNote}
        onRefresh={refreshVault}
        onSave={saveSelectedNote}
        onToggleSidebar={() => {
          if (window.innerWidth <= 899) {
            setMobileNavOpen((v) => !v);
            if (sidebarMinimized) setSidebarMinimized(false);
          } else {
            setSidebarMinimized((v) => !v);
          }
        }}
        onOpenSettings={() => setView('settings')}
        chatOpen={chatVisible}
        onToggleChat={toggleChat}
      />
      {needsWriteGrant && (
        <div className="vault-write-banner" role="status">
          <span className="vault-write-banner-icon" aria-hidden="true">
            <Lock size={14} />
          </span>
          <span className="vault-write-banner-text">
            Personal vault <strong>{needsWriteGrant.name}</strong> is mounted read-only. Click below
            to enable saving.
          </span>
          <button
            className="ghost-button vault-write-banner-action"
            onClick={() => void requestWriteGrant()}
            disabled={grantingWrite}
          >
            <Lock size={13} /> {grantingWrite ? 'Requesting…' : 'Grant write access'}
          </button>
        </div>
      )}
      <div
        className={`workspace${!fileTreeVisible ? ' file-tree-hidden' : ''}${sidebarMinimized ? ' sidebar-minimized' : ''}`}
      >
        <Sidebar
          view={view}
          onChangeView={(v) => {
            setView(v);
            setMobileNavOpen(false);
            if (typeof window !== 'undefined') {
              if (v === 'docs') {
                if (
                  !window.location.hash.startsWith('#/docs') &&
                  !window.location.hash.startsWith('#docs')
                ) {
                  window.location.hash = '#/docs/overview';
                }
              } else if (
                window.location.hash.startsWith('#/docs') ||
                window.location.hash.startsWith('#docs')
              ) {
                history.replaceState(null, '', window.location.pathname + window.location.search);
              }
            }
          }}
          minimized={sidebarMinimized}
          onToggleMinimize={() => setSidebarMinimized((v) => !v)}
          onToggleFileTree={() => setFileTreeVisible((v) => !v)}
          fileTreeVisible={fileTreeVisible}
          mobileOpen={mobileNavOpen}
          onCloseMobile={() => setMobileNavOpen(false)}
        />
        <FileTree
          notes={notes}
          folders={folders}
          selectedPath={selectedKey}
          search={search}
          onSelectNote={selectNote}
          onSearchChange={setSearch}
          onCopyNotePath={copyNotePath}
          onOpenNoteInDefaultApp={openNoteInDefaultApp}
          onRenameNote={requestRenameNote}
          onDeleteNote={requestDeleteNote}
          onCreateNoteInFolder={createNewNote}
          onCreateFolder={createFolderFromTree}
          onRenameFolder={renameFolderFromTree}
          onDeleteFolder={deleteFolderFromTree}
          visible={fileTreeVisible}
          expandAll={expandFileTree}
          searchInputRef={searchInputRef}
        />
        {mainContent()}
      </div>
      <div
        className={`chat-host chat-host--${chatSettings.layout}${chatAvailable ? ' chat-host--available' : ''}${chatVisible ? ' chat-host--open' : ' chat-host--closed'}`}
      >
        <ChatPanel
          notes={notes}
          selectedNote={chatContextNote ?? selectedNote ?? null}
          onSaveOutput={handleSaveChatOutput}
          onSaveMemoryReflection={handleSaveMemoryReflection}
          onCreateTask={handleCreateTaskFromChat}
          onAgentResponse={handleAutoSaveAgentRun}
          personalRootHandle={personalVaults[0]?.handle}
          personalVaultSource={personalVaults[0]?.source}
          layout={chatSettings.layout}
          isOpen={chatVisible}
          onLayoutChange={changeChatLayout}
          onClose={closeChat}
          onOpen={() => updateChatSettings((current) => ({ ...current, open: true }))}
          dockedWidth={chatSettings.dockedWidth}
          onDockedWidthChange={changeChatDockedWidth}
          prefill={chatPrefill}
          onPrefillConsumed={consumeChatPrefill}
          requestedTaskSession={activeTaskConversationRequest}
          onTaskSessionReady={handleTaskSessionReady}
          globalBusyState={agentBusyState}
          activeAgentSessionId={activeAgentSessionId}
          onAgentBusyStateChange={handleAgentBusyStateChange}
          onSaveSessionAsNote={handleSaveChatSession}
          tasks={allTasks}
          taskConversations={taskConversationMeta}
          onOpenTaskConversation={handleOpenTaskConversation}
        />
      </div>
      <footer className="statusbar">
        <span className="statusbar-left">
          <span className="status-msg">{status}</span>
          {view === 'editor' && selectedNote && (
            <span className="status-meta">
              {dirty ? (
                <span className="status-badge status-unsaved">Unsaved</span>
              ) : (
                <span className="status-badge status-saved">Saved</span>
              )}
            </span>
          )}
        </span>
        <span className="statusbar-right">
          <span className="status-hint" title="Keyboard shortcuts">
            {view === 'editor' && selectedNote && <kbd>Ctrl+S</kbd>}
            <kbd>Ctrl+K</kbd> Commands
          </span>
          <span className="status-divider" aria-hidden="true" />
          <span>
            {vaultName} · v{APP_VERSION}
          </span>
        </span>
      </footer>
      <CommandCenter
        open={paletteOpen}
        notes={notes}
        onClose={() => setPaletteOpen(false)}
        onSelectNote={selectNote}
        onChangeView={setView}
        onCreateNote={createNewNote}
        onSave={saveSelectedNote}
        onRefresh={refreshVault}
        onRenameNote={requestRenameNote}
        onDeleteNote={requestDeleteNote}
        canMutateSelectedNote={Boolean(selectedNote) && !selectedNote?.readOnly}
      />
      {noteActionDialog.open && (
        <NoteActionDialog
          mode={noteActionDialog.mode}
          notes={notes.filter((note) => note.vaultRole === 'personal')}
          selectedNote={noteActionTarget ?? selectedNote}
          initialFolder={createNoteFolder}
          onConfirm={(result) => {
            if (noteActionDialog.mode === 'create') confirmCreateNote(result);
            else if (noteActionDialog.mode === 'rename') confirmRenameNote(result);
            else confirmDeleteNote();
            setNoteActionDialog((prev) => ({ ...prev, open: false }));
            setNoteActionTarget(undefined);
          }}
          onCancel={() => {
            setNoteActionDialog((prev) => ({ ...prev, open: false }));
            setNoteActionTarget(undefined);
            setCreateNoteFolder('');
            setPendingCreateVaultId(null);
          }}
        />
      )}
      {personalPickerOpen && personalVaults.length > 1 && (
        <div className="palette-backdrop visible" onMouseDown={() => setPersonalPickerOpen(null)}>
          <div className="note-action-dialog" onMouseDown={(event) => event.stopPropagation()}>
            <div className="dialog-header">
              <h3>Choose a personal vault</h3>
            </div>
            <div className="dialog-body">
              <p style={{ marginTop: 0, color: 'var(--muted)', fontSize: 13 }}>
                {personalPickerOpen.mode === 'create-note'
                  ? 'You have multiple personal vaults mounted. Pick which one the new note should be created in.'
                  : 'Pick the personal vault to create this folder in.'}
              </p>
              <div className="metadata-list spacious">
                {personalVaults.map((vault) => (
                  <div key={vault.source.id} className="saved-vault-row">
                    <div>
                      <strong>{vault.source.name}</strong>
                      <span>
                        {vault.writeGranted ? 'Writable' : 'Read-only — grant write to save'}
                      </span>
                    </div>
                    <div className="saved-vault-actions">
                      <button
                        type="button"
                        className="primary-button"
                        onClick={() => {
                          if (personalPickerOpen.mode === 'create-note') {
                            pickPersonalVaultForCreate(vault.source.id);
                          } else {
                            pickPersonalVaultForFolder(vault.source.id);
                          }
                        }}
                      >
                        Use this vault
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="dialog-footer">
              <button
                type="button"
                className="ghost-button"
                onClick={() => setPersonalPickerOpen(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
