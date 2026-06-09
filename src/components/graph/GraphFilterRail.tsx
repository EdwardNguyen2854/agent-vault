import { useState } from 'react';
import {
  Filter,
  Hash,
  Network,
  Tag as TagIcon,
  Layers,
  Sliders,
  RotateCcw,
  Sparkles,
  Boxes,
} from 'lucide-react';
import type { GraphFilterState } from '../../types';

export type GroupBy = 'vault' | 'folder' | 'tag' | 'entity';

export interface FilterRailExtras {
  density: number;
  onDensityChange: (value: number) => void;
  groupBy: GroupBy;
  onGroupByChange: (value: GroupBy) => void;
  onReset: () => void;
}

interface GraphFilterRailProps {
  open: boolean;
  allTags: string[];
  filterState: GraphFilterState;
  onFilterStateChange: (next: GraphFilterState) => void;
  extras: FilterRailExtras;
  groupSummaries: { name: string; count: number; color: string }[];
  activeGroup: string | null;
  onSelectGroup: (group: string | null) => void;
}

const GROUP_BY_OPTIONS: { value: GroupBy; label: string; icon: typeof Hash }[] = [
  { value: 'vault', label: 'Vault', icon: Boxes },
  { value: 'folder', label: 'Folder', icon: Layers },
  { value: 'tag', label: 'Tag', icon: TagIcon },
  { value: 'entity', label: 'Type', icon: Sparkles },
];

export function GraphFilterRail({
  open,
  allTags,
  filterState,
  onFilterStateChange,
  extras,
  groupSummaries,
  activeGroup,
  onSelectGroup,
}: GraphFilterRailProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`graph-rail ${open ? 'open' : ''} ${collapsed ? 'collapsed' : ''}`}
      aria-label="Graph filters"
    >
      <div className="graph-rail-header">
        <div className="graph-rail-title">
          <Filter size={13} />
          <span>Filters</span>
        </div>
        <div className="graph-rail-header-actions">
          <button
            type="button"
            className="graph-rail-icon-btn"
            onClick={extras.onReset}
            title="Reset filters"
            aria-label="Reset filters"
          >
            <RotateCcw size={12} />
          </button>
          <button
            type="button"
            className="graph-rail-icon-btn"
            onClick={() => setCollapsed((value) => !value)}
            title={collapsed ? 'Expand' : 'Collapse'}
            aria-label={collapsed ? 'Expand filter rail' : 'Collapse filter rail'}
          >
            {collapsed ? '›' : '‹'}
          </button>
        </div>
      </div>

      <div className="graph-rail-body">
        <div className="graph-rail-section">
          <div className="graph-rail-section-title">
            <Sliders size={11} /> Density
          </div>
          <div className="graph-rail-density">
            <input
              type="range"
              min={0.4}
              max={2}
              step={0.05}
              value={extras.density}
              onChange={(event) => extras.onDensityChange(Number(event.target.value))}
              className="graph-rail-slider"
              aria-label="Graph density"
            />
            <span className="graph-rail-density-value">{extras.density.toFixed(2)}×</span>
          </div>
        </div>

        <div className="graph-rail-section">
          <div className="graph-rail-section-title">
            <Layers size={11} /> Group by
          </div>
          <div className="graph-rail-segmented" role="tablist" aria-label="Group by">
            {GROUP_BY_OPTIONS.map((option) => {
              const Icon = option.icon;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="tab"
                  aria-selected={extras.groupBy === option.value}
                  className={`graph-rail-segmented-btn ${extras.groupBy === option.value ? 'active' : ''}`}
                  onClick={() => extras.onGroupByChange(option.value)}
                  title={`Group by ${option.label.toLowerCase()}`}
                >
                  <Icon size={11} /> {option.label}
                </button>
              );
            })}
          </div>
        </div>

        {groupSummaries.length > 0 && (
          <div className="graph-rail-section">
            <div className="graph-rail-section-title">
              <Boxes size={11} /> Groups
            </div>
            <ul className="graph-rail-group-list">
              {groupSummaries.map((group) => (
                <li key={group.name}>
                  <button
                    type="button"
                    className={`graph-rail-group-item ${activeGroup === group.name ? 'active' : ''}`}
                    onClick={() => onSelectGroup(activeGroup === group.name ? null : group.name)}
                    aria-pressed={activeGroup === group.name}
                  >
                    <span className="graph-rail-group-swatch" style={{ background: group.color }} />
                    <span className="graph-rail-group-name">{group.name || 'Ungrouped'}</span>
                    <span className="graph-rail-group-count">{group.count}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="graph-rail-section">
          <div className="graph-rail-section-title">
            <Hash size={11} /> Tag
          </div>
          <div className="graph-rail-tag-select-wrap">
            <select
              className="graph-rail-tag-select"
              value={filterState.selectedTag || ''}
              onChange={(event) =>
                onFilterStateChange({
                  ...filterState,
                  selectedTag: event.target.value || undefined,
                  activeFilter: event.target.value ? 'tag' : 'all',
                })
              }
            >
              <option value="">All tags</option>
              {allTags.map((tag) => (
                <option key={tag} value={tag}>
                  #{tag}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="graph-rail-section">
          <div className="graph-rail-section-title">
            <Network size={11} /> Nodes
          </div>
          <div className="graph-rail-toggles">
            <button
              type="button"
              className="graph-rail-toggle"
              onClick={() =>
                onFilterStateChange({ ...filterState, showOrphans: !filterState.showOrphans })
              }
              aria-pressed={filterState.showOrphans}
            >
              <span>Orphans</span>
              <span
                className={`graph-rail-toggle-switch ${filterState.showOrphans ? 'active' : ''}`}
              />
            </button>
            <button
              type="button"
              className="graph-rail-toggle"
              onClick={() =>
                onFilterStateChange({ ...filterState, showAgents: !filterState.showAgents })
              }
              aria-pressed={filterState.showAgents}
            >
              <span>Agents / Skills / Tools</span>
              <span
                className={`graph-rail-toggle-switch ${filterState.showAgents ? 'active' : ''}`}
              />
            </button>
            <button
              type="button"
              className="graph-rail-toggle"
              onClick={() =>
                onFilterStateChange({
                  ...filterState,
                  showBrokenLinks: !filterState.showBrokenLinks,
                })
              }
              aria-pressed={filterState.showBrokenLinks}
            >
              <span>Broken links</span>
              <span
                className={`graph-rail-toggle-switch warning ${filterState.showBrokenLinks ? 'active' : ''}`}
              />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
