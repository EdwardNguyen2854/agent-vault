import {
  BookOpen,
  Bot,
  Brain,
  CheckCircle2,
  FileText,
  GitBranch,
  Info,
  ListChecks,
  Map,
  MessageSquare,
  Rocket,
  Shield,
  Sparkles,
  TerminalSquare,
  Workflow,
} from 'lucide-react';
import { DocumentationPage } from './Documentation';

export { DocumentationPage };

interface ProductPageProps {
  version: string;
  onChangeView?: (view: 'roadmap' | 'release' | 'docs' | 'about') => void;
}

const aboutCapabilities = [
  {
    icon: Sparkles,
    label: 'Skills',
    text: 'Bundled starter-kit skills (Nora, Obra) and auto-selection that respects chat context, assistant label, and session state.',
  },
  {
    icon: Brain,
    label: 'Memory',
    text: 'Markdown-backed memory cards with search, filters, drawer previews, and save-into-note or append flows.',
  },
  {
    icon: TerminalSquare,
    label: 'Tools',
    text: 'Permission-aware internal tools, MCP tool metadata notes, and an approval log you can review and revoke.',
  },
  {
    icon: Workflow,
    label: 'Agent Runs',
    text: 'Saved runs that capture goal, agent, skill, steps, messages, tool transcripts, approvals, and the final output.',
  },
  {
    icon: MessageSquare,
    label: 'Chat',
    text: 'Local-model chat surface with approval-gated writes, run logs, and tool output controls.',
  },
  {
    icon: ListChecks,
    label: 'Task Queue',
    text: 'Inline markdown tasks, queue view, and writable-vault task toggles that respect shared and agent vault read-only rules.',
  },
];

const roadmapItems = [
  {
    title: 'Knowledge Model',
    status: 'Now',
    text: 'Improve how notes, memory, tools, skills, agents, tasks, and runs connect across a project vault with better linking, metadata, and discovery.',
  },
  {
    title: 'Agent Workflow',
    status: 'Next',
    text: 'Make agent-facing context, queues, permissions, and run records easier to inspect, control, and automate.',
  },
  {
    title: 'Interoperability',
    status: 'Next',
    text: 'Strengthen compatibility with local tools, MCP servers, markdown conventions, and external runtimes.',
  },
  {
    title: 'Extensibility',
    status: 'Future',
    text: 'Create stable extension points for custom views, metadata panels, automation, and vault workflows.',
  },
];

const releaseNotes = [
  {
    version: '0.1.0',
    name: 'Agent Vault 1.0',
    date: 'June 2026',
    summary:
      'First stable release of Agent Vault — a local-first markdown workspace for personal knowledge bases and agent-oriented project vaults.',
    highlights: [
      'Local-first vault with browser File System Access API: open, edit, create, rename, and delete notes as plain .md files on your machine.',
      'Connected-note features: wiki links, backlinks, tags, tasks, headings, and an interactive 3D knowledge graph.',
      'Agent workspace: agent profiles, bundled Nora and Obra starter-kit skills, memory notes, MCP tool registration, and Agent Run records with approval history.',
      'Permission-aware internal tools with approval-gated personal-vault writes and clear read-only handling for shared and agent vaults.',
      'Local LM Studio chat integration, MarkItDown document importer, and bridge-side MCP sidecar for external tooling.',
    ],
    sections: [
      {
        title: 'Local-first foundation',
        items: [
          'Workspaces stay on your machine as plain markdown — nothing is stored in a proprietary format.',
          'Wiki links resolve against title, file name, path, and full path with backlinks, broken-link detection, and heading anchors.',
          'Tags from frontmatter and inline text drive tag-based navigation and usage summaries.',
          'The 3D graph visualizes notes, links, missing targets, agents, orphans, and local neighborhoods.',
          'Tasks are parsed from every note with filters, search, and completion toggles written back to disk.',
        ],
      },
      {
        title: 'Agent workspace',
        items: [
          'Agent notes are detected by type, folder, or tag with profile cards, role/status/model/skills, and backlinks.',
          'Starter-kit skills for Nora (automation) and Obra (knowledge curation) ship with the default markdown starter.',
          'Memory view groups notes by type; personal memory can be created or appended, shared memory is read-only.',
          'MCP tools can be registered as markdown metadata with permission and risk frontmatter.',
          'Agent Runs capture goal, agent, skill, steps, messages, tool transcripts, approval decisions, and final output.',
        ],
      },
      {
        title: 'Permissions & safety',
        items: [
          'The bundled starter kit and all shared or agent vaults are read-only by default.',
          'Exactly one personal vault is writable at a time; duplicate mounts are blocked when the browser can identify the same folder.',
          'Write-capable internal tools are approval-gated and refuse read-only, shared, or agent vault targets.',
          'Approval history can be reviewed and revoked from Tools and Settings.',
          'All write operations — save, rename, delete, task toggle, memory write, generated notes — are limited to the personal vault.',
        ],
      },
    ],
  },
];

export function RoadmapPage() {
  return (
    <main className="page-scroll view-page roadmap-page">
      <div className="page-header roadmap-header">
        <div>
          <span className="eyebrow">Product direction</span>
          <h1>
            <Map size={20} /> Roadmap
          </h1>
          <p>
            What's next after the 1.0 release — deepening connections, agent workflows,
            interoperability, and extensibility.
          </p>
        </div>
      </div>

      <div className="roadmap-timeline">
        {roadmapItems.map((item, index) => (
          <section className="roadmap-milestone" key={item.title}>
            <div className="roadmap-marker">
              <span>{index + 1}</span>
            </div>
            <div>
              <span className="status-badge roadmap-status">{item.status}</span>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </div>
          </section>
        ))}
      </div>

      <section className="roadmap-principles">
        <h2>
          <Sparkles size={16} /> Planning principles
        </h2>
        <div>
          <p>Prefer plain markdown over proprietary storage.</p>
          <p>Keep permissions visible before adding more automation.</p>
          <p>Separate browser metadata from real external runtimes.</p>
        </div>
      </section>
    </main>
  );
}

