import { useEffect, useMemo, useState } from 'react';
import { DocLayout } from './DocLayout';
import {
  defaultDocSlug,
  docNavigation,
  getAdjacentDocSlugs,
  isValidDocSlug,
} from './data/navigation';
import {
  ArchitecturePage,
  CommandCenterPage,
  CoreConceptsPage,
  FaqPage,
  GettingStartedPage,
  LocalFilesPage,
  MarkdownSyntaxPage,
  MemoryPage,
  OverviewPage,
  ShortcutsPage,
  ToolsAndMcpPage,
  TroubleshootingPage,
  WorkspaceEntitiesPage,
} from './pages';
import type { ComponentType } from 'react';

type PageComponent = ComponentType;

const pageRegistry: Record<string, PageComponent> = {
  overview: OverviewPage,
  'getting-started': GettingStartedPage,
  'core-concepts': CoreConceptsPage,
  'markdown-syntax': MarkdownSyntaxPage,
  'workspace-entities': WorkspaceEntitiesPage,
  'tools-and-mcp': ToolsAndMcpPage,
  memory: MemoryPage,
  'command-center': CommandCenterPage,
  'local-files': LocalFilesPage,
  shortcuts: ShortcutsPage,
  architecture: ArchitecturePage,
  troubleshooting: TroubleshootingPage,
  faq: FaqPage,
};

function slugFromHash(): string {
  const hash = window.location.hash.replace(/^#\/?docs\/?/, '').replace(/^#\/?/, '');
  if (!hash) return defaultDocSlug;
  const slug = hash.split(/[?#]/)[0].replace(/\/+$/, '').toLowerCase();
  return isValidDocSlug(slug) ? slug : defaultDocSlug;
}

export function DocumentationPage() {
  const [slug, setSlug] = useState<string>(() => slugFromHash());

  useEffect(() => {
    const sync = () => setSlug(slugFromHash());
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  const navigate = (next: string) => {
    if (next === slug) return;
    if (isValidDocSlug(next)) {
      window.location.hash = `#/docs/${next}`;
      setSlug(next);
    }
  };

  const current = useMemo(
    () => docNavigation.find((item) => item.slug === slug) ?? docNavigation[0],
    [slug],
  );
  const { prev, next } = useMemo(() => getAdjacentDocSlugs(slug), [slug]);
  const PageComponent = pageRegistry[slug] ?? pageRegistry[defaultDocSlug];
  const showOnThisPage = slug !== 'overview';

  useEffect(() => {
    const main = document.querySelector('.page-scroll');
    if (main instanceof HTMLElement) {
      main.scrollTo({ top: 0, behavior: 'auto' });
    }
    document.title = `Agent Vault · Docs · ${current.label}`;
  }, [slug, current.label]);

  return (
    <DocLayout
      current={current}
      onNavigate={navigate}
      prev={prev}
      next={next}
      onThisPage={showOnThisPage}
    >
      <PageComponent />
    </DocLayout>
  );
}
