import {
  Bot,
  CheckSquare,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Circle,
  Copy,
  Edit2,
  ExternalLink,
  File,
  FilePlus2,
  FileText,
  FolderPlus,
  Home,
  MousePointer2,
  Search,
  SlidersHorizontal,
  Square,
  Tag,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { VaultFolder, VaultNote } from '../types';
import { getNoteKey } from '../utils/noteKey';
import { searchNotes } from '../utils/search';
import { AGENT_FOLDER_NOTE_FILENAMES, getPinnedRank } from '../utils/vault';

const FILE_TREE_MIN = 160;
const FILE_TREE_MAX = 500;
const FILE_TREE_DEFAULT = 240;
const TREE_BASE_INDENT = 6;
const TREE_LEVEL_INDENT = 12;
const TREE_LABEL_OFFSET = 17;
const FILE_TREE_COLLAPSED_KEY = 'agent-vault-file-tree-collapsed';

function loadCollapsedSet(): Set<string> {
  try {
    const raw = localStorage.getItem(FILE_TREE_COLLAPSED_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed))
      return new Set(parsed.filter((entry): entry is string => typeof entry === 'string'));
  } catch {
    /* ignore */
  }
  return new Set();
}

function saveCollapsedSet(set: Set<string>): void {
  try {
    localStorage.setItem(FILE_TREE_COLLAPSED_KEY, JSON.stringify([...set]));
  } catch {
    /* ignore */
  }
}

function getFileTreeMaxWidth(): number {
  if (typeof window === 'undefined' || window.innerWidth >= 1280) return FILE_TREE_MAX;
  return Math.max(FILE_TREE_MIN, Math.min(FILE_TREE_MAX, Math.floor(window.innerWidth * 0.34)));
}

function clampFileTreeWidth(width: number): number {
  return Math.max(FILE_TREE_MIN, Math.min(getFileTreeMaxWidth(), width));
}

interface FileTreeProps {
  notes: VaultNote[];
  folders?: VaultFolder[];
  selectedPath?: string;
  search: string;
  onSelectNote: (path: string) => void;
  onSearchChange?: (value: string) => void;
  onCopyNotePath?: (note: VaultNote) => void;
  onOpenNoteInDefaultApp?: (note: VaultNote) => void;
  onRenameNote?: (note: VaultNote) => void;
  onDeleteNote?: (note: VaultNote) => void;
  onCreateNoteInFolder?: (folderPath: string) => void;
  onCreateFolder?: (parentPath: string) => void;
  onRenameFolder?: (folderPath: string) => void;
  onDeleteFolder?: (folderPath: string) => void;
  onEditFolderTags?: (vaultId: string, folderPath: string, currentTags: string[]) => void;
  visible?: boolean;
  expandAll?: boolean;
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
}

interface TreeNode {
  name: string;
  path: string;
  vaultRole?: VaultNote['vaultRole'];
  vaultId?: string;
  folderPath?: string;
  readOnly?: boolean;
  tags: string[];
  children: TreeNode[];
  notes: VaultNote[];
  folderNote?: VaultNote;
}

function VaultTypeIcon({ role }: { role?: VaultNote['vaultRole'] }) {
  if (role === 'agent')
    return <Bot size={11} className="vault-type-icon agent" aria-hidden="true" />;
  if (role === 'personal')
    return <Home size={11} className="vault-type-icon personal" aria-hidden="true" />;
  if (role === 'shared')
    return <Users size={11} className="vault-type-icon shared" aria-hidden="true" />;
  return null;
}

function getVaultRoleLabel(role?: VaultNote['vaultRole']): string | null {
  if (role === 'agent') return 'Agent';
  if (role === 'personal') return 'Personal';
  if (role === 'shared') return 'Shared';
  return null;
}

