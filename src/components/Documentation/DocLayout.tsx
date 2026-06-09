import { useRef, useState, type ReactNode } from 'react';
import { Menu, X } from 'lucide-react';
import type { DocNavItem } from './data/navigation';
import { DocSidebar } from './DocSidebar';
import { DocBreadcrumb } from './DocBreadcrumb';
import { DocOnThisPage } from './DocOnThisPage';
import { ArrowLeft, ArrowRight } from 'lucide-react';

interface DocLayoutProps {
  current: DocNavItem;
  onNavigate: (slug: string) => void;
  prev: DocNavItem | null;
  next: DocNavItem | null;
  children: ReactNode;
  onThisPage?: boolean;
}

export function DocLayout({
  current,
  onNavigate,
  prev,
  next,
  children,
  onThisPage = true,
}: DocLayoutProps) {
  const contentRef = useRef<HTMLElement | null>(null);
  const [navOpen, setNavOpen] = useState(false);

  return (
    <main className="page-scroll view-page docs-page docs-page-multipage">
      <header className="docs-page-header">
        <div className="docs-page-header-row">
          <button
            type="button"
            className="ghost-button docs-page-toc-toggle"
            onClick={() => setNavOpen((value) => !value)}
            aria-expanded={navOpen}
            aria-controls="docs-mobile-nav"
          >
            {navOpen ? <X size={14} /> : <Menu size={14} />}
            Contents
          </button>
          <DocBreadcrumb
            trail={[{ label: 'Docs', slug: 'overview' }, { label: current.label }]}
            onNavigate={onNavigate}
          />
        </div>
      </header>

      <div className={`docs-layout${navOpen ? ' mobile-nav-open' : ''}`}>
        <div className="docs-layout-sidebar" id="docs-mobile-nav">
          <DocSidebar
            currentSlug={current.slug}
            onNavigate={(slug) => {
              onNavigate(slug);
              setNavOpen(false);
            }}
          />
        </div>

        <button
          type="button"
          className="docs-layout-scrim"
          aria-label="Close navigation"
          onClick={() => setNavOpen(false)}
          tabIndex={navOpen ? 0 : -1}
        />

        <article
          className="docs-article docs-article-page"
          ref={(node) => {
            contentRef.current = node;
          }}
        >
          <section className="docs-section docs-section-page-head">
            <div className="docs-section-heading">
              <span className="docs-kicker">
                <current.icon size={13} aria-hidden="true" /> {current.label}
              </span>
              <h1>{current.label}</h1>
              <p>{current.summary}</p>
            </div>
          </section>

          {children}

          <nav className="docs-page-nav" aria-label="Page navigation">
            {prev ? (
              <button
                type="button"
                className="docs-page-nav-link"
                onClick={() => onNavigate(prev.slug)}
              >
                <ArrowLeft size={14} aria-hidden="true" />
                <span>
                  <small>Previous</small>
                  <strong>{prev.label}</strong>
                </span>
              </button>
            ) : (
              <span />
            )}
            {next ? (
              <button
                type="button"
                className="docs-page-nav-link next"
                onClick={() => onNavigate(next.slug)}
              >
                <span>
                  <small>Next</small>
                  <strong>{next.label}</strong>
                </span>
                <ArrowRight size={14} aria-hidden="true" />
              </button>
            ) : (
              <span />
            )}
          </nav>
        </article>

        {onThisPage && (
          <div className="docs-layout-toc">
            <DocOnThisPage contentRef={contentRef} />
          </div>
        )}
      </div>
    </main>
  );
}
