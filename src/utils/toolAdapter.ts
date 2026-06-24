/**
 * Tool Adapter - Abstraction layer for tool execution
 *
 * Provides a unified interface for executing tools from different providers:
 * - Internal tools (built-in vault operations)
 * - MCP tools (external server tools)
 * - Fake tools (for testing)
 */

import type { Tool, ToolExecutionContext, ToolInvocationResult } from '../types';
import { dispatchInternalTool } from './internalTools';
import { invokeBridgeTool } from './bridgeClient';
import { getInternalTools } from './internalTools/registry';

export interface FakeToolAdapterOptions {
  /** Return success or failure */
  shouldFail?: boolean;
  /** Error message if shouldFail is true */
  errorMessage?: string;
  /** Simulated output data */
  output?: unknown;
  /** Simulated execution delay in ms */
  delayMs?: number;
}

/**
 * Create a fake tool adapter for testing
 */
export function createFakeToolAdapter(options: FakeToolAdapterOptions = {}): ToolAdapter {
  const { shouldFail = false, errorMessage = 'Fake tool error', output = null, delayMs = 0 } = options;

  return {
    execute: async (
      toolId: string,
      _input: Record<string, unknown>,
      _ctx: ToolExecutionContext,
      _signal?: AbortSignal,
    ): Promise<ToolInvocationResult> => {
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }

      if (shouldFail) {
        return {
          success: false,
          error: errorMessage,
          durationMs: delayMs,
        };
      }

      return {
        success: true,
        output: { toolId, ...(output as object) },
        durationMs: delayMs,
      };
    },

    isAvailable: (_toolId: string): boolean => true,
  };
}

export interface ToolAdapter {
  /** Execute a tool call */
  execute(
    toolId: string,
    input: Record<string, unknown>,
    ctx: ToolExecutionContext,
    signal?: AbortSignal,
  ): Promise<ToolInvocationResult>;

  /** Check if a tool is available for execution */
  isAvailable(toolId: string): boolean;
}

/**
 * Internal tools adapter - executes tools from the built-in registry
 */
export const internalToolAdapter: ToolAdapter = {
  execute: async (
    toolId: string,
    input: Record<string, unknown>,
    ctx: ToolExecutionContext,
    signal?: AbortSignal,
  ): Promise<ToolInvocationResult> => {
    // Internal tools don't support abort signals in their handlers currently
    // but we pass the signal through for future compatibility
    return dispatchInternalTool(toolId, input, ctx);
  },

  isAvailable: (toolId: string): boolean => {
    const tools = getInternalTools();
    return tools.some((t) => t.id === toolId);
  },
};

/**
 * MCP tools adapter - executes tools via the bridge client
 */
export const mcpToolAdapter: ToolAdapter = {
  execute: async (
    toolId: string,
    input: Record<string, unknown>,
    _ctx: ToolExecutionContext,
    signal?: AbortSignal,
  ): Promise<ToolInvocationResult> => {
    // MCP tool IDs are in the format "server::toolName" or just "toolName"
    // The server name is extracted from the tool's server property
    const parts = toolId.split('::');
    if (parts.length !== 2) {
      return {
        success: false,
        error: `Invalid MCP tool ID format: ${toolId}. Expected "serverName::toolName"`,
        durationMs: 0,
      };
    }
    const [serverName, toolName] = parts;
    return invokeBridgeTool(serverName, toolName, input, signal);
  },

  isAvailable: (toolId: string): boolean => {
    // MCP tools are available if they have the mcp:: prefix
    return toolId.startsWith('mcp::');
  },
};

/**
 * Get the appropriate adapter for a tool
 */
export function getToolAdapter(tool: Tool): ToolAdapter | null {
  if (tool.provider === 'internal') {
    return internalToolAdapter;
  }
  if (tool.provider === 'mcp') {
    return mcpToolAdapter;
  }
  return null;
}

/**
 * Execute a tool using the appropriate adapter
 */
export async function executeToolWithAdapter(
  tool: Tool,
  input: Record<string, unknown>,
  ctx: ToolExecutionContext,
  signal?: AbortSignal,
): Promise<ToolInvocationResult> {
  const adapter = getToolAdapter(tool);
  if (!adapter) {
    return {
      success: false,
      error: `No adapter available for tool "${tool.id}" with provider "${tool.provider}"`,
      durationMs: 0,
    };
  }
  return adapter.execute(tool.id, input, ctx, signal);
}