function ensureVaultNode(
  root: TreeNode[],
  source: Pick<VaultFolder, 'vaultId' | 'vaultName' | 'vaultRole' | 'readOnly' | 'tags'>,
): TreeNode {
  const vaultPath = `vault:${source.vaultId}`;
  let vaultNode = root.find((node) => node.path === vaultPath);
  if (!vaultNode) {
    vaultNode = {
      name: source.vaultName,
      path: vaultPath,
      vaultRole: source.vaultRole,
      vaultId: source.vaultId,
      folderPath: '',
      readOnly: source.readOnly,
      tags: source.tags ?? [],
      children: [],
      notes: [],
    };
    root.push(vaultNode);
  }
  return vaultNode;
}

function ensureFolderNode(
  parent: TreeNode,
  folder: Pick<VaultFolder, 'vaultId' | 'readOnly' | 'tags'>,
  parts: string[],
  index: number,
): TreeNode {
  const folderPath = parts.slice(0, index + 1).join('/');
  const nodePath = `vault:${folder.vaultId}/${folderPath}`;
  let node = parent.children.find((child) => child.path === nodePath);
  if (!node) {
    node = {
      name: parts[index],
      path: nodePath,
      vaultId: folder.vaultId,
      folderPath,
      readOnly: folder.readOnly,
      tags: folder.tags ?? [],
      children: [],
      notes: [],
    };
    parent.children.push(node);
  }
  return node;
}

function buildTree(notes: VaultNote[], folders: VaultFolder[]): TreeNode[] {
  const root: TreeNode[] = [];

  // Build a lookup of folder-path → tags for fast merging
  const folderTagsByVault = new Map<string, Map<string, string[]>>();
  for (const folder of folders) {
    if (!folder.path) continue;
    let vaultMap = folderTagsByVault.get(folder.vaultId);
    if (!vaultMap) {
      vaultMap = new Map();
      folderTagsByVault.set(folder.vaultId, vaultMap);
    }
    vaultMap.set(folder.path.toLowerCase(), folder.tags ?? []);
  }

  for (const folder of folders) {
    const parts = folder.path.split('/').filter(Boolean);
    if (!parts.length) continue;
    let current = ensureVaultNode(root, folder);
    for (let i = 0; i < parts.length; i++) {
      current = ensureFolderNode(current, folder, parts, i);
    }
  }

  for (const note of notes) {
    const vaultNode = ensureVaultNode(root, note);
    const parts = note.path.split('/');
    let currentParent = vaultNode;

    let isFolderNote = false;
    const noteName = parts[parts.length - 1].replace(/\.md$/i, '');
    const basename = parts[parts.length - 1];
    if (parts.length === 1) {
      if (noteName.toLowerCase() === 'index' || noteName.toLowerCase() === 'home') {
        vaultNode.folderNote = note;
        continue;
      }
      if (note.vaultRole === 'agent') {
        const lower = basename.toLowerCase();
        if (
          (AGENT_FOLDER_NOTE_FILENAMES as readonly string[]).some(
            (name) => name.toLowerCase() === lower,
          )
        ) {
          vaultNode.folderNote = note;
          continue;
        }
      }
    }
    if (parts.length >= 2) {
      const folderName = parts[parts.length - 2];
      isFolderNote = noteName === folderName || noteName.toLowerCase() === 'index';
      if (!isFolderNote && note.vaultRole === 'agent') {
        const lower = basename.toLowerCase();
        isFolderNote = (AGENT_FOLDER_NOTE_FILENAMES as readonly string[]).some(
          (name) => name.toLowerCase() === lower,
        );
      }
    }

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      let node = currentParent.children.find((n) => n.name === part);
      if (!node) node = ensureFolderNode(currentParent, note, parts, i);

      // Merge folder tags from the lookup if available
      const vaultTags = folderTagsByVault.get(note.vaultId);
      if (vaultTags && node.tags.length === 0) {
        const nodeFolderPath = parts.slice(0, i + 1).join('/').toLowerCase();
        const foundTags = vaultTags.get(nodeFolderPath);
        if (foundTags && foundTags.length > 0) {
          node.tags = foundTags;
        }
      }

      if (isFolderNote && i === parts.length - 2) {
        node.folderNote = note;
      }
      currentParent = node;
    }

    if (!isFolderNote) {
      currentParent.children.push({
        name: parts[parts.length - 1],
        path: getNoteKey(note),
        vaultId: note.vaultId,
        readOnly: note.readOnly,
        tags: [],
        children: [],
        notes: [note],
      });
    }
  }

  return root;
}

