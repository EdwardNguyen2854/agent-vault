import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  hint?: string;
}

export function EmptyState({ icon, title, description, action, hint }: EmptyStateProps) {
  return (
    <div className="empty-state">
      {icon ? <div className="empty-icon">{icon}</div> : null}
      <h2>{title}</h2>
      <p>{description}</p>
      {hint && <small className="empty-hint">{hint}</small>}
      {action ? <div className="empty-action">{action}</div> : null}
    </div>
  );
}
