interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  data: DonutSlice[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string;
  emptyText?: string;
}

export function DonutChart({
  data,
  size = 160,
  thickness = 22,
  centerLabel,
  centerValue,
  emptyText = 'No runs yet',
}: DonutChartProps) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const radius = size / 2 - thickness / 2;
  const circumference = 2 * Math.PI * radius;

  if (total === 0) {
    return (
      <div className="donut-empty">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--border-light)"
            strokeWidth={thickness}
          />
        </svg>
        <span>{emptyText}</span>
      </div>
    );
  }

  let offset = 0;
  const slices = data.map((d) => {
    const fraction = d.value / total;
    const dash = fraction * circumference;
    const segment = (
      <circle
        key={d.label}
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={d.color}
        strokeWidth={thickness}
        strokeDasharray={`${dash} ${circumference - dash}`}
        strokeDashoffset={-offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        strokeLinecap="butt"
      />
    );
    offset += dash;
    return segment;
  });

  return (
    <div className="donut-chart">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label="Donut chart"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border-light)"
          strokeWidth={thickness}
        />
        {slices}
        {centerValue && (
          <text x={size / 2} y={size / 2 - 4} textAnchor="middle" className="donut-center-value">
            {centerValue}
          </text>
        )}
        {centerLabel && (
          <text x={size / 2} y={size / 2 + 14} textAnchor="middle" className="donut-center-label">
            {centerLabel}
          </text>
        )}
      </svg>
      <ul className="donut-legend">
        {data.map((d) => (
          <li key={d.label}>
            <span className="donut-legend-swatch" style={{ backgroundColor: d.color }} />
            <span className="donut-legend-label">{d.label}</span>
            <span className="donut-legend-value">{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