function sortTree(nodes: TreeNode[]): TreeNode[] {
  return [...nodes]
    .map((node) => ({
      ...node,
      children: sortTree(node.children),
      notes: [...node.notes].sort((a, b) => a.title.localeCompare(b.title)),
    }))
    .sort((a, b) => {
      const aRank = getPinnedRank(a.name);
      const bRank = getPinnedRank(b.name);
      if (aRank >= 0 && bRank >= 0) return aRank - bRank;
      if (aRank >= 0) return -1;
      if (bRank >= 0) return 1;
      if (a.vaultRole !== b.vaultRole) {
        const roleOrder: Record<string, number> = { agent: 0, personal: 1, shared: 2 };
        return (roleOrder[a.vaultRole ?? ''] ?? 3) - (roleOrder[b.vaultRole ?? ''] ?? 3);
      }
      const aHasChildren = a.children.length > 0 || a.notes.length > 0 || !!a.folderNote;
      const bHasChildren = b.children.length > 0 || b.notes.length > 0 || !!b.folderNote;
      if (aHasChildren && !bHasChildren) return -1;
      if (!aHasChildren && bHasChildren) return 1;
      return a.name.localeCompare(b.name);
    });
}

function collectAncestorPaths(
  nodes: TreeNode[],
  target: string,
  ancestors: string[] = [],
): string[] | null {
  for (const node of nodes) {
    if (node.path === target) return ancestors;
    const inNotes = node.notes.some((note) => getNoteKey(note) === target);
    if (inNotes) return ancestors;
    const found = collectAncestorPaths(node.children, target, [...ancestors, node.path]);
    if (found) return found;
  }
  return null;
}

interface TreeItemProps {
  node: TreeNode;
  level: number;
  selectedPath?: string;
  collapsed: Set<string>;
  onToggle: (path: string) => void;
  onSelect: (path: string) => void;
  onContextMenu: (note: VaultNote, event: React.MouseEvent<HTMLElement>) => void;
  onFolderContextMenu: (node: TreeNode, event: React.MouseEvent<HTMLElement>) => void;
  onHoverStart: (note: VaultNote, element: HTMLElement) => void;
  onHoverEnd: () => void;
  onEditFolderTags?: (vaultId: string, folderPath: string, currentTags: string[]) => void;
}

