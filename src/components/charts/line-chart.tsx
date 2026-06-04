"use client";

import { useMemo } from "react";

interface LineDataset {
  label: string;
  data: number[];
  color: string;
  dashed?: boolean;
  fill?: boolean;
}

interface LineChartProps {
  labels: string[];
  datasets: LineDataset[];
  height?: number;
}

export function LineChart({ labels, datasets, height = 200 }: LineChartProps) {
  const padding = { top: 16, right: 16, bottom: 32, left: 40 };
  const w = 560;
  const h = height;
  const innerW = w - padding.left - padding.right;
  const innerH = h - padding.top - padding.bottom;

  const maxVal = useMemo(() => Math.max(...datasets.flatMap((d) => d.data), 1), [datasets]);
  const tickCount = 4;
  const yTicks = Array.from({ length: tickCount + 1 }, (_, i) => Math.round((maxVal / tickCount) * i));

  function pts(data: number[]) {
    return data.map((v, i) => {
      const x = (i / (data.length - 1)) * innerW;
      const y = innerH - (v / maxVal) * innerH;
      return [x, y] as [number, number];
    });
  }

  function smooth(points: [number, number][]) {
    if (points.length < 2) return "";
    let d = `M ${points[0][0]} ${points[0][1]}`;
    for (let i = 1; i < points.length; i++) {
      const [x0, y0] = points[i - 1];
      const [x1, y1] = points[i];
      const cpx = (x0 + x1) / 2;
      d += ` C ${cpx} ${y0} ${cpx} ${y1} ${x1} ${y1}`;
    }
    return d;
  }

  function areaPath(points: [number, number][]) {
    const line = smooth(points);
    if (!line) return "";
    const last = points[points.length - 1];
    const first = points[0];
    return `${line} L ${last[0]} ${innerH} L ${first[0]} ${innerH} Z`;
  }

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%" style={{ overflow: "visible" }}>
      <defs>
        {datasets.filter((d) => d.fill).map((ds) => (
          <linearGradient key={ds.label} id={`fill-${ds.label.replace(/\s/g, "-")}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={ds.color} stopOpacity={0.25} />
            <stop offset="100%" stopColor={ds.color} stopOpacity={0.01} />
          </linearGradient>
        ))}
      </defs>
      <g transform={`translate(${padding.left},${padding.top})`}>
        {/* Grid */}
        {yTicks.map((t) => {
          const y = innerH - (t / maxVal) * innerH;
          return (
            <g key={t}>
              <line x1={0} y1={y} x2={innerW} y2={y} stroke="var(--color-divider)" strokeWidth={1} />
              <text x={-6} y={y + 4} textAnchor="end" fontSize={10} fill="var(--color-text-muted)">{t}</text>
            </g>
          );
        })}
        {/* X labels */}
        {labels.map((l, i) => (
          <text key={l} x={(i / (labels.length - 1)) * innerW} y={innerH + 16} textAnchor="middle" fontSize={10} fill="var(--color-text-muted)">{l}</text>
        ))}
        {/* Fill areas */}
        {datasets.filter((d) => d.fill).map((ds) => (
          <path
            key={`area-${ds.label}`}
            d={areaPath(pts(ds.data))}
            fill={`url(#fill-${ds.label.replace(/\s/g, "-")})`}
          />
        ))}
        {/* Lines */}
        {datasets.map((ds) => (
          <path
            key={ds.label}
            d={smooth(pts(ds.data))}
            fill="none"
            stroke={ds.color}
            strokeWidth={2.5}
            strokeDasharray={ds.dashed ? "5 3" : undefined}
          />
        ))}
        {/* Dots */}
        {datasets.map((ds) =>
          pts(ds.data).map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={4} fill={ds.color}>
              <title>{ds.label}: {ds.data[i]}</title>
            </circle>
          ))
        )}
      </g>
    </svg>
  );
}
