export type ViewMode =
  | 'dashboard'
  | 'editor'
  | 'graph'
  | 'tasks'
  | 'tags'
  | 'agents'
  | 'context'
  | 'docs'
  | 'roadmap'
  | 'release'
  | 'about'
  | 'settings'
  | 'chat'
  | 'skills'
  | 'memory'
  | 'tools'
  | 'agent-runs';
export type EditorMode = 'edit' | 'preview' | 'split';
export type TaskFilter = 'all' | 'active' | 'completed';
export type GraphFilter = 'all' | 'tag' | 'agent' | 'orphan' | 'broken';

export interface GraphFilterState {
  activeFilter: GraphFilter;
  selectedTag?: string;
  showOrphans: boolean;
  showBrokenLinks: boolean;
  showAgents: boolean;
}

export interface QuickSwitcherResult {
  note: VaultNote;
  score: number;
  matchType: 'title' | 'path';
  snippet?: string;
}

export interface VaultFile {
  vaultId: string;
  vaultName: string;
  vaultRole: 'agent' | 'personal' | 'shared';
  readOnly: boolean;
  path: string;
  name: string;
  extension: string;
  handle: FileSystemFileHandle;
  updatedAt: number;
  size: number;
}

export interface VaultFolder {
  vaultId: string;
  vaultName: string;
  vaultRole: 'agent' | 'personal' | 'shared';
  readOnly: boolean;
  path: string;
  tags: string[];
}

export interface VaultNote extends VaultFile {
  title: string;
  content: string;
  links: WikiLink[];
  tags: string[];
  frontmatter: Record<string, string | string[]>;
  tasks: TaskItem[];
  headings: HeadingItem[];
}

export interface WikiLink {
  raw: string;
  target: string;
  alias?: string;
}

export interface BacklinkItem {
  sourceKey: string;
  sourcePath: string;
  sourceTitle: string;
  excerpts: string[];
}

export interface TaskItem {
  id: string;
  noteKey: string;
  notePath: string;
  noteTitle: string;
  text: string;
  completed: boolean;
  line: number;
  due?: string;
  assignee?: string;
  tags: string[];
}

export interface TaskSnapshot {
  text: string;
  noteKey: string;
  notePath: string;
  noteTitle: string;
  line: number;
}

export type TaskConversationStatus = 'active' | 'completed';
export type TaskConversationAgentState =
  | 'not_started'
  | 'idle'
  | 'busy'
  | 'awaiting_approval'
  | 'error';
export type ChatAgentBusyState = 'idle' | 'running' | 'awaiting_approval' | 'error';

export interface TaskConversationMeta {
  taskId: string;
  sessionId: string;
  status: TaskConversationStatus;
  agentState: TaskConversationAgentState;
  relatedFiles: string[];
  createdAt: number;
  updatedAt: number;
}

export interface HeadingItem {
  level: number;
  text: string;
  line: number;
}

export interface GraphNode {
  id: string;
  name: string;
  title: string;
  path: string;
  group: string;
  value: number;
  type: 'note' | 'missing';
}

