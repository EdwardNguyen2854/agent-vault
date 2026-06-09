import type { ReactNode } from 'react';
import { ChevronRight, Download } from 'lucide-react';

interface ChartCardProps {
  title: string;
  subtitle?: string;
  period?: { value: number; options: number[]; onChange: (days: number) => void };
  onExport?: () => void;
  onViewAll?: () => void;
  children: ReactNode;
  className?: string;
}

export function ChartCard({
  title,
  subtitle,
  period,
  onExport,
  onViewAll,
  children,
  className = '',
}: ChartCardProps) {
  return (
    <section className={`chart-card panel-card ${className}`}>
      <header className="chart-card-header">
        <div>
          <h3 className="chart-card-title">{title}</h3>
          {subtitle && <p className="chart-card-subtitle">{subtitle}</p>}
        </div>
        <div className="chart-card-actions">
          {period && (
            <div className="chart-card-period" role="tablist" aria-label="Time period">
              {period.options.map((opt) => (
                <button
                  key={opt}
                  className={`chart-period-pill ${period.value === opt ? 'active' : ''}`}
                  onClick={() => period.onChange(opt)}
                  type="button"
                  role="tab"
                  aria-selected={period.value === opt}
                >
                  {opt}d
                </button>
              ))}
            </div>
          )}
          {onExport && (
            <button
              className="icon-btn"
              onClick={onExport}
              title="Export CSV"
              aria-label="Export CSV"
            >
              <Download size={13} />
            </button>
          )}
          {onViewAll && (
            <button className="chart-view-all" onClick={onViewAll} type="button">
              View all <ChevronRight size={12} />
            </button>
          )}
        </div>
      </header>
      <div className="chart-card-body">{children}</div>
    </section>
  );
}
