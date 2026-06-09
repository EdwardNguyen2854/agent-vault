interface SparklineProps {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
  filled?: boolean;
}

export function Sparkline({
  values,
  width = 80,
  height = 22,
  color = 'var(--primary)',
  filled = true,
}: SparklineProps) {
  if (values.length === 0) {
    return (
      <svg
        className="sparkline sparkline-empty"
        viewBox={`0 0 ${width} ${height}`}
        aria-hidden="true"
      />
    );
  }
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const stepX = values.length > 1 ? width / (values.length - 1) : width;
  const points = values.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / range) * (height - 2) - 1;
    return [x, y] as const;
  });
  const pathD = points
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`)
    .join(' ');
  const areaD = `${pathD} L${width},${height} L0,${height} Z`;

  return (
    <svg
      className="sparkline"
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      aria-hidden="true"
    >
      {filled && <path d={areaD} fill={color} fillOpacity={0.12} />}
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