export interface GraphLink {
  source: string;
  target: string;
  label: string;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface NotePathValidation {
  valid: boolean;
  normalizedPath?: string;
  error?: string;
}

export interface VaultStats {
  noteCount: number;
  linkCount: number;
  backlinkCount: number;
  orphanCount: number;
  brokenLinkCount: number;
  taskCount: number;
  completedTaskCount: number;
  tagCount: number;
  agentCount: number;
}

export type { SearchResult } from './utils/search';

// =============================================================================
// v2 Entity Types
// =============================================================================

// Agent Permissions
export interface AgentPermissions {
  tool_mode: 'disabled' | 'ask' | 'read-only' | 'vault-only' | 'trusted';
  write_mode: 'disabled' | 'ask' | 'vault-only' | 'trusted';
}

// Agent Entity
export interface Agent {
  id: string;
  name: string;
  role: string;
  status: 'active' | 'inactive' | 'error';
  model?: string;
  provider?: string;
  skills: string[];
  tools: string[];
  memory: string[];
  permissions: AgentPermissions;
  avatar?: string;
  description?: string;
  createdAt?: number;
  updatedAt?: number;
}

// Skill Entity
export interface Skill {
  id: string;
  name: string;
  description: string;
  folderPath: string;
  skillFilePath: string;
  status: 'active' | 'inactive' | 'error';
  tools: string[];
  memory: string[];
  tags: string[];
  version?: string;
  author?: string;
  createdAt?: number;
  updatedAt?: number;
}

// Skill Router Result
export interface SkillRouterResult {
  skillId: string | null;
  confidence: 'high' | 'low';
}

// Tool Entity
export interface Tool {
  id: string;
  name: string;
  provider: 'internal' | 'mcp';
  server?: string;
  status: 'active' | 'inactive' | 'error' | 'disconnected';
  permission: 'disabled' | 'ask' | 'read-only' | 'vault-only' | 'trusted';
  risk: 'low' | 'medium' | 'high';
  source?: 'system' | 'vault';
  sourceNotePath?: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  description?: string;
  installHint?: string;
  capabilitiesUrl?: string;
  createdAt?: number;
  updatedAt?: number;
}

// Tool Permission Levels
export type ToolPermission = 'disabled' | 'ask' | 'read-only' | 'vault-only' | 'trusted';

// Tool Risk Levels
export type ToolRisk = 'low' | 'medium' | 'high';

// Memory Entity
export type MemoryType =
  | 'agent'
  | 'team'
  | 'project'
  | 'user'
  | 'skill'
  | 'tool'
  | 'decision'
  | 'run';

export interface Memory {
  id: string;
  title: string;
  memoryType: MemoryType;
  target?: string;
  status: 'active' | 'inactive' | 'archived';
  path?: string;
  links: string[];
  content?: string;
  vaultRole?: 'agent' | 'personal' | 'shared';
  readOnly?: boolean;
  writable?: boolean;
  createdAt?: number;
  updatedAt?: number;
}

// AgentRun Entity
export type AgentRunStatus =
  | 'planned'
  | 'running'
  | 'awaiting_approval'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'skipped';
export type AgentRunStepStatus =
  | 'planned'
  | 'running'
  | 'awaiting_approval'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'skipped';

export interface AgentRunStep {
  id: string;
  title: string;
  status: AgentRunStepStatus;
  summary?: string;
  startedAt?: number;
  completedAt?: number;
  error?: string;
}

export interface AgentRunApproval {
  id: string;
  toolId: string;
  toolName: string;
  input: unknown;
  decision: 'allow_once' | 'allow_session' | 'always_allow' | 'deny';
  timestamp: number;
  decisionReason?: string;
}

export interface AgentRun {
  id: string;
  goal: string;
  agentKey: string;
  skillKey?: string;
  agent: string;
  skill?: string;
  model: string;
  provider: string;
  sourceNote?: string;
  contextItems: string[];
  toolsUsed: string[];
  steps: AgentRunStep[];
  messages: ChatMessage[];
  toolTranscript: ToolCallRecord[];
  approvals: AgentRunApproval[];
  reasoningSummary?: string;
  finalAnswer?: string;
  status: AgentRunStatus;
  outputPath?: string;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  maxIterations?: number;
  error?: string;
}

// Chat Related Types
export interface ChatAttachment {
  id: string;
  kind: 'image' | 'file';
  name: string;
  mimeType: string;
  size: number;
  dataUrl: string;
  textContent?: string;
}

export interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: number;
  attachments?: ChatAttachment[];
  toolCalls?: OpenAIToolCall[];
  toolCallId?: string;
  toolName?: string;
  toolInput?: unknown;
  toolOutput?: unknown;
}

export interface ChatSession {
  id: string;
  title: string;
  agent: string;
  agentKey: string;
  skillKey?: string;
  taskId?: string;
  taskSnapshot?: TaskSnapshot;
  messages: ChatMessage[];
  status: 'active' | 'completed' | 'cancelled';
  createdAt: number;
  updatedAt: number;
  pinned?: boolean;
  archivedAt?: number;
  tags?: string[];
  groupId?: string;
  lastSavedAt?: number;
  savedNotePath?: string;
}

export interface ChatGroup {
  id: string;
  name: string;
  color?: string;
  order?: number;
  createdAt: number;
}

export type AgentContextItemType = 'note' | 'agent' | 'skill' | 'memory' | 'tool' | 'link';

export interface AgentContextItem {
  type: AgentContextItemType;
  id: string;
  title: string;
  content: string;
  path?: string;
  weight: number;
}

export interface AgentContext {
  currentNote?: VaultNote;
  outgoingLinks: VaultNote[];
  backlinks: VaultNote[];
  agentMemory: Memory[];
  teamMemory: Memory[];
  userMemory: Memory[];
  projectMemory: Memory[];
  skill?: Skill;
  tools: Tool[];
  items: AgentContextItem[];
  estimatedTokens: number;
}

// Context Settings Type
export interface ContextSettings {
  include_current_note: boolean;
  include_selected_text: boolean;
  include_outgoing_links: boolean;
  include_backlinks: boolean;
  include_agent_memory: boolean;
  include_team_memory: boolean;
  include_user_memory: boolean;
  include_project_memory: boolean;
  include_skill: boolean;
  include_tools: boolean;
  graph_depth: number;
  max_notes: number;
  max_tokens: number;
  rag_fallback: boolean;
}

