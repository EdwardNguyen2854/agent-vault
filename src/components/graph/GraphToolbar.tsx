import { Search, Box, Focus, EyeOff, RotateCw, Settings2, Maximize2, X } from 'lucide-react';
import type { ViewMode } from './useGraphCamera';

interface GraphToolbarProps {
  query: string;
  onQueryChange: (q: string) => void;
  viewMode: ViewMode;
  onViewModeChange: (m: ViewMode) => void;
  localOnly: boolean;
  onToggleLocal: () => void;
  hideMissing: boolean;
  onToggleHideMissing: () => void;
  autoRotate: boolean;
  onToggleAutoRotate: () => void;
  filterRailOpen: boolean;
  onToggleFilterRail: () => void;
  inspectorOpen: boolean;
  onToggleInspector: () => void;
  onFit: () => void;
  onReset: () => void;
}

export function GraphToolbar({
  query,
  onQueryChange,
  viewMode,
  onViewModeChange,
  localOnly,
  onToggleLocal,
  hideMissing,
  onToggleHideMissing,
  autoRotate,
  onToggleAutoRotate,
  filterRailOpen,
  onToggleFilterRail,
  inspectorOpen,
  onToggleInspector,
  onFit,
  onReset,
}: GraphToolbarProps) {
  return (
    <div className="graph-toolbar">
      <div className="graph-toolbar-group">
        <div className="graph-segmented" role="tablist" aria-label="View mode">
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === '2d'}
            className={`graph-segmented-btn ${viewMode === '2d' ? 'active' : ''}`}
            onClick={() => onViewModeChange('2d')}
            title="Flat 2D view"
          >
            <span className="graph-segmented-glyph" aria-hidden="true">
              2D
            </span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === '3d'}
            className={`graph-segmented-btn ${viewMode === '3d' ? 'active' : ''}`}
            onClick={() => onViewModeChange('3d')}
            title="Immersive 3D view"
          >
            <span className="graph-segmented-glyph" aria-hidden="true">
              3D
            </span>
          </button>
        </div>

        <label className="graph-mini-search">
          <Search size={13} />
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Filter nodes…"
            spellCheck={false}
          />
          {query && (
            <button
              type="button"
              className="graph-mini-search-clear"
              aria-label="Clear search"
              onClick={() => onQueryChange('')}
            >
              <X size={11} />
            </button>
          )}
          <kbd className="graph-mini-search-kbd" aria-hidden="true">
            /
          </kbd>
        </label>
      </div>

      <div className="graph-toolbar-group">
        <button
          type="button"
          className={`ghost-button ${localOnly ? 'active' : ''}`}
          onClick={onToggleLocal}
          title="Show local neighborhood only"
        >
          <Focus size={13} /> Local
        </button>
        <button
          type="button"
          className={`ghost-button ${hideMissing ? 'active' : ''}`}
          onClick={onToggleHideMissing}
          title="Hide missing notes"
        >
          <EyeOff size={13} /> Missing
        </button>
        <button
          type="button"
          className={`ghost-button ${autoRotate ? 'active' : ''}`}
          onClick={onToggleAutoRotate}
          title="Auto-rotate camera"
          disabled={viewMode === '2d'}
        >
          <RotateCw size={13} /> Rotate
        </button>
        <button type="button" className="ghost-button" onClick={onFit} title="Fit graph to view">
          <Maximize2 size={13} /> Fit
        </button>
        <button type="button" className="ghost-button" onClick={onReset} title="Reset camera">
          <Box size={13} /> Reset
        </button>
        <button
          type="button"
          className={`ghost-button ${filterRailOpen ? 'active' : ''}`}
          onClick={onToggleFilterRail}
          title="Toggle filter panel"
          aria-expanded={filterRailOpen}
        >
          <Settings2 size={13} /> Filters
        </button>
        <button
          type="button"
          className={`ghost-button ${inspectorOpen ? 'active' : ''}`}
          onClick={onToggleInspector}
          title="Toggle inspector"
          aria-expanded={inspectorOpen}
        >
          Inspector
        </button>
      </div>
    </div>
  );
}
