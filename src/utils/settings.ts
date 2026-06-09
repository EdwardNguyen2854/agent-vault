import { defaultLMStudioConfig, type LMStudioConfig } from './lmstudio';

export const AI_CONFIG_KEY = 'agent-vault-ai-config';
export const CONTEXT_SETTINGS_KEY = 'agent-vault-context-settings';
export const SKILLS_SETTINGS_KEY = 'agent-vault-skills-settings';
export const MEMORY_SETTINGS_KEY = 'agent-vault-memory-settings';
export const TOOLS_SETTINGS_KEY = 'agent-vault-tools-settings';
export const AGENT_RUNS_KEY = 'agent-vault-agent-runs';
export const PROPERTIES_SETTINGS_KEY = 'agent-vault-properties-settings';
export const CHAT_SETTINGS_KEY = 'agent-vault-chat-settings';

export type AIProvider = 'lmstudio' | 'openai' | 'anthropic';

export interface AIProviderConfig {
  provider: AIProvider;
  lmStudio: LMStudioConfig;
}

export interface UIContextSettings {
  defaultDepth: 1 | 2;
  includeBacklinks: boolean;
  includeMemory: boolean;
  includeTools: boolean;
  maxContextSize: number;
}

export interface SkillsSettings {
  folderPath: string;
  showInactive: boolean;
}

export interface MemorySettings {
  folderPath: string;
  saveLocation: string;
  requireApproval: boolean;
}

export interface ToolsSettings {
  mcpConfigPath: string;
  defaultPermission: 'ask' | 'trusted' | 'read-only';
  showRiskLabels: boolean;
}

export interface AgentRunsSettings {
  logFolderPath: string;
  autoSaveRuns: boolean;
  includeToolOutput: boolean;
}

export interface PropertiesSettings {
  showProperties: boolean;
  expandFileTree: boolean;
}

export type ChatLayout = 'fullpage' | 'docked' | 'floating';

export interface ChatSettings {
  layout: ChatLayout;
  open: boolean;
  dockedWidth: number;
}

export const DEFAULT_CHAT_DOCKED_WIDTH = 360;
export const MIN_CHAT_DOCKED_WIDTH = 300;
export const MAX_CHAT_DOCKED_WIDTH = 720;

export function clampChatDockedWidth(width: number): number {
  if (!Number.isFinite(width)) return DEFAULT_CHAT_DOCKED_WIDTH;
  return Math.min(MAX_CHAT_DOCKED_WIDTH, Math.max(MIN_CHAT_DOCKED_WIDTH, Math.round(width)));
}

function loadJson<T>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(key);
    if (stored) return { ...fallback, ...JSON.parse(stored) };
  } catch {}
  return fallback;
}

export function saveJson<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export function loadAIProviderConfig(): AIProviderConfig {
  return loadJson<AIProviderConfig>(AI_CONFIG_KEY, {
    provider: 'lmstudio',
    lmStudio: defaultLMStudioConfig,
  });
}

export function saveAIProviderConfig(config: AIProviderConfig): void {
  saveJson(AI_CONFIG_KEY, config);
}

export function loadContextSettings(): UIContextSettings {
  return loadJson<UIContextSettings>(CONTEXT_SETTINGS_KEY, {
    defaultDepth: 1,
    includeBacklinks: true,
    includeMemory: true,
    includeTools: true,
    maxContextSize: 4096,
  });
}

export function saveContextSettings(settings: UIContextSettings): void {
  saveJson(CONTEXT_SETTINGS_KEY, settings);
}

export function loadSkillsSettings(): SkillsSettings {
  return loadJson<SkillsSettings>(SKILLS_SETTINGS_KEY, {
    folderPath: '.opencode/skills',
    showInactive: false,
  });
}

export function saveSkillsSettings(settings: SkillsSettings): void {
  saveJson(SKILLS_SETTINGS_KEY, settings);
}

export function loadMemorySettings(): MemorySettings {
  return loadJson<MemorySettings>(MEMORY_SETTINGS_KEY, {
    folderPath: '.agent-memory',
    saveLocation: '.agent-memory/sessions',
    requireApproval: true,
  });
}

export function saveMemorySettings(settings: MemorySettings): void {
  saveJson(MEMORY_SETTINGS_KEY, settings);
}

export function loadToolsSettings(): ToolsSettings {
  return loadJson<ToolsSettings>(TOOLS_SETTINGS_KEY, {
    mcpConfigPath: '.opencode/mcp.json',
    defaultPermission: 'ask',
    showRiskLabels: true,
  });
}

export function saveToolsSettings(settings: ToolsSettings): void {
  saveJson(TOOLS_SETTINGS_KEY, settings);
}

export function loadAgentRunsSettings(): AgentRunsSettings {
  return loadJson<AgentRunsSettings>(AGENT_RUNS_KEY, {
    logFolderPath: 'Agent Runs',
    autoSaveRuns: true,
    includeToolOutput: true,
  });
}

export function saveAgentRunsSettings(settings: AgentRunsSettings): void {
  saveJson(AGENT_RUNS_KEY, settings);
}

export function loadPropertiesSettings(): PropertiesSettings {
  return loadJson<PropertiesSettings>(PROPERTIES_SETTINGS_KEY, {
    showProperties: false,
    expandFileTree: true,
  });
}

export function savePropertiesSettings(settings: PropertiesSettings): void {
  saveJson(PROPERTIES_SETTINGS_KEY, settings);
}

export function loadChatSettings(): ChatSettings {
  const settings = loadJson<ChatSettings>(CHAT_SETTINGS_KEY, {
    layout: 'docked',
    open: false,
    dockedWidth: DEFAULT_CHAT_DOCKED_WIDTH,
  });
  return {
    layout:
      settings.layout === 'fullpage' ||
      settings.layout === 'docked' ||
      settings.layout === 'floating'
        ? settings.layout
        : 'docked',
    open: Boolean(settings.open),
    dockedWidth: clampChatDockedWidth(settings.dockedWidth),
  };
}

export function saveChatSettings(settings: ChatSettings): void {
  saveJson(CHAT_SETTINGS_KEY, {
    ...settings,
    dockedWidth: clampChatDockedWidth(settings.dockedWidth),
  });
}
