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

export function OverviewPage() {
  return (
    <>
      <section className="docs-section">
        <h2>What Agent Vault is</h2>
        <p>
          Agent Vault is a local-first markdown workspace for connected notes, tasks, agents,
          skills, tools, memory, and a 3D knowledge graph. It runs entirely in the browser, opens
          folders of plain <code>.md</code> files, and layers navigation, editing, and graph views
          on top of them.
        </p>
        <p>
          The app is designed for personal knowledge bases and agent-oriented project vaults where
          notes, plans, tasks, decisions, and AI or human agent profiles live together as portable
          markdown files.
        </p>
      </section>

      <section className="docs-section">
        <h2>Highlights</h2>
        <div className="docs-card-grid">
          <div className="docs-feature-card">
            <FolderOpen size={16} />
            <h3>Open a local vault</h3>
            <p>
              Grant browser access to a folder and load markdown files recursively. Hidden,
              generated, and tool-specific folders are skipped.
            </p>
          </div>
          <div className="docs-feature-card">
            <Link2 size={16} />
            <h3>Connect knowledge</h3>
            <p>
              Use <code>[[wiki links]]</code> to create backlinks, graph edges, and missing-link
              signals that the dashboard can summarize.
            </p>
          </div>
          <div className="docs-feature-card">
            <ListChecks size={16} />
            <h3>Track execution</h3>
            <p>
              Collect markdown tasks across notes with due dates, assignees, and tags. Toggle
              completion back into the source file.
            </p>
          </div>
          <div className="docs-feature-card">
            <Bot size={16} />
            <h3>Model agents and tools</h3>
            <p>
              Detect agent, skill, and tool notes from frontmatter, folder location, or tags, and
              surface rich profile cards.
            </p>
          </div>
          <div className="docs-feature-card">
            <Network size={16} />
            <h3>Explore the graph</h3>
            <p>
              Visualize notes, links, missing targets, agents, orphans, and local neighborhoods in
              an interactive 3D graph.
            </p>
          </div>
          <div className="docs-feature-card">
            <Search size={16} />
            <h3>Find anything fast</h3>
            <p>
              Use the command center to search notes, commands, tags, agents, tasks, and vault
              health checks with a single keystroke.
            </p>
          </div>
        </div>
      </section>

      <section className="docs-section">
        <h2>Where to go next</h2>
        <div className="docs-card-grid">
          <a className="docs-feature-card docs-feature-card-link" href="#/docs/getting-started">
            <Zap size={16} />
            <h3>Getting started</h3>
            <p>Install, run, and open your first vault in under five minutes.</p>
          </a>
          <a className="docs-feature-card docs-feature-card-link" href="#/docs/core-concepts">
            <Database size={16} />
            <h3>Core concepts</h3>
            <p>Vaults, notes, the graph, and how workspace entities are detected.</p>
          </a>
          <a className="docs-feature-card docs-feature-card-link" href="#/docs/markdown-syntax">
            <Code2 size={16} />
            <h3>Markdown syntax</h3>
            <p>Wiki links, tags, tasks, and frontmatter conventions supported by the app.</p>
          </a>
          <a className="docs-feature-card docs-feature-card-link" href="#/docs/command-center">
            <Search size={16} />
            <h3>Command center</h3>
            <p>Open the command center and learn the prefixes for narrowing results.</p>
          </a>
        </div>
      </section>
    </>
  );
}

