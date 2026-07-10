import {
  Calendar,
  CheckCircle2,
  Circle,
  Flag,
  MessageSquare,
  Tag,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { TaskItem, VaultNote } from '../types';
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  buildCommentTree,
  createComment,
  defaultTaskDetail,
  type TaskComment,
  type TaskDetail,
  type TaskPriority,
  type TaskStatus,
} from '../utils/taskDetails';

export interface AgentOption {
  id: string;
  name: string;
  avatar?: string;
  noteKey: string;
}

export interface TaskDetailModalProps {
  task: TaskItem;
  detail: TaskDetail;
  agents: AgentOption[];
  authorId: string;
  onClose: () => void;
  onSave: (next: TaskDetail) => Promise<void> | void;
  onOpenConversation?: (task: TaskItem) => void;
}

type SaveState = 'idle' | 'saving' | 'error';

export function TaskDetailModal({
  task,
  detail,
  agents,
  authorId,
  onClose,
  onSave,
  onOpenConversation,
}: TaskDetailModalProps) {
  const [draft, setDraft] = useState<TaskDetail>(() => withDefaults(detail, task));
  const [assigneeQuery, setAssigneeQuery] = useState('');
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [state, setState] = useState<SaveState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setDraft(withDefaults(detail, task));
    setErrorMessage(null);
    setState('idle');
  }, [detail, task]);

  useEffect(() => {
    lastFocusedRef.current = document.activeElement as HTMLElement | null;
    const frame = window.requestAnimationFrame(() => {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    return () => {
      lastFocusedRef.current?.focus?.();
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
      if (event.key === 'Tab' && containerRef.current) {
        const focusable = containerRef.current.querySelectorAll<HTMLElement>(
          'input, select, textarea, button, [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!first || !last) return;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const isDirty = useMemo(() => {
    return !isSameDetail(draft, detail);
  }, [draft, detail]);

  const matchedAgents = useMemo(() => {
    const query = assigneeQuery.trim().toLowerCase();
    if (!query) return agents;
    return agents.filter(
      (agent) =>
        agent.name.toLowerCase().includes(query) ||
        agent.id.toLowerCase().includes(query),
    );
  }, [agents, assigneeQuery]);

  const visibleComments = useMemo(() => buildCommentTree(draft.comments), [draft.comments]);

  const setField = <K extends keyof TaskDetail>(key: K, value: TaskDetail[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const addLabel = (raw: string) => {
    const label = raw.trim().replace(/^#/, '');
    if (!label) return;
    if (draft.labels.includes(label)) return;
    setField('labels', [...draft.labels, label]);
  };

  const removeLabel = (label: string) => {
    setField(
      'labels',
      draft.labels.filter((existing) => existing !== label),
    );
  };

  const submitComment = () => {
    const body = newComment.trim();
    if (!body) return;
    const comment = createComment(authorId, 'You', body, replyTo ?? undefined);
    setDraft((current) => ({
      ...current,
      comments: [...current.comments, comment],
    }));
    setNewComment('');
    setReplyTo(null);
  };

  const removeComment = (commentId: string) => {
    setDraft((current) => ({
      ...current,
      comments: current.comments
        .filter((comment) => comment.id !== commentId && comment.parentId !== commentId),
    }));
  };

  const editCommentBody = (commentId: string, body: string) => {
    setDraft((current) => ({
      ...current,
      comments: current.comments.map((comment) =>
        comment.id === commentId
          ? { ...comment, body, updatedAt: new Date().toISOString() }
          : comment,
      ),
    }));
  };

  const handleSave = async () => {
    setState('saving');
    setErrorMessage(null);
    try {
      const normalized: TaskDetail = {
        ...draft,
        title: draft.title.trim() || task.text.trim(),
        labels: draft.labels.map((label) => label.trim()).filter(Boolean),
        updatedAt: new Date().toISOString(),
      };
      await onSave(normalized);
      setState('idle');
    } catch (err) {
      setState('error');
      setErrorMessage(err instanceof Error ? err.message : 'Failed to save task.');
    }
  };

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={containerRef}
        className="modal-container task-detail-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-detail-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <h3 id="task-detail-title">
            {draft.status === 'done' ? (
              <CheckCircle2 size={16} />
            ) : draft.status === 'in_progress' ? (
              <Circle size={16} />
            ) : (
              <Flag size={16} />
            )}
            Task Details
          </h3>
          <button className="modal-close" onClick={onClose} aria-label="Close modal">
            <X size={14} />
          </button>
        </div>

        <div className="modal-body">
          <div className="modal-field">
            <label htmlFor="task-title" className="modal-field-label">
              Title
            </label>
            <input
              ref={titleInputRef}
              id="task-title"
              type="text"
              className="modal-input"
              value={draft.title}
              onChange={(event) => setField('title', event.target.value)}
              placeholder={task.text}
              maxLength={200}
            />
          </div>

          <div className="modal-field">
            <label htmlFor="task-description" className="modal-field-label">
              Description
            </label>
            <textarea
              id="task-description"
              className="modal-textarea"
              value={draft.description}
              onChange={(event) => setField('description', event.target.value)}
              rows={3}
              placeholder="Add context, links, or acceptance criteria"
            />
          </div>

          <div className="modal-field-grid">
            <div className="modal-field">
              <span className="modal-field-label">Status</span>
              <select
                className="modal-select"
                value={draft.status}
                onChange={(event) => setField('status', event.target.value as TaskStatus)}
                aria-label="Status"
              >
                {TASK_STATUSES.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="modal-field">
              <span className="modal-field-label">
                <Flag size={11} /> Priority
              </span>
              <select
                className="modal-select"
                value={draft.priority ?? ''}
                onChange={(event) =>
                  setField(
                    'priority',
                    event.target.value ? (event.target.value as TaskPriority) : undefined,
                  )
                }
                aria-label="Priority"
              >
                <option value="">None</option>
                {TASK_PRIORITIES.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="modal-field-grid">
            <div className="modal-field">
              <span className="modal-field-label">
                <Calendar size={11} /> Due date &amp; time
              </span>
              <div className="modal-input-row">
                <input
                  type="datetime-local"
                  className="modal-input"
                  value={draft.dueAt ? toLocalDateTimeInputValue(draft.dueAt) : ''}
                  onChange={(event) =>
                    setField(
                      'dueAt',
                      event.target.value ? new Date(event.target.value).toISOString() : undefined,
                    )
                  }
                  aria-label="Due date and time"
                />
                {draft.dueAt && (
                  <button
                    type="button"
                    className="ghost-button small"
                    onClick={() => setField('dueAt', undefined)}
                    aria-label="Clear due date"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div className="modal-field">
              <span className="modal-field-label">
                <User size={11} /> Assignee
              </span>
                <input
                  type="text"
                  className="modal-input"
                  value={assigneeQuery}
                  placeholder="Search agents"
                  onChange={(event) => setAssigneeQuery(event.target.value)}
                  aria-label="Search agents"
                />
                <select
                  className="modal-select"
                  value={draft.assigneeId ?? ''}
                  onChange={(event) => {
                    const selected = agents.find((agent) => agent.noteKey === event.target.value);
                    if (selected) {
                      setField('assigneeId', selected.noteKey);
                      setField('assigneeName', selected.name);
                      setAssigneeQuery('');
                    } else {
                      setField('assigneeId', undefined);
                      setField('assigneeName', undefined);
                    }
                  }}
                  aria-label="Assignee"
                >
                  <option value="">Unassigned</option>
                  {matchedAgents.map((agent) => (
                    <option key={agent.noteKey} value={agent.noteKey}>
                      {agent.avatar ? `${agent.avatar} ${agent.name}` : agent.name}
                    </option>
                  ))}
                </select>
            </div>
          </div>

          <div className="modal-field">
            <span className="modal-field-label">
              <Tag size={11} /> Labels
            </span>
            <div className="task-detail-labels">
              {draft.labels.length === 0 && (
                <span className="task-detail-empty">No labels yet</span>
              )}
              {draft.labels.map((label) => (
                <span key={label} className="task-tag-pill removable">
                  #{label}
                  <button
                    type="button"
                    onClick={() => removeLabel(label)}
                    aria-label={`Remove label ${label}`}
                  >
                    <X size={9} />
                  </button>
                </span>
              ))}
            </div>
            <LabelInput onAdd={addLabel} />
          </div>

          <div className="modal-field">
            <span className="modal-field-label">Source</span>
            <div className="task-detail-source">
              <span className="task-detail-source-note">{task.noteTitle}</span>
              <span className="task-detail-source-line">line {task.line}</span>
              <code className="task-detail-id">{task.id}</code>
            </div>
          </div>

          <div className="modal-field">
            <span className="modal-field-label">
              <MessageSquare size={11} /> Comments ({draft.comments.length})
            </span>
            <div className="task-detail-comments">
              {visibleComments.length === 0 && (
                <p className="task-detail-empty">No comments yet.</p>
              )}
              {visibleComments.map(({ comment, replies }) => (
                <CommentThread
                  key={comment.id}
                  comment={comment}
                  replies={replies}
                  authorId={authorId}
                  replyTo={replyTo}
                  setReplyTo={setReplyTo}
                  newComment={newComment}
                  setNewComment={setNewComment}
                  onSubmit={submitComment}
                  onRemove={removeComment}
                  onEdit={editCommentBody}
                />
              ))}
            </div>
          </div>

          {errorMessage && (
            <div className="task-detail-error" role="alert">
              {errorMessage}
            </div>
          )}
        </div>

        <div className="modal-footer">
          {onOpenConversation && (
            <button
              type="button"
              className="ghost-button"
              onClick={() => onOpenConversation(task)}
            >
              Open chat
            </button>
          )}
          <button type="button" className="ghost-button" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="primary-button"
            disabled={!isDirty || state === 'saving'}
            onClick={handleSave}
          >
            {state === 'saving' ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CommentThread({
  comment,
  replies,
  authorId,
  replyTo,
  setReplyTo,
  newComment,
  setNewComment,
  onSubmit,
  onRemove,
  onEdit,
}: {
  comment: TaskComment;
  replies: TaskComment[];
  authorId: string;
  replyTo: string | null;
  setReplyTo: (value: string | null) => void;
  newComment: string;
  setNewComment: (value: string) => void;
  onSubmit: () => void;
  onRemove: (id: string) => void;
  onEdit: (id: string, body: string) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBodies, setEditBodies] = useState<Record<string, string>>({});
  const isRootMine = comment.authorId === authorId;
  const editBodyFor = (id: string, fallback: string) => editBodies[id] ?? fallback;
  const renderComment = (c: TaskComment) => {
    const isEditing = editingId === c.id;
    return (
      <CommentItem
        key={c.id}
        comment={c}
        isMine={c.authorId === authorId}
        editing={isEditing}
        editBody={editBodyFor(c.id, c.body)}
        setEditBody={(v) => setEditBodies((prev) => ({ ...prev, [c.id]: v }))}
        onEdit={() => {
          setEditingId(c.id);
          setEditBodies((prev) => ({ ...prev, [c.id]: c.body }));
        }}
        onSaveEdit={() => {
          const body = editBodies[c.id]?.trim();
          if (body) { onEdit(c.id, body); }
          setEditingId(null);
          setEditBodies((prev) => {
            const next = { ...prev };
            delete next[c.id];
            return next;
          });
        }}
        onCancelEdit={() => {
          setEditingId(null);
          setEditBodies((prev) => {
            const next = { ...prev };
            delete next[c.id];
            return next;
          });
        }}
        onRemove={() => onRemove(c.id)}
        onReply={() => setReplyTo(replyTo === comment.id ? null : comment.id)}
      />
    );
  };
  return (
    <div className="task-comment-thread">
      {renderComment(comment)}
      {replies.length > 0 && (
        <div className="task-comment-replies">
          {replies.map((reply) => renderComment(reply))}
        </div>
      )}
      {replyTo === comment.id && (
        <div className="task-comment-reply-input">
          <textarea
            className="modal-textarea"
            value={newComment}
            onChange={(event) => setNewComment(event.target.value)}
            placeholder="Reply…"
            rows={2}
            aria-label="Reply text"
          />
          <div className="task-comment-reply-actions">
            <button
              type="button"
              className="ghost-button small"
              onClick={() => {
                setReplyTo(null);
                setNewComment('');
              }}>
              Cancel
            </button>
            <button
              type="button"
              className="primary-button small"
              disabled={!newComment.trim()}
              onClick={onSubmit}>
              Reply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CommentItem({
  comment,
  isMine,
  editing,
  editBody,
  setEditBody,
  onEdit,
  onSaveEdit,
  onCancelEdit,
  onRemove,
  onReply,
}: {
  comment: TaskComment;
  isMine: boolean;
  editing: boolean;
  editBody: string;
  setEditBody: (value: string) => void;
  onEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onRemove: () => void;
  onReply: () => void;
}) {
  return (
    <div className="task-comment">
      <div className="task-comment-meta">
        <strong>{comment.authorName}</strong>
        <time dateTime={comment.createdAt}>
          {new Date(comment.createdAt).toLocaleString()}
        </time>
        {comment.updatedAt && <span className="task-comment-edited">(edited)</span>}
      </div>
      {editing ? (
        <div className="task-comment-edit">
          <textarea
            className="modal-textarea"
            value={editBody}
            onChange={(event) => setEditBody(event.target.value)}
            rows={2}
          />
          <div className="task-comment-reply-actions">
            <button type="button" className="ghost-button small" onClick={onCancelEdit}>
              Cancel
            </button>
            <button
              type="button"
              className="primary-button small"
              onClick={onSaveEdit}
              disabled={!editBody.trim()}
            >
              Save
            </button>
          </div>
        </div>
      ) : (
        <p className="task-comment-body">{comment.body}</p>
      )}
      <div className="task-comment-actions">
        <button type="button" className="ghost-button small" onClick={onReply}>
          Reply
        </button>
        {isMine && !editing && (
          <button type="button" className="ghost-button small" onClick={onEdit}>
            Edit
          </button>
        )}
        {isMine && (
          <button
            type="button"
            className="ghost-button small danger"
            onClick={onRemove}
            aria-label="Delete comment"
          >
            <Trash2 size={10} />
          </button>
        )}
      </div>
    </div>
  );
}

function LabelInput({ onAdd }: { onAdd: (label: string) => void }) {
  const [value, setValue] = useState('');
  return (
    <div className="task-detail-label-input">
      <input
        type="text"
        className="modal-input"
        placeholder="Add label and press Enter"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            onAdd(value);
            setValue('');
          }
        }}
        aria-label="Add label"
      />
    </div>
  );
}

function withDefaults(detail: TaskDetail, task: TaskItem): TaskDetail {
  if (detail.taskId !== task.id) {
    return { ...defaultTaskDetail(task.id), title: task.text };
  }
  return { ...detail, title: detail.title || task.text };
}

function isSameDetail(a: TaskDetail, b: TaskDetail): boolean {
  return (
    a.title === b.title &&
    a.description === b.description &&
    a.status === b.status &&
    a.priority === b.priority &&
    sameArray(a.labels, b.labels) &&
    a.assigneeId === b.assigneeId &&
    a.assigneeName === b.assigneeName &&
    a.dueAt === b.dueAt &&
    sameComments(a.comments, b.comments)
  );
}

function sameArray(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function sameComments(a: TaskComment[], b: TaskComment[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (
      a[i].id !== b[i].id ||
      a[i].body !== b[i].body ||
      a[i].authorId !== b[i].authorId ||
      a[i].parentId !== b[i].parentId
    ) {
      return false;
    }
  }
  return true;
}

function toLocalDateTimeInputValue(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => `${n}`.padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function agentsFromNotes(notes: VaultNote[]): AgentOption[] {
  const seen = new Set<string>();
  const options: AgentOption[] = [];
  for (const note of notes) {
    const isAgent =
      note.frontmatter.type === 'agent' || note.tags.includes('agent');
    if (!isAgent) continue;
    if (seen.has(note.path)) continue;
    seen.add(note.path);
    const avatarRaw = note.frontmatter.avatar;
    options.push({
      id: note.title,
      name: note.title,
      avatar: typeof avatarRaw === 'string' ? avatarRaw : undefined,
      noteKey: `${note.vaultId}:${note.path}`,
    });
  }
  options.sort((a, b) => a.name.localeCompare(b.name));
  return options;
}
