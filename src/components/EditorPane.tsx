import {
  Bot,
  Copy,
  Edit2,
  Eye,
  FileText,
  Focus,
  Home,
  LayoutPanelTop,
  MoreHorizontal,
  PencilLine,
  Trash2,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import type { EditorMode, VaultNote } from '../types';
import { handleMarkdownShortcut } from '../utils/markdownShortcuts';
import { countWords } from '../utils/text';
import { MarkdownPreview } from './MarkdownPreview';

interface EditorPaneProps {
  note?: VaultNote;
  draft: string;
  mode: EditorMode;
  dirty: boolean;
  showProperties: boolean;
  onDraftChange: (value: string) => void;
  onModeChange: (mode: EditorMode) => void;
  onOpenWikiLink: (target: string) => void;
  onRenameNote?: () => void;
  onDeleteNote?: () => void;
  onCopyPath?: () => void;
  onFocusMode?: () => void;
}

const modeItems: Array<{ mode: EditorMode; label: string; icon: typeof PencilLine }> = [
  { mode: 'edit', label: 'Edit', icon: PencilLine },
  { mode: 'split', label: 'Split', icon: LayoutPanelTop },
  { mode: 'preview', label: 'Preview', icon: Eye },
];

function VaultTypeIcon({ role }: { role: VaultNote['vaultRole'] }) {
  if (role === 'agent') return <Bot size={11} aria-hidden="true" />;
  if (role === 'personal') return <Home size={11} aria-hidden="true" />;
  return <Users size={11} aria-hidden="true" />;
}

function getVaultRoleLabel(role: VaultNote['vaultRole']): string {
  if (role === 'agent') return 'Agent Vault';
  if (role === 'personal') return 'Personal Vault';
  return 'Shared Vault';
}

export function EditorPane({
  note,
  draft,
  mode,
  dirty,
  showProperties,
  onDraftChange,
  onModeChange,
  onOpenWikiLink,
  onRenameNote,
  onDeleteNote,
  onCopyPath,
  onFocusMode,
}: EditorPaneProps) {
  const [moreOpen, setMoreOpen] = useState(false);

  if (!note) {
    return (
      <main className="editor-shell no-note">
        <div className="empty-state">
          <div className="empty-icon">
            <FileText size={24} />
          </div>
          <h2>No note selected</h2>
          <p>Choose a markdown file from the sidebar, or create a new note to start writing.</p>
          <small className="empty-hint">
            Tip: Press <kbd>Ctrl+K</kbd> to open the command center.
          </small>
        </div>
      </main>
    );
  }

  const wordCount = countWords(draft);
  const taskCount = note.tasks.length;
  const completedTasks = note.tasks.filter((t) => t.completed).length;

  return (
    <main className="editor-shell">
      {/* Editor header */}
      <div className="editor-header">
        <div className="editor-header-left">
          <div className="editor-breadcrumb">
            <span
              className={`vault-source-pill ${note.vaultRole}`}
              title={`${getVaultRoleLabel(note.vaultRole)}: ${note.vaultName}`}
            >
              <VaultTypeIcon role={note.vaultRole} />
              {getVaultRoleLabel(note.vaultRole)}
            </span>
            <span className="breadcrumb-path">
              {note.vaultName} / {note.path}
            </span>
          </div>
          <h1 className="editor-title">{note.title}</h1>
        </div>

        <div className="editor-header-right">
          {/* Save status */}
          <div className={`save-status ${dirty ? 'unsaved' : 'saved'}`}>
            <span className="save-dot" aria-hidden="true" />
            <span>{note.readOnly ? 'Read-only' : dirty ? 'Unsaved' : 'Saved'}</span>
          </div>

          {/* Mode switcher */}
          <div className="mode-switcher" role="tablist" aria-label="Editor mode">
            {modeItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.mode}
                  role="tab"
                  aria-selected={mode === item.mode}
                  className={mode === item.mode ? 'active' : ''}
                  onClick={() => onModeChange(item.mode)}
                  title={item.label}
                >
                  <Icon size={12} aria-hidden="true" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* More menu */}
          <div className="editor-more-menu">
            <button
              className="icon-btn"
              onClick={() => setMoreOpen((v) => !v)}
              aria-label="More actions"
              aria-expanded={moreOpen}
            >
              <MoreHorizontal size={15} />
            </button>
            {moreOpen && (
              <div className="more-dropdown" role="menu">
                {!note.readOnly && (
                  <button
                    className="more-dropdown-item"
                    role="menuitem"
                    onClick={() => {
                      onRenameNote?.();
                      setMoreOpen(false);
                    }}
                  >
                    <Edit2 size={13} />
                    <span>Rename note</span>
                  </button>
                )}
                <button
                  className="more-dropdown-item"
                  role="menuitem"
                  onClick={() => {
                    onCopyPath?.();
                    setMoreOpen(false);
                  }}
                >
                  <Copy size={13} />
                  <span>Copy path</span>
                </button>
                <button
                  className="more-dropdown-item"
                  role="menuitem"
                  onClick={() => {
                    onFocusMode?.();
                    setMoreOpen(false);
                  }}
                >
                  <Focus size={13} />
                  <span>Focus mode</span>
                </button>
                {!note.readOnly && (
                  <>
                    <div className="more-dropdown-divider" />
                    <button
                      className="more-dropdown-item danger"
                      role="menuitem"
                      onClick={() => {
                        onDeleteNote?.();
                        setMoreOpen(false);
                      }}
                    >
                      <Trash2 size={13} />
                      <span>Delete note</span>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Meta bar */}
      <div className="editor-meta-bar">
        <span>{wordCount} words</span>
        <span className="meta-sep">·</span>
        <span>{note.links.length} outgoing links</span>
        <span className="meta-sep">·</span>
        <span>{note.tags.length} tags</span>
        {taskCount > 0 && (
          <>
            <span className="meta-sep">·</span>
            <span className={completedTasks === taskCount ? 'tasks-done' : ''}>
              {completedTasks}/{taskCount} tasks
            </span>
          </>
        )}
      </div>

      {/* Editor grid */}
      <div className={`editor-grid mode-${mode}`}>
        {mode !== 'preview' ? (
          <textarea
            className="markdown-editor"
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            onKeyDown={(event) => {
              handleMarkdownShortcut(event, draft, onDraftChange);
            }}
            readOnly={note.readOnly}
            spellCheck={false}
            placeholder={
              note.readOnly
                ? 'This vault is read-only.'
                : 'Write markdown. Use Ctrl+B for bold and [[Note Name]] for backlinks.'
            }
            aria-label="Markdown editor"
          />
        ) : null}
        {mode !== 'edit' ? (
          <MarkdownPreview
            content={draft}
            showProperties={showProperties}
            onOpenWikiLink={onOpenWikiLink}
            onDraftChange={note.readOnly ? undefined : onDraftChange}
          />
        ) : null}
      </div>
    </main>
  );
}
