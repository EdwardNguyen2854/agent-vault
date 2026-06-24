/**
 * Production Approval Adapter
 *
 * Implements ApprovalAdapter using browser localStorage for persistence.
 * - 'always_allow' decisions are persisted to localStorage
 * - 'allow_session' decisions are kept in memory for the session
 */

import type { ApprovalAdapter, ApprovalDecision, ApprovalRequest, ApprovalResult } from './approvalAdapter';
import { getAlwaysAllowIds, setAlwaysAllowId, removeAlwaysAllowId } from './permissions';

const ALWAYS_ALLOW_KEY = 'agent-vault-always-allow';

/**
 * Create a production approval adapter.
 * Uses localStorage for persistence of always-allow decisions.
 */
export function createProductionApprovalAdapter(): ApprovalAdapter {
  return {
    async requestApproval(request: ApprovalRequest): Promise<ApprovalResult> {
      // This method is called when a UI/dialog handler is set up elsewhere
      // The actual approval comes from the dialog resolution
      // This adapter is primarily for persistence of always-allow
      const timestamp = Date.now();

      // If always-allowed, return immediately
      if (isAlwaysAllowedByStorage(request.toolId)) {
        return {
          decision: 'always_allow',
          reason: 'Persisted always-allow',
          timestamp,
        };
      }

      // Return deny as default - actual approval handled by dialog
      return {
        decision: 'deny',
        reason: 'No approval handler available',
        timestamp,
      };
    },

    isAlwaysAllowed(toolId: string): boolean {
      return isAlwaysAllowedByStorage(toolId);
    },

    setAlwaysAllowed(toolId: string): void {
      setAlwaysAllowId(toolId);
    },

    clearAlwaysAllowed(toolId: string): void {
      removeAlwaysAllowId(toolId);
    },
  };
}

function isAlwaysAllowedByStorage(toolId: string): boolean {
  try {
    const stored = localStorage.getItem(ALWAYS_ALLOW_KEY);
    if (stored) {
      const arr = JSON.parse(stored) as string[];
      return arr.includes(toolId);
    }
  } catch {
    // ignore
  }
  return false;
}

/**
 * Create an approval adapter that integrates with React state.
 * This is used when there's a dialog-based approval flow in the UI.
 */
export interface DialogApprovalAdapterOptions {
  /** Check if tool is session-approved */
  isSessionApproved: (toolId: string) => boolean;
  /** Add tool to session-approved set */
  addSessionApproved: (toolId: string) => void;
  /** Add tool to always-allow set and persist */
  addAlwaysAllowed: (toolId: string) => void;
  /** Log permission grant */
  logPermissionGrant: (params: {
    timestamp: number;
    toolId: string;
    toolName: string;
    decision: ApprovalDecision;
  }) => void;
  /** Create a promise that resolves when user decides */
  waitForDialogDecision: (toolId: string, toolName: string, input: unknown) => Promise<ApprovalResult>;
}

export function createDialogApprovalAdapter(
  options: DialogApprovalAdapterOptions,
): ApprovalAdapter {
  return {
    async requestApproval(request: ApprovalRequest): Promise<ApprovalResult> {
      const timestamp = Date.now();

      // Check always-allow first (persisted)
      if (options.isSessionApproved(request.toolId) || isAlwaysAllowedByStorage(request.toolId)) {
        return {
          decision: 'always_allow',
          reason: 'Always allowed',
          timestamp,
        };
      }

      // Check session-allow (in-memory)
      if (options.isSessionApproved(request.toolId)) {
        return {
          decision: 'allow_session',
          reason: 'Session allowed',
          timestamp,
        };
      }

      // Wait for user decision via dialog
      const result = await options.waitForDialogDecision(
        request.toolId,
        request.toolName,
        request.input,
      );

      // Handle the decision
      if (result.decision === 'allow_session') {
        options.addSessionApproved(request.toolId);
      } else if (result.decision === 'always_allow') {
        options.addAlwaysAllowed(request.toolId);
      }

      if (
        result.decision === 'allow_once' ||
        result.decision === 'allow_session' ||
        result.decision === 'always_allow'
      ) {
        options.logPermissionGrant({
          timestamp,
          toolId: request.toolId,
          toolName: request.toolName,
          decision: result.decision,
        });
      }

      return result;
    },

    isAlwaysAllowed(toolId: string): boolean {
      return isAlwaysAllowedByStorage(toolId);
    },

    setAlwaysAllowed(toolId: string): void {
      options.addAlwaysAllowed(toolId);
    },

    clearAlwaysAllowed(toolId: string): void {
      // Cannot clear from localStorage via this adapter
      // Would need a separate clear function
    },
  };
}