export function GettingStartedPage() {
  return (
    <>
      <section className="docs-section">
        <h2>Requirements</h2>
        <table className="docs-table">
          <tbody>
            <tr>
              <th>Runtime</th>
              <td>
                Node.js 20 or newer with <code>npm</code>.
              </td>
            </tr>
            <tr>
              <th>Browser</th>
              <td>Chrome or Microsoft Edge for local folder read and write support.</td>
            </tr>
            <tr>
              <th>Optional</th>
              <td>LM Studio running locally if you want to use the in-app AI chat.</td>
            </tr>
          </tbody>
        </table>
        <div className="docs-callout muted-callout">
          <Shield size={16} />
          <p>
            Firefox and Safari can run the app, but they do not currently expose the File System
            Access API needed to save local folders from this app.
          </p>
        </div>
      </section>

      <section className="docs-section">
        <h2>Install and run</h2>
        <div className="docs-quickstart">
          <div>
            <span>1</span>
            <strong>Install dependencies</strong>
            <code>npm install</code>
          </div>
          <div>
            <span>2</span>
            <strong>Run the dev server</strong>
            <code>npm run dev</code>
          </div>
          <div>
            <span>3</span>
            <strong>Open the app</strong>
            <code>http://localhost:5173</code>
          </div>
          <div>
            <span>4</span>
            <strong>Pick a starter or open a vault</strong>
            <code>Open vault</code>
          </div>
        </div>
      </section>

      <section className="docs-section">
        <h2>Choose your first vault</h2>
        <p>
          On first load, you can copy all bundled starters into one local folder, copy a single
          starter, or open an existing markdown folder. Starter folders are bundled from{' '}
          <code>starter-kit/</code>:
        </p>
        <table className="docs-table">
          <tbody>
            <tr>
              <th>Personal</th>
              <td>
                The writable default starter for everyday notes, tasks, journal entries, and
                personal memory.
              </td>
            </tr>
            <tr>
              <th>Agents</th>
              <td>
                Reference agent patterns and bundled Nora/Obra starter skills you can use as
                templates.
              </td>
            </tr>
            <tr>
              <th>Department</th>
              <td>Read-only shared context example for team or department documentation.</td>
            </tr>
            <tr>
              <th>Project</th>
              <td>Read-only shared context example for project notes.</td>
            </tr>
            <tr>
              <th>Knowledge</th>
              <td>Read-only shared context example for reference notes.</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="docs-section">
        <h2>Your first edits</h2>
        <ol className="docs-prose-list">
          <li>
            Start the app with <code>npm run dev</code>.
          </li>
          <li>
            Click <strong>Load all starter vaults</strong>, click one starter vault, or choose{' '}
            <strong>Open vault</strong>.
          </li>
          <li>Select a folder for your notes.</li>
          <li>Grant read and write permission when the browser asks.</li>
          <li>Open a note from the sidebar or command center.</li>
          <li>
            Edit the note and save with <kbd>Ctrl</kbd> + <kbd>S</kbd> or <kbd>Cmd</kbd> +{' '}
            <kbd>S</kbd>.
          </li>
          <li>
            Use <code>[[Note Name]]</code> to connect notes and populate backlinks and graph edges.
          </li>
        </ol>
        <div className="docs-callout">
          <Shield size={16} />
          <p>
            The selected folder stays on your machine. Agent Vault never uploads vault content to a
            server.
          </p>
        </div>
      </section>

      <section className="docs-section">
        <h2>Daily scripts</h2>
        <table className="docs-table compact-table">
          <thead>
            <tr>
              <th>Command</th>
              <th>Purpose</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>npm run dev</code>
              </td>
              <td>
                Starts the Vite dev server on <code>0.0.0.0</code>, usually at{' '}
                <code>http://localhost:5173</code>.
              </td>
            </tr>
            <tr>
              <td>
                <code>npm run build</code>
              </td>
              <td>
                Runs TypeScript type checking and creates a production build in <code>dist/</code>.
              </td>
            </tr>
            <tr>
              <td>
                <code>npm run preview</code>
              </td>
              <td>
                Serves the built app from <code>dist/</code> for local production preview.
              </td>
            </tr>
            <tr>
              <td>
                <code>npm run lint</code>
              </td>
              <td>
                Runs <code>tsc --noEmit</code>. This repo does not use ESLint.
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </>
  );
}

export function CoreConceptsPage() {
  return (
    <>
      <section className="docs-section">
        <h2>How Agent Vault models your workspace</h2>
        <p>
          Agent Vault keeps your data portable. It does not require a database or custom file
          format; it derives workspace views from markdown content.
        </p>
      </section>

      <section className="docs-section">
        <h2>Glossary</h2>
        <table className="docs-table">
          <tbody>
            <tr>
              <th>Vault</th>
              <td>
                A local folder containing markdown files. One personal vault is writable at a time;
                shared vaults are read-only.
              </td>
            </tr>
            <tr>
              <th>Note</th>
              <td>
                A <code>.md</code> or <code>.markdown</code> file with optional frontmatter,
                headings, links, tags, and tasks.
              </td>
            </tr>
            <tr>
              <th>Graph</th>
              <td>A relationship map built from resolved wiki links and missing link targets.</td>
            </tr>
            <tr>
              <th>Workspace entity</th>
              <td>
                A note marked as <code>type: agent</code>, <code>type: skill</code>, or{' '}
                <code>type: tool</code>; located in <code>Agents/</code>, <code>Skills/</code>, or{' '}
                <code>Tools/</code>; or tagged with <code>#agent</code>, <code>#skill</code>, or{' '}
                <code>#tool</code>.
              </td>
            </tr>
            <tr>
              <th>Backlink</th>
              <td>
                An incoming wiki link from another note. Agent Vault computes these from note
                content.
              </td>
            </tr>
            <tr>
              <th>Starter vault</th>
              <td>A bundled folder of example notes copied into a local folder on first run.</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="docs-section">
        <h2>Vault roles</h2>
        <p>Agent Vault keeps vault roles separate so permissions stay visible:</p>
        <table className="docs-table">
          <thead>
            <tr>
              <th>Role</th>
              <th>Purpose</th>
              <th>Writable</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th>Personal vault</th>
              <td>Your active working folder for notes, memories, and registered tools.</td>
              <td>Yes</td>
            </tr>
            <tr>
              <th>Agent vault</th>
              <td>Bundled reference patterns for AI or human agents.</td>
              <td>No</td>
            </tr>
            <tr>
              <th>Shared vault</th>
              <td>Extra read-only project or team context.</td>
              <td>No</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="docs-section">
        <h2>Workspace detection</h2>
        <p>
          The Agents, Skills, and Tools views detect notes from any of three signals, in this order
          of specificity:
        </p>
        <ol className="docs-prose-list">
          <li>
            Frontmatter value: <code>type: agent</code>, <code>type: skill</code>, or{' '}
            <code>type: tool</code>.
          </li>
          <li>
            Folder location: <code>Agents/</code>, <code>Skills/</code>, or <code>Tools/</code>{' '}
            anywhere in the path.
          </li>
          <li>
            Inline tag: <code>#agent</code>, <code>#skill</code>, or <code>#tool</code>.
          </li>
        </ol>
      </section>
    </>
  );
}