function TreeItem({
  node,
  level,
  selectedPath,
  collapsed,
  onToggle,
  onSelect,
  onContextMenu,
  onFolderContextMenu,
  onHoverStart,
  onHoverEnd,
  onEditFolderTags,
}: TreeItemProps) {
  const isCollapsed = collapsed.has(node.path);
  const hasFolderNote = Boolean(node.folderNote);
  const isFolderActive = hasFolderNote && selectedPath === getNoteKey(node.folderNote!);
  const hasFolderRow = node.children.length > 0 || hasFolderNote || node.tags.length > 0;
  const isVaultRow = Boolean(node.vaultRole);
  const vaultRoleLabel = getVaultRoleLabel(node.vaultRole);
  const childLevel = level + (hasFolderRow ? 1 : 0);
  const folderPadding = TREE_BASE_INDENT + level * TREE_LEVEL_INDENT;
  const notePadding = TREE_BASE_INDENT + level * TREE_LEVEL_INDENT + TREE_LABEL_OFFSET;
  const hasTags = node.tags.length > 0;

  return (
    <div>
      {hasFolderRow ? (
        <div
          className={`folder-row ${isVaultRow ? `vault-row vault-${node.vaultRole}` : ''} ${isCollapsed ? 'collapsed' : ''} ${hasFolderNote ? 'has-folder-note' : ''} ${isFolderActive ? 'active' : ''}`}
          style={{ paddingLeft: `${folderPadding}px` }}
          onClick={() => {
            if (hasFolderNote) {
              onSelect(getNoteKey(node.folderNote!));
            } else {
              onToggle(node.path);
            }
          }}
          onContextMenu={(e) => onFolderContextMenu(node, e)}
        >
          <span
            className="folder-chevron"
            onClick={(e) => {
              e.stopPropagation();
              onToggle(node.path);
            }}
          >
            <ChevronRight size={10} className="chevron" />
          </span>
          <VaultTypeIcon role={node.vaultRole} />
          {hasFolderNote && !isVaultRow && <FileText size={10} className="folder-note-icon" />}
          <span className="folder-name">{node.name}</span>
          {vaultRoleLabel && (
            <span className={`vault-type-badge ${node.vaultRole}`}>{vaultRoleLabel}</span>
          )}
          {hasTags && (
            <span className="folder-tag-badge" title={node.tags.map((t) => `#${t}`).join(', ')}>
              <Tag size={8} />
            </span>
          )}
          <span className="note-count">
            {node.children.reduce((acc, c) => acc + c.notes.length, 0) + node.notes.length}
          </span>
        </div>
      ) : null}
      {node.notes.map((note) => (
        <button
          className={`note-row ${selectedPath === getNoteKey(note) ? 'active' : ''}`}
          key={getNoteKey(note)}
          style={{ paddingLeft: `${notePadding}px` }}
          onClick={() => onSelect(getNoteKey(note))}
          onContextMenu={(e) => onContextMenu(note, e)}
          onMouseEnter={(e) => onHoverStart(note, e.currentTarget)}
          onMouseLeave={onHoverEnd}
          title={note.path}
        >
            {note.isBinary ? <File size={11} className="note-row-icon" /> : null}
            <span className="note-row-title">{note.title}</span>
          {note.tags.length ? <Circle size={5} className="tag-dot" /> : null}
        </button>
      ))}
      {!isCollapsed &&
        node.children.map((child) => (
          <TreeItem
            key={child.path}
            node={child}
            level={childLevel}
            selectedPath={selectedPath}
            collapsed={collapsed}
            onToggle={onToggle}
            onSelect={onSelect}
            onContextMenu={onContextMenu}
            onFolderContextMenu={onFolderContextMenu}
            onHoverStart={onHoverStart}
            onHoverEnd={onHoverEnd}
            onEditFolderTags={onEditFolderTags}
          />
        ))}
    </div>
  );
}

interface PreviewState {
  note: VaultNote;
  position: { top: number; left: number };
}

interface NoteContextMenuState {
  type: 'note';
  note: VaultNote;
  position: { top: number; left: number };
}

interface FolderContextMenuState {
  type: 'folder';
  node: TreeNode;
  position: { top: number; left: number };
}

type ContextMenuState = NoteContextMenuState | FolderContextMenuState;

const ALL_EXTENSIONS = ['md', 'txt', 'json', 'yaml', 'csv', 'pdf', 'doc', 'docx', 'ppt', 'pptx'];
const ALL_EXTENSIONS_SET = new Set(ALL_EXTENSIONS);
const EXTENSION_GROUPS: Array<{ label: string; extensions: string[] }> = [
  { label: 'Text', extensions: ['md', 'txt', 'json', 'yaml', 'csv'] },
  { label: 'Documents', extensions: ['pdf', 'doc', 'docx', 'ppt', 'pptx'] },
];

