import { Calendar, CheckCircle2, Circle, Flag, User, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { TaskItem } from '../types';

interface TaskDetailModalProps {
  task: TaskItem;
  onClose: () => void;
  onTaskUpdate: (
    task: TaskItem,
    updates: { completed?: boolean; assignee?: string | null; due?: string | null; priority?: string | null },
  ) => void;
}

export function TaskDetailModal({ task, onClose, onTaskUpdate }: TaskDetailModalProps) {
  const [completed, setCompleted] = useState(task.completed);
  const [assignee, setAssignee] = useState(task.assignee ?? '');
  const [due, setDue] = useState(task.due ?? '');
  const [priority, setPriority] = useState(
    task.text.match(/\bpriority:(high|medium|low)\b/i)?.[1]?.toLowerCase() ?? '',
  );

  // Reset state when task changes
  useEffect(() => {
    setCompleted(task.completed);
    setAssignee(task.assignee ?? '');
    setDue(task.due ?? '');
    setPriority(task.text.match(/\bpriority:(high|medium|low)\b/i)?.[1]?.toLowerCase() ?? '');
  }, [task]);

  // Close on Escape key
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleSave = () => {
    onTaskUpdate(task, {
      completed,
      assignee: assignee.trim() || null,
      due: due.trim() || null,
      priority: priority || null,
    });
    onClose();
  };

  const isDirty =
    completed !== task.completed ||
    assignee !== (task.assignee ?? '') ||
    due !== (task.due ?? '') ||
    priority !==
      (task.text.match(/\bpriority:(high|medium|low)\b/i)?.[1]?.toLowerCase() ?? '');

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal-container task-detail-modal" onMouseDown={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <h3>
            {completed ? <CheckCircle2 size={16} /> : <Circle size={16} />}
            Task Details
          </h3>
          <button className="modal-close" onClick={onClose} aria-label="Close modal">
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="modal-body">
          {/* Task text (read-only) */}
          <div className="modal-field">
            <span className="modal-field-label">Task</span>
            <div className="task-detail-text">{task.text}</div>
          </div>

          {/* Source note */}
          <div className="modal-field">
            <span className="modal-field-label">Source</span>
            <div className="task-detail-source">
              <span className="task-detail-source-note">{task.noteTitle}</span>
              <span className="task-detail-source-line">line {task.line}</span>
            </div>
          </div>

          {/* Completed toggle */}
          <div className="modal-field">
            <span className="modal-field-label">Status</span>
            <button
              type="button"
              className={`task-detail-toggle ${completed ? 'completed' : 'active'}`}
              onClick={() => setCompleted(!completed)}
            >
              {completed ? (
                <>
                  <CheckCircle2 size={14} />
                  Completed
                </>
              ) : (
                <>
                  <Circle size={14} />
                  Active
                </>
              )}
            </button>
          </div>

          <div className="modal-field-grid">
            {/* Due date */}
            <div className="modal-field">
              <span className="modal-field-label">
                <Calendar size={11} /> Due Date
              </span>
              <input
                type="date"
                className="modal-input"
                value={due}
                onChange={(e) => setDue(e.target.value)}
                aria-label="Due date"
              />
            </div>

            {/* Priority */}
            <div className="modal-field">
              <span className="modal-field-label">
                <Flag size={11} /> Priority
              </span>
              <select
                className="modal-select"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                aria-label="Priority"
              >
                <option value="">None</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>

          {/* Assignee */}
          <div className="modal-field">
            <span className="modal-field-label">
              <User size={11} /> Assignee
            </span>
            <input
              type="text"
              className="modal-input"
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              placeholder="e.g. AgentName"
              aria-label="Assignee"
            />
          </div>

          {/* Tags (read-only) */}
          {task.tags.length > 0 && (
            <div className="modal-field">
              <span className="modal-field-label">Tags</span>
              <div className="task-detail-tags">
                {task.tags.map((tag) => (
                  <span key={tag} className="task-tag-pill">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Task ID */}
          <div className="modal-field">
            <span className="modal-field-label">Task ID</span>
            <code className="task-detail-id">{task.id}</code>
          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button type="button" className="ghost-button" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="primary-button"
            disabled={!isDirty}
            onClick={handleSave}
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
