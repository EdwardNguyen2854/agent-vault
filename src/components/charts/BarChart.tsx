interface BarRow {
  label: string;
  value: number;
  subValue?: number;
  subLabel?: string;
  color?: string;
}

interface BarChartProps {
  data: BarRow[];
  orientation?: 'horizontal' | 'vertical';
  valueFormat?: (value: number) => string;
  onSelect?: (label: string) => void;
  maxItems?: number;
  emptyText?: string;
  accentColor?: string;
}

export function BarChart({
  data,
  orientation = 'horizontal',
  valueFormat,
  onSelect,
  maxItems = 8,
  emptyText = 'No data yet',
  accentColor = 'var(--primary)',
}: BarChartProps) {
  const format = valueFormat ?? ((v: number) => String(v));
  const items = data.slice(0, maxItems);

  if (items.length === 0) {
    return (
      <div className="chart-empty">
        <span>{emptyText}</span>
      </div>
    );
  }

  const max = Math.max(...items.map((i) => i.value), 1);

  if (orientation === 'horizontal') {
    return (
      <div className="bar-chart bar-chart-horizontal">
        {items.map((row) => {
          const pct = max > 0 ? (row.value / max) * 100 : 0;
          const Wrapper = onSelect ? 'button' : 'div';
          return (
            <Wrapper
              key={row.label}
              className="bar-row"
              onClick={onSelect ? () => onSelect(row.label) : undefined}
              type={onSelect ? 'button' : undefined}
            >
              <span className="bar-label" title={row.label}>
                {row.label}
              </span>
              <span className="bar-track">
                <span
                  className="bar-fill"
                  style={{ width: `${pct}%`, backgroundColor: row.color ?? accentColor }}
                />
                {row.subValue !== undefined && (
                  <span
                    className="bar-fill bar-fill-sub"
                    style={{
                      width: `${(row.subValue / max) * 100}%`,
                      left: 0,
                      backgroundColor: 'var(--positive)',
                      opacity: 0.5,
                    }}
                  />
                )}
              </span>
              <span className="bar-value">
                {format(row.value)}
                {row.subLabel ? <small> · {row.subLabel}</small> : null}
              </span>
            </Wrapper>
          );
        })}
      </div>
    );
  }

  // Vertical orientation
  return (
    <div className="bar-chart bar-chart-vertical">
      {items.map((row) => {
        const pct = max > 0 ? (row.value / max) * 100 : 0;
        return (
          <div key={row.label} className="bar-col">
            <div className="bar-col-track">
              <div
                className="bar-col-fill"
                style={{ height: `${pct}%`, backgroundColor: row.color ?? accentColor }}
              />
            </div>
            <span className="bar-col-label">{row.label}</span>
            <span className="bar-col-value">{format(row.value)}</span>
          </div>
        );
      })}
    </div>
  );
}
