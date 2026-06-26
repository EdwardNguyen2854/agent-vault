import { useState } from 'react';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ChevronRight,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Focus,
  Hash,
  Info,
  Link2,
  Network,
  Tag as TagIcon,
  X,
} from 'lucide-react';
import type { GraphNode, VaultNote } from '../../types';
import { getNoteKey } from '../../utils/noteKey';
import { buildBacklinks } from '../../utils/markdown/graph';

interface GraphInspectorProps {
  open: boolean;
  node: GraphNode | null;
  note: VaultNote | null;
  notes: VaultNote[];
  incomingCount: number;
  outgoingCount: number;
  localOnly: boolean;
  accentColor: string;
  onClose: () => void;
  onOpenInEditor: () => void;
  onShowLocal: () => void;
  onJumpTo: (path: string) => void;
}

type InspectorTab = 'connections' | 'backlinks' | 'tags' | 'info';

export function GraphInspector({
  open,
  node,
  note,
  notes,
  incomingCount,
  outgoingCount,
  localOnly,
  accentColor,
  onClose,
  onOpenInEditor,
  onShowLocal,
  onJumpTo,
}: GraphInspectorProps) {
  const [tab, setTab] = useState<InspectorTab>('connections');

  const backlinks = note ? buildBacklinks(notes, note) : [];
  const outgoing = note
    ? note.links
        .map((link) => ({
          link,
          target: notes.find(
            (candidate) => candidate.title === link.target || candidate.path === link.target,
          ),
        }))
        .filter((entry) => entry.target)
    : [];

  const folderParts = note ? note.path.split('/').filter(Boolean) : [];
  const crumbParts = folderParts.slice(0, -1);

  return (
    <aside
      className={`graph-inspector ${open && node ? 'open' : ''}`}
      aria-hidden={!(open && node)}
      aria-label="Selected node details"
    >
      {node && (
        <>
          <div
            className="graph-inspector-head"
            style={{ '--inspector-accent': accentColor } as React.CSSProperties}
          >
            <div className="graph-inspector-id">
              <span className={`graph-inspector-icon ${node.type === 'missing' ? 'missing' : ''}`}>
                {node.type === 'missing' ? <FileText size={14} /> : <Network size={14} />}
              </span>
              <div className="graph-inspector-id-text">
                <h3 title={node.title}>{node.title}</h3>
                <code title={node.path}>{node.path}</code>
              </div>
            </div>
            <button
              type="button"
              className="graph-inspector-close"
              onClick={onClose}
              aria-label="Close inspector"
            >
              <X size={13} />
            </button>
          </div>

          {note && crumbParts.length > 0 && (
            <div className="graph-inspector-crumbs" aria-label="Folder path">
              {crumbParts.map((part, index) => (
                <span key={`${part}-${index}`} className="graph-inspector-crumb">
                  {part}
                  {index < crumbParts.length - 1 && <ChevronRight size={10} />}
                </span>
              ))}
            </div>
          )}

          <div className="graph-inspector-stats">
            <div className="graph-inspector-stat" title="Incoming links">
              <ArrowDownToLine size={13} />
              <span className="graph-inspector-stat-value">{incomingCount}</span>
              <span className="graph-inspector-stat-label">Incoming</span>
            </div>
            <div className="graph-inspector-stat" title="Outgoing links">
              <ArrowUpFromLine size={13} />
              <span className="graph-inspector-stat-value">{outgoingCount}</span>
              <span className="graph-inspector-stat-label">Outgoing</span>
            </div>
            <div className="graph-inspector-stat" title="Backlinks from notes">
              <Link2 size={13} />
              <span className="graph-inspector-stat-value">{backlinks.length}</span>
              <span className="graph-inspector-stat-label">Backlinks</span>
            </div>
          </div>

          <div className="graph-inspector-tabs" role="tablist">
            {(
              [
                { key: 'connections', label: 'Connections' },
                { key: 'backlinks', label: 'Backlinks' },
                { key: 'tags', label: 'Tags' },
                { key: 'info', label: 'Info' },
              ] as { key: InspectorTab; label: string }[]
            ).map((entry) => (
              <button
                key={entry.key}
                type="button"
                role="tab"
                aria-selected={tab === entry.key}
                className={`graph-inspector-tab ${tab === entry.key ? 'active' : ''}`}
                onClick={() => setTab(entry.key)}
              >
                {entry.label}
              </button>
            ))}
          </div>

          <div className="graph-inspector-body">
            {tab === 'connections' && (
              <>
                {outgoing.length === 0 ? (
                  <p className="graph-inspector-hint">No outgoing links.</p>
                ) : (
                  <ul className="graph-inspector-list">
                    {outgoing.slice(0, 30).map((entry) => {
                      const targetNote = entry.target as VaultNote;
                      return (
                        <li key={`${entry.link.raw}-${targetNote.path}`}>
                          <button
                            type="button"
                            className="graph-inspector-link"
                            onClick={() => onJumpTo(getNoteKey(targetNote))}
                          >
                            <ArrowUpFromLine size={11} />
                            <span>{targetNote.title}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </>
            )}

            {tab === 'backlinks' && (
              <>
                {backlinks.length === 0 ? (
                  <p className="graph-inspector-hint">No notes link to this one yet.</p>
                ) : (
                  <ul className="graph-inspector-list">
                    {backlinks.map((item) => (
                      <li key={item.sourceKey}>
                        <button
                          type="button"
                          className="graph-inspector-link"
                          onClick={() => onJumpTo(item.sourceKey)}
                        >
                          <ArrowDownToLine size={11} />
                          <span>{item.sourceTitle}</span>
                        </button>
                        {item.excerpts[0] && (
                          <p className="graph-inspector-excerpt">{item.excerpts[0]}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}

            {tab === 'tags' && (
              <>
                {note && note.tags.length > 0 ? (
                  <div className="graph-inspector-tags">
                    {note.tags.map((tag) => (
                      <span key={tag} className="graph-inspector-tag">
                        <Hash size={9} />
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="graph-inspector-hint">No tags on this note.</p>
                )}
              </>
            )}

            {tab === 'info' && note && (
              <dl className="graph-inspector-info">
                <div>
                  <dt>
                    <Info size={11} /> Path
                  </dt>
                  <dd>{note.path}</dd>
                </div>
                <div>
                  <dt>
                    <Network size={11} /> Vault
                  </dt>
                  <dd>{note.vaultName}</dd>
                </div>
                <div>
                  <dt>
                    <TagIcon size={11} /> Tags
                  </dt>
                  <dd>{note.tags.length}</dd>
                </div>
                <div>
                  <dt>
                    <FileText size={11} /> Size
                  </dt>
                  <dd>{(note.size / 1024).toFixed(1)} KB</dd>
                </div>
                <div>
                  <dt>
                    <Link2 size={11} /> Links
                  </dt>
                  <dd>{note.links.length}</dd>
                </div>
              </dl>
            )}
            {tab === 'info' && !note && (
              <p className="graph-inspector-hint">
                This note is missing. Resolve the link to open it.
              </p>
            )}
          </div>

          <div className="graph-inspector-actions">
            {node.type !== 'missing' && (
              <button
                type="button"
                className="graph-inspector-btn primary"
                onClick={onOpenInEditor}
              >
                <ExternalLink size={13} /> Open note
              </button>
            )}
            {node.type === 'missing' && (
              <button
                type="button"
                className="graph-inspector-btn primary"
                onClick={onOpenInEditor}
              >
                <ExternalLink size={13} /> Resolve link
              </button>
            )}
            <button
              type="button"
              className={`graph-inspector-btn ${localOnly ? 'active' : ''}`}
              onClick={onShowLocal}
              disabled={localOnly || incomingCount + outgoingCount === 0}
            >
              {localOnly ? <Eye size={13} /> : <Focus size={13} />}{' '}
              {localOnly ? 'Local active' : 'Show local'}
            </button>
          </div>
        </>
      )}
    </aside>
  );
}
