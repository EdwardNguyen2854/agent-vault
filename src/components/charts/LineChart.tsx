interface LineSeries {
  label: string;
  color: string;
  points: number[];
}

interface LineChartProps {
  series: LineSeries[];
  xLabels: string[];
  height?: number;
  yFormat?: (value: number) => string;
  showLegend?: boolean;
  showGrid?: boolean;
  smooth?: boolean;
  emptyText?: string;
}

const PADDING = { top: 12, right: 8, bottom: 24, left: 32 };

export function LineChart({
  series,
  xLabels,
  height = 180,
  yFormat,
  showLegend = true,
  showGrid = true,
  smooth = true,
  emptyText = 'No data yet',
}: LineChartProps) {
  const allPoints = series.flatMap((s) => s.points);
  const hasData = allPoints.some((v) => v > 0);
  const max = Math.max(...allPoints, 1);
  const width = 640;
  const innerWidth = width - PADDING.left - PADDING.right;
  const innerHeight = height - PADDING.top - PADDING.bottom;

  if (!hasData) {
    return (
      <div className="chart-empty">
        <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
          <line
            x1={PADDING.left}
            y1={height / 2}
            x2={width - PADDING.right}
            y2={height / 2}
            stroke="var(--border-light)"
            strokeWidth={1}
          />
        </svg>
        <span>{emptyText}</span>
      </div>
    );
  }

  const xStep = xLabels.length > 1 ? innerWidth / (xLabels.length - 1) : innerWidth;
  const yTicks = 4;

  const format = yFormat ?? ((v: number) => String(v));

  const buildPath = (points: number[]): string => {
    if (points.length === 0) return '';
    return points
      .map((v, i) => {
        const x = PADDING.left + i * xStep;
        const y = PADDING.top + innerHeight - (v / max) * innerHeight;
        if (i === 0) return `M${x.toFixed(1)},${y.toFixed(1)}`;
        if (smooth && i < points.length - 1) {
          const nextX = PADDING.left + (i + 1) * xStep;
          const nextY = PADDING.top + innerHeight - (points[i + 1] / max) * innerHeight;
          const cx1 = x + (nextX - x) / 2;
          const cy1 = y;
          const cx2 = x + (nextX - x) / 2;
          const cy2 = nextY;
          return `C${cx1.toFixed(1)},${cy1.toFixed(1)} ${cx2.toFixed(1)},${cy2.toFixed(1)} ${nextX.toFixed(1)},${nextY.toFixed(1)}`;
        }
        return `L${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  };

  const buildArea = (points: number[]): string => {
    const line = buildPath(points);
    if (!line) return '';
    const lastX = PADDING.left + (points.length - 1) * xStep;
    return `${line} L${lastX.toFixed(1)},${(PADDING.top + innerHeight).toFixed(1)} L${PADDING.left.toFixed(1)},${(PADDING.top + innerHeight).toFixed(1)} Z`;
  };

  return (
    <div className="line-chart">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label="Line chart"
      >
        {showGrid &&
          Array.from({ length: yTicks + 1 }).map((_, i) => {
            const y = PADDING.top + (i / yTicks) * innerHeight;
            const value = max - (i / yTicks) * max;
            return (
              <g key={i}>
                <line
                  x1={PADDING.left}
                  y1={y}
                  x2={width - PADDING.right}
                  y2={y}
                  stroke="var(--border-light)"
                  strokeWidth={1}
                  strokeDasharray={i === yTicks ? '0' : '2 3'}
                />
                <text x={PADDING.left - 6} y={y + 3} textAnchor="end" className="chart-axis-label">
                  {format(Math.round(value))}
                </text>
              </g>
            );
          })}
        {xLabels.map((label, i) => {
          const x = PADDING.left + i * xStep;
          const showLabel =
            xLabels.length <= 14 ||
            i === 0 ||
            i === xLabels.length - 1 ||
            i % Math.ceil(xLabels.length / 7) === 0;
          if (!showLabel) return null;
          return (
            <text key={i} x={x} y={height - 6} textAnchor="middle" className="chart-axis-label">
              {label}
            </text>
          );
        })}
        {series.map((s) => (
          <g key={s.label}>
            <path d={buildArea(s.points)} fill={s.color} fillOpacity={0.08} />
            <path
              d={buildPath(s.points)}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        ))}
        {series.map((s) =>
          s.points.map((v, i) => {
            if (v === 0) return null;
            const x = PADDING.left + i * xStep;
            const y = PADDING.top + innerHeight - (v / max) * innerHeight;
            return <circle key={`${s.label}-${i}`} cx={x} cy={y} r={2.5} fill={s.color} />;
          }),
        )}
      </svg>
      {showLegend && series.length > 1 && (
        <div className="chart-legend">
          {series.map((s) => (
            <span key={s.label} className="chart-legend-item">
              <span className="chart-legend-swatch" style={{ backgroundColor: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
