import type { LucideIcon } from 'lucide-react';
import {
  BookOpen,
  Bot,
  Code2,
  Cpu,
  Database,
  FileText,
  FolderOpen,
  HelpCircle,
  Keyboard,
  Link2,
  ListChecks,
  Map as MapIcon,
  Network,
  Search,
  Settings as SettingsIcon,
  Shield,
  Sparkles,
  Wrench,
  Zap,
} from 'lucide-react';

export interface DocNavItem {
  slug: string;
  label: string;
  icon: LucideIcon;
  summary: string;
  group: 'start' | 'model' | 'workflow' | 'reference';
}

export const docNavigation: DocNavItem[] = [
  {
    slug: 'overview',
    label: 'Overview',
    icon: BookOpen,
    summary: 'What Agent Vault is, what it does, and how the pages fit together.',
    group: 'start',
  },
  {
    slug: 'getting-started',
    label: 'Getting started',
    icon: Zap,
    summary: 'Install, run, and open your first vault in under five minutes.',
    group: 'start',
  },
  {
    slug: 'core-concepts',
    label: 'Core concepts',
    icon: Database,
    summary: 'Vaults, notes, the graph, and how workspace entities are detected.',
    group: 'model',
  },
  {
    slug: 'markdown-syntax',
    label: 'Markdown syntax',
    icon: Code2,
    summary: 'Wiki links, tags, tasks, and frontmatter conventions supported by the app.',
    group: 'model',
  },
  {
    slug: 'workspace-entities',
    label: 'Workspace entities',
    icon: Bot,
    summary: 'How agents, skills, and tools are detected and surfaced in the UI.',
    group: 'model',
  },
  {
    slug: 'tools-and-mcp',
    label: 'Tools & MCP registry',
    icon: Wrench,
    summary: 'Register MCP tools, set permissions, and review risk metadata.',
    group: 'workflow',
  },
  {
    slug: 'memory',
    label: 'Memory',
    icon: Sparkles,
    summary: 'Save and review personal, agent, and shared memory notes.',
    group: 'workflow',
  },
  {
    slug: 'command-center',
    label: 'Command center',
    icon: Search,
    summary: 'Search notes, commands, tags, agents, tasks, and health checks.',
    group: 'workflow',
  },
  {
    slug: 'local-files',
    label: 'Local files & paths',
    icon: FolderOpen,
    summary: 'File System Access rules, ignored folders, and path validation.',
    group: 'reference',
  },
  {
    slug: 'shortcuts',
    label: 'Shortcuts',
    icon: Keyboard,
    summary: 'Global, editor, and command center keyboard shortcuts.',
    group: 'reference',
  },
  {
    slug: 'architecture',
    label: 'Architecture',
    icon: Network,
    summary: 'How the React + Vite app is organized and which file owns what.',
    group: 'reference',
  },
  {
    slug: 'troubleshooting',
    label: 'Troubleshooting',
    icon: Shield,
    summary: 'Fixes for saving, linking, tagging, and AI chat issues.',
    group: 'reference',
  },
  {
    slug: 'faq',
    label: 'FAQ',
    icon: HelpCircle,
    summary: 'Short answers to the most common Agent Vault questions.',
    group: 'reference',
  },
];

export const docGroupMeta: Record<DocNavItem['group'], { title: string; icon: LucideIcon }> = {
  start: { title: 'Get started', icon: Sparkles },
  model: { title: 'How it works', icon: Cpu },
  workflow: { title: 'Day-to-day', icon: ListChecks },
  reference: { title: 'Reference', icon: MapIcon },
};

export const defaultDocSlug = 'overview';

export function getDocNavigation(slug: string): DocNavItem {
  return docNavigation.find((item) => item.slug === slug) ?? docNavigation[0];
}

export function getAdjacentDocSlugs(slug: string): {
  prev: DocNavItem | null;
  next: DocNavItem | null;
} {
  const index = docNavigation.findIndex((item) => item.slug === slug);
  if (index === -1) return { prev: null, next: null };
  return {
    prev: index > 0 ? docNavigation[index - 1] : null,
    next: index < docNavigation.length - 1 ? docNavigation[index + 1] : null,
  };
}

export function isValidDocSlug(slug: string): boolean {
  return docNavigation.some((item) => item.slug === slug);
}

export const _icons = { FileText, SettingsIcon };
