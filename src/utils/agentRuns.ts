import type {
  AgentRun,
  AgentRunApproval,
  AgentRunStep,
  ChatMessage,
  ToolCallRecord,
  VaultNote,
} from '../types';
import { getNoteKey } from './noteKey';

/**
 * Detects if a note is an agent run note.
 * Identified by frontmatter.type === 'agent-run' or path containing '/Agent Runs/'
 */
export function isAgentRunNote(note: VaultNote): boolean {
  const type = typeof note.frontmatter.type === 'string' ? note.frontmatter.type.toLowerCase() : '';
  const path = `/${note.path.toLowerCase()}`;
  return type === 'agent-run' || path.includes('/agent runs/') || path.includes('/agent-runs/');
}

/**
 * Converts a VaultNote to an AgentRun object.
 */
function noteToAgentRun(note: VaultNote): AgentRun {
  const frontmatter = note.frontmatter;
  const agent = stripWikiLink(
    typeof frontmatter.agent === 'string' ? frontmatter.agent : note.title,
  );
  const skill =
    typeof frontmatter.skill === 'string' ? stripWikiLink(frontmatter.skill) : undefined;
  const model = typeof frontmatter.model === 'string' ? frontmatter.model : 'unknown';
  const provider = typeof frontmatter.provider === 'string' ? frontmatter.provider : 'unknown';
  const sourceNote =
    typeof frontmatter.source_note === 'string'
      ? stripWikiLink(frontmatter.source_note)
      : undefined;
  const contextItems = Array.isArray(frontmatter.context_items)
    ? frontmatter.context_items.map(stripWikiLink)
    : [];
  const toolsUsed = Array.isArray(frontmatter.tools_used)
    ? frontmatter.tools_used.map(stripWikiLink)
    : [];
  const status = (
    typeof frontmatter.status === 'string' ? frontmatter.status.toLowerCase() : 'completed'
  ) as AgentRun['status'];
  const created =
    typeof frontmatter.created === 'string'
      ? frontmatter.created
      : new Date(note.updatedAt).toISOString();
  const updated =
    typeof frontmatter.updated === 'string'
      ? frontmatter.updated
      : new Date(note.updatedAt).toISOString();
  const completed = typeof frontmatter.completed === 'string' ? frontmatter.completed : undefined;
  const goal =
    extractSection(note.content, 'User Request')?.replace(/^>\s?/gm, '').trim() ||
    (typeof frontmatter.goal === 'string' ? frontmatter.goal : note.title);
  const finalAnswer =
    extractSection(note.content, 'Final Output') ??
    extractSection(note.content, 'Output') ??
    undefined;
  const reasoningSummary = extractSection(note.content, 'Reasoning Summary') ?? undefined;

  return {
    id: getNoteKey(note),
    goal,
    agentKey: typeof frontmatter.agent_key === 'string' ? frontmatter.agent_key : agent,
    skillKey: typeof frontmatter.skill_key === 'string' ? frontmatter.skill_key : skill,
    agent,
    skill,
    model,
    provider,
    sourceNote,
    contextItems,
    toolsUsed,
    steps: extractJsonSection<AgentRunStep[]>(note.content, 'Steps', []),
    messages: extractJsonSection<ChatMessage[]>(note.content, 'Messages', []),
    toolTranscript: extractJsonSection<ToolCallRecord[]>(note.content, 'Tool Transcript', []),
    approvals: extractJsonSection<AgentRunApproval[]>(note.content, 'Approval Decisions', []),
    reasoningSummary,
    finalAnswer,
    status,
    outputPath: note.path,
    createdAt: Date.parse(created) || note.updatedAt,
    updatedAt: Date.parse(updated) || note.updatedAt,
    completedAt: completed
      ? Date.parse(completed) || note.updatedAt
      : status === 'completed'
        ? note.updatedAt
        : undefined,
  };
}

function stripWikiLink(value: string): string {
  return value.replace(/^\[\[/, '').replace(/\]\]$/, '').trim();
}

/**
 * Filters and converts notes to AgentRun objects.
 */
export function getAgentRunsFromNotes(notes: VaultNote[]): AgentRun[] {
  return notes
    .filter(isAgentRunNote)
    .map(noteToAgentRun)
    .sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Filters agent runs by a specific agent name.
 */
export function getAgentRunsByAgent(agentName: string, notes: VaultNote[]): AgentRun[] {
  const runs = getAgentRunsFromNotes(notes);
  const normalizedAgent = agentName.toLowerCase();
  return runs.filter((run) => run.agent.toLowerCase().includes(normalizedAgent));
}

/**
 * Gets the most recent agent runs.
 */
export function getRecentRuns(notes: VaultNote[], limit: number): AgentRun[] {
  const runs = getAgentRunsFromNotes(notes);
  return runs.slice(0, limit);
}

/**
 * Generates a path for an agent run log file.
 * Format: /Agent Runs/YYYY-MM-DD - AgentName - Title.md
 */
export function getRunLogPath(
  date: Date,
  agentName: string,
  skillName: string,
  title: string,
): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`;
  const sanitizedAgent = agentName.replace(/[^a-zA-Z0-9 _-]/g, '').trim();
  const sanitizedTitle = title.replace(/[^a-zA-Z0-9 _-]/g, '').trim();
  return `Agent Runs/${dateStr} - ${sanitizedAgent} - ${sanitizedTitle}.md`;
}

function escapeYaml(value: string): string {
  return JSON.stringify(value);
}

function formatYamlList(items: string[]): string {
  if (!items.length) return '  - (none)';
  return items.map((item) => `  - ${escapeYaml(item)}`).join('\n');
}

function jsonBlock(value: unknown): string {
  return `\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\``;
}

