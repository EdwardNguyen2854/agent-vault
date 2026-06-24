/**
 * Approval Adapter Interface
 *
 * Abstraction layer for requesting and persisting tool execution approvals.
 * This allows the agent execution module to work with different approval
 * backends (production localStorage, test mocks, etc.).
 */

export type ApprovalDecision = 'allow_once' | 'allow_session' | 'always_allow' | 'deny';

export interface ApprovalRequest {
  toolId: string;
  toolName: string;
  input: unknown;
  reason?: string;
  timestamp: number;
}

export interface ApprovalResult {
  decision: ApprovalDecision;
  reason?: string;
  timestamp: number;
}

export interface ApprovalAdapter {
  /**
   * Request approval for a tool execution.
   * Returns the approval decision.
   * If no handler is available, returns 'deny'.
   */
  requestApproval(request: ApprovalRequest): Promise<ApprovalResult>;

  /**
   * Check if a tool is set to always-allow (persisted).
   */
  isAlwaysAllowed(toolId: string): boolean;

  /**
   * Save an always-allow decision for a tool.
   */
  setAlwaysAllowed(toolId: string): void;

  /**
   * Clear always-allow for a tool.
   */
  clearAlwaysAllowed(toolId: string): void;
}