// LM Studio Config Type
export interface LMStudioConfig {
  provider: 'lmstudio';
  base_url: string;
  default_chat_model?: string;
  default_embedding_model?: string;
  streaming: boolean;
  api_key?: string;
}

// VaultNote Frontmatter Extensions
export interface AgentFrontmatter {
  type: 'agent';
  name: string;
  role: string;
  status: 'active' | 'inactive' | 'error';
  model?: string;
  provider?: string;
  skills?: string[];
  tools?: string[];
  memory?: string[];
  permissions?: AgentPermissions;
  avatar?: string;
  description?: string;
}

export interface SkillFrontmatter {
  type: 'skill';
  name: string;
  description: string;
  version?: string;
  status?: 'active' | 'inactive' | 'error';
  author?: string;
  tags?: string[];
  tools?: string[];
  memory?: string[];
}

export interface ToolFrontmatter {
  type: 'tool';
  name: string;
  tool_id: string;
  provider: 'internal' | 'mcp';
  status?: 'active' | 'inactive' | 'error' | 'disconnected';
  permission?: 'disabled' | 'ask' | 'read-only' | 'vault-only' | 'trusted';
  risk?: 'low' | 'medium' | 'high';
  description?: string;
  install_hint?: string;
  capabilities_url?: string;
}

export interface MemoryFrontmatter {
  type: 'memory';
  memory_type: 'agent' | 'team' | 'project' | 'user' | 'skill' | 'tool' | 'decision' | 'run';
  agent?: string;
  status?: 'active' | 'inactive' | 'archived';
  title?: string;
}

export interface AgentRunFrontmatter {
  type: 'agent-run';
  agent: string;
  skill?: string;
  model: string;
  provider: string;
  source_note?: string;
  status?: AgentRunStatus;
  created: string;
  updated?: string;
  completed?: string;
  goal?: string;
  agent_key?: string;
  skill_key?: string;
  tools_used?: string[];
  context_items?: string[];
}

export interface ProjectFrontmatter {
  type: 'project';
  name: string;
  description?: string;
  status?: 'active' | 'completed' | 'archived';
  tags?: string[];
}

// Union type for all VaultNote frontmatter types
export type VaultNoteFrontmatter =
  | AgentFrontmatter
  | SkillFrontmatter
  | ToolFrontmatter
  | MemoryFrontmatter
  | AgentRunFrontmatter
  | ProjectFrontmatter
  | Record<string, string | string[]>;

// Tool Execution Types

export interface ToolCallRecord {
  id: string;
  toolId: string;
  toolName: string;
  input: unknown;
  output?: unknown;
  error?: string;
  decision: 'allow' | 'ask' | 'deny';
  decisionReason?: string;
  durationMs: number;
  startedAt: number;
}

export type ToolLoopEventStatus =
  | 'requested'
  | 'awaiting_approval'
  | 'running'
  | 'succeeded'
  | 'denied'
  | 'failed';

export interface ToolLoopEvent {
  id: string;
  toolId: string;
  toolName: string;
  input?: unknown;
  output?: unknown;
  error?: string;
  reason?: string;
  status: ToolLoopEventStatus;
  startedAt: number;
  completedAt?: number;
}

export interface ToolInvocationResult {
  success: boolean;
  output?: unknown;
  error?: string;
  durationMs: number;
}

export interface ToolExecutionContext {
  notes: VaultNote[];
  currentNote?: VaultNote;
  selectedAgent?: VaultNote;
  agent?: Agent;
  personalRootHandle?: FileSystemDirectoryHandle;
  personalVaultSource?: {
    id: string;
    name: string;
    role: 'agent' | 'personal' | 'shared';
    readOnly: boolean;
  };
}

export interface InternalToolHandler {
  toolId: string;
  toolName: string;
  description: string;
  parameters: Record<string, unknown>;
  handler: (
    input: Record<string, unknown>,
    ctx: ToolExecutionContext,
  ) => Promise<ToolInvocationResult>;
}

// Gate decision type
export type GateDecision = 'allow' | 'ask' | 'deny';

export interface GateResult {
  decision: GateDecision;
  reason: string;
}

// OpenAI-compatible tool types for LM Studio chat
export interface OpenAIToolFunction {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface OpenAITool {
  type: 'function';
  function: OpenAIToolFunction;
}

export interface OpenAIToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ChatRequestResult {
  content: string;
  reasoning?: string;
  toolCalls: OpenAIToolCall[];
  finishReason: 'stop' | 'tool_calls' | 'length' | 'error';
}

// Bridge status
export type BridgeStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface BridgeHealth {
  ok: boolean;
  version?: string;
  servers: string[];
  status: BridgeStatus;
}
