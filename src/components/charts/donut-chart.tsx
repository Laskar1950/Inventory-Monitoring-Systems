"use client";

import { useMemo } from "react";

interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  segments: DonutSegment[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string | number;
}

export function DonutChart({
  segments,
  size = 160,
  thickness = 36,
  centerLabel,
  centerValue,
}: DonutChartProps) {
  const total = useMemo(() => segments.reduce((s, seg) => s + seg.value, 0), [segments]);
  const r = (size - thickness) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;

  let cumulative = 0;
  const arcs = segments.map((seg) => {
    const pct = total > 0 ? seg.value / total : 0;
    const offset = circumference - pct * circumference;
    const rotate = (cumulative / total) * 360 - 90;
    cumulative += seg.value;
    return { ...seg, pct, offset, rotate };
  });

  return (
    <div style={{ position: "relative", width: size, height: size, margin: "0 auto" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {arcs.map((arc, i) => (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={arc.color}
            strokeWidth={thickness}
            strokeDasharray={circumference}
            strokeDashoffset={arc.offset}
            strokeLinecap="butt"
            transform={`rotate(${arc.rotate} ${cx} ${cy})`}
            opacity={0.9}
          >
            <title>{arc.label}: {arc.value} ({(arc.pct * 100).toFixed(1)}%)</title>
          </circle>
        ))}
        {total === 0 && (
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--color-divider)" strokeWidth={thickness} />
        )}
      </svg>
      {(centerValue !== undefined || centerLabel) && (
        <div style={{
          position: "absolute", top: "50%", left: "50%",
          transform: "translate(-50%,-50%)", textAlign: "center", pointerEvents: "none",
        }}>
          {centerValue !== undefined && (
            <div style={{ fontSize: "clamp(1.1rem,2vw,1.4rem)", fontWeight: 800, color: "var(--color-text)", fontVariantNumeric: "tabular-nums" }}>
              {centerValue}
            </div>
          )}
          {centerLabel && (
            <div style={{ fontSize: "0.7rem", color: "var(--color-text-muted)", marginTop: 1 }}>
              {centerLabel}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
