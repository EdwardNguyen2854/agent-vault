import { ChevronRight } from 'lucide-react';

interface DocBreadcrumbProps {
  trail: { label: string; slug?: string }[];
  onNavigate?: (slug: string) => void;
}

export function DocBreadcrumb({ trail, onNavigate }: DocBreadcrumbProps) {
  return (
    <nav className="docs-breadcrumb" aria-label="Documentation breadcrumb">
      {trail.map((item, index) => {
        const isLast = index === trail.length - 1;
        return (
          <span key={`${item.label}-${index}`} className="docs-breadcrumb-segment">
            {item.slug && !isLast && onNavigate ? (
              <button
                type="button"
                className="docs-breadcrumb-link"
                onClick={() => onNavigate(item.slug as string)}
              >
                {item.label}
              </button>
            ) : (
              <span className={isLast ? 'docs-breadcrumb-current' : 'docs-breadcrumb-link'}>
                {item.label}
              </span>
            )}
            {!isLast && (
              <ChevronRight size={12} className="docs-breadcrumb-sep" aria-hidden="true" />
            )}
          </span>
        );
      })}
    </nav>
  );
}
