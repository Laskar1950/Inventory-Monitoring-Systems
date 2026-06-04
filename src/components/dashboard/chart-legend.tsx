interface LegendItem {
  color: string;
  label: string;
}

export function ChartLegend({ items }: { items: LegendItem[] }) {
  return (
    <div className="dash-chart-legend">
      {items.map((item) => (
        <div key={item.label} className="dash-chart-legend-item">
          <span className="dash-chart-legend-dot" style={{ background: item.color }} />
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}
