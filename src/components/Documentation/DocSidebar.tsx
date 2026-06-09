import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { docNavigation, docGroupMeta, type DocNavItem } from './data/navigation';

interface DocSidebarProps {
  currentSlug: string;
  onNavigate: (slug: string) => void;
}

export function DocSidebar({ currentSlug, onNavigate }: DocSidebarProps) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return docNavigation;
    return docNavigation.filter(
      (item) =>
        item.label.toLowerCase().includes(term) || item.summary.toLowerCase().includes(term),
    );
  }, [query]);

  const grouped = useMemo(() => {
    const groups: Record<DocNavItem['group'], DocNavItem[]> = {
      start: [],
      model: [],
      workflow: [],
      reference: [],
    };
    filtered.forEach((item) => {
      groups[item.group].push(item);
    });
    return groups;
  }, [filtered]);

  return (
    <aside className="docs-sidebar-left" aria-label="Documentation navigation">
      <div className="docs-sidebar-left-head">
        <span className="docs-sidebar-left-eyebrow">Documentation</span>
        <h2>Agent Vault</h2>
        <p>Browse every guide, reference, and FAQ.</p>
      </div>

      <div className="docs-sidebar-search">
        <Search size={13} aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter pages"
          aria-label="Filter documentation pages"
        />
        {query && (
          <button
            type="button"
            className="docs-sidebar-search-clear"
            onClick={() => setQuery('')}
            aria-label="Clear filter"
          >
            <X size={12} />
          </button>
        )}
      </div>

      <nav className="docs-sidebar-nav">
        {(Object.keys(grouped) as Array<DocNavItem['group']>).map((groupKey) => {
          const items = grouped[groupKey];
          if (items.length === 0) return null;
          const meta = docGroupMeta[groupKey];
          const GroupIcon = meta.icon;
          return (
            <div className="docs-sidebar-group" key={groupKey}>
              <div className="docs-sidebar-group-title">
                <GroupIcon size={12} aria-hidden="true" />
                <span>{meta.title}</span>
              </div>
              <ul>
                {items.map((item) => {
                  const Icon = item.icon;
                  const isActive = item.slug === currentSlug;
                  return (
                    <li key={item.slug}>
                      <button
                        type="button"
                        className={`docs-sidebar-link${isActive ? ' active' : ''}`}
                        onClick={() => onNavigate(item.slug)}
                        aria-current={isActive ? 'page' : undefined}
                      >
                        <Icon size={14} aria-hidden="true" />
                        <span className="docs-sidebar-link-label">{item.label}</span>
                        {isActive && (
                          <span className="docs-sidebar-link-marker" aria-hidden="true" />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="docs-sidebar-empty">No pages match “{query}”.</div>
        )}
      </nav>
    </aside>
  );
}