function extractSection(content: string, heading: string): string | null {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`^## ${escaped}\\s*\\n([\\s\\S]*?)(?=\\n## |\\n# |$)`, 'm');
  const match = content.match(regex);
  return match?.[1]?.trim() ?? null;
}

function extractJsonSection<T>(content: string, heading: string, fallback: T): T {
  const section = extractSection(content, heading);
  if (!section) return fallback;
  const match = section.match(/```json\s*([\s\S]*?)```/);
  if (!match?.[1]) return fallback;
  try {
    return JSON.parse(match[1]) as T;
  } catch {
    return fallback;
  }
}

/**
 * Generates the markdown content for an agent run log.
 */
export function createAgentRun(params: {
  id?: string;
  status?: AgentRun['status'];
  goal?: string;
  agentKey?: string;
  skillKey?: string;
  agent: string;
  skill?: string;
  model: string;
  provider: string;
  sourceNote?: string;
  contextItems: string[];
  toolsUsed: string[];
  userRequest: string;
  output: string;
  steps?: AgentRunStep[];
  messages?: ChatMessage[];
  transcript?: ToolCallRecord[];
  approvals?: AgentRunApproval[];
  reasoningSummary?: string;
  error?: string;
  createdAt?: number;
  updatedAt?: number;
  completedAt?: number;
  maxIterations?: number;
}): string {
  const {
    agent,
    skill,
    model,
    provider,
    sourceNote,
    contextItems,
    toolsUsed,
    userRequest,
    output,
  } = params;

  const id = params.id ?? `run-${Date.now()}`;
  const status = params.status ?? (params.error ? 'failed' : 'completed');
  const createdIso = new Date(params.createdAt ?? Date.now()).toISOString();
  const updatedIso = new Date(params.updatedAt ?? Date.now()).toISOString();
  const completedIso = params.completedAt
    ? new Date(params.completedAt).toISOString()
    : status === 'completed' || status === 'failed' || status === 'cancelled'
      ? updatedIso
      : undefined;
  const agentLink = `[[${agent}]]`;
  const skillLink = skill ? `[[${skill}]]` : '';
  const sourceNoteLink = sourceNote ? `[[${sourceNote}]]` : '';

  const contextItemsList = formatYamlList(contextItems);
  const toolsList = formatYamlList(toolsUsed);
  const stepList = params.steps?.length
    ? params.steps
        .map(
          (step) =>
            `- [${step.status === 'completed' ? 'x' : ' '}] **${step.title}** - ${step.status}${step.summary ? `\n  ${step.summary}` : ''}${step.error ? `\n  Error: ${step.error}` : ''}`,
        )
        .join('\n')
    : '- [x] Complete the requested agent run';

  return `---
type: agent-run
id: ${escapeYaml(id)}
agent: ${agentLink}
${skill ? `skill: ${skillLink}` : ''}
model: ${model}
provider: ${provider}
${sourceNote ? `source_note: ${sourceNoteLink}` : ''}
goal: ${escapeYaml(params.goal ?? userRequest)}
agent_key: ${escapeYaml(params.agentKey ?? agent)}
${params.skillKey ? `skill_key: ${escapeYaml(params.skillKey)}` : ''}
tools_used:
${toolsList}
context_items:
${contextItemsList}
status: ${status}
created: ${createdIso}
updated: ${updatedIso}
${completedIso ? `completed: ${completedIso}` : ''}
${params.maxIterations ? `max_iterations: ${params.maxIterations}` : ''}
---

# Agent Run

## User Request

> ${userRequest.replace(/\n/g, '\n> ')}

## Agent

${agentLink}

## Skill Used

${skillLink || '_No skill specified_'}

## Context Used

${contextItems.length > 0 ? contextItems.map((item) => `- [[${item}]]`).join('\n') : '- (no context used)'}

## Steps

${stepList}

## Tool Calls

${toolsUsed.length > 0 ? toolsUsed.map((tool) => `- ${tool}`).join('\n') : '- (no tools called)'}

## Tool Transcript

${jsonBlock(params.transcript ?? [])}

## Approval Decisions

${jsonBlock(params.approvals ?? [])}

## Messages

${jsonBlock(params.messages ?? [])}

## Reasoning Summary

${params.reasoningSummary?.trim() || '_No reasoning summary captured._'}

## Final Output

${output}

${params.error ? `\n## Error\n\n\`\`\`\n${params.error}\n\`\`\`\n` : ''}

## Follow-Up Tasks

- [ ] Add follow-up task here

## Memory Suggestions

- Consider saving key decisions to memory
`;
}