export function MarkdownSyntaxPage() {
  const example = [
    '---',
    'title: Launch Plan',
    'tags: [project, release]',
    'status: active',
    '---',
    '',
    '# Launch Plan',
    '',
    'See [[Agent Vault MVP|the MVP note]] for context.',
    '',
    '- [ ] Draft release notes due:2026-06-14 @nora #release',
    '- [x] Review [[Launch Plan#Milestones]]',
  ].join('\n');

  return (
    <>
      <section className="docs-section">
        <h2>Portable markdown conventions</h2>
        <p>
          Agent Vault supports lightweight syntax that works well in other markdown tools while
          powering app-specific views. The parser is intentionally small, but it covers the most
          common Obsidian-style conventions.
        </p>
        <pre className="docs-code">
          <code>{example}</code>
        </pre>
      </section>

      <section className="docs-section">
        <h2>Wiki links</h2>
        <p>
          Use Obsidian-style wiki links to connect notes. Links resolve against note title, file
          name, path without extension, or full path. If a target cannot be resolved, the graph can
          show it as a missing node and the dashboard counts it as a broken link.
        </p>
        <table className="docs-table">
          <thead>
            <tr>
              <th>Syntax</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>[[Launch Plan]]</code>
              </td>
              <td>Creates a note link, backlink, and graph edge.</td>
            </tr>
            <tr>
              <td>
                <code>[[Launch Plan|alias]]</code>
              </td>
              <td>Displays custom link text while targeting the same note.</td>
            </tr>
            <tr>
              <td>
                <code>[[Launch Plan#Milestones]]</code>
              </td>
              <td>Links to a specific heading in the target note.</td>
            </tr>
            <tr>
              <td>
                <code>[[Projects/Launch Plan]]</code>
              </td>
              <td>Uses a path-qualified reference when note names are duplicated.</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="docs-section">
        <h2>Tags</h2>
        <p>
          Agent Vault reads tags from inline markdown and from frontmatter. Tags support letters,
          numbers, underscores, slashes, and hyphens.
        </p>
        <pre className="docs-code">
          <code>
            {[
              '---',
              'tags: [project, research]',
              '---',
              '',
              '# Launch Plan',
              '',
              'This note is part of #agent-vault and #release.',
            ].join('\n')}
          </code>
        </pre>
        <div className="docs-callout muted-callout">
          <FileText size={16} />
          <p>
            Inline tags must look like <code>#tag</code>, <code>#folder/tag</code>, or{' '}
            <code>#tag-name</code>. Frontmatter tags should be a comma-separated string or an
            array-like value such as <code>tags: [research, agent]</code>.
          </p>
        </div>
      </section>

      <section className="docs-section">
        <h2>Tasks</h2>
        <p>
          Tasks use GitHub-flavored markdown checkboxes. The Tasks view collects them from every
          note, filters active or completed work, supports search, and can toggle completion back
          into the source file when the vault is writable.
        </p>
        <pre className="docs-code">
          <code>
            {[
              '- [ ] Draft release notes due:2026-06-14 @nora #release',
              '- [x] Review [[Agent Vault MVP]]',
            ].join('\n')}
          </code>
        </pre>
        <table className="docs-table">
          <thead>
            <tr>
              <th>Pattern</th>
              <th>Meaning</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>due:YYYY-MM-DD</code>
              </td>
              <td>Due date shown on the task item.</td>
            </tr>
            <tr>
              <td>
                <code>@name</code>
              </td>
              <td>Assignee shown on the task item.</td>
            </tr>
            <tr>
              <td>
                <code>#tag</code>
              </td>
              <td>Task tag included in task filtering and display.</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="docs-section">
        <h2>Frontmatter</h2>
        <p>
          Frontmatter is optional. Agent Vault supports simple <code>key: value</code> pairs and
          comma-style arrays such as <code>[agent, research]</code>.
        </p>
        <pre className="docs-code">
          <code>
            {[
              '---',
              'title: Launch Plan',
              'tags: [project, launch]',
              'status: active',
              '---',
              '',
              '# Launch Plan',
            ].join('\n')}
          </code>
        </pre>
        <div className="docs-callout">
          <Sparkles size={16} />
          <p>
            The parser is intentionally lightweight. Complex YAML features such as nested objects,
            multiline strings, and advanced quoting are not supported yet.
          </p>
        </div>
      </section>
    </>
  );
}

export function WorkspaceEntitiesPage() {
  const agentExample = [
    '---',
    'type: agent',
    'role: researcher',
    'status: active',
    'model: DeepSeek V4',
    'skills: [research, synthesis]',
    'tags: [agent, research]',
    '---',
    '',
    '# Vega',
    '',
    '- [ ] Review [[Market Notes]]',
    '- [ ] Summarize #research findings',
  ].join('\n');

  return (
    <>
      <section className="docs-section">
        <h2>People, tools, and AI agents as notes</h2>
        <p>
          Agent, skill, and tool notes are ordinary markdown notes that describe a human, AI agent,
          skill, or tool. Agent Vault detects a note as an entity when one of these is true:
        </p>
        <ul className="docs-prose-list">
          <li>
            The note has <code>type: agent</code>, <code>type: skill</code>, or{' '}
            <code>type: tool</code> in frontmatter.
          </li>
          <li>
            The note path includes an <code>Agents/</code>, <code>Skills/</code>, or{' '}
            <code>Tools/</code> folder.
          </li>
          <li>
            The note has a matching inline tag: <code>#agent</code>, <code>#skill</code>, or{' '}
            <code>#tool</code>.
          </li>
        </ul>
        <p>
          The Agents view displays profile cards with metadata, status, model, skills, readiness,
          backlinks, outgoing links, and open task counts. Skills and tools get the same treatment
          in their own views.
        </p>
      </section>

      <section className="docs-section">
        <h2>Agent note example</h2>
        <pre className="docs-code">
          <code>{agentExample}</code>
        </pre>
        <div className="docs-callout muted-callout">
          <Bot size={16} />
          <p>
            Cards summarize profile metadata, open tasks, and links into the rest of your vault. The
            same pattern works for <code>type: skill</code> and <code>type: tool</code> notes.
          </p>
        </div>
      </section>

      <section className="docs-section">
        <h2>Common frontmatter keys</h2>
        <table className="docs-table">
          <thead>
            <tr>
              <th>Key</th>
              <th>Used for</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th>type</th>
              <td>
                Sets the entity type: <code>agent</code>, <code>skill</code>, <code>tool</code>,{' '}
                <code>memory</code>.
              </td>
            </tr>
            <tr>
              <th>role</th>
              <td>
                Free-form role label for agents, such as <code>researcher</code> or{' '}
                <code>planner</code>.
              </td>
            </tr>
            <tr>
              <th>status</th>
              <td>
                Lifecycle state such as <code>active</code>, <code>draft</code>, or{' '}
                <code>archived</code>.
              </td>
            </tr>
            <tr>
              <th>model</th>
              <td>Model name for AI agents.</td>
            </tr>
            <tr>
              <th>skills</th>
              <td>Array of skills the agent can use.</td>
            </tr>
            <tr>
              <th>tags</th>
              <td>Inline or array tags for filtering and grouping.</td>
            </tr>
          </tbody>
        </table>
      </section>
    </>
  );
}

export function ToolsAndMcpPage() {
  const mcpExample = [
    '---',
    'type: tool',
    'provider: mcp',
    'server: filesystem',
    'tool_id: filesystem.read_file',
    'status: inactive',
    'permission: ask',
    'risk: medium',
    'description: Read a file exposed by the filesystem MCP server.',
    '---',
  ].join('\n');

  return (
    <>
      <section className="docs-section">
        <h2>Tool notes</h2>
        <p>
          Tool notes are ordinary markdown notes detected by <code>type: tool</code>, a{' '}
          <code>Tools/</code> path, or the <code>#tool</code> tag. The Tools view lists them, and
          the registry stores permission, risk, and provider metadata in frontmatter.
        </p>
      </section>

      <section className="docs-section">
        <h2>Registering MCP tools</h2>
        <p>
          Use <strong>Tools &amp; MCP Registry</strong> → <strong>Register MCP tool</strong> to
          create a new tool note. Registration creates browser-visible metadata; MCP execution is
          local sidecar/dev-capable, while internal browser tools remain the dependable default.
        </p>
        <pre className="docs-code">
          <code>{mcpExample}</code>
        </pre>
        <div className="docs-callout muted-callout">
          <Shield size={16} />
          <p>
            Permission changes persist by updating the source note frontmatter when the tool note is
            in the personal vault. Agent Vault and shared tool notes are read-only.
          </p>
        </div>
      </section>

      <section className="docs-section">
        <h2>Frontmatter reference</h2>
        <table className="docs-table">
          <thead>
            <tr>
              <th>Key</th>
              <th>Meaning</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th>provider</th>
              <td>
                Source of the tool, typically <code>mcp</code>.
              </td>
            </tr>
            <tr>
              <th>server</th>
              <td>Name of the MCP server that exposes the tool.</td>
            </tr>
            <tr>
              <th>tool_id</th>
              <td>
                Stable identifier used by the server, e.g. <code>filesystem.read_file</code>.
              </td>
            </tr>
            <tr>
              <th>status</th>
              <td>
                Lifecycle state: <code>inactive</code>, <code>active</code>, <code>deprecated</code>
                .
              </td>
            </tr>
            <tr>
              <th>permission</th>
              <td>
                How the tool is allowed to run: <code>ask</code>, <code>allow</code>,{' '}
                <code>deny</code>.
              </td>
            </tr>
            <tr>
              <th>risk</th>
              <td>
                Risk level: <code>low</code>, <code>medium</code>, <code>high</code>.
              </td>
            </tr>
            <tr>
              <th>description</th>
              <td>Short human-readable description of what the tool does.</td>
            </tr>
            <tr>
              <th>install_hint</th>
              <td>
                Optional shell command to install server dependencies (shown in the detail drawer).
              </td>
            </tr>
            <tr>
              <th>capabilities_url</th>
              <td>Optional URL the user can open to read the upstream capability matrix.</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="docs-section" id="markitdown">
        <h2>Import documents with MarkItDown</h2>
        <p>
          Agent Vault ships a built-in <strong>MarkItDown</strong> MCP server that converts PDFs,
          Word documents, Excel spreadsheets, PowerPoint decks, Outlook messages, HTML, CSV, JSON,
          XML, EPub, and ZIP files into clean Markdown and saves them as sidecar notes next to the
          source. The server is part of the repo (<code>servers/markitdown-mcp/</code>) and wraps
          the official
          <a href="https://github.com/microsoft/markitdown" target="_blank" rel="noreferrer">
            {' '}
            microsoft/markitdown
          </a>{' '}
          library.
        </p>

        <h3>One-time setup</h3>
        <ol>
          <li>Install Python 3.10 or newer in a virtual environment.</li>
          <li>
            <pre className="docs-code">
              <code>{`cd servers/markitdown-mcp
pip install -r requirements.txt`}</code>
            </pre>
            This pulls <code>markitdown</code> plus the document extras (<code>pdf</code>,{' '}
            <code>docx</code>, <code>pptx</code>, <code>xlsx</code>, <code>outlook</code>).
          </li>
          <li>
            Start the bridge in a second terminal: <code>npm run bridge:dev</code>. The bridge
            listens on <code>http://localhost:7777</code>.
          </li>
        </ol>

        <h3>Register the server</h3>
        <p>
          Open <strong>Tools</strong> → <strong>Register MarkItDown</strong> (or click the same
          button on the empty state). The Tools page auto-seeds three tool notes under{' '}
          <code>Tools/MCP/markitdown/</code>:
        </p>
        <ul>
          <li>
            <code>convert.md</code> — <code>markitdown.convert</code> (medium risk, <code>ask</code>
            )
          </li>
          <li>
            <code>list-capabilities.md</code> — <code>markitdown.list_capabilities</code> (low risk,{' '}
            <code>read-only</code>)
          </li>
          <li>
            <code>install-extras.md</code> — <code>markitdown.install_extras</code> (high risk,{' '}
            <code>ask</code>)
          </li>
        </ul>

        <h3>Convert a file</h3>
        <ol>
          <li>
            Click the <strong>MarkItDown Convert</strong> tool card to open its detail drawer.
          </li>
          <li>
            Click <strong>Convert file…</strong> and pick a PDF, DOCX, XLSX, PPTX, etc. from your
            filesystem. The bridge returns the Markdown, and the app saves it as a sidecar note next
            to the source (e.g. <code>Reports/q3.pdf</code> → <code>Reports/q3.md</code>).
          </li>
          <li>
            Or paste an <code>https://</code> URL into the <strong>Convert URL</strong> field. The
            server blocks loopback, link-local, and private CIDR destinations for safety.
          </li>
        </ol>

        <h3>Add more file types</h3>
        <p>
          Open the <strong>MarkItDown Install Extras</strong> tool, pick an extras group (
          <code>ocr</code>, <code>audio-transcription</code>,<code>youtube-transcription</code>,{' '}
          <code>az-doc-intel</code>, or <code>az-content-understanding</code>), and click
          <strong> Run pip install</strong>. The server refuses to run without{' '}
          <code>confirm: true</code> and the UI double-checks via a confirmation dialog.
        </p>
        <p>
          The <strong>MarkItDown Capabilities</strong> tool calls{' '}
          <code>markitdown.list_capabilities</code> and shows which extras are currently installed.
        </p>

        <div className="docs-callout muted-callout">
          <Shield size={16} />
          <p>
            Local vault files use MarkItDown's narrow <code>convert_local</code> API. URLs are
            validated against an allowlist and
            <code>markitdown.install_extras</code> requires both a UI confirmation and a{' '}
            <code>confirm: true</code> argument before running
            <code> pip install</code>.
          </p>
        </div>
      </section>
    </>
  );
}

export function MemoryPage() {
  return (
    <>
      <section className="docs-section">
        <h2>What memory notes are</h2>
        <p>
          Memory notes are markdown notes detected by <code>type: memory</code>, a{' '}
          <code>Memory/</code> path, or the <code>#memory</code> tag. The Memory view groups cards
          by memory type and can save new personal memories or append to existing personal memory
          notes.
        </p>
      </section>

      <section className="docs-section">
        <h2>Saving and appending</h2>
        <p>
          The Memory page can create new personal memory notes or append to existing writable memory
          notes. Generated memory paths and target-derived filenames are normalized and sanitized.
        </p>
        <div className="docs-callout">
          <Shield size={16} />
          <p>
            Agent and shared memory notes can be viewed, but writes are blocked unless the target
            note is in the writable personal vault.
          </p>
        </div>
      </section>

      <section className="docs-section">
        <h2>Suggested memory layout</h2>
        <pre className="docs-code">
          <code>
            {[
              'Memory/',
              '  Daily.md',
              '  Preferences.md',
              '  Project Notes.md',
              '  Agent Reflections.md',
            ].join('\n')}
          </code>
        </pre>
        <p>
          Group memory notes by theme to make it easier to scan and append. Use <code>#memory</code>{' '}
          on related notes so they appear together in the Memory view.
        </p>
      </section>
    </>
  );
}

export function CommandCenterPage() {
  return (
    <>
      <section className="docs-section">
        <h2>Open the command center</h2>
        <p>
          Open the command center with <kbd>Ctrl</kbd> + <kbd>K</kbd> or <kbd>Cmd</kbd> +{' '}
          <kbd>K</kbd>. Use the arrow keys to move through results and press <kbd>Enter</kbd> to
          select. Press <kbd>Escape</kbd> to close.
        </p>
      </section>

      <section className="docs-section">
        <h2>Result prefixes</h2>
        <p>
          Prefix your query to narrow the result type. Without a prefix, results combine notes,
          commands, tags, agents, tasks, and health checks.
        </p>
        <table className="docs-table compact-table">
          <thead>
            <tr>
              <th>Prefix</th>
              <th>Scope</th>
              <th>Example</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>&gt;</code>
              </td>
              <td>Commands</td>
              <td>
                <code>&gt; open graph</code>
              </td>
            </tr>
            <tr>
              <td>
                <code>#</code>
              </td>
              <td>Tags</td>
              <td>
                <code>#release</code>
              </td>
            </tr>
            <tr>
              <td>
                <code>@</code>
              </td>
              <td>Agents</td>
              <td>
                <code>@nora</code>
              </td>
            </tr>
            <tr>
              <td>
                <code>?</code>
              </td>
              <td>Health checks (orphan-style notes with no links and no tags)</td>
              <td>
                <code>? orphans</code>
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="docs-section">
        <h2>Search ranking</h2>
        <p>
          Search is ranked by title, path, tags, and content snippets. Title matches surface first,
          then path matches, then tag and content matches. Duplicated note names are scored lower
          than path-qualified matches, so prefer <code>Projects/Launch Plan</code> over{' '}
          <code>Launch Plan</code> in large vaults.
        </p>
      </section>
    </>
  );
}

export function LocalFilesPage() {
  return (
    <>
      <section className="docs-section">
        <h2>File System Access</h2>
        <p>
          Writable vaults use the browser File System Access API. Hidden, generated, and
          tool-specific folders are skipped during scans.
        </p>
        <div className="docs-rule-list">
          <div>
            <Sparkles size={14} aria-hidden="true" />
            <span>
              Reads <code>.md</code> and <code>.markdown</code> files recursively.
            </span>
          </div>
          <div>
            <Sparkles size={14} aria-hidden="true" />
            <span>
              Skips <code>.git</code>, <code>node_modules</code>, <code>dist</code>,{' '}
              <code>.obsidian</code>, and dot-prefixed folders.
            </span>
          </div>
          <div>
            <Sparkles size={14} aria-hidden="true" />
            <span>
              Normalizes created paths and appends <code>.md</code> when needed.
            </span>
          </div>
          <div>
            <Sparkles size={14} aria-hidden="true" />
            <span>
              Blocks empty paths, path traversal, invalid filesystem characters, and conflicts.
            </span>
          </div>
        </div>
      </section>

      <section className="docs-section">
        <h2>Path rules</h2>
        <p>When creating or renaming notes, Agent Vault normalizes and validates paths:</p>
        <ul className="docs-prose-list">
          <li>
            Backslashes are converted to <code>/</code>.
          </li>
          <li>Leading and trailing slashes are removed.</li>
          <li>Repeated whitespace is normalized.</li>
          <li>
            <code>.md</code> is added if no markdown extension is provided.
          </li>
          <li>Empty paths are rejected.</li>
          <li>
            Path traversal with <code>..</code> is rejected.
          </li>
          <li>Common cross-platform invalid filename characters are rejected.</li>
          <li>
            Paths longer than 240 characters and file names longer than 100 characters are rejected.
          </li>
          <li>
            Existing note paths are checked case-insensitively before create or rename operations.
          </li>
        </ul>
      </section>

      <section className="docs-section">
        <h2>Renames and deletes</h2>
        <p>
          Renaming copies content to the new path and then deletes the old file, which avoids losing
          note content if the copy fails. Deleting a note selects a real remaining note instead of
          relying on the deleted key position.
        </p>
        <div className="docs-callout">
          <Shield size={16} />
          <p>
            Create, rename, delete, save, task toggles, generated notes, memory writes, and tool
            permission changes are limited to personal vault notes.
          </p>
        </div>
      </section>
    </>
  );
}

export function ShortcutsPage() {
  return (
    <>
      <section className="docs-section">
        <h2>Global shortcuts</h2>
        <p>
          Use the system modifier for your platform: <kbd>Ctrl</kbd> on Windows and Linux,{' '}
          <kbd>Cmd</kbd> on macOS.
        </p>
        <table className="docs-table compact-table">
          <tbody>
            <tr>
              <th>
                <kbd>Ctrl/Cmd</kbd> + <kbd>K</kbd>
              </th>
              <td>Open the command center.</td>
            </tr>
            <tr>
              <th>
                <kbd>Ctrl/Cmd</kbd> + <kbd>S</kbd>
              </th>
              <td>Save the current note.</td>
            </tr>
            <tr>
              <th>
                <kbd>Ctrl/Cmd</kbd> + <kbd>N</kbd>
              </th>
              <td>Create a new note when a writable vault is open.</td>
            </tr>
            <tr>
              <th>
                <kbd>Ctrl/Cmd</kbd> + <kbd>,</kbd>
              </th>
              <td>Open settings.</td>
            </tr>
            <tr>
              <th>
                <kbd>Escape</kbd>
              </th>
              <td>Close open dialogs or the command center.</td>
            </tr>
            <tr>
              <th>
                Arrow keys + <kbd>Enter</kbd>
              </th>
              <td>Move through command center results and select an item.</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="docs-section">
        <h2>Editor shortcuts</h2>
        <table className="docs-table compact-table">
          <tbody>
            <tr>
              <th>
                <kbd>Ctrl/Cmd</kbd> + <kbd>B</kbd>
              </th>
              <td>Bold selected text or insert a bold placeholder.</td>
            </tr>
            <tr>
              <th>
                <kbd>Ctrl/Cmd</kbd> + <kbd>I</kbd>
              </th>
              <td>Italicize selected text or insert an italic placeholder.</td>
            </tr>
            <tr>
              <th>
                <kbd>Ctrl/Cmd</kbd> + <kbd>`</kbd>
              </th>
              <td>Wrap selected text in inline code or insert a code placeholder.</td>
            </tr>
            <tr>
              <th>
                <kbd>Ctrl/Cmd</kbd> + <kbd>Shift</kbd> + <kbd>X</kbd>
              </th>
              <td>Apply strikethrough to selected text or insert a strikethrough placeholder.</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="docs-section">
        <h2>Command center prefixes</h2>
        <table className="docs-table compact-table">
          <thead>
            <tr>
              <th>Prefix</th>
              <th>Search scope</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>&gt;</code>
              </td>
              <td>Commands only.</td>
            </tr>
            <tr>
              <td>
                <code>#</code>
              </td>
              <td>Tags.</td>
            </tr>
            <tr>
              <td>
                <code>@</code>
              </td>
              <td>Agents.</td>
            </tr>
            <tr>
              <td>
                <code>?</code>
              </td>
              <td>Vault health checks, currently orphan-style notes with no links and no tags.</td>
            </tr>
          </tbody>
        </table>
      </section>
    </>
  );
}

export function ArchitecturePage() {
  return (
    <>
      <section className="docs-section">
        <h2>App shape</h2>
        <p>
          Agent Vault is a single-page React app. Most application state lives in{' '}
          <code>src/App.tsx</code>, with focused utilities and components for parsing, filesystem
          access, graph logic, search, and views.
        </p>
      </section>

      <section className="docs-section">
        <h2>Important files</h2>
        <table className="docs-table">
          <thead>
            <tr>
              <th>Path</th>
              <th>Responsibility</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th>
                <code>src/App.tsx</code>
              </th>
              <td>
                App-level state, vault loading, note selection, save/create/rename/delete handlers,
                global shortcuts, and view routing.
              </td>
            </tr>
            <tr>
              <th>
                <code>src/utils/vault.ts</code>
              </th>
              <td>
                File System Access API helpers, directory scanning, note loading, note writing, note
                creation, rename, delete, and starter vault copying.
              </td>
            </tr>
            <tr>
              <th>
                <code>src/utils/vaultRegistry.ts</code>
              </th>
              <td>
                IndexedDB persistence for saved vault handles, quick switching, and default personal
                vault selection.
              </td>
            </tr>
            <tr>
              <th>
                <code>src/utils/markdown.ts</code>
              </th>
              <td>
                Frontmatter parsing, wiki links, tags, tasks, headings, backlinks, graph data,
                broken links, orphan notes, agent detection, markdown rendering, and task toggling.
              </td>
            </tr>
            <tr>
              <th>
                <code>src/utils/graph.ts</code>
              </th>
              <td>Graph filtering and node-connection highlighting helpers.</td>
            </tr>
            <tr>
              <th>
                <code>src/utils/search.ts</code>
              </th>
              <td>Ranked note search by title, path, tags, and content snippets.</td>
            </tr>
            <tr>
              <th>
                <code>src/utils/paths.ts</code>
              </th>
              <td>
                Vault path normalization, validation, default path generation, and conflict checks.
              </td>
            </tr>
            <tr>
              <th>
                <code>src/utils/preferences.ts</code>
              </th>
              <td>
                Local preference persistence for theme, view, editor mode, and last vault name.
              </td>
            </tr>
            <tr>
              <th>
                <code>src/components/GraphView.tsx</code>
              </th>
              <td>3D graph rendering and filtering UI.</td>
            </tr>
            <tr>
              <th>
                <code>src/components/TasksView.tsx</code>
              </th>
              <td>
                Cross-vault tasks with Kanban, List, and Table view modes, status filters, search,
                quick filters, and task completion toggles.
              </td>
            </tr>
            <tr>
              <th>
                <code>src/components/TagsView.tsx</code>
              </th>
              <td>Tag usage summaries and tag-driven note navigation.</td>
            </tr>
            <tr>
              <th>
                <code>src/components/AgentsView.tsx</code>
              </th>
              <td>
                Agent profile cards, filters, readiness, task counts, backlinks, and detail drawer.
              </td>
            </tr>
            <tr>
              <th>
                <code>src/components/CommandCenter.tsx</code>
              </th>
              <td>Keyboard-driven command, note, tag, agent, task, and health search.</td>
            </tr>
            <tr>
              <th>
                <code>src/components/ProductPages.tsx</code>
              </th>
              <td>In-app product pages: roadmap, release notes, and about.</td>
            </tr>
            <tr>
              <th>
                <code>src/components/Documentation/</code>
              </th>
              <td>
                Multi-page in-app documentation site, including layout, sidebar, breadcrumb,
                on-this-page, and individual page components.
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="docs-section">
        <h2>Tech stack</h2>
        <table className="docs-table">
          <tbody>
            <tr>
              <th>Framework</th>
              <td>React 18 with Vite and TypeScript.</td>
            </tr>
            <tr>
              <th>3D graph</th>
              <td>
                <code>react-force-graph-3d</code> on top of <code>three</code>.
              </td>
            </tr>
            <tr>
              <th>Markdown</th>
              <td>
                <code>marked</code> for rendering and <code>DOMPurify</code> for sanitization.
              </td>
            </tr>
            <tr>
              <th>Icons</th>
              <td>
                <code>lucide-react</code>.
              </td>
            </tr>
            <tr>
              <th>Module system</th>
              <td>ESM with Vite/Bundler-style module resolution.</td>
            </tr>
            <tr>
              <th>Tests</th>
              <td>
                No test framework configured. Use <code>npm run build</code> as the primary check.
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </>
  );
}

export function TroubleshootingPage() {
  return (
    <>
      <section className="docs-section">
        <h2>The app cannot save files</h2>
        <p>
          Use Chrome or Microsoft Edge and open a local folder with <strong>Open vault</strong> or a
          starter vault. Unsupported browsers may not expose local file write permissions.
        </p>
      </section>

      <section className="docs-section">
        <h2>The browser asks for permission again</h2>
        <p>
          This is normal. Browser-granted folder handles can expire or require renewed permission
          after refreshes, restarts, or security changes. Re-open the vault and grant the access
          prompt when it appears.
        </p>
      </section>

      <section className="docs-section">
        <h2>AI chat cannot reach LM Studio</h2>
        <p>
          In development, the Vite dev server proxies <code>/lms/*</code> to{' '}
          <code>http://localhost:1234/*</code> (LM Studio's default local server), so the app's
          default <code>baseUrl</code> is <code>/lms/v1</code> and the browser sees same-origin
          requests. Make sure LM Studio is running with <strong>Start Server</strong> enabled in the
          Developer tab and at least one model loaded.
        </p>
        <p>
          In a production build served from a static host, the same path is meaningless. Set the AI{' '}
          <strong>Base URL</strong> in Settings to <code>http://localhost:1234/v1</code> (or your
          remote LM Studio URL) and enable <strong>CORS</strong> for your app's origin in LM
          Studio's Developer → Local Server settings. CORS is the only required change; the chat,
          models, and streaming endpoints are OpenAI-compatible.
        </p>
      </section>

      <section className="docs-section">
        <h2>My link shows as missing</h2>
        <p>
          Check that the link target matches a note title, file name without <code>.md</code>, full
          path without <code>.md</code>, or full path. For example,{' '}
          <code>[[Projects/Launch Plan]]</code> is more specific than <code>[[Launch Plan]]</code>{' '}
          if you have duplicate note names.
        </p>
      </section>

      <section className="docs-section">
        <h2>A tag does not appear</h2>
        <p>
          Inline tags must look like <code>#tag</code>, <code>#folder/tag</code>, or{' '}
          <code>#tag-name</code>. Frontmatter tags should be a comma-separated string or an
          array-like value such as <code>tags: [research, agent]</code>.
        </p>
      </section>

      <section className="docs-section">
        <h2>A task does not appear</h2>
        <p>
          Tasks must use <code>- [ ]</code> or <code>- [x]</code> at the start of a markdown list
          line. Other checkbox formats are not parsed yet.
        </p>
      </section>

      <section className="docs-section">
        <h2>A note is not detected as an agent</h2>
        <p>
          Add <code>type: agent</code> to frontmatter, move the note under an <code>Agents/</code>{' '}
          folder, or add the <code>#agent</code> tag.
        </p>
      </section>
    </>
  );
}

export function FaqPage() {
  return (
    <>
      <section className="docs-section">
        <h2>Where is my data stored?</h2>
        <p>
          Your vault is stored as plain <code>.md</code> files in the folder you opened. Agent Vault
          only adds an IndexedDB entry to remember your saved vaults and local UI preferences. There
          is no cloud sync, no server, and no telemetry.
        </p>
      </section>

      <section className="docs-section">
        <h2>Can I use this with an existing Obsidian vault?</h2>
        <p>
          Yes. Open the same folder in Agent Vault and the app will scan the same <code>.md</code>{' '}
          files. Hidden directories such as <code>.obsidian</code> are ignored, so Obsidian-specific
          files do not appear in the tree.
        </p>
      </section>

      <section className="docs-section">
        <h2>Why is the editor showing the wrong note after refresh?</h2>
        <p>
          Refresh preserves the selected note when the note still exists. If the note was renamed or
          deleted by another tool, Agent Vault will fall back to a safe default selection. Check the
          file tree to confirm the note is still where you expect it.
        </p>
      </section>

      <section className="docs-section">
        <h2>How are agents, skills, and tools discovered?</h2>
        <p>
          Each is detected by <code>type</code> in frontmatter, by folder location, or by an inline
          tag. See <a href="#/docs/workspace-entities">Workspace entities</a> for the full rules.
        </p>
      </section>

      <section className="docs-section">
        <h2>Does MCP run inside the browser?</h2>
        <p>
          No. Registering an MCP tool creates a markdown metadata note under <code>Tools/MCP/</code>
          . Local MCP execution is handled only through the optional Node sidecar during
          development; internal browser tools remain available without the sidecar.
        </p>
      </section>

      <section className="docs-section">
        <h2>How do I import a PDF or Word file as Markdown?</h2>
        <p>
          Open <strong>Tools</strong> and click <strong>Register MarkItDown</strong>. The
          bridge-side <code>servers/markitdown-mcp/</code> Python server converts PDFs, DOCX, XLSX,
          PPTX, and more into Markdown and saves them as sidecar notes. See{' '}
          <a href="#/docs/tools-and-mcp#markitdown">
            Tools &amp; MCP → Import documents with MarkItDown
          </a>{' '}
          for the full walkthrough.
        </p>
      </section>

      <section className="docs-section">
        <h2>What happens when I rename a note?</h2>
        <p>
          Agent Vault copies the content to the new path and then deletes the old file. This keeps
          content safe even if the copy fails partway through. Wiki links from other notes still
          resolve because they match by title or path.
        </p>
      </section>

      <section className="docs-section">
        <h2>Can I add my own CSS or themes?</h2>
        <p>
          The app supports light, dark, and system theme modes. Custom themes are not yet a
          supported extension point; the safest place to experiment is by editing{' '}
          <code>src/styles.css</code> locally.
        </p>
      </section>
    </>
  );
}

export const _docIcons = {
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
  MapIcon,
  Network,
  Search,
  SettingsIcon,
  Shield,
  Sparkles,
  Wrench,
  Zap,
};
