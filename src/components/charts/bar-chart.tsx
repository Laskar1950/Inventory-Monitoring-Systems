"use client";

import { useMemo } from "react";

interface BarDataset {
  label: string;
  data: number[];
  color: string;
  stack?: string;
}

interface BarChartProps {
  labels: string[];
  datasets: BarDataset[];
  height?: number;
  horizontal?: boolean;
  stacked?: boolean;
  showLegend?: boolean;
}

export function BarChart({
  labels,
  datasets,
  height = 200,
  horizontal = false,
  stacked = false,
  showLegend = false,
}: BarChartProps) {
  const padding = { top: 16, right: 12, bottom: 32, left: 40 };
  const w = 560;
  const h = height;
  const innerW = w - padding.left - padding.right;
  const innerH = h - padding.top - padding.bottom;

  const maxVal = useMemo(() => {
    if (stacked) {
      const totals = labels.map((_, i) => datasets.reduce((s, d) => s + (d.data[i] ?? 0), 0));
      return Math.max(...totals, 1);
    }
    return Math.max(...datasets.flatMap((d) => d.data), 1);
  }, [labels, datasets, stacked]);

  const tickCount = 4;
  const yTicks = Array.from({ length: tickCount + 1 }, (_, i) =>
    Math.round((maxVal / tickCount) * i)
  );

  if (horizontal) {
    const barH = Math.min(22, (innerH / labels.length) * 0.6);
    const rowH = innerH / labels.length;
    return (
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%" style={{ overflow: "visible" }}>
        <g transform={`translate(${padding.left},${padding.top})`}>
          {/* Grid lines */}
          {yTicks.map((t) => {
            const x = (t / maxVal) * innerW;
            return (
              <g key={t}>
                <line x1={x} y1={0} x2={x} y2={innerH} stroke="var(--color-divider)" strokeWidth={1} />
                <text x={x} y={innerH + 14} textAnchor="middle" fontSize={10} fill="var(--color-text-muted)">{t}</text>
              </g>
            );
          })}
          {labels.map((label, i) => {
            const y = i * rowH + (rowH - barH) / 2;
            return (
              <g key={label}>
                <text x={-6} y={y + barH / 2 + 4} textAnchor="end" fontSize={11} fill="var(--color-text-muted)">{label.length > 14 ? label.slice(0, 13) + "…" : label}</text>
                {datasets.map((ds, di) => {
                  const bw = (ds.data[i] / maxVal) * innerW;
                  const bx = stacked ? datasets.slice(0, di).reduce((s, d2) => s + (d2.data[i] / maxVal) * innerW, 0) : 0;
                  const offset = stacked ? 0 : di * (barH / datasets.length);
                  const bh = stacked ? barH : barH / datasets.length - 1;
                  return (
                    <rect key={di} x={bx} y={y + offset} width={Math.max(bw, 2)} height={bh} fill={ds.color} rx={2} opacity={0.88}>
                      <title>{ds.label}: {ds.data[i]}</title>
                    </rect>
                  );
                })}
                <text x={(datasets[0].data[i] / maxVal) * innerW + 4} y={y + barH / 2 + 4} fontSize={10} fill="var(--color-text-muted)">{datasets[0].data[i]}</text>
              </g>
            );
          })}
        </g>
      </svg>
    );
  }

  const groupW = innerW / labels.length;
  const barW = stacked
    ? groupW * 0.55
    : Math.min(28, (groupW * 0.7) / datasets.length);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%" style={{ overflow: "visible" }}>
      <g transform={`translate(${padding.left},${padding.top})`}>
        {/* Y grid */}
        {yTicks.map((t) => {
          const y = innerH - (t / maxVal) * innerH;
          return (
            <g key={t}>
              <line x1={0} y1={y} x2={innerW} y2={y} stroke="var(--color-divider)" strokeWidth={1} />
              <text x={-6} y={y + 4} textAnchor="end" fontSize={10} fill="var(--color-text-muted)">{t}</text>
            </g>
          );
        })}
        {/* Bars */}
        {labels.map((label, i) => {
          const cx = i * groupW + groupW / 2;
          let stackY = innerH;
          return (
            <g key={label}>
              {datasets.map((ds, di) => {
                const bh = (ds.data[i] / maxVal) * innerH;
                let x: number, y: number, bw: number;
                if (stacked) {
                  x = cx - barW / 2;
                  y = stackY - bh;
                  stackY -= bh;
                  bw = barW;
                } else {
                  bw = barW;
                  x = cx - (datasets.length * barW) / 2 + di * barW + di * 2;
                  y = innerH - bh;
                }
                return (
                  <rect key={di} x={x} y={Math.max(y, 0)} width={bw} height={Math.max(bh, 2)} fill={ds.color} rx={3} opacity={0.88}>
                    <title>{ds.label}: {ds.data[i]}</title>
                  </rect>
                );
              })}
              <text x={cx} y={innerH + 16} textAnchor="middle" fontSize={10} fill="var(--color-text-muted)">{label}</text>
            </g>
          );
        })}
      </g>
      {showLegend && (
        <g transform={`translate(${padding.left}, ${h - 10})`}>
          {datasets.map((ds, i) => (
            <g key={ds.label} transform={`translate(${i * 100}, 0)`}>
              <rect x={0} y={-6} width={10} height={10} fill={ds.color} rx={2} />
              <text x={14} y={4} fontSize={10} fill="var(--color-text-muted)">{ds.label}</text>
            </g>
          ))}
        </g>
      )}
    </svg>
  );
}
