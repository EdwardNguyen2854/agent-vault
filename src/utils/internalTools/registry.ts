import type {
  InternalToolHandler,
  Tool,
  ToolExecutionContext,
  ToolInvocationResult,
} from '../../types';
import { vaultReadNote } from './read';
import { vaultSearch } from './read';
import { vaultListTasks } from './read';
import { vaultAppendToNote, vaultCompleteTask, vaultCreateTask, vaultUpdateNote } from './write';
import { memoryAppend } from './write';
import { noteCreate } from './write';
import { vaultListNotes } from './meta';
import { vaultGetMetadata } from './meta';
import { memoryList } from './meta';

const handlers: InternalToolHandler[] = [
  vaultReadNote,
  vaultSearch,
  vaultListTasks,
  vaultCreateTask,
  vaultUpdateNote,
  vaultAppendToNote,
  vaultCompleteTask,
  memoryAppend,
  noteCreate,
  vaultListNotes,
  vaultGetMetadata,
  memoryList,
];

const metadataByToolId: Record<string, Pick<Tool, 'permission' | 'risk'>> = {
  'vault.read_note': { permission: 'read-only', risk: 'low' },
  'vault.search': { permission: 'read-only', risk: 'low' },
  'vault.list_tasks': { permission: 'read-only', risk: 'low' },
  'vault.list_notes': { permission: 'read-only', risk: 'low' },
  'vault.get_metadata': { permission: 'read-only', risk: 'low' },
  'memory.list': { permission: 'read-only', risk: 'low' },
  'vault.create_task': { permission: 'ask', risk: 'medium' },
  'vault.update_note': { permission: 'ask', risk: 'medium' },
  'vault.append_to_note': { permission: 'ask', risk: 'medium' },
  'vault.complete_task': { permission: 'ask', risk: 'medium' },
  'memory.append': { permission: 'ask', risk: 'medium' },
  'note.create': { permission: 'ask', risk: 'medium' },
};

const handlerMap = new Map<string, InternalToolHandler>();
for (const h of handlers) {
  handlerMap.set(h.toolId, h);
}

export function getInternalToolHandlers(): InternalToolHandler[] {
  return handlers;
}

export function getInternalTools(): Tool[] {
  return handlers.map((h) => ({
    id: h.toolId,
    name: h.toolName,
    provider: 'internal' as const,
    status: 'active' as const,
    permission: metadataByToolId[h.toolId]?.permission ?? 'ask',
    risk: metadataByToolId[h.toolId]?.risk ?? 'medium',
    description: h.description,
    inputSchema: h.parameters as Record<string, unknown>,
    source: 'system' as const,
  }));
}

export async function dispatchInternalTool(
  toolId: string,
  input: Record<string, unknown>,
  ctx: ToolExecutionContext,
): Promise<ToolInvocationResult> {
  const handler = handlerMap.get(toolId);
  if (!handler) {
    return { success: false, error: `Internal tool not found: ${toolId}`, durationMs: 0 };
  }
  const start = performance.now();
  try {
    const result = await handler.handler(input, ctx);
    result.durationMs = performance.now() - start;
    return result;
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
      durationMs: performance.now() - start,
    };
  }
}