export function ReleasePage({ version }: ProductPageProps) {
  const currentRelease =
    releaseNotes.find((release) => release.version === version) ?? releaseNotes[0];

  return (
    <main className="page-scroll view-page release-page">
      <div className="page-header release-header">
        <div>
          <span className="eyebrow">Release notes</span>
          <h1>
            <Rocket size={20} /> v{currentRelease.version}
          </h1>
          <p>{currentRelease.name}</p>
        </div>
        <span className="status-badge status-saved">v{version}</span>
      </div>

      <div className="release-layout">
        <article className="release-notes-panel">
          <section className="release-summary">
            <div>
              <span className="eyebrow">{currentRelease.date}</span>
              <h2>{currentRelease.name}</h2>
              <p>{currentRelease.summary}</p>
            </div>
          </section>

          <section className="release-highlight-grid" aria-label="Release highlights">
            {currentRelease.highlights.map((highlight) => (
              <div className="release-highlight" key={highlight}>
                <CheckCircle2 size={15} />
                <p>{highlight}</p>
              </div>
            ))}
          </section>

          {currentRelease.sections.map((section) => (
            <section className="release-section" key={section.title}>
              <h3>{section.title}</h3>
              <div className="release-change-list">
                {section.items.map((item) => (
                  <div key={item}>
                    <span />
                    <p>{item}</p>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </article>

        <aside className="release-history" aria-label="Release history">
          <h2>Release history</h2>
          {releaseNotes.map((release) => (
            <a
              className={`release-history-item ${release.version === currentRelease.version ? 'active' : ''}`}
              href={`#v${release.version}`}
              key={release.version}
            >
              <span>v{release.version}</span>
              <strong>{release.name}</strong>
              <small>{release.date}</small>
            </a>
          ))}
        </aside>
      </div>
    </main>
  );
}

export function AboutPage({ version, onChangeView }: ProductPageProps) {
  return (
    <main className="page-scroll view-page about-page">
      <div className="page-header about-header">
        <div>
          <span className="eyebrow">About the app</span>
          <h1>
            <Info size={20} /> About Agent Vault
          </h1>
          <p>
            A local-first markdown workspace for connected notes, tasks, agents, and graph
            exploration. v{version} keeps your files in plain markdown while layering chat, skills,
            memory, tools, and runs on top.
          </p>
        </div>
        <span className="status-badge status-saved">v{version}</span>
      </div>

      <div className="product-grid about-grid">
        <section className="panel-card large-card">
          <h3>
            <Bot size={15} /> What it is
          </h3>
          <p>
            Agent Vault opens a folder on your machine, reads it as a graph of markdown files, and
            gives you an editor, file tree, backlinks, tags, graph, task queue, and agent workspace
            — all against the same source of truth on disk.
          </p>
          <p>
            Your personal vault is writable. Bundled agent vaults and shared vaults stay read-only,
            and the UI shows that distinction at a glance.
          </p>
        </section>

        <section className="panel-card">
          <h3>
            <Shield size={15} /> Local-first
          </h3>
          <p>
            Notes stay on your machine through the browser File System Access API. Saving edits to
            local folders requires Chrome or Microsoft Edge.
          </p>
        </section>

        <section className="panel-card">
          <h3>
            <FileText size={15} /> Markdown native
          </h3>
          <p>
            Wiki links, YAML frontmatter, headings, tasks, tags, and backlinks are first-class.
            Nothing is stored in a proprietary format you cannot read with another tool.
          </p>
        </section>

        <section className="panel-card about-capabilities">
          <h3>
            <Sparkles size={15} /> What's in the workspace
          </h3>
          <ul className="about-capability-list">
            {aboutCapabilities.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.label}>
                  <span className="about-capability-icon">
                    <Icon size={13} />
                  </span>
                  <div>
                    <strong>{item.label}</strong>
                    <p>{item.text}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="panel-card about-version">
          <h3>
            <GitBranch size={15} /> Version
          </h3>
          <p>
            Running Agent Vault <strong>v{version}</strong>. See the <em>Release notes</em> for the
            full changelog and the <em>Roadmap</em> for what's planned next.
          </p>
        </section>
      </div>

      <section className="about-more">
        <h2>
          <Sparkles size={14} /> More in the app
        </h2>
        <div className="about-more-grid">
          <button
            type="button"
            className="about-more-card"
            onClick={() => onChangeView?.('roadmap')}
            disabled={!onChangeView}
          >
            <Map size={14} />
            <strong>Roadmap</strong>
            <span>Where Agent Vault is heading next.</span>
          </button>
          <button
            type="button"
            className="about-more-card"
            onClick={() => onChangeView?.('release')}
            disabled={!onChangeView}
          >
            <Rocket size={14} />
            <strong>Release notes</strong>
            <span>Full changelog for v{version} and earlier.</span>
          </button>
          <button
            type="button"
            className="about-more-card"
            onClick={() => onChangeView?.('docs')}
            disabled={!onChangeView}
          >
            <BookOpen size={14} />
            <strong>Documentation</strong>
            <span>Guides, architecture, and how the workspace is wired together.</span>
          </button>
        </div>
      </section>
    </main>
  );
}
