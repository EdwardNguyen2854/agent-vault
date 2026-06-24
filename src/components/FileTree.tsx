import {
  Bot,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Circle,
  Copy,
  Edit2,
  ExternalLink,
  FilePlus2,
  FileText,
  FolderPlus,
  Home,
  MousePointer2,
  Search,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
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
  visible?: boolean;
  expandAll?: boolean;
}

interface TreeNode {
  name: string;
  path: string;
  vaultRole?: VaultNote['vaultRole'];
  vaultId?: string;
  folderPath?: string;
  readOnly?: boolean;
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
  source: Pick<VaultFolder, 'vaultId' | 'vaultName' | 'vaultRole' | 'readOnly'>,
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
      children: [],
      notes: [],
    };
    root.push(vaultNode);
  }
  return vaultNode;
}

function ensureFolderNode(
  parent: TreeNode,
  folder: Pick<VaultFolder, 'vaultId' | 'readOnly'>,
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
      children: [],
      notes: [],
    };
    parent.children.push(node);
  }
  return node;
}

function buildTree(notes: VaultNote[], folders: VaultFolder[]): TreeNode[] {
  const root: TreeNode[] = [];

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
}: TreeItemProps) {
  const isCollapsed = collapsed.has(node.path);
  const hasFolderNote = Boolean(node.folderNote);
  const isFolderActive = hasFolderNote && selectedPath === getNoteKey(node.folderNote!);
  const hasFolderRow = node.children.length > 0 || hasFolderNote;
  const isVaultRow = Boolean(node.vaultRole);
  const vaultRoleLabel = getVaultRoleLabel(node.vaultRole);
  const childLevel = level + (hasFolderRow ? 1 : 0);
  const folderPadding = TREE_BASE_INDENT + level * TREE_LEVEL_INDENT;
  const notePadding = TREE_BASE_INDENT + level * TREE_LEVEL_INDENT + TREE_LABEL_OFFSET;

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
  visible = true,
  expandAll = true,
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
  const [extFilter, setExtFilter] = useState<string | null>(null);
  const dragging = useRef(false);
  const previewTimeoutRef = useRef<number | null>(null);
  const hideTimeoutRef = useRef<number | null>(null);

  const filteredByExt = extFilter ? notes.filter((n) => n.extension === extFilter) : notes;
  const filteredNotes = search.trim()
    ? searchNotes(filteredByExt, search).map((r) => r.note)
    : filteredByExt;

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
        <span>Notes</span>
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
          type="search"
          value={search}
          onChange={(event) => onSearchChange?.(event.target.value)}
          placeholder="Filter notes"
          aria-label="Filter notes"
        />
        {search.trim() && (
          <button
            className="file-tree-search-clear"
            onClick={() => onSearchChange?.('')}
            aria-label="Clear note filter"
          >
            <X size={11} />
          </button>
        )}
      </div>

      <div className="file-tree-ext-filter">
        {(['md', 'txt', 'json', 'yaml', 'csv'] as const).map((ext) => (
          <button
            key={ext}
            className={`ghost-button${extFilter === ext ? ' active' : ''}`}
            onClick={() => setExtFilter(extFilter === ext ? null : ext)}
          >
            .{ext}
          </button>
        ))}
        {extFilter && (
          <button className="ghost-button" onClick={() => setExtFilter(null)}>
            Clear
          </button>
        )}
      </div>

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
        </div>
      )}
      <div className="file-tree-resize-handle" onMouseDown={handleResizeStart} />
    </aside>
  );
}