function ExtensionFilterModal({
  allExtensions,
  extensionCounts,
  selected,
  onToggle,
  onSelectAll,
  onClearAll,
  onClose,
}: {
  allExtensions: string[];
  extensionCounts: Map<string, number>;
  selected: Set<string>;
  onToggle: (ext: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  onClose: () => void;
}) {
  return (
    <div className="palette-backdrop visible" onMouseDown={onClose}>
      <div
        className="ext-filter-dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="dialog-header">
          <SlidersHorizontal size={16} />
          <span>Filter by extension</span>
        </div>
        <div className="dialog-body">
          <div className="ext-filter-actions">
            <button className="ghost-button" onClick={onSelectAll}>
              Select All
            </button>
            <button className="ghost-button" onClick={onClearAll}>
              Clear All
            </button>
            {selected.size > 0 && (
              <span className="ext-filter-active-count">
                {selected.size} active
              </span>
            )}
          </div>
          {EXTENSION_GROUPS.map((group) => (
            <div key={group.label} className="ext-filter-group">
              <div className="ext-filter-group-label">{group.label}</div>
              <div className="ext-filter-group-items">
                {group.extensions.map((ext) => {
                  const count = extensionCounts.get(ext) ?? 0;
                  const isChecked = selected.has(ext);
                  return (
                    <label key={ext} className={`ext-filter-item${isChecked ? ' checked' : ''}`}>
                      <span
                        className="ext-filter-checkbox"
                        onClick={() => onToggle(ext)}
                      >
                        {isChecked ? <CheckSquare size={14} /> : <Square size={14} />}
                      </span>
                      <span className="ext-filter-ext">.{ext}</span>
                      <span className="ext-filter-count">{count}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
          {allExtensions.some((ext) => !ALL_EXTENSIONS_SET.has(ext)) && (
            <div className="ext-filter-group">
              <div className="ext-filter-group-label">Other</div>
              <div className="ext-filter-group-items">
                {allExtensions
                  .filter((ext) => !ALL_EXTENSIONS_SET.has(ext))
                  .map((ext) => (
                    <label
                      key={ext}
                      className={`ext-filter-item${selected.has(ext) ? ' checked' : ''}`}
                    >
                      <span
                        className="ext-filter-checkbox"
                        onClick={() => onToggle(ext)}
                      >
                        {selected.has(ext) ? <CheckSquare size={14} /> : <Square size={14} />}
                      </span>
                      <span className="ext-filter-ext">.{ext}</span>
                      <span className="ext-filter-count">{extensionCounts.get(ext) ?? 0}</span>
                    </label>
                  ))}
              </div>
            </div>
          )}
        </div>
        <div className="dialog-footer">
          <button className="primary-button" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

export function FileTree({
  notes,
  folders = [],
  selectedPath,
  search,
  onSelectNote,
  onSearchChange,
  onCopyNotePath,
  onOpenNoteInDefaultApp,
  onRenameNote,
  onDeleteNote,
  onCreateNoteInFolder,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onEditFolderTags,
  visible = true,
  expandAll = true,
  searchInputRef,
}: FileTreeProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() =>
    expandAll ? new Set() : loadCollapsedSet(),
  );
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [treeWidth, setTreeWidth] = useState(() => {
    try {
      const saved = localStorage.getItem('fileTreeWidth');
      if (saved) return clampFileTreeWidth(Number(saved));
    } catch {
      /* ignore */
    }
    return clampFileTreeWidth(FILE_TREE_DEFAULT);
  });
  const [extFilter, setExtFilter] = useState<Set<string>>(new Set());
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const dragging = useRef(false);
  const previewTimeoutRef = useRef<number | null>(null);
  const hideTimeoutRef = useRef<number | null>(null);

  const filteredByExt = extFilter.size > 0
    ? notes.filter((n) => extFilter.has(n.extension))
    : notes;
  const filteredNotes = search.trim()
    ? searchNotes(filteredByExt, search).map((r) => r.note)
    : filteredByExt;

  const extensionCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const ext of ALL_EXTENSIONS) map.set(ext, 0);
    for (const n of notes) {
      if (map.has(n.extension)) map.set(n.extension, map.get(n.extension)! + 1);
    }
    return map;
  }, [notes]);

  const tree = sortTree(buildTree(filteredNotes, folders));

  useEffect(() => {
    if (expandAll) {
      setCollapsed((prev) => (prev.size === 0 ? prev : new Set()));
    } else {
      setCollapsed((prev) => {
        const stored = loadCollapsedSet();
        if (prev.size === stored.size && [...prev].every((p) => stored.has(p))) return prev;
        return stored;
      });
    }
  }, [expandAll]);

  useEffect(() => {
    if (expandAll) return;
    saveCollapsedSet(collapsed);
  }, [collapsed, expandAll]);

  useEffect(() => {
    if (!selectedPath) return;
    const ancestors = collectAncestorPaths(tree, selectedPath);
    if (!ancestors || ancestors.length === 0) return;
    setCollapsed((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const path of ancestors) {
        if (next.delete(path)) changed = true;
      }
      return changed ? next : prev;
    });
  }, [selectedPath, tree]);

  const toggleFolder = (path: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const toggleAllFolders = useCallback(() => {
    if (collapsed.size === 0) {
      // All expanded → collapse all
      const allPaths: string[] = [];
      const collect = (nodes: TreeNode[]) => {
        for (const n of nodes) {
          if (n.children.length > 0 || n.folderNote) {
            allPaths.push(n.path);
            collect(n.children);
          }
        }
      };
      collect(tree);
      setCollapsed(new Set(allPaths));
    } else {
      // Some or all collapsed → expand all
      setCollapsed(new Set());
    }
  }, [collapsed.size, tree]);

  const handleHoverStart = useCallback((note: VaultNote, element: HTMLElement) => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    previewTimeoutRef.current = window.setTimeout(() => {
      const rect = element.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      let left = rect.right + 12;
      if (left + 260 > viewportWidth - 20) {
        left = rect.left - 260 - 12;
      }
      setPreview({
        note,
        position: { top: rect.top, left },
      });
    }, 500);
  }, []);

  const handleHoverEnd = useCallback(() => {
    if (previewTimeoutRef.current) {
      clearTimeout(previewTimeoutRef.current);
      previewTimeoutRef.current = null;
    }
    hideTimeoutRef.current = window.setTimeout(() => {
      setPreview(null);
    }, 100);
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleNoteContextMenu = useCallback(
    (note: VaultNote, event: React.MouseEvent<HTMLElement>) => {
      event.preventDefault();
      event.stopPropagation();
      if (previewTimeoutRef.current) {
        clearTimeout(previewTimeoutRef.current);
        previewTimeoutRef.current = null;
      }
      setPreview(null);

      const menuWidth = 210;
      const menuHeight = 128;
      const left = Math.min(event.clientX, window.innerWidth - menuWidth - 8);
      const top = Math.min(event.clientY, window.innerHeight - menuHeight - 8);
      setContextMenu({
        type: 'note',
        note,
        position: {
          top: Math.max(8, top),
          left: Math.max(8, left),
        },
      });
    },
    [],
  );

  const handleFolderContextMenu = useCallback(
    (node: TreeNode, event: React.MouseEvent<HTMLElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setPreview(null);

      const menuWidth = 230;
      const menuHeight = 190;
      const left = Math.min(event.clientX, window.innerWidth - menuWidth - 8);
      const top = Math.min(event.clientY, window.innerHeight - menuHeight - 8);
      setContextMenu({
        type: 'folder',
        node,
        position: {
          top: Math.max(8, top),
          left: Math.max(8, left),
        },
      });
    },
    [],
  );

  const handlePreviewMouseEnter = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  }, []);

  const handlePreviewMouseLeave = useCallback(() => {
    hideTimeoutRef.current = window.setTimeout(() => {
      setPreview(null);
    }, 150);
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty('--file-tree-width', `${treeWidth}px`);
    try {
      localStorage.setItem('fileTreeWidth', String(treeWidth));
    } catch {
      /* ignore */
    }
  }, [treeWidth]);

  useEffect(() => {
    const onResize = () => {
      setTreeWidth((width) => clampFileTreeWidth(width));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (!contextMenu) return;

    const onPointerDown = () => closeContextMenu();
    const onScroll = () => closeContextMenu();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeContextMenu();
    };

    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [contextMenu, closeContextMenu]);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      const sidebarNavEl = document.querySelector('.sidebar');
      const sidebarNavWidth = sidebarNavEl ? sidebarNavEl.getBoundingClientRect().width : 0;
      const newWidth = clampFileTreeWidth(ev.clientX - sidebarNavWidth);
      setTreeWidth(newWidth);
    };

    const onUp = () => {
      dragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  useEffect(() => {
    return () => {
      if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current);
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
      dragging.current = false;
    };
  }, []);

  const getPreviewContent = (note: VaultNote): string => {
    const body = note.content
      .replace(/^#+\s+.+$/gm, '')
      .replace(/\*\*|__/g, '')
      .replace(/\*|_/g, '')
      .replace(/\[\[([^\]|]+)(\|[^\]]+)?\]\]/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/`[^`]+`/g, '')
      .replace(/```[\s\S]+?```/g, '')
      .replace(/^\s*[-*+]\s+/gm, '')
      .replace(/^\s*>\s+/gm, '')
      .replace(/\n+/g, ' ')
      .trim();
    return body.slice(0, 100) + (body.length > 100 ? '...' : '');
  };

  if (!visible) return null;

  return (
    <aside className="file-tree-panel" aria-label="File tree">
      <div className="sidebar-section-title">
        <span>Workspaces</span>
        <span>{search.trim() ? `${filteredNotes.length}/${notes.length}` : notes.length}</span>
        <button
          className="icon-btn"
          onClick={toggleAllFolders}
          title={collapsed.size === 0 ? 'Collapse all folders' : 'Expand all folders'}
          aria-label={collapsed.size === 0 ? 'Collapse all folders' : 'Expand all folders'}
        >
          {collapsed.size === 0 ? <ChevronsUpDown size={11} /> : <ChevronsDownUp size={11} />}
        </button>
      </div>

      <div className="file-tree-search">
        <Search size={12} aria-hidden="true" />
        <input
          ref={searchInputRef}
          type="search"
          value={search}
          onChange={(event) => onSearchChange?.(event.target.value)}
          placeholder="Filter workspaces"
          aria-label="Filter workspaces"
        />
        {search.trim() && (
          <button
            className="file-tree-search-clear"
            onClick={() => onSearchChange?.('')}
            aria-label="Clear workspace filter"
          >
            <X size={11} />
          </button>
        )}
      </div>

      <div className="file-tree-ext-filter">
        <button
          className={`ghost-button filter-toggle${extFilter.size > 0 ? ' active' : ''}`}
          onClick={() => setFilterModalOpen(true)}
          title="Filter by extension"
        >
          <SlidersHorizontal size={11} />
          {extFilter.size > 0 && <span className="filter-count">{extFilter.size}</span>}
        </button>
      </div>

      {filterModalOpen && (
        <ExtensionFilterModal
          allExtensions={ALL_EXTENSIONS}
          extensionCounts={extensionCounts}
          selected={extFilter}
          onToggle={(ext) => {
            const next = new Set(extFilter);
            if (next.has(ext)) next.delete(ext);
            else next.add(ext);
            setExtFilter(next);
          }}
          onSelectAll={() => setExtFilter(new Set(ALL_EXTENSIONS))}
          onClearAll={() => setExtFilter(new Set())}
          onClose={() => setFilterModalOpen(false)}
        />
      )}

      <div className="file-tree">
        {tree.map((node) => (
          <TreeItem
            key={node.path}
            node={node}
            level={0}
            selectedPath={selectedPath}
            collapsed={collapsed}
            onToggle={toggleFolder}
            onSelect={onSelectNote}
            onContextMenu={handleNoteContextMenu}
            onFolderContextMenu={handleFolderContextMenu}
            onHoverStart={handleHoverStart}
            onHoverEnd={handleHoverEnd}
            onEditFolderTags={onEditFolderTags}
          />
        ))}
      </div>

      {preview && (
        <div
          className="sidebar-preview visible"
          style={{
            top: preview.position.top,
            left: preview.position.left,
          }}
          onMouseEnter={handlePreviewMouseEnter}
          onMouseLeave={handlePreviewMouseLeave}
        >
          <div className="preview-header">
            <h4>{preview.note.title}</h4>
            <button
              className="preview-close"
              onClick={() => setPreview(null)}
              aria-label="Close preview"
            >
              <X size={12} />
            </button>
          </div>
          <div className="preview-content">
            <p>{getPreviewContent(preview.note)}</p>
          </div>
          {preview.note.tags.length > 0 && (
            <div className="preview-footer">
              {preview.note.tags.slice(0, 5).map((tag) => (
                <span key={tag} className="preview-tag">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
      {contextMenu?.type === 'note' && (
        <div
          className="note-context-menu"
          role="menu"
          aria-label={`Actions for ${contextMenu.note.title}`}
          style={{
            top: contextMenu.position.top,
            left: contextMenu.position.left,
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="note-context-menu-item"
            role="menuitem"
            onClick={() => {
              onSelectNote(getNoteKey(contextMenu.note));
              closeContextMenu();
            }}
          >
            <MousePointer2 size={13} />
            Open note
          </button>
          {!contextMenu.note.readOnly && (
            <button
              type="button"
              className="note-context-menu-item"
              role="menuitem"
              onClick={() => {
                onRenameNote?.(contextMenu.note);
                closeContextMenu();
              }}
            >
              <Edit2 size={13} />
              Rename note
            </button>
          )}
          <button
            type="button"
            className="note-context-menu-item"
            role="menuitem"
            onClick={() => {
              onCopyNotePath?.(contextMenu.note);
              closeContextMenu();
            }}
          >
            <Copy size={13} />
            Copy path
          </button>
          <button
            type="button"
            className="note-context-menu-item"
            role="menuitem"
            onClick={() => {
              onOpenNoteInDefaultApp?.(contextMenu.note);
              closeContextMenu();
            }}
          >
            <ExternalLink size={13} />
            Open in default app
          </button>
          {!contextMenu.note.readOnly && (
            <button
              type="button"
              className="note-context-menu-item danger"
              role="menuitem"
              onClick={() => {
                onDeleteNote?.(contextMenu.note);
                closeContextMenu();
              }}
            >
              <Trash2 size={13} />
              Delete note
            </button>
          )}
        </div>
      )}
      {contextMenu?.type === 'folder' && (
        <div
          className="note-context-menu"
          role="menu"
          aria-label={`Actions for ${contextMenu.node.name}`}
          style={{
            top: contextMenu.position.top,
            left: contextMenu.position.left,
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="note-context-menu-item"
            role="menuitem"
            disabled={contextMenu.node.readOnly}
            onClick={() => {
              onCreateNoteInFolder?.(contextMenu.node.folderPath ?? '');
              closeContextMenu();
            }}
          >
            <FilePlus2 size={13} />
            Create note
          </button>
          <button
            type="button"
            className="note-context-menu-item"
            role="menuitem"
            disabled={contextMenu.node.readOnly}
            onClick={() => {
              onCreateFolder?.(contextMenu.node.folderPath ?? '');
              closeContextMenu();
            }}
          >
            <FolderPlus size={13} />
            Create folder
          </button>
          {!contextMenu.node.vaultRole && (
            <button
              type="button"
              className="note-context-menu-item"
              role="menuitem"
              disabled={contextMenu.node.readOnly}
              onClick={() => {
                onRenameFolder?.(contextMenu.node.folderPath ?? '');
                closeContextMenu();
              }}
            >
              <Edit2 size={13} />
              Rename folder
            </button>
          )}
          {!contextMenu.node.vaultRole && (
            <button
              type="button"
              className="note-context-menu-item danger"
              role="menuitem"
              disabled={contextMenu.node.readOnly}
              onClick={() => {
                onDeleteFolder?.(contextMenu.node.folderPath ?? '');
                closeContextMenu();
              }}
            >
              <Trash2 size={13} />
              Delete folder
            </button>
          )}
          <div className="context-menu-divider" />
          <button
            type="button"
            className="note-context-menu-item"
            role="menuitem"
            disabled={contextMenu.node.readOnly}
            onClick={() => {
              closeContextMenu();
              onEditFolderTags?.(
                contextMenu.node.vaultId ?? '',
                contextMenu.node.folderPath ?? '',
                contextMenu.node.tags,
              );
            }}
          >
            <Tag size={13} />
            Edit tags
          </button>
        </div>
      )}
      <div className="file-tree-resize-handle" onMouseDown={handleResizeStart} />
    </aside>
  );
}
