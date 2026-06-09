import { useEffect, useState, type ReactNode } from 'react';

interface DocOnThisPageProps {
  contentRef: React.RefObject<HTMLElement | null>;
}

interface TocItem {
  id: string;
  text: string;
  level: number;
}

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 64) || 'section'
  );
}

export function DocOnThisPage({ contentRef }: DocOnThisPageProps) {
  const [items, setItems] = useState<TocItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const node = contentRef.current;
    if (!node) {
      setItems([]);
      return;
    }
    const headings = Array.from(node.querySelectorAll<HTMLElement>('h2, h3'));
    const generated: TocItem[] = [];
    const seen = new Map<string, number>();
    headings.forEach((heading) => {
      if (!heading.id) {
        const base = slugify(heading.textContent ?? '');
        const count = seen.get(base) ?? 0;
        seen.set(base, count + 1);
        heading.id = count === 0 ? base : `${base}-${count}`;
      }
      generated.push({
        id: heading.id,
        text: heading.textContent ?? '',
        level: heading.tagName === 'H3' ? 3 : 2,
      });
    });
    setItems(generated);

    if (!('IntersectionObserver' in window) || generated.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]?.target.id) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: '-20% 0px -70% 0px', threshold: 0 },
    );
    headings.forEach((heading) => observer.observe(heading));
    return () => observer.disconnect();
  }, [contentRef]);

  if (items.length === 0) {
    return (
      <aside className="docs-on-this-page" aria-label="On this page">
        <div className="docs-on-this-page-title">On this page</div>
        <p className="docs-on-this-page-empty">No sections on this page.</p>
      </aside>
    );
  }

  return (
    <aside className="docs-on-this-page" aria-label="On this page">
      <div className="docs-on-this-page-title">On this page</div>
      <nav>
        <ul>
          {items.map((item) => (
            <li key={item.id} className={item.level === 3 ? 'is-sub' : undefined}>
              <a
                href={`#${item.id}`}
                className={activeId === item.id ? 'active' : undefined}
                onClick={(event) => {
                  event.preventDefault();
                  const target = document.getElementById(item.id);
                  if (target) {
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    setActiveId(item.id);
                    history.replaceState(null, '', `#${item.id}`);
                  }
                }}
              >
                {item.text}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}

export function DocPageActions({ children }: { children: ReactNode }) {
  return <div className="docs-page-actions">{children}</div>;
}
