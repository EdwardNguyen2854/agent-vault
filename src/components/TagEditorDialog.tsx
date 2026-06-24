import { useEffect, useState } from 'react';
import { Hash, X } from 'lucide-react';

interface TagEditorDialogProps {
  initialTags: string[];
  onSave: (tags: string[]) => void;
  onCancel: () => void;
}

export function TagEditorDialog({ initialTags, onSave, onCancel }: TagEditorDialogProps) {
  const [input, setInput] = useState(initialTags.join(', '));
  const [tags, setTags] = useState<string[]>(initialTags);

  const parseTags = (value: string): string[] =>
    value
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

  const handleInputChange = (value: string) => {
    setInput(value);
    setTags(parseTags(value));
  };

  const removeTag = (tag: string) => {
    const next = tags.filter((t) => t !== tag);
    setTags(next);
    setInput(next.join(', '));
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(tags);
  };

  return (
    <div className="palette-backdrop visible" onMouseDown={onCancel}>
      <div className="tag-editor-dialog" onMouseDown={(event) => event.stopPropagation()}>
        <form onSubmit={handleSubmit}>
          <h3>
            <Hash size={16} /> Edit Tags
          </h3>

          {/* Tag pills */}
          {tags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
              {tags.map((tag) => (
                <span
                  key={tag}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-full)',
                    background: 'var(--primary-soft)',
                    color: 'var(--primary)',
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                >
                  #{tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      color: 'var(--primary)',
                      display: 'flex',
                      alignItems: 'center',
                      opacity: 0.7,
                    }}
                    aria-label={`Remove tag ${tag}`}
                  >
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="field-group">
            <label htmlFor="tag-editor-input">Tags (comma-separated)</label>
            <input
              id="tag-editor-input"
              type="text"
              value={input}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder="e.g. documentation, reference, archived"
              autoFocus
            />
          </div>

          <div className="dialog-footer">
            <button type="button" className="ghost-button" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className="primary-button">
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
