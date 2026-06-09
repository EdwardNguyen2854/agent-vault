import { AlertTriangle, ShieldCheck, ShieldOff, Terminal, X, Infinity } from 'lucide-react';
import {
  formatPermission,
  formatRisk,
  getPermissionColorClass,
  getRiskColorClass,
} from '../utils/tools';
import type { Tool } from '../types';

export type PermissionDecision = 'deny' | 'allow_once' | 'allow_session' | 'always_allow';

interface AskPermissionDialogProps {
  tool: Tool;
  input: unknown;
  onResolve: (decision: PermissionDecision) => void;
  onClose: () => void;
}

export function AskPermissionDialog({ tool, input, onResolve, onClose }: AskPermissionDialogProps) {
  const riskClass = getRiskColorClass(tool.risk);

  return (
    <>
      <div className="modal-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="modal-container" role="dialog" aria-label={`Permission for ${tool.name}`}>
        <div className="modal-header">
          <h3>
            <ShieldCheck size={16} /> Tool Permission Required
          </h3>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <X size={15} />
          </button>
        </div>

        <div className="modal-body">
          <div className="permission-tool-info">
            <div className="agent-avatar large">
              <Terminal size={24} />
            </div>
            <div>
              <h4>{tool.name}</h4>
              <code>{tool.id}</code>
            </div>
          </div>

          {tool.description && <p className="detail-drawer-description">{tool.description}</p>}

          <div className="tool-meta-badges" style={{ margin: 'var(--space-3) 0' }}>
            <span className={`permission-badge ${getPermissionColorClass(tool.permission)}`}>
              {formatPermission(tool.permission)}
            </span>
            <span className={`risk-badge ${riskClass}`}>{formatRisk(tool.risk)}</span>
            <span className="provider-badge">
              {tool.provider === 'mcp' ? (tool.server ? `MCP: ${tool.server}` : 'MCP') : 'Internal'}
            </span>
          </div>

          {tool.risk === 'high' && (
            <div className="permission-warning">
              <AlertTriangle size={14} />
              <span>
                This is a <strong>high-risk</strong> tool. Review the input carefully.
              </span>
            </div>
          )}

          <div className="detail-drawer-section">
            <h4>Input</h4>
            <pre className="schema-block">{JSON.stringify(input, null, 2)}</pre>
          </div>
        </div>

        <div className="modal-footer">
          <button className="ghost-button permission-deny" onClick={() => onResolve('deny')}>
            <ShieldOff size={13} /> Deny
          </button>
          <button className="secondary-button" onClick={() => onResolve('allow_once')}>
            <ShieldCheck size={13} /> Allow once
          </button>
          <button className="secondary-button" onClick={() => onResolve('allow_session')}>
            <ShieldCheck size={13} /> Allow session
          </button>
          <button className="primary-button" onClick={() => onResolve('always_allow')}>
            <Infinity size={13} /> Always allow
          </button>
        </div>
      </div>
    </>
  );
}
