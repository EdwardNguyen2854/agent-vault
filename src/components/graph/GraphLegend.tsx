import { Network, FileX2, Sparkles, Eye, MousePointerClick } from 'lucide-react';

interface LegendItem {
  key: string;
  label: string;
  color: string;
  ring?: string;
}

interface GraphLegendProps {
  items: LegendItem[];
}

export function GraphLegend({ items }: GraphLegendProps) {
  return (
    <div className="graph-legend" aria-label="Graph legend">
      <div className="graph-legend-title">
        <Eye size={9} /> Legend
      </div>
      <ul className="graph-legend-list">
        {items.map((item) => (
          <li key={item.key}>
            <span
              className="graph-legend-swatch"
              style={{
                background: `radial-gradient(circle at 30% 30%, ${item.color}, ${item.ring || item.color})`,
                boxShadow: `0 0 0 1px rgba(0,0,0,0.04), 0 0 6px ${item.color}33`,
              }}
            />
            <span>{item.label}</span>
          </li>
        ))}
      </ul>
      <div className="graph-legend-hint">
        <MousePointerClick size={9} /> Click any node
      </div>
    </div>
  );
}

export const DEFAULT_LEGEND_ITEMS: LegendItem[] = [
  { key: 'note', label: 'Note', color: '#2563EB' },
  { key: 'entity', label: 'Agent / Skill / Tool', color: '#7C3AED' },
  { key: 'missing', label: 'Missing', color: '#DC2626' },
  { key: 'selected', label: 'Selected', color: '#D97706' },
  { key: 'connected', label: 'Connected', color: '#22C55E' },
];

export const LEGEND_ICON_MAP: Record<string, typeof Network> = {
  note: Network,
  entity: Sparkles,
  missing: FileX2,
  selected: Eye,
  connected: Eye,
};
