import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, FilePlus2, Trash2, Type } from 'lucide-react';
import type { VaultNote } from '../types';
import { normalizeVaultPath, validateVaultPath, pathExists } from '../utils/paths';

interface NoteActionDialogProps {
  mode: 'create' | 'rename' | 'delete';
  notes: VaultNote[];
  selectedNote?: VaultNote;
  initialFolder?: string;
  onConfirm: (result: { path: string; title?: string }) => void;
  onCancel: () => void;
}

type ValidationState = {
  valid: boolean;
  normalizedPath?: string;
  error?: string;
};

export function NoteActionDialog({
  mode,
  notes,
  selectedNote,
  initialFolder = '',
  onConfirm,
  onCancel,
}: NoteActionDialogProps) {
  // Form state
  const [title, setTitle] = useState('');
  const [folder, setFolder] = useState('');
  const [pathInput, setPathInput] = useState('');

  // Initialize form based on mode
  useEffect(() => {
    if (mode === 'rename' && selectedNote) {
      setPathInput(selectedNote.path);
    } else if (mode === 'create') {
      setTitle('');
      setFolder(initialFolder);
    }
    // Delete mode doesn't need any input initialization
  }, [mode, selectedNote, initialFolder]);

  // Compute backlink count for the selected note
  const backlinkCount = useMemo(() => {
    if (!selectedNote) return 0;
    const normalizedTarget = normalizeVaultPath(selectedNote.path).toLowerCase();
    return notes.filter((note) => {
      if (note.path === selectedNote.path) return false;
      return note.links.some(
        (link) => normalizeVaultPath(link.target).toLowerCase() === normalizedTarget,
      );
    }).length;
  }, [notes, selectedNote]);

  // Compute validation state for create/rename
  const validation = useMemo<ValidationState>(() => {
    if (mode === 'delete') return { valid: true };

    const inputPath =
      mode === 'create'
        ? folder
          ? `${folder}/${title || 'Untitled'}`
          : title || 'Untitled'
        : pathInput;

    const pathValidation = validateVaultPath(inputPath);
    if (!pathValidation.valid) {
      return { valid: false, error: pathValidation.error };
    }

    if (!pathValidation.normalizedPath) {
      return { valid: false, error: 'Invalid path' };
    }

    // Check for path conflicts (only for create and rename)
    const normalizedPath = pathValidation.normalizedPath;
    const isConflict = notes.some((note) => {
      // In rename mode, allow the current note's path
      if (mode === 'rename' && note.path === selectedNote?.path) return false;
      return note.path.toLowerCase() === normalizedPath.toLowerCase();
    });

    if (isConflict) {
      return { valid: false, error: 'A note with this path already exists' };
    }

    return { valid: true, normalizedPath };
  }, [mode, title, folder, pathInput, notes, selectedNote]);

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validation.valid) return;

    if (mode === 'delete') {
      onConfirm({ path: selectedNote!.path });
    } else if (mode === 'create') {
      onConfirm({ path: validation.normalizedPath!, title });
    } else {
      onConfirm({ path: validation.normalizedPath! });
    }
  };

  // Close on Escape key
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  // Compute path preview for create/rename
  const pathPreview = useMemo(() => {
    if (mode === 'delete') return null;
    const inputPath =
      mode === 'create'
        ? folder
          ? `${folder}/${title || 'Untitled'}`
          : title || 'Untitled'
        : pathInput;
    const result = validateVaultPath(inputPath);
    return result.valid ? result.normalizedPath : null;
  }, [mode, title, folder, pathInput]);

  return (
    <div className="palette-backdrop visible" onMouseDown={onCancel}>
      <div className="note-action-dialog" onMouseDown={(event) => event.stopPropagation()}>
        {/* Header */}
        <div className="dialog-header">
          {mode === 'create' && (
            <>
              <FilePlus2 size={18} />
              <span>Create Note</span>
            </>
          )}
          {mode === 'rename' && (
            <>
              <Type size={18} />
              <span>Rename Note</span>
            </>
          )}
          {mode === 'delete' && (
            <>
              <Trash2 size={18} />
              <span>Delete Note</span>
            </>
          )}
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="dialog-body">
          {mode === 'create' && (
            <>
              <div className="field-group">
                <label htmlFor="note-title">Title</label>
                <input
                  id="note-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Note title"
                  autoFocus
                />
              </div>
              <div className="field-group">
                <label htmlFor="note-folder">Folder (optional)</label>
                <input
                  id="note-folder"
                  type="text"
                  value={folder}
                  onChange={(e) => setFolder(e.target.value)}
                  placeholder="e.g., Projects/Alpha"
                />
              </div>
              {pathPreview && (
                <div className="path-preview">
                  <span className="path-preview-label">Path:</span>
                  <code>{pathPreview}</code>
                </div>
              )}
            </>
          )}

          {mode === 'rename' && (
            <>
              <div className="field-group">
                <label htmlFor="note-path">New Path</label>
                <input
                  id="note-path"
                  type="text"
                  value={pathInput}
                  onChange={(e) => setPathInput(e.target.value)}
                  placeholder="note-name.md"
                  autoFocus
                />
              </div>
              {pathPreview && (
                <div className="path-preview">
                  <span className="path-preview-label">Normalized:</span>
                  <code>{pathPreview}</code>
                </div>
              )}
              {selectedNote && (
                <div className="original-path">
                  <span className="path-preview-label">Original:</span>
                  <code>{selectedNote.path}</code>
                </div>
              )}
            </>
          )}

          {mode === 'delete' && selectedNote && (
            <>
              <div className="delete-summary">
                <p className="delete-warning-text">Delete this note? This cannot be undone.</p>
                <div className="delete-note-info">
                  <strong>{selectedNote.title}</strong>
                  <code className="delete-path">{selectedNote.path}</code>
                </div>
              </div>
            </>
          )}

          {/* Validation error */}
          {validation.error && (
            <div className="validation-error">
              <AlertTriangle size={14} />
              <span>{validation.error}</span>
            </div>
          )}

          {/* Backlink warning */}
          {backlinkCount > 0 && mode !== 'create' && (
            <div className="backlink-warning">
              <AlertTriangle size={14} />
              <span>
                {mode === 'rename'
                  ? `This note has ${backlinkCount} inbound link${backlinkCount > 1 ? 's' : ''}. Links will be updated automatically.`
                  : `Warning: ${backlinkCount} note${backlinkCount > 1 ? 's' : ''} link${backlinkCount > 1 ? 's' : ''} to this note.`}
              </span>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="dialog-footer">
          <button type="button" className="ghost-button" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="submit"
            className={`primary-button ${mode === 'delete' ? 'danger' : ''}`}
            disabled={!validation.valid}
            onClick={handleSubmit}
          >
            {mode === 'create' && 'Create'}
            {mode === 'rename' && 'Rename'}
            {mode === 'delete' && 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}
