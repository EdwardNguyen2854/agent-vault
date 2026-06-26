import type { Agent, GateResult, Tool, ToolExecutionContext } from '../types';

const WRITE_TOOL_IDS = new Set([
  'note.create',
  'vault.create_folder',
  'vault.delete_folder',
  'vault.create_task',
  'vault.update_note',
  'vault.append_to_note',
  'vault.complete_task',
  'memory.append',
]);

function isWriteCapableTool(tool: Tool): boolean {
  if (WRITE_TOOL_IDS.has(tool.id)) return true;
  return tool.permission === 'vault-only' || tool.permission === 'trusted';
}

export function evaluateToolCall(
  tool: Tool,
  agent?: Agent | null,
  ctx?: ToolExecutionContext,
): GateResult {
  if (tool.permission === 'disabled') {
    return { decision: 'deny', reason: `Tool "${tool.id}" is disabled` };
  }

  const agentMode = agent?.permissions?.tool_mode ?? 'ask';
  const writeMode = agent?.permissions?.write_mode ?? 'ask';
  const writeCapable = isWriteCapableTool(tool);

  if (agentMode === 'disabled') {
    return {
      decision: 'deny',
      reason: `Agent "${agent?.name ?? 'unknown'}" has tool access disabled`,
    };
  }

  if (tool.risk === 'high') {
    return { decision: 'ask', reason: 'High-risk tool requires confirmation' };
  }

  if (agentMode === 'read-only') {
    if (writeCapable) {
      return { decision: 'deny', reason: 'Agent read-only mode blocks write-capable tools' };
    }
    return { decision: 'allow', reason: 'Read-only gate allows read tools' };
  }

  if (writeCapable) {
    if (writeMode === 'disabled') {
      return {
        decision: 'deny',
        reason: `Agent "${agent?.name ?? 'unknown'}" has write access disabled`,
      };
    }
    if (writeMode === 'ask') {
      return { decision: 'ask', reason: 'Write tool requires confirmation' };
    }
    if (writeMode === 'vault-only' && tool.provider === 'mcp') {
      return { decision: 'deny', reason: 'Vault-only write mode blocks external/MCP write tools' };
    }
    if (ctx?.personalVaultSource?.readOnly) {
      return { decision: 'deny', reason: 'Personal vault is read-only' };
    }
  }

  if (agentMode === 'vault-only') {
    if (tool.provider === 'mcp') {
      return { decision: 'deny', reason: 'Vault-only mode blocks external/MCP tools' };
    }
    if (tool.permission === 'read-only') {
      return { decision: 'allow', reason: 'Vault-only mode allows read-only vault tools' };
    }
    if (tool.permission === 'trusted') {
      return { decision: 'allow', reason: 'Tool is trusted for vault-only mode' };
    }
    if (tool.permission === 'vault-only' || tool.permission === 'ask') {
      return {
        decision: 'ask',
        reason: `Vault-only mode respects tool permission "${tool.permission}"`,
      };
    }
    return {
      decision: 'deny',
      reason: `Vault-only mode blocks tool permission "${tool.permission}"`,
    };
  }

  if (agentMode === 'trusted') {
    if (writeCapable && writeMode === 'trusted') {
      return { decision: 'allow', reason: 'Trusted agent and trusted write mode allow write tool' };
    }
    if (writeCapable && writeMode === 'vault-only') {
      return {
        decision: 'allow',
        reason: 'Trusted agent and vault-only write mode allow vault write tool',
      };
    }
    return { decision: 'allow', reason: 'Trusted agent gate allows all non-disabled tools' };
  }

  if (tool.permission === 'trusted') {
    return { decision: 'allow', reason: 'Tool is trusted' };
  }

  if (tool.permission === 'ask') {
    return { decision: 'ask', reason: 'Tool is set to ask permission' };
  }

  return { decision: 'allow', reason: `Gate allows ${tool.permission} permission` };
